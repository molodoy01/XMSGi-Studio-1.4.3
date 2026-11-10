import { useRef, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import type { Chat, RichTextEntity, SavedDraft, ScheduledMessage } from '../types';
import type { WorkspaceDraft } from '../lib/draftStore';
import type { WorkspaceAttachment } from '../lib/workspaceAttachments';
import { normalizeAttachments } from '../lib/draftAttachments';
import { hasWorkspaceDocumentContent } from '../lib/documentHistory';
import { normalizeRichTextEntities, richTextToHtml } from '../lib/richText';
import { deleteSavedDraft } from '../lib/drafts';
import type { WorkspacePageProps } from '../pages/workspacePageTypes';
import type { ScheduleRepeatOptions } from '../lib/scheduling';
import type { PublishAction } from '../components/WorkspacePageActionRows';
import type { WorkspaceStageMode } from './useWorkspaceStageMode';
import { useLocale } from '@studio/lib/i18n';

export type PendingDraftReplacement = {
  previousSnapshot: WorkspaceDraft;
};

type WorkspaceDraftReplacementOptions = {
  chats: Chat[];
  savedDraftsRef: MutableRefObject<SavedDraft[]>;
  replaceSavedDrafts: (drafts: SavedDraft[]) => void;
  persistDraftStore: (
    savedDrafts: SavedDraft[] | (() => SavedDraft[]),
    workspaceDraft: WorkspaceDraft | null,
    onPersisted?: () => void,
  ) => Promise<boolean>;
  cancelPendingAutosave: () => void;
  createWorkspaceDraftSnapshot: () => WorkspaceDraft | null;
  recordWorkspaceVersion: (
    snapshot: WorkspaceDraft | null,
    reason: 'before-replacement' | 'publish',
  ) => Promise<{ success: boolean; snapshot?: WorkspaceDraft | null }>;
  workspaceDocumentId: string;
  setWorkspaceDocumentId: (documentId: string) => void;
  bodyInputRef: MutableRefObject<HTMLDivElement | null>;
  attachmentSelectionGenerationRef: MutableRefObject<number>;
  pendingDraftReplacementRef: MutableRefObject<PendingDraftReplacement | null>;
  suppressDraftReplacementSuccessClearRef: MutableRefObject<boolean>;
  completeDraftReplacementRef: MutableRefObject<(showRestoreFeedback?: boolean) => Promise<boolean>>;
  focusRescheduledEditorAtEndRef: MutableRefObject<boolean>;
  setSelectedChat: WorkspacePageProps['setSelectedChat'];
  setDraftBody: Dispatch<SetStateAction<string>>;
  setDraftEntities: Dispatch<SetStateAction<RichTextEntity[]>>;
  replaceAttachments: (attachments: WorkspaceAttachment[]) => void;
  setDate: WorkspacePageProps['setDate'];
  setTime: WorkspacePageProps['setTime'];
  setFollowCurrentTime: Dispatch<SetStateAction<boolean>>;
  setRepeatMode: Dispatch<SetStateAction<ScheduleRepeatOptions['mode']>>;
  setRepeatDays: Dispatch<SetStateAction<string[]>>;
  setRepeatOccurrences: Dispatch<SetStateAction<number>>;
  rescheduleSourceRef: MutableRefObject<ScheduledMessage | null>;
  setRescheduleSource: Dispatch<SetStateAction<ScheduledMessage | null>>;
  setScheduleSelectionConfirmed: Dispatch<SetStateAction<boolean>>;
  setPublishAction: Dispatch<SetStateAction<PublishAction>>;
  changeStageMode: (mode: WorkspaceStageMode) => void;
  showFeedback: (message: string, kind?: 'warning' | 'success') => void;
};

export function useWorkspaceDraftReplacement({
  chats,
  savedDraftsRef,
  replaceSavedDrafts,
  persistDraftStore,
  cancelPendingAutosave,
  createWorkspaceDraftSnapshot,
  recordWorkspaceVersion,
  workspaceDocumentId,
  setWorkspaceDocumentId,
  bodyInputRef,
  attachmentSelectionGenerationRef,
  pendingDraftReplacementRef,
  suppressDraftReplacementSuccessClearRef,
  completeDraftReplacementRef,
  focusRescheduledEditorAtEndRef,
  setSelectedChat,
  setDraftBody,
  setDraftEntities,
  replaceAttachments,
  setDate,
  setTime,
  setFollowCurrentTime,
  setRepeatMode,
  setRepeatDays,
  setRepeatOccurrences,
  rescheduleSourceRef,
  setRescheduleSource,
  setScheduleSelectionConfirmed,
  setPublishAction,
  changeStageMode,
  showFeedback,
}: WorkspaceDraftReplacementOptions) {
  const { t } = useLocale();
  const draftReplacementCompletionRef = useRef<Promise<boolean> | null>(null);

  const useDraftInComposer = async (draft: SavedDraft): Promise<boolean> => {
    cancelPendingAutosave();
    const previousSnapshot = createWorkspaceDraftSnapshot();
    const checkpoint = await recordWorkspaceVersion(previousSnapshot, 'before-replacement');
    if (!checkpoint.success) {
      showFeedback(t('studio.historyCouldNotSave'), 'warning');
      return false;
    }

    const draftChat = draft.selectedChat && chats.find((chat) => chat.id === draft.selectedChat?.id);
    const nextSavedDrafts = deleteSavedDraft(savedDraftsRef.current, draft.id);
    const nextWorkspaceDraft: WorkspaceDraft = {
      documentId: draft.documentId ?? draft.id,
      body: draft.body,
      entities: draft.entities ?? [],
      attachments: normalizeAttachments(draft.attachments),
      selectedChat: draftChat ?? draft.selectedChat ?? null,
      date: draft.date ?? '',
      time: draft.time ?? '',
      repeatMode: draft.repeatMode ?? 'none',
      repeatDays: draft.repeatDays ?? [],
      repeatOccurrences: draft.repeatOccurrences ?? 1,
      savedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
    const persisted = await persistDraftStore(nextSavedDrafts, nextWorkspaceDraft, () => {
      replaceSavedDrafts(nextSavedDrafts);
    });
    if (!persisted) {
      showFeedback(t('studio.draftsCouldNotSave'), 'warning');
      return false;
    }

    if (draftChat) setSelectedChat(draftChat);
    setDraftBody(draft.body);
    setDraftEntities(draft.entities ?? []);
    replaceAttachments(normalizeAttachments(draft.attachments));
    if (draft.date || draft.time) setFollowCurrentTime(false);
    if (draft.date) setDate(draft.date);
    if (draft.time) setTime(draft.time);
    setRepeatMode(draft.repeatMode ?? 'none');
    setRepeatDays(draft.repeatDays ?? []);
    setRepeatOccurrences(draft.repeatOccurrences ?? 1);
    rescheduleSourceRef.current = null;
    setRescheduleSource(null);
    setScheduleSelectionConfirmed(false);
    setPublishAction('draft');
    focusRescheduledEditorAtEndRef.current = true;
    changeStageMode('editor');
    pendingDraftReplacementRef.current = hasWorkspaceDocumentContent(previousSnapshot)
      ? { previousSnapshot }
      : null;
    showFeedback(t('studio.draftMovedToEditor'), 'success');
    return true;
  };

  const restorePreviousDraftAfterReplacement = async (showRestoreFeedback = true) => {
    const pending = pendingDraftReplacementRef.current;
    if (!pending) return false;
    cancelPendingAutosave();
    const { previousSnapshot } = pending;
    const restoredEntities = normalizeRichTextEntities(previousSnapshot.entities, previousSnapshot.body.length);
    const restoredAttachments = normalizeAttachments(previousSnapshot.attachments);
    const restoredSnapshot = {
      ...previousSnapshot,
      entities: restoredEntities,
      attachments: restoredAttachments,
      savedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
    const persisted = await persistDraftStore(savedDraftsRef.current, restoredSnapshot);
    if (!persisted) {
      showFeedback(t('studio.draftsCouldNotSave'), 'warning');
      return false;
    }

    pendingDraftReplacementRef.current = null;
    suppressDraftReplacementSuccessClearRef.current = false;
    attachmentSelectionGenerationRef.current += 1;
    setWorkspaceDocumentId(restoredSnapshot.documentId ?? workspaceDocumentId);
    if (bodyInputRef.current) {
      bodyInputRef.current.innerHTML = richTextToHtml(restoredSnapshot.body, restoredEntities);
    }
    setDraftBody(restoredSnapshot.body);
    setDraftEntities(restoredEntities);
    replaceAttachments(restoredAttachments);
    setSelectedChat(restoredSnapshot.selectedChat ?? null);
    setDate(restoredSnapshot.date ?? '');
    setTime(restoredSnapshot.time ?? '');
    setFollowCurrentTime(!restoredSnapshot.date && !restoredSnapshot.time);
    setRepeatMode(restoredSnapshot.repeatMode ?? 'none');
    setRepeatDays(restoredSnapshot.repeatDays ?? []);
    setRepeatOccurrences(restoredSnapshot.repeatOccurrences ?? 1);
    rescheduleSourceRef.current = null;
    setRescheduleSource(null);
    setScheduleSelectionConfirmed(false);
    setPublishAction('send');
    focusRescheduledEditorAtEndRef.current = true;
    changeStageMode('editor');
    if (showRestoreFeedback) showFeedback(t('studio.previousTextRestored'), 'success');
    return true;
  };

  const completePendingDraftReplacement = (showRestoreFeedback = true) => {
    if (draftReplacementCompletionRef.current) return draftReplacementCompletionRef.current;
    if (!pendingDraftReplacementRef.current) return Promise.resolve(false);

    suppressDraftReplacementSuccessClearRef.current = true;
    const completion = (async () => {
      const checkpoint = await recordWorkspaceVersion(createWorkspaceDraftSnapshot(), 'publish');
      const restored = await restorePreviousDraftAfterReplacement(showRestoreFeedback);
      if (!checkpoint.success) showFeedback(t('studio.historyCouldNotSave'), 'warning');
      return restored;
    })();
    draftReplacementCompletionRef.current = completion;
    void completion.finally(() => {
      if (draftReplacementCompletionRef.current === completion) {
        draftReplacementCompletionRef.current = null;
      }
    });
    return completion;
  };
  completeDraftReplacementRef.current = completePendingDraftReplacement;

  const useSavedDraft = async (draft: SavedDraft) => {
    const previousSnapshot = createWorkspaceDraftSnapshot();
    const checkpoint = await recordWorkspaceVersion(previousSnapshot, 'before-replacement');
    if (!checkpoint.success) {
      showFeedback(t('studio.historyCouldNotSave'), 'warning');
      return;
    }

    attachmentSelectionGenerationRef.current += 1;
    setWorkspaceDocumentId(draft.documentId ?? draft.id);
    setDraftBody(draft.body);
    setDraftEntities(draft.entities ?? []);
    replaceAttachments(normalizeAttachments(draft.attachments));
    if (draft.selectedChat) setSelectedChat(draft.selectedChat);
    if (draft.date || draft.time) setFollowCurrentTime(false);
    if (draft.date) setDate(draft.date);
    if (draft.time) setTime(draft.time);
    setRepeatMode(draft.repeatMode ?? 'none');
    setRepeatDays(draft.repeatDays ?? []);
    setRepeatOccurrences(draft.repeatOccurrences ?? 1);
    changeStageMode('editor');
  };

  return {
    useDraftInComposer,
    restorePreviousDraftAfterReplacement,
    completePendingDraftReplacement,
    useSavedDraft,
  };
}
