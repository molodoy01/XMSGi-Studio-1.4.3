import type { Chat, NotificationType, RichTextEntity, ScheduledMessage } from '@/types';
import type { TranslationKey } from '@/lib/i18n';
import {
  getScheduleOccurrences,
  MAX_SCHEDULE_OCCURRENCES,
  type ScheduleRepeatOptions,
} from '@/lib/scheduling';
import { getMessageMaxLength } from '@/lib/messageLimits';
import { getCurrentTimeStr, getTodayStr } from '@/lib/utils';
import { createBridgeValidationError } from '@shared/bridge';
import type { UseSchedulerOptions } from './useSchedulerUtils';
import { MAX_SCHEDULE_FUTURE_DAYS } from './useSchedulerUtils';

export type ScheduleRequest = {
  chatId: string;
  message: string;
  date: string;
  time: string;
  attachments?: string[];
  attachmentGroups?: string[][];
  entities?: RichTextEntity[];
  silent?: boolean;
  effect?: string;
  clearMessageOnSuccess?: boolean;
  waitForConfirmation?: boolean;
  replaceMessage?: ScheduledMessage;
};

type ScheduleRequestContext = {
  chats: Chat[];
  selectedChat: Chat | null;
  message: string;
  date: string;
  time: string;
  composerAttachments: string[];
  composerEntities: RichTextEntity[];
  repeatOptions: ScheduleRepeatOptions;
  t: (key: TranslationKey, params?: Record<string, string | number>) => string;
  showValidationNotification: (message: string, type: NotificationType, title: string, code: string) => void;
  showNotification: UseSchedulerOptions['showNotification'];
};

type PreparedScheduleRequest = {
  chat: Chat;
  text: string;
  date: string;
  time: string;
  attachments: string[];
  attachmentGroups: string[][];
  entities: RichTextEntity[];
  silent: boolean;
  effect?: string;
  replaceMessage?: ScheduledMessage;
  whenDate: Date;
  occurrenceDates: Date[];
};

type PrepareScheduleResult =
  | { kind: 'invalid' }
  | { kind: 'send-now'; chat: Chat; text: string; attachments: string[]; attachmentGroups: string[][]; entities: RichTextEntity[]; silent: boolean; effect?: string }
  | { kind: 'schedule'; request: PreparedScheduleRequest };

export function prepareScheduleRequest(
  scheduleRequest: ScheduleRequest | undefined,
  context: ScheduleRequestContext,
): PrepareScheduleResult {
  const {
    chats,
    selectedChat,
    message,
    date,
    time,
    composerAttachments,
    composerEntities,
    repeatOptions,
    t,
    showValidationNotification,
    showNotification,
  } = context;
  const scheduleChat = scheduleRequest
    ? chats.find((chat) => chat.id === scheduleRequest.chatId) || null
    : selectedChat;
  const scheduleMessage = scheduleRequest?.message ?? message;
  const scheduleDate = scheduleRequest?.date ?? date;
  const scheduleTime = scheduleRequest?.time ?? time;
  const replaceMessage = scheduleRequest?.replaceMessage;
  const scheduleAttachments = scheduleRequest
    ? scheduleRequest.attachments ?? []
    : composerAttachments;
  const suppliedScheduleGroups = scheduleRequest?.attachmentGroups?.filter((group) => group.length > 0) ?? [];
  const scheduleGroups = suppliedScheduleGroups.length > 0
    ? suppliedScheduleGroups
    : scheduleAttachments.length > 0 ? [scheduleAttachments] : [[]];
  const scheduleEntities = scheduleRequest
    ? scheduleRequest.entities ?? []
    : composerEntities;

  if (!scheduleChat) {
    showValidationNotification(
      t('schedule.selectChat'),
      'warning',
      t('schedule.noChatTitle'),
      'CHAT_REQUIRED',
    );
    return { kind: 'invalid' };
  }

  if (replaceMessage && (replaceMessage.telegramMessageId === undefined || replaceMessage.telegramMessageId === null)) {
    const errorDetails = createBridgeValidationError(t('schedule.telegramIdMissing'), 'TELEGRAM_SCHEDULE_ID_MISSING');
    showNotification(errorDetails.message, 'error', t('schedule.cannotUnschedule'), errorDetails);
    return { kind: 'invalid' };
  }

  if (!scheduleMessage.trim() && scheduleAttachments.length === 0) {
    showValidationNotification(
      t('schedule.emptyMessage'),
      'warning',
      t('schedule.emptyMessageTitle'),
      'MESSAGE_REQUIRED',
    );
    return { kind: 'invalid' };
  }

  const messageLimit = getMessageMaxLength(scheduleAttachments.length > 0);
  if (scheduleMessage.length > messageLimit) {
    showValidationNotification(
      t('composer.messageExceedsLimit', { limit: messageLimit }),
      'warning',
      t('composer.messageTooLongTitle'),
      'MESSAGE_TOO_LONG',
    );
    return { kind: 'invalid' };
  }

  if (!scheduleDate || !scheduleTime) {
    showValidationNotification(
      t('schedule.setDateTime'),
      'warning',
      t('schedule.missingDateTitle'),
      'SCHEDULE_DATETIME_REQUIRED',
    );
    return { kind: 'invalid' };
  }

  const whenDate = new Date(`${scheduleDate}T${scheduleTime}`);

  if (Number.isNaN(whenDate.getTime())) {
    showValidationNotification(
      t('schedule.invalidDateTime'),
      'error',
      t('schedule.invalidDateTitle'),
      'SCHEDULE_DATETIME_INVALID',
    );
    return { kind: 'invalid' };
  }

  const scheduleNow = Date.now();
  const isCurrentTime = scheduleDate === getTodayStr() && scheduleTime === getCurrentTimeStr();

  if (whenDate.getTime() <= scheduleNow && !isCurrentTime) {
    showValidationNotification(
      t('schedule.futureTime'),
      'warning',
      t('schedule.pastTimeTitle'),
      'SCHEDULE_NOT_IN_FUTURE',
    );
    return { kind: 'invalid' };
  }

  const silent = scheduleRequest?.silent === true;
  const effect = scheduleRequest?.effect;
  if (isCurrentTime) {
    return {
      kind: 'send-now',
      chat: scheduleChat,
      text: scheduleMessage,
      attachments: scheduleAttachments,
      attachmentGroups: scheduleGroups,
      entities: scheduleEntities,
      silent,
      effect,
    };
  }

  const requestedOccurrences = Number(repeatOptions.occurrences);
  if (!Number.isInteger(requestedOccurrences) || requestedOccurrences < 1 || requestedOccurrences > MAX_SCHEDULE_OCCURRENCES) {
    showValidationNotification(
      t('schedule.repeatRange', { count: MAX_SCHEDULE_OCCURRENCES }),
      'warning',
      t('schedule.invalidRepeatCount'),
      'REPEAT_COUNT_INVALID',
    );
    return { kind: 'invalid' };
  }

  const validWeekdays = new Set(['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']);
  if (repeatOptions.days?.some((day) => !validWeekdays.has(day))) {
    showValidationNotification(t('schedule.validWeekdays'), 'warning', t('schedule.invalidRepeatDays'), 'REPEAT_DAY_INVALID');
    return { kind: 'invalid' };
  }

  const occurrenceDates = getScheduleOccurrences(whenDate, repeatOptions);
  const maximumScheduleTime = scheduleNow + MAX_SCHEDULE_FUTURE_DAYS * 24 * 60 * 60 * 1000;
  if (occurrenceDates.some((occurrenceDate) => occurrenceDate.getTime() > maximumScheduleTime)) {
    showValidationNotification(
      t('schedule.tooFarFuture'),
      'warning',
      t('schedule.tooFarFutureTitle'),
      'SCHEDULE_TOO_FAR',
    );
    return { kind: 'invalid' };
  }
  if (replaceMessage && occurrenceDates.length !== 1) {
    showValidationNotification(
      t('schedule.repeatRange', { count: 1 }),
      'warning',
      t('schedule.invalidRepeatCount'),
      'REPLACEMENT_REPEAT_NOT_ALLOWED',
    );
    return { kind: 'invalid' };
  }

  return {
    kind: 'schedule',
    request: {
      chat: scheduleChat,
      text: scheduleMessage,
      date: scheduleDate,
      time: scheduleTime,
      attachments: scheduleAttachments,
      attachmentGroups: scheduleGroups,
      entities: scheduleEntities,
      silent,
      effect,
      replaceMessage,
      whenDate,
      occurrenceDates,
    },
  };
}
