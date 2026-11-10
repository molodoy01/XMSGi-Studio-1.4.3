import type { MutableRefObject } from 'react';
import type { ConfirmAction } from '@/components/useConfirm';
import type { WorkspacePageProps } from '../pages/workspacePageTypes';
import { useWorkspaceDraftReplacement } from './useWorkspaceDraftReplacement';
import { useWorkspaceHistoryRegistrations } from './useWorkspaceHistoryRegistrations';
import { useWorkspacePlannerText } from './useWorkspacePlannerText';
import { useWorkspaceRescheduleMessage } from './useWorkspaceRescheduleMessage';
import { useWorkspaceVersionHistory } from './useWorkspaceVersionHistory';
import type { useWorkspaceDocumentState } from './useWorkspaceDocumentState';
import type { useWorkspacePageControls } from './useWorkspacePageControls';
import type { useWorkspacePageDraftLifecycle } from './useWorkspacePageDraftLifecycle';
import type { useWorkspaceStageMode } from './useWorkspaceStageMode';

type DocumentState = ReturnType<typeof useWorkspaceDocumentState>;
type PageControls = ReturnType<typeof useWorkspacePageControls>;
type DraftLifecycle = ReturnType<typeof useWorkspacePageDraftLifecycle>;
type ChangeStageMode = ReturnType<typeof useWorkspaceStageMode>;

type Options = {
  page: Pick<
    WorkspacePageProps,
    | 'chats'
    | 'upcoming'
    | 'selectedChat'
    | 'setSelectedChat'
    | 'date'
    | 'time'
    | 'setDate'
    | 'setTime'
    | 'onRegisterPlannerTextOpener'
    | 'onRegisterHistoryDraftOpener'
    | 'onRegisterHistoryDraftUseHandler'
    | 'onRegisterHistoryDraftClearHandler'
    | 'onRegisterHistoryDraftDeleteHandler'
    | 'onRegisterHistoryRescheduleHandler'
  >;
  document: DocumentState;
  controls: PageControls;
  drafts: DraftLifecycle;
  refs: {
    bodyInputRef: MutableRefObject<HTMLDivElement | null>;
    focusRescheduledEditorAtEndRef: MutableRefObject<boolean>;
    focusPlannerEditorAtEndRef: MutableRefObject<boolean>;
    restorePlannerDocumentRef: MutableRefObject<() => Promise<boolean>>;
  };
  stage: {
    setStageMode: PageControls['stage']['setStageMode'];
    changeStageMode: ChangeStageMode;
  };
  confirm: ConfirmAction;
  showFeedback: (message: string, kind?: 'warning' | 'success') => void;
};

export function useWorkspacePageDocumentActions({
  page,
  document,
  controls,
  drafts,
  refs,
  stage,
  confirm,
  showFeedback,
}: Options) {
  const { chats, selectedChat, setSelectedChat, upcoming, date, time, setDate, setTime } = page;
  const { schedule, rescheduling, publishing } = controls;
  const draftReplacement = useWorkspaceDraftReplacement({
    chats,
    savedDraftsRef: drafts.savedDraftsRef,
    replaceSavedDrafts: drafts.replaceSavedDrafts,
    persistDraftStore: drafts.persistDraftStore,
    cancelPendingAutosave: drafts.cancelPendingAutosave,
    createWorkspaceDraftSnapshot: drafts.createWorkspaceDraftSnapshot,
    recordWorkspaceVersion: drafts.recordWorkspaceVersion,
    workspaceDocumentId: document.workspaceDocumentId,
    setWorkspaceDocumentId: document.setWorkspaceDocumentId,
    bodyInputRef: refs.bodyInputRef,
    attachmentSelectionGenerationRef: document.attachmentSelectionGenerationRef,
    pendingDraftReplacementRef: publishing.pendingDraftReplacementRef,
    suppressDraftReplacementSuccessClearRef: publishing.suppressDraftReplacementSuccessClearRef,
    completeDraftReplacementRef: publishing.completeDraftReplacementRef,
    focusRescheduledEditorAtEndRef: refs.focusRescheduledEditorAtEndRef,
    setSelectedChat,
    setDraftBody: document.setDraftBody,
    setDraftEntities: document.setDraftEntities,
    replaceAttachments: document.replaceAttachments,
    setDate,
    setTime,
    setFollowCurrentTime: schedule.setFollowCurrentTime,
    setRepeatMode: schedule.setRepeatMode,
    setRepeatDays: schedule.setRepeatDays,
    setRepeatOccurrences: schedule.setRepeatOccurrences,
    rescheduleSourceRef: rescheduling.rescheduleSourceRef,
    setRescheduleSource: rescheduling.setRescheduleSource,
    setScheduleSelectionConfirmed: schedule.setScheduleSelectionConfirmed,
    setPublishAction: publishing.setPublishAction,
    changeStageMode: stage.changeStageMode,
    showFeedback,
  });
  publishing.completeDraftReplacementRef.current = draftReplacement.completePendingDraftReplacement;

  const rescheduleMessage = useWorkspaceRescheduleMessage({
    chats,
    upcoming,
    rescheduleSource: rescheduling.rescheduleSource,
    setRescheduleSource: rescheduling.setRescheduleSource,
    rescheduleSourceRef: rescheduling.rescheduleSourceRef,
    setSelectedChat,
    attachmentSelectionGenerationRef: document.attachmentSelectionGenerationRef,
    focusRescheduledEditorAtEndRef: refs.focusRescheduledEditorAtEndRef,
    setDraftBody: document.setDraftBody,
    setDraftEntities: document.setDraftEntities,
    replaceAttachments: document.replaceAttachments,
    setDate,
    setTime,
    setFollowCurrentTime: schedule.setFollowCurrentTime,
    setRepeatMode: schedule.setRepeatMode,
    setRepeatDays: schedule.setRepeatDays,
    setRepeatOccurrences: schedule.setRepeatOccurrences,
    setScheduleSelectionConfirmed: schedule.setScheduleSelectionConfirmed,
    setPublishAction: publishing.setPublishAction,
    changeStageMode: stage.changeStageMode,
  });
  useWorkspaceHistoryRegistrations({
    onRegisterHistoryDraftOpener: page.onRegisterHistoryDraftOpener,
    onRegisterHistoryDraftUseHandler: page.onRegisterHistoryDraftUseHandler,
    onRegisterHistoryDraftClearHandler: page.onRegisterHistoryDraftClearHandler,
    onRegisterHistoryDraftDeleteHandler: page.onRegisterHistoryDraftDeleteHandler,
    onRegisterHistoryRescheduleHandler: page.onRegisterHistoryRescheduleHandler,
  }, {
    openDraft: drafts.openDraftEditor,
    useDraft: draftReplacement.useDraftInComposer,
    clearDrafts: drafts.clearHistoryDrafts,
    deleteDraft: drafts.deleteHistoryDraft,
    reschedule: rescheduleMessage,
  });

  useWorkspacePlannerText({
    attachments: document.attachments,
    replaceAttachments: document.replaceAttachments,
    attachmentSelectionGenerationRef: document.attachmentSelectionGenerationRef,
    bodyInputRef: refs.bodyInputRef,
    focusPlannerEditorAtEndRef: refs.focusPlannerEditorAtEndRef,
    plannerRestoreRef: rescheduling.plannerRestoreRef,
    restorePlannerDocumentRef: refs.restorePlannerDocumentRef,
    draftBody: document.draftBody,
    draftEntities: document.draftEntities,
    draftColor: controls.drafts.draftColor,
    draftEditingId: drafts.draftEditingId,
    draftStateHydrated: drafts.draftStateHydrated,
    draftStoreReady: drafts.draftStoreReady,
    workspaceDocumentId: document.workspaceDocumentId,
    setWorkspaceDocumentId: document.setWorkspaceDocumentId,
    selectedChat,
    chats,
    date,
    time,
    repeatMode: schedule.repeatMode,
    repeatDays: schedule.repeatDays,
    repeatOccurrences: schedule.repeatOccurrences,
    setDraftBody: document.setDraftBody,
    setDraftEntities: document.setDraftEntities,
    setMessageEffectId: document.setMessageEffectId,
    setSelectedChat,
    setDate,
    setTime,
    setFollowCurrentTime: schedule.setFollowCurrentTime,
    setRepeatMode: schedule.setRepeatMode,
    setRepeatDays: schedule.setRepeatDays,
    setRepeatOccurrences: schedule.setRepeatOccurrences,
    setRescheduleSource: rescheduling.setRescheduleSource,
    rescheduleSourceRef: rescheduling.rescheduleSourceRef,
    setScheduleSelectionConfirmed: schedule.setScheduleSelectionConfirmed,
    setPublishAction: publishing.setPublishAction,
    setStageMode: stage.setStageMode,
    createWorkspaceDraftSnapshot: drafts.createWorkspaceDraftSnapshot,
    recordWorkspaceVersion: drafts.recordWorkspaceVersion,
    persistDraftStore: drafts.persistDraftStore,
    savedDraftsRef: drafts.savedDraftsRef,
    cancelPendingAutosave: drafts.cancelPendingAutosave,
    showFeedback,
    onRegisterPlannerTextOpener: page.onRegisterPlannerTextOpener,
  });

  const versionHistory = useWorkspaceVersionHistory({
    documentHistories: drafts.documentHistories,
    workspaceDocumentId: document.workspaceDocumentId,
    setWorkspaceDocumentId: document.setWorkspaceDocumentId,
    createWorkspaceDraftSnapshot: drafts.createWorkspaceDraftSnapshot,
    prepareWorkspaceVersionSnapshot: drafts.prepareWorkspaceVersionSnapshot,
    recordWorkspaceVersion: drafts.recordWorkspaceVersion,
    persistDraftStore: drafts.persistDraftStore,
    savedDraftsRef: drafts.savedDraftsRef,
    draftStoreError: drafts.draftStoreError,
    confirm,
    bodyInputRef: refs.bodyInputRef,
    focusPlannerEditorAtEndRef: refs.focusPlannerEditorAtEndRef,
    replaceAttachments: document.replaceAttachments,
    setDraftBody: document.setDraftBody,
    setDraftEntities: document.setDraftEntities,
    setSelectedChat,
    setDate,
    setTime,
    setFollowCurrentTime: schedule.setFollowCurrentTime,
    setRepeatMode: schedule.setRepeatMode,
    setRepeatDays: schedule.setRepeatDays,
    setRepeatOccurrences: schedule.setRepeatOccurrences,
    setRescheduleSource: rescheduling.setRescheduleSource,
    rescheduleSourceRef: rescheduling.rescheduleSourceRef,
    setScheduleSelectionConfirmed: schedule.setScheduleSelectionConfirmed,
    setPublishAction: publishing.setPublishAction,
    setStageMode: stage.setStageMode,
    showFeedback,
  });

  return {
    draftReplacement,
    rescheduleMessage,
    versionHistory,
  };
}
