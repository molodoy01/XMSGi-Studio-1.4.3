import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import type { ScheduledMessage } from '@/types';
import type { TranslationKey } from '@/lib/i18n';
import type { MessageHistoryScope } from '@/lib/storage';
import { persistScheduleHistoryAndWait } from '@/lib/storage';
import { applyScheduleResult } from '@/lib/scheduling';
import { scheduleTelegramMessage } from '@/services/schedulerAppService';
import { normalizeTelegramBridgeError } from '@shared/bridge';
import type { UseSchedulerOptions } from './useSchedulerUtils';
import { REPEAT_SCHEDULE_DELAY_MS, wait, waitForTelegramAccount } from './useSchedulerUtils';

type HandleCancelMessage = (
  message: ScheduledMessage,
  replacementMessages?: ScheduledMessage[],
  quiet?: boolean,
) => Promise<boolean>;

type ExecuteScheduleBatchOptions = {
  accountId: string;
  chatId: string;
  pendingMessages: ScheduledMessage[];
  pendingUpcoming: ScheduledMessage[];
  historyScope: MessageHistoryScope;
  replaceMessage?: ScheduledMessage;
  clearMessageOnSuccess: boolean;
  schedulingLockRef: MutableRefObject<boolean>;
  activePublishIdsRef: MutableRefObject<Set<string>>;
  setScheduling: Dispatch<SetStateAction<boolean>>;
  upcomingStateRef: MutableRefObject<ScheduledMessage[]>;
  setUpcoming: Dispatch<SetStateAction<ScheduledMessage[]>>;
  refreshChatPermissions: UseSchedulerOptions['refreshChatPermissions'];
  handleCancelMessage: HandleCancelMessage;
  setMessage: Dispatch<SetStateAction<string>>;
  showNotification: UseSchedulerOptions['showNotification'];
  t: (key: TranslationKey, params?: Record<string, string | number>) => string;
  resetScheduleDateTime: () => void;
  setLastAction: Dispatch<SetStateAction<'sent' | 'scheduled' | null>>;
  setSuccessPulse: Dispatch<SetStateAction<boolean>>;
  scheduleTimeout: (callback: () => void, milliseconds: number) => void;
};

type ScheduleResult = Awaited<ReturnType<typeof scheduleTelegramMessage>>;
type ScheduleResultEntry = { result: ScheduleResult; operationId: string };

export async function executeScheduleBatch({
  accountId,
  chatId,
  pendingMessages,
  pendingUpcoming,
  historyScope,
  replaceMessage,
  clearMessageOnSuccess,
  schedulingLockRef,
  activePublishIdsRef,
  setScheduling,
  upcomingStateRef,
  setUpcoming,
  refreshChatPermissions,
  handleCancelMessage,
  setMessage,
  showNotification,
  t,
  resetScheduleDateTime,
  setLastAction,
  setSuccessPulse,
  scheduleTimeout,
}: ExecuteScheduleBatchOptions): Promise<boolean> {
  try {
    if (!await persistScheduleHistoryAndWait(historyScope, 'upcoming', pendingUpcoming)) {
      throw new Error('The pending schedule could not be saved. Telegram was not contacted.');
    }

    const results: ScheduleResultEntry[] = [];
    for (const [index, pendingMessage] of pendingMessages.entries()) {
      try {
        await waitForTelegramAccount();
        const result = await scheduleTelegramMessage({
          accountId,
          chatId,
          message: pendingMessage.text,
          targetTimestamp: Math.floor(new Date(pendingMessage.when).getTime() / 1000),
          attachments: pendingMessage.attachments ?? [],
          entities: pendingMessage.entities ?? [],
          silent: pendingMessage.silent,
          effect: pendingMessage.effect,
        });
        results.push({ result, operationId: pendingMessage.operationId! });
      } catch (error) {
        results.push({
          result: {
            success: false,
            error: error instanceof Error ? error.message : t('schedule.failed'),
          },
          operationId: pendingMessage.operationId!,
        });
      }

      if (index < pendingMessages.length - 1) {
        await wait(REPEAT_SCHEDULE_DELAY_MS);
      }
    }

    const confirmedSchedules = results.filter(({ result }) => result.success && result.confirmed === true);
    const failedSchedules = results.length - confirmedSchedules.length;
    const replacementMessages = confirmedSchedules.flatMap(({ result, operationId }) => {
      const pendingMessage = pendingMessages.find((message) => message.operationId === operationId);
      if (!pendingMessage) return [];
      return applyScheduleResult([{
        ...pendingMessage,
        operationIdentity: result.operationIdentity ?? pendingMessage.operationIdentity,
      }], operationId, {
        success: true,
        telegramMessageId: result.telegramMessageId ?? result.id,
        telegramMessageIds: result.telegramMessageIds,
        confirmed: true,
      });
    });

    const updatedUpcoming = upcomingStateRef.current.map((message) => {
      const resultEntry = results.find(({ operationId }) => operationId === message.operationId);
      if (!resultEntry) return message;
      if (!resultEntry.result.success || resultEntry.result.confirmed !== true) {
        const errorDetails = normalizeTelegramBridgeError(resultEntry.result, 'publish', 'Telegram did not confirm that this schedule was saved.');
        const partialIds = resultEntry.result.telegramMessageIds ?? [];
        return {
          ...message,
          ...(partialIds.length ? {
            telegramMessageId: resultEntry.result.telegramMessageId ?? partialIds[0],
            telegramMessageIds: partialIds,
          } : {}),
          status: 'failed' as const,
          lastError: errorDetails.message,
          lastErrorDetails: errorDetails,
          retryAction: partialIds.length ? 'cancel' as const : 'schedule' as const,
        };
      }
      const scheduledMessage = applyScheduleResult(upcomingStateRef.current, message.operationId!, {
        success: true,
        telegramMessageId: resultEntry.result.telegramMessageId ?? resultEntry.result.id,
        telegramMessageIds: resultEntry.result.telegramMessageIds,
        confirmed: true,
      }).find((item) => item.operationId === message.operationId) ?? message;
      return {
        ...scheduledMessage,
        operationIdentity: resultEntry.result.operationIdentity ?? scheduledMessage.operationIdentity,
      };
    });
    setUpcoming(updatedUpcoming);
    upcomingStateRef.current = updatedUpcoming;
    const historyPersisted = await persistScheduleHistoryAndWait(historyScope, 'upcoming', updatedUpcoming);
    schedulingLockRef.current = false;
    setScheduling(false);

    if (confirmedSchedules.length === 0) {
      if (replaceMessage) activePublishIdsRef.current.delete(replaceMessage.id);
      if (results[0]?.result.error && refreshChatPermissions) {
        void refreshChatPermissions(chatId);
      }
      const errorDetails = results[0]
        ? normalizeTelegramBridgeError(results[0].result, 'publish', t('schedule.failed'))
        : undefined;
      showNotification(
        errorDetails?.message || t('schedule.failed'),
        'error',
        t('schedule.errorTitle'),
        errorDetails,
      );
      return false;
    }

    let replacementCancellationFailed = Boolean(replaceMessage && !historyPersisted);
    if (replaceMessage) {
      activePublishIdsRef.current.delete(replaceMessage.id);
      if (historyPersisted
        && confirmedSchedules.length === pendingMessages.length
        && failedSchedules === 0
        && replacementMessages.length === pendingMessages.length) {
        replacementCancellationFailed = !await handleCancelMessage(replaceMessage, replacementMessages, true);
        if (replacementCancellationFailed && upcomingStateRef.current.some((message) => message.id === replaceMessage.id)) {
          for (const replacementMessage of replacementMessages) {
            await handleCancelMessage(replacementMessage, [], true);
          }
        }
      } else {
        replacementCancellationFailed = true;
      }
    }
    schedulingLockRef.current = false;
    setScheduling(false);

    const fullyConfirmed = confirmedSchedules.length === pendingMessages.length;
    if (clearMessageOnSuccess && fullyConfirmed && historyPersisted && !replacementCancellationFailed) {
      setMessage('');
    }
    const firstFailure = results.find(({ result }) => !result.success || result.confirmed !== true);
    const errorDetails = firstFailure
      ? normalizeTelegramBridgeError(firstFailure.result, 'publish', t('schedule.failed'))
      : undefined;
    const historyPersistenceFailed = confirmedSchedules.length > 0 && !historyPersisted;
    const notificationMessage = historyPersistenceFailed
      ? t('schedule.historySaveFailed')
      : replacementCancellationFailed
        ? t('schedule.partialCancellation')
        : confirmedSchedules.length === 1 && failedSchedules === 0
          ? t('schedule.scheduledOne')
          : confirmedSchedules.length > 1 && failedSchedules === 0
            ? t('schedule.scheduledMany', { count: confirmedSchedules.length })
            : `${confirmedSchedules.length} scheduled; ${failedSchedules} failed.`;
    const notificationType = failedSchedules || replacementCancellationFailed || historyPersistenceFailed ? 'warning' : 'success';
    const notificationTitle = historyPersistenceFailed
      ? t('schedule.errorTitle')
      : replacementCancellationFailed ? t('schedule.partialCancellationTitle') : t('schedule.scheduledTitle');
    if (errorDetails) showNotification(notificationMessage, notificationType, notificationTitle, errorDetails);
    else showNotification(notificationMessage, notificationType, notificationTitle);
    if (fullyConfirmed && historyPersisted && !replacementCancellationFailed) {
      resetScheduleDateTime();
      setLastAction('scheduled');
      setSuccessPulse(true);
      scheduleTimeout(() => setSuccessPulse(false), 1500);
    }
    return fullyConfirmed && historyPersisted && !replacementCancellationFailed;
  } catch (error) {
    schedulingLockRef.current = false;
    setScheduling(false);
    if (replaceMessage) activePublishIdsRef.current.delete(replaceMessage.id);
    const errorDetails = normalizeTelegramBridgeError(error, 'publish', t('schedule.networkScheduling'));
    const lastError = errorDetails.message;
    const pendingIds = new Set(pendingMessages.map((message) => message.operationId));
    const failedUpcoming = upcomingStateRef.current.map((message) => pendingIds.has(message.operationId)
      ? { ...message, status: 'failed' as const, lastError, lastErrorDetails: errorDetails, retryAction: 'schedule' as const }
      : message);
    upcomingStateRef.current = failedUpcoming;
    setUpcoming(failedUpcoming);
    await persistScheduleHistoryAndWait(historyScope, 'upcoming', failedUpcoming);
    showNotification(lastError, 'error', t('schedule.errorTitle'), errorDetails);
    return false;
  }
}
