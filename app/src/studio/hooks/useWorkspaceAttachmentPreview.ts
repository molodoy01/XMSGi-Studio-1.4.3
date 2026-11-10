import { useCallback, useEffect, useRef, useState } from 'react';

export type AttachmentPreview = {
  src: string;
  name: string;
  left: number;
  top: number;
  width: number;
  height: number;
};

export function useWorkspaceAttachmentPreview() {
  const [attachmentPreview, setAttachmentPreview] = useState<AttachmentPreview | null>(null);
  const timerRef = useRef<number | null>(null);

  const showAttachmentPreview = useCallback((image: HTMLImageElement, name: string, src: string) => {
    const bounds = image.getBoundingClientRect();
    const width = Math.min(320, window.innerWidth - 24);
    const height = Math.min(260, window.innerHeight - 24);
    const rightPosition = bounds.right + 12;
    const left = rightPosition + width <= window.innerWidth - 12
      ? rightPosition
      : Math.max(12, bounds.left - width - 12);
    const top = Math.max(12, Math.min(
      bounds.top + bounds.height / 2 - height / 2,
      window.innerHeight - height - 12,
    ));

    setAttachmentPreview({ src, name, left, top, width, height });
  }, []);

  const scheduleAttachmentPreview = useCallback((image: HTMLImageElement, name: string, src: string) => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
    }
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null;
      showAttachmentPreview(image, name, src);
    }, 1000);
  }, [showAttachmentPreview]);

  const hideAttachmentPreview = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setAttachmentPreview(null);
  }, []);

  useEffect(() => () => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
    }
  }, []);

  return {
    attachmentPreview,
    showAttachmentPreview,
    scheduleAttachmentPreview,
    hideAttachmentPreview,
  };
}
