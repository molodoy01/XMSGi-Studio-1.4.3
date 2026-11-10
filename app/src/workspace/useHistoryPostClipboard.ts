import { useEffect, useState } from 'react';
import { getDraftStorageApi } from '@studio/lib/draftStore';
import { getImageBlob, getImagePngBlob, getLocalAttachmentPath, isImageAttachment } from './historyAttachments';
import type { HistoryItem } from './historyModel';

type CopyFeedback = 'copied' | 'failed' | null;

export function useHistoryPostClipboard({
  isOpen,
  record,
  imagePreviewSources,
}: {
  isOpen: boolean;
  record: HistoryItem | null;
  imagePreviewSources: Record<string, string>;
}) {
  const [copyFeedback, setCopyFeedback] = useState<CopyFeedback>(null);

  useEffect(() => {
    setCopyFeedback(null);
  }, [isOpen, record?.id]);

  useEffect(() => {
    if (!copyFeedback) return;
    const timeout = window.setTimeout(() => setCopyFeedback(null), 1600);
    return () => window.clearTimeout(timeout);
  }, [copyFeedback]);

  const copySelectedPost = async () => {
    if (!record) return;
    try {
      const imageAttachments = record.attachments.filter(isImageAttachment);
      if (imageAttachments.length === 1) {
        try {
          const attachment = imageAttachments[0];
          let dataUrl = imagePreviewSources[attachment];
          let sourceBlob: Blob | null = null;
          if (!dataUrl && /^data:image\//i.test(attachment)) dataUrl = attachment;
          if (!dataUrl && /^(?:https?:)/i.test(attachment)) {
            const response = await fetch(attachment);
            if (!response.ok) throw new Error(`Unable to load image attachment (${response.status}).`);
            sourceBlob = await response.blob();
            if (!sourceBlob.type.startsWith('image/')) throw new Error('The attachment is not an image.');
          }
          if (!dataUrl && !sourceBlob) {
            const readImageDataUrl = getDraftStorageApi()?.readImageDataUrl;
            if (!readImageDataUrl) throw new Error('Image clipboard access is unavailable.');
            const result = await readImageDataUrl(getLocalAttachmentPath(attachment));
            if (!result.success || !result.dataUrl) {
              throw new Error(result.error || 'Unable to read image attachment.');
            }
            dataUrl = result.dataUrl;
          }
          if (typeof ClipboardItem === 'undefined' || !navigator.clipboard.write) {
            throw new Error('Image clipboard writing is unavailable.');
          }

          const imageBlob = await getImagePngBlob(sourceBlob ?? getImageBlob(dataUrl));
          await navigator.clipboard.write([new ClipboardItem({
            'image/png': imageBlob,
            'text/plain': new Blob([record.text], { type: 'text/plain' }),
          })]);
        } catch (error) {
          console.error('Failed to copy post image from Posts; falling back to text.', error);
          await navigator.clipboard.writeText(record.text);
        }
      } else {
        await navigator.clipboard.writeText(record.text);
      }
      setCopyFeedback('copied');
    } catch (error) {
      console.error('Failed to copy post from Posts.', error);
      setCopyFeedback('failed');
    }
  };

  return { copyFeedback, copySelectedPost };
}
