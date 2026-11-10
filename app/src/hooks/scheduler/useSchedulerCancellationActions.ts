import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import type { ScheduledMessage } from '@/types';
import type { TranslationKey } from '@/lib/i18n';
import type { MessageHistoryScope } from '@/lib/storage';
import { persistScheduleHistoryAndWait } from '@/lib/storage';
import { normalizeTelegramBridgeError, type BridgeErrorDetails } from '@shared/bridge';
import { cancelScheduledMessage } from '@/services/schedulerAppService';
import type { UseSchedulerOptions } from './useSchedulerUtils';

type SchedulerCancellationOptions = {
  historyScope: MessageHistoryScope;
  showNotification: UseSchedulerOptions['showNotification'];
  t: (key: TranslationKey, params?: Record<string, string | number>) => string;
  upcomingStateRef: MutableRefObject<ScheduledMessage[]>;
  sentStateRef: MutableRefObject<ScheduledMessage[]>;
  activePublishIdsRef: MutableRefObject<Set<string>>;
  cancelingIdsRef: MutableRefObject<Set<string>>;
  setCancelingIds: Dispatch<SetStateAction<Set<string>>>;
  setUpcoming: Dispatch<SetStateAction<ScheduledMessage[]>>;
  setSent: Dispatch<SetStateAction<ScheduledMessage[]>>;
};

export function createSchedulerCancellationActions({
  historyScope,
  showNotification,
  t,
  upcomingStateRef,
  sentStateRef,
  activePublishIdsRef,
  cancelingIdsRef,
  setCancelingIds,
  setUpcoming,
  setSent,
}: SchedulerCancellationOptions) {
  async function handleCancelMessage(
    msg: ScheduledMessage,
    replacementMessages: ScheduledMessage[] = [],
    quiet = false,
  ): Promise<boolean> {
    if (cancelingIdsRef.current.has(msg.id) || activePublishIdsRef.current.has(msg.id)) return false;

    if (msg.telegramMessageId === undefined || msg.telegramMessageId === null) {
      showNotification(
        t('schedule.telegramIdMissing'),
        'error',
        t('schedule.cannotUnschedule')
      );
      return false;
    }

    const cancelContextUpcoming = [...upcomingStateRef.current];
    for (const replacementMessage of replacementMessages) {
      const existingIndex = cancelContextUpcoming.findIndex((item) => item.id === replacementMessage.id);
      if (existingIndex >= 0) {
        cancelContextUpcoming[existingIndex] = replacementMessage;
      } else {
        cancelContextUpcoming.unshift(replacementMessage);
      }
    }
    const currentMessage = cancelContextUpcoming.find((item) => item.id === msg.id) ?? msg;
    const attempt: ScheduledMessage = {
      ...currentMessage,
      status: 'sending',
      lastAttemptAt: new Date().toISOString(),
      lastError: undefined,
      retryAction: 'cancel',
    };
    const sendingUpcoming = cancelContextUpcoming.map((item) => item.id === msg.id ? attempt : item);
    activePublishIdsRef.current.add(msg.id);
    cancelingIdsRef.current.add(msg.id);
    setCancelingIds((prev) => {
      const next = new Set(prev);
      next.add(msg.id);
      return next;
    });
    setUpcoming(sendingUpcoming);
    upcomingStateRef.current = sendingUpcoming;

    let cancellationSucceeded = false;
    let cancellationErrorDetails: ReturnType<typeof normalizeTelegramBridgeError> | undefined;
    await (async () => {
      try {
        if (!await persistScheduleHistoryAndWait(historyScope, 'upcoming', sendingUpcoming)) {
          throw new Error('The cancellation state could not be saved. Telegram was not contacted.');
        }
        const result = await cancelScheduledMessage({
          chatId: attempt.chatId,
          telegramMessageId: attempt.telegramMessageId!,
          telegramMessageIds: attempt.telegramMessageIds,
          message: attempt.text,
          targetTimestamp: Math.floor(new Date(attempt.when).getTime() / 1000),
        });
        if (!result.success) {
          cancellationErrorDetails = normalizeTelegramBridgeError(result, 'cancel', t('schedule.cancelFailed'));
          throw new Error(cancellationErrorDetails.message);
        }

        if (result.alreadySent) {
          const sentMessage: ScheduledMessage = {
            ...attempt,
            status: 'sent',
            sentAt: result.sentAt || new Date().toISOString(),
            telegramMessageId: result.telegramMessageId,
            lastError: undefined,
            retryAction: undefined,
          };
          const cancelledReplacementIds = new Set<string>();
          const replacementErrors = new Map<string, BridgeErrorDetails>();
          const replacementSentMessages: ScheduledMessage[] = [];
          for (const replacementMessage of replacementMessages) {
            if (replacementMessage.telegramMessageId === undefined || replacementMessage.telegramMessageId === null) {
              replacementErrors.set(replacementMessage.id, {
                operation: 'validate',
                category: 'validation',
                retryable: false,
                message: t('schedule.telegramIdMissing'),
                code: 'TELEGRAM_SCHEDULE_ID_MISSING',
              });
              continue;
            }

            try {
              const replacementCancelResult = await cancelScheduledMessage({
                chatId: replacementMessage.chatId,
                telegramMessageId: replacementMessage.telegramMessageId,
                telegramMessageIds: replacementMessage.telegramMessageIds,
                message: replacementMessage.text,
                targetTimestamp: Math.floor(new Date(replacementMessage.when).getTime() / 1000),
              });
              if (!replacementCancelResult.success) {
                replacementErrors.set(
                  replacementMessage.id,
                  normalizeTelegramBridgeError(replacementCancelResult, 'cancel', t('schedule.cancelFailed')),
                );
                continue;
              }

              if (replacementCancelResult.alreadySent) {
                replacementSentMessages.push({
                  ...replacementMessage,
                  status: 'sent',
                  sentAt: replacementCancelResult.sentAt || new Date().toISOString(),
                  telegramMessageId: replacementCancelResult.telegramMessageId,
                });
              } else {
                cancelledReplacementIds.add(replacementMessage.id);
              }
            } catch (error) {
              replacementErrors.set(replacementMessage.id, normalizeTelegramBridgeError(error, 'cancel', t('schedule.cancelFailed')));
            }
          }

          const remaining = upcomingStateRef.current
            .filter((item) => item.id !== msg.id && !cancelledReplacementIds.has(item.id))
            .map((item) => {
              const errorDetails = replacementErrors.get(item.id);
              return errorDetails
                ? { ...item, status: 'failed' as const, lastError: errorDetails.message, lastErrorDetails: errorDetails, retryAction: 'cancel' as const }
                : item;
            });
          const nextSent = [...replacementSentMessages, sentMessage, ...sentStateRef.current.filter((item) => item.id !== msg.id)];
          upcomingStateRef.current = remaining;
          sentStateRef.current = nextSent;
          setUpcoming(remaining);
          setSent(nextSent);
          const persisted = await persistScheduleHistoryAndWait(historyScope, 'snapshot', { upcoming: remaining, sent: nextSent });
          const replacementWasSent = replacementSentMessages.length > 0;
          cancellationSucceeded = persisted && replacementErrors.size === 0 && !replacementWasSent;
          if (replacementErrors.size > 0 || replacementWasSent || !persisted) {
            const errorDetails = replacementErrors.values().next().value;
            showNotification(
              t('schedule.partialCancellation'),
              'warning',
              t('schedule.partialCancellationTitle'),
              errorDetails,
            );
          } else {
            showNotification('Telegram had already sent this scheduled message; its replacement was cancelled.', 'info', t('schedule.sent'));
          }
          return;
        }

        const remaining = upcomingStateRef.current.filter((item) => item.id !== msg.id);
        upcomingStateRef.current = remaining;
        setUpcoming(remaining);
        if (!await persistScheduleHistoryAndWait(historyScope, 'upcoming', remaining)) {
          const lastError = 'Telegram cancelled this schedule, but the history update could not be saved.';
          const errorDetails = normalizeTelegramBridgeError({ error: lastError, code: 'SCHEDULE_HISTORY_WRITE_FAILED' }, 'cancel', lastError);
          const failedMessage: ScheduledMessage = {
            ...attempt,
            telegramMessageId: undefined,
            status: 'failed',
            lastError,
            lastErrorDetails: errorDetails,
            retryAction: 'send',
          };
          const currentUpcoming = upcomingStateRef.current;
          const failedUpcoming = currentUpcoming.some((item) => item.id === msg.id)
            ? currentUpcoming.map((item) => item.id === msg.id ? failedMessage : item)
            : [failedMessage, ...currentUpcoming];
          upcomingStateRef.current = failedUpcoming;
          setUpcoming(failedUpcoming);
          await persistScheduleHistoryAndWait(historyScope, 'upcoming', failedUpcoming);
          showNotification(`${lastError} Retry will send without cancelling the old schedule again.`, 'error', t('schedule.errorTitle'), errorDetails);
          return;
        }

        cancellationSucceeded = true;
        if (!quiet) showNotification(t('schedule.unscheduled'), 'info', t('schedule.unscheduledTitle'));
      } catch (error) {
        const baseErrorDetails = cancellationErrorDetails ?? normalizeTelegramBridgeError(error, 'cancel', t('schedule.networkCancelling'));
        const cancellationError = baseErrorDetails.message;
        const lastError = replacementMessages.length > 0
          ? `${t('schedule.partialCancellation')} ${cancellationError}`
          : cancellationError;
        const errorDetails = { ...baseErrorDetails, message: lastError };
        const failedMessage: ScheduledMessage = {
          ...attempt,
          status: 'failed',
          lastError,
          lastErrorDetails: errorDetails,
          retryAction: 'cancel',
        };
        const failedUpcoming = upcomingStateRef.current.map((item) => item.id === msg.id ? failedMessage : item);
        upcomingStateRef.current = failedUpcoming;
        setUpcoming(failedUpcoming);
        await persistScheduleHistoryAndWait(historyScope, 'upcoming', failedUpcoming);
        if (!quiet) showNotification(lastError, replacementMessages.length > 0 ? 'warning' : 'error', replacementMessages.length > 0 ? t('schedule.partialCancellationTitle') : t('schedule.errorTitle'), errorDetails);
      } finally {
        activePublishIdsRef.current.delete(msg.id);
        cancelingIdsRef.current.delete(msg.id);
        setCancelingIds((prev) => {
          const next = new Set(prev);
          next.delete(msg.id);
          return next;
        });
      }
    })();
    return cancellationSucceeded;
  }

  async function handleCancelMessages(messages: ScheduledMessage[]): Promise<boolean> {
    const uniqueMessages = [...new Map(messages.map((message) => [message.id, message])).values()];
    let allCancelled = true;

    for (const message of uniqueMessages) {
      if (message.telegramMessageId === undefined || message.telegramMessageId === null) {
        allCancelled = false;
        continue;
      }
      if (!await handleCancelMessage(message, [], true)) allCancelled = false;
    }

    return allCancelled;
  }

  return { handleCancelMessage, handleCancelMessages };
}
