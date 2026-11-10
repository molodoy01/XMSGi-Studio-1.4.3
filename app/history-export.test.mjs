import { afterEach, describe, expect, it } from 'vitest';
import { Buffer } from 'node:buffer';
import { inflateRawSync } from 'node:zlib';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { createHistoryBackup } = require('./history-export.cjs');
const temporaryDirectories = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

function readZipEntries(filePath) {
  const zip = readFileSync(filePath);
  const endOffset = zip.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  const entryCount = zip.readUInt16LE(endOffset + 10);
  let cursor = zip.readUInt32LE(endOffset + 16);
  const entries = new Map();

  for (let index = 0; index < entryCount; index += 1) {
    const nameLength = zip.readUInt16LE(cursor + 28);
    const extraLength = zip.readUInt16LE(cursor + 30);
    const commentLength = zip.readUInt16LE(cursor + 32);
    const compressedSize = zip.readUInt32LE(cursor + 20);
    const method = zip.readUInt16LE(cursor + 10);
    const localOffset = zip.readUInt32LE(cursor + 42);
    const name = zip.subarray(cursor + 46, cursor + 46 + nameLength).toString('utf8');
    const localNameLength = zip.readUInt16LE(localOffset + 26);
    const localExtraLength = zip.readUInt16LE(localOffset + 28);
    const bodyOffset = localOffset + 30 + localNameLength + localExtraLength;
    const body = zip.subarray(bodyOffset, bodyOffset + compressedSize);
    entries.set(name, method === 8 ? inflateRawSync(body) : body);
    cursor += 46 + nameLength + extraLength + commentLength;
  }

  return entries;
}

describe('Posts media backup', () => {
  it('includes files, deduplicates shared attachments, and records missing files', async () => {
    const directory = mkdtempSync(path.join(tmpdir(), 'xmsgi-posts-export-'));
    temporaryDirectories.push(directory);
    const attachmentPath = path.join(directory, 'release.png');
    const missingPath = path.join(directory, 'missing.pdf');
    const outputPath = path.join(directory, 'backup.zip');
    writeFileSync(attachmentPath, Buffer.from('local-image'));

    const result = await createHistoryBackup(outputPath, {
      filters: { source: 'all', status: 'all', query: '' },
      records: [
        {
          id: 'one',
          attachments: [attachmentPath, attachmentPath, missingPath],
          original: { kind: 'scheduled', message: { attachments: [attachmentPath] } },
        },
        { id: 'two', attachments: [attachmentPath] },
      ],
    });

    const entries = readZipEntries(outputPath);
    const manifest = JSON.parse(entries.get('posts-backup.json').toString('utf8'));
    expect(result).toEqual({ success: true, missingAttachments: 1 });
    expect([...entries.keys()]).toHaveLength(2);
    expect(manifest.records[0].attachments[0]).toBe(manifest.records[0].attachments[1]);
    expect(manifest.records[0].attachments[0]).toBe(manifest.records[1].attachments[0]);
    expect(manifest.records[0].attachments[0]).toMatch(/^attachments\//);
    expect(manifest.records[0].attachments[2]).toMatch(/^missing\//);
    expect(manifest.records[0].original.message.attachments[0]).toBe(manifest.records[0].attachments[0]);
    expect(JSON.stringify(manifest)).not.toContain(directory);
    expect(manifest.attachments).toMatchObject([{
      archivePath: manifest.records[0].attachments[0],
      name: 'release.png',
      size: 11,
    }]);
    expect(manifest.missingAttachments).toEqual([{
      archivePath: manifest.records[0].attachments[2],
      name: 'missing.pdf',
      error: 'Attachment file was not found.',
    }]);
    expect(entries.get(manifest.records[0].attachments[0]).toString()).toBe('local-image');
  });

  it('embeds data URLs and reports remote attachments instead of silently dropping them', async () => {
    const directory = mkdtempSync(path.join(tmpdir(), 'xmsgi-posts-export-'));
    temporaryDirectories.push(directory);
    const outputPath = path.join(directory, 'backup.zip');
    const dataUrl = 'data:image/png;base64,aW1hZ2U=';

    const result = await createHistoryBackup(outputPath, {
      filters: { source: 'workspace', status: 'sent', query: '' },
      records: [{ id: 'one', attachments: [dataUrl, 'https://example.test/photo.png'] }],
    });

    const entries = readZipEntries(outputPath);
    const manifest = JSON.parse(entries.get('posts-backup.json').toString('utf8'));
    expect(result.missingAttachments).toBe(1);
    expect(entries.get(manifest.records[0].attachments[0]).toString()).toBe('image');
    expect(manifest.missingAttachments).toHaveLength(1);
    expect(manifest.missingAttachments[0].name).toBe('photo.png');
    expect(manifest.records[0].attachments[1]).toBe(manifest.missingAttachments[0].archivePath);
  });
});
