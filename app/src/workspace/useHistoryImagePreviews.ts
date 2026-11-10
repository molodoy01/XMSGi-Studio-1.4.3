import { useCallback, useEffect, useRef, useState } from 'react';
import { getDraftStorageApi } from '@studio/lib/draftStore';
import { getLocalAttachmentPath, isImageAttachment } from './historyAttachments';
import type { HistoryItem } from './historyModel';

export function useHistoryImagePreviews({
  isOpen,
  records,
  draftItems,
}: {
  isOpen: boolean;
  records: HistoryItem[];
  draftItems: HistoryItem[];
}) {
  const [previewImagePath, setPreviewImagePath] = useState<string | null>(null);
  const [previewImagePosition, setPreviewImagePosition] = useState<{ left: number; top: number } | null>(null);
  const [imagePreviewSources, setImagePreviewSources] = useState<Record<string, string>>({});
  const imagePreviewAttemptsRef = useRef(new Set<string>());
  const imageHoverTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const readImageDataUrl = getDraftStorageApi()?.readImageDataUrl;
    if (!isOpen || !readImageDataUrl) return;

    const imagePaths = [...records, ...draftItems]
      .flatMap((record) => record.attachments)
      .filter(isImageAttachment)
      .filter((attachment) => !/^(?:blob:|data:|https?:)/i.test(attachment))
      .filter((attachment) => !imagePreviewSources[attachment])
      .filter((attachment) => !imagePreviewAttemptsRef.current.has(attachment));
    imagePaths.forEach((attachment) => imagePreviewAttemptsRef.current.add(attachment));
    if (imagePaths.length === 0) return;

    void Promise.all(imagePaths.map(async (attachment) => {
      try {
        const result = await readImageDataUrl(getLocalAttachmentPath(attachment));
        return result.success && result.dataUrl ? { attachment, dataUrl: result.dataUrl } : null;
      } catch {
        return null;
      }
    })).then((results) => {
      const resolved = Object.fromEntries(
        results.flatMap((result) => result ? [[result.attachment, result.dataUrl]] : []),
      );
      if (Object.keys(resolved).length > 0) {
        setImagePreviewSources((current) => ({ ...current, ...resolved }));
      }
    });
  }, [draftItems, imagePreviewSources, isOpen, records]);

  const getDisplayedAttachmentUrl = (filePath: string) => (
    imagePreviewSources[filePath]
    ?? (/^(?:blob:|data:|https?:)/i.test(filePath) ? filePath : undefined)
  );

  const openImagePreview = useCallback((target: HTMLElement, filePath: string) => {
    const bounds = target.getBoundingClientRect();
    setPreviewImagePosition({ left: bounds.left + bounds.width / 2, top: bounds.top - 12 });
    if (imageHoverTimerRef.current !== null) window.clearTimeout(imageHoverTimerRef.current);
    imageHoverTimerRef.current = window.setTimeout(() => {
      setPreviewImagePath(filePath);
      imageHoverTimerRef.current = null;
    }, 600);
  }, []);

  const closeImagePreview = useCallback(() => {
    if (imageHoverTimerRef.current !== null) {
      window.clearTimeout(imageHoverTimerRef.current);
      imageHoverTimerRef.current = null;
    }
    setPreviewImagePath(null);
    setPreviewImagePosition(null);
  }, []);

  useEffect(() => {
    if (!isOpen) closeImagePreview();
    return () => {
      if (imageHoverTimerRef.current !== null) {
        window.clearTimeout(imageHoverTimerRef.current);
        imageHoverTimerRef.current = null;
      }
    };
  }, [closeImagePreview, isOpen]);

  return {
    imagePreviewSources,
    previewImagePath,
    previewImagePosition,
    closeImagePreview,
    getDisplayedAttachmentUrl,
    openImagePreview,
  };
}
