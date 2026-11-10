import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import type { Chat, NotificationType, RichTextEntity, ScheduledMessage } from '@/types';
import {
  createPendingSchedule,
  type ScheduleRepeatOptions,
} from '@/lib/scheduling';
import { uid } from '@/lib/utils';
import { prepareScheduleRequest, type ScheduleRequest } from './prepareScheduleRequest';
import { resolveScheduleOperations } from './resolveScheduleOperations';
import { executeScheduleBatch } from './executeScheduleBatch';
import { createDraftSendAction, type DraftSendActionContext } from './createDraftSendAction';

type SchedulerActionContext = DraftSendActionContext & {
  scheduling: boolean;
  schedulingLockRef: MutableRefObject<boolean>;
  chats: Chat[];
  selectedChat: Chat | null;
  message: string;
  date: string;
  time: string;
  composerAttachments: string[];
  composerEntities: RichTextEntity[];
  showValidationNotification: (message: string, type: NotificationType, title: string, code: string) => void;
  upcoming: ScheduledMessage[];
  activePublishIdsRef: MutableRefObject<Set<string>>;
  setScheduling: Dispatch<SetStateAction<boolean>>;
  handleCancelMessage: (msg: ScheduledMessage, replacementMessages?: ScheduledMessage[], quiet?: boolean) => Promise<boolean>;
};

export function createSchedulerActions(context: SchedulerActionContext) {
  const {
    accountId,
    historyReady,
    scheduling,
    schedulingLockRef,
    chats,
    selectedChat,
    message,
    date,
    time,
    composerAttachments,
    composerEntities,
    showValidationNotification,
    t,
    showNotification,
    upcoming,
    activePublishIdsRef,
    setScheduling,
    upcomingStateRef,
    setUpcoming,
    historyScope,
    setLastAction,
    setSuccessPulse,
    refreshChatPermissions,
    handleCancelMessage,
    setMessage,
    resetScheduleDateTime,
    scheduleTimeout,
  } = context;
  const handleSendDraftNow = createDraftSendAction(context);

async function handleSchedule(
    scheduleRequest?: ScheduleRequest,
    repeatOptions: ScheduleRepeatOptions = { mode: 'none', occurrences: 1 },
  ): Promise<boolean | 'sent-history-failed' | void> {
    if (!historyReady || scheduling || schedulingLockRef.current) return false;

    const preparation = prepareScheduleRequest(scheduleRequest, {
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
    });
    if (preparation.kind === 'invalid') return false;
    if (preparation.kind === 'schedule' && preparation.request.replaceMessage) {
      const replaceMessage = preparation.request.replaceMessage;
      const replacementAlreadyScheduled = upcomingStateRef.current.some((scheduledMessage) => (
        scheduledMessage.replacementOfId === replaceMessage.id
        && (['pending', 'scheduled', 'confirmed', 'sending', 'unknown'].includes(scheduledMessage.status)
          || (scheduledMessage.status === 'failed' && scheduledMessage.retryAction === 'cancel'))
      ));
      const currentOriginal = upcomingStateRef.current.find((scheduledMessage) => scheduledMessage.id === replaceMessage.id);
      const originalIsNoLongerScheduled = !currentOriginal
        || !['scheduled', 'confirmed'].includes(currentOriginal.status);
      if (replacementAlreadyScheduled || originalIsNoLongerScheduled) {
        showNotification(t('schedule.partialCancellation'), 'warning', t('schedule.partialCancellationTitle'));
        return false;
      }
    }
    if (preparation.kind === 'send-now') {
      return handleSendDraftNow(
        preparation.chat,
        preparation.text,
        preparation.attachments,
        preparation.entities,
        preparation.silent,
        preparation.effect,
        undefined,
        preparation.attachmentGroups,
      );
    }

    const {
      chat,
      text,
      entities,
      silent,
      effect,
      replaceMessage,
      attachmentGroups: scheduleGroups,
      occurrenceDates,
    } = preparation.request;
    const chatId = chat.id;
    const chatName = chat.name;
    const operations = await resolveScheduleOperations({
      chat,
      text,
      entities,
      silent,
      effect,
      replaceMessage,
      scheduleGroups,
      occurrenceDates,
      upcoming,
      upcomingStateRef,
      setUpcoming,
      historyScope,
      schedulingLockRef,
      activePublishIdsRef,
      setScheduling,
      showNotification,
      t,
    });
    if (operations.kind !== 'ready') return false;
    const { candidateOperations, candidateIdentities, upcomingWithIdentities } = operations;

    setLastAction(null);
    setSuccessPulse(false);
    const pendingMessages = candidateOperations.map((operation, index) => createPendingSchedule({
      accountId,
      operationId: uid(),
      operationIdentity: candidateIdentities[index]!,
      chatId,
      chatName,
      text: operation.message,
      attachments: operation.attachments,
      when: new Date(operation.targetTimestamp * 1000).toISOString(),
      createdAt: new Date().toISOString(),
      entities: operation.entities,
      silent: operation.silent,
      effect: operation.effect,
    })).map((pendingMessage) => replaceMessage
      ? { ...pendingMessage, replacementOfId: replaceMessage.id }
      : pendingMessage);
    const pendingUpcoming = [...pendingMessages, ...upcomingWithIdentities];
    upcomingStateRef.current = pendingUpcoming;
    setUpcoming(pendingUpcoming);

    const schedulingTask = executeScheduleBatch({
      accountId,
      chatId,
      pendingMessages,
      pendingUpcoming,
      historyScope,
      replaceMessage,
      clearMessageOnSuccess: scheduleRequest?.clearMessageOnSuccess !== false,
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
    });
      if (scheduleRequest?.waitForConfirmation) return schedulingTask;
      void schedulingTask;
      return undefined;
  }

  return { handleSchedule, handleSendDraftNow };
}
