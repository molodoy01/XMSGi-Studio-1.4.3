import { useRef, type Dispatch, type SetStateAction } from 'react';
import { useStudioDrafts } from './useStudioDrafts';
import { useWorkspaceDraftEditorActions } from './useWorkspaceDraftEditorActions';
import type { ConfirmAction } from '@/components/useConfirm';
import type { WorkspaceStageMode } from './useWorkspaceStageMode';

type LifecycleOptions = Parameters<typeof useStudioDrafts>[0];

type UseWorkspacePageDraftLifecycleOptions = {
  lifecycle: LifecycleOptions;
  setStageMode: Dispatch<SetStateAction<WorkspaceStageMode>>;
  confirm: ConfirmAction;
  showFeedback: (message: string, kind?: 'warning' | 'success') => void;
};

export function useWorkspacePageDraftLifecycle({
  lifecycle,
  setStageMode,
  confirm,
  showFeedback,
}: UseWorkspacePageDraftLifecycleOptions) {
  const draftLifecycle = useStudioDrafts(lifecycle);
  const {
    savedDraftsRef,
    previewSavedDrafts,
    replaceSavedDrafts,
    persistDraftStore,
    createWorkspaceDraftSnapshot,
    recordWorkspaceVersion,
    draftStoreError,
    cancelPendingAutosave,
  } = draftLifecycle;
  const recordWorkspaceVersionRef = useRef(recordWorkspaceVersion);
  recordWorkspaceVersionRef.current = recordWorkspaceVersion;

  const draftEditorActions = useWorkspaceDraftEditorActions({
    savedDraftsRef,
    previewSavedDrafts,
    replaceSavedDrafts,
    persistDraftStore,
    createWorkspaceDraftSnapshot,
    recordWorkspaceVersion,
    draftStoreError,
    cancelPendingAutosave,
    setStageMode,
    confirm,
    showFeedback,
  });

  return {
    ...draftLifecycle,
    ...draftEditorActions,
    recordWorkspaceVersionRef,
  } satisfies ReturnType<typeof useStudioDrafts> & ReturnType<typeof useWorkspaceDraftEditorActions> & {
    recordWorkspaceVersionRef: { current: typeof recordWorkspaceVersion };
  };
}
