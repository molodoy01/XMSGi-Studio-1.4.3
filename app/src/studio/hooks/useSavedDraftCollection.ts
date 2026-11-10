import { useRef, useState } from 'react';
import type { PersistedDraftStore, SavedDraft } from '@studio/types';
import { DRAFT_STORE_SCHEMA_VERSION } from '@studio/lib/draftStoreVersion';
import {
  getDraftStorageApi,
  SAVED_STUDIO_DRAFTS_UPDATED_EVENT,
  writeWorkspaceDraftStoreFallback,
} from '@studio/lib/draftStore';
import type { WorkspaceDraft } from '@studio/lib/draftStore';
import { useLocale } from '@studio/lib/i18n';
import type { PersistedWorkspaceDocumentHistories } from '@shared/types';

export function useSavedDraftCollection() {
  const { t } = useLocale();
  const [savedDrafts, setSavedDrafts] = useState<SavedDraft[]>([]);
  const savedDraftsRef = useRef(savedDrafts);
  const [draftStoreReady, setDraftStoreReady] = useState(false);
  const [draftStoreSaving, setDraftStoreSaving] = useState(false);
  const [draftStoreError, setDraftStoreError] = useState('');
  const [draftStoreBackups, setDraftStoreBackups] = useState<number[]>([]);
  const [documentHistories, setDocumentHistories] = useState<PersistedWorkspaceDocumentHistories>({});
  const documentHistoriesRef = useRef(documentHistories);
  const draftStoreQueueRef = useRef<Promise<void>>(Promise.resolve());
  const draftStorePendingRef = useRef(0);

  const replaceSavedDrafts = (nextDrafts: SavedDraft[]) => {
    savedDraftsRef.current = nextDrafts;
    setSavedDrafts(nextDrafts);
  };

  const previewSavedDrafts = (nextDrafts: SavedDraft[]) => {
    setSavedDrafts(nextDrafts);
  };

  const replaceDocumentHistories = (nextHistories: PersistedWorkspaceDocumentHistories) => {
    documentHistoriesRef.current = nextHistories;
    setDocumentHistories(nextHistories);
  };

  const persistDraftStore = (
    getSavedDrafts: SavedDraft[] | (() => SavedDraft[]),
    workspaceDraft: WorkspaceDraft | null,
    onPersisted?: (documentHistories: PersistedWorkspaceDocumentHistories) => void,
    getDocumentHistories: PersistedWorkspaceDocumentHistories | (() => PersistedWorkspaceDocumentHistories) = () => documentHistoriesRef.current,
  ) => {
    draftStorePendingRef.current += 1;
    setDraftStoreSaving(true);
    const operation = draftStoreQueueRef.current.then(async () => {
      const nextDocumentHistories = typeof getDocumentHistories === 'function'
        ? getDocumentHistories()
        : getDocumentHistories;
      const nextSavedDrafts = typeof getSavedDrafts === 'function' ? getSavedDrafts() : getSavedDrafts;
      const savedDraftsChanged = savedDraftsRef.current !== nextSavedDrafts;
      const data: PersistedDraftStore = {
        schemaVersion: DRAFT_STORE_SCHEMA_VERSION,
        migrationVersion: 1,
        savedDrafts: nextSavedDrafts,
        workspaceDraft,
        documentHistories: nextDocumentHistories,
      };

      const draftStorage = getDraftStorageApi();
      if (!draftStorage) {
        const fallbackSaved = writeWorkspaceDraftStoreFallback(data);
        if (!fallbackSaved) {
          setDraftStoreError(t('studio.draftsCouldNotSave'));
          draftStorePendingRef.current -= 1;
          setDraftStoreSaving(draftStorePendingRef.current > 0);
          return false;
        }
        setDraftStoreError('');
        setDraftStoreBackups([]);
        onPersisted?.(data.documentHistories ?? {});
        if (savedDraftsChanged) window.dispatchEvent(new Event(SAVED_STUDIO_DRAFTS_UPDATED_EVENT));
        draftStorePendingRef.current -= 1;
        setDraftStoreSaving(draftStorePendingRef.current > 0);
        return true;
      }

      try {
        const result = await draftStorage.save(data);
        if (!result.success) {
          setDraftStoreError(result.error || t('studio.draftsCouldNotSave'));
          setDraftStoreBackups(result.backupIndexes ?? []);
          return false;
        }
        setDraftStoreError('');
        setDraftStoreBackups([]);
        onPersisted?.(data.documentHistories ?? {});
        if (savedDraftsChanged) window.dispatchEvent(new Event(SAVED_STUDIO_DRAFTS_UPDATED_EVENT));
        return true;
      } catch (error) {
        setDraftStoreError(error instanceof Error ? error.message : 'Drafts could not be saved.');
        return false;
      } finally {
        draftStorePendingRef.current -= 1;
        setDraftStoreSaving(draftStorePendingRef.current > 0);
      }
    });
    draftStoreQueueRef.current = operation.then(() => undefined, () => undefined);
    return operation;
  };

  return {
    savedDrafts,
    savedDraftsRef,
    replaceSavedDrafts,
    previewSavedDrafts,
    documentHistories,
    documentHistoriesRef,
    replaceDocumentHistories,
    draftStoreReady,
    setDraftStoreReady,
    draftStoreSaving,
    draftStoreError,
    setDraftStoreError,
    draftStoreBackups,
    setDraftStoreBackups,
    persistDraftStore,
  };
}

export type SavedDraftCollection = ReturnType<typeof useSavedDraftCollection>;
