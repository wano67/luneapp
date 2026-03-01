import { createHash, randomUUID } from 'crypto';
import { mkdir, readFile, writeFile, rm } from 'fs/promises';
import path from 'path';

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
  productId?: bigint | null;
  projectId?: bigint | null;
}) {
  const filename = sanitizeFilename(params.filename);
  const targetDir =
    params.clientId != null
      ? params.clientId.toString()
      : params.productId != null
        ? `product-${params.productId.toString()}`
        : params.projectId != null
          ? `project-${params.projectId.toString()}`
          : 'general';
  const dir = path.join(ROOT, params.businessId.toString(), targetDir);
  await mkdir(dir, { recursive: true });
  const unique = randomUUID();
  const storageKey = path.join(params.businessId.toString(), targetDir, `${unique}-${filename}`);
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

export async function deleteLocalFile(storageKey: string) {
  const fullPath = path.join(ROOT, storageKey);
  await rm(fullPath, { force: true });
}
