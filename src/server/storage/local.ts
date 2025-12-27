import { createHash } from 'crypto';
import { mkdir, readFile, writeFile } from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';

const ROOT = path.join(process.cwd(), 'uploads');

function sanitizeFilename(name: string) {
  const cleaned = name.replace(/[/\\?%*:|"<>]/g, '').replace(/\s+/g, ' ').trim();
  return cleaned || 'document';
}

export async function saveLocalFile(params: {
  buffer: Buffer;
  filename: string;
  businessId: bigint;
  clientId?: bigint | null;
}) {
  const filename = sanitizeFilename(params.filename);
  const dir = path.join(ROOT, params.businessId.toString(), params.clientId ? params.clientId.toString() : 'general');
  await mkdir(dir, { recursive: true });
  const unique = randomUUID();
  const storageKey = path.join(
    params.businessId.toString(),
    params.clientId ? params.clientId.toString() : 'general',
    `${unique}-${filename}`,
  );
  const fullPath = path.join(ROOT, storageKey);
  await writeFile(fullPath, params.buffer);
  const sha = createHash('sha256').update(params.buffer).digest('hex');
  return { storageKey, filename, sha };
}

export async function readLocalFile(storageKey: string) {
  const fullPath = path.join(ROOT, storageKey);
  const buffer = await readFile(fullPath);
  return buffer;
}
