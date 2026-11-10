import { useCallback } from 'react';
import type { DraftAttachment } from '@studio/domain/types';
import {
  appendWorkspaceDocumentVersion,
  hasWorkspaceDocumentContent,
} from '@studio/lib/documentHistory';
import { getDraftStorageApi } from '@studio/lib/draftStore';
import type { WorkspaceDraft } from '@studio/lib/draftStore';
import { useLocale } from '@studio/lib/i18n';
import type { PersistedWorkspaceDocumentVersion } from '@shared/types';
import type { SavedDraftCollection } from './useSavedDraftCollection';

type StudioDraftHistoryOptions = {
  drafts: SavedDraftCollection;
  createWorkspaceDraftSnapshot: () => WorkspaceDraft | null;
};

export function useStudioDraftHistory({ drafts, createWorkspaceDraftSnapshot }: StudioDraftHistoryOptions) {
  const { t } = useLocale();

  const makeHistorySnapshot = useCallback(async (snapshot: WorkspaceDraft, strict: boolean) => {
    if (!snapshot.attachments.length) return { snapshot, error: '' };
    const storage = getDraftStorageApi();
    const attachments: DraftAttachment[] = [];
    let error = '';

    for (const attachment of snapshot.attachments) {
      if (!attachment.path || attachment.unavailable) {
        error ||= t('studio.historyAttachmentUnavailable', { name: attachment.name });
        if (strict) return { snapshot: null, error };
        attachments.push({ ...attachment, path: '', sourcePath: attachment.sourcePath || undefined, unavailable: true });
        continue;
      }

      if (attachment.path.startsWith('data:')) {
        error ||= t('studio.historyAttachmentCopyFailed', { name: attachment.name });
        if (strict) return { snapshot: null, error };
        attachments.push({ ...attachment, path: '', sourcePath: undefined, previewUrl: undefined, unavailable: true });
        continue;
      }

      if (!storage?.copyAttachmentPath) {
        error ||= t('studio.historyAttachmentUnavailable', { name: attachment.name });
        if (strict) return { snapshot: null, error };
        attachments.push({ ...attachment, path: '', sourcePath: attachment.sourcePath || attachment.path, unavailable: true });
        continue;
      }

      try {
        const result = await storage.copyAttachmentPath(attachment.path);
        if (!result.success || !result.attachment) {
          error ||= t('studio.historyAttachmentCopyFailed', { name: attachment.name });
          if (strict) return { snapshot: null, error };
          attachments.push({ ...attachment, path: '', sourcePath: attachment.sourcePath || attachment.path, unavailable: true });
          continue;
        }
        attachments.push({
          ...attachment,
          name: attachment.name || result.attachment.name,
          path: result.attachment.path,
          sourcePath: attachment.sourcePath ?? attachment.path,
          size: result.attachment.size,
          unavailable: undefined,
        });
      } catch {
        error ||= t('studio.historyAttachmentCopyFailed', { name: attachment.name });
        if (strict) return { snapshot: null, error };
        attachments.push({ ...attachment, path: '', sourcePath: attachment.sourcePath || attachment.path, unavailable: true });
      }
    }

    return { snapshot: { ...snapshot, attachments }, error };
  }, [t]);

  const prepareWorkspaceVersionSnapshot = (snapshot: WorkspaceDraft) => makeHistorySnapshot(snapshot, true);

  const recordWorkspaceVersion = async (
    snapshot: WorkspaceDraft | null,
    reason: PersistedWorkspaceDocumentVersion['reason'],
    requireAvailableAttachments = true,
    savedDraftsToPersist?: Parameters<SavedDraftCollection['replaceSavedDrafts']>[0],
  ) => {
    if (!hasWorkspaceDocumentContent(snapshot)) {
      if (!savedDraftsToPersist) return { success: true, snapshot, error: '' };

      const persisted = await drafts.persistDraftStore(
        savedDraftsToPersist,
        createWorkspaceDraftSnapshot(),
        () => drafts.replaceSavedDrafts(savedDraftsToPersist),
      );
      if (!persisted) return { success: false, snapshot: null, error: drafts.draftStoreError };
      return { success: true, snapshot, error: '' };
    }
    const archived = await makeHistorySnapshot(snapshot, requireAvailableAttachments);
    if (!archived.snapshot) {
      drafts.setDraftStoreError(archived.error);
      return { success: false, snapshot: null, error: archived.error };
    }

    const documentId = archived.snapshot.documentId;
    if (!documentId) {
      const error = t('studio.historyCouldNotSave');
      drafts.setDraftStoreError(error);
      return { success: false, snapshot: null, error };
    }

    let persistedHistories = drafts.documentHistoriesRef.current;
    const workspaceDraft = createWorkspaceDraftSnapshot();
    const persisted = await drafts.persistDraftStore(
      savedDraftsToPersist ?? (() => drafts.savedDraftsRef.current),
      workspaceDraft,
      (histories) => {
        persistedHistories = histories;
        drafts.replaceDocumentHistories(histories);
        if (savedDraftsToPersist) drafts.replaceSavedDrafts(savedDraftsToPersist);
      },
      () => appendWorkspaceDocumentVersion(
        drafts.documentHistoriesRef.current,
        documentId,
        archived.snapshot!,
        reason,
      ),
    );
    if (!persisted) return { success: false, snapshot: null, error: drafts.draftStoreError };
    return { success: true, snapshot: archived.snapshot, error: '', documentHistories: persistedHistories };
  };

  return { makeHistorySnapshot, prepareWorkspaceVersionSnapshot, recordWorkspaceVersion };
}
