import { useEffect, useRef, useState } from 'react';
import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import type { Chat, PersistedDraftStore, ScheduledMessage } from '@studio/types';
import type { DraftAttachment } from '@studio/domain/types';
import { normalizeAttachments } from '@studio/lib/draftAttachments';
import { DRAFT_STORE_SCHEMA_VERSION } from '@studio/lib/draftStoreVersion';
import {
  getDraftStorageApi,
  hasDraftContent,
  readWorkspaceDraftStoreFallback,
  writeWorkspaceDraftStoreFallback,
} from '@studio/lib/draftStore';
import type { WorkspaceDraft } from '@studio/lib/draftStore';
import { useLocale } from '@studio/lib/i18n';
import type { ScheduleRepeatOptions } from '@studio/lib/scheduling';
import {
  appendWorkspaceDocumentVersion,
  areWorkspaceSnapshotsEqual,
  hasWorkspaceDocumentContent,
} from '@studio/lib/documentHistory';
import { normalizeWorkspaceDocumentHistories } from '@studio/lib/documentHistory';
import { useSavedDraftCollection } from './useSavedDraftCollection';
import { useInitializeStudioDraftStore } from './useInitializeStudioDraftStore';
import { useStudioDraftHistory } from './useStudioDraftHistory';

type WorkspaceDraftState = {
  documentId: string;
  body: string;
  entities: WorkspaceDraft['entities'];
  attachments: DraftAttachment[];
  selectedChat: Chat | null;
  date: string;
  time: string;
  repeatMode: ScheduleRepeatOptions['mode'];
  repeatDays: string[];
  repeatOccurrences: number;
};

export type WorkspaceDraftLifecycleOptions = {
  initialWorkspaceDraftRef: MutableRefObject<Partial<WorkspaceDraft> | null>;
  initialWorkspaceDraftError?: string;
  workspace: WorkspaceDraftState;
  chats: Chat[];
  setSelectedChat: Dispatch<SetStateAction<Chat | null>>;
  preserveSelectedChat?: boolean;
  setDate: Dispatch<SetStateAction<string>>;
  setTime: Dispatch<SetStateAction<string>>;
  rescheduleSourceRef: MutableRefObject<ScheduledMessage | null>;
  onWorkspaceDraftLoaded: (draft: Partial<WorkspaceDraft> | null) => void;
};

export function useStudioDrafts(options: WorkspaceDraftLifecycleOptions) {
  const drafts = useSavedDraftCollection();
  const draftsRef = useRef(drafts);
  const { t } = useLocale();
  const optionsRef = useRef(options);
  const translateRef = useRef(t);
  const autosaveTimeoutRef = useRef<number | null>(null);
  const lastPersistedWorkspaceSnapshotRef = useRef<WorkspaceDraft | null>(null);
  const editHistoryCheckpointedDocumentsRef = useRef(new Set<string>());
  const activeEditDocumentIdRef = useRef('');
  const [savedAt, setSavedAt] = useState(options.initialWorkspaceDraftRef.current?.savedAt ?? '');
  const [draftStateHydrated, setDraftStateHydrated] = useState(false);
  optionsRef.current = options;
  draftsRef.current = drafts;
  translateRef.current = t;

  const createWorkspaceDraftSnapshot = () => {
    const workspace = optionsRef.current.workspace;
    if (!hasDraftContent(workspace.body, workspace.attachments)) return null;
    return {
      ...workspace,
      attachments: workspace.attachments
        .filter((attachment) => attachment.path)
        .map((attachment) => {
          const persistedAttachment = { ...attachment };
          delete persistedAttachment.previewUrl;
          return persistedAttachment;
        }),
      savedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    } satisfies WorkspaceDraft;
  };
  const history = useStudioDraftHistory({ drafts, createWorkspaceDraftSnapshot });
  const { makeHistorySnapshot } = history;

  const persistableWorkspaceSnapshot = (snapshot: WorkspaceDraft | null) => {
    if (!snapshot) return null;
    return {
      ...snapshot,
      attachments: snapshot.attachments.map((attachment) => ({ ...attachment })),
      entities: snapshot.entities ? [...snapshot.entities] : [],
      repeatDays: snapshot.repeatDays ? [...snapshot.repeatDays] : [],
      selectedChat: snapshot.selectedChat ? { ...snapshot.selectedChat } : null,
    } satisfies WorkspaceDraft;
  };

  const markWorkspaceDraftPersisted = (snapshot: WorkspaceDraft | null) => {
    lastPersistedWorkspaceSnapshotRef.current = persistableWorkspaceSnapshot(snapshot);
  };

  const applyPersistedDraftStore = (store: PersistedDraftStore) => {
    drafts.replaceSavedDrafts(store.savedDrafts);
    drafts.replaceDocumentHistories(normalizeWorkspaceDocumentHistories(store.documentHistories));
    const workspaceDraft = store.workspaceDraft as Partial<WorkspaceDraft> | null;
    optionsRef.current.initialWorkspaceDraftRef.current = workspaceDraft ?? {};
    setSavedAt(workspaceDraft?.savedAt ?? '');
    optionsRef.current.onWorkspaceDraftLoaded(workspaceDraft);
    const appliedWorkspace = optionsRef.current.initialWorkspaceDraftRef.current;
    lastPersistedWorkspaceSnapshotRef.current = workspaceDraft
      && typeof appliedWorkspace?.body === 'string'
      && Array.isArray(appliedWorkspace.attachments)
      && hasWorkspaceDocumentContent(appliedWorkspace as WorkspaceDraft)
      ? {
          ...appliedWorkspace,
          documentId: appliedWorkspace.documentId ?? workspaceDraft.documentId,
          body: appliedWorkspace.body,
          entities: appliedWorkspace.entities ?? [],
          attachments: normalizeAttachments(appliedWorkspace.attachments),
          selectedChat: appliedWorkspace.selectedChat ?? null,
          savedAt: workspaceDraft.savedAt ?? '',
          date: appliedWorkspace.date ?? '',
          time: appliedWorkspace.time ?? '',
          repeatMode: appliedWorkspace.repeatMode ?? 'none',
          repeatDays: appliedWorkspace.repeatDays ?? [],
          repeatOccurrences: appliedWorkspace.repeatOccurrences ?? 1,
        }
      : null;
    drafts.setDraftStoreBackups([]);
    drafts.setDraftStoreError('');
    drafts.setDraftStoreReady(true);
  };

  const cancelPendingAutosave = () => {
    if (autosaveTimeoutRef.current === null) return;
    window.clearTimeout(autosaveTimeoutRef.current);
    autosaveTimeoutRef.current = null;
  };

  const flushWorkspaceDraftNow = async () => {
    if (!drafts.draftStoreReady || !draftStateHydrated) {
      return { success: false, error: t('studio.waitForDrafts') };
    }

    cancelPendingAutosave();
    const workspaceDraft = createWorkspaceDraftSnapshot();
    if (workspaceDraft) setSavedAt(workspaceDraft.savedAt);
    const previousSnapshot = lastPersistedWorkspaceSnapshotRef.current;
    if (areWorkspaceSnapshotsEqual(previousSnapshot, workspaceDraft)) {
      return { success: true, error: '' };
    }
    const documentId = workspaceDraft?.documentId ?? '';
    if (activeEditDocumentIdRef.current !== documentId) {
      if (documentId) editHistoryCheckpointedDocumentsRef.current.delete(documentId);
      activeEditDocumentIdRef.current = documentId;
    }
    const shouldCheckpointEdit = Boolean(
      previousSnapshot
      && !areWorkspaceSnapshotsEqual(previousSnapshot, workspaceDraft)
      && previousSnapshot.documentId
      && !editHistoryCheckpointedDocumentsRef.current.has(previousSnapshot.documentId),
    );
    let nextSnapshot = previousSnapshot;
    if (shouldCheckpointEdit && previousSnapshot) {
      const archived = await makeHistorySnapshot(previousSnapshot, false);
      nextSnapshot = archived.snapshot ?? previousSnapshot;
      if (archived.error) drafts.setDraftStoreError(archived.error);
    }

    const success = await drafts.persistDraftStore(
      () => drafts.savedDraftsRef.current,
      workspaceDraft,
      (histories) => {
        if (histories !== drafts.documentHistoriesRef.current) drafts.replaceDocumentHistories(histories);
        lastPersistedWorkspaceSnapshotRef.current = workspaceDraft ? persistableWorkspaceSnapshot(workspaceDraft) : null;
        if (shouldCheckpointEdit && previousSnapshot?.documentId) {
          editHistoryCheckpointedDocumentsRef.current.add(previousSnapshot.documentId);
        }
      },
      () => shouldCheckpointEdit && previousSnapshot && nextSnapshot
        ? appendWorkspaceDocumentVersion(
            drafts.documentHistoriesRef.current,
            previousSnapshot.documentId ?? workspaceDraft?.documentId ?? '',
            nextSnapshot,
            'edit',
          )
        : drafts.documentHistoriesRef.current,
    );
    if (!success) {
      return { success: false, error: drafts.draftStoreError || t('studio.draftsCouldNotSave') };
    }

    return { success: true, error: '' };
  };

  useInitializeStudioDraftStore({ drafts, optionsRef, applyPersistedDraftStore });

  useEffect(() => {
    if (!drafts.draftStoreReady || draftStateHydrated) return;
    const currentOptions = optionsRef.current;
    const savedDraft = currentOptions.initialWorkspaceDraftRef.current;
    if (!currentOptions.preserveSelectedChat
      && !currentOptions.rescheduleSourceRef.current
      && savedDraft?.selectedChat
      && currentOptions.chats.some((chat) => chat.id === savedDraft.selectedChat?.id)) {
      currentOptions.setSelectedChat(savedDraft.selectedChat);
    }
    setDraftStateHydrated(true);
  }, [drafts.draftStoreReady, draftStateHydrated, options.chats, options.setSelectedChat]);

  useEffect(() => {
    if (!drafts.draftStoreReady || !draftStateHydrated) return undefined;
    cancelPendingAutosave();
    autosaveTimeoutRef.current = window.setTimeout(() => {
      void (async () => {
        const workspaceDraft = createWorkspaceDraftSnapshot();
        if (workspaceDraft) setSavedAt(workspaceDraft.savedAt);
        const previousSnapshot = lastPersistedWorkspaceSnapshotRef.current;
        if (areWorkspaceSnapshotsEqual(previousSnapshot, workspaceDraft)) return;
        const documentId = workspaceDraft?.documentId ?? '';
        if (activeEditDocumentIdRef.current !== documentId) {
          if (documentId) editHistoryCheckpointedDocumentsRef.current.delete(documentId);
          activeEditDocumentIdRef.current = documentId;
        }
        const shouldCheckpointEdit = Boolean(
          previousSnapshot
          && !areWorkspaceSnapshotsEqual(previousSnapshot, workspaceDraft)
          && previousSnapshot.documentId
          && !editHistoryCheckpointedDocumentsRef.current.has(previousSnapshot.documentId),
        );
        let nextSnapshot = previousSnapshot;
        let historyError = '';
        if (shouldCheckpointEdit && previousSnapshot) {
          const archived = await makeHistorySnapshot(previousSnapshot, false);
          nextSnapshot = archived.snapshot ?? previousSnapshot;
          historyError = archived.error;
        }
        if (historyError) draftsRef.current.setDraftStoreError(historyError);

        await draftsRef.current.persistDraftStore(
          () => draftsRef.current.savedDraftsRef.current,
          workspaceDraft,
          (histories) => {
            if (histories !== draftsRef.current.documentHistoriesRef.current) draftsRef.current.replaceDocumentHistories(histories);
            lastPersistedWorkspaceSnapshotRef.current = workspaceDraft ? persistableWorkspaceSnapshot(workspaceDraft) : null;
            if (shouldCheckpointEdit && previousSnapshot?.documentId) {
              editHistoryCheckpointedDocumentsRef.current.add(previousSnapshot.documentId);
            }
          },
          () => shouldCheckpointEdit && previousSnapshot && nextSnapshot
            ? appendWorkspaceDocumentVersion(
                draftsRef.current.documentHistoriesRef.current,
                previousSnapshot.documentId ?? workspaceDraft?.documentId ?? '',
                nextSnapshot,
                'edit',
              )
            : draftsRef.current.documentHistoriesRef.current,
        );
      })();
    }, 350);
    return cancelPendingAutosave;
  }, [
    draftStateHydrated,
    drafts.draftStoreReady,
    makeHistorySnapshot,
    options.workspace.attachments,
    options.workspace.body,
    options.workspace.date,
    options.workspace.entities,
    options.workspace.repeatDays,
    options.workspace.repeatMode,
    options.workspace.repeatOccurrences,
    options.workspace.selectedChat,
    options.workspace.time,
  ]);

  useEffect(() => {
    if (!drafts.draftStoreReady || !draftStateHydrated) return;
    const flushDraftOnClose = (event: BeforeUnloadEvent) => {
      const data: PersistedDraftStore = {
        schemaVersion: DRAFT_STORE_SCHEMA_VERSION,
        migrationVersion: 1,
        savedDrafts: draftsRef.current.savedDraftsRef.current,
        workspaceDraft: createWorkspaceDraftSnapshot(),
        documentHistories: draftsRef.current.documentHistoriesRef.current,
      };
      const draftStorage = getDraftStorageApi();
      if (!draftStorage) {
        let errorMessage: string;
        try {
          if (writeWorkspaceDraftStoreFallback(data)) return;
          errorMessage = translateRef.current('studio.latestDraftCouldNotSave');
        } catch (error) {
          errorMessage = error instanceof Error
            ? error.message
            : translateRef.current('studio.latestDraftCouldNotSave');
        }
        event.preventDefault();
        event.returnValue = 'Draft data could not be saved. Keep this page open and retry.';
        draftsRef.current.setDraftStoreError(errorMessage);
        return;
      }

      try {
        const result = draftStorage.flush(data);
        if (result.success) return;
        event.preventDefault();
        event.returnValue = 'Draft data could not be saved. Keep this page open and retry.';
        draftsRef.current.setDraftStoreError(result.error || translateRef.current('studio.latestDraftCouldNotSave'));
      } catch (error) {
        event.preventDefault();
        event.returnValue = 'Draft data could not be saved. Keep this page open and retry.';
        draftsRef.current.setDraftStoreError(error instanceof Error ? error.message : 'The latest draft could not be saved. Keep this window open and retry.');
      }
    };
    window.addEventListener('beforeunload', flushDraftOnClose);
    return () => window.removeEventListener('beforeunload', flushDraftOnClose);
  }, [draftStateHydrated, drafts.draftStoreReady]);

  const handleRestoreDraftBackup = async (index: number) => {
    const draftStorage = getDraftStorageApi();
    if (!draftStorage) {
      try {
        const fallback = readWorkspaceDraftStoreFallback();
        if (!fallback) {
          drafts.setDraftStoreError('No saved draft backup is available for this runtime.');
          return;
        }
        applyPersistedDraftStore(fallback);
      } catch (error) {
        drafts.setDraftStoreError(error instanceof Error ? error.message : t('studio.selectedBackupCouldNotRestore'));
      }
      return;
    }

    const result = await draftStorage.restoreBackup(index);
    if (!result.success || !result.store) {
      drafts.setDraftStoreError(result.error || t('studio.selectedBackupCouldNotRestore'));
      return;
    }
    applyPersistedDraftStore(result.store);
  };

  const handleExportDrafts = async (showFeedback: (message: string, kind?: 'warning' | 'success') => void) => {
    cancelPendingAutosave();
    const workspaceDraft = createWorkspaceDraftSnapshot();
    if (workspaceDraft) setSavedAt(workspaceDraft.savedAt);
    if (!await drafts.persistDraftStore(() => drafts.savedDraftsRef.current, workspaceDraft)) return;

    const draftStorage = getDraftStorageApi();
    if (!draftStorage) {
      const saved = writeWorkspaceDraftStoreFallback({
        schemaVersion: DRAFT_STORE_SCHEMA_VERSION,
        migrationVersion: 1,
        savedDrafts: drafts.savedDraftsRef.current,
        workspaceDraft,
        documentHistories: drafts.documentHistoriesRef.current,
      });
      if (!saved) {
        drafts.setDraftStoreError(t('studio.draftsCouldNotSave'));
        return;
      }
      showFeedback(t('studio.draftStorageSaved'), 'success');
      return;
    }

    const result = await draftStorage.exportBackup();
    if (!result.success && !result.cancelled) drafts.setDraftStoreError(result.error || t('studio.backupCouldNotExport'));
    else if (result.success) {
      drafts.setDraftStoreError('');
      showFeedback(t('studio.draftExported'), 'success');
    }
  };

  const handleImportDrafts = async (showFeedback: (message: string, kind?: 'warning' | 'success') => void) => {
    const draftStorage = getDraftStorageApi();
    if (!draftStorage) {
      try {
        const fallback = readWorkspaceDraftStoreFallback();
        if (fallback) {
          applyPersistedDraftStore(fallback);
          showFeedback(t('studio.draftsRestored'), 'success');
        }
      } catch (error) {
        drafts.setDraftStoreError(error instanceof Error ? error.message : t('studio.backupCouldNotImport'));
      }
      return;
    }

    const result = await draftStorage.importBackup();
    if (!result.success) {
      if (!result.cancelled) drafts.setDraftStoreError(result.error || t('studio.backupCouldNotImport'));
      return;
    }
    if (result.store) {
      applyPersistedDraftStore(result.store);
      showFeedback(t('studio.draftsImported'), 'success');
    }
  };
  return {
    ...drafts,
    draftStateHydrated,
    savedAt,
    setSavedAt,
    createWorkspaceDraftSnapshot,
    markWorkspaceDraftPersisted,
    applyPersistedDraftStore,
    cancelPendingAutosave,
    flushWorkspaceDraftNow,
    handleRestoreDraftBackup,
    handleExportDrafts,
    handleImportDrafts,
    ...history,
  };
}