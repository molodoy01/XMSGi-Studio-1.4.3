function createTelegramAuth({
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
  getClient,
  isConnected,
  getSecretValue,
  getStoredTelegramAuthState,
  getTelegramUserName,
  getTelegramUsername,
  lifecycleState,
  loadAccountSecrets,
  normalizeSessionString,
  runtimeState,
  saveAccountSecrets,
  setClient,
  setTelegramSignedOut,
  startPendingLogin,
  startTelegramReconnect,
  stopTelegramReconnect,
  trackTelegramOperation,
  updateRuntimeSecretsFromConfig,
  withTimeout,
  assertTelegramRunning,
}) {
  let loginPromise = null;

  function refreshRuntimeSecrets() {
    const next = updateRuntimeSecretsFromConfig(loadAccountSecrets());
    const applicationApiCredentials = getApplicationApiCredentials(loadAccountSecrets());
    runtimeState.apiId = Number(applicationApiCredentials.apiId ?? next.apiId);
    runtimeState.apiHash = applicationApiCredentials.apiHash ?? next.apiHash;
    runtimeState.sessionString = next.sessionString || '';
    runtimeState.signedOut = next.signedOut === true;
    return {
      apiId: runtimeState.apiId,
      sessionString: runtimeState.sessionString,
      signedOut: runtimeState.signedOut
    };
  }

  function getTelegramConfig() {
    const secrets = loadAccountSecrets();
    const storedAuthState = typeof getStoredTelegramAuthState === 'function'
      ? getStoredTelegramAuthState()
      : { signedOut: secrets.signedOut, userName: '', username: '' };
    const apiCredentials = getApplicationApiCredentials(secrets);
    const sessionString = normalizeSessionString(secrets.SESSION_STRING);

  return {
    hasCredentials: Boolean(apiCredentials.apiId && apiCredentials.apiHash),
    hasCustomCredentials: hasCustomApiCredentials(secrets),
    apiId: apiCredentials.apiId ? String(apiCredentials.apiId) : '',
    hasSession: Boolean(sessionString),
    signedOut: storedAuthState.signedOut === true,
    userName: storedAuthState.userName || '',
    username: storedAuthState.username || '',
    connected: isConnected()
  };
}

async function saveTelegramCredentials(data = {}) {
  const rawApiId = data.API_ID ?? data.apiId;
  const rawApiHash = data.API_HASH ?? data.apiHash;
  const rawSession = data.SESSION_STRING ?? data.sessionString;
  const rawUserName = data.userName;
  const rawUsername = data.username;

  const secrets = {};

  if (rawApiId !== undefined && rawApiId !== null && rawApiId !== '') {
    secrets.API_ID = String(rawApiId);
  }

  if (rawApiHash !== undefined && rawApiHash !== null && rawApiHash !== '') {
    secrets.API_HASH = String(rawApiHash);
  }

  if (rawSession !== undefined && rawSession !== null && rawSession !== '') {
    secrets.SESSION_STRING = normalizeSessionString(rawSession);
  }

  if (rawUserName !== undefined) {
    secrets.userName = String(rawUserName || '').trim();
  }

  if (rawUsername !== undefined) {
    secrets.username = String(rawUsername || '').trim().replace(/^@/, '');
  }

  secrets.signedOut = false;

  const saved = saveAccountSecrets(secrets);

  if (saved) {
    refreshRuntimeSecrets();
  }

  return {
    saved,
    config: getTelegramConfig()
  };
}

function saveTelegramApiCredentials(data = {}) {
  const saved = saveAccountSecrets({
    API_ID: String(data.API_ID ?? data.apiId ?? ''),
    API_HASH: String(data.API_HASH ?? data.apiHash ?? '')
  });

  if (saved) {
    refreshRuntimeSecrets();
  }

  return {
    saved,
    config: getTelegramConfig()
  };
}

function restoreApplicationApiCredentials() {
  const saved = clearApiCredentials();
  if (saved) {
    refreshRuntimeSecrets();
  }

  return {
    saved,
    config: getTelegramConfig()
  };
}

async function signOutKeepSessionInternal() {
  const clientToClear = getClient();

  stopTelegramReconnect();
  lifecycleState.loginGeneration += 1;
  setClient(null);
  lifecycleState.status = 'disconnected';
  await clearPendingLogin();

  if (clientToClear) {
    try {
      await clientToClear.disconnect();
    } catch (error) {
      console.error('Telegram disconnect during sign out failed:', error?.code || error?.name || 'unknown');
      throw error;
    }
  }

  if (!setTelegramSignedOut(true)) {
    throw new Error('Telegram signed-out state could not be saved securely.');
  }

  runtimeState.signedOut = true;
  return { signedOut: true, config: getTelegramConfig() };
}

function signOutKeepSession() {
  return trackTelegramOperation('sign-out', signOutKeepSessionInternal);
}

async function forgetTelegramAccountInternal() {
  stopTelegramReconnect();
  lifecycleState.loginGeneration += 1;
  await clearPendingLogin();

  let logoutError = null;
  let clientToClear = getClient();

  if (!clientToClear && runtimeState.sessionString) {
    try {
      clientToClear = await connectTelegramInternal({ allowSignedOut: true });
    } catch (error) {
      logoutError = error;
      clientToClear = getClient();
    }
  }

  setClient(null);
  lifecycleState.status = 'disconnected';
  stopTelegramReconnect();

  if (clientToClear) {
    try {
      if (clientToClear.connected) {
        await clientToClear.logOut();
      } else {
        await clientToClear.disconnect();
      }
    } catch (error) {
      logoutError = error;
      console.error('Telegram server logout failed; continuing local cleanup:', error?.code || error?.name || 'unknown');
      try {
        await clientToClear.disconnect();
      } catch (disconnectError) {
        console.error('Error disconnecting Telegram client during session clear:', disconnectError?.code || disconnectError?.name || 'unknown');
      }
    }
  }

  const configSaved = clearAccountSecrets();

  if (!configSaved) {
    throw new Error('Telegram session could not be cleared from secure storage.');
  }

  runtimeState.sessionString = '';
  runtimeState.signedOut = false;

  if (logoutError) {
    throw logoutError;
  }

  return { cleared: true, config: getTelegramConfig() };
}

function forgetTelegramAccount() {
  return trackTelegramOperation('forget-account', forgetTelegramAccountInternal);
}

function clearTelegramSession() {
  return forgetTelegramAccount();
}

async function signInWithTwoFactorPassword(loginClient, credentials, password, timeoutMs) {
  let passwordError;

  try {
    return await withTimeout(
      loginClient.signInWithPassword(credentials, {
        password: async () => password,
        onError: async (error) => {
          passwordError = error;
          console.error('Telegram 2FA error:', error?.errorMessage || error?.code || error?.name || 'unknown');
          return true;
        }
      }),
      timeoutMs,
      'Telegram 2FA verification'
    );
  } catch (error) {
    if (passwordError) throw passwordError;
    throw error;
  }
}

async function loginUserInternal(params = {}) {
  const apiIdValue = params.API_ID ?? params.apiId ?? runtimeState.apiId;
  const apiHashValue = params.API_HASH ?? params.apiHash ?? runtimeState.apiHash;
  const phone = params.phoneNumber ?? params.phone ?? '';
  const password = params.password ?? '';
  const code = params.phoneCode ?? '';

  if (!apiIdValue || !apiHashValue) {
    throw new Error('Telegram API credentials are missing. Save API_ID and API_HASH first.');
  }

  const loginApiId = Number(apiIdValue);

  if (!loginApiId) {
    throw new Error('Telegram API_ID must be a valid number.');
  }

  if (!phone) {
    throw new Error('Phone number is required for Telegram login.');
  }

  const loginGeneration = lifecycleState.loginGeneration;

  const pending = lifecycleState.pendingLogin?.value;
  const samePendingLogin =
    pending &&
    pending.phone === phone &&
    pending.apiId === loginApiId &&
    pending.apiHash === String(apiHashValue);

  if (!samePendingLogin) {
    if (pending?.client) {
      throw new Error('Telegram login is already in progress.');
    }

    const loginClient = new TelegramClient(
      new StringSession(''),
      loginApiId,
      String(apiHashValue),
      { connectionRetries: 3 }
    );

    let sendCodeResult;
    try {
      await withTimeout(
        loginClient.connect(),
        authRequestTimeoutMs,
        'Telegram login connection'
      );

      if (
        loginGeneration !== lifecycleState.loginGeneration ||
        lifecycleState.status === 'shutting-down' ||
        lifecycleState.status === 'stopped'
      ) {
        throw new Error('Telegram login was cancelled.');
      }

      sendCodeResult = await withTimeout(
        loginClient.sendCode({
          apiId: loginApiId,
          apiHash: String(apiHashValue)
        }, phone),
        authRequestTimeoutMs,
        'Telegram login code request'
      );

      if (
        loginGeneration !== lifecycleState.loginGeneration ||
        lifecycleState.status === 'shutting-down' ||
        lifecycleState.status === 'stopped'
      ) {
        throw new Error('Telegram login was cancelled.');
      }
    } catch (error) {
      await disconnectPendingLogin({ client: loginClient });
      throw error;
    }

    startPendingLogin(lifecycleState, {
      client: loginClient,
      phone,
      apiId: loginApiId,
      apiHash: String(apiHashValue),
      phoneCodeHash: sendCodeResult.phoneCodeHash,
      isCodeViaApp: sendCodeResult.isCodeViaApp,
      requiresPassword: false
    }, disconnectPendingLogin);

    return {
      requiresCode: true,
      phoneCodeHash: sendCodeResult.phoneCodeHash,
      isCodeViaApp: sendCodeResult.isCodeViaApp,
      nextStep: 'code'
    };
  }

  if (!code) {
    return {
      requiresCode: true,
      phoneCodeHash: lifecycleState.pendingLogin.value.phoneCodeHash,
      isCodeViaApp: lifecycleState.pendingLogin.value.isCodeViaApp,
      nextStep: 'code'
    };
  }

  const pendingLogin = lifecycleState.pendingLogin.value;
  const loginClient = pendingLogin.client;

  try {
    let user;

    if (pendingLogin.requiresPassword) {
      if (!password) {
        return {
          requiresPassword: true,
          nextStep: 'password'
        };
      }

      user = await signInWithTwoFactorPassword(
        loginClient,
        {
          apiId: loginApiId,
          apiHash: String(apiHashValue)
        },
        password,
        authRequestTimeoutMs
      );
    } else {
      try {
        const authorization = await withTimeout(
          loginClient.invoke(
            new Api.auth.SignIn({
              phoneNumber: pendingLogin.phone,
              phoneCodeHash: pendingLogin.phoneCodeHash,
              phoneCode: code
            })
          ),
          authRequestTimeoutMs,
          'Telegram code verification'
        );

        user = authorization.user;
      } catch (error) {
        const errorMessage = error?.errorMessage || error?.message || '';

        if (!/SESSION_PASSWORD_NEEDED/i.test(errorMessage)) {
          throw error;
        }

        pendingLogin.requiresPassword = true;

        if (!password) {
          return {
            requiresPassword: true,
            nextStep: 'password'
          };
        }

        user = await signInWithTwoFactorPassword(
          loginClient,
          {
            apiId: loginApiId,
            apiHash: String(apiHashValue)
          },
          password,
          authRequestTimeoutMs
        );
      }
    }

    const session = loginClient.session.save();

    assertTelegramRunning();
    if (loginGeneration !== lifecycleState.loginGeneration) {
      throw new Error('Telegram login was cancelled.');
    }

    const hasEnvironmentCredentials = Boolean(
      typeof process.env.API_ID === 'string' && process.env.API_ID.trim()
      && typeof process.env.API_HASH === 'string' && process.env.API_HASH.trim()
    );
    const credentialsResult = await saveTelegramCredentials({
      ...(!hasEnvironmentCredentials ? {
        API_ID: loginApiId,
        API_HASH: String(apiHashValue),
      } : {}),
      SESSION_STRING: session,
      userName: getTelegramUserName(user),
      username: getTelegramUsername(user),
      signedOut: false
    });

    assertTelegramRunning();
    if (loginGeneration !== lifecycleState.loginGeneration) {
      throw new Error('Telegram login was cancelled.');
    }

    if (!credentialsResult.saved) {
      throw new Error('New Telegram session could not be saved securely.');
    }

    const savedSession = normalizeSessionString(session);

    runtimeState.sessionString = savedSession;
    runtimeState.signedOut = false;
    setClient(loginClient);
    await clearPendingLogin({ cleanup: false });
    startTelegramReconnect();

    return {
      success: true,
      user,
      session: savedSession,
      requiresCode: false,
      nextStep: 'done'
    };
  } finally {
    if (!pendingLogin && getClient() !== loginClient) {
      try {
        await loginClient.disconnect();
      } catch (error) {
        console.error('Telegram login disconnect cleanup failed:', error?.code || error?.name || 'unknown');
      }
    }
  }
}

function loginUser(params = {}) {
  assertTelegramRunning();

  if (loginPromise) {
    return loginPromise;
  }

  loginPromise = trackTelegramOperation('login', () => loginUserInternal(params))
    .catch(async (error) => {
      const errorMessage = error?.errorMessage || error?.message || String(error);
      if (!/\b(?:PHONE_CODE_INVALID|PASSWORD_HASH_INVALID)\b/i.test(errorMessage)) {
        await clearPendingLogin();
      }
      throw error;
    })
    .finally(() => {
      loginPromise = null;
    });

  return loginPromise;
}



  return {
    refreshRuntimeSecrets,
    getTelegramConfig,
    saveTelegramCredentials,
    saveTelegramApiCredentials,
    restoreApplicationApiCredentials,
    signOutKeepSession,
    forgetTelegramAccount,
    clearTelegramSession,
    loginUser,
  };
}

module.exports = { createTelegramAuth };
