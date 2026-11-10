import { useRef } from 'react';
import type { WorkspacePageEffectsOptions } from './useWorkspacePageEffects';
import { useWorkspaceEditorEscapeNavigation } from './useWorkspaceEditorEscapeNavigation';
import { useWorkspacePublishMenuDismiss } from './useWorkspacePublishMenuDismiss';
import { useWorkspacePublishSuccess } from './useWorkspacePublishSuccess';
import { useWorkspaceSaveBeforeLeave } from './useWorkspaceSaveBeforeLeave';
import { useWorkspaceScheduleSubmission } from './useWorkspaceScheduleSubmission';

type Options = Pick<WorkspacePageEffectsOptions,
  | 'lastAction'
  | 'scheduling'
  | 'stageMode'
  | 'setStageMode'
  | 'scheduleSubmissionPendingRef'
  | 'scheduleSubmissionStartedRef'
  | 'setRepeatMode'
  | 'setRepeatDays'
  | 'setRepeatOccurrences'
  | 'setScheduleFocus'
  | 'flushWorkspaceDraftNow'
  | 'showFeedback'
  | 'fallbackError'
  | 'onRegisterBeforeLeaveStudio'
  | 'publishMenuOpen'
  | 'setPublishMenuOpen'
  | 'publishMenuRef'
  | 'publishMenuToggleRef'
  | 'chatListOpen'
  | 'setChatListOpen'
  | 'successPulse'
  | 'suppressDraftReplacementSuccessClearRef'
  | 'pendingDraftReplacementRef'
  | 'completeDraftReplacementRef'
  | 'createWorkspaceDraftSnapshot'
  | 'attachmentSelectionGenerationRef'
  | 'recordWorkspaceVersionRef'
  | 'plannerRestoreRef'
  | 'restorePlannerDocumentRef'
  | 'attachmentPreviewUrlsRef'
  | 'bodyInputRef'
  | 'setDraftBody'
  | 'setDraftEntities'
  | 'replaceAttachments'
  | 'setWorkspaceDocumentId'
  | 'newDocumentId'
  | 'historyCouldNotSaveMessage'
>;

export function useWorkspacePublishLifecycleEffects(options: Options) {
  const createWorkspaceDraftSnapshotRef = useRef(options.createWorkspaceDraftSnapshot);
  createWorkspaceDraftSnapshotRef.current = options.createWorkspaceDraftSnapshot;

  useWorkspaceScheduleSubmission({
    lastAction: options.lastAction,
    scheduling: options.scheduling,
    stageMode: options.stageMode,
    scheduleSubmissionPendingRef: options.scheduleSubmissionPendingRef,
    scheduleSubmissionStartedRef: options.scheduleSubmissionStartedRef,
    setRepeatMode: options.setRepeatMode,
    setRepeatDays: options.setRepeatDays,
    setRepeatOccurrences: options.setRepeatOccurrences,
    setScheduleFocus: options.setScheduleFocus,
    setStageMode: options.setStageMode,
  });
  useWorkspaceSaveBeforeLeave({
    flushWorkspaceDraftNow: options.flushWorkspaceDraftNow,
    showFeedback: options.showFeedback,
    fallbackError: options.fallbackError,
    onRegisterBeforeLeaveStudio: options.onRegisterBeforeLeaveStudio,
  });
  useWorkspacePublishMenuDismiss({
    open: options.publishMenuOpen,
    setOpen: options.setPublishMenuOpen,
    menuRef: options.publishMenuRef,
    toggleRef: options.publishMenuToggleRef,
  });
  useWorkspaceEditorEscapeNavigation({
    stageMode: options.stageMode,
    publishMenuOpen: options.publishMenuOpen,
    chatListOpen: options.chatListOpen,
    setChatListOpen: options.setChatListOpen,
  });
  useWorkspacePublishSuccess({
    successPulse: options.successPulse,
    suppressDraftReplacementSuccessClearRef: options.suppressDraftReplacementSuccessClearRef,
    pendingDraftReplacementRef: options.pendingDraftReplacementRef,
    completeDraftReplacementRef: options.completeDraftReplacementRef,
    createWorkspaceDraftSnapshotRef,
    attachmentSelectionGenerationRef: options.attachmentSelectionGenerationRef,
    recordWorkspaceVersionRef: options.recordWorkspaceVersionRef,
    plannerRestoreRef: options.plannerRestoreRef,
    attachmentPreviewUrlsRef: options.attachmentPreviewUrlsRef,
    restorePlannerDocumentRef: options.restorePlannerDocumentRef,
    bodyInputRef: options.bodyInputRef,
    setDraftBody: options.setDraftBody,
    setDraftEntities: options.setDraftEntities,
    replaceAttachments: options.replaceAttachments,
    setWorkspaceDocumentId: options.setWorkspaceDocumentId,
    newDocumentId: options.newDocumentId,
    showFeedback: options.showFeedback,
    historyCouldNotSaveMessage: options.historyCouldNotSaveMessage,
  });
}
