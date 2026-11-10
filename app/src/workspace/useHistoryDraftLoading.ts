import { useLayoutEffect, useState } from 'react';
import { getDraftStorageApi, readWorkspaceDraftStoreFallback, SAVED_STUDIO_DRAFTS_UPDATED_EVENT } from '@studio/lib/draftStore';
import { normalizePersistedStudioDrafts, type HistoryItem } from './historyModel';

export function useHistoryDraftLoading(isOpen: boolean) {
  const [draftItems, setDraftItems] = useState<HistoryItem[]>([]);
  const [draftsLoading, setDraftsLoading] = useState(false);
  const [draftsLoaded, setDraftsLoaded] = useState(false);
  const [draftsLoadCycle, setDraftsLoadCycle] = useState(0);
  const [draftLoadFailed, setDraftLoadFailed] = useState(false);

  useLayoutEffect(() => {
    if (!isOpen) return;
    let active = true;
    let latestLoadId = 0;
    const draftStorage = getDraftStorageApi();
    setDraftItems([]);
    setDraftsLoading(true);
    setDraftsLoaded(false);
    setDraftLoadFailed(false);

    const loadDrafts = async (isInitialLoad = false) => {
      const loadId = ++latestLoadId;
      try {
        const result = draftStorage
          ? await draftStorage.load()
          : { success: true, store: readWorkspaceDraftStoreFallback() ?? undefined };
        if (active && loadId === latestLoadId) {
          setDraftItems(result.success ? normalizePersistedStudioDrafts(result.store) : []);
          setDraftsLoading(false);
          setDraftsLoaded(true);
          if (isInitialLoad) {
            setDraftsLoadCycle((cycle) => cycle + 1);
          }
          setDraftLoadFailed(!result.success);
        }
      } catch (error) {
        console.error('Failed to load saved drafts for Posts.', error);
        if (active && loadId === latestLoadId) {
          setDraftItems([]);
          setDraftsLoading(false);
          setDraftsLoaded(true);
          if (isInitialLoad) {
            setDraftsLoadCycle((cycle) => cycle + 1);
          }
          setDraftLoadFailed(true);
        }
      }
    };

    const refreshDrafts = () => {
      void loadDrafts();
    };

    void loadDrafts(true);
    window.addEventListener(SAVED_STUDIO_DRAFTS_UPDATED_EVENT, refreshDrafts);
    return () => {
      active = false;
      window.removeEventListener(SAVED_STUDIO_DRAFTS_UPDATED_EVENT, refreshDrafts);
    };
  }, [isOpen]);

  return { draftItems, setDraftItems, draftsLoading, draftsLoaded, draftsLoadCycle, draftLoadFailed };
}
