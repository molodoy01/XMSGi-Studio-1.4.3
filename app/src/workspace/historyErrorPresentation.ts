import type { TranslationKey } from '@/lib/i18n';
import type { HistoryItem } from './historyModel';
import type { HistoryTranslate } from './historyPresentation';

type SpecificHistoryErrorKind = 'permission' | 'chat' | 'attachment' | 'message' | 'schedule';

const specificHistoryErrorCauseKeys: Record<SpecificHistoryErrorKind, TranslationKey> = {
  permission: 'history.errorCauseChatWriteForbidden',
  chat: 'history.errorCauseChatUnavailable',
  attachment: 'history.errorCauseAttachment',
  message: 'history.errorCauseMessageTooLong',
  schedule: 'history.errorCauseScheduleWindow',
};

const specificHistoryErrorNextStepKeys: Record<SpecificHistoryErrorKind, TranslationKey> = {
  permission: 'history.errorNextStepPermission',
  chat: 'history.errorNextStepChat',
  attachment: 'history.errorNextStepAttachment',
  message: 'history.errorNextStepMessage',
  schedule: 'history.errorNextStepSchedule',
};

export function isImmediateScheduleError(record: HistoryItem) {
  return record.lastErrorDetails?.code === 'TELEGRAM_SCHEDULE_SENT_IMMEDIATELY'
    || record.lastError === 'Telegram sent the message immediately instead of scheduling it.'
    || record.lastErrorDetails?.message === 'Telegram sent the message immediately instead of scheduling it.';
}

export function getVisibleHistoryError(message: string | undefined, t: HistoryTranslate) {
  if (!message) return '';
  if (/^(?:Error invoking remote method|Invalid IPC input:)/i.test(message)) {
    return t('history.statusFailed');
  }
  return message;
}

function getSpecificHistoryErrorKind(record: HistoryItem): SpecificHistoryErrorKind | undefined {
  const code = record.lastErrorDetails?.code?.toUpperCase() ?? '';
  if (/^(?:CHAT_SEND_[A-Z_]+_FORBIDDEN|CHAT_WRITE_FORBIDDEN|CHAT_ADMIN_REQUIRED|CHAT_RESTRICTED|USER_BANNED_IN_CHANNEL|USER_IS_BLOCKED)$/.test(code)) {
    return 'permission';
  }
  if (/^(?:CHANNEL_PRIVATE|CHANNEL_FORBIDDEN|CHAT_FORBIDDEN|CHAT_ID_INVALID|PEER_ID_INVALID)$/.test(code)) {
    return 'chat';
  }
  if (/^(?:MEDIA_EMPTY|MEDIA_INVALID|PHOTO_INVALID|DOCUMENT_INVALID|FILE_REFERENCE_EXPIRED|FILE_PART_\d+_MISSING)$/.test(code)) {
    return 'attachment';
  }
  if (/^(?:MESSAGE_TOO_LONG|MESSAGE_EMPTY)$/.test(code)) {
    return 'message';
  }
  if (/^(?:SCHEDULE_DATE_TOO_LATE|SCHEDULE_TOO_MUCH|SCHEDULE_DATE_INVALID|SCHEDULE_DATE_TOO_OLD)$/.test(code)) {
    return 'schedule';
  }
  return undefined;
}

export function getHistoryErrorCause(record: HistoryItem, t: HistoryTranslate) {
  const details = record.lastErrorDetails;
  if (!details) return record.status === 'failed' ? t('history.errorCauseUnknown') : '';

  const specificErrorKind = getSpecificHistoryErrorKind(record);
  if (specificErrorKind) return t(specificHistoryErrorCauseKeys[specificErrorKind]);
  if (/FLOOD_WAIT/i.test(details.code ?? '')) return t('history.errorCauseFlood');
  if (/SLOWMODE_WAIT/i.test(details.code ?? '')) return t('history.errorCauseSlowmode');
  if (details.category === 'permission') return t('history.errorCauseChatWriteForbidden');
  if (details.operation === 'validate') return t('history.errorCauseValidation');
  switch (details.category) {
    case 'flood': return t('history.errorCauseFlood');
    case 'slowmode': return t('history.errorCauseSlowmode');
    case 'cancelled': return t('history.errorCauseCancelled');
    case 'auth': return t('history.errorCauseAuth');
    case 'network': return t('history.errorCauseNetwork');
    case 'error': return t('history.errorCauseGeneric');
    case 'unknown': return t('history.errorCauseUnknown');
    default: return t('history.errorCauseUnknown');
  }
}

export function getHistoryErrorNextStep(record: HistoryItem, t: HistoryTranslate) {
  const details = record.lastErrorDetails;
  if (!details) return record.status === 'failed' ? t('history.errorNextStepUnknown') : '';
  const specificErrorKind = getSpecificHistoryErrorKind(record);
  if (specificErrorKind) return t(specificHistoryErrorNextStepKeys[specificErrorKind]);
  if (details.operation === 'validate') return t('history.errorNextStepValidation');
  switch (details.category) {
    case 'flood':
    case 'slowmode':
      return t('history.errorNextStepWait');
    case 'auth':
      return t('history.errorNextStepAuth');
    case 'permission':
      return t('history.errorNextStepPermission');
    case 'network':
      return t('history.errorNextStepNetwork');
    case 'cancelled':
      return t('history.errorNextStepCancelled');
    default:
      return t('history.errorNextStepUnknown');
  }
}

export function getHistoryErrorDetailMessage(record: HistoryItem, t: HistoryTranslate) {
  if (getSpecificHistoryErrorKind(record)) return '';
  const code = record.lastErrorDetails?.code ?? '';
  if (/FLOOD_WAIT|SLOWMODE_WAIT/i.test(code)) return '';
  return getVisibleHistoryError(record.lastError, t);
}

export function getHistoryErrorOperation(record: HistoryItem, t: HistoryTranslate) {
  const details = record.lastErrorDetails;
  if (!details) return '';
  if (details.operation === 'validate') return t('history.errorOperationValidation');
  if (details.operation === 'cancel') return t('history.errorOperationCancel');
  if (record.retryAction === 'schedule') return t('history.errorOperationSchedule');
  return t('history.errorOperationSend');
}

export function getHistoryErrorRetryability(record: HistoryItem, t: HistoryTranslate) {
  const details = record.lastErrorDetails;
  if (!details) return '';
  return t(details.retryable ? 'history.errorRetryable' : 'history.errorNotRetryable');
}

export function getHistoryErrorWait(record: HistoryItem, t: HistoryTranslate) {
  const waitSeconds = record.lastErrorDetails?.operation === 'validate'
    ? undefined
    : record.lastErrorDetails?.waitSeconds;
  return waitSeconds ? t('history.errorWait', { seconds: waitSeconds }) : '';
}

export function getRetryActionLabel(record: HistoryItem, t: HistoryTranslate) {
  if (record.retryAction === 'cancel') return t('history.retryCancelAction');
  if (record.retryAction === 'schedule') return t('history.retrySchedule');
  return t('history.retrySend');
}

export function isQueueCancellationCandidate(record: HistoryItem) {
  return record.original.kind === 'scheduled'
    && (record.status === 'scheduled' || (record.status === 'failed' && record.retryAction === 'cancel'))
    && record.original.message.telegramMessageId !== undefined
    && record.original.message.telegramMessageId !== null;
}

export function isLocalScheduleFailure(record: HistoryItem) {
  return record.original.kind === 'scheduled'
    && record.status === 'failed'
    && record.retryAction === 'schedule'
    && record.original.message.telegramMessageId == null;
}
