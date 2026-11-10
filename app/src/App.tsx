import { useCallback, useEffect, useLayoutEffect, useMemo, useReducer, useRef, useState } from 'react';
import { useChats, useNotifications, useScheduler, useTelegramAuth } from './core';
import type { Chat, RichTextEntity } from '@/types';
import type { SavedDraft, ScheduledMessage as StudioScheduledMessage } from '@shared/types';
import { createStudioSchedulerRuntime } from '@shared/bridge';
import type { StudioPlannerTextPayload } from '@shared/bridge';

import { AppShell, preloadStudioApp, StudioMount } from './workspace';
import { useLocale } from '@/lib/i18n';
import { useConnectionRecoveryNotice } from './hooks/useConnectionRecoveryNotice';
import { hasPlannerPayloadContent } from './workspace/plannerText';
import { getPlannerSurface } from './workspace/plannerSurface';
import { normalizePlannerDraft, normalizeSavedPlannerDraft, normalizeScheduledMessages } from './workspace/historyModel';
import { getTelegramCredentialsErrorKey } from './lib/telegramCredentialsError';
import { getAppRouteFromHash, normalizeInitialAppRoute } from './lib/appRoute';
import type { HistoryClearResult, HistoryItem, HistorySource } from './workspace/historyModel';
import { QuickPlanner } from './components/QuickPlanner';
import { ConfirmDialogProvider } from './components/ConfirmDialog';
import { LoginPage } from './pages/LoginPage';
import { SettingsPage } from './pages/SettingsPage';
import {
  flushPlannerDraftWrite,
  MAX_PLANNER_ATTACHMENTS,
  readPlannerDraft,
  readPlannerDraftAttachments,
  readPlannerDraftEntities,
  readPlannerDraftRecoveryStack,
  readPlannerDraftUpdatedAt,
  readSavedPlannerDrafts,
  writePlannerDraft,
  writePlannerDraftRecoveryStack,
  writeSavedPlannerDrafts,
  SAVED_PLANNER_DRAFTS_UPDATED_EVENT,
  type PlannerDraftRecoverySnapshot,
} from './lib/plannerDraft';
import {
  hasTelegramBridge,
  isDesktopTelegramRuntime,
  telegramGetAuthState,
  telegramGetConfig,
  telegramRestoreApplicationCredentials,
  telegramSaveCredentials,
  subscribeToConfirmedSendHistoryWarning,
} from './services/telegramAppService';
import {
  getBackgroundProductView,
  getInitialProductView,
  persistProductView,
  type ProductView,
} from './lib/productView';
import { updateSavedStudioDrafts } from '@studio/lib/draftStore';
import { appStateReducer, createInitialAppState, createMessageSession, type AppRoute } from './appState';
import { createAppHistoryDraftActions, type PlannerDraftLoadRequest } from './appHistoryDraftActions';

function AppContent() {
  const { t } = useLocale();
  const browserDraftMode = !isDesktopTelegramRuntime();
  const [, setSavedPlannerDraftRevision] = useState(0);
  const [plannerDraftLoadRequest, setPlannerDraftLoadRequest] = useState<PlannerDraftLoadRequest | null>(null);
  const plannerDraftLoadRevisionRef = useRef(0);
  const nextPlannerDraftLoadRevision = () => {
    plannerDraftLoadRevisionRef.current += 1;
    return plannerDraftLoadRevisionRef.current;
  };
  const [initialRoute] = useState(() => normalizeInitialAppRoute(window.location, (url) => {
    window.history.replaceState(window.history.state, '', url);
  }));
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const initialMessageSession = createMessageSession({
    text: readPlannerDraft(),
    attachments: readPlannerDraftAttachments().slice(0, MAX_PLANNER_ATTACHMENTS),
    entities: readPlannerDraftEntities(),
  });
  const [appState, dispatch] = useReducer(
    appStateReducer,
    createInitialAppState({
      route: initialRoute,
      productView: getInitialProductView(browserDraftMode),
      activeAccountId: 'account-1',
      messageSession: initialMessageSession,
    }),
  );
  const { route, productView, activeAccountId, messageSession } = appState;
  const [studioHasBeenOpened, setStudioHasBeenOpened] = useState(() => (
    productView === 'studio'
    || (productView === 'posts'
      && getBackgroundProductView(productView, browserDraftMode ? 'planner' : 'studio') === 'studio')
  ));
  const message = messageSession.text;
  const messageEntities = messageSession.entities as RichTextEntity[];
  const plannerAttachments = messageSession.attachments;
  const messageRef = useRef(message);
  const messageEntitiesRef = useRef(messageEntities);
  const plannerAttachmentsRef = useRef(plannerAttachments);
  const selectedChatIdRef = useRef<string | null>(null);
  const studioFlushBeforeLeaveRef = useRef<(() => Promise<boolean>) | null>(null);
  const studioLeaveFlushRef = useRef<Promise<boolean> | null>(null);
  const studioLeaveFlushScheduledRef = useRef(false);
  const productViewRef = useRef(productView);
  productViewRef.current = productView;

  useEffect(() => {
    const flushPlannerDraftBeforeClose = (event: BeforeUnloadEvent) => {
      if (flushPlannerDraftWrite()) return;
      event.preventDefault();
      event.returnValue = '';
    };

    window.addEventListener('beforeunload', flushPlannerDraftBeforeClose);
    return () => window.removeEventListener('beforeunload', flushPlannerDraftBeforeClose);
  }, []);

  useEffect(() => {
    messageRef.current = message;
  }, [message]);
  useEffect(() => {
    messageEntitiesRef.current = messageEntities;
  }, [messageEntities]);
  useEffect(() => {
    plannerAttachmentsRef.current = plannerAttachments;
  }, [plannerAttachments]);
  const setMessage = useCallback((nextMessage: React.SetStateAction<string>) => {
    const resolvedMessage = typeof nextMessage === 'function'
      ? nextMessage(messageRef.current)
      : nextMessage;
    messageRef.current = resolvedMessage;
    writePlannerDraft(resolvedMessage, messageEntitiesRef.current, plannerAttachmentsRef.current);
    dispatch({
      type: 'SET_MESSAGE_DRAFT',
      text: resolvedMessage,
      attachments: plannerAttachmentsRef.current,
      entities: messageEntitiesRef.current,
      chatId: selectedChatIdRef.current,
    });
  }, [dispatch]);
  const setMessageEntities = useCallback((nextEntities: RichTextEntity[]) => {
    messageEntitiesRef.current = nextEntities;
    writePlannerDraft(messageRef.current, nextEntities, plannerAttachmentsRef.current);
    dispatch({
      type: 'SET_MESSAGE_DRAFT',
      text: messageRef.current,
      attachments: plannerAttachmentsRef.current,
      entities: nextEntities,
      chatId: selectedChatIdRef.current,
    });
  }, [dispatch]);
  const setPlannerAttachments = useCallback((nextAttachments: string[]) => {
    const limitedAttachments = nextAttachments.slice(0, MAX_PLANNER_ATTACHMENTS);
    plannerAttachmentsRef.current = limitedAttachments;
    writePlannerDraft(messageRef.current, messageEntitiesRef.current, limitedAttachments);
    dispatch({
      type: 'SET_MESSAGE_DRAFT',
      text: messageRef.current,
      attachments: limitedAttachments,
      entities: messageEntitiesRef.current,
      chatId: selectedChatIdRef.current,
    });
  }, [dispatch]);
  const setProductView = useCallback((view: ProductView) => {
    if (productViewRef.current === 'studio' && view !== 'studio' && studioFlushBeforeLeaveRef.current) {
      if (!studioLeaveFlushRef.current && !studioLeaveFlushScheduledRef.current) {
        studioLeaveFlushScheduledRef.current = true;
        const flushDraft = () => {
          const flushCallback = studioFlushBeforeLeaveRef.current;
          if (!flushCallback) {
            studioLeaveFlushScheduledRef.current = false;
            return;
          }
          const flush = flushCallback();
          studioLeaveFlushRef.current = flush;
          const clearFlush = () => {
            if (studioLeaveFlushRef.current === flush) studioLeaveFlushRef.current = null;
            studioLeaveFlushScheduledRef.current = false;
          };
          void flush.then(clearFlush, clearFlush);
        };
        if (typeof window.requestIdleCallback === 'function') {
          window.requestIdleCallback(flushDraft, { timeout: 1000 });
        } else {
          window.setTimeout(flushDraft, 0);
        }
      }
    }

    persistProductView(view);
    productViewRef.current = view;
    if (view === 'studio') {
      setStudioHasBeenOpened(true);
      void preloadStudioApp();
    }
    dispatch({ type: 'SET_PRODUCT_VIEW', view });
  }, [dispatch]);
  const setRoute = useCallback((nextRoute: AppRoute) => {
    dispatch({ type: 'SET_ROUTE', route: nextRoute });
  }, []);
  const setCurrentAction = useCallback((action: 'send-now' | 'schedule' | 'draft') => {
    dispatch({ type: 'SET_CURRENT_ACTION', action });
  }, []);
  const setMessageSessionStatus = useCallback((status: 'draft' | 'preview' | 'sending' | 'scheduled' | 'sent' | 'failed' | 'cancelled') => {
    dispatch({ type: 'SET_MESSAGE_STATUS', status });
  }, []);
  const [welcomeBackInProgress, setWelcomeBackInProgress] = useState(false);
  const settingsReturnViewRef = useRef<ProductView | null>(null);
  const [telegramApiId, setTelegramApiId] = useState('');
  const [telegramApiHash, setTelegramApiHash] = useState('');
  const [openTelegramCredentialsDialog, setOpenTelegramCredentialsDialog] = useState(false);
  const [telegramCredentialsBusy, setTelegramCredentialsBusy] = useState(false);
  const [telegramCredentialsError, setTelegramCredentialsError] = useState('');
  const [telegramCredentials, setTelegramCredentials] = useState({
    hasCredentials: false,
    hasCustomCredentials: null as boolean | null,
    apiId: '',
    hasSession: false,
    connected: false,
    signedOut: false,
  });

  useEffect(() => {
    const updateSavedPlannerDrafts = () => setSavedPlannerDraftRevision((revision) => revision + 1);
    window.addEventListener(SAVED_PLANNER_DRAFTS_UPDATED_EVENT, updateSavedPlannerDrafts);
    return () => window.removeEventListener(SAVED_PLANNER_DRAFTS_UPDATED_EVENT, updateSavedPlannerDrafts);
  }, []);

  const {
    notification,
    showNotification,
    closeNotification,
  } = useNotifications();
  useEffect(() => {
    return subscribeToConfirmedSendHistoryWarning(showNotification, t);
  }, [showNotification, t]);
  const [studioMessage, setStudioMessage] = useState('');
  const studioDraftOpenerRef = useRef<((draft: SavedDraft) => void) | null>(null);
  const studioDraftUseRef = useRef<((draft: SavedDraft) => Promise<boolean>) | null>(null);
  const pendingStudioDraftUseWaitersRef = useRef(new Set<(handler: (draft: SavedDraft) => Promise<boolean>) => void>());
  const studioDraftClearerRef = useRef<(() => Promise<boolean>) | null>(null);
  const studioDraftDeleterRef = useRef<((draftId: string) => Promise<boolean>) | null>(null);
  const studioHistoryReschedulerRef = useRef<((message: StudioScheduledMessage) => void) | null>(null);
  const studioPlannerTextOpenerRef = useRef<((payload: StudioPlannerTextPayload) => Promise<boolean>) | null>(null);
  const pendingPlannerTextRef = useRef<StudioPlannerTextPayload | null>(null);
  const pendingPlannerTextOpenedRef = useRef<((opened: boolean) => void) | null>(null);
  const [studioPlannerTextOpenerVersion, setStudioPlannerTextOpenerVersion] = useState(0);
  const registerPlannerTextOpener = useCallback((opener: ((payload: StudioPlannerTextPayload) => Promise<boolean>) | null) => {
    studioPlannerTextOpenerRef.current = opener;
    setStudioPlannerTextOpenerVersion((version) => version + 1);
  }, []);
  const registerHistoryDraftOpener = useCallback((opener: ((draft: SavedDraft) => void) | null) => {
    studioDraftOpenerRef.current = opener;
  }, []);
  const registerHistoryDraftUseHandler = useCallback((handler: ((draft: SavedDraft) => Promise<boolean>) | null) => {
    studioDraftUseRef.current = handler;
    if (!handler) return;
    for (const resolveHandler of pendingStudioDraftUseWaitersRef.current) resolveHandler(handler);
    pendingStudioDraftUseWaitersRef.current.clear();
  }, []);
  const registerHistoryRescheduleHandler = useCallback((handler: ((message: StudioScheduledMessage) => void) | null) => {
    studioHistoryReschedulerRef.current = handler;
  }, []);
  const registerHistoryDraftClearHandler = useCallback((handler: (() => Promise<boolean>) | null) => {
    studioDraftClearerRef.current = handler;
  }, []);

  const registerHistoryDraftDeleteHandler = useCallback((handler: ((draftId: string) => Promise<boolean>) | null) => {
    studioDraftDeleterRef.current = handler;
  }, []);

  const chatsApiRef = useRef<{
    setChats: React.Dispatch<React.SetStateAction<Chat[]>>;
    setSelectedChat: React.Dispatch<React.SetStateAction<Chat | null>>;
  } | null>(null);

  const {
    connected,
    sessionAvailable,
    sessionResolved,
    signedOut,
    returningUserName,
    returningUserUsername,
    connecting,
    connectionResolved,
    authStep,
    showAuthForm,
    phoneNumber,
    phoneCode,
    twoFactorPassword,
    authBusy,
    authError,
    authNotice,
    telegramStatus,
    isConfirmingLogout,
    setIsConfirmingLogout,
    setShowAuthForm,
    setAuthStep,
    setPhoneNumber,
    setPhoneCode,
    setTwoFactorPassword,
    setAuthError,
    handleTelegramAuth,
    handleDisconnect,
    handleWelcomeBack,
    handleForgetAccount,
  } = useTelegramAuth({
    setIsSettingsOpen,
    setChats: (value) => {
      chatsApiRef.current?.setChats(value);
    },
    setSelectedChat: (value) => {
      chatsApiRef.current?.setSelectedChat(value);
    },
  });

  const [connectionRecoveryTimedOut, setConnectionRecoveryTimedOut] = useState(false);
  const connectionRecoveryActive = sessionResolved
    && connectionResolved
    && !connecting
    && sessionAvailable
    && !connected
    && !signedOut;
  useEffect(() => {
    if (!connectionRecoveryActive) {
      setConnectionRecoveryTimedOut(false);
      return undefined;
    }

    const timer = window.setTimeout(() => setConnectionRecoveryTimedOut(true), 10_000);
    return () => window.clearTimeout(timer);
  }, [connectionRecoveryActive]);

  const connectionRecoveryStatus = connectionRecoveryActive
    ? connectionRecoveryTimedOut ? 'offline' : 'reconnecting'
    : null;
  const connectionRecoveryNoticeStatus = useConnectionRecoveryNotice(
    connectionRecoveryActive,
    sessionResolved && sessionAvailable && connected && !signedOut,
    connectionRecoveryStatus === 'offline',
  );

  useLayoutEffect(() => {
    if (sessionResolved && connectionResolved && ((!connected && !sessionAvailable) || signedOut) && productView !== 'planner') {
      setProductView('planner');
    }
  }, [connected, connectionResolved, productView, sessionAvailable, sessionResolved, setProductView, signedOut]);

  const {
    chats,
    setChats,
    selectedChat,
    setSelectedChat,
    refreshChatPermissions,
    handleRemoveChat,
  } = useChats({
    connected,
    onStorageError: (error) => showNotification(
      error,
      'error',
      'Saved chats unavailable',
    ),
  });

  useEffect(() => {
    selectedChatIdRef.current = selectedChat?.id ?? null;
    dispatch({ type: 'SET_SELECTED_CHAT', chatId: selectedChat?.id ?? null });
  }, [selectedChat, dispatch]);

  useEffect(() => {
    chatsApiRef.current = {
      setChats,
      setSelectedChat,
    };
  }, [setChats, setSelectedChat]);

  const {
    upcoming: personalUpcoming,
    sent: personalSent,
    historyReady: personalHistoryReady,
    historyLoadError: personalHistoryLoadError,
    handleCancelMessage: handlePersonalCancelMessage,
    handleCancelMessages: handlePersonalCancelMessages,
    handleSchedule: handlePersonalSchedule,
    handleSendDraftNow: handlePersonalSendDraftNow,
    handleSendNow: handlePersonalSendNow,
    handleDeleteMessage: handlePersonalDeleteMessage,
    handleClearSent: handlePersonalClearSent,
  } = useScheduler({
    historyScope: 'personal',
    connected,
    selectedChat,
    refreshChatPermissions,
    chats,
    message,
    composerAttachments: plannerAttachments,
    composerEntities: messageEntities,
    showNotification,
    setMessage,
  });

  const studioScheduler = useScheduler({
    historyScope: 'workspace',
    accountId: activeAccountId,
    connected: connected && !signedOut && activeAccountId === 'account-1',
    selectedChat,
    refreshChatPermissions,
    chats,
    message: studioMessage,
    showNotification,
    setMessage: setStudioMessage,
  });
  const historyRecordsReady = personalHistoryReady && studioScheduler.historyReady;

  const studioBridgeScheduler = createStudioSchedulerRuntime(
    {
      ...studioScheduler,
      handleSendDraftNow: (chat, text, attachments, entities, attachmentGroups, onAttachmentGroupResult, effect, suppressNotifications) => (
        studioScheduler.handleSendDraftNow(
          chat,
          text,
          attachments,
          entities,
          false,
          effect,
          { suppressNotifications },
          attachmentGroups,
          onAttachmentGroupResult,
        )
      ),
    },
    showNotification,
  );

  const openPlannerTextInStudio = (
    payload: StudioPlannerTextPayload,
    onOpened?: (opened: boolean) => void,
  ) => {
    if (!hasPlannerPayloadContent(payload)) {
      showNotification('Add text or an attachment before opening Studio.', 'warning', 'Nothing to open');
      return false;
    }
    if (pendingPlannerTextRef.current !== null) return false;

    pendingPlannerTextRef.current = {
      text: payload.text,
      attachments: [...payload.attachments],
      entities: payload.entities.map((entity) => ({ ...entity })),
      ...(payload.effect ? { effect: payload.effect } : {}),
    };
    pendingPlannerTextOpenedRef.current = onOpened ?? null;
    setCurrentAction('draft');
    setMessageSessionStatus('preview');
    setProductView('studio');
    return true;
  };

  useEffect(() => {
    if (productView !== 'studio' || pendingPlannerTextRef.current === null) return;
    const pendingText = pendingPlannerTextRef.current;
    const opener = studioPlannerTextOpenerRef.current;
    if (!opener) {
      const timeout = window.setTimeout(() => {
        if (pendingPlannerTextRef.current !== pendingText) return;
        pendingPlannerTextRef.current = null;
        const onOpened = pendingPlannerTextOpenedRef.current;
        pendingPlannerTextOpenedRef.current = null;
        onOpened?.(false);
        showNotification('Studio did not finish loading. Planner text is unchanged.', 'error', 'Could not open Studio');
      }, 10000);
      return () => window.clearTimeout(timeout);
    }

    pendingPlannerTextRef.current = null;
    const onOpened = pendingPlannerTextOpenedRef.current;
    pendingPlannerTextOpenedRef.current = null;
    try {
      void opener(pendingText).then((opened) => {
        onOpened?.(opened);
        if (!opened) {
          showNotification(
            'Studio could not preserve its current document. Planner text was not opened.',
            'warning',
            'Document not replaced',
          );
        }
      }).catch(() => {
        onOpened?.(false);
        showNotification('Studio could not open the Planner text. Your Planner text is unchanged.', 'error', 'Could not open Studio');
      });
    } catch {
      onOpened?.(false);
      showNotification('Studio could not open the Planner text. Your Planner text is unchanged.', 'error', 'Could not open Studio');
    }
  }, [productView, showNotification, studioPlannerTextOpenerVersion]);

  const plannerDraftRecord = normalizePlannerDraft(message, selectedChat, readPlannerDraftUpdatedAt(), messageEntities, plannerAttachments);

  useEffect(() => {
    if (!selectedChat?.id && messageSession.chatId) {
      dispatch({
        type: 'SET_MESSAGE_DRAFT',
        text: messageSession.text,
        attachments: messageSession.attachments,
        entities: messageSession.entities,
        chatId: null,
      });
    }
  }, [dispatch, messageSession, selectedChat]);
  const savedPlannerDraftRecords = readSavedPlannerDrafts().map(normalizeSavedPlannerDraft);
  const personalSentHistoryRecords = useMemo(
    () => normalizeScheduledMessages(personalSent, 'personal', 'sent', chats),
    [chats, personalSent],
  );
  const historyRecords = [
    ...normalizeScheduledMessages(personalUpcoming, 'personal', 'upcoming', chats),
    ...personalSentHistoryRecords,
    ...normalizeScheduledMessages(studioScheduler.upcoming, 'workspace', 'upcoming', chats),
    ...normalizeScheduledMessages(studioScheduler.sent, 'workspace', 'sent', chats),
    ...(plannerDraftRecord ? [plannerDraftRecord] : []),
    ...savedPlannerDraftRecords,
  ];
  const cancelHistoryRecord = (record: HistoryItem) => {
    if (record.original.kind !== 'scheduled' || record.status !== 'scheduled') return;
    if (record.source === 'workspace') {
      studioScheduler.handleCancelMessage(record.original.message);
    } else {
      handlePersonalCancelMessage(record.original.message);
    }
  };

  const sendHistoryRecordNow = (record: HistoryItem) => {
    if (record.original.kind !== 'scheduled') return;
    if (record.source === 'workspace') {
      studioScheduler.handleSendNow(record.original.message);
    } else {
      handlePersonalSendNow(record.original.message);
    }
  };

  const rescheduleHistoryRecord = (record: HistoryItem) => {
    if (record.original.kind !== 'scheduled' || record.status !== 'scheduled') return;
    if (record.source === 'workspace') {
      setProductView('studio');
      studioHistoryReschedulerRef.current?.({ ...record.original.message, status: 'scheduled' });
      return;
    }
    if (!flushPlannerDraftWrite()) {
      showNotification(t('quickPlanner.couldNotSaveDraft'), 'error', 'Posts');
      return;
    }
    const message = record.original.message;
    setProductView('planner');
    const selectedChat = chats.find((chat) => chat.id === message.chatId) ?? {
      id: message.chatId,
      name: message.chatName,
      type: 'unknown',
    };
    setPlannerDraftLoadRequest({
      revision: nextPlannerDraftLoadRevision(),
      text: message.text,
      attachments: [...(message.attachments ?? [])],
      entities: [...(message.entities ?? [])],
      selectedChat,
      restoreDraft: null,
      rescheduleMessage: message,
    });
  };

  const clearHistorySent = async (source: HistorySource | 'all'): Promise<HistoryClearResult> => {
    const recordsBySource = {
      personal: personalSentHistoryRecords,
      workspace: normalizeScheduledMessages(studioScheduler.sent, 'workspace', 'sent', chats),
    };
    const sources: HistorySource[] = source === 'all' ? ['personal', 'workspace'] : [source];
    const results = await Promise.all(sources.map(async (historySource) => {
      const count = recordsBySource[historySource].length;
      if (count === 0) return { deleted: 0, failed: 0 };
      try {
        const cleared = historySource === 'workspace'
          ? await studioScheduler.handleClearSent(true)
          : await handlePersonalClearSent(true);
        return cleared === false
          ? { deleted: 0, failed: count }
          : { deleted: count, failed: 0 };
      } catch (error) {
        console.error(`Failed to clear ${historySource} sent history.`, error);
        return { deleted: 0, failed: count };
      }
    }));
    return results.reduce((total, result) => ({
      deleted: total.deleted + result.deleted,
      failed: total.failed + result.failed,
    }), { deleted: 0, failed: 0 });
  };

  const clearActivePlannerDraft = () => {
    let recoveryStack: PlannerDraftRecoverySnapshot[];
    try {
      recoveryStack = readPlannerDraftRecoveryStack();
    } catch (error) {
      console.error('Failed to clear Planner recovery drafts.', error);
      showNotification(t('quickPlanner.couldNotSaveDraft'), 'error', 'Posts');
      return false;
    }
    if (!writePlannerDraftRecoveryStack([])) {
      showNotification(t('quickPlanner.couldNotSaveDraft'), 'error', 'Posts');
      return false;
    }
    writePlannerDraft('', [], []);
    if (!flushPlannerDraftWrite()) {
      if (!writePlannerDraftRecoveryStack(recoveryStack)) {
        console.error('Failed to restore Planner recovery drafts after clear failed.');
      }
      showNotification(t('quickPlanner.couldNotSaveDraft'), 'error', 'Posts');
      return false;
    }
    setMessage('');
    setMessageEntities([]);
    setPlannerAttachments([]);
    setPlannerDraftLoadRequest({
      revision: nextPlannerDraftLoadRevision(),
      text: '',
      attachments: [],
      entities: [],
      restoreDraft: null,
      clearDraft: true,
    });
    return true;
  };

  const clearHistoryDrafts = async (source: HistorySource | 'all') => {
    if (source === 'all' || source === 'workspace') {
      const studioDraftClearer = studioDraftClearerRef.current;
      if (studioDraftClearer) {
        if (!await studioDraftClearer()) return false;
      } else {
        const cleared = await updateSavedStudioDrafts(() => []);
        if (!cleared) return false;
      }
    }
    if (source === 'all' || source === 'personal') {
      if (!clearActivePlannerDraft()) return false;
      if (!writeSavedPlannerDrafts([])) return false;
    }
    return true;
  };

  const cancelHistoryQueue = async (records: HistoryItem[]) => {
    const personalMessages = records.flatMap((record) => record.source === 'personal' && record.original.kind === 'scheduled' ? [record.original.message] : []);
    const workspaceMessages = records.flatMap((record) => record.source === 'workspace' && record.original.kind === 'scheduled' ? [record.original.message] : []);
    const results = await Promise.all([
      personalMessages.length ? handlePersonalCancelMessages(personalMessages) : true,
      workspaceMessages.length ? studioScheduler.handleCancelMessages(workspaceMessages) : true,
    ]);
    return results.every(Boolean);
  };

  const { deleteHistoryRecord, openHistoryDraft, useHistoryDraft } = createAppHistoryDraftActions({
    browserDraftMode,
    clearActivePlannerDraft,
    handlePersonalDeleteMessage,
    openPlannerTextInStudio,
    pendingStudioDraftUseWaitersRef,
    nextPlannerDraftLoadRevision,
    productViewRef,
    setPlannerDraftLoadRequest,
    setProductView,
    showNotification,
    studioDraftDeleterRef,
    studioDraftOpenerRef,
    studioDraftUseRef,
    studioScheduler,
    t,
  });

  const restorePlannerDraft = (draft: PlannerDraftRecoverySnapshot | null) => {
    setMessageEntities(draft?.entities ?? []);
    setPlannerAttachments(draft?.attachments ?? []);
    setMessage(draft?.text ?? '');
    if (draft?.selectedChat) setSelectedChat(draft.selectedChat);
  };

  const acceptPlannerDraftLoad = (draft: PlannerDraftRecoverySnapshot) => {
    setMessageEntities(draft.entities);
    setPlannerAttachments(draft.attachments);
    setMessage(draft.text);
    if (draft.selectedChat) setSelectedChat(draft.selectedChat);
    const acceptedRequest = plannerDraftLoadRequest;
    setPlannerDraftLoadRequest(null);
    if (!acceptedRequest?.savedDraftSource) return;
    const { id, kind } = acceptedRequest.savedDraftSource;
    if (kind === 'planner') {
      const removed = writeSavedPlannerDrafts(readSavedPlannerDrafts().filter((savedDraft) => savedDraft.id !== id));
      if (!removed) showNotification(t('quickPlanner.couldNotRemoveDraft'), 'error', t('quickPlanner.draftRemovalFailed'));
      return;
    }
    void updateSavedStudioDrafts((drafts) => drafts.filter((savedDraft) => savedDraft.id !== id)).then((removed) => {
      if (!removed) showNotification(t('studio.draftsCouldNotSave'), 'error', 'Studio');
    }).catch((error: unknown) => {
      console.error('Failed to remove a Studio draft after Planner accepted it.', error);
      showNotification(t('studio.draftsCouldNotSave'), 'error', 'Studio');
    });
  };

  const studioConnected = connected && !signedOut && activeAccountId === 'account-1';
  const plannerSurface = getPlannerSurface({
    browserDraftMode,
    connected,
    sessionAvailable,
    sessionResolved,
    signedOut,
    connecting,
    connectionResolved,
    welcomeBackInProgress,
  });
  const backgroundProductView = getBackgroundProductView(
    productView,
    browserDraftMode ? 'planner' : 'studio',
  );
  const studioSurfaceAvailable = studioHasBeenOpened
    && (browserDraftMode || (sessionResolved && (sessionAvailable || (connectionResolved && connected)) && !signedOut));
  const studioSurfaceVisible = backgroundProductView === 'studio'
    && studioSurfaceAvailable;

  useEffect(() => {
    if (isSettingsOpen) {
      setIsConfirmingLogout(false);
    }
  }, [isSettingsOpen, setIsConfirmingLogout]);

  useEffect(() => {
    const handleHashChange = () => {
      setRoute(getAppRouteFromHash(window.location.hash));
    };

    handleHashChange();
    window.addEventListener('hashchange', handleHashChange);

    return () => {
      window.removeEventListener('hashchange', handleHashChange);
    };
  }, [setRoute]);

  useLayoutEffect(() => {
    if (route === '/settings') {
      if (settingsReturnViewRef.current === null) {
        settingsReturnViewRef.current = productView;
      }
      setIsSettingsOpen(true);
      setProductView('planner');
    } else {
      setIsSettingsOpen(false);
      const returnView = settingsReturnViewRef.current;
      if (returnView !== null) {
        settingsReturnViewRef.current = null;
        setProductView(returnView);
      }
    }
  }, [productView, route, setProductView]);

  const navigate = (nextRoute: AppRoute) => {
    const target = nextRoute === '/' ? '#/' : `#${nextRoute}`;
    if (window.location.hash !== target) {
      window.location.hash = target;
    }
    setRoute(nextRoute);
  };

  const closeSettings = () => {
    setOpenTelegramCredentialsDialog(false);
    setShowAuthForm(false);
    setIsSettingsOpen(false);
    navigate('/');
  };
  const closeCredentialSettings = () => {
    setOpenTelegramCredentialsDialog(false);
    setIsSettingsOpen(false);
    navigate('/');
  };

  const finishWelcomeBack = async () => {
    if (!hasTelegramBridge()) return false;

    try {
      const authResult = await telegramGetAuthState();
      if (!authResult.success || !authResult.authState?.connected || authResult.authState.signedOut) return false;
      setProductView('studio');
      settingsReturnViewRef.current = 'studio';
      return true;
    } catch {
      return false;
    }
  };

  const handleWelcomeBackFromReturn = async () => {
    setWelcomeBackInProgress(true);
    let restored = false;
    try {
      restored = await handleWelcomeBack(() => setProductView('studio'));
    } finally {
      setWelcomeBackInProgress(false);
    }
    if (restored) return;
    await finishWelcomeBack();
  };

  const handleWelcomeBackFromSettings = async () => {
    const restored = await handleWelcomeBack();
    if (restored) {
      // Запомним Studio как вид для возврата: useLayoutEffect переключит
      // productView до первой отрисовки после navigate('/'), без мигания.
      settingsReturnViewRef.current = 'studio';
      navigate('/');
      return;
    }
    if (await finishWelcomeBack()) navigate('/');
  };

  const handleTelegramAuthFromLogin = async () => {
    const signedIn = await handleTelegramAuth();
    if (signedIn) {
      setProductView('studio');
    }
  };

  const handleTelegramAuthFromSettings = async () => {
    const signedIn = await handleTelegramAuth();
    if (signedIn) {
      settingsReturnViewRef.current = 'studio';
      navigate('/');
      return;
    }
    if (await finishWelcomeBack()) navigate('/');
  };

  const saveTelegramCredentials = async (): Promise<boolean> => {
    const apiId = telegramApiId.trim();
    if (!/^[1-9]\d{0,9}$/.test(apiId)) {
      setTelegramCredentialsError(t('settings.apiIdInvalid'));
      return false;
    }
    const apiHash = telegramApiHash.trim();
    if (!apiHash) {
      setTelegramCredentialsError(t('settings.apiHashRequired'));
      return false;
    }
    if (apiHash.length > 256) {
      setTelegramCredentialsError(t('settings.apiHashTooLong'));
      return false;
    }
    if (apiHash.includes('\0')) {
      setTelegramCredentialsError(t('settings.apiHashInvalid'));
      return false;
    }

    setTelegramCredentialsBusy(true);
    setTelegramCredentialsError('');
    try {
      const result = await telegramSaveCredentials({
        API_ID: apiId,
        API_HASH: apiHash,
      });
      if (!result.success || !result.config || !result.config.hasCredentials) {
        throw new Error(result.error || 'Telegram API credentials could not be saved.');
      }
      setTelegramCredentials({
        hasCredentials: Boolean(result.config.hasCredentials),
        hasCustomCredentials: typeof result.config.hasCustomCredentials === 'boolean'
          ? result.config.hasCustomCredentials
          : true,
        apiId: result.config.apiId || apiId,
        hasSession: Boolean(result.config.hasSession),
        connected: Boolean(result.config.connected),
        signedOut: Boolean(result.config.signedOut),
      });
      setTelegramApiId('');
      setTelegramApiHash('');
      return true;
    } catch (error) {
      setTelegramCredentialsError(t(getTelegramCredentialsErrorKey(error)));
      return false;
    } finally {
      setTelegramCredentialsBusy(false);
    }
  };

  const restoreApplicationApiCredentials = async (): Promise<boolean> => {
    setTelegramCredentialsBusy(true);
    setTelegramCredentialsError('');
    try {
      const result = await telegramRestoreApplicationCredentials();
      if (!result.success || !result.config || result.config.hasCustomCredentials !== false) {
        throw new Error(result.error || 'Telegram API credentials could not be restored.');
      }

      setTelegramCredentials({
        hasCredentials: Boolean(result.config.hasCredentials),
        hasCustomCredentials: false,
        apiId: result.config.apiId || '',
        hasSession: Boolean(result.config.hasSession),
        connected: Boolean(result.config.connected),
        signedOut: Boolean(result.config.signedOut),
      });
      setTelegramApiId('');
      setTelegramApiHash('');
      return true;
    } catch (error) {
      setTelegramCredentialsError(t(getTelegramCredentialsErrorKey(error)));
      return false;
    } finally {
      setTelegramCredentialsBusy(false);
    }
  };

  const renderSettingsPage = () => (
    <SettingsPage
      onClose={openTelegramCredentialsDialog ? closeCredentialSettings : closeSettings}
      openTelegramCredentials={openTelegramCredentialsDialog}
      accountName={returningUserName}
      telegramUsername={returningUserUsername}
      telegramConnected={connected && !signedOut}
      telegramConnecting={connecting}
      telegramAuthStep={authStep}
      telegramPhoneNumber={phoneNumber}
      telegramPhoneCode={phoneCode}
      telegramTwoFactorPassword={twoFactorPassword}
      telegramAuthBusy={authBusy}
      telegramAuthError={authError}
      telegramAuthNotice={authNotice}
      telegramStatus={telegramStatus}
      telegramCredentials={telegramCredentials}
      telegramApiId={telegramApiId}
      telegramApiHash={telegramApiHash}
      telegramCredentialsBusy={telegramCredentialsBusy}
      telegramCredentialsError={telegramCredentialsError}
      onTelegramApiIdChange={setTelegramApiId}
      onTelegramApiHashChange={setTelegramApiHash}
      onTelegramPhoneNumberChange={setPhoneNumber}
      onTelegramPhoneCodeChange={setPhoneCode}
      onTelegramTwoFactorPasswordChange={setTwoFactorPassword}
      onTelegramAuth={handleTelegramAuthFromSettings}
      onTelegramReconnect={handleWelcomeBackFromSettings}
      onTelegramDisconnect={handleDisconnect}
      onSaveTelegramCredentials={saveTelegramCredentials}
      onRestoreApplicationCredentials={restoreApplicationApiCredentials}
    />
  );

  useEffect(() => {
    let active = true;
    if (!hasTelegramBridge()) return;
    telegramGetConfig().then((result) => {
      if (!active || !result.success || !result.config) return;
      setTelegramCredentials({
        hasCredentials: Boolean(result.config.hasCredentials),
        hasCustomCredentials: typeof result.config.hasCustomCredentials === 'boolean'
          ? result.config.hasCustomCredentials
          : null,
        apiId: result.config.apiId || '',
        hasSession: Boolean(result.config.hasSession),
        connected: Boolean(result.config.connected),
        signedOut: Boolean(result.config.signedOut),
      });
    }).catch(() => undefined);
    return () => { active = false; };
  }, [connected, signedOut]);

  return (
    <AppShell
      view={productView}
      browserDraftMode={browserDraftMode}
      onViewChange={(view) => {
        if (view !== 'studio') pendingPlannerTextRef.current = null;
        setProductView(view);
      }}
      settingsOpen={route === '/settings'}
      onCloseSettings={closeSettings}
      notification={notification}
      closeNotification={closeNotification}
      onHistoryNotice={showNotification}
      connected={sessionResolved && (connected || sessionAvailable) && !signedOut}
      connectionRecoveryStatus={connectionRecoveryStatus}
      connectionRecoveryNoticeStatus={connectionRecoveryNoticeStatus}
      headerPending={connecting || !connectionResolved || signedOut}
      authBusy={authBusy}
      isConfirmingLogout={isConfirmingLogout}
      setIsConfirmingLogout={setIsConfirmingLogout}
      setShowAuthForm={setShowAuthForm}
      handleDisconnect={async () => {
        if (await handleDisconnect()) setProductView('planner');
      }}
      handleForgetAccount={handleForgetAccount}
      onOpenSettings={(returnToPosts) => {
        setShowAuthForm(false);
        setIsConfirmingLogout(false);
        settingsReturnViewRef.current = returnToPosts ? 'posts' : null;
        setIsSettingsOpen(true);
        navigate('/settings');
      }}
      historyRecords={historyRecords}
      historyRecordsReady={historyRecordsReady}
      onHistoryCancel={cancelHistoryRecord}
      onHistoryReschedule={rescheduleHistoryRecord}
      onHistorySendNow={sendHistoryRecordNow}
      onHistoryDelete={deleteHistoryRecord}
      onHistoryOpenDraft={openHistoryDraft}
      onHistoryUseDraft={useHistoryDraft}
      onHistoryClearSent={clearHistorySent}
      onHistoryClearDrafts={clearHistoryDrafts}
      onHistoryCancelQueue={cancelHistoryQueue}
    >
      <div
        className={`product-view ${studioSurfaceVisible ? 'is-active' : ''}`}
        aria-hidden={productView !== 'studio' || !studioSurfaceAvailable}
      >
        {studioSurfaceAvailable ? (
          <StudioMount
            connected={studioConnected}
            connectionRecoveryStatus={connectionRecoveryNoticeStatus}
            notification={notification}
            activeAccountId={activeAccountId}
            chats={chats}
            selectedChat={selectedChat}
            onSelectChat={setSelectedChat}
            scheduler={studioBridgeScheduler}
            onRegisterPlannerTextOpener={registerPlannerTextOpener}
            onRegisterBeforeLeaveStudio={(flush) => { studioFlushBeforeLeaveRef.current = flush; }}
            onRegisterHistoryDraftOpener={registerHistoryDraftOpener}
            onRegisterHistoryDraftUseHandler={registerHistoryDraftUseHandler}
            onRegisterHistoryDraftClearHandler={registerHistoryDraftClearHandler}
            onRegisterHistoryDraftDeleteHandler={registerHistoryDraftDeleteHandler}
            onRegisterHistoryRescheduleHandler={registerHistoryRescheduleHandler}
          />
        ) : null}
      </div>
      <div
        className={`product-view ${backgroundProductView === 'planner' ? 'is-active' : ''}`}
        aria-hidden={productView !== 'planner'}
      >
        {route === '/settings' ? renderSettingsPage() : (
          plannerSurface === 'pending' ? null : plannerSurface === 'quick' ? (
            <QuickPlanner
              draftLoadRequest={plannerDraftLoadRequest}
              onRestoreDraft={restorePlannerDraft}
              onDraftLoadAccepted={acceptPlannerDraftLoad}
              chats={chats}
              selectedChat={selectedChat}
              upcoming={personalUpcoming}
              sent={personalSent}
              historyReady={personalHistoryReady}
              historyError={Boolean(personalHistoryLoadError)}
              connectionRecoveryStatus={connectionRecoveryStatus}
              connectionRecoveryNoticeStatus={connectionRecoveryNoticeStatus}
              onSelectChat={setSelectedChat}
              onRemoveChat={handleRemoveChat}
              onSendNow={(chat, text, attachments, effect, entities) => handlePersonalSendDraftNow(
                chat,
                text,
                attachments ?? [],
                entities ?? [],
                false,
                effect,
                { clearMessageOnSuccess: false },
              )}
              onSchedule={async (request) => {
                const scheduled = await handlePersonalSchedule({
                  ...request,
                  clearMessageOnSuccess: false,
                  waitForConfirmation: true,
                });
                return scheduled === true;
              }}
              onSaveDraft={({ message: draftMessage, attachments, entities, selectedChat: draftChat }) => writeSavedPlannerDrafts([
                ...readSavedPlannerDrafts(),
                {
                  id: crypto.randomUUID(),
                  message: draftMessage,
                  attachments,
                  entities,
                  selectedChat: draftChat ? {
                    id: draftChat.id,
                    name: draftChat.name,
                    ...(draftChat.username ? { username: draftChat.username } : {}),
                    ...(draftChat.type ? { type: draftChat.type } : {}),
                  } : null,
                  reminderType: null,
                  savedAt: new Date().toISOString(),
                },
              ])}
              onOpenInStudio={(payload) => new Promise<boolean>((resolve) => {
                if (!openPlannerTextInStudio(payload, resolve)) resolve(false);
              })}
            />
          ) : <LoginPage
            connecting={connecting}
            openingStudio={welcomeBackInProgress}
            signedOut={signedOut}
            returningUserName={returningUserName}
            returningUserUsername={returningUserUsername}
            authStep={authStep}
            showAuthForm={showAuthForm}
            phoneNumber={phoneNumber}
            phoneCode={phoneCode}
            twoFactorPassword={twoFactorPassword}
            authBusy={authBusy}
            authError={authError}
            authNotice={authNotice}
            hasCustomTelegramCredentials={telegramCredentials.hasCustomCredentials}
            setShowAuthForm={setShowAuthForm}
            setAuthStep={setAuthStep}
            setPhoneNumber={setPhoneNumber}
            setPhoneCode={setPhoneCode}
            setTwoFactorPassword={setTwoFactorPassword}
            setAuthError={setAuthError}
            handleTelegramAuth={handleTelegramAuthFromLogin}
            handleWelcomeBack={handleWelcomeBackFromReturn}
            handleForgetAccount={handleForgetAccount}
            onOpenTelegramCredentials={() => {
              setOpenTelegramCredentialsDialog(true);
            }}
          />
        )}
      </div>
      {openTelegramCredentialsDialog && (
        <div aria-hidden="true" style={{ display: 'none' }}>
          {renderSettingsPage()}
        </div>
      )}
    </AppShell>
  );
}

function App() {
  return (
    <ConfirmDialogProvider>
      <AppContent />
    </ConfirmDialogProvider>
  );
}

export default App;