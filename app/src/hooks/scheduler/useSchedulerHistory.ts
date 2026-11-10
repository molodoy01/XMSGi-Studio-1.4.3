import { useEffect, useState } from 'react';
import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import type { ScheduledMessage } from '@/types';
import type { TranslationKey } from '@/lib/i18n';
import { applyScheduleResult, getPendingSchedules } from '@/lib/scheduling';
import {
  loadSent as loadSentFromStorage,
  loadUpcoming as loadUpcomingFromStorage,
  persistScheduleHistoryAndWait,
  type MessageHistoryScope,
} from '@/lib/storage';
import {
  loadScheduleHistory,
  reconcileImmediateSendAttempt,
  reconcilePendingSchedule,
  scheduleTelegramMessage,
} from '@/services/schedulerAppService';
import {
  normalizeRestoredMessage,
  waitForTelegramAccount,
  type UseSchedulerOptions,
} from './useSchedulerUtils';

type HandleCancelMessage = (
  message: ScheduledMessage,
  replacementMessages?: ScheduledMessage[],
  quiet?: boolean,
) => Promise<boolean>;

type SchedulerHistoryOptions = {
  historyScope: MessageHistoryScope;
  accountId: string;
  connected: boolean;
  showNotification: UseSchedulerOptions['showNotification'];
  t: (key: TranslationKey, params?: Record<string, string | number>) => string;
  upcomingStateRef: MutableRefObject<ScheduledMessage[]>;
  sentStateRef: MutableRefObject<ScheduledMessage[]>;
  handleCancelMessageRef: MutableRefObject<HandleCancelMessage>;
  setUpcoming: Dispatch<SetStateAction<ScheduledMessage[]>>;
  setSent: Dispatch<SetStateAction<ScheduledMessage[]>>;
};

export function useSchedulerHistory({
  historyScope,
  accountId,
  connected,
  showNotification,
  t,
  upcomingStateRef,
  sentStateRef,
  handleCancelMessageRef,
  setUpcoming,
  setSent,
}: SchedulerHistoryOptions) {
  const [historyReady, setHistoryReady] = useState(false);
  const [historyLoadError, setHistoryLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const restoreHistory = async () => {
      setHistoryLoadError(null);
      const fallbackUpcoming = loadUpcomingFromStorage(historyScope);
      const fallbackSent = loadSentFromStorage(historyScope);

      try {
        const result = await loadScheduleHistory(historyScope);
        if (!result) {
          upcomingStateRef.current = fallbackUpcoming;
          sentStateRef.current = fallbackSent;
          setUpcoming(fallbackUpcoming);
          setSent(fallbackSent);
          return;
        }
        if (!result.success) throw new Error(result.error || 'Schedule history could not be restored.');

        const nativeUpcoming = result.history?.upcoming ?? [];
        const nativeSent = result.history?.sent ?? [];
        let restoredUpcoming = (result.needsMigration ? fallbackUpcoming : nativeUpcoming)
          .map(normalizeRestoredMessage);
        let restoredSent = (result.needsMigration ? fallbackSent : nativeSent)
          .map(normalizeRestoredMessage);

        for (const message of [...restoredUpcoming]) {
          if (message.status !== 'unknown' || !message.sendAttemptId) continue;
          const reconciliation = await reconcileImmediateSendAttempt(
            message.sendAttemptId,
            message.attachments?.length ?? 0,
          );
          if (reconciliation.state !== 'sent') continue;

          const sentMessage: ScheduledMessage = {
            ...message,
            status: 'sent',
            ...(reconciliation.sentAt ? { sentAt: reconciliation.sentAt } : {}),
            telegramMessageId: reconciliation.telegramMessageId,
            telegramMessageIds: reconciliation.telegramMessageIds,
            lastError: undefined,
            lastErrorDetails: undefined,
            retryAction: undefined,
          };
          restoredUpcoming = restoredUpcoming.filter((item) => item.id !== message.id);
          restoredSent = [sentMessage, ...restoredSent.filter((item) => item.id !== message.id)];
        }
        if (cancelled) return;

        setUpcoming(restoredUpcoming);
        setSent(restoredSent);
        upcomingStateRef.current = restoredUpcoming;
        sentStateRef.current = restoredSent;
        if (result.needsMigration
          || JSON.stringify(restoredUpcoming) !== JSON.stringify(nativeUpcoming)
          || JSON.stringify(restoredSent) !== JSON.stringify(nativeSent)) {
          if (!await persistScheduleHistoryAndWait(historyScope, 'snapshot', {
            upcoming: restoredUpcoming,
            sent: restoredSent,
          })) {
            showNotification(t('schedule.historyWriteFailed'), 'warning', t('schedule.errorTitle'));
          }
        }
      } catch (error) {
        if (cancelled) return;
        upcomingStateRef.current = fallbackUpcoming;
        sentStateRef.current = fallbackSent;
        setUpcoming(fallbackUpcoming);
        setSent(fallbackSent);
        setHistoryLoadError(error instanceof Error ? error.message : 'Schedule history could not be restored.');
        showNotification(
          error instanceof Error ? error.message : 'Schedule history could not be restored.',
          'error',
          t('schedule.recoverFailed'),
        );
      } finally {
        if (!cancelled) setHistoryReady(true);
      }
    };

    void restoreHistory();
    return () => { cancelled = true; };
  }, [historyScope, setSent, setUpcoming, sentStateRef, showNotification, t, upcomingStateRef]);

  useEffect(() => {
    if (!connected || !historyReady) return;

    let cancelled = false;

    async function recoverPendingSchedules() {
      const pendingMessages = getPendingSchedules(upcomingStateRef.current);

      for (const pendingMessage of pendingMessages) {
        const pendingTimestamp = new Date(pendingMessage.when).getTime();

        if (Number.isFinite(pendingTimestamp) && pendingTimestamp <= Date.now()) {
          await waitForTelegramAccount();
          if (cancelled) return;

          const reconciliation = await reconcilePendingSchedule({
            chatId: pendingMessage.chatId,
            message: pendingMessage.text,
            targetTimestamp: Math.floor(pendingTimestamp / 1000),
            attachments: pendingMessage.attachments ?? [],
            entities: pendingMessage.entities ?? [],
            silent: pendingMessage.silent,
            effect: pendingMessage.effect,
            telegramMessageIds: pendingMessage.telegramMessageIds
              ?? (pendingMessage.telegramMessageId === undefined ? [] : [pendingMessage.telegramMessageId]),
          });
          if (cancelled) return;

          if (reconciliation.state === 'unknown') {
            showNotification(
              reconciliation.error || 'Telegram could not confirm the operation state. No automatic retry was made.',
              'warning',
              t('schedule.errorTitle'),
            );
            continue;
          }

          const updatedUpcoming = upcomingStateRef.current.filter((message) => message.id !== pendingMessage.id);
          const nextSent = sentStateRef.current;
          const nextUpcoming = [{
            ...pendingMessage,
            status: 'scheduled' as const,
            telegramMessageId: reconciliation.telegramMessageId,
            telegramMessageIds: reconciliation.telegramMessageIds,
            retryAction: undefined,
            lastError: undefined,
            lastErrorDetails: undefined,
          }, ...updatedUpcoming];
          upcomingStateRef.current = nextUpcoming;
          setUpcoming(nextUpcoming);

          const persisted = await persistScheduleHistoryAndWait(historyScope, 'snapshot', {
            upcoming: nextUpcoming,
            sent: nextSent,
          });
          if (!persisted) {
            showNotification(t('schedule.historyWriteFailed'), 'warning', t('schedule.errorTitle'));
          }
          continue;
        }

        await waitForTelegramAccount();
        if (cancelled) return;

        const result = await scheduleTelegramMessage({
          accountId,
          chatId: pendingMessage.chatId,
          message: pendingMessage.text,
          targetTimestamp: Math.floor(new Date(pendingMessage.when).getTime() / 1000),
          attachments: pendingMessage.attachments ?? [],
          entities: pendingMessage.entities ?? [],
          silent: pendingMessage.silent,
          effect: pendingMessage.effect,
        });

        if (cancelled) return;

        const scheduleConfirmed = result.success
          && (!pendingMessage.replacementOfId || result.confirmed === true);
        const updatedUpcoming = upcomingStateRef.current.map((message) => {
          if (message.operationId !== pendingMessage.operationId) return message;
          if (!scheduleConfirmed) {
            const partialIds = result.telegramMessageIds ?? [];
            return {
              ...message,
              ...(partialIds.length ? {
                telegramMessageId: result.telegramMessageId ?? partialIds[0],
                telegramMessageIds: partialIds,
              } : {}),
              status: 'failed' as const,
              lastError: result.error || 'Telegram did not confirm that this replacement was saved.',
              retryAction: partialIds.length ? 'cancel' as const : 'schedule' as const,
            };
          }
          return applyScheduleResult(upcomingStateRef.current, pendingMessage.operationId!, result)
            .find((item) => item.operationId === pendingMessage.operationId) ?? message;
        });
        upcomingStateRef.current = updatedUpcoming;
        setUpcoming(updatedUpcoming);
        const historyPersisted = await persistScheduleHistoryAndWait(historyScope, 'upcoming', updatedUpcoming);

        if (!scheduleConfirmed) {
          showNotification(
            result.error || 'Telegram did not confirm that this replacement was saved.',
            'error',
            'Scheduling failed'
          );
        } else if (!historyPersisted) {
          showNotification(t('schedule.historySaveFailed'), 'warning', t('schedule.errorTitle'));
        } else if (pendingMessage.replacementOfId) {
          const originalMessage = upcomingStateRef.current.find((item) => item.id === pendingMessage.replacementOfId);
          const replacementMessage = applyScheduleResult([pendingMessage], pendingMessage.operationId!, result)
            .find((item) => item.operationId === pendingMessage.operationId);
          if (originalMessage && replacementMessage) {
            handleCancelMessageRef.current(originalMessage, [replacementMessage], true);
          }
        }
      }
    }

    recoverPendingSchedules().catch((error) => {
      if (!cancelled) {
        showNotification(
          error instanceof Error
            ? error.message
            : t('schedule.recoverFailed'),
          'error',
          t('schedule.schedulingFailed')
        );
      }
    });

    return () => {
      cancelled = true;
    };
  }, [
    accountId,
    connected,
    handleCancelMessageRef,
    historyReady,
    historyScope,
    sentStateRef,
    setSent,
    setUpcoming,
    showNotification,
    t,
    upcomingStateRef,
  ]);

  return { historyReady, historyLoadError };
}
