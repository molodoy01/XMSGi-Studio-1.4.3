import type { Chat, RichTextEntity, ScheduledMessage } from '@/types';
import type { StudioPlannerTextPayload } from '@shared/bridge';
import type { PlannerDraftRecoverySnapshot } from '@/lib/plannerDraft';
import { CalendarDays, FileText, Send } from 'lucide-react';

export const actionModes = [
  { mode: 'Send now', labelKey: 'quickplanner.mode.send', icon: Send },
  { mode: 'Schedule', labelKey: 'quickplanner.mode.schedule', icon: CalendarDays },
  { mode: 'Draft', labelKey: 'quickplanner.mode.draft', icon: FileText },
] as const;

export type QuickPlannerActionFeedback = {
  message: string;
  tone: 'error' | 'warning' | 'success' | 'info';
  instance?: number;
  actions?: Array<{
    id: 'retry' | 'dismiss';
    label: string;
    onClick: () => void;
  }>;
};

export type PlannerAttachment = {
  name: string;
  path: string;
};

export type ChatPickerOption = {
  id: string;
  name: string;
  type: string;
  avatarDataUrl?: string;
  sourceChat?: Chat;
};

export type QuickPlannerProps = {
  draftLoadRequest?: {
    revision: number;
    text: string;
    attachments: string[];
    entities: RichTextEntity[];
    selectedChat?: Chat | null;
    effect?: string | null;
    mode?: string;
    date?: string;
    time?: string;
    scheduleTimeTouched?: boolean;
    clearDraft?: boolean;
    restoreDraft: {
      text: string;
      attachments: string[];
      entities: RichTextEntity[];
    } | null;
    restoreDrafts?: PlannerDraftRecoverySnapshot[];
    rescheduleMessage?: ScheduledMessage;
    savedDraftSource?: { kind: 'planner' | 'studio'; id: string };
  } | null;
  onRestoreDraft?: (
    draft: PlannerDraftRecoverySnapshot | null,
    remainingDrafts?: PlannerDraftRecoverySnapshot[],
  ) => void;
  onDraftLoadAccepted?: (draft: PlannerDraftRecoverySnapshot) => void;
  chats?: Chat[];
  selectedChat?: Chat | null;
  upcoming?: ScheduledMessage[];
  sent?: ScheduledMessage[];
  historyReady?: boolean;
  historyError?: boolean;
  onSelectChat?: (chat: Chat | null) => void;
  onRemoveChat?: (chat: Chat) => void;
  onOpenInStudio?: (payload: StudioPlannerTextPayload) => Promise<boolean>;
  onSendNow?: (chat: Chat, message: string, attachments?: string[], effect?: string, entities?: RichTextEntity[]) => Promise<boolean | 'sent-history-failed'>;
  onSchedule?: (request: {
    chatId: string;
    message: string;
    date: string;
    time: string;
    attachments?: string[];
    effect?: string;
    entities?: RichTextEntity[];
    silent?: boolean;
    replaceMessage?: ScheduledMessage;
  }) => Promise<boolean | 'sent-history-failed'>;
  onSaveDraft?: (draft: { message: string; attachments: string[]; entities: RichTextEntity[]; selectedChat: Chat | null }) => boolean;
  feedbackPreview?: QuickPlannerActionFeedback | null;
  connectionRecoveryStatus?: 'reconnecting' | 'offline' | 'restored' | null;
  connectionRecoveryNoticeStatus?: 'reconnecting' | 'offline' | 'restored' | null;
};

export function getChatInitial(name: string) {
  return name.trim().charAt(0).toLocaleUpperCase();
}

export function getAttachmentName(path: string) {
  return path.split(/[\\/]/).filter(Boolean).pop() ?? path;
}

export function retainUnchangedRichTextEntities(previousText: string, nextText: string, entities: RichTextEntity[]) {
  let prefixLength = 0;
  while (prefixLength < previousText.length
    && prefixLength < nextText.length
    && previousText[prefixLength] === nextText[prefixLength]) {
    prefixLength += 1;
  }

  let suffixLength = 0;
  while (suffixLength < previousText.length - prefixLength
    && suffixLength < nextText.length - prefixLength
    && previousText[previousText.length - suffixLength - 1] === nextText[nextText.length - suffixLength - 1]) {
    suffixLength += 1;
  }

  const changedEnd = previousText.length - suffixLength;
  const offsetDelta = nextText.length - previousText.length;
  return entities.flatMap((entity) => {
    const entityEnd = entity.offset + entity.length;
    if (entityEnd <= prefixLength) return [entity];
    if (entity.offset >= changedEnd) return [{ ...entity, offset: entity.offset + offsetDelta }];
    return [];
  });
}

export function isFileDrag(dataTransfer: DataTransfer) {
  return Array.from(dataTransfer.types).includes('Files') || dataTransfer.files.length > 0;
}

export const scheduleTimeOptions = Array.from({ length: 96 }, (_, index) => (
  `${String(Math.floor(index / 4)).padStart(2, '0')}:${String((index % 4) * 15).padStart(2, '0')}`
));

export const feedbackDurationMs = {
  error: 8000,
  warning: 5000,
  success: 3360,
  info: 3360,
} as const;

export const restoredDraftFeedbackDurationMs = feedbackDurationMs.success + 1000;

export function toDateInputValue(date: Date) {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function formatDateLabel(value: string, locale: 'en' | 'ru') {
  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) return value;
  const date = new Date(year, month - 1, day);
  const label = new Intl.DateTimeFormat(locale === 'ru' ? 'ru-RU' : 'en-US', { month: 'short', day: 'numeric' }).format(date);
  return year === new Date().getFullYear()
    ? label
    : new Intl.DateTimeFormat(locale === 'ru' ? 'ru-RU' : 'en-US', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit',
    }).format(date);
}

export function formatTimeValue(date: Date) {
  return new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(date);
}

export function parseScheduleTime(value: string) {
  const match = value.trim().match(/^(\d{1,2})[:.](\d{1,2})$/)
    ?? value.trim().replace(/\D/g, '').match(/^(\d{2})(\d{2})$/);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

export function toLocalDateTime(dateValue: string, timeValue: string) {
  const [year, month, day] = dateValue.split('-').map(Number);
  const [hours, minutes] = timeValue.split(':').map(Number);
  return new Date(year, month - 1, day, hours, minutes);
}

export function formatTimeZoneOffset(date: Date) {
  const offsetMinutes = -date.getTimezoneOffset();
  const sign = offsetMinutes >= 0 ? '+' : '-';
  const absoluteOffset = Math.abs(offsetMinutes);
  const hours = Math.floor(absoluteOffset / 60);
  const minutes = absoluteOffset % 60;
  return `GMT${sign}${hours}${minutes ? `:${String(minutes).padStart(2, '0')}` : ''}`;
}

export function getNextScheduleDateTime(now: Date) {
  const nextAvailable = new Date(now);
  nextAvailable.setMinutes(nextAvailable.getMinutes() + 1, 0, 0);
  return {
    date: toDateInputValue(nextAvailable),
    time: formatTimeValue(nextAvailable),
  };
}

export function getUpcomingMessages(messages: ScheduledMessage[], now: Date) {
  return messages
    .filter((message) => {
      if (message.status !== 'scheduled') return false;
      const timestamp = Date.parse(message.when);
      return Number.isFinite(timestamp) && timestamp > now.getTime();
    })
    .sort((left, right) => Date.parse(left.when) - Date.parse(right.when))
    .slice(0, 5);
}
