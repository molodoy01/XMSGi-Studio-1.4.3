import type { Dispatch, SetStateAction } from 'react';
import type { ScheduledMessage } from '../types';
import type { PublishAction } from '../components/WorkspacePageActionRows';

type UseWorkspacePublishActionHandlersOptions = {
  publishAction: PublishAction;
  setPublishAction: Dispatch<SetStateAction<PublishAction>>;
  setScheduleSelectionConfirmed: Dispatch<SetStateAction<boolean>>;
  setRescheduleSource: Dispatch<SetStateAction<ScheduledMessage | null>>;
  rescheduleSourceRef: { current: ScheduledMessage | null };
  clearScheduleFocus: () => void;
  setPublishMenuOpen: Dispatch<SetStateAction<boolean>>;
  clearPublishFeedbackMessage: () => void;
  stageMode: 'editor' | 'schedule' | 'template' | 'draft' | 'chat';
  changeStageMode: (mode: 'editor' | 'schedule' | 'template' | 'draft' | 'chat') => void;
  hasDraftContentState: boolean;
  hasSelectedTarget: boolean;
  canSchedule: boolean;
  hasValidScheduleDate: boolean;
  hasValidScheduleTime: boolean;
  hasValidRepeatConfig: boolean;
  hasFutureSchedule: boolean;
  scheduleSelectionConfirmed: boolean;
  publishActionBlocker: string;
  enterMessageMessage: string;
  selectChatMessage: string;
  futureDateTimeMessage: string;
  canSaveDraft: boolean;
  canSendNow: boolean;
  showFeedback: (message: string) => void;
  restoreEditorFocusForEmptyMessageWarning: () => void;
  openScheduleStage: () => void;
  scheduleDraft: () => void;
  saveCurrentDraft: () => void;
  sendDraftNow: () => Promise<unknown>;
};

export function useWorkspacePublishActionHandlers({
  publishAction,
  setPublishAction,
  setScheduleSelectionConfirmed,
  setRescheduleSource,
  rescheduleSourceRef,
  clearScheduleFocus,
  setPublishMenuOpen,
  clearPublishFeedbackMessage,
  stageMode,
  changeStageMode,
  hasDraftContentState,
  hasSelectedTarget,
  canSchedule,
  hasValidScheduleDate,
  hasValidScheduleTime,
  hasValidRepeatConfig,
  hasFutureSchedule,
  scheduleSelectionConfirmed,
  publishActionBlocker,
  enterMessageMessage,
  selectChatMessage,
  futureDateTimeMessage,
  canSaveDraft,
  canSendNow,
  showFeedback,
  restoreEditorFocusForEmptyMessageWarning,
  openScheduleStage,
  scheduleDraft,
  saveCurrentDraft,
  sendDraftNow,
}: UseWorkspacePublishActionHandlersOptions) {
  const choosePublishAction = (action: PublishAction) => {
    setPublishAction(action);
    setScheduleSelectionConfirmed(false);
    if (action !== 'schedule') {
      rescheduleSourceRef.current = null;
      setRescheduleSource(null);
    }
    setPublishMenuOpen(false);
    clearPublishFeedbackMessage();
    if (action !== 'schedule' && stageMode === 'schedule') {
      clearScheduleFocus();
      changeStageMode('editor');
    }
  };

  const handlePrimaryPublish = () => {
    if (publishAction === 'schedule') {
      if (!hasDraftContentState) {
        showFeedback(enterMessageMessage);
        restoreEditorFocusForEmptyMessageWarning();
        return;
      }
      if (!hasSelectedTarget) {
        showFeedback(selectChatMessage);
        return;
      }
      if (!canSchedule) {
        if (stageMode !== 'schedule') openScheduleStage();
        if (hasDraftContentState && hasSelectedTarget && hasValidScheduleDate
          && hasValidScheduleTime && hasValidRepeatConfig && !hasFutureSchedule) {
          showFeedback(futureDateTimeMessage);
        }
        return;
      }
      if (stageMode === 'schedule') scheduleDraft();
      else if (scheduleSelectionConfirmed) scheduleDraft();
      else openScheduleStage();
      return;
    }

    if (publishActionBlocker) {
      showFeedback(publishActionBlocker);
      if (publishActionBlocker === enterMessageMessage) restoreEditorFocusForEmptyMessageWarning();
      return;
    }
    if (publishAction === 'draft') {
      if (canSaveDraft) saveCurrentDraft();
      return;
    }
    if (canSendNow) void sendDraftNow();
  };

  return { choosePublishAction, handlePrimaryPublish };
}
