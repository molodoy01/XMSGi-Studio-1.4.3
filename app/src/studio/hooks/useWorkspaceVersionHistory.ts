import { useState, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import type { PersistedWorkspaceDocumentHistories, PersistedWorkspaceDocumentVersion } from '@shared/types';
import type { ConfirmAction } from '@/components/useConfirm';
import type { WorkspaceDraft } from '../lib/draftStore';
import { normalizeAttachments } from '../lib/draftAttachments';
import { normalizeRichTextEntities, richTextToHtml } from '../lib/richText';
import { areWorkspaceSnapshotsEqual, hasWorkspaceDocumentContent } from '../lib/documentHistory';
import { uid } from '@shared/utils';
import type { WorkspacePageProps } from '../pages/workspacePageTypes';
import type { PublishAction } from '../components/WorkspacePageActionRows';
import type { RichTextEntity, SavedDraft, ScheduledMessage } from '../types';
import type { ScheduleRepeatOptions } from '../lib/scheduling';
import { useLocale } from '@studio/lib/i18n';

type VersionHistoryOptions = {
  documentHistories: PersistedWorkspaceDocumentHistories;
  workspaceDocumentId: string;
  setWorkspaceDocumentId: (documentId: string) => void;
  createWorkspaceDraftSnapshot: () => WorkspaceDraft | null;
  prepareWorkspaceVersionSnapshot: (snapshot: WorkspaceDraft) => Promise<{ snapshot: WorkspaceDraft | null; error: string }>;
  recordWorkspaceVersion: (
    snapshot: WorkspaceDraft | null,
    reason: 'restore',
  ) => Promise<{ success: boolean; error?: string }>;
  persistDraftStore: (
    savedDrafts: SavedDraft[] | (() => SavedDraft[]),
    workspaceDraft: WorkspaceDraft | null,
  ) => Promise<boolean>;
  savedDraftsRef: MutableRefObject<SavedDraft[]>;
  draftStoreError: string;
  confirm: ConfirmAction;
  bodyInputRef: MutableRefObject<HTMLDivElement | null>;
  focusPlannerEditorAtEndRef: MutableRefObject<boolean>;
  replaceAttachments: (attachments: WorkspaceDraft['attachments']) => void;
  setDraftBody: Dispatch<SetStateAction<string>>;
  setDraftEntities: Dispatch<SetStateAction<RichTextEntity[]>>;
  setSelectedChat: WorkspacePageProps['setSelectedChat'];
  setDate: WorkspacePageProps['setDate'];
  setTime: WorkspacePageProps['setTime'];
  setFollowCurrentTime: Dispatch<SetStateAction<boolean>>;
  setRepeatMode: Dispatch<SetStateAction<ScheduleRepeatOptions['mode']>>;
  setRepeatDays: Dispatch<SetStateAction<string[]>>;
  setRepeatOccurrences: Dispatch<SetStateAction<number>>;
  setRescheduleSource: Dispatch<SetStateAction<ScheduledMessage | null>>;
  rescheduleSourceRef: MutableRefObject<ScheduledMessage | null>;
  setScheduleSelectionConfirmed: Dispatch<SetStateAction<boolean>>;
  setPublishAction: Dispatch<SetStateAction<PublishAction>>;
  setStageMode: Dispatch<SetStateAction<'editor' | 'schedule' | 'template' | 'draft' | 'chat'>>;
  showFeedback: (message: string, kind?: 'warning' | 'success') => void;
};

export function useWorkspaceVersionHistory(options: VersionHistoryOptions) {
  const { locale, t } = useLocale();
  const [versionHistoryOpen, setVersionHistoryOpen] = useState(false);
  const [selectedHistoryDocumentId, setSelectedHistoryDocumentId] = useState<string | null>(null);
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);
  const [isRestoringVersion, setIsRestoringVersion] = useState(false);
  const [versionRestoreError, setVersionRestoreError] = useState('');

  const openVersionHistory = () => {
    const documentIds = Object.entries(options.documentHistories)
      .filter(([, versions]) => versions.length > 0)
      .sort((left, right) => (
        Date.parse(right[1][right[1].length - 1].createdAt)
        - Date.parse(left[1][left[1].length - 1].createdAt)
      ));
    const selectedDocumentId = options.documentHistories[options.workspaceDocumentId]?.length
      ? options.workspaceDocumentId
      : documentIds[0]?.[0] ?? options.workspaceDocumentId;
    const versions = options.documentHistories[selectedDocumentId] ?? [];
    setSelectedHistoryDocumentId(selectedDocumentId);
    setSelectedVersionId((current) => (
      current && versions.some((version) => version.id === current)
        ? current
        : versions[versions.length - 1]?.id ?? null
    ));
    setVersionRestoreError('');
    setVersionHistoryOpen(true);
  };

  const restoreWorkspaceVersion = async (version: PersistedWorkspaceDocumentVersion, openCopy = false) => {
    if (isRestoringVersion) return;
    const timestamp = new Date(version.createdAt).toLocaleString(locale === 'ru' ? 'ru-RU' : 'en-US');
    const confirmationKey = openCopy ? 'studio.openVersionCopyConfirm' : 'studio.restoreVersionConfirm';
    if (!await options.confirm({
      message: t(confirmationKey, { time: timestamp }),
      confirmLabel: openCopy ? t('studio.openVersionCopy') : t('common.apply'),
      cancelLabel: t('common.cancel'),
    })) return;

    setIsRestoringVersion(true);
    setVersionRestoreError('');
    try {
      const sourceSnapshot = version.snapshot as unknown as WorkspaceDraft;
      const prepared = await options.prepareWorkspaceVersionSnapshot(sourceSnapshot);
      if (!prepared.snapshot) {
        setVersionRestoreError(prepared.error || t('studio.historyRestoreFailed'));
        return;
      }

      const currentSnapshot = options.createWorkspaceDraftSnapshot();
      if (openCopy || !areWorkspaceSnapshotsEqual(currentSnapshot, prepared.snapshot)) {
        const checkpoint = await options.recordWorkspaceVersion(currentSnapshot, 'restore');
        if (!checkpoint.success) {
          setVersionRestoreError(checkpoint.error || t('studio.historyCouldNotSave'));
          return;
        }
      }

      const restoredSnapshot: WorkspaceDraft = {
        ...prepared.snapshot,
        documentId: openCopy ? uid() : version.documentId,
        entities: normalizeRichTextEntities(prepared.snapshot.entities, prepared.snapshot.body.length),
        attachments: normalizeAttachments(prepared.snapshot.attachments),
        savedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      const persisted = await options.persistDraftStore(
        () => options.savedDraftsRef.current,
        hasWorkspaceDocumentContent(restoredSnapshot) ? restoredSnapshot : null,
      );
      if (!persisted) {
        setVersionRestoreError(options.draftStoreError || t('studio.historyRestoreFailed'));
        return;
      }

      options.focusPlannerEditorAtEndRef.current = true;
      if (options.bodyInputRef.current) {
        options.bodyInputRef.current.innerHTML = richTextToHtml(restoredSnapshot.body, restoredSnapshot.entities ?? []);
      }
      options.setWorkspaceDocumentId(restoredSnapshot.documentId!);
      options.setDraftBody(restoredSnapshot.body);
      options.setDraftEntities(restoredSnapshot.entities ?? []);
      options.replaceAttachments(restoredSnapshot.attachments);
      options.setSelectedChat(restoredSnapshot.selectedChat ?? null);
      options.setDate(restoredSnapshot.date ?? '');
      options.setTime(restoredSnapshot.time ?? '');
      options.setFollowCurrentTime(!restoredSnapshot.date && !restoredSnapshot.time);
      options.setRepeatMode(restoredSnapshot.repeatMode ?? 'none');
      options.setRepeatDays(restoredSnapshot.repeatDays ?? []);
      options.setRepeatOccurrences(restoredSnapshot.repeatOccurrences ?? 1);
      options.setRescheduleSource(null);
      options.rescheduleSourceRef.current = null;
      options.setScheduleSelectionConfirmed(false);
      options.setPublishAction('send');
      options.setStageMode('editor');
      if (openCopy) options.showFeedback(t('studio.versionCopyOpened'), 'success');
      setVersionHistoryOpen(false);
    } catch (error) {
      setVersionRestoreError(error instanceof Error ? error.message : t('studio.historyRestoreFailed'));
    } finally {
      setIsRestoringVersion(false);
    }
  };

  const selectHistoryDocument = (documentId: string) => {
    const versions = options.documentHistories[documentId] ?? [];
    setSelectedHistoryDocumentId(documentId);
    setSelectedVersionId(versions[versions.length - 1]?.id ?? null);
    setVersionRestoreError('');
  };

  const selectHistoryVersion = (versionId: string) => {
    setSelectedVersionId(versionId);
    setVersionRestoreError('');
  };

  return {
    versionHistoryOpen,
    setVersionHistoryOpen,
    selectedHistoryDocumentId,
    selectedVersionId,
    isRestoringVersion,
    versionRestoreError,
    setVersionRestoreError,
    openVersionHistory,
    restoreWorkspaceVersion,
    selectHistoryDocument,
    selectHistoryVersion,
  };
}
