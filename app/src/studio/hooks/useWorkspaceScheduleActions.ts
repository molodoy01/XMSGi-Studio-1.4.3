import type { MutableRefObject, Dispatch, SetStateAction } from 'react';
import type { WorkspacePageProps } from '../pages/workspacePageTypes';
import { getAttachmentTransportGroups, type WorkspaceAttachment } from '../lib/workspaceAttachments';
import type { ScheduleRepeatOptions } from '../lib/scheduling';
import type { Chat, RichTextEntity, ScheduledMessage } from '../types';
import type { PublishAction } from '../components/WorkspacePageActionRows';

type WorkspaceScheduleActionsOptions = {
  stageMode: string;
  scheduleFocus: 'repeat' | 'time' | null;
  setScheduleFocus: Dispatch<SetStateAction<'repeat' | 'time' | null>>;
  setScheduleSelectionConfirmed: Dispatch<SetStateAction<boolean>>;
  setPublishAction: Dispatch<SetStateAction<PublishAction>>;
  setPublishMenuOpen: Dispatch<SetStateAction<boolean>>;
  changeStageMode: (mode: 'editor' | 'schedule') => void;
  workspaceRef: MutableRefObject<HTMLDivElement | null>;
  selectedChat: Chat | null;
  canSchedule: boolean;
  attachments: WorkspaceAttachment[];
  draftBody: string;
  date: string;
  time: string;
  repeatMode: ScheduleRepeatOptions['mode'];
  repeatDays: string[];
  repeatOccurrences: number;
  draftEntities: RichTextEntity[];
  messageEffectId: string | null;
  rescheduleSource: ScheduledMessage | null;
  scheduleSubmissionPendingRef: MutableRefObject<boolean>;
  scheduleSubmissionStartedRef: MutableRefObject<boolean>;
  handleSchedule: WorkspacePageProps['handleSchedule'];
};

export function useWorkspaceScheduleActions({
  stageMode,
  scheduleFocus,
  setScheduleFocus,
  setScheduleSelectionConfirmed,
  setPublishAction,
  setPublishMenuOpen,
  changeStageMode,
  workspaceRef,
  selectedChat,
  canSchedule,
  attachments,
  draftBody,
  date,
  time,
  repeatMode,
  repeatDays,
  repeatOccurrences,
  draftEntities,
  messageEffectId,
  rescheduleSource,
  scheduleSubmissionPendingRef,
  scheduleSubmissionStartedRef,
  handleSchedule,
}: WorkspaceScheduleActionsOptions) {
  const openScheduleStage = (focus: 'repeat' | 'time' | null = null) => {
    const isSameFocusOpen = stageMode === 'schedule' && scheduleFocus === focus;

    setScheduleSelectionConfirmed(false);
    setPublishAction('schedule');
    setPublishMenuOpen(false);

    if (isSameFocusOpen) {
      setScheduleFocus(null);
      changeStageMode('editor');
      return;
    }

    const workspaceMain = workspaceRef.current?.querySelector<HTMLElement>('.workspace-page-main');
    if (workspaceMain) workspaceMain.scrollTop = 0;

    setScheduleFocus(focus);
    changeStageMode('schedule');
  };

  const scheduleDraft = () => {
    if (!selectedChat || !canSchedule) return;

    setScheduleSelectionConfirmed(false);
    scheduleSubmissionPendingRef.current = true;
    scheduleSubmissionStartedRef.current = false;
    handleSchedule({
      chatId: selectedChat.id,
      message: draftBody,
      date,
      time,
      attachments: attachments.map((attachment) => attachment.path || attachment.previewUrl || attachment.name).filter(Boolean),
      attachmentGroups: getAttachmentTransportGroups(attachments),
      entities: draftEntities,
      effect: messageEffectId ?? undefined,
      ...(rescheduleSource ? { replaceMessage: rescheduleSource } : {}),
    }, {
      mode: repeatMode,
      days: repeatDays,
      occurrences: repeatOccurrences,
    });
  };

  return { openScheduleStage, scheduleDraft };
}
