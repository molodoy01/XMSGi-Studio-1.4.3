import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import type { ScheduledMessage } from '@/types';
import type { TranslationKey } from '@/lib/i18n';
import type { MessageHistoryScope } from '@/lib/storage';
import { persistScheduleHistoryAndWait } from '@/lib/storage';
import { uid } from '@/lib/utils';
import { normalizeTelegramBridgeError } from '@shared/bridge';
import { cancelScheduledMessage, scheduleMessage, sendNow } from '@/services/schedulerAppService';
import type { UseSchedulerOptions } from './useSchedulerUtils';
import { waitForTelegramAccount } from './useSchedulerUtils';

type HandleCancelMessage = (
  message: ScheduledMessage,
  replacementMessages?: ScheduledMessage[],
  quiet?: boolean,
) => Promise<boolean>;

type SchedulerQueuedActionsOptions = {
  accountId: string;
  historyScope: MessageHistoryScope;
  t: (key: TranslationKey, params?: Record<string, string | number>) => string;
  showNotification: UseSchedulerOptions['showNotification'];
  refreshChatPermissions: UseSchedulerOptions['refreshChatPermissions'];
  upcomingStateRef: MutableRefObject<ScheduledMessage[]>;
  sentStateRef: MutableRefObject<ScheduledMessage[]>;
  activePublishIdsRef: MutableRefObject<Set<string>>;
  setUpcoming: Dispatch<SetStateAction<ScheduledMessage[]>>;
  setSent: Dispatch<SetStateAction<ScheduledMessage[]>>;
  setSendingIds: Dispatch<SetStateAction<Set<string>>>;
  setRevealingId: Dispatch<SetStateAction<string | null>>;
  resetScheduleDateTime: () => void;
  scheduleTimeout: (callback: () => void, milliseconds: number) => void;
  handleCancelMessage: HandleCancelMessage;
};

export function createSchedulerQueuedActions({
  accountId,
  historyScope,
  t,
  showNotification,
  refreshChatPermissions,
  upcomingStateRef,
  sentStateRef,
  activePublishIdsRef,
  setUpcoming,
  setSent,
  setSendingIds,
  setRevealingId,
  resetScheduleDateTime,
  scheduleTimeout,
  handleCancelMessage,
}: SchedulerQueuedActionsOptions) {
  async function handleRetrySchedule(msg: ScheduledMessage) {
    if (activePublishIdsRef.current.has(msg.id)) return;
    activePublishIdsRef.current.add(msg.id);
    setSendingIds((current) => new Set(current).add(msg.id));
    const attempt: ScheduledMessage = {
      ...msg,
      status: 'sending',
      lastAttemptAt: new Date().toISOString(),
      lastError: undefined,
      retryAction: 'schedule',
    };
    const sendingUpcoming = upcomingStateRef.current.map((item) => item.id === msg.id ? attempt : item);
    upcomingStateRef.current = sendingUpcoming;
    setUpcoming(sendingUpcoming);

    let failedScheduleResult: Awaited<ReturnType<typeof scheduleMessage>> | null = null;
    try {
      if (!await persistScheduleHistoryAndWait(historyScope, 'upcoming', sendingUpcoming)) {
        throw new Error('The retry state could not be saved. Telegram was not contacted.');
      }
      await waitForTelegramAccount();
      const result = await scheduleMessage({
        action: 'schedule',
        chatId: attempt.chatId,
        text: attempt.text,
        entities: attempt.entities ?? [],
        attachments: attempt.attachments ?? [],
        silent: attempt.silent,
        effect: attempt.effect,
        accountId,
        targetTimestamp: Math.floor(new Date(attempt.when).getTime() / 1000),
      });
      failedScheduleResult = result;
      if (!result.success || result.confirmed !== true) {
        throw new Error(result.error || 'Telegram did not confirm that this schedule was saved.');
      }

      const scheduledMessage: ScheduledMessage = {
        ...attempt,
        status: 'scheduled',
        telegramMessageId: result.telegramMessageId ?? result.id,
        telegramMessageIds: result.telegramMessageIds,
        operationIdentity: result.operationIdentity ?? attempt.operationIdentity,
        lastError: undefined,
        retryAction: undefined,
      };
      const nextUpcoming = upcomingStateRef.current.map((item) => item.id === msg.id ? scheduledMessage : item);
      upcomingStateRef.current = nextUpcoming;
      setUpcoming(nextUpcoming);
      const historyPersisted = await persistScheduleHistoryAndWait(historyScope, 'upcoming', nextUpcoming);
      if (!historyPersisted) {
        showNotification(t('schedule.historySaveFailed'), 'warning', t('schedule.errorTitle'));
        return;
      }
      if (attempt.replacementOfId) {
        const originalMessage = upcomingStateRef.current.find((item) => item.id === attempt.replacementOfId);
        if (originalMessage) handleCancelMessage(originalMessage, [scheduledMessage], true);
      }
      showNotification(t('schedule.scheduledOne'), 'success', t('schedule.scheduledTitle'));
    } catch (error) {
      const errorDetails = failedScheduleResult
        ? normalizeTelegramBridgeError(failedScheduleResult, 'publish', t('schedule.networkScheduling'))
        : normalizeTelegramBridgeError(error, 'publish', t('schedule.networkScheduling'));
      const lastError = errorDetails.message;
      const partialIds = failedScheduleResult?.telegramMessageIds ?? [];
      const failedMessage: ScheduledMessage = {
        ...attempt,
        ...(partialIds.length ? {
          telegramMessageId: failedScheduleResult?.telegramMessageId ?? partialIds[0],
          telegramMessageIds: partialIds,
        } : {}),
        status: 'failed',
        lastError,
        lastErrorDetails: errorDetails,
        retryAction: partialIds.length ? 'cancel' : 'schedule',
      };
      const failedUpcoming = upcomingStateRef.current.map((item) => item.id === msg.id ? failedMessage : item);
      upcomingStateRef.current = failedUpcoming;
      setUpcoming(failedUpcoming);
      await persistScheduleHistoryAndWait(historyScope, 'upcoming', failedUpcoming);
      showNotification(lastError, 'error', t('schedule.errorTitle'), errorDetails);
    } finally {
      activePublishIdsRef.current.delete(msg.id);
      setSendingIds((current) => {
        const next = new Set(current);
        next.delete(msg.id);
        return next;
      });
    }
  }

  async function handleSendNow(msg: ScheduledMessage) {
    if (msg.retryAction === 'cancel') {
      await handleCancelMessage(msg);
      return;
    }
    if (msg.retryAction === 'schedule') {
      await handleRetrySchedule(msg);
      return;
    }
    if (activePublishIdsRef.current.has(msg.id)) return;

    const currentMessage = upcomingStateRef.current.find((item) => item.id === msg.id) ?? msg;
    if (!['scheduled', 'confirmed', 'failed'].includes(currentMessage.status)) return;

    activePublishIdsRef.current.add(msg.id);
    setSendingIds((current) => new Set(current).add(msg.id));
    let sendingMessage: ScheduledMessage = {
      ...currentMessage,
      status: 'sending',
      lastAttemptAt: new Date().toISOString(),
      lastError: undefined,
      retryAction: 'send',
      sendAttemptId: currentMessage.sendAttemptId || `${Date.now()}:${uid()}`,
    };

    const sendingUpcoming = upcomingStateRef.current.map((item) => item.id === msg.id ? sendingMessage : item);
    upcomingStateRef.current = sendingUpcoming;
    setUpcoming(sendingUpcoming);
    let failureDetails: ReturnType<typeof normalizeTelegramBridgeError> | undefined;
    let failureOperation: 'publish' | 'cancel' = 'publish';
    let sendRequestStarted = false;

    try {
      if (!await persistScheduleHistoryAndWait(historyScope, 'upcoming', sendingUpcoming)) {
        throw new Error('The sending state could not be saved. Telegram was not contacted.');
      }

      await waitForTelegramAccount();
      if (sendingMessage.telegramMessageId !== undefined) {
        failureOperation = 'cancel';
        const cancelResult = await cancelScheduledMessage({
          chatId: sendingMessage.chatId,
          telegramMessageId: sendingMessage.telegramMessageId,
          telegramMessageIds: sendingMessage.telegramMessageIds,
          message: sendingMessage.text,
          targetTimestamp: Math.floor(new Date(sendingMessage.when).getTime() / 1000),
        });
        if (!cancelResult.success) {
          failureDetails = normalizeTelegramBridgeError(cancelResult, 'cancel', t('schedule.cancelFailed'));
          throw new Error(failureDetails.message);
        }

        if (cancelResult.alreadySent) {
          const sentMessage: ScheduledMessage = {
            ...sendingMessage,
            status: 'sent',
            sentAt: cancelResult.sentAt || new Date().toISOString(),
            telegramMessageId: cancelResult.telegramMessageId,
            lastError: undefined,
            retryAction: undefined,
          };
          const nextUpcoming = upcomingStateRef.current.filter((item) => item.id !== msg.id);
          const nextSent = [sentMessage, ...sentStateRef.current.filter((item) => item.id !== msg.id)];
          upcomingStateRef.current = nextUpcoming;
          sentStateRef.current = nextSent;
          setUpcoming(nextUpcoming);
          setSent(nextSent);
          resetScheduleDateTime();
          await persistScheduleHistoryAndWait(historyScope, 'snapshot', { upcoming: nextUpcoming, sent: nextSent });
          showNotification('Telegram had already sent this scheduled message.', 'info', t('schedule.sent'));
          return;
        }

        sendingMessage = { ...sendingMessage, telegramMessageId: undefined };
        const uncancelledUpcoming = upcomingStateRef.current.map((item) => item.id === msg.id ? sendingMessage : item);
        upcomingStateRef.current = uncancelledUpcoming;
        setUpcoming(uncancelledUpcoming);
        if (!await persistScheduleHistoryAndWait(historyScope, 'upcoming', uncancelledUpcoming)) {
          throw new Error('Telegram cancelled the schedule, but the updated state could not be saved. Do not retry until the queue is checked.');
        }
      }

      failureOperation = 'publish';
      sendRequestStarted = true;
      const result = await sendNow({
        action: 'send-now',
        chatId: sendingMessage.chatId,
        text: sendingMessage.text,
        entities: sendingMessage.entities ?? [],
        attachments: sendingMessage.attachments ?? [],
        silent: sendingMessage.silent,
        effect: sendingMessage.effect,
        accountId,
        sendAttemptId: sendingMessage.sendAttemptId,
      });
      if (!result.success) {
        failureDetails = normalizeTelegramBridgeError(result, 'publish', t('schedule.sendFailed'));
        throw new Error(failureDetails.message);
      }

      resetScheduleDateTime();
      const sentMessage: ScheduledMessage = {
        ...sendingMessage,
        status: 'sent',
        ...(result.sentAt ? { sentAt: result.sentAt } : { sentAt: new Date().toISOString() }),
        telegramMessageId: result.telegramMessageId,
        telegramMessageIds: result.telegramMessageIds,
        lastError: undefined,
        retryAction: undefined,
      };
      const nextSent = [sentMessage, ...sentStateRef.current.filter((item) => item.id !== msg.id)];
      const nextUpcoming = upcomingStateRef.current.filter((item) => item.id !== msg.id);
      sentStateRef.current = nextSent;
      upcomingStateRef.current = nextUpcoming;
      setSent(nextSent);
      setUpcoming(nextUpcoming);
      const persisted = await persistScheduleHistoryAndWait(historyScope, 'snapshot', {
        upcoming: nextUpcoming,
        sent: nextSent,
      });
      showNotification(
        persisted
          ? t('schedule.messageSent')
          : 'Telegram sent the message, but history could not be saved. Do not retry this message.',
        persisted ? 'success' : 'warning',
        persisted ? t('schedule.sent') : t('schedule.errorTitle'),
      );
      setRevealingId(msg.id);
      scheduleTimeout(() => setRevealingId(null), 1500);
    } catch (error) {
      const errorDetails = failureDetails ?? normalizeTelegramBridgeError(
        error,
        failureOperation,
        failureOperation === 'cancel' ? t('schedule.networkCancelling') : t('schedule.networkSending'),
      );
      const lastError = errorDetails.message;
      const failedMessage: ScheduledMessage = {
        ...sendingMessage,
        status: sendRequestStarted ? 'unknown' : 'failed',
        lastError,
        lastErrorDetails: errorDetails,
        retryAction: sendRequestStarted ? undefined : 'send',
      };
      const failedUpcoming = upcomingStateRef.current.map((item) => item.id === msg.id ? failedMessage : item);
      upcomingStateRef.current = failedUpcoming;
      setUpcoming(failedUpcoming);
      await persistScheduleHistoryAndWait(historyScope, 'upcoming', failedUpcoming);
      if (refreshChatPermissions) void refreshChatPermissions(msg.chatId);
      showNotification(
        sendRequestStarted ? t('schedule.sendResultUnknown') : lastError,
        sendRequestStarted ? 'warning' : 'error',
        t('schedule.errorTitle'),
        errorDetails,
      );
    } finally {
      activePublishIdsRef.current.delete(msg.id);
      setSendingIds((current) => {
        const next = new Set(current);
        next.delete(msg.id);
        return next;
      });
    }
  }

  function handleRetry(msg: ScheduledMessage) {
    if (msg.retryAction === 'schedule') return handleRetrySchedule(msg);
    return handleSendNow(msg);
  }

  return { handleSendNow, handleRetry, handleRetrySchedule };
}
