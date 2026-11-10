import { useCallback, useContext, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { Chat, ScheduledMessage } from '@/types';
import { useLocale } from '@/lib/i18n';
import {
  getVisibleEmojiOptions,
  readRecentEmojis,
} from '@/lib/emojiCatalog';
import {
  EDITOR_APPEARANCE_UPDATED_EVENT,
  getEditorAppearanceCssTokens,
  readEditorAppearancePreferences,
  resolveEditorAppearanceColor,
} from '@shared/editorAppearance';
import { getMessageMaxLength } from '@/lib/messageLimits';
import { loadFreeTelegramMessageEffects, type TelegramMessageEffect } from '@/lib/telegramMessageEffects';
import { blurFocusedTopbarAction, QuickPlannerNavigationContext } from '../workspace/QuickPlannerNavigationContext';
import {
  MAX_PLANNER_ATTACHMENTS,
  flushPlannerDraftWrite,
  readPlannerDraft,
  readPlannerDraftAttachments,
  readPlannerDraftEntities,
  readPlannerDraftRecoveryStack,
  writePlannerDraft,
  writePlannerDraftRecoveryStack,
  type PlannerDraftRecoverySnapshot,
} from '../lib/plannerDraft';
import './QuickPlanner.css';
import { QuickPlannerView } from './QuickPlannerView';
import { createQuickPlannerInputActions } from './quickPlanner/quickPlannerInputActions';
import {
  feedbackDurationMs,
  getAttachmentName,
  getNextScheduleDateTime,
  getUpcomingMessages,
  restoredDraftFeedbackDurationMs,
  toDateInputValue,
  toLocalDateTime,
  formatTimeValue,
  formatTimeZoneOffset,
  type ChatPickerOption,
  type PlannerAttachment,
  type QuickPlannerActionFeedback,
  type QuickPlannerProps,
} from './quickPlanner/quickPlannerUtils';
import { buildCalendarMonthMeta } from './quickPlanner/quickPlannerCalendar';

function toPlannerRecoveryChat(chat: Chat | null): Chat | null {
  if (!chat) return null;
  return {
    id: chat.id,
    name: chat.name,
    ...(chat.username ? { username: chat.username } : {}),
    ...(chat.type ? { type: chat.type } : {}),
  };
}

export function QuickPlanner({
  draftLoadRequest = null,
  onRestoreDraft,
  chats = [],
  selectedChat: activeChat = null,
  upcoming = [],
  sent = [],
  historyReady = true,
  historyError = false,
  onSelectChat,
  onRemoveChat,
  onOpenInStudio,
  onDraftLoadAccepted,
  onSendNow,
  onSchedule,
  onSaveDraft,
  feedbackPreview,
  connectionRecoveryStatus = null,
  connectionRecoveryNoticeStatus = connectionRecoveryStatus,
}: QuickPlannerProps) {
  const { locale, t } = useLocale();
  const [selectedMode, setSelectedMode] = useState('Send now');
  const [message, setMessage] = useState(readPlannerDraft);
  const [messageInputFocused, setMessageInputFocused] = useState(false);
  const [messageEntities, setMessageEntities] = useState(readPlannerDraftEntities);
  const lastLoadedDraftRevisionRef = useRef<number | null>(null);
  const initialAttachmentLimitRef = useRef(false);
  const recoveryStackInitializedRef = useRef(false);
  const restoreDraftOnCompletionRef = useRef<PlannerDraftRecoverySnapshot[]>([]);
  const activeReplacementRef = useRef<ScheduledMessage | null>(null);
  const [currentTime, setCurrentTime] = useState(() => new Date());
  const activityNow = new Date();
  const upcomingMessages = getUpcomingMessages(upcoming, activityNow);
  const [initialScheduleDateTime] = useState(() => getNextScheduleDateTime(currentTime));
  const [selectedDate, setSelectedDate] = useState(initialScheduleDateTime.date);
  const [selectedTime, setSelectedTime] = useState(initialScheduleDateTime.time);
  const [scheduleTimeTouched, setScheduleTimeTouched] = useState(false);
  const [activeSchedulePicker, setActiveSchedulePicker] = useState<'date' | 'time' | null>(null);
  const [scheduleTimeDraft, setScheduleTimeDraft] = useState<string | null>(null);
  const [calendarCursor, setCalendarCursor] = useState(() => new Date());
  const [schedulePickerPosition, setSchedulePickerPosition] = useState({ top: 8, left: 8, maxHeight: 276 });
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);
  const [emojiModifierHeld, setEmojiModifierHeld] = useState(false);
  const [emojiCategoryId, setEmojiCategoryId] = useState('faces');
  const [emojiSearchQuery, setEmojiSearchQuery] = useState('');
  const [emojiActiveIndex, setEmojiActiveIndex] = useState(0);
  const [emojiCommandRange, setEmojiCommandRange] = useState<{ start: number; end: number } | null>(null);
  const [recentEmojis, setRecentEmojis] = useState(readRecentEmojis);
  const [effectPickerOpen, setEffectPickerOpen] = useState(false);
  const [availableEffects, setAvailableEffects] = useState<TelegramMessageEffect[]>([]);
  const [selectedEffectId, setSelectedEffectId] = useState<string | null>(null);
  const [attachments, setAttachments] = useState<PlannerAttachment[]>(() => {
    const paths = readPlannerDraftAttachments();
    initialAttachmentLimitRef.current = paths.length > MAX_PLANNER_ATTACHMENTS;
    return paths.slice(0, MAX_PLANNER_ATTACHMENTS).map((path) => ({ name: getAttachmentName(path), path }));
  });
  const plannerDraftStateRef = useRef({
    message,
    entities: messageEntities,
    attachmentPaths: attachments.map(({ path }) => path),
    effect: selectedEffectId,
  });
  plannerDraftStateRef.current = {
    message,
    entities: messageEntities,
    attachmentPaths: attachments.map(({ path }) => path),
    effect: selectedEffectId,
  };
  const [isFileDragOver, setIsFileDragOver] = useState(false);
  const [attachmentScroll, setAttachmentScroll] = useState({ max: 0, position: 0, contentWidth: 0 });
  const [editorAppearance, setEditorAppearance] = useState(readEditorAppearancePreferences);
  const [actionFeedback, setActionFeedback] = useState<QuickPlannerActionFeedback | null>(null);
  const [actionFeedbackInstance, setActionFeedbackInstance] = useState(0);
  const [actionFeedbackRetriggered, setActionFeedbackRetriggered] = useState(false);
  const [chatPickerOpen, setChatPickerOpen] = useState(false);
  const [chatQuery, setChatQuery] = useState('');
  const [selectedChatId, setSelectedChatId] = useState(activeChat?.id ?? '');
  const [removedChatIds, setRemovedChatIds] = useState<string[]>([]);
  const isScheduleMode = selectedMode === 'Schedule';
  const isDraftMode = selectedMode === 'Draft';
  const normalizedEmojiSearchQuery = emojiSearchQuery.trim().toLocaleLowerCase();
  const visibleEmojiOptions = getVisibleEmojiOptions(emojiSearchQuery, emojiCategoryId as 'faces' | 'hands' | 'hearts' | 'nature' | 'food' | 'fun', Boolean(emojiCommandRange));
  const appearanceMode = selectedMode === 'Send now' ? 'send' : isDraftMode ? 'draft' : 'schedule';
  const plannerAccent = resolveEditorAppearanceColor(editorAppearance, appearanceMode);
  const plannerAccentRgb = getEditorAppearanceCssTokens(editorAppearance, appearanceMode)['--editor-outline'];
  const timeZoneLabel = formatTimeZoneOffset(toLocalDateTime(selectedDate, selectedTime));
  const minimumScheduleDate = getNextScheduleDateTime(currentTime);
  const minimumScheduleDateTime = toLocalDateTime(minimumScheduleDate.date, minimumScheduleDate.time);
  const minimumScheduleDateValue = toDateInputValue(minimumScheduleDateTime);
  const minimumScheduleTimeValue = formatTimeValue(minimumScheduleDateTime);
  const {
    monthKey: calendarMonthKey,
    monthLabel: calendarMonthLabel,
    weekdayLabels: calendarWeekdayLabels,
    dayCount: calendarDayCount,
    firstWeekdayOffset: calendarFirstWeekdayOffset,
  } = buildCalendarMonthMeta(calendarCursor, locale === 'ru' ? 'ru' : 'en');
  const minimumMonthKey = Number(minimumScheduleDateValue.slice(0, 4)) * 12 + Number(minimumScheduleDateValue.slice(5, 7)) - 1;
  const todayScheduleDateValue = toDateInputValue(new Date());
  const messageMaxLength = getMessageMaxLength(attachments.length > 0);
  const submitLabel = selectedMode === 'Send now' ? t('studio.sendNow') : selectedMode === 'Draft' ? t('quickPlanner.saveDraftAction') : t('quickPlanner.schedulePost');
  const { currentSection, openStudio } = useContext(QuickPlannerNavigationContext);
  const chatPickerRef = useRef<HTMLDivElement>(null);
  const toolsRowRef = useRef<HTMLDivElement>(null);
  const effectsToolRef = useRef<HTMLDivElement>(null);
  const emojiToolRef = useRef<HTMLDivElement>(null);
  const emojiPickerPanelRef = useRef<HTMLDivElement>(null);
  const scheduleRowRef = useRef<HTMLDivElement>(null);
  const scheduleDateTriggerRef = useRef<HTMLButtonElement>(null);
  const scheduleTimeTriggerRef = useRef<HTMLButtonElement>(null);
  const scheduleDatePickerRef = useRef<HTMLDivElement>(null);
  const scheduleTimePickerRef = useRef<HTMLDivElement>(null);
  const chatTriggerRef = useRef<HTMLButtonElement>(null);
  const chatSearchRef = useRef<HTMLInputElement>(null);
  const workbenchRef = useRef<HTMLElement>(null);
  const messageInputRef = useRef<HTMLTextAreaElement>(null);
  const attachmentInputRef = useRef<HTMLInputElement>(null);
  const attachmentScrollbarRef = useRef<HTMLDivElement>(null);
  const attachmentListRef = useRef<HTMLDivElement>(null);
  const actionFeedbackTimeoutRef = useRef<number | null>(null);
  const scheduleNowConfirmationRef = useRef<string | null>(null);
  const emojiReleaseCloseTimeoutRef = useRef<number | null>(null);
  const emojiSelectionWaitingForReleaseRef = useRef(false);

  useEffect(() => {
    writePlannerDraft(message, messageEntities, attachments.map(({ path }) => path));
  }, [attachments, message, messageEntities]);

  const applyPlannerRecoverySnapshot = (draft: PlannerDraftRecoverySnapshot) => {
    writePlannerDraft(draft.text, draft.entities, draft.attachments);
    if (!flushPlannerDraftWrite()) return false;
    setMessage(draft.text);
    setMessageEntities(draft.entities);
    setAttachments(draft.attachments.map((path) => ({ name: getAttachmentName(path), path })));
    setSelectedEffectId(draft.effect);
    activeReplacementRef.current = draft.replacementMessage ?? null;
    setSelectedMode(draft.mode);
    setSelectedDate(draft.date || initialScheduleDateTime.date);
    setSelectedTime(draft.time || initialScheduleDateTime.time);
    setScheduleTimeTouched(draft.scheduleTimeTouched);
    onSelectChat?.(draft.selectedChat);
    onRestoreDraft?.(draft, restoreDraftOnCompletionRef.current);
    return true;
  };

  const popPlannerRecoveryDraft = () => {
    const stack = restoreDraftOnCompletionRef.current;
    if (stack.length === 0) {
      writePlannerDraft('', [], []);
      if (!flushPlannerDraftWrite()) return false;
      setMessage('');
      setMessageEntities([]);
      setAttachments([]);
      setSelectedEffectId(null);
      activeReplacementRef.current = null;
      onRestoreDraft?.(null, []);
      return true;
    }

    const nextStack = stack.slice(0, -1);
    if (!writePlannerDraftRecoveryStack(nextStack)) return false;
    restoreDraftOnCompletionRef.current = nextStack;
    if (!applyPlannerRecoverySnapshot(stack[stack.length - 1]!)) {
      if (!writePlannerDraftRecoveryStack(stack)) {
        console.error('Failed to restore the Planner recovery stack after restoring its active draft failed.');
      }
      restoreDraftOnCompletionRef.current = stack;
      return false;
    }
    return true;
  };

  const hasPreviousDraftToRestore = () => {
    return restoreDraftOnCompletionRef.current.length > 0;
  };

  const clearCompletedDraft = () => {
    writePlannerDraft('', [], []);
    if (!flushPlannerDraftWrite()) return false;
    setMessage('');
    setMessageEntities([]);
    setAttachments([]);
    setSelectedEffectId(null);
    activeReplacementRef.current = null;
    resetScheduleDateTime();
    onRestoreDraft?.(null, restoreDraftOnCompletionRef.current);
    return true;
  };

  const showCompletionFeedback = (message: string) => {
    const restorePreviousDraft = hasPreviousDraftToRestore();
    if (restorePreviousDraft) {
      if (!popPlannerRecoveryDraft()) {
        showActionFeedback(t('quickPlanner.couldNotSaveDraft'), 'error');
        return;
      }
      showActionFeedback(message, 'success', {
        message: t('quickPlanner.previousTextRestored'),
        tone: 'success',
        durationMs: restoredDraftFeedbackDurationMs,
      });
      return;
    }
    if (!clearCompletedDraft()) {
      showActionFeedback(t('quickPlanner.couldNotSaveDraft'), 'error');
      return;
    }
    showActionFeedback(message, 'success');
  };

  useLayoutEffect(() => {
    const list = attachmentListRef.current;
    const scrollbar = attachmentScrollbarRef.current;
    if (!list || !scrollbar) return undefined;

    const updateMetrics = () => {
      const max = Math.max(0, list.scrollWidth - list.clientWidth);
      const position = Math.min(list.scrollLeft, max);
      if (list.scrollLeft !== position) list.scrollLeft = position;
      if (scrollbar.scrollLeft !== position) scrollbar.scrollLeft = position;
      const contentWidth = Math.max(list.scrollWidth, list.clientWidth);
      setAttachmentScroll((current) => current.max === max
        && current.position === position
        && current.contentWidth === contentWidth
        ? current
        : { max, position, contentWidth });
    };

    const syncFromList = () => {
      if (scrollbar.scrollLeft !== list.scrollLeft) scrollbar.scrollLeft = list.scrollLeft;
      setAttachmentScroll((current) => current.position === list.scrollLeft
        ? current
        : { ...current, position: list.scrollLeft });
    };

    const syncFromScrollbar = () => {
      if (list.scrollLeft !== scrollbar.scrollLeft) list.scrollLeft = scrollbar.scrollLeft;
      setAttachmentScroll((current) => current.position === scrollbar.scrollLeft
        ? current
        : { ...current, position: scrollbar.scrollLeft });
    };

    const resizeObserver = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(updateMetrics);
    resizeObserver?.observe(list);
    Array.from(list.children).forEach((child) => resizeObserver?.observe(child));
    list.addEventListener('scroll', syncFromList, { passive: true });
    scrollbar.addEventListener('scroll', syncFromScrollbar, { passive: true });
    window.addEventListener('resize', updateMetrics);
    updateMetrics();

    return () => {
      resizeObserver?.disconnect();
      list.removeEventListener('scroll', syncFromList);
      scrollbar.removeEventListener('scroll', syncFromScrollbar);
      window.removeEventListener('resize', updateMetrics);
    };
  }, [attachments.length]);

  const sourceChats = activeChat && !chats.some((chat) => chat.id === activeChat.id)
    ? [activeChat, ...chats]
    : chats;
  const pickerChats: ChatPickerOption[] = sourceChats.map((chat) => ({
      id: chat.id,
      name: chat.name,
      type: chat.type === 'private' ? t('studio.privateChat')
          : chat.type === 'group' ? t('studio.groupChat')
          : chat.type === 'supergroup' ? t('studio.supergroup')
            : chat.type === 'channel' ? t('studio.channelType') : t('studio.chatType'),
      avatarDataUrl: chat.avatarDataUrl,
      sourceChat: chat,
    }));
  const availablePickerChats = pickerChats.filter((chat) => !removedChatIds.includes(chat.id));
  const selectedPickerChat = (activeChat && availablePickerChats.find((chat) => chat.id === activeChat.id))
    ?? availablePickerChats.find((chat) => chat.id === selectedChatId)
    ?? availablePickerChats[0]
    ?? null;
  const filteredChats = availablePickerChats.filter((chat) => (
    `${chat.name} ${chat.type}`.toLowerCase().includes(chatQuery.trim().toLowerCase())
  ));

  const removePickerChat = (chat: ChatPickerOption) => {
    if (chat.sourceChat && onRemoveChat) {
      onRemoveChat(chat.sourceChat);
      return;
    }

    setRemovedChatIds((current) => current.includes(chat.id) ? current : [...current, chat.id]);
    if (chat.id === selectedChatId || chat.id === activeChat?.id) {
      const nextChat = availablePickerChats.find((candidate) => candidate.id !== chat.id);
      setSelectedChatId(nextChat?.id ?? '');
      onSelectChat?.(null);
    }
  };

  const setScheduleDateTimeWithinRange = (dateValue: string, timeValue: string) => {
    setScheduleTimeTouched(true);
    scheduleNowConfirmationRef.current = null;
    const candidate = toLocalDateTime(dateValue, timeValue);
    if (candidate.getTime() <= minimumScheduleDateTime.getTime()) {
      setSelectedDate(minimumScheduleDateValue);
      setSelectedTime(minimumScheduleTimeValue);
      return;
    }
    setSelectedDate(dateValue);
    setSelectedTime(timeValue);
  };

  const resetScheduleDateTime = () => {
    const now = new Date();
    const nextAvailable = getNextScheduleDateTime(now);
    setCurrentTime(now);
    setSelectedDate(nextAvailable.date);
    setSelectedTime(nextAvailable.time);
    setScheduleTimeTouched(false);
    scheduleNowConfirmationRef.current = null;
    setCalendarCursor(now);
  };

  useEffect(() => {
    let timeoutId = 0;
    const tick = () => {
      setCurrentTime(new Date());
      timeoutId = window.setTimeout(tick, 60_000 - (Date.now() % 60_000) + 25);
    };
    const resync = () => {
      if (document.hidden) return;
      window.clearTimeout(timeoutId);
      tick();
    };
    tick();
    document.addEventListener('visibilitychange', resync);
    window.addEventListener('focus', resync);
    return () => {
      window.clearTimeout(timeoutId);
      document.removeEventListener('visibilitychange', resync);
      window.removeEventListener('focus', resync);
    };
  }, []);

  const showActionFeedback = useCallback((
    message: string,
    tone: QuickPlannerActionFeedback['tone'],
    nextFeedback?: Pick<QuickPlannerActionFeedback, 'message' | 'tone'> & { durationMs?: number },
  ) => {
    if (actionFeedbackTimeoutRef.current !== null) {
      window.clearTimeout(actionFeedbackTimeoutRef.current);
    }

    setActionFeedbackRetriggered(actionFeedback?.message === message && actionFeedback.tone === tone);
    setActionFeedbackInstance((instance) => instance + 1);
    setActionFeedback({ message, tone });
    actionFeedbackTimeoutRef.current = window.setTimeout(() => {
      if (nextFeedback) {
        setActionFeedbackRetriggered(false);
        setActionFeedbackInstance((instance) => instance + 1);
        setActionFeedback(nextFeedback);
        actionFeedbackTimeoutRef.current = window.setTimeout(() => {
          setActionFeedback(null);
          setActionFeedbackRetriggered(false);
          actionFeedbackTimeoutRef.current = null;
        }, nextFeedback.durationMs ?? feedbackDurationMs[nextFeedback.tone]);
        return;
      }
      setActionFeedback(null);
      setActionFeedbackRetriggered(false);
      actionFeedbackTimeoutRef.current = null;
    }, feedbackDurationMs[tone]);
  }, [actionFeedback]);

  useEffect(() => {
    if (recoveryStackInitializedRef.current) return;
    recoveryStackInitializedRef.current = true;
    try {
      restoreDraftOnCompletionRef.current = readPlannerDraftRecoveryStack();
    } catch (error) {
      console.error('Failed to initialize Planner recovery drafts.', error);
      showActionFeedback(t('quickPlanner.couldNotSaveDraft'), 'error');
    }
  }, [showActionFeedback, t]);

  useEffect(() => {
    if (!draftLoadRequest || lastLoadedDraftRevisionRef.current === draftLoadRequest.revision) return;
    let recoveryStack: PlannerDraftRecoverySnapshot[];
    try {
      recoveryStack = readPlannerDraftRecoveryStack();
    } catch (error) {
      lastLoadedDraftRevisionRef.current = draftLoadRequest.revision;
      console.error('Failed to read Planner recovery drafts.', error);
      showActionFeedback(t('quickPlanner.couldNotSaveDraft'), 'error');
      return;
    }
    const previousRecoveryStack = [...recoveryStack];

    if (draftLoadRequest.clearDraft) {
      recoveryStack = [];
    } else if (recoveryStack.length === 0) {
      const legacyDraft = draftLoadRequest.restoreDraft;
      const legacyHasContent = legacyDraft
        && (legacyDraft.text.trim().length > 0 || legacyDraft.attachments.length > 0);
      recoveryStack = draftLoadRequest.restoreDrafts ?? (legacyHasContent
        ? [{
          ...legacyDraft,
          selectedChat: null,
          effect: null,
          mode: 'Send now',
          date: '',
          time: '',
          scheduleTimeTouched: false,
        }]
        : []);
    }
    const currentSnapshot: PlannerDraftRecoverySnapshot = {
      text: message,
      attachments: attachments.map(({ path }) => path),
      entities: messageEntities,
      selectedChat: toPlannerRecoveryChat(activeChat),
      effect: selectedEffectId,
      mode: selectedMode,
      date: selectedDate,
      time: selectedTime,
      scheduleTimeTouched,
      replacementMessage: activeReplacementRef.current,
    };
    const incomingSnapshot: PlannerDraftRecoverySnapshot = {
      text: draftLoadRequest.text,
      attachments: draftLoadRequest.attachments.slice(0, MAX_PLANNER_ATTACHMENTS),
      entities: draftLoadRequest.entities,
      selectedChat: draftLoadRequest.selectedChat === undefined
        ? toPlannerRecoveryChat(activeChat)
        : toPlannerRecoveryChat(draftLoadRequest.selectedChat),
      effect: draftLoadRequest.effect ?? draftLoadRequest.rescheduleMessage?.effect ?? null,
      mode: draftLoadRequest.mode ?? (draftLoadRequest.rescheduleMessage ? 'Schedule' : selectedMode),
      date: draftLoadRequest.rescheduleMessage
        ? toDateInputValue(new Date(draftLoadRequest.rescheduleMessage.when))
        : draftLoadRequest.date ?? selectedDate,
      time: draftLoadRequest.rescheduleMessage
        ? formatTimeValue(new Date(draftLoadRequest.rescheduleMessage.when))
        : draftLoadRequest.time ?? selectedTime,
      scheduleTimeTouched: draftLoadRequest.rescheduleMessage
        ? true
        : draftLoadRequest.scheduleTimeTouched ?? scheduleTimeTouched,
      replacementMessage: draftLoadRequest.rescheduleMessage ?? null,
    };
    const hasCurrentContent = currentSnapshot.text.trim() || currentSnapshot.attachments.length > 0;
    const sameDraft = (left: PlannerDraftRecoverySnapshot, right: PlannerDraftRecoverySnapshot) => (
      left.text === right.text
      && JSON.stringify(left.entities) === JSON.stringify(right.entities)
      && JSON.stringify(left.attachments) === JSON.stringify(right.attachments)
      && left.selectedChat?.id === right.selectedChat?.id
      && left.effect === right.effect
      && left.mode === right.mode
      && left.date === right.date
      && left.time === right.time
      && left.scheduleTimeTouched === right.scheduleTimeTouched
      && left.replacementMessage?.id === right.replacementMessage?.id
    );
    if (!draftLoadRequest.clearDraft
      && hasCurrentContent
      && (recoveryStack.length === 0 || !sameDraft(recoveryStack[recoveryStack.length - 1]!, currentSnapshot))
      && !sameDraft(currentSnapshot, incomingSnapshot)) {
      recoveryStack = [...recoveryStack, currentSnapshot];
    }
    if (!writePlannerDraftRecoveryStack(recoveryStack)) {
      lastLoadedDraftRevisionRef.current = draftLoadRequest.revision;
      showActionFeedback(t('quickPlanner.couldNotSaveDraft'), 'error');
      return;
    }
    writePlannerDraft(
      draftLoadRequest.text,
      draftLoadRequest.entities,
      draftLoadRequest.attachments.slice(0, MAX_PLANNER_ATTACHMENTS),
    );
    if (!flushPlannerDraftWrite()) {
      if (!writePlannerDraftRecoveryStack(previousRecoveryStack)) {
        console.error('Failed to roll back the Planner recovery stack after a draft load failed.');
      }
      writePlannerDraft(currentSnapshot.text, currentSnapshot.entities, currentSnapshot.attachments);
      if (!flushPlannerDraftWrite()) {
        console.error('Failed to restore the previous active Planner draft after a draft load failed.');
      }
      lastLoadedDraftRevisionRef.current = draftLoadRequest.revision;
      showActionFeedback(t('quickPlanner.couldNotSaveDraft'), 'error');
      return;
    }

    lastLoadedDraftRevisionRef.current = draftLoadRequest.revision;
    restoreDraftOnCompletionRef.current = recoveryStack;
    activeReplacementRef.current = draftLoadRequest.clearDraft
      ? null
      : draftLoadRequest.rescheduleMessage ?? null;
    setMessage(draftLoadRequest.text);
    setMessageEntities(draftLoadRequest.entities);
    setAttachments(draftLoadRequest.attachments
      .slice(0, MAX_PLANNER_ATTACHMENTS)
      .map((path) => ({ name: getAttachmentName(path), path })));
    setSelectedEffectId(incomingSnapshot.effect);
    if (!draftLoadRequest.clearDraft) onSelectChat?.(incomingSnapshot.selectedChat);
    if (draftLoadRequest.rescheduleMessage) {
      const scheduledDate = new Date(draftLoadRequest.rescheduleMessage.when);
      setSelectedMode('Schedule');
      setSelectedDate(toDateInputValue(scheduledDate));
      setSelectedTime(formatTimeValue(scheduledDate));
      setScheduleTimeTouched(true);
      setSelectedEffectId(draftLoadRequest.rescheduleMessage.effect ?? null);
      scheduleNowConfirmationRef.current = null;
    } else {
      setSelectedMode(incomingSnapshot.mode);
      setSelectedDate(incomingSnapshot.date);
      setSelectedTime(incomingSnapshot.time);
      setScheduleTimeTouched(incomingSnapshot.scheduleTimeTouched);
    }
    onDraftLoadAccepted?.(incomingSnapshot);
    if (draftLoadRequest.attachments.length > MAX_PLANNER_ATTACHMENTS
      || (draftLoadRequest.restoreDraft?.attachments.length ?? 0) > MAX_PLANNER_ATTACHMENTS) {
      showActionFeedback(t('quickPlanner.attachmentLimit', { count: MAX_PLANNER_ATTACHMENTS }), 'warning');
    }
  }, [
    activeChat, attachments, draftLoadRequest, message, messageEntities, onDraftLoadAccepted, onSelectChat,
    scheduleTimeTouched, selectedDate, selectedEffectId, selectedMode, selectedTime, showActionFeedback, t,
  ]);

  useEffect(() => {
    if (!initialAttachmentLimitRef.current) return;
    initialAttachmentLimitRef.current = false;
    if (!draftLoadRequest) {
      showActionFeedback(t('quickPlanner.attachmentLimit', { count: MAX_PLANNER_ATTACHMENTS }), 'warning');
    }
  }, [draftLoadRequest, showActionFeedback, t]);

  const clearActionFeedback = () => {
    if (actionFeedbackTimeoutRef.current !== null) {
      window.clearTimeout(actionFeedbackTimeoutRef.current);
      actionFeedbackTimeoutRef.current = null;
    }
    setActionFeedback(null);
    setActionFeedbackRetriggered(false);
  };

  const toggleEffectPicker = () => {
    const nextOpen = !effectPickerOpen;
    setEffectPickerOpen(nextOpen);
    if (nextOpen) setEmojiPickerOpen(false);
  };

  useEffect(() => {
    let active = true;
    void loadFreeTelegramMessageEffects().then((effects) => {
      if (active) setAvailableEffects(effects);
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!effectPickerOpen) return undefined;

    const handlePointerDown = (event: PointerEvent) => {
      if (!effectsToolRef.current?.contains(event.target as Node)) setEffectPickerOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setEffectPickerOpen(false);
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [effectPickerOpen]);

  useEffect(() => () => {
    if (actionFeedbackTimeoutRef.current !== null) {
      window.clearTimeout(actionFeedbackTimeoutRef.current);
    }
  }, []);

  useEffect(() => {
    const refreshEditorAppearance = () => setEditorAppearance(readEditorAppearancePreferences());
    window.addEventListener(EDITOR_APPEARANCE_UPDATED_EVENT, refreshEditorAppearance);
    window.addEventListener('storage', refreshEditorAppearance);
    return () => {
      window.removeEventListener(EDITOR_APPEARANCE_UPDATED_EVENT, refreshEditorAppearance);
      window.removeEventListener('storage', refreshEditorAppearance);
    };
  }, []);

  useEffect(() => {
    if (!chatPickerOpen) return undefined;

    const handlePointerDown = (event: PointerEvent) => {
      if (!chatPickerRef.current?.contains(event.target as Node)) {
        setChatPickerOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setChatPickerOpen(false);
        chatTriggerRef.current?.focus();
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    chatSearchRef.current?.focus();

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [chatPickerOpen]);

  useEffect(() => {
    if (!emojiPickerOpen) return undefined;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!toolsRowRef.current?.contains(target) && !emojiPickerPanelRef.current?.contains(target)) {
        setEmojiPickerOpen(false);
        setEmojiModifierHeld(false);
        setEmojiSearchQuery('');
        setEmojiCommandRange(null);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Control' || event.key === 'Meta') setEmojiModifierHeld(true);
      if (event.key === 'Escape') {
        if (emojiReleaseCloseTimeoutRef.current !== null) {
          window.clearTimeout(emojiReleaseCloseTimeoutRef.current);
          emojiReleaseCloseTimeoutRef.current = null;
        }
        emojiSelectionWaitingForReleaseRef.current = false;
        setEmojiModifierHeld(false);
        setEmojiPickerOpen(false);
        setEmojiSearchQuery('');
        setEmojiCommandRange(null);
      }
    };
    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.key === 'Control' || event.key === 'Meta') setEmojiModifierHeld(false);
      if ((event.key !== 'Control' && event.key !== 'Meta') || !emojiSelectionWaitingForReleaseRef.current) return;
      emojiSelectionWaitingForReleaseRef.current = false;
      if (emojiReleaseCloseTimeoutRef.current !== null) window.clearTimeout(emojiReleaseCloseTimeoutRef.current);
      emojiReleaseCloseTimeoutRef.current = window.setTimeout(() => {
        emojiReleaseCloseTimeoutRef.current = null;
        setEmojiPickerOpen(false);
        setEmojiSearchQuery('');
        setEmojiCommandRange(null);
      }, 700);
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keyup', handleKeyUp);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('keyup', handleKeyUp);
      if (emojiReleaseCloseTimeoutRef.current !== null) {
        window.clearTimeout(emojiReleaseCloseTimeoutRef.current);
        emojiReleaseCloseTimeoutRef.current = null;
      }
      emojiSelectionWaitingForReleaseRef.current = false;
    };
  }, [emojiPickerOpen]);

  useLayoutEffect(() => {
    if (!emojiPickerOpen) return undefined;

    const updateEmojiPickerPosition = () => {
      const anchor = emojiToolRef.current;
      const picker = emojiPickerPanelRef.current;
      if (!anchor || !picker) return;

      const anchorRect = anchor.getBoundingClientRect();
      const pickerRect = picker.getBoundingClientRect();
      const viewportInset = 12;
      const sideGap = 5;
      const maxLeft = Math.max(viewportInset, window.innerWidth - pickerRect.width - viewportInset);
      const rightSideLeft = anchorRect.right + sideGap;
      const left = rightSideLeft <= maxLeft
        ? rightSideLeft
        : Math.max(viewportInset, anchorRect.left - pickerRect.width - sideGap);
      const maxTop = Math.max(viewportInset, window.innerHeight - pickerRect.height - viewportInset);
      const centeredTop = anchorRect.top + (anchorRect.height - pickerRect.height) / 2 + 7;
      const top = Math.min(maxTop, Math.max(viewportInset, centeredTop));

      picker.style.left = `${Math.min(maxLeft, left)}px`;
      picker.style.top = `${top}px`;
    };

    updateEmojiPickerPosition();
    window.addEventListener('resize', updateEmojiPickerPosition);
    window.addEventListener('scroll', updateEmojiPickerPosition, true);
    return () => {
      window.removeEventListener('resize', updateEmojiPickerPosition);
      window.removeEventListener('scroll', updateEmojiPickerPosition, true);
    };
  }, [emojiPickerOpen]);

  useEffect(() => {
    const handleEmojiShortcut = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.key !== '.') return;
      event.preventDefault();
      setEffectPickerOpen(false);
      setEmojiPickerOpen(true);
      setEmojiSearchQuery('');
      setEmojiCommandRange(null);
      setEmojiActiveIndex(0);
    };

    document.addEventListener('keydown', handleEmojiShortcut);
    return () => document.removeEventListener('keydown', handleEmojiShortcut);
  }, []);

  useEffect(() => {
    if (!activeSchedulePicker) return undefined;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (
        !scheduleRowRef.current?.contains(target)
        && !scheduleDatePickerRef.current?.contains(target)
        && !scheduleTimePickerRef.current?.contains(target)
      ) {
        setActiveSchedulePicker(null);
        setScheduleTimeDraft(null);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setActiveSchedulePicker(null);
        setScheduleTimeDraft(null);
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [activeSchedulePicker]);

  useEffect(() => {
    const handlePlannerEscape = (event: KeyboardEvent) => {
      if (
        event.key !== 'Escape'
        || currentSection !== 'quick-plan'
        || chatPickerOpen
        || emojiPickerOpen
        || effectPickerOpen
        || activeSchedulePicker
      ) return;

      event.preventDefault();
      blurFocusedTopbarAction();
      openStudio();
    };

    document.addEventListener('keydown', handlePlannerEscape);
    return () => document.removeEventListener('keydown', handlePlannerEscape);
  }, [activeSchedulePicker, chatPickerOpen, currentSection, effectPickerOpen, emojiPickerOpen, openStudio]);

  useLayoutEffect(() => {
    if (!activeSchedulePicker) return undefined;

    const updateSchedulePickerPosition = () => {
      const anchor = activeSchedulePicker === 'date'
        ? scheduleDateTriggerRef.current
        : scheduleTimeTriggerRef.current;
      const picker = activeSchedulePicker === 'date'
        ? scheduleDatePickerRef.current
        : scheduleTimePickerRef.current;
      if (!anchor || !picker) return;

      const anchorBounds = anchor.getBoundingClientRect();
      const width = activeSchedulePicker === 'date' ? 246 : 172;
      const maxHeight = Math.max(80, Math.min(276, window.innerHeight - 16, anchorBounds.top - 16));
      const pickerHeight = Math.min(picker.getBoundingClientRect().height || maxHeight, maxHeight);
      const top = Math.max(8, anchorBounds.top - pickerHeight - 7);
      const left = Math.max(8, Math.min(anchorBounds.left, window.innerWidth - width - 8));
      setSchedulePickerPosition({ top, left, maxHeight });
    };

    updateSchedulePickerPosition();
    window.addEventListener('resize', updateSchedulePickerPosition);
    window.addEventListener('scroll', updateSchedulePickerPosition, true);
    return () => {
      window.removeEventListener('resize', updateSchedulePickerPosition);
      window.removeEventListener('scroll', updateSchedulePickerPosition, true);
    };
  }, [activeSchedulePicker, calendarCursor]);

  useEffect(() => {
    if (activeSchedulePicker !== 'time') return;
    const timePicker = scheduleTimePickerRef.current?.querySelector('.quick-planner-time-list');
    const selectedOption = timePicker?.querySelector<HTMLButtonElement>('[aria-selected="true"]');
    const firstAvailableOption = timePicker?.querySelector<HTMLButtonElement>('[role="option"]:not(:disabled)');
    const targetOption = selectedOption && !selectedOption.disabled
      ? selectedOption
      : firstAvailableOption ?? selectedOption;
    targetOption?.scrollIntoView?.({ block: 'center' });
  }, [activeSchedulePicker, minimumScheduleTimeValue, selectedDate, selectedTime]);

  const {
    insertEmoji,
    toggleEmojiPicker,
    handleEmojiPickerKeyDown,
    applyQuickTime,
    handleAttachmentFiles,
    handleMessagePaste,
    handleAttachmentChange,
  } = createQuickPlannerInputActions({
    message,
    setMessage,
    messageMaxLength,
    messageInputRef,
    setMessageEntities,
    emojiCommandRange,
    setEmojiCommandRange,
    setEmojiSearchQuery,
    setRecentEmojis,
    setEmojiPickerOpen,
    emojiPickerOpen,
    setEffectPickerOpen,
    setEmojiActiveIndex,
    emojiReleaseCloseTimeoutRef,
    emojiSelectionWaitingForReleaseRef,
    normalizedEmojiSearchQuery,
    visibleEmojiOptions,
    emojiActiveIndex,
    selectedDate,
    selectedTime,
    setScheduleTimeTouched,
    scheduleNowConfirmationRef,
    setSelectedDate,
    setSelectedTime,
    attachments,
    setAttachments,
    showActionFeedback,
    t,
  });

  const handleSubmit = async () => {
    if (selectedMode === 'Send now' && connectionRecoveryStatus === 'offline') {
      showActionFeedback(t('telegramStatus.offlineMessage'), 'error');
      return;
    }
    if (!message.trim() && attachments.length === 0) {
      showActionFeedback(t('quickPlanner.writeMessage'), 'warning');
      return;
    }
    if (isScheduleMode) {
      const selectedScheduleDateTime = toLocalDateTime(selectedDate, selectedTime);
      const confirmationKey = JSON.stringify([
        selectedDate,
        selectedTime,
        selectedPickerChat?.sourceChat?.id,
        message,
        attachments.map(({ path }) => path),
        selectedEffectId,
      ]);

      if (!scheduleTimeTouched) {
        if (scheduleNowConfirmationRef.current !== confirmationKey) {
          scheduleNowConfirmationRef.current = confirmationKey;
          showActionFeedback(t('quickPlanner.scheduleNowConfirmation'), 'warning');
          return;
        }
      } else {
        scheduleNowConfirmationRef.current = null;
      }

      if (scheduleTimeTouched && selectedScheduleDateTime.getTime() < minimumScheduleDateTime.getTime()) {
        showActionFeedback(t('quickPlanner.scheduleAtLeastOneMinute'), 'warning');
        return;
      }
    }
    if (isDraftMode) {
      if (onSaveDraft) {
        if (!onSaveDraft({
          message,
          attachments: attachments.map(({ path }) => path),
          entities: messageEntities,
          selectedChat: selectedPickerChat?.sourceChat ?? null,
        })) {
          showActionFeedback(t('quickPlanner.couldNotSaveDraft'), 'error');
          return;
        }
        showCompletionFeedback(t('quickPlanner.draftSavedToPosts'));
        return;
      }
      showActionFeedback(t('quickPlanner.couldNotSaveDraft'), 'error');
    } else if (selectedMode === 'Send now') {
      if (onSendNow) {
        const chat = selectedPickerChat?.sourceChat;
        if (!chat) {
          showActionFeedback(t('quickPlanner.selectConnectedChat'), 'warning');
          return;
        }
        try {
          const sent = await onSendNow(
            chat,
            message,
            attachments.length > 0 ? attachments.map(({ path }) => path) : undefined,
            selectedEffectId ?? undefined,
            messageEntities,
          );
          if (sent === 'sent-history-failed') {
            resetScheduleDateTime();
            showActionFeedback(t('schedule.historyWriteFailed'), 'warning');
            return;
          }
          if (!sent) {
            showActionFeedback(t('quickPlanner.messageNotSent'), 'error');
            return;
          }
          showCompletionFeedback(t('quickPlanner.messageSent'));
        } catch {
          showActionFeedback(t('quickPlanner.messageCouldNotSend'), 'error');
        }
        return;
      }
      showActionFeedback(t('quickPlanner.messageCouldNotSend'), 'error');
    } else {
      if (onSchedule) {
        const chat = selectedPickerChat?.sourceChat;
        if (!chat) {
          showActionFeedback(t('quickPlanner.selectConnectedChat'), 'warning');
          return;
        }
        try {
          const scheduled = await onSchedule({
            chatId: chat.id,
            message,
            date: selectedDate,
            time: selectedTime,
            ...(attachments.length > 0 ? { attachments: attachments.map(({ path }) => path) } : {}),
            ...(selectedEffectId ? { effect: selectedEffectId } : {}),
            entities: messageEntities,
            ...(activeReplacementRef.current ? {
              silent: activeReplacementRef.current.silent,
              replaceMessage: activeReplacementRef.current,
            } : {}),
          });
          if (scheduled === 'sent-history-failed') {
            resetScheduleDateTime();
            showActionFeedback(t('schedule.historyWriteFailed'), 'warning');
            return;
          }
          if (!scheduled) {
            showActionFeedback(t('quickPlanner.messageCouldNotSchedule'), 'error');
            return;
          }
          showCompletionFeedback(t('quickPlanner.scheduleRequestSent'));
        } catch {
          showActionFeedback(t('quickPlanner.messageCouldNotSchedule'), 'error');
        }
        return;
      }
      showActionFeedback(t('quickPlanner.messageCouldNotSchedule'), 'error');
    }
  };

  const handleOpenInStudio = async () => {
    if (!message.trim() && attachments.length === 0) {
      showActionFeedback(t('quickPlanner.writeBeforeStudio'), 'warning');
      return;
    }
    if (onOpenInStudio) {
      const payload = {
        text: message,
        attachments: attachments.map(({ path }) => path),
        entities: messageEntities,
        ...(selectedEffectId ? { effect: selectedEffectId } : {}),
      };
      try {
        const opened = await onOpenInStudio(payload);
        if (!opened) return;

        const currentDraft = plannerDraftStateRef.current;
        const sameContent = currentDraft.message === payload.text
          && JSON.stringify(currentDraft.entities) === JSON.stringify(payload.entities)
          && currentDraft.attachmentPaths.length === payload.attachments.length
          && currentDraft.attachmentPaths.every((path, index) => path === payload.attachments[index])
          && currentDraft.effect === (payload.effect ?? null);
        if (!sameContent) return;

        const restoredPreviousDraft = hasPreviousDraftToRestore();
        const persisted = restoredPreviousDraft
          ? popPlannerRecoveryDraft()
          : clearCompletedDraft();
        if (!persisted) {
          showActionFeedback(t('quickPlanner.openedInStudioButDraftCouldNotClear'), 'warning');
          return;
        }
        if (restoredPreviousDraft) {
          showActionFeedback(t('quickPlanner.previousTextRestored'), 'success');
        }
      } catch {
        showActionFeedback(t('quickPlanner.openStudioFailed'), 'error');
      }
      return;
    }
    openStudio();
  };

  const visibleActionFeedback = feedbackPreview !== undefined ? feedbackPreview : actionFeedback;

  return (
    <QuickPlannerView
      {...{
    upcoming,
    sent,
    historyReady,
    historyError,
    onSelectChat,
    feedbackPreview,
    connectionRecoveryNoticeStatus,
    locale,
    t,
    selectedMode,
    setSelectedMode,
    message,
    setMessage,
    messageInputFocused,
    setMessageInputFocused,
    setMessageEntities,
    upcomingMessages,
    selectedDate,
    selectedTime,
    activeSchedulePicker,
    setActiveSchedulePicker,
    scheduleTimeDraft,
    setScheduleTimeDraft,
    setCalendarCursor,
    schedulePickerPosition,
    emojiPickerOpen,
    setEmojiPickerOpen,
    emojiModifierHeld,
    emojiCategoryId,
    setEmojiCategoryId,
    emojiSearchQuery,
    setEmojiSearchQuery,
    emojiActiveIndex,
    setEmojiActiveIndex,
    emojiCommandRange,
    setEmojiCommandRange,
    recentEmojis,
    effectPickerOpen,
    setEffectPickerOpen,
    availableEffects,
    selectedEffectId,
    setSelectedEffectId,
    attachments,
    setAttachments,
    isFileDragOver,
    setIsFileDragOver,
    attachmentScroll,
    actionFeedbackInstance,
    actionFeedbackRetriggered,
    chatPickerOpen,
    setChatPickerOpen,
    chatQuery,
    setChatQuery,
    setSelectedChatId,
    plannerAccent,
    plannerAccentRgb,
    timeZoneLabel,
    minimumScheduleDateValue,
    minimumScheduleTimeValue,
    calendarMonthKey,
    calendarMonthLabel,
    calendarWeekdayLabels,
    calendarDayCount,
    calendarFirstWeekdayOffset,
    minimumMonthKey,
    todayScheduleDateValue,
    messageMaxLength,
    submitLabel,
    chatPickerRef,
    toolsRowRef,
    effectsToolRef,
    emojiToolRef,
    emojiPickerPanelRef,
    scheduleRowRef,
    scheduleDateTriggerRef,
    scheduleTimeTriggerRef,
    scheduleDatePickerRef,
    scheduleTimePickerRef,
    chatTriggerRef,
    chatSearchRef,
    workbenchRef,
    messageInputRef,
    attachmentInputRef,
    attachmentScrollbarRef,
    attachmentListRef,
    selectedPickerChat,
    filteredChats,
    removePickerChat,
    setScheduleDateTimeWithinRange,
    clearActionFeedback,
    toggleEffectPicker,
    insertEmoji,
    toggleEmojiPicker,
    handleEmojiPickerKeyDown,
    applyQuickTime,
    handleSubmit,
    handleOpenInStudio,
    handleAttachmentFiles,
    handleMessagePaste,
    handleAttachmentChange,
    visibleActionFeedback,
    calendarCursor,
    getAttachmentCountTranslationKey,
      }}
    />
  );
}

function getAttachmentCountTranslationKey(locale: 'en' | 'ru', count: number) {
  if (locale === 'en') return count === 1 ? 'quickPlanner.attachmentOne' : 'quickPlanner.attachments';
  const plural = new Intl.PluralRules('ru').select(count);
  if (plural === 'one') return 'quickPlanner.attachmentOne';
  return plural === 'few' ? 'quickPlanner.attachmentsFew' : 'quickPlanner.attachments';
}