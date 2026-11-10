import { useEffect, useRef, type Dispatch, type SetStateAction } from 'react';
import { useLocale } from '@studio/lib/i18n';
import { getLocalAttachmentPath } from '@/lib/localAttachmentPath';
import { getDraftStorageApi } from '../lib/draftStore';
import { isImageAttachment, type WorkspaceAttachment } from '../lib/workspaceAttachments';

type WorkspaceAttachmentPreviewsOptions = {
  attachments: WorkspaceAttachment[];
  setAttachments: Dispatch<SetStateAction<WorkspaceAttachment[]>>;
  showFeedback: (message: string, kind?: 'warning' | 'success') => void;
};

export function useWorkspaceAttachmentPreviews({
  attachments,
  setAttachments,
  showFeedback,
}: WorkspaceAttachmentPreviewsOptions) {
  const { t } = useLocale();
  const attemptsRef = useRef(new Set<string>());

  useEffect(() => {
    const attempts = attemptsRef.current;
    const readImageDataUrl = getDraftStorageApi()?.readImageDataUrl;
    if (!readImageDataUrl) return;

    let cancelled = false;
    const missingPreviews = attachments.filter((attachment) => (
      isImageAttachment(attachment)
      && (!attachment.previewUrl || /^file:/i.test(attachment.previewUrl))
      && !attachment.unavailable
      && (attachment.path || attachment.previewUrl)
      && !/^(?:blob:|data:|https?:)/i.test(attachment.path)
    ));
    const pending = missingPreviews.filter((attachment) => {
      const key = `${attachment.id}:${attachment.path}`;
      if (attempts.has(key)) return false;
      attempts.add(key);
      return true;
    });
    if (pending.length === 0) return;
    const pendingKeys = pending.map((attachment) => `${attachment.id}:${attachment.path}`);

    void Promise.all(pending.map(async (attachment) => {
      try {
        const result = await readImageDataUrl(getLocalAttachmentPath(attachment.path || attachment.previewUrl || ''));
        return { attachment, result };
      } catch (error) {
        return {
          attachment,
          result: {
            success: false,
            error: error instanceof Error ? error.message : 'Image preview could not be loaded.',
          },
        };
      }
    })).then((results) => {
      if (cancelled) return;
      pendingKeys.forEach((key) => attempts.delete(key));
      const loadedPreviews = new Map<string, { path: string; previewUrl?: string; dataUrl: string }>();
      results.forEach(({ attachment, result }) => {
        if (result.success && result.dataUrl) {
          loadedPreviews.set(attachment.id, {
            path: attachment.path,
            previewUrl: attachment.previewUrl,
            dataUrl: result.dataUrl,
          });
        } else {
          showFeedback(t('studio.attachmentPreviewFailed', { name: attachment.name }));
        }
      });
      if (loadedPreviews.size > 0) {
        setAttachments((current) => current.map((attachment) => {
          const loaded = loadedPreviews.get(attachment.id);
          return loaded
            && loaded.path === attachment.path
            && loaded.previewUrl === attachment.previewUrl
            && (!attachment.previewUrl || /^file:/i.test(attachment.previewUrl))
            ? { ...attachment, previewUrl: loaded.dataUrl }
            : attachment;
        }));
      }
    });

    return () => {
      cancelled = true;
      pendingKeys.forEach((key) => attempts.delete(key));
    };
  }, [attachments, setAttachments, showFeedback, t]);
}
