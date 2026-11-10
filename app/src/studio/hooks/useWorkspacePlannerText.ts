import { useCallback, useEffect, useRef, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import type { StudioPlannerTextPayload } from '@shared/bridge';
import type { PersistedWorkspaceDocumentVersion as HistoryVersion } from '@shared/types';
import type { WorkspaceDraft } from '../lib/draftStore';
import { getDraftStorageApi, hasDraftContent } from '../lib/draftStore';
import { normalizeAttachments } from '../lib/draftAttachments';
import { normalizeRichTextEntities, richTextToHtml } from '../lib/richText';
import { createSavedDraft } from '../lib/drafts';
import { uid } from '@shared/utils';
import type { WorkspacePageProps } from '../pages/workspacePageTypes';
import type { Chat, DraftColor, RichTextEntity, SavedDraft } from '../types';
import type { ScheduleRepeatOptions } from '../lib/scheduling';
import type { WorkspaceAttachment } from '../lib/workspaceAttachments';
import type { WorkspaceStageMode } from './useWorkspaceStageMode';
import { useLocale } from '@studio/lib/i18n';

type PlannerRestoreState = { draft: SavedDraft | null };

type WorkspacePlannerTextOptions = {
  attachments: WorkspaceAttachment[];
  replaceAttachments: (attachments: WorkspaceAttachment[]) => void;
  attachmentSelectionGenerationRef: MutableRefObject<number>;
  bodyInputRef: MutableRefObject<HTMLDivElement | null>;
  focusPlannerEditorAtEndRef: MutableRefObject<boolean>;
  plannerRestoreRef: MutableRefObject<PlannerRestoreState | null>;
  restorePlannerDocumentRef: MutableRefObject<() => Promise<boolean>>;
  draftBody: string;
  draftEntities: RichTextEntity[];
  draftColor: DraftColor;
  draftEditingId: string | null;
  draftStateHydrated: boolean;
  draftStoreReady: boolean;
  workspaceDocumentId: string;
  setWorkspaceDocumentId: (documentId: string) => void;
  selectedChat: Chat | null;
  chats: Chat[];
  date: string;
  time: string;
  repeatMode: ScheduleRepeatOptions['mode'];
  repeatDays: string[];
  repeatOccurrences: number;
  setDraftBody: Dispatch<SetStateAction<string>>;
  setDraftEntities: Dispatch<SetStateAction<RichTextEntity[]>>;
  setMessageEffectId: Dispatch<SetStateAction<string | null>>;
  setSelectedChat: WorkspacePageProps['setSelectedChat'];
  setDate: WorkspacePageProps['setDate'];
  setTime: WorkspacePageProps['setTime'];
  setFollowCurrentTime: Dispatch<SetStateAction<boolean>>;
  setRepeatMode: Dispatch<SetStateAction<ScheduleRepeatOptions['mode']>>;
  setRepeatDays: Dispatch<SetStateAction<string[]>>;
  setRepeatOccurrences: Dispatch<SetStateAction<number>>;
  setRescheduleSource: Dispatch<SetStateAction<import('../types').ScheduledMessage | null>>;
  rescheduleSourceRef: MutableRefObject<import('../types').ScheduledMessage | null>;
  setScheduleSelectionConfirmed: Dispatch<SetStateAction<boolean>>;
  setPublishAction: Dispatch<SetStateAction<'send' | 'schedule' | 'draft'>>;
  setStageMode: Dispatch<SetStateAction<WorkspaceStageMode>>;
  createWorkspaceDraftSnapshot: () => WorkspaceDraft | null;
  recordWorkspaceVersion: (
    snapshot: WorkspaceDraft | null,
    reason: HistoryVersion['reason'],
  ) => Promise<{ success: boolean; snapshot?: WorkspaceDraft | null }>;
  persistDraftStore: (
    savedDrafts: SavedDraft[] | (() => SavedDraft[]),
    workspaceDraft: WorkspaceDraft | null,
  ) => Promise<boolean>;
  savedDraftsRef: MutableRefObject<SavedDraft[]>;
  cancelPendingAutosave: () => void;
  showFeedback: (message: string, kind?: 'warning' | 'success') => void;
  onRegisterPlannerTextOpener?: WorkspacePageProps['onRegisterPlannerTextOpener'];
};

export function useWorkspacePlannerText({
  attachments,
  replaceAttachments,
  attachmentSelectionGenerationRef,
  bodyInputRef,
  focusPlannerEditorAtEndRef,
  plannerRestoreRef,
  restorePlannerDocumentRef,
  draftBody,
  draftEntities,
  draftColor,
  draftEditingId,
  draftStateHydrated,
  draftStoreReady,
  workspaceDocumentId,
  setWorkspaceDocumentId,
  selectedChat,
  chats,
  date,
  time,
  repeatMode,
  repeatDays,
  repeatOccurrences,
  setDraftBody,
  setDraftEntities,
  setMessageEffectId,
  setSelectedChat,
  setDate,
  setTime,
  setFollowCurrentTime,
  setRepeatMode,
  setRepeatDays,
  setRepeatOccurrences,
  setRescheduleSource,
  rescheduleSourceRef,
  setScheduleSelectionConfirmed,
  setPublishAction,
  setStageMode,
  createWorkspaceDraftSnapshot,
  recordWorkspaceVersion,
  persistDraftStore,
  savedDraftsRef,
  cancelPendingAutosave,
  showFeedback,
  onRegisterPlannerTextOpener,
}: WorkspacePlannerTextOptions) {
  const { t } = useLocale();
  const plannerTextOpenerRef = useRef<(payload: StudioPlannerTextPayload) => Promise<boolean>>(
    async () => false,
  );

  const openPlannerTextInEditor = useCallback(async (payload: StudioPlannerTextPayload) => {
    const text = payload.text;
    const rawIncomingAttachments = normalizeAttachments(payload.attachments);
    const sameAttachments = attachments.length === rawIncomingAttachments.length
      && attachments.every((attachment, index) => (
        attachment.path === rawIncomingAttachments[index].path
        || attachment.sourcePath === rawIncomingAttachments[index].path
      ));
    if ((!text.trim() && rawIncomingAttachments.length === 0) || !draftStoreReady || !draftStateHydrated) return false;
    if (draftEditingId || rescheduleSourceRef.current) return false;

    if (draftBody === text && sameAttachments) {
      setDraftEntities(normalizeRichTextEntities(payload.entities, text.length));
      setMessageEffectId(payload.effect ?? null);
      if (hasDraftContent(draftBody, attachments)) {
        plannerRestoreRef.current ??= {
          draft: createSavedDraft({
            name: 'Studio document before Planner',
            documentId: workspaceDocumentId,
            color: draftColor,
            body: draftBody,
            entities: draftEntities,
            attachments,
            selectedChat,
            date,
            time,
            repeatMode,
            repeatDays,
            repeatOccurrences,
          }),
        };
      }
      setStageMode('editor');
      bodyInputRef.current?.focus({ preventScroll: true });
      showFeedback(t('studio.draftMovedToEditor'), 'success');
      return true;
    }

    const draftStorage = getDraftStorageApi();
    const incomingAttachments = await Promise.all(rawIncomingAttachments.map(async (attachment) => {
      if (!attachment.path || !draftStorage?.copyAttachmentPath) {
        return { ...attachment, path: '', sourcePath: attachment.path, unavailable: true };
      }
      try {
        const copied = await draftStorage.copyAttachmentPath(attachment.path);
        if (!copied.success || !copied.attachment) {
          showFeedback(t('studio.historyAttachmentCopyFailed', { name: attachment.name }), 'warning');
          return { ...attachment, sourcePath: attachment.path, unavailable: true };
        }
        return {
          ...attachment,
          path: copied.attachment.path,
          sourcePath: attachment.path,
          size: copied.attachment.size,
          unavailable: undefined,
        };
      } catch {
        showFeedback(t('studio.historyAttachmentCopyFailed', { name: attachment.name }), 'warning');
        return { ...attachment, sourcePath: attachment.path, unavailable: true };
      }
    }));

    const currentSnapshot = createWorkspaceDraftSnapshot() ?? {
      documentId: workspaceDocumentId,
      body: draftBody,
      entities: draftEntities,
      attachments,
      selectedChat,
      date,
      time,
      repeatMode,
      repeatDays,
      repeatOccurrences,
      savedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    } satisfies WorkspaceDraft;
    let previousSnapshot: WorkspaceDraft = currentSnapshot;
    if (hasDraftContent(draftBody, attachments)) {
      const checkpoint = await recordWorkspaceVersion(currentSnapshot, 'before-replacement');
      if (!checkpoint.success) {
        showFeedback(t('studio.historyCouldNotSave'), 'warning');
        return false;
      }
      if (checkpoint.snapshot) previousSnapshot = checkpoint.snapshot;
    }

    const previousDocument = createSavedDraft({
      name: 'Studio document before Planner',
      documentId: previousSnapshot.documentId ?? workspaceDocumentId,
      color: draftColor,
      body: previousSnapshot.body,
      entities: previousSnapshot.entities,
      attachments: previousSnapshot.attachments,
      selectedChat: previousSnapshot.selectedChat,
      date: previousSnapshot.date,
      time: previousSnapshot.time,
      repeatMode: previousSnapshot.repeatMode,
      repeatDays: previousSnapshot.repeatDays,
      repeatOccurrences: previousSnapshot.repeatOccurrences,
    });
    plannerRestoreRef.current = {
      draft: hasDraftContent(previousDocument.body, normalizeAttachments(previousDocument.attachments))
        ? previousDocument
        : null,
    };

    attachmentSelectionGenerationRef.current += 1;
    setWorkspaceDocumentId(uid());
    setDraftBody(text);
    setDraftEntities(normalizeRichTextEntities(payload.entities, text.length));
    setMessageEffectId(payload.effect ?? null);
    replaceAttachments(incomingAttachments);
    setPublishAction('send');
    focusPlannerEditorAtEndRef.current = true;
    setStageMode('editor');
    showFeedback(t('studio.draftMovedToEditor'), 'success');
    return true;
  }, [
    attachmentSelectionGenerationRef, attachments, bodyInputRef, createWorkspaceDraftSnapshot, date, draftBody, draftColor,
    draftEditingId, draftEntities, draftStateHydrated, draftStoreReady, focusPlannerEditorAtEndRef,
    plannerRestoreRef, recordWorkspaceVersion, repeatDays, repeatMode, repeatOccurrences,
    replaceAttachments, rescheduleSourceRef, selectedChat, setDraftEntities, setDraftBody,
    setMessageEffectId, setPublishAction, setStageMode, setWorkspaceDocumentId, showFeedback,
    t, time, workspaceDocumentId,
  ]);
  plannerTextOpenerRef.current = openPlannerTextInEditor;

  const restorePlannerDocument = async () => {
    const pending = plannerRestoreRef.current;
    if (!pending?.draft) return false;

    cancelPendingAutosave();
    const { draft } = pending;
    const draftChat = draft.selectedChat && chats.find((chat) => chat.id === draft.selectedChat?.id);
    if (draftStoreReady) {
      const restoredAttachments = normalizeAttachments(draft.attachments);
      const restoredSnapshot: WorkspaceDraft | null = hasDraftContent(draft.body, restoredAttachments)
        ? {
          documentId: draft.documentId ?? workspaceDocumentId,
          body: draft.body,
          entities: draft.entities,
          attachments: restoredAttachments,
          selectedChat: draftChat ?? draft.selectedChat ?? null,
          date: draft.date,
          time: draft.time,
          repeatMode: draft.repeatMode,
          repeatDays: draft.repeatDays,
          repeatOccurrences: draft.repeatOccurrences,
          savedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        }
        : null;
      const restored = await persistDraftStore(savedDraftsRef.current, restoredSnapshot);
      if (!restored) return false;
    }

    plannerRestoreRef.current = null;
    focusPlannerEditorAtEndRef.current = true;
    setWorkspaceDocumentId(draft.documentId ?? workspaceDocumentId);
    const restoredEntities = normalizeRichTextEntities(draft.entities, draft.body.length);
    if (bodyInputRef.current) {
      bodyInputRef.current.innerHTML = richTextToHtml(draft.body, restoredEntities);
    }
    if (draftChat) setSelectedChat(draftChat);
    attachmentSelectionGenerationRef.current += 1;
    setDraftBody(draft.body);
    setDraftEntities(restoredEntities);
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
    setPublishAction('send');
    setStageMode('editor');
    showFeedback(t('studio.previousTextRestored'), 'success');
    return true;
  };

  restorePlannerDocumentRef.current = restorePlannerDocument;

  useEffect(() => {
    if (!onRegisterPlannerTextOpener || !draftStoreReady || !draftStateHydrated) return;
    onRegisterPlannerTextOpener((payload) => plannerTextOpenerRef.current(payload));
    return () => onRegisterPlannerTextOpener(null);
  }, [draftStateHydrated, draftStoreReady, onRegisterPlannerTextOpener]);

  return { openPlannerTextInEditor, restorePlannerDocument };
}
