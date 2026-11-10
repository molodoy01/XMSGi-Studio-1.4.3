import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import type { Chat, RichTextEntity } from '@/types';
import type { TranslationKey } from '@/lib/i18n';
import type { UseSchedulerOptions } from './useSchedulerUtils';

type DraftSendOptions = {
  clearMessageOnSuccess?: boolean;
  isNestedBatchGroup?: boolean;
  suppressNotifications?: boolean;
};

type BatchGroupSend = (
  chat: Chat,
  text: string,
  attachments: string[],
  entities: RichTextEntity[],
  silent: boolean,
  effect: string | undefined,
  options: { isNestedBatchGroup: true; suppressNotifications?: boolean },
  attachmentGroups: string[][],
) => Promise<boolean | 'sent-history-failed'>;

type DraftSendAttemptRef = MutableRefObject<{ fingerprint: string; id: string; recordId?: string } | null>;

type SendDraftAttachmentGroupsOptions = {
  chat: Chat;
  text: string;
  entities: RichTextEntity[];
  silent: boolean | string[][];
  effect?: string;
  options: DraftSendOptions;
  attachmentGroups?: string[][];
  onAttachmentGroupResult?: (groupIndex: number, sent: boolean) => void;
  publishingDraftLockRef: MutableRefObject<boolean>;
  setPublishingDraft: Dispatch<SetStateAction<boolean>>;
  resetScheduleDateTime: () => void;
  setMessage: Dispatch<SetStateAction<string>>;
  draftSendAttemptRef: DraftSendAttemptRef;
  setSuccessPulse: Dispatch<SetStateAction<boolean>>;
  setLastAction: Dispatch<SetStateAction<'sent' | 'scheduled' | null>>;
  showNotification: UseSchedulerOptions['showNotification'];
  t: (key: TranslationKey) => string;
  scheduleTimeout: (callback: () => void, milliseconds: number) => void;
  sendDraftNow: BatchGroupSend;
};

export async function sendDraftAttachmentGroups({
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
  sendDraftNow,
}: SendDraftAttachmentGroupsOptions): Promise<boolean | 'sent-history-failed' | null> {
  const suppliedGroups = Array.isArray(silent) ? silent : attachmentGroups;
  if (!suppliedGroups?.length) return null;

  const groups = suppliedGroups.filter((group) => group.length > 0);
  if (groups.length <= 1 && !onAttachmentGroupResult) return null;

  const shouldManageBatchState = !publishingDraftLockRef.current;
  if (shouldManageBatchState) {
    publishingDraftLockRef.current = true;
    setPublishingDraft(true);
  }

  let allSent = true;
  let sentGroupCount = 0;
  let historyWriteFailed = false;
  try {
    for (const [groupIndex, group] of groups.entries()) {
      const isPrimaryGroup = groupIndex === 0;
      const sentResult = await sendDraftNow(
        chat,
        isPrimaryGroup ? text : '',
        group,
        isPrimaryGroup ? entities : [],
        false,
        isPrimaryGroup ? effect : undefined,
        { isNestedBatchGroup: true, suppressNotifications: options.suppressNotifications },
        [group],
      );
      const sent = sentResult !== false;
      if (sentResult === 'sent-history-failed') historyWriteFailed = true;
      onAttachmentGroupResult?.(groupIndex, sent);
      if (sent) {
        sentGroupCount += 1;
      } else {
        allSent = false;
        for (let pendingGroupIndex = groupIndex + 1; pendingGroupIndex < groups.length; pendingGroupIndex += 1) {
          onAttachmentGroupResult?.(pendingGroupIndex, false);
        }
        break;
      }
      allSent &&= sent;
    }

    if (sentGroupCount > 0) resetScheduleDateTime();
    if (allSent) {
      if (historyWriteFailed) {
        if (!options.suppressNotifications) {
          showNotification(t('schedule.historyWriteFailed'), 'warning', t('schedule.errorTitle'));
        }
        return 'sent-history-failed';
      }

      if (options.clearMessageOnSuccess !== false) setMessage('');
      draftSendAttemptRef.current = null;
      setSuccessPulse(true);
      setLastAction('sent');
      if (!options.suppressNotifications) {
        showNotification(t('schedule.messageSent'), 'success', t('schedule.sent'));
      }
      scheduleTimeout(() => setSuccessPulse(false), 1500);
      scheduleTimeout(() => setLastAction(null), 1500);
    } else if (sentGroupCount > 0) {
      if (!options.suppressNotifications) {
        showNotification(t('schedule.partialAttachmentSend'), 'warning', t('schedule.sendFailedTitle'));
      }
    } else if (!options.suppressNotifications) {
      showNotification(t('schedule.sendFailed'), 'error', t('schedule.sendFailedTitle'));
    }

    return allSent;
  } finally {
    if (shouldManageBatchState) {
      publishingDraftLockRef.current = false;
      setPublishingDraft(false);
    }
  }
}
