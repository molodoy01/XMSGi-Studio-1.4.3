const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { fileURLToPath } = require('node:url');

function getAttachmentSource(value) {
  if (typeof value !== 'string' || value.length === 0) {
    return { key: `invalid:${String(value)}`, name: 'attachment', error: 'Attachment reference is empty.' };
  }

  if (/^data:/i.test(value)) {
    const match = /^data:([^;,]+)?(;base64)?,([\s\S]*)$/i.exec(value);
    if (!match) return { key: `data:${value}`, name: 'image', error: 'Attachment data is invalid.' };
    try {
      const bytes = match[2]
        ? Buffer.from(match[3], 'base64')
        : Buffer.from(decodeURIComponent(match[3]));
      return {
        key: `data:${value}`,
        name: `image.${(match[1]?.split('/')[1] || 'bin').replace(/[^a-z0-9]/gi, '') || 'bin'}`,
        bytes,
      };
    } catch {
      return { key: `data:${value}`, name: 'image', error: 'Attachment data is invalid.' };
    }
  }

  if (/^(?:https?:|blob:)/i.test(value)) {
    const urlPath = value.replace(/^https?:\/\/[^/]+/i, '').split(/[?#]/, 1)[0];
    const name = path.posix.basename(urlPath) || 'attachment';
    return {
      key: `unavailable:${value}`,
      name,
      error: 'Remote or temporary attachments cannot be embedded in a local backup.',
    };
  }

  let filePath = value;
  if (/^file:/i.test(value)) {
    try {
      filePath = fileURLToPath(value);
    } catch {
      return { key: `unavailable:${value}`, name: path.basename(value), error: 'Attachment file URL is invalid.' };
    }
  }
  if (!path.isAbsolute(filePath)) {
    return {
      key: `unavailable:${value}`,
      name: path.basename(filePath) || 'attachment',
      error: 'Attachment path is not a local absolute path.',
    };
  }

  const resolvedPath = path.resolve(filePath);
  return {
    key: `file:${process.platform === 'win32' ? resolvedPath.toLowerCase() : resolvedPath}`,
    name: path.basename(filePath),
    filePath,
  };
}

function getArchiveFileName(index, name) {
  const safeName = path.basename(name).replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_').trim();
  return `attachments/${String(index).padStart(4, '0')}-${safeName || 'attachment'}`;
}

async function createHistoryBackup(filePath, payload) {
  if (!payload || !Array.isArray(payload.records)) {
    throw new Error('The Posts backup data is invalid.');
  }

  const attachmentEntries = [];
  const attachmentMap = new Map();
  const sourceCache = new Map();
  const missingAttachments = [];
  const getSource = (reference) => {
    const cacheKey = `${typeof reference}:${String(reference)}`;
    if (!sourceCache.has(cacheKey)) sourceCache.set(cacheKey, getAttachmentSource(reference));
    return sourceCache.get(cacheKey);
  };
  const collectOriginalAttachments = (value, references) => {
    if (!value || typeof value !== 'object') return;
    if (Array.isArray(value)) {
      value.forEach((item) => collectOriginalAttachments(item, references));
      return;
    }
    for (const [key, child] of Object.entries(value)) {
      if (key === 'attachments' && Array.isArray(child)) {
        child.forEach((attachment) => {
          if (typeof attachment === 'string') references.push(attachment);
          else if (attachment && typeof attachment === 'object') {
            references.push(attachment.path || attachment.sourcePath || attachment.name);
          }
        });
      } else {
        collectOriginalAttachments(child, references);
      }
    }
  };
  const mapAttachmentReference = (reference) => {
    const source = getSource(reference);
    return attachmentMap.get(source.key)?.archivePath ?? reference;
  };
  const rewriteOriginalAttachments = (value) => {
    if (!value || typeof value !== 'object') return value;
    if (Array.isArray(value)) return value.map(rewriteOriginalAttachments);
    return Object.fromEntries(Object.entries(value).map(([key, child]) => {
      if (key === 'attachments' && Array.isArray(child)) {
        return [key, child.map((attachment) => {
          if (typeof attachment === 'string') return mapAttachmentReference(attachment);
          if (!attachment || typeof attachment !== 'object') return attachment;
          const reference = attachment.path || attachment.sourcePath || attachment.name;
          const archivePath = mapAttachmentReference(reference);
          return {
            ...attachment,
            ...(typeof attachment.path === 'string' || typeof attachment.sourcePath === 'string'
              ? { path: archivePath, sourcePath: typeof attachment.sourcePath === 'string' ? archivePath : undefined }
              : {}),
            previewUrl: undefined,
          };
        })];
      }
      return [key, rewriteOriginalAttachments(child)];
    }));
  };

  const addMissingAttachment = (key, name, error) => {
    if (attachmentMap.has(key)) return;
    const archivePath = `missing/${String(attachmentEntries.length + missingAttachments.length + 1).padStart(4, '0')}-${getArchiveFileName(0, name).slice('attachments/0000-'.length)}`;
    attachmentMap.set(key, { archivePath, error });
    missingAttachments.push({ archivePath, name, error });
  };

  for (const record of payload.records) {
    if (!record || typeof record !== 'object' || !Array.isArray(record.attachments)) continue;
    const references = [...record.attachments];
    collectOriginalAttachments(record.original, references);
    for (const reference of references) {
      const source = getSource(reference);
      if (source.error) {
        addMissingAttachment(source.key, source.name, source.error);
        continue;
      }
      if (attachmentMap.has(source.key)) continue;

      if (source.filePath) {
        try {
          const stats = await fs.promises.stat(source.filePath);
          if (!stats.isFile()) {
            addMissingAttachment(source.key, source.name, 'Attachment is not a file.');
            continue;
          }
          const entry = {
            archivePath: getArchiveFileName(attachmentEntries.length + 1, source.name),
            name: source.name,
            size: stats.size,
            filePath: source.filePath,
          };
          attachmentEntries.push(entry);
          attachmentMap.set(source.key, entry);
        } catch (error) {
          const reason = error && error.code === 'ENOENT'
            ? 'Attachment file was not found.'
            : 'Attachment file could not be read.';
          addMissingAttachment(source.key, source.name, reason);
        }
      } else {
        const entry = {
          archivePath: getArchiveFileName(attachmentEntries.length + 1, source.name),
          name: source.name,
          size: source.bytes.length,
          bytes: source.bytes,
        };
        attachmentEntries.push(entry);
        attachmentMap.set(source.key, entry);
      }
    }
  }

  const records = payload.records.map((record) => {
    if (!record || typeof record !== 'object' || !Array.isArray(record.attachments)) return record;
    return {
      ...record,
      attachments: record.attachments.map(mapAttachmentReference),
      original: rewriteOriginalAttachments(record.original),
    };
  });
  const manifest = {
    formatVersion: 1,
    exportedAt: new Date().toISOString(),
    filters: payload.filters,
    records,
    attachments: attachmentEntries.map(({ archivePath, name, size }) => ({
      archivePath,
      name,
      size,
    })),
    missingAttachments,
  };
  const manifestJson = JSON.stringify(manifest, null, 2);
  const { ZipArchive } = await import('archiver');

  return new Promise((resolve, reject) => {
    const temporaryPath = `${filePath}.${randomUUID()}.tmp`;
    const output = fs.createWriteStream(temporaryPath, { flags: 'wx' });
    const archive = new ZipArchive({ zlib: { level: 6 } });
    let settled = false;
    const fail = (error) => {
      if (settled) return;
      settled = true;
      output.destroy();
      const cleanup = () => {
        void fs.promises.rm(temporaryPath, { force: true }).then(
          () => reject(error),
          (cleanupError) => reject(new AggregateError(
            [error, cleanupError],
            'Posts backup failed and its temporary file could not be removed.',
          )),
        );
      };
      if (output.closed) cleanup();
      else output.once('close', cleanup);
    };
    output.once('close', async () => {
      if (settled) return;
      try {
        await fs.promises.rename(temporaryPath, filePath);
        settled = true;
        resolve({ success: true, missingAttachments: missingAttachments.length });
      } catch (error) {
        fail(error);
      }
    });
    output.once('error', fail);
    archive.once('error', fail);
    archive.once('warning', fail);
    archive.pipe(output);
    archive.append(manifestJson, { name: 'posts-backup.json' });
    for (const entry of attachmentEntries) {
      if (entry.filePath) archive.file(entry.filePath, { name: entry.archivePath });
      else archive.append(entry.bytes, { name: entry.archivePath });
    }
    try {
      archive.finalize();
    } catch (error) {
      fail(error);
    }
  });
}

module.exports = { createHistoryBackup };
