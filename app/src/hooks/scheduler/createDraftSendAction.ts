import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import type { Chat, RichTextEntity, ScheduledMessage } from '@/types';
import type { TranslationKey } from '@/lib/i18n';
import type { UseSchedulerOptions } from './useSchedulerUtils';
import type { MessageHistoryScope } from '@/lib/storage';
import { persistScheduleHistoryAndWait } from '@/lib/storage';
import { sendNow } from '@/services/schedulerAppService';
import { normalizeTelegramBridgeError } from '@shared/bridge';
import { waitForTelegramAccount } from './useSchedulerUtils';
import { prepareDraftSendAttempt } from './prepareDraftSendAttempt';
import { sendDraftAttachmentGroups } from './sendDraftAttachmentGroups';

export type DraftSendActionContext = {
  accountId: string;
  historyReady: boolean;
  historyScope: MessageHistoryScope;
  publishingDraftLockRef: MutableRefObject<boolean>;
  setPublishingDraft: Dispatch<SetStateAction<boolean>>;
  draftSendAttemptRef: MutableRefObject<{ fingerprint: string; id: string; recordId?: string } | null>;
  upcomingStateRef: MutableRefObject<ScheduledMessage[]>;
  setUpcoming: Dispatch<SetStateAction<ScheduledMessage[]>>;
  sentStateRef: MutableRefObject<ScheduledMessage[]>;
  setSent: Dispatch<SetStateAction<ScheduledMessage[]>>;
  setMessage: Dispatch<SetStateAction<string>>;
  setSuccessPulse: Dispatch<SetStateAction<boolean>>;
  setLastAction: Dispatch<SetStateAction<'sent' | 'scheduled' | null>>;
  resetScheduleDateTime: () => void;
  refreshChatPermissions: UseSchedulerOptions['refreshChatPermissions'];
  showNotification: UseSchedulerOptions['showNotification'];
  t: (key: TranslationKey, params?: Record<string, string | number>) => string;
  scheduleTimeout: (callback: () => void, milliseconds: number) => void;
};

export function createDraftSendAction(context: DraftSendActionContext) {
  const {
    accountId,
    historyReady,
    historyScope,
    publishingDraftLockRef,
    setPublishingDraft,
    draftSendAttemptRef,
    upcomingStateRef,
    setUpcoming,
    sentStateRef,
    setSent,
    setMessage,
    setSuccessPulse,
    setLastAction,
    resetScheduleDateTime,
    refreshChatPermissions,
    showNotification,
    t,
    scheduleTimeout,
  } = context;

  const handleSendDraftNow = async (
    chat: Chat,
    text: string,
    attachments: string[] = [],
    entities: RichTextEntity[] = [],
    silent: boolean | string[][] = false,
    effect?: string,
    options: {
      clearMessageOnSuccess?: boolean;
      isNestedBatchGroup?: boolean;
      suppressNotifications?: boolean;
    } = {},
    attachmentGroups?: string[][],
    onAttachmentGroupResult?: (groupIndex: number, sent: boolean) => void,
  ): Promise<boolean | 'sent-history-failed'> => {
    const isNestedBatchGroup = Boolean(options.isNestedBatchGroup);
    const groupedSendResult = await sendDraftAttachmentGroups({
      chat,
      text,
      entities,
      silent,
      effect,
      options,
      attachmentGroups,
      onAttachmentGroupResult,
      publishingDraftLockRef,
      setPublishingDraft,
      resetScheduleDateTime,
      setMessage,
      draftSendAttemptRef,
      setSuccessPulse,
      setLastAction,
      showNotification,
      t,
      scheduleTimeout,
      sendDraftNow: (groupChat, groupText, groupAttachments, groupEntities, groupSilent, groupEffect, groupOptions, groups) => (
        handleSendDraftNow(
          groupChat,
          groupText,
          groupAttachments,
          groupEntities,
          groupSilent,
          groupEffect,
          groupOptions,
          groups,
        )
      ),
    });
    if (groupedSendResult !== null) return groupedSendResult;

    const sendSilently = typeof silent === 'boolean' ? silent : false;
    if (!historyReady || (!text.trim() && attachments.length === 0)) return false;
    if (publishingDraftLockRef.current && !Array.isArray(silent) && !attachmentGroups && !isNestedBatchGroup) {
      return false;
    }

    publishingDraftLockRef.current = true;
    setPublishingDraft(true);
    const preparedAttempt = prepareDraftSendAttempt({
      accountId,
      chat,
      text,
      attachments,
      entities,
      silent: sendSilently,
      effect,
      upcoming: upcomingStateRef.current,
      draftSendAttemptRef,
    });
    if (preparedAttempt.kind === 'unresolved') {
      publishingDraftLockRef.current = false;
      setPublishingDraft(false);
      if (!options.suppressNotifications) {
        showNotification(t('schedule.sendResultUnknown'), 'warning', t('schedule.errorTitle'));
      }
      return false;
    }
    const { sendAttemptId, attemptRecordId, sendingMessage, sendingUpcoming } = preparedAttempt;
    upcomingStateRef.current = sendingUpcoming;
    setUpcoming(sendingUpcoming);
    let sendRequestStarted = false;

    try {
      // Persist the in-flight record before Telegram so interrupted sends remain recoverable.
      if (!await persistScheduleHistoryAndWait(historyScope, 'upcoming', sendingUpcoming)) {
        throw new Error('The sending state could not be saved. Telegram was not contacted.');
      }
      await waitForTelegramAccount();
      sendRequestStarted = true;
      const result = await sendNow({
        action: 'send-now',
        chatId: chat.id,
        text,
        attachments,
        entities,
        silent: sendSilently,
        effect,
        accountId,
        sendAttemptId,
      });

      if (!result.success) {
        const errorDetails = normalizeTelegramBridgeError(result, 'publish', t('schedule.sendFailed'));
        throw Object.assign(new Error(errorDetails.message), { sendErrorDetails: errorDetails });
      }

      if (!isNestedBatchGroup) resetScheduleDateTime();
      const sentMessage: ScheduledMessage = {
        ...sendingMessage,
        status: 'sent',
        ...(result.sentAt ? { sentAt: result.sentAt } : { sentAt: new Date().toISOString() }),
        telegramMessageId: result.telegramMessageId,
        telegramMessageIds: result.telegramMessageIds,
        lastError: undefined,
        lastErrorDetails: undefined,
        retryAction: undefined,
      };
      const updatedSent = [sentMessage, ...sentStateRef.current.filter((item) => item.id !== sentMessage.id)];
      const nextUpcoming = upcomingStateRef.current.filter((item) => item.id !== attemptRecordId);
      sentStateRef.current = updatedSent;
      upcomingStateRef.current = nextUpcoming;
      setSent(updatedSent);
      setUpcoming(nextUpcoming);
      const historyWrite = persistScheduleHistoryAndWait(historyScope, 'snapshot', {
        upcoming: nextUpcoming,
        sent: updatedSent,
      });
      const historyPersisted = await historyWrite;
      if (!historyPersisted) {
        if (!isNestedBatchGroup && !options.suppressNotifications) {
          showNotification(t('schedule.historyWriteFailed'), 'warning', t('schedule.errorTitle'));
        }
        return 'sent-history-failed';
      }
      if (options.clearMessageOnSuccess !== false && !isNestedBatchGroup) setMessage('');
      draftSendAttemptRef.current = null;
      if (!isNestedBatchGroup) {
        setSuccessPulse(true);
        setLastAction('sent');
        if (!options.suppressNotifications) {
          showNotification(t('schedule.messageSent'), 'success', t('schedule.sent'));
        }
        scheduleTimeout(() => setSuccessPulse(false), 1500);
        scheduleTimeout(() => setLastAction(null), 1500);
      }
      return true;
    } catch (error) {
      if (refreshChatPermissions) void refreshChatPermissions(chat.id);
      const errorDetails = (error as { sendErrorDetails?: ReturnType<typeof normalizeTelegramBridgeError> }).sendErrorDetails
        ?? normalizeTelegramBridgeError(error, 'publish', t('schedule.networkSending'));
      const failedMessage: ScheduledMessage = {
        ...sendingMessage,
        status: sendRequestStarted ? 'unknown' : 'failed',
        lastError: errorDetails.message,
        lastErrorDetails: errorDetails,
        retryAction: sendRequestStarted ? undefined : 'send',
      };
      const failedUpcoming = upcomingStateRef.current.map((item) => item.id === attemptRecordId ? failedMessage : item);
      upcomingStateRef.current = failedUpcoming;
      setUpcoming(failedUpcoming);
      await persistScheduleHistoryAndWait(historyScope, 'upcoming', failedUpcoming);
      if (!isNestedBatchGroup && !options.suppressNotifications) {
        showNotification(
          sendRequestStarted ? t('schedule.sendResultUnknown') : errorDetails.message,
          sendRequestStarted ? 'warning' : 'error',
          t('schedule.sendFailedTitle'),
          errorDetails,
        );
      }
      return false;
    } finally {
      if (!isNestedBatchGroup) {
        publishingDraftLockRef.current = false;
        setPublishingDraft(false);
      }
    }
  };

  return handleSendDraftNow;
}
