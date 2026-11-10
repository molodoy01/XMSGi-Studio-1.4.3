import { useCallback, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import type { PersistedWorkspaceDocumentVersion } from '@shared/types';
import type { ConfirmAction } from '@/components/useConfirm';
import { createSavedDraft, updateSavedDraft, deleteSavedDraft } from '../lib/drafts';
import { normalizeAttachments } from '../lib/draftAttachments';
import { savedDraftToWorkspaceSnapshot } from '../pages/WorkspacePageHelpers';
import type { WorkspaceDraft } from '../lib/draftStore';
import type { DraftColor, RichTextEntity, SavedDraft } from '../types';
import type { WorkspaceStageMode } from './useWorkspaceStageMode';
import { useLocale } from '@studio/lib/i18n';

type WorkspaceDraftEditorActionsOptions = {
  savedDraftsRef: { current: SavedDraft[] };
  previewSavedDrafts: (drafts: SavedDraft[]) => void;
  replaceSavedDrafts: (drafts: SavedDraft[]) => void;
  persistDraftStore: (
    savedDrafts: SavedDraft[] | (() => SavedDraft[]),
    workspaceDraft: WorkspaceDraft | null,
    onPersisted?: () => void,
  ) => Promise<boolean>;
  createWorkspaceDraftSnapshot: () => WorkspaceDraft | null;
  cancelPendingAutosave: () => void;
  recordWorkspaceVersion: (
    snapshot: WorkspaceDraft | null,
    reason: PersistedWorkspaceDocumentVersion['reason'],
    requireAvailableAttachments?: boolean,
    savedDraftsToPersist?: SavedDraft[],
  ) => Promise<{ success: boolean; error?: string }>;
  draftStoreError: string;
  setStageMode: Dispatch<SetStateAction<WorkspaceStageMode>>;
  confirm: ConfirmAction;
  showFeedback: (message: string, kind?: 'warning' | 'success') => void;
};

export function useWorkspaceDraftEditorActions({
  savedDraftsRef,
  previewSavedDrafts,
  replaceSavedDrafts,
  persistDraftStore,
  createWorkspaceDraftSnapshot,
  cancelPendingAutosave,
  recordWorkspaceVersion,
  draftStoreError,
  setStageMode,
  confirm,
  showFeedback,
}: WorkspaceDraftEditorActionsOptions) {
  const { t } = useLocale();
  const [draftEditingId, setDraftEditingId] = useState<string | null>(null);
  const [draftEditorColor, setDraftEditorColor] = useState<DraftColor>('gray');
  const [draftName, setDraftName] = useState('');
  const [draftBodyText, setDraftBodyText] = useState('');
  const [draftBodyEntities, setDraftBodyEntities] = useState<RichTextEntity[]>([]);
  const draftEditingSourceRef = useRef<SavedDraft | null>(null);
  const draftMutationInProgressRef = useRef(false);

  const openDraftEditor = (draft?: SavedDraft) => {
    draftEditingSourceRef.current = draft ?? null;
    setDraftEditingId(draft?.id ?? 'new');
    setDraftEditorColor(draft?.color ?? 'gray');
    setDraftName(draft?.name ?? '');
    setDraftBodyText(draft?.body ?? '');
    setDraftBodyEntities(draft?.entities ?? []);
    setStageMode('draft');
  };

  const closeDraftEditor = useCallback(() => {
    draftEditingSourceRef.current = null;
    setDraftEditingId(null);
    setDraftEditorColor('gray');
    setDraftName('');
    setDraftBodyText('');
    setDraftBodyEntities([]);
  }, []);

  const handleDeleteDraft = async (draft: SavedDraft) => {
    if (!await confirm({
      message: t('studio.confirmDeleteDraft', { name: draft.name }),
      confirmLabel: t('common.remove'),
      cancelLabel: t('common.cancel'),
      destructive: true,
    })) return;

    if (draftMutationInProgressRef.current) return;
    draftMutationInProgressRef.current = true;
    const nextSavedDrafts = deleteSavedDraft(savedDraftsRef.current, draft.id);
    previewSavedDrafts(nextSavedDrafts);
    try {
      const checkpoint = await recordWorkspaceVersion(
        savedDraftToWorkspaceSnapshot(draft),
        'before-delete',
        false,
        nextSavedDrafts,
      );
      if (!checkpoint.success) {
        previewSavedDrafts(savedDraftsRef.current);
        showFeedback(checkpoint.error || t('studio.historyCouldNotSave'), 'warning');
        return;
      }
      showFeedback(checkpoint.error || t('studio.draftDeleted'), checkpoint.error ? 'warning' : 'success');
    } catch (error) {
      previewSavedDrafts(savedDraftsRef.current);
      showFeedback(error instanceof Error ? error.message : t('studio.draftsCouldNotSave'), 'warning');
    } finally {
      draftMutationInProgressRef.current = false;
    }
  };

  const clearHistoryDrafts = async () => {
    cancelPendingAutosave();
    let historyWarning = '';
    for (const draft of savedDraftsRef.current) {
      const checkpoint = await recordWorkspaceVersion(savedDraftToWorkspaceSnapshot(draft), 'before-delete', false);
      if (!checkpoint.success) return false;
      historyWarning ||= checkpoint.error ?? '';
    }
    const nextSavedDrafts: SavedDraft[] = [];
    return persistDraftStore(nextSavedDrafts, createWorkspaceDraftSnapshot(), () => {
      replaceSavedDrafts(nextSavedDrafts);
      showFeedback(historyWarning || t('studio.draftsDeleted'), historyWarning ? 'warning' : 'success');
    });
  };

  const deleteHistoryDraft = async (draftId: string) => {
    if (draftMutationInProgressRef.current) return false;
    const currentSavedDrafts = savedDraftsRef.current;
    const targetDraft = currentSavedDrafts.find((draft) => draft.id === draftId);
    if (!targetDraft) return false;
    const nextSavedDrafts = deleteSavedDraft(currentSavedDrafts, draftId);
    if (nextSavedDrafts.length === currentSavedDrafts.length) return false;

    draftMutationInProgressRef.current = true;
    previewSavedDrafts(nextSavedDrafts);
    try {
      const checkpoint = await recordWorkspaceVersion(
        savedDraftToWorkspaceSnapshot(targetDraft),
        'before-delete',
        false,
        nextSavedDrafts,
      );
      if (!checkpoint.success) {
        previewSavedDrafts(savedDraftsRef.current);
        return false;
      }

      if (draftEditingId === draftId) {
        setDraftEditingId(null);
        setDraftEditorColor('gray');
        setDraftName('');
        setDraftBodyText('');
        setDraftBodyEntities([]);
      }
      showFeedback(checkpoint.error || t('studio.draftDeleted'), checkpoint.error ? 'warning' : 'success');
      return true;
    } catch (error) {
      previewSavedDrafts(savedDraftsRef.current);
      showFeedback(error instanceof Error ? error.message : t('studio.draftsCouldNotSave'), 'warning');
      return false;
    } finally {
      draftMutationInProgressRef.current = false;
    }
  };

  const saveDraftStage = async () => {
    if (draftMutationInProgressRef.current || !draftName.trim() || !draftBodyText.trim()) return;

    const editingId = draftEditingId;
    const existingDraft = draftEditingSourceRef.current;
    const input = {
      name: draftName,
      body: draftBodyText,
      documentId: existingDraft?.documentId ?? existingDraft?.id,
      color: draftEditorColor,
      entities: draftBodyEntities,
      attachments: existingDraft?.attachments ?? [],
      selectedChat: existingDraft?.selectedChat ?? null,
      date: existingDraft?.date ?? '',
      time: existingDraft?.time ?? '',
      repeatMode: existingDraft?.repeatMode ?? 'none',
      repeatDays: existingDraft?.repeatDays ?? [],
      repeatOccurrences: existingDraft?.repeatOccurrences ?? 1,
    };
    if (!editingId) return;

    let nextSavedDrafts: SavedDraft[];
    if (editingId === 'new') {
      nextSavedDrafts = [createSavedDraft(input), ...savedDraftsRef.current];
    } else {
      nextSavedDrafts = savedDraftsRef.current.map((draft) => (
        draft.id === editingId ? updateSavedDraft(draft, input) : draft
      ));
    }

    draftMutationInProgressRef.current = true;
    previewSavedDrafts(nextSavedDrafts);
    closeDraftEditor();
    const restoreEditor = () => {
      draftEditingSourceRef.current = existingDraft;
      setDraftEditingId(editingId);
      setDraftEditorColor(input.color);
      setDraftName(input.name);
      setDraftBodyText(input.body);
      setDraftBodyEntities(input.entities);
      previewSavedDrafts(savedDraftsRef.current);
    };

    try {
      if (existingDraft && editingId !== 'new') {
        const previousDraftSnapshot: WorkspaceDraft = {
          documentId: existingDraft.documentId ?? existingDraft.id,
          body: existingDraft.body,
          entities: existingDraft.entities ?? [],
          attachments: normalizeAttachments(existingDraft.attachments),
          selectedChat: existingDraft.selectedChat ?? null,
          date: existingDraft.date ?? '',
          time: existingDraft.time ?? '',
          repeatMode: existingDraft.repeatMode ?? 'none',
          repeatDays: existingDraft.repeatDays ?? [],
          repeatOccurrences: existingDraft.repeatOccurrences ?? 1,
          savedAt: existingDraft.updatedAt,
        };
        const checkpoint = await recordWorkspaceVersion(previousDraftSnapshot, 'before-replacement', true, nextSavedDrafts);
        if (!checkpoint.success) {
          restoreEditor();
          showFeedback(checkpoint.error || t('studio.historyCouldNotSave'), 'warning');
          return;
        }
      } else if (!await persistDraftStore(nextSavedDrafts, createWorkspaceDraftSnapshot(), () => {
        replaceSavedDrafts(nextSavedDrafts);
      })) {
        restoreEditor();
        showFeedback(draftStoreError || t('studio.draftsCouldNotSave'), 'warning');
        return;
      }
      showFeedback(t('studio.draftSavedNotice'), 'success');
    } catch (error) {
      restoreEditor();
      showFeedback(error instanceof Error ? error.message : t('studio.draftsCouldNotSave'), 'warning');
    } finally {
      draftMutationInProgressRef.current = false;
    }
  };

  return {
    draftEditingId,
    setDraftEditingId,
    draftEditorColor,
    setDraftEditorColor,
    draftName,
    setDraftName,
    draftBodyText,
    setDraftBodyText,
    draftBodyEntities,
    setDraftBodyEntities,
    draftEditingSourceRef,
    draftMutationInProgressRef,
    openDraftEditor,
    closeDraftEditor,
    handleDeleteDraft,
    clearHistoryDrafts,
    deleteHistoryDraft,
    saveDraftStage,
  };
}
