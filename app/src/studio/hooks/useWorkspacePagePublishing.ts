import { useWorkspaceEmptyMessageFocus } from './useWorkspaceEmptyMessageFocus';
import { useWorkspacePublishActionHandlers } from './useWorkspacePublishActionHandlers';
import { useWorkspacePublishExecution } from './useWorkspacePublishExecution';
import { useWorkspacePublishPresentation } from './useWorkspacePublishPresentation';
import { useWorkspacePublishValidation } from './useWorkspacePublishValidation';
import { useWorkspaceScheduleActions } from './useWorkspaceScheduleActions';

type PublishExecution = ReturnType<typeof useWorkspacePublishExecution>;
type PublishActionInputs = Parameters<typeof useWorkspacePublishActionHandlers>[0];
type PublishScheduleInputs = Parameters<typeof useWorkspaceScheduleActions>[0];
type PublishValidationInputs = Parameters<typeof useWorkspacePublishValidation>[0];
type PublishPresentationInputs = Parameters<typeof useWorkspacePublishPresentation>[0];

type Options = {
  execution: {
    controller: PublishExecution;
    actions: Omit<
      Parameters<PublishExecution['createActions']>[0],
      'hasDraftContentState' | 'canSendNow'
    >;
  };
  validation: Omit<PublishValidationInputs, 'savingCurrentDraft' | 'sendInFlight'>;
  presentation: Omit<
    PublishPresentationInputs,
    'sendInFlight' | 'publishScheduleSummary'
  >;
  schedule: Omit<PublishScheduleInputs, 'canSchedule'>;
  emptyMessageFocus: Parameters<typeof useWorkspaceEmptyMessageFocus>[0];
  actions: Omit<
    PublishActionInputs,
    | 'hasDraftContentState'
    | 'hasSelectedTarget'
    | 'canSchedule'
    | 'hasValidScheduleDate'
    | 'hasValidScheduleTime'
    | 'hasValidRepeatConfig'
    | 'hasFutureSchedule'
    | 'publishActionBlocker'
    | 'canSaveDraft'
    | 'canSendNow'
    | 'restoreEditorFocusForEmptyMessageWarning'
    | 'openScheduleStage'
    | 'scheduleDraft'
    | 'saveCurrentDraft'
    | 'sendDraftNow'
  >;
};

export function useWorkspacePagePublishing({
  execution,
  validation: validationInputs,
  presentation: presentationInputs,
  schedule: scheduleInputs,
  emptyMessageFocus: emptyMessageFocusInputs,
  actions: actionInputs,
}: Options) {
  const { sendInFlight, savingCurrentDraft } = execution.controller;
  const validation = useWorkspacePublishValidation({
    ...validationInputs,
    savingCurrentDraft,
    sendInFlight,
  });
  const presentation = useWorkspacePublishPresentation({
    ...presentationInputs,
    sendInFlight,
    publishScheduleSummary: validation.publishScheduleSummary,
  });
  const { sendDraftNow, saveCurrentDraft } = execution.controller.createActions({
    ...execution.actions,
    hasDraftContentState: validation.hasDraftContentState,
    canSendNow: validation.canSendNow,
  });
  const { openScheduleStage, scheduleDraft } = useWorkspaceScheduleActions({
    ...scheduleInputs,
    canSchedule: validation.canSchedule,
  });
  const restoreEditorFocusForEmptyMessageWarning = useWorkspaceEmptyMessageFocus(
    emptyMessageFocusInputs,
  );
  const publishActionHandlers = useWorkspacePublishActionHandlers({
    ...actionInputs,
    ...validation,
    restoreEditorFocusForEmptyMessageWarning,
    openScheduleStage,
    scheduleDraft,
    saveCurrentDraft,
    sendDraftNow,
  });

  return {
    ...validation,
    ...presentation,
    sendInFlight,
    savingCurrentDraft,
    openScheduleStage,
    scheduleDraft,
    restoreEditorFocusForEmptyMessageWarning,
    sendDraftNow,
    saveCurrentDraft,
    ...publishActionHandlers,
  };
}
