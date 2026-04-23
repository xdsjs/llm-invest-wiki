import { chmodSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export function installMockMarkitdown(dir: string): string {
  mkdirSync(dir, { recursive: true });
  const binPath = join(dir, 'markitdown');

  writeFileSync(binPath, `#!/usr/bin/env node
const { readFileSync, writeFileSync } = require('node:fs');

const args = process.argv.slice(2);
let inputPath = '';
let outputPath = '';
let mimeType = '';

for (let i = 0; i < args.length; i++) {
  const value = args[i];
  if (!value.startsWith('-') && !inputPath) {
    inputPath = value;
    continue;
  }
  if ((value === '-o' || value === '--output') && args[i + 1]) {
    outputPath = args[++i];
    continue;
  }
  if ((value === '-m' || value === '--mime-type') && args[i + 1]) {
    mimeType = args[++i];
  }
}

if (!inputPath || !outputPath) {
  console.error('missing input or output');
  process.exit(1);
}

if (mimeType.includes('powerpoint') || inputPath.endsWith('.ppt') || inputPath.endsWith('.pptx')) {
  console.error('unsupported content-type');
  process.exit(2);
}

const body = readFileSync(inputPath, 'utf-8').trim();
writeFileSync(outputPath, body ? '# Mock MarkItDown\\n\\n' + body + '\\n' : '# Mock MarkItDown\\n');
`);

  chmodSync(binPath, 0o755);
  return binPath;
}
