import { useEffect, useRef } from 'react';
import type { MutableRefObject } from 'react';
import type { PersistedDraftStore, SavedDraft } from '@studio/types';
import {
  getDraftStorageApi,
  isBrowserRuntimeFallback,
  LEGACY_WORKSPACE_DRAFT_KEY,
  markDefaultDraftSeeded,
  readWorkspaceDraftStoreFallback,
  seedDefaultDraft,
  WORKSPACE_DRAFT_KEY,
  writeWorkspaceDraftStoreFallback,
} from '@studio/lib/draftStore';
import { DRAFT_STORE_SCHEMA_VERSION } from '@studio/lib/draftStoreVersion';
import { loadSavedDrafts } from '@studio/lib/storage';
import { hasEmbeddedWorkspaceHistoryAvatars } from '@studio/lib/documentHistory';
import { normalizeWorkspaceDocumentHistories } from '@studio/lib/documentHistory';
import type { WorkspaceDraftLifecycleOptions } from './useStudioDrafts';
import type { SavedDraftCollection } from './useSavedDraftCollection';
import { useLocale } from '@studio/lib/i18n';

type Props = {
  drafts: SavedDraftCollection;
  optionsRef: MutableRefObject<WorkspaceDraftLifecycleOptions>;
  applyPersistedDraftStore: (store: PersistedDraftStore) => void;
};

export function useInitializeStudioDraftStore({
  drafts,
  optionsRef,
  applyPersistedDraftStore,
}: Props) {
  const { t } = useLocale();
  const translateRef = useRef(t);
  translateRef.current = t;

  // Initialization runs once; refs keep the options and callbacks current.
  useEffect(() => {
    let cancelled = false;

    const initializeDraftStore = async () => {
      const draftStorage = getDraftStorageApi();
      if (!draftStorage) {
        let fallbackStore: PersistedDraftStore | null;
        try {
          fallbackStore = readWorkspaceDraftStoreFallback();
        } catch (error) {
          drafts.setDraftStoreError(error instanceof Error ? error.message : translateRef.current('studio.draftsCouldNotLoad'));
          return;
        }
        if (fallbackStore) {
          const seeded = seedDefaultDraft(fallbackStore);
          if (seeded.added) {
            if (!writeWorkspaceDraftStoreFallback(seeded.store)) {
              drafts.setDraftStoreError(translateRef.current('studio.defaultDraftCouldNotSave'));
              return;
            }
            markDefaultDraftSeeded();
          }
          applyPersistedDraftStore(seeded.store);
          return;
        }

        if (isBrowserRuntimeFallback()) {
          if (optionsRef.current.initialWorkspaceDraftError) {
            drafts.setDraftStoreError(optionsRef.current.initialWorkspaceDraftError);
            return;
          }
          let legacySavedDrafts: SavedDraft[];
          try {
            legacySavedDrafts = loadSavedDrafts();
          } catch (error) {
            drafts.setDraftStoreError(error instanceof Error ? error.message : translateRef.current('studio.draftsCouldNotLoad'));
            return;
          }
          const initialWorkspaceDraft = optionsRef.current.initialWorkspaceDraftRef.current;
          const emptyStore: PersistedDraftStore = {
            schemaVersion: DRAFT_STORE_SCHEMA_VERSION,
            migrationVersion: 1,
            savedDrafts: legacySavedDrafts,
            workspaceDraft: initialWorkspaceDraft && (
              typeof initialWorkspaceDraft.body === 'string'
              || Boolean(initialWorkspaceDraft.attachments?.length)
            ) ? initialWorkspaceDraft as Record<string, unknown> : null,
            documentHistories: {},
          };
          const seeded = seedDefaultDraft(emptyStore);
          if (!writeWorkspaceDraftStoreFallback(seeded.store)) {
            drafts.setDraftStoreError(translateRef.current('studio.draftsCouldNotSave'));
            return;
          }
          if (seeded.added) markDefaultDraftSeeded();
          applyPersistedDraftStore(seeded.store);
          return;
        }

        drafts.setDraftStoreError('Saved drafts are unavailable in this runtime.');
        return;
      }

      try {
        const result = await draftStorage.load();
        if (!result.success) {
          const backups = result.backupIndexes ?? [];
          drafts.setDraftStoreBackups(backups);
          drafts.setDraftStoreError(result.error || translateRef.current('studio.draftsCouldNotLoad'));
          return;
        }
        if (!result.success || !result.store) throw new Error(result.error || translateRef.current('studio.draftsCouldNotLoad'));

        let store = result.store;
        if (result.needsMigration || store.migrationVersion < 1) {
          const migrated = await draftStorage.migrate({
            savedDrafts: loadSavedDrafts(),
            workspaceDraft: optionsRef.current.initialWorkspaceDraftRef.current as Record<string, unknown> | null,
          });
          if (!migrated.success || !migrated.store) {
            throw new Error(migrated.error || translateRef.current('studio.draftsMigrationFailed'));
          }
          store = migrated.store;
        }

        const seeded = seedDefaultDraft(store);
        store = seeded.store;
        const historyNeedsCompaction = hasEmbeddedWorkspaceHistoryAvatars(store.documentHistories);
        store = {
          ...store,
          documentHistories: normalizeWorkspaceDocumentHistories(store.documentHistories),
        };
        if (seeded.added) {
          const saved = await draftStorage.save(store);
          if (saved.success) {
            store = saved.store ?? store;
            markDefaultDraftSeeded();
          } else {
            drafts.setDraftStoreError(saved.error || translateRef.current('studio.defaultDraftCouldNotSave'));
          }
        } else if (historyNeedsCompaction) {
          void draftStorage.save(store).then((saved) => {
            if (!saved.success) {
              drafts.setDraftStoreError(saved.error || translateRef.current('studio.draftsCouldNotSave'));
            }
          }).catch((error) => {
            drafts.setDraftStoreError(error instanceof Error
              ? error.message
              : translateRef.current('studio.draftsCouldNotSave'));
          });
        }

        if (cancelled) return;
        window.localStorage.removeItem('xmsgi_saved_drafts');
        window.localStorage.removeItem(WORKSPACE_DRAFT_KEY);
        window.localStorage.removeItem(LEGACY_WORKSPACE_DRAFT_KEY);
        if (!writeWorkspaceDraftStoreFallback(store)) {
          drafts.setDraftStoreError(translateRef.current('studio.draftsCouldNotSave'));
        }
        applyPersistedDraftStore(store);
      } catch (error) {
        if (!cancelled) {
          drafts.setDraftStoreError(error instanceof Error ? error.message : 'Saved drafts could not be loaded.');
        }
      }
    };

    void initializeDraftStore();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
