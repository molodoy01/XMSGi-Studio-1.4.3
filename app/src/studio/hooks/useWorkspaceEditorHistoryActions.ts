import type { MutableRefObject } from 'react';
import type { WorkspaceDraft } from '../lib/draftStore';
import type { WorkspaceAttachment } from '../lib/workspaceAttachments';

type PendingDraftReplacement = {
  previousSnapshot: WorkspaceDraft;
};

type WorkspaceEditorHistoryActionsOptions = {
  attachments: WorkspaceAttachment[];
  replaceAttachments: (attachments: WorkspaceAttachment[]) => void;
  attachmentPreviewUrlsRef: MutableRefObject<Set<string>>;
  createWorkspaceDraftSnapshot: () => WorkspaceDraft | null;
  recordWorkspaceVersion: (
    snapshot: WorkspaceDraft | null,
    reason: 'before-clear' | 'before-attachment-removal',
  ) => Promise<{ success: boolean }>;
  pendingDraftReplacementRef: MutableRefObject<PendingDraftReplacement | null>;
  restorePreviousDraftAfterReplacement: () => Promise<boolean>;
  plannerRestoreRef: MutableRefObject<{ draft: import('../types').SavedDraft | null } | null>;
  restorePlannerDocumentRef: MutableRefObject<() => Promise<boolean>>;
  showFeedback: (message: string, kind?: 'warning' | 'success') => void;
  historyCouldNotSaveMessage: string;
};

export function useWorkspaceEditorHistoryActions({
  attachments,
  replaceAttachments,
  attachmentPreviewUrlsRef,
  createWorkspaceDraftSnapshot,
  recordWorkspaceVersion,
  pendingDraftReplacementRef,
  restorePreviousDraftAfterReplacement,
  plannerRestoreRef,
  restorePlannerDocumentRef,
  showFeedback,
  historyCouldNotSaveMessage,
}: WorkspaceEditorHistoryActionsOptions) {
  const handleBeforeClearEditorText = () => {
    if (pendingDraftReplacementRef.current) {
      void restorePreviousDraftAfterReplacement().catch(() => {
        showFeedback(historyCouldNotSaveMessage, 'warning');
      });
      return false;
    }
    if (plannerRestoreRef.current?.draft) {
      void restorePlannerDocumentRef.current().then((restored) => {
        if (!restored) showFeedback(historyCouldNotSaveMessage, 'warning');
      }).catch(() => {
        showFeedback(historyCouldNotSaveMessage, 'warning');
      });
      return false;
    }
    return recordWorkspaceVersion(createWorkspaceDraftSnapshot(), 'before-clear')
      .then((checkpoint) => {
        if (!checkpoint.success) showFeedback(historyCouldNotSaveMessage, 'warning');
        return checkpoint.success;
      })
      .catch(() => {
        showFeedback(historyCouldNotSaveMessage, 'warning');
        return false;
      });
  };

  const removeAttachmentPreview = (attachment: WorkspaceAttachment) => {
    const previewUrl = attachment.previewUrl;
    if (previewUrl && attachmentPreviewUrlsRef.current.delete(previewUrl)) {
      URL.revokeObjectURL(previewUrl);
    }
  };

  const handleRemoveAttachment = async (attachmentId: string) => {
    const removedAttachment = attachments.find((attachment) => attachment.id === attachmentId);
    if (!removedAttachment) return;
    const snapshot = createWorkspaceDraftSnapshot();
    const checkpointPromise = recordWorkspaceVersion(snapshot, 'before-attachment-removal');

    removeAttachmentPreview(removedAttachment);
    replaceAttachments(attachments.filter((attachment) => attachment.id !== attachmentId));

    const checkpoint = await checkpointPromise;
    if (!checkpoint.success) showFeedback(historyCouldNotSaveMessage, 'warning');
  };

  const handleRemoveAlbum = async (albumId: string) => {
    const removedAttachments = attachments.filter((attachment) => attachment.albumId === albumId);
    if (removedAttachments.length === 0) return;
    const snapshot = createWorkspaceDraftSnapshot();
    const checkpointPromise = recordWorkspaceVersion(snapshot, 'before-attachment-removal');

    removedAttachments.forEach(removeAttachmentPreview);
    replaceAttachments(attachments.filter((attachment) => attachment.albumId !== albumId));

    const checkpoint = await checkpointPromise;
    if (!checkpoint.success) showFeedback(historyCouldNotSaveMessage, 'warning');
  };

  return { handleBeforeClearEditorText, handleRemoveAttachment, handleRemoveAlbum };
}
