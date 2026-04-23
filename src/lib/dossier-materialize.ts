import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { extname, join } from 'node:path';
import { tmpdir } from 'node:os';
import type { DossierMaterialInput } from './dossier.js';
import { secHeaders } from './sec-submissions.js';

const DEFAULT_USER_AGENT = 'Mozilla/5.0 (compatible; llm-wiki-invest/0.0.2)';

function normalizeMimeType(value?: string): string {
  return (value ?? '').split(';', 1)[0].trim().toLowerCase();
}

function extensionFromMimeType(mimeType: string): string {
  switch (mimeType) {
    case 'text/html':
      return '.html';
    case 'text/plain':
      return '.txt';
    case 'text/markdown':
      return '.md';
    case 'application/json':
      return '.json';
    case 'application/xml':
    case 'text/xml':
      return '.xml';
    case 'application/pdf':
      return '.pdf';
    default:
      return '';
  }
}

function extensionFromUrl(rawUrl: string): string {
  try {
    const url = new URL(rawUrl);
    const ext = extname(url.pathname).toLowerCase();
    return ext.length > 0 ? ext : '';
  } catch {
    return '';
  }
}

function inferSourceExtension(input: DossierMaterialInput, mimeType: string): string {
  return (
    extensionFromUrl(input.source) ||
    extensionFromUrl(input.canonicalUrl) ||
    extensionFromMimeType(mimeType) ||
    extensionFromMimeType(normalizeMimeType(input.contentType)) ||
    '.bin'
  );
}

function buildRequestHeaders(input: DossierMaterialInput): Record<string, string> {
  if (input.authority === 'sec') {
    return {
      ...secHeaders(),
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    };
  }

  return {
    Accept: '*/*',
    'User-Agent': DEFAULT_USER_AGENT,
  };
}

function markitdownBinary(): string {
  return process.env.LLM_WIKI_MARKITDOWN_BIN || 'markitdown';
}

function runMarkitdown(inputPath: string, outputPath: string, mimeType: string): void {
  const args = [inputPath, '-o', outputPath];
  if (mimeType) {
    args.push('--mime-type', mimeType);
  }

  const result = spawnSync(markitdownBinary(), args, { encoding: 'utf-8' });
  if (result.error) {
    throw new Error(`markitdown execution failed: ${result.error.message}`);
  }
  if (result.status !== 0) {
    const detail = result.stderr?.trim() || result.stdout?.trim() || `exit ${result.status}`;
    throw new Error(`markitdown failed: ${detail}`);
  }
}

async function downloadSource(
  input: DossierMaterialInput
): Promise<{ buffer: Buffer; mimeType: string; retrievedAt: string }> {
  const response = await fetch(input.source, {
    headers: buildRequestHeaders(input),
  });
  if (!response.ok) {
    throw new Error(`fetch failed: ${response.status}`);
  }

  return {
    buffer: Buffer.from(await response.arrayBuffer()),
    mimeType: normalizeMimeType(response.headers.get('content-type') ?? input.contentType),
    retrievedAt: new Date().toISOString(),
  };
}

function canFallbackToPdfParse(error: unknown, mimeType: string, sourcePath: string): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return (
    (mimeType === 'application/pdf' || sourcePath.endsWith('.pdf')) &&
    (message.includes('PdfConverter') || message.includes('MissingDependencyException'))
  );
}

async function fallbackPdfMaterialize(buffer: Buffer): Promise<string> {
  const pdfParse = (await import('pdf-parse')).default;
  const result = await pdfParse(buffer);
  const body = result.text.trim();
  if (!body) {
    throw new Error('pdf-parse produced empty output');
  }
  return body;
}

export async function materializeSource(
  input: DossierMaterialInput
): Promise<{ body: string; retrievedAt: string }> {
  const { buffer, mimeType, retrievedAt } = await downloadSource(input);
  const workDir = mkdtempSync(join(tmpdir(), 'llm-wiki-invest-markitdown-'));
  const sourcePath = join(workDir, `source${inferSourceExtension(input, mimeType)}`);
  const outputPath = join(workDir, 'output.md');

  try {
    writeFileSync(sourcePath, buffer);
    try {
      runMarkitdown(sourcePath, outputPath, mimeType);
      const body = readFileSync(outputPath, 'utf-8').trim();
      if (!body) {
        throw new Error('markitdown produced empty output');
      }
      return { body, retrievedAt };
    } catch (error) {
      if (!canFallbackToPdfParse(error, mimeType, sourcePath)) {
        throw error;
      }

      return {
        body: await fallbackPdfMaterialize(buffer),
        retrievedAt,
      };
    }
  } finally {
    rmSync(workDir, { recursive: true, force: true });
  }
}
