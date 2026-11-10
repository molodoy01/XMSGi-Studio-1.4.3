import { useEffect, useRef, useState } from 'react';
import type { NotificationType, ScheduledMessage } from '@/types';
import { persistScheduleHistoryAndWait } from '@/lib/storage';
import {
  getCurrentTimeStr,
  getTodayStr,
} from '@/lib/utils';
import { useLocale } from '@/lib/i18n';
import { useConfirm } from '@/components/useConfirm';
import {
  buildValidationNotification,
  type UseSchedulerOptions,
} from './scheduler/useSchedulerUtils';
import { createSchedulerActions } from './scheduler/useSchedulerActions';
import { useSchedulerHistory } from './scheduler/useSchedulerHistory';
import { createSchedulerCancellationActions } from './scheduler/useSchedulerCancellationActions';
import { createSchedulerQueuedActions } from './scheduler/useSchedulerQueuedActions';

export function useScheduler({
  historyScope = 'personal',
  accountId = 'account-1',
  connected,
  selectedChat,
  chats,
  message,
  composerAttachments = [],
  composerEntities = [],
  showNotification,
  setMessage,
  refreshChatPermissions,
}: UseSchedulerOptions) {
  const { t } = useLocale();
  const confirm = useConfirm();
  const showValidationNotification = (message: string, type: NotificationType, title: string, code: string) => (
    buildValidationNotification(showNotification, message, type, title, code)
  );
  const [date, setDate] = useState(getTodayStr());
  const [time, setTime] = useState(getCurrentTimeStr());
  const dateEditedRef = useRef(false);
  const timeEditedRef = useRef(false);
  const resetScheduleDateTime = () => {
    dateEditedRef.current = false;
    timeEditedRef.current = false;
    setDate(getTodayStr());
    setTime(getCurrentTimeStr());
  };
  const [upcoming, setUpcoming] = useState<ScheduledMessage[]>([]);
  const [sent, setSent] = useState<ScheduledMessage[]>([]);
  const upcomingStateRef = useRef(upcoming);
  const sentStateRef = useRef(sent);
  const handleCancelMessageRef = useRef<(
    message: ScheduledMessage,
    replacementMessages?: ScheduledMessage[],
    quiet?: boolean,
  ) => Promise<boolean>>(async () => false);
  const [scheduling, setScheduling] = useState(false);
  const schedulingLockRef = useRef(false);
  const [successPulse, setSuccessPulse] = useState(false);
  const [lastAction, setLastAction] = useState<'sent' | 'scheduled' | null>(null);
  const [revealingId, setRevealingId] = useState<string | null>(null);
  const [cancelingIds, setCancelingIds] = useState<Set<string>>(new Set());
  const [sendingIds, setSendingIds] = useState<Set<string>>(new Set());
  const timeoutIdsRef = useRef<Set<number>>(new Set());
  const mountedRef = useRef(true);
  const activePublishIdsRef = useRef(new Set<string>());
  const cancelingIdsRef = useRef(new Set<string>());
  const publishingDraftLockRef = useRef(false);
  const draftSendAttemptRef = useRef<{ fingerprint: string; id: string; recordId?: string } | null>(null);
  const [publishingDraft, setPublishingDraft] = useState(false);
  const openPickerRef = useRef<'date' | 'time' | null>(null);
  const { handleCancelMessage, handleCancelMessages } = createSchedulerCancellationActions({
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
  });
  const { historyReady, historyLoadError } = useSchedulerHistory({
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
  });

  const scheduleTimeout = (callback: () => void, milliseconds: number) => {
    if (!mountedRef.current) return;

    const timeoutId = window.setTimeout(() => {
      timeoutIdsRef.current.delete(timeoutId);
      if (mountedRef.current) callback();
    }, milliseconds);
    timeoutIdsRef.current.add(timeoutId);
  };

  const { handleSendNow, handleRetry } = createSchedulerQueuedActions({
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
  });

  useEffect(() => { upcomingStateRef.current = upcoming; }, [upcoming]);
  useEffect(() => { sentStateRef.current = sent; }, [sent]);
  useEffect(() => { handleCancelMessageRef.current = handleCancelMessage; });

  useEffect(() => {
    mountedRef.current = true;
    const activeTimeoutIds = timeoutIdsRef.current;
    return () => {
      mountedRef.current = false;
      activeTimeoutIds.forEach((timeoutId) => window.clearTimeout(timeoutId));
      activeTimeoutIds.clear();
    };
  }, []);

  useEffect(() => {
    if (historyScope !== 'personal') return;

    const refreshCurrentDateTime = () => {
      if (!timeEditedRef.current) setTime(getCurrentTimeStr());
      if (!dateEditedRef.current) setDate(getTodayStr());
    };

    let timeoutId = 0;
    const scheduleTick = () => {
      refreshCurrentDateTime();
      timeoutId = window.setTimeout(scheduleTick, 1000 - (Date.now() % 1000) + 10);
    };
    const resync = () => {
      if (document.hidden) return;
      window.clearTimeout(timeoutId);
      scheduleTick();
    };
    scheduleTick();
    document.addEventListener('visibilitychange', resync);
    window.addEventListener('focus', resync);

    return () => {
      window.clearTimeout(timeoutId);
      document.removeEventListener('visibilitychange', resync);
      window.removeEventListener('focus', resync);
    };
  }, [historyScope]);

  const { handleSchedule, handleSendDraftNow } = createSchedulerActions({
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
    publishingDraftLockRef,
    setPublishingDraft,
    draftSendAttemptRef,
    sentStateRef,
    setSent,
  });

  async function handleDeleteMessage(msg: ScheduledMessage, skipConfirmation = false): Promise<boolean> {
    if (!skipConfirmation && !await confirm({
      message: t('schedule.confirmDelete'),
      confirmLabel: t('common.remove'),
      cancelLabel: t('common.cancel'),
      destructive: true,
    })) return false;

    if (msg.status !== 'sent') {
      const updatedUpcoming = upcomingStateRef.current.filter((item) => item.id !== msg.id);
      if (!await persistScheduleHistoryAndWait(historyScope, 'upcoming', updatedUpcoming)) {
        showNotification(t('schedule.historyWriteFailed'), 'warning', t('schedule.errorTitle'));
        return false;
      }
      upcomingStateRef.current = updatedUpcoming;
      setUpcoming(updatedUpcoming);
    } else {
      const updatedSent = sentStateRef.current.filter((item) => item.id !== msg.id);
      if (!await persistScheduleHistoryAndWait(historyScope, 'sent', updatedSent)) {
        showNotification(t('schedule.historyWriteFailed'), 'warning', t('schedule.errorTitle'));
        return false;
      }
      sentStateRef.current = updatedSent;
      setSent(updatedSent);
    }
    return true;
  }

  async function handleClearSent(suppressNotification = false): Promise<boolean> {
    if (!await persistScheduleHistoryAndWait(historyScope, 'sent', [])) {
      if (!suppressNotification) {
        showNotification(t('schedule.historyWriteFailed'), 'warning', t('schedule.errorTitle'));
      }
      return false;
    }
    sentStateRef.current = [];
    setSent([]);
    if (!suppressNotification) {
      showNotification(
        t('schedule.sentCleared'),
        'info',
        t('schedule.clearedTitle'),
      );
    }
    return true;
  }

  return {
    date,
    setDate,
    time,
    setTime,
    dateEditedRef,
    timeEditedRef,
    upcoming,
    setUpcoming,
    sent,
    setSent,
    scheduling: scheduling || !historyReady,
    historyReady,
    historyLoadError,
    setScheduling,
    successPulse,
    lastAction,
    setSuccessPulse,
    revealingId,
    setRevealingId,
    cancelingIds,
    sendingIds,
    publishingDraft,
    openPickerRef,
    handleSchedule,
    handleCancelMessage,
    handleCancelMessages,
    handleSendNow,
    handleRetry,
    handleSendDraftNow,
    handleDeleteMessage,
    handleClearSent,
  };
}
