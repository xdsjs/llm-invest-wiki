import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { extname, join } from 'node:path';
import { tmpdir } from 'node:os';
import Defuddle from 'defuddle';
import { parseHTML } from 'linkedom';
import type { DossierMaterialInput } from './dossier.js';
import { secHeaders } from './sec-submissions.js';

const DEFAULT_USER_AGENT = 'Mozilla/5.0 (compatible; llm-wiki-invest/0.0.2)';

export type MaterializerName = 'defuddle-markitdown' | 'markitdown' | 'pdf-parse';

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

function assertMaterializedBody(body: string, materializer: MaterializerName): string {
  const trimmed = body.trim();
  if (!trimmed) {
    throw new Error(`${materializer} produced empty output`);
  }
  return trimmed;
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
  return assertMaterializedBody(result.text, 'pdf-parse');
}

function isHtmlSource(input: DossierMaterialInput, mimeType: string, sourcePath: string): boolean {
  const inputMimeType = normalizeMimeType(input.contentType);
  return (
    mimeType === 'text/html' ||
    inputMimeType === 'text/html' ||
    sourcePath.endsWith('.html') ||
    sourcePath.endsWith('.htm')
  );
}

function elementName(element: unknown): string {
  const candidate = element as { localName?: unknown; tagName?: unknown };
  return String(candidate.localName ?? candidate.tagName ?? '').toLowerCase();
}

function removeElement(element: unknown): void {
  const node = element as { remove?: () => void; parentNode?: { removeChild: (child: unknown) => void } };
  if (typeof node.remove === 'function') {
    node.remove();
    return;
  }
  node.parentNode?.removeChild(node);
}

function unwrapElement(element: unknown): void {
  const node = element as {
    firstChild?: unknown;
    parentNode?: {
      insertBefore: (newNode: unknown, referenceNode: unknown) => void;
      removeChild: (child: unknown) => void;
    };
  };
  const parent = node.parentNode;
  if (!parent) {
    return;
  }
  while (node.firstChild) {
    parent.insertBefore(node.firstChild, node);
  }
  parent.removeChild(node);
}

function cleanInlineXbrlHtml(html: string): string {
  const { document } = parseHTML(`<html><body>${html}</body></html>`);

  for (const element of Array.from(document.querySelectorAll('script, style, noscript'))) {
    removeElement(element);
  }

  for (const element of Array.from(document.querySelectorAll('*'))) {
    const name = elementName(element);
    if (!name.startsWith('ix:')) {
      continue;
    }

    if (name === 'ix:header' || name === 'ix:hidden' || name === 'ix:references' || name === 'ix:resources') {
      removeElement(element);
      continue;
    }

    unwrapElement(element);
  }

  return assertMaterializedBody(document.body.innerHTML, 'defuddle-markitdown');
}

function extractDefuddledHtml(buffer: Buffer, input: DossierMaterialInput): string {
  const html = buffer.toString('utf-8');
  const { document } = parseHTML(html);
  const parsed = new Defuddle(document as never, {
    url: input.canonicalUrl || input.source,
  }).parse();

  return cleanInlineXbrlHtml(parsed.content);
}

function runMarkitdownMaterializer(
  inputPath: string,
  outputPath: string,
  mimeType: string
): { body: string; materializer: MaterializerName } {
  runMarkitdown(inputPath, outputPath, mimeType);
  return {
    body: assertMaterializedBody(readFileSync(outputPath, 'utf-8'), 'markitdown'),
    materializer: 'markitdown',
  };
}

function runDefuddleMarkitdownMaterializer(
  buffer: Buffer,
  input: DossierMaterialInput,
  workDir: string,
  outputPath: string
): { body: string; materializer: MaterializerName } {
  const cleanedHtml = extractDefuddledHtml(buffer, input);
  const cleanedPath = join(workDir, 'defuddle-clean.html');
  writeFileSync(cleanedPath, cleanedHtml);
  runMarkitdown(cleanedPath, outputPath, 'text/html');
  return {
    body: assertMaterializedBody(readFileSync(outputPath, 'utf-8'), 'defuddle-markitdown'),
    materializer: 'defuddle-markitdown',
  };
}

export async function materializeSource(
  input: DossierMaterialInput
): Promise<{ body: string; retrievedAt: string; materializer: MaterializerName }> {
  const { buffer, mimeType, retrievedAt } = await downloadSource(input);
  const workDir = mkdtempSync(join(tmpdir(), 'llm-wiki-invest-markitdown-'));
  const sourcePath = join(workDir, `source${inferSourceExtension(input, mimeType)}`);
  const outputPath = join(workDir, 'output.md');

  try {
    writeFileSync(sourcePath, buffer);
    let htmlPipelineError: unknown;

    if (isHtmlSource(input, mimeType, sourcePath)) {
      try {
        return {
          ...runDefuddleMarkitdownMaterializer(buffer, input, workDir, outputPath),
          retrievedAt,
        };
      } catch (error) {
        htmlPipelineError = error;
      }
    }

    try {
      return {
        ...runMarkitdownMaterializer(sourcePath, outputPath, mimeType),
        retrievedAt,
      };
    } catch (error) {
      if (!canFallbackToPdfParse(error, mimeType, sourcePath)) {
        if (htmlPipelineError) {
          const primary = htmlPipelineError instanceof Error ? htmlPipelineError.message : String(htmlPipelineError);
          const fallback = error instanceof Error ? error.message : String(error);
          throw new Error(`defuddle-markitdown failed: ${primary}; markitdown fallback failed: ${fallback}`);
        }
        throw error;
      }

      return {
        body: await fallbackPdfMaterialize(buffer),
        retrievedAt,
        materializer: 'pdf-parse',
      };
    }
  } finally {
    rmSync(workDir, { recursive: true, force: true });
  }
}
