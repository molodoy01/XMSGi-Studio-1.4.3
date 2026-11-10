import { useEffect, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import type { Chat, RichTextEntity, ScheduledMessage } from '../types';
import type { WorkspaceAttachment } from '../lib/workspaceAttachments';
import type { WorkspaceStageMode } from './useWorkspaceStageMode';
import { normalizeAttachments } from '../lib/draftAttachments';
import type { ScheduleRepeatMode } from '../lib/scheduling';

type WorkspaceRescheduleMessageOptions = {
  chats: Chat[];
  upcoming: ScheduledMessage[];
  rescheduleSource: ScheduledMessage | null;
  setRescheduleSource: Dispatch<SetStateAction<ScheduledMessage | null>>;
  rescheduleSourceRef: MutableRefObject<ScheduledMessage | null>;
  setSelectedChat: Dispatch<SetStateAction<Chat | null>>;
  attachmentSelectionGenerationRef: MutableRefObject<number>;
  focusRescheduledEditorAtEndRef: MutableRefObject<boolean>;
  setDraftBody: Dispatch<SetStateAction<string>>;
  setDraftEntities: Dispatch<SetStateAction<RichTextEntity[]>>;
  replaceAttachments: (attachments: WorkspaceAttachment[]) => void;
  setDate: Dispatch<SetStateAction<string>>;
  setTime: Dispatch<SetStateAction<string>>;
  setFollowCurrentTime: Dispatch<SetStateAction<boolean>>;
  setRepeatMode: Dispatch<SetStateAction<ScheduleRepeatMode>>;
  setRepeatDays: Dispatch<SetStateAction<string[]>>;
  setRepeatOccurrences: Dispatch<SetStateAction<number>>;
  setScheduleSelectionConfirmed: Dispatch<SetStateAction<boolean>>;
  setPublishAction: Dispatch<SetStateAction<'send' | 'schedule' | 'draft'>>;
  changeStageMode: (mode: WorkspaceStageMode) => void;
};

export function useWorkspaceRescheduleMessage({
  chats,
  upcoming,
  rescheduleSource,
  setRescheduleSource,
  rescheduleSourceRef,
  setSelectedChat,
  attachmentSelectionGenerationRef,
  focusRescheduledEditorAtEndRef,
  setDraftBody,
  setDraftEntities,
  replaceAttachments,
  setDate,
  setTime,
  setFollowCurrentTime,
  setRepeatMode,
  setRepeatDays,
  setRepeatOccurrences,
  setScheduleSelectionConfirmed,
  setPublishAction,
  changeStageMode,
}: WorkspaceRescheduleMessageOptions) {
  useEffect(() => {
    if (!rescheduleSource) return;
    const original = upcoming.find((message) => message.id === rescheduleSource.id);
    if (!original || original.status === 'failed') {
      rescheduleSourceRef.current = null;
      setRescheduleSource(null);
    }
  }, [rescheduleSource, upcoming, rescheduleSourceRef, setRescheduleSource]);

  return (message: ScheduledMessage) => {
    const chat = chats.find((item) => item.id === message.chatId);
    const scheduledAt = new Date(message.when);
    if (!chat || Number.isNaN(scheduledAt.getTime())) return;

    const nextDate = `${scheduledAt.getFullYear()}-${String(scheduledAt.getMonth() + 1).padStart(2, '0')}-${String(scheduledAt.getDate()).padStart(2, '0')}`;
    const nextTime = `${String(scheduledAt.getHours()).padStart(2, '0')}:${String(scheduledAt.getMinutes()).padStart(2, '0')}`;
    setSelectedChat(chat);
    attachmentSelectionGenerationRef.current += 1;
    rescheduleSourceRef.current = message;
    setRescheduleSource(message);
    focusRescheduledEditorAtEndRef.current = true;
    setScheduleSelectionConfirmed(false);
    setPublishAction('schedule');
    setDraftBody(message.text);
    setDraftEntities(message.entities ?? []);
    replaceAttachments(normalizeAttachments(message.attachments ?? []));
    setDate(nextDate);
    setTime(nextTime);
    setFollowCurrentTime(false);
    setRepeatMode('none');
    setRepeatDays([]);
    setRepeatOccurrences(1);
    // Keep the original scheduled post intact until the user explicitly saves a replacement.
    // The editor must remain active so the user can continue editing and the schedule fields stay populated.
    changeStageMode('editor');
  };
}
