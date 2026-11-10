import lifecycle from './telegram-lifecycle.cjs';

const {
  beginShutdown,
  runShared,
  trackOperation,
} = lifecycle;

export function commitLoginIfCurrent(state, loginGeneration, client) {
  if (
    state.status === 'shutting-down' ||
    state.status === 'stopped' ||
    state.loginGeneration !== loginGeneration
  ) {
    return false;
  }

  state.client = client;
  return true;
}

export async function finishLoginAfterCredentials(
  state,
  loginGeneration,
  saveCredentials,
  client,
  startReconnect
) {
  await saveCredentials();

  if (!commitLoginIfCurrent(state, loginGeneration, client)) {
    throw new Error('Telegram login was cancelled.');
  }

  startReconnect();
}

export function createDeferred() {
  let resolve;
  const promise = new Promise((res) => { resolve = res; });
  return { promise, resolve };
}

export async function shutdownWithDrain(state) {
  return beginShutdown(state, async () => {
    const pending = [...state.pendingOperations.values()]
      .map((operation) => operation.promise)
      .filter(Boolean);

    await Promise.allSettled(pending);
    if (state.pendingLogin) await state.pendingLogin.clear();
  });
}

export function runTrackedShared(state, key, type, operation) {
  return runShared(state, key, () => trackOperation(state, type, operation));
}
