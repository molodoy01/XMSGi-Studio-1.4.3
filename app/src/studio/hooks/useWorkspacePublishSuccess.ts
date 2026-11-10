import { useEffect, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import type { RichTextEntity, SavedDraft } from '../types';
import type { WorkspaceDraft } from '../lib/draftStore';
import type { WorkspaceAttachment } from '../lib/workspaceAttachments';

type WorkspacePublishSuccessOptions = {
  successPulse: boolean;
  suppressDraftReplacementSuccessClearRef: MutableRefObject<boolean>;
  pendingDraftReplacementRef: MutableRefObject<{ previousSnapshot: WorkspaceDraft } | null>;
  completeDraftReplacementRef: MutableRefObject<(showRestoreFeedback?: boolean) => Promise<boolean>>;
  createWorkspaceDraftSnapshotRef: MutableRefObject<() => WorkspaceDraft | null>;
  attachmentSelectionGenerationRef: MutableRefObject<number>;
  recordWorkspaceVersionRef: MutableRefObject<(
    snapshot: WorkspaceDraft | null,
    reason: 'publish',
  ) => Promise<{ success: boolean }>>;
  plannerRestoreRef: MutableRefObject<{ draft: SavedDraft | null } | null>;
  attachmentPreviewUrlsRef: MutableRefObject<Set<string>>;
  restorePlannerDocumentRef: MutableRefObject<() => Promise<boolean>>;
  bodyInputRef: MutableRefObject<HTMLDivElement | null>;
  setDraftBody: Dispatch<SetStateAction<string>>;
  setDraftEntities: Dispatch<SetStateAction<RichTextEntity[]>>;
  replaceAttachments: (attachments: WorkspaceAttachment[]) => void;
  setWorkspaceDocumentId: (documentId: string) => void;
  newDocumentId: () => string;
  showFeedback: (message: string, kind?: 'warning' | 'success') => void;
  historyCouldNotSaveMessage: string;
};

export function useWorkspacePublishSuccess({
  successPulse,
  suppressDraftReplacementSuccessClearRef,
  pendingDraftReplacementRef,
  completeDraftReplacementRef,
  createWorkspaceDraftSnapshotRef,
  attachmentSelectionGenerationRef,
  recordWorkspaceVersionRef,
  plannerRestoreRef,
  attachmentPreviewUrlsRef,
  restorePlannerDocumentRef,
  bodyInputRef,
  setDraftBody,
  setDraftEntities,
  replaceAttachments,
  setWorkspaceDocumentId,
  newDocumentId,
  showFeedback,
  historyCouldNotSaveMessage,
}: WorkspacePublishSuccessOptions) {
  useEffect(() => {
    if (!successPulse || suppressDraftReplacementSuccessClearRef.current) return;
    if (pendingDraftReplacementRef.current) {
      void completeDraftReplacementRef.current();
      return;
    }
    const currentSnapshot = createWorkspaceDraftSnapshotRef.current();
    attachmentSelectionGenerationRef.current += 1;
    void (async () => {
      const checkpoint = await recordWorkspaceVersionRef.current(currentSnapshot, 'publish');
      if (!checkpoint.success && !plannerRestoreRef.current) {
        showFeedback(historyCouldNotSaveMessage, 'warning');
        return;
      }

      attachmentPreviewUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
      attachmentPreviewUrlsRef.current.clear();
      if (plannerRestoreRef.current?.draft) {
        void restorePlannerDocumentRef.current();
        return;
      }
      plannerRestoreRef.current = null;
      if (bodyInputRef.current) {
        bodyInputRef.current.innerHTML = '';
        bodyInputRef.current.dataset.selectionStart = '0';
        bodyInputRef.current.dataset.selectionEnd = '0';
      }
      setDraftBody('');
      setDraftEntities([]);
      replaceAttachments([]);
      setWorkspaceDocumentId(newDocumentId());
    })();
  }, [
    successPulse,
    suppressDraftReplacementSuccessClearRef,
    pendingDraftReplacementRef,
    completeDraftReplacementRef,
    createWorkspaceDraftSnapshotRef,
    attachmentSelectionGenerationRef,
    recordWorkspaceVersionRef,
    plannerRestoreRef,
    attachmentPreviewUrlsRef,
    restorePlannerDocumentRef,
    bodyInputRef,
    setDraftBody,
    setDraftEntities,
    replaceAttachments,
    setWorkspaceDocumentId,
    newDocumentId,
    showFeedback,
    historyCouldNotSaveMessage,
  ]);
}
