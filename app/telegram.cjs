const crypto = require('node:crypto');
const { TelegramClient, Api } = require('teleproto');
const { Raw } = require('teleproto/events');
const { StringSession } = require('teleproto/sessions');
const { normalizeTelegramMessage } = require('./packages/shared/telegramText.cjs');
const {
  classifyTelegramError,
  createTelegramRateLimitInterceptor,
  isInvalidTelegramSessionError,
} = require('./telegram-errors.cjs');
const {
  loadAccountSecrets,
  saveAccountSecrets,
  getTelegramAuthState: getStoredTelegramAuthState,
  setTelegramSignedOut,
  clearAccountSecrets,
  clearApiCredentials
} = require('./telegram-account-storage.cjs');
const {
  assertLifecycleRunning,
  beginShutdown,
  createLifecycleState,
  runShared,
  startPendingLogin,
  stopReconnect,
  trackOperation,
  withTimeout
} = require('./telegram-lifecycle.cjs');
const {
  normalizeQuery,
  normalizePhone,
  isPhoneLikeQuery,
  isUsernameQuery
} = require('./telegram-search.cjs');
const { toTelegramFormattingEntities } = require('./telegram-message-entities.cjs');
const {
  createTelegramRandomId,
  getTelegramEntityIdentity,
  getEffectIdentity,
  getScheduleOperationIdentities,
} = require('./telegram-idempotency.cjs');
const { normalizeHistoryMessage, resolveMessageDirection } = require('./telegram-message-direction.cjs');
const {
  logTelegramOperation,
  withTelegramInvokeDiagnostics,
} = require('./telegram-publish-diagnostics.cjs');
const { createTelegramSender } = require('./telegram-send.cjs');
const { createTelegramSendRecovery } = require('./telegram-send-recovery.cjs');
const { createTelegramScheduler } = require('./telegram-scheduling.cjs');
const { createTelegramChatResolver } = require('./telegram-chat-resolution.cjs');
const { createTelegramChatData } = require('./telegram-chat-data.cjs');
const { createTelegramReconnect } = require('./telegram-reconnect.cjs');
const { createTelegramAuth } = require('./telegram-auth.cjs');
const {
  normalizeSessionString,
  updateRuntimeSecretsFromConfig,
  getSecretValue,
  getApplicationApiCredentials,
  hasCustomApiCredentials,
} = require('./telegram-config.cjs');

const AUTH_REQUEST_TIMEOUT = 15000;

function getTelegramUserName(user) {
  return [user?.firstName, user?.lastName]
    .filter(Boolean)
    .join(' ')
    .trim();
}

function getTelegramUsername(user) {
  return typeof user?.username === 'string'
    ? user.username.trim().replace(/^@/, '')
    : '';
}

function createTelegramCore(options = {}) {
  const lifecycleState = createLifecycleState({ loginTtlMs: options.loginTtlMs });
  const authRequestTimeoutMs = options.authRequestTimeoutMs ?? AUTH_REQUEST_TIMEOUT;
  const rateLimitInterceptor = createTelegramRateLimitInterceptor(options.rateLimitTimers);
  const applicationApiCredentials = getApplicationApiCredentials(loadAccountSecrets());
  const runtimeState = {
    apiId: Number(options.apiId ?? applicationApiCredentials.apiId),
    apiHash: options.apiHash ?? applicationApiCredentials.apiHash,
    sessionString: normalizeSessionString(
      options.sessionString ?? getSecretValue('SESSION_STRING', loadAccountSecrets())
    ),
    signedOut: false,
  };


let client = null;
let telegramStatusCallback = null;
let telegramSendResultCallback = null;
let activeTelegramStatus = 'normal';
let activeTelegramStatusError = null;
let activeTelegramStatusCategory = null;
let invalidSessionCleanupPromise = null;
let shutdownPromise = null;
const telegramSendRecovery = createTelegramSendRecovery({
  createRandomId: createTelegramRandomId,
  onConfirmed: (idempotencyKey, result) => {
    try {
      telegramSendResultCallback?.(idempotencyKey, result);
    } catch (error) {
      console.error('Telegram send recovery callback failed:', error?.code || error?.name || 'unknown');
    }
  },
});

const REQUEST_TIMEOUT = 15000;
const MEDIA_REQUEST_TIMEOUT = 120000;
const MAX_PREVIEW_ORIGINAL_PHOTO_BYTES = 12 * 1024 * 1024;
const INVALID_SESSION_MESSAGE = 'Telegram session expired or revoked. Please sign in again.';

function getTelegramRequestTimeout(attachments) {
  return attachments.length > 0 ? MEDIA_REQUEST_TIMEOUT : REQUEST_TIMEOUT;
}

function assertTelegramRunning() {
  assertLifecycleRunning(lifecycleState);
}

function trackTelegramOperation(type, operation) {
  return trackOperation(lifecycleState, type, operation);
}

async function disconnectPendingLogin(pending) {
  if (!pending?.client) return;

  try {
    await pending.client.disconnect();
  } catch (error) {
    console.error('Pending Telegram login cleanup failed:', error?.code || error?.name || 'unknown');
  }
}

async function clearPendingLogin(options) {
  const pending = lifecycleState.pendingLogin;
  if (pending) {
    await pending.clear(options);
  }
}

async function invalidateTelegramSession(requestGeneration) {
  if (requestGeneration !== lifecycleState.loginGeneration) {
    return false;
  }

  if (invalidSessionCleanupPromise) {
    return invalidSessionCleanupPromise;
  }

  invalidSessionCleanupPromise = (async () => {
    if (requestGeneration !== lifecycleState.loginGeneration) {
      return false;
    }

    stopTelegramReconnect();

    if (!clearAccountSecrets()) {
      console.error('Invalid Telegram session cleanup write failed.');
    }

    const clientToClear = client;
    client = null;
    lifecycleState.status = 'disconnected';
    lifecycleState.loginGeneration += 1;
    const invalidationGeneration = lifecycleState.loginGeneration;
    await clearPendingLogin();
    runtimeState.sessionString = '';

    if (clientToClear) {
      try {
        await clientToClear.disconnect();
      } catch (disconnectError) {
        console.error('Invalid Telegram session disconnect failed:', disconnectError?.code || disconnectError?.name || 'unknown');
      }
    }

    if (lifecycleState.loginGeneration !== invalidationGeneration) {
      return false;
    }

    console.log('Telegram reauth required.');
    notifyTelegramStatus({
      status: 'reauth_required',
      connected: false,
      error: INVALID_SESSION_MESSAGE
    });
    return true;
  })();

  try {
    return await invalidSessionCleanupPromise;
  } finally {
    invalidSessionCleanupPromise = null;
  }
}

function getTelegramRateLimitAccountId() {
  const sessionString = normalizeSessionString(runtimeState.sessionString);
  const identity = sessionString
    ? crypto.createHash('sha256').update(sessionString).digest('hex')
    : `login:${runtimeState.apiId || 'unknown'}:${lifecycleState.loginGeneration}`;
  return `telegram-session:${identity}`;
}

function getTelegramRateLimitState() {
  const accountId = getTelegramRateLimitAccountId();
  const current = rateLimitInterceptor.getState(accountId);
  return {
    success: true,
    current: {
      ...current,
      status: current.paused ? 'rate-limited' : activeTelegramStatus,
      category: current.paused ? 'flood' : activeTelegramStatusCategory,
      ...(activeTelegramStatusError ? { error: activeTelegramStatusError } : {}),
    },
    pausedAccounts: rateLimitInterceptor.getSnapshot(),
  };
}

function isTelegramConnected() {
  return Boolean(
    client
    && client.connected
    && lifecycleState.status === 'connected'
    && activeTelegramStatus !== 'network/retrying'
  );
}

function getTelegramStatus() {
  const rateLimitState = getTelegramRateLimitState().current;
  return {
    success: true,
    accountId: rateLimitState.accountId,
    status: rateLimitState.status,
    category: rateLimitState.category,
    connected: isTelegramConnected(),
    ...(rateLimitState.error ? { error: rateLimitState.error } : {}),
  };
}

async function waitForTelegramRateLimit() {
  const accountId = getTelegramRateLimitAccountId();
  const state = await rateLimitInterceptor.waitUntilAvailable(accountId);
  return { success: true, state };
}

function enqueueTelegramPublish(type, operation) {
  const accountId = getTelegramRateLimitAccountId();
  const loginGeneration = lifecycleState.loginGeneration;
  return trackTelegramOperation(type, () => rateLimitInterceptor.enqueue(accountId, async () => {
    assertTelegramRunning();
    if (
      loginGeneration !== lifecycleState.loginGeneration
      || accountId !== getTelegramRateLimitAccountId()
    ) {
      const cancelledError = new Error('Telegram operation was cancelled after the account changed.');
      cancelledError.code = 'TELEGRAM_REQUEST_CANCELLED';
      throw cancelledError;
    }
    return operation();
  }));
}

async function telegramRequest(request) {
  assertTelegramRunning();
  const accountId = getTelegramRateLimitAccountId();
  const loginGeneration = lifecycleState.loginGeneration;
  const isCurrentRequest = () => (
    loginGeneration === lifecycleState.loginGeneration
    && accountId === getTelegramRateLimitAccountId()
  );
  const createCancelledError = () => {
    const cancelledError = new Error('Telegram request was cancelled after the account changed.');
    cancelledError.code = 'TELEGRAM_REQUEST_CANCELLED';
    return cancelledError;
  };

  return rateLimitInterceptor.run(accountId, async () => {
    assertTelegramRunning();
    if (!isCurrentRequest()) {
      throw createCancelledError();
    }

    try {
      const result = await request();
      if (!isCurrentRequest()) {
        throw createCancelledError();
      }
      activeTelegramStatus = 'normal';
      activeTelegramStatusError = null;
      activeTelegramStatusCategory = null;
      return result;
    } catch (error) {
      if (!isCurrentRequest()) {
        throw createCancelledError();
      }

      const classification = classifyTelegramError(error);
      if (classification.category === 'cancelled') {
        throw classification.error;
      }

      if (isInvalidTelegramSessionError(error)) {
        const sessionInvalidated = await invalidateTelegramSession(loginGeneration);
        if (!sessionInvalidated) {
          throw createCancelledError();
        }
        const reauthError = new Error(INVALID_SESSION_MESSAGE);
        reauthError.code = 'TELEGRAM_SESSION_INVALID';
        throw reauthError;
      }

      const statusByCategory = {
        slowmode: 'slowmode',
        auth: 'auth required',
        network: 'network/retrying',
        permission: 'error',
        unknown: 'error',
      };

      activeTelegramStatus = statusByCategory[classification.category] || 'error';
      activeTelegramStatusError = error instanceof Error ? error.message : String(error);
      activeTelegramStatusCategory = classification.category;
      if (classification.category === 'network') {
        lifecycleState.status = 'reconnecting';
      }
      notifyTelegramStatus({
        status: activeTelegramStatus,
        connected: isTelegramConnected(),
        error: activeTelegramStatusError,
        category: classification.category,
        retryable: classification.retryable,
      });

      throw error;
    }
  });
}

// =========================================================
// TELEGRAM STATUS
// =========================================================

function setTelegramStatusCallback(callback) {
  telegramStatusCallback = callback;
}

function notifyTelegramStatus(status) {
  if (typeof telegramStatusCallback === 'function') {
    telegramStatusCallback(status);
  }
}

const {
  reconnectTelegram,
  startTelegramReconnect,
  stopTelegramReconnect,
} = createTelegramReconnect({
  assertRunning: assertTelegramRunning,
  getClient: () => client,
  lifecycleState,
  notifyStatus: notifyTelegramStatus,
  runShared,
  stopReconnect,
  telegramRequest,
  trackOperation: trackTelegramOperation,
  withTimeout,
  checkInternetConnection: options.checkInternetConnection,
});
const {
  refreshRuntimeSecrets,
  getTelegramConfig,
  saveTelegramCredentials,
  saveTelegramApiCredentials,
  restoreApplicationApiCredentials,
  signOutKeepSession,
  forgetTelegramAccount,
  clearTelegramSession,
  loginUser,
} = createTelegramAuth({
  Api,
  TelegramClient,
  StringSession,
  clearApiCredentials,
  authRequestTimeoutMs,
  clearAccountSecrets,
  clearPendingLogin,
  connectTelegramInternal,
  disconnectPendingLogin,
  getApplicationApiCredentials,
  hasCustomApiCredentials,
  getClient: () => client,
  isConnected: isTelegramConnected,
  getSecretValue,
  getStoredTelegramAuthState,
  getTelegramUserName,
  getTelegramUsername,
  lifecycleState,
  loadAccountSecrets,
  normalizeSessionString,
  runtimeState,
  saveAccountSecrets,
  setClient: (nextClient) => { client = nextClient; },
  setTelegramSignedOut,
  startPendingLogin,
  startTelegramReconnect,
  stopTelegramReconnect,
  trackTelegramOperation,
  updateRuntimeSecretsFromConfig,
  withTimeout,
  assertTelegramRunning,
});


// =========================================================
// CONNECT
// =========================================================

async function connectTelegramInternal({ allowSignedOut = false } = {}) {

  assertTelegramRunning();

  refreshRuntimeSecrets();

  if (!runtimeState.apiId || !runtimeState.apiHash) {
    lifecycleState.status = 'disconnected';
    const error = new Error('Telegram API credentials are missing in the secure Electron userData config.');
    error.code = 'TELEGRAM_CREDENTIALS_MISSING';
    throw error;
  }

  if (!runtimeState.sessionString) {
    lifecycleState.status = 'disconnected';
    const error = new Error('No saved Telegram session is available. Sign in again to continue.');
    error.code = 'TELEGRAM_SESSION_MISSING';
    throw error;
  }

  if (runtimeState.signedOut && !allowSignedOut) {
    const error = new Error('Telegram account is signed out. Welcome back to reconnect.');
    error.code = 'TELEGRAM_SIGNED_OUT';
    lifecycleState.status = 'disconnected';
    throw error;
  }

  if (isTelegramConnected()) {
    notifyTelegramStatus('connected');
    return client;
  }

  lifecycleState.status = 'connecting';

  // =======================================================
  // ПЕРЕПОДКЛЮЧЕНИЕ СУЩЕСТВУЮЩЕГО CLIENT
  // =======================================================

  if (client && !isTelegramConnected()) {

    console.log(
      'Telegram disconnected. Reconnecting...'
    );

    notifyTelegramStatus('reconnecting');

    const reconnectGeneration = lifecycleState.reconnectGeneration;
    const clientToReconnect = client;

    try {

      if (clientToReconnect.connected) {
        await clientToReconnect.disconnect();
      }

      await telegramRequest(() => withTimeout(
        clientToReconnect.connect(),
        REQUEST_TIMEOUT,
        'Telegram reconnect'
      ));

      if (
        reconnectGeneration !== lifecycleState.reconnectGeneration ||
        lifecycleState.status === 'shutting-down' ||
        lifecycleState.status === 'stopped' ||
        client !== clientToReconnect
      ) {
        try {
          await clientToReconnect.disconnect();
        } catch (disconnectError) {
          console.error('Stale Telegram reconnect disconnect failed:', disconnectError?.code || disconnectError?.name || 'unknown');
        }

        throw new Error('Telegram reconnect was cancelled.');
      }

      console.log(
        'Telegram reconnected'
      );

      notifyTelegramStatus('connected');


      startTelegramReconnect();
      lifecycleState.status = 'connected';

      return clientToReconnect;

    } catch (error) {

      console.error('Telegram reconnect error:', error?.code || error?.name || 'unknown');

      if (error?.code !== 'TELEGRAM_SESSION_INVALID') {
        notifyTelegramStatus('disconnected');
      }

      throw error;
    }
  }

  // =======================================================
  // СОЗДАЁМ НОВЫЙ CLIENT
  // =======================================================

  client = new TelegramClient(
    new StringSession(runtimeState.sessionString),
    runtimeState.apiId,
    runtimeState.apiHash,
    {
      connectionRetries: 5
    }
  );

  const connectGeneration = lifecycleState.reconnectGeneration;
  const clientToConnect = client;
  const recoveryUpdateTypes = [Api.UpdateMessageID, Api.UpdateNewMessage, Api.UpdateNewChannelMessage];
  if (typeof clientToConnect.addEventHandler === 'function'
    && recoveryUpdateTypes.every((type) => typeof type === 'function')) {
    clientToConnect.addEventHandler(
      (update) => telegramSendRecovery.observeUpdate(update),
      new Raw({ types: recoveryUpdateTypes }),
    );
  }

  notifyTelegramStatus('connecting');

  try {
    await telegramRequest(() => withTimeout(
      clientToConnect.connect(),
      REQUEST_TIMEOUT,
      'Telegram connect'
    ));
  } catch (error) {
    if (client === clientToConnect) {
      if (lifecycleState.status !== 'shutting-down' && lifecycleState.status !== 'stopped') {
        lifecycleState.status = 'disconnected';
        if (error?.code !== 'TELEGRAM_SESSION_INVALID') {
          notifyTelegramStatus('disconnected');
        }
      }
    }

    const shouldRetryConnection = client === clientToConnect
      && classifyTelegramError(error).category === 'network'
      && lifecycleState.status !== 'shutting-down'
      && lifecycleState.status !== 'stopped';
    if (shouldRetryConnection) {
      try {
        await clientToConnect.disconnect();
      } catch (disconnectError) {
        console.error('Telegram disconnect after connect failure failed:', disconnectError?.code || disconnectError?.name || 'unknown');
      }
      if (client === clientToConnect && lifecycleState.status !== 'shutting-down' && lifecycleState.status !== 'stopped') {
        startTelegramReconnect();
      }
    } else {
      if (client === clientToConnect) client = null;
      void Promise.resolve()
        .then(() => clientToConnect.disconnect())
        .catch((disconnectError) => {
          console.error('Telegram disconnect after connect failure failed:', disconnectError?.code || disconnectError?.name || 'unknown');
        });
    }

    throw error;
  }

  if (
    connectGeneration !== lifecycleState.reconnectGeneration ||
    lifecycleState.status === 'shutting-down' ||
    lifecycleState.status === 'stopped' ||
    client !== clientToConnect
  ) {
    if (client === clientToConnect) {
      client = null;
    }

    try {
      await clientToConnect.disconnect();
    } catch (error) {
      console.error('Stale Telegram client disconnect failed:', error?.code || error?.name || 'unknown');
    }

    throw new Error('Telegram connect was cancelled.');
  }

  console.log(
    'Telegram connected'
  );

  notifyTelegramStatus('connected');
  lifecycleState.status = 'connected';

  startTelegramReconnect();

  return client;
}

function connectTelegram() {
  assertTelegramRunning();
  return runShared(lifecycleState, 'connectPromise', () =>
    trackTelegramOperation('connect', connectTelegramInternal)
  );
}

async function welcomeBackInternal() {
  if (!setTelegramSignedOut(false)) {
    throw new Error('Telegram signed-out state could not be cleared securely.');
  }

  runtimeState.signedOut = false;
  return connectTelegramInternal();
}

function welcomeBack() {
  assertTelegramRunning();
  return runShared(lifecycleState, 'connectPromise', () =>
    trackTelegramOperation('welcome-back', welcomeBackInternal)
  );
}

async function shutdownTelegram() {
  if (shutdownPromise) return shutdownPromise;

  shutdownPromise = beginShutdown(lifecycleState, async () => {
    rateLimitInterceptor.clearAll();
    await clearPendingLogin();

    const pending = [...lifecycleState.pendingOperations.values()]
      .map((operation) => operation.promise)
      .filter(Boolean);

    if (pending.length > 0) {
      try {
        await withTimeout(
          Promise.allSettled(pending),
          REQUEST_TIMEOUT,
          'Telegram shutdown drain'
        );
      } catch (error) {
        console.error('Telegram shutdown drain timed out. Underlying operations may still be running.');
      }
    }

    const clientToClear = client;
    client = null;
    runtimeState.sessionString = '';

    if (clientToClear) {
      try {
        await clientToClear.disconnect();
      } catch (error) {
        console.error('Telegram shutdown disconnect failed:', error?.code || error?.name || 'unknown');
      }
    }

    console.log('Telegram disconnected.');
    notifyTelegramStatus({ status: 'disconnected', connected: false });
  });

  return shutdownPromise;
}

// =========================================================
// GET CHATS
// =========================================================

const chatData = createTelegramChatData({
  Api,
  connectTelegram,
  getClient: () => client,
  telegramRequest,
  withTimeout,
});
const {
  getChatAvatarDataUrl,
  getChatsInternal,
  getChatAvatarInternal,
  getAccountAvatarInternal,
  getChatPermissionsInternal,
  getChatHistoryInternal,
  deleteSavedMessageInternal,
  getContactsInternal,
  getAvailableEffectsInternal,
} = chatData;

function getChats() {
  return trackTelegramOperation('getChats', getChatsInternal);
}

function getChatAvatar(chatId) {
  return trackTelegramOperation('getChatAvatar', () => getChatAvatarInternal(chatId));
}

function getAccountAvatar() {
  return trackTelegramOperation('getAccountAvatar', getAccountAvatarInternal);
}

function getChatPermissions(chatId) {
  return trackTelegramOperation('getChatPermissions', () => getChatPermissionsInternal(chatId));
}

function getChatHistory(chatId, limit, offsetId, cachedAvatarDataUrl) {
  return trackTelegramOperation('getChatHistory', () =>
    getChatHistoryInternal(chatId, limit, offsetId, cachedAvatarDataUrl)
  );
}

function deleteSavedMessage(chatId, messageId) {
  return trackTelegramOperation('deleteSavedMessage', () =>
    deleteSavedMessageInternal(chatId, messageId)
  );
}

// =========================================================
// GET TELEGRAM CONTACTS
// =========================================================

function getContacts() {
  return trackTelegramOperation('getContacts', getContactsInternal);
}

function getAvailableEffects() {
  return trackTelegramOperation('getAvailableEffects', getAvailableEffectsInternal);
}

const { resolveChatInternal } = createTelegramChatResolver({
  connectTelegram,
  getChatAvatarDataUrl,
  getClient: () => client,
  getContacts,
  telegramRequest,
  withTimeout,
});

function resolveChat(query) {
  return trackTelegramOperation('resolveChat', () => resolveChatInternal(query));
}

// =========================================================
// SEND MESSAGE
// =========================================================

const sendMessageInternal = createTelegramSender({
  connectTelegram,
  getClient: () => client,
  getTelegramRequestTimeout,
  logTelegramOperation,
  normalizeTelegramMessage,
  observeTelegramResponse: telegramSendRecovery.observeResponse,
  telegramRequest,
  trackSendAttempt: telegramSendRecovery.trackSendAttempt,
  toTelegramFormattingEntities,
  withTelegramInvokeDiagnostics,
  withTimeout,
});

function sendMessage(chatId, message, attachments, entities, silent, effect, idempotencyKey) {
  return enqueueTelegramPublish('send', () => sendMessageInternal(
    chatId,
    message,
    attachments,
    entities,
    silent,
    effect,
    idempotencyKey,
  ));
}

async function reconcileSendAttempt(idempotencyKey, attachmentCount = 0) {
  telegramSendRecovery.trackSendAttempt(idempotencyKey, attachmentCount);
  try {
    const connectedClient = await connectTelegram();
    if (typeof connectedClient.catchUp === 'function') {
      await telegramRequest(() => withTimeout(
        connectedClient.catchUp(),
        REQUEST_TIMEOUT,
        'Telegram send recovery',
      ));
    }
    const result = telegramSendRecovery.getResult(idempotencyKey, attachmentCount);
    return result
      ? { success: true, state: 'sent', ...result }
      : { success: true, state: 'unknown' };
  } catch (error) {
    return {
      success: false,
      state: 'unknown',
      error: error instanceof Error ? error.message : 'Telegram send result could not be checked.',
    };
  }
}

function setTelegramSendResultCallback(callback) {
  telegramSendResultCallback = typeof callback === 'function' ? callback : null;
}

// =========================================================
// SCHEDULE MESSAGE
// =========================================================

const {
  reconcilePendingScheduleInternal,
  scheduleMessageInternal,
  cancelScheduledMessageInternal,
} = createTelegramScheduler({
  Api,
  connectTelegram,
  getClient: () => client,
  getTelegramRequestTimeout,
  scheduleCleanupRetryDelay: options.scheduleCleanupRetryDelay,
  telegramRequest,
  withTimeout,
});

function scheduleMessage(chatId, message, date, time, targetTimestamp, attachments, entities, silent, effect) {
  return enqueueTelegramPublish('schedule', () => scheduleMessageInternal(
    chatId,
    message,
    date,
    time,
    targetTimestamp,
    attachments,
    entities,
    silent,
    effect,
  ));
}

function reconcilePendingSchedule(operation) {
  return trackTelegramOperation('reconcilePendingSchedule', () => reconcilePendingScheduleInternal(operation));
}

// =========================================================
// CANCEL SCHEDULED MESSAGE
// =========================================================

function cancelScheduledMessage(chatId, messageId, message, targetTimestamp) {
  return trackTelegramOperation('cancel', () => cancelScheduledMessageInternal(
    chatId,
    messageId,
    message,
    targetTimestamp
  ));
}

// =========================================================
// EXPORTS
// =========================================================

  return {
    getTelegramConfig,
    saveTelegramApiCredentials,
    saveTelegramCredentials,
    restoreApplicationApiCredentials,
    signOutKeepSession,
    welcomeBack,
    forgetTelegramAccount,
    clearTelegramSession,
    loginUser,
    connectTelegram,
    getChats,
    getChatPermissions,
    getChatAvatar,
    getAccountAvatar,
    getChatHistory,
    deleteSavedMessage,
    getContacts,
    getAvailableEffects,
    resolveChat,
    getScheduleOperationIdentities,
    sendMessage,
    reconcileSendAttempt,
    scheduleMessage,
    reconcilePendingSchedule,
    cancelScheduledMessage,
    getTelegramRateLimitState,
    getTelegramStatus,
    waitForTelegramRateLimit,
    shutdownTelegram,
    setTelegramStatusCallback,
    setTelegramSendResultCallback,
    lifecycleState,
    resolveMessageDirection,
    normalizeHistoryMessage,
  };
}

const defaultCore = createTelegramCore();

module.exports = {
  createTelegramCore,
  getTelegramConfig: (...args) => defaultCore.getTelegramConfig(...args),
  saveTelegramApiCredentials: (...args) => defaultCore.saveTelegramApiCredentials(...args),
  restoreApplicationApiCredentials: (...args) => defaultCore.restoreApplicationApiCredentials(...args),
  saveTelegramCredentials: (...args) => defaultCore.saveTelegramCredentials(...args),
  signOutKeepSession: (...args) => defaultCore.signOutKeepSession(...args),
  welcomeBack: (...args) => defaultCore.welcomeBack(...args),
  forgetTelegramAccount: (...args) => defaultCore.forgetTelegramAccount(...args),
  clearTelegramSession: (...args) => defaultCore.clearTelegramSession(...args),
  loginUser: (...args) => defaultCore.loginUser(...args),
  connectTelegram: (...args) => defaultCore.connectTelegram(...args),
  getChats: (...args) => defaultCore.getChats(...args),
  getChatPermissions: (...args) => defaultCore.getChatPermissions(...args),
  getChatAvatar: (...args) => defaultCore.getChatAvatar(...args),
  getAccountAvatar: (...args) => defaultCore.getAccountAvatar(...args),
  getChatHistory: (...args) => defaultCore.getChatHistory(...args),
  deleteSavedMessage: (...args) => defaultCore.deleteSavedMessage(...args),
  getContacts: (...args) => defaultCore.getContacts(...args),
  normalizeQuery,
  normalizePhone,
  isPhoneLikeQuery,
  isUsernameQuery,
  getAvailableEffects: (...args) => defaultCore.getAvailableEffects(...args),
  resolveChat: (...args) => defaultCore.resolveChat(...args),
  getScheduleOperationIdentities: (...args) => defaultCore.getScheduleOperationIdentities(...args),
  sendMessage: (...args) => defaultCore.sendMessage(...args),
  reconcileSendAttempt: (...args) => defaultCore.reconcileSendAttempt(...args),
  setTelegramSendResultCallback: (...args) => defaultCore.setTelegramSendResultCallback(...args),
  scheduleMessage: (...args) => defaultCore.scheduleMessage(...args),
  reconcilePendingSchedule: (...args) => defaultCore.reconcilePendingSchedule(...args),
  cancelScheduledMessage: (...args) => defaultCore.cancelScheduledMessage(...args),
  getTelegramRateLimitState: (...args) => defaultCore.getTelegramRateLimitState(...args),
  getTelegramStatus: (...args) => defaultCore.getTelegramStatus(...args),
  waitForTelegramRateLimit: (...args) => defaultCore.waitForTelegramRateLimit(...args),
  shutdownTelegram: (...args) => defaultCore.shutdownTelegram(...args),
  setTelegramStatusCallback: (...args) => defaultCore.setTelegramStatusCallback(...args),
  resolveMessageDirection,
  normalizeHistoryMessage,
};