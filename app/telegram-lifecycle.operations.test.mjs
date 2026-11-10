import { describe, expect, it, vi } from 'vitest';
import lifecycle from './telegram-lifecycle.cjs';
import { commitLoginIfCurrent, finishLoginAfterCredentials, createDeferred, shutdownWithDrain, runTrackedShared } from './telegram-lifecycle.testUtils.mjs';

vi.mock('electron', () => ({
  app: { getPath: () => 'C:\\temp' },
  safeStorage: { isEncryptionAvailable: () => false }
}));

const {
  createLifecycleState,
  beginShutdown,
  runShared,
  trackOperation,
  startPendingLogin,
} = lifecycle;


describe('single-account Telegram lifecycle', () => {
  it('shares reconnect and connect execution and cancels both during shutdown', async () => {
    const state = createLifecycleState();
    const reconnectGate = createDeferred();
    let attempts = 0;
    const reconnect = () => runTrackedShared(state, 'connectPromise', 'reconnect', async () => {
      attempts += 1;
      state.reconnectInProgress = true;
      await reconnectGate.promise;
      state.reconnectInProgress = false;
      if (state.status !== 'idle') throw new Error('reconnect cancelled');
      state.client = { id: 'reconnected' };
      return state.client;
    });
    const connect = () => runTrackedShared(state, 'connectPromise', 'connect', async () => {
      attempts += 1;
      return { id: 'connected' };
    });

    const reconnecting = reconnect();
    const connecting = connect();
    expect(connecting).toBe(reconnecting);
    expect(attempts).toBe(0);
    await Promise.resolve();
    await Promise.resolve();
    expect(state.reconnectInProgress).toBe(true);

    const shutdown = shutdownWithDrain(state);
    reconnectGate.resolve();
    await expect(reconnecting).rejects.toThrow('cancelled');
    await shutdown;
    expect(attempts).toBe(1);
    expect(state.client).toBeUndefined();
    expect(state.reconnectInProgress).toBe(false);
  });

  it('drains an in-flight operation during shutdown without affecting another state', async () => {
    const stateA = createLifecycleState();
    const stateB = createLifecycleState();
    const operationA = createDeferred();
    const operationB = createDeferred();
    const trackedA = trackOperation(stateA, 'send', () => operationA.promise);
    const trackedB = trackOperation(stateB, 'send', () => operationB.promise);
    const shutdownA = shutdownWithDrain(stateA);

    operationA.resolve('A');
    await expect(trackedA).resolves.toBe('A');
    await shutdownA;
    expect(stateA.pendingOperations.size).toBe(0);
    expect(stateB.status).toBe('idle');
    expect(stateB.pendingOperations.size).toBe(1);

    operationB.resolve('B');
    await expect(trackedB).resolves.toBe('B');
    expect(stateB.pendingOperations.size).toBe(0);
  });

  it('shares one concurrent connect execution and client', async () => {
    const state = createLifecycleState();
    let clientCreations = 0;
    let release;
    const gate = new Promise((resolve) => { release = resolve; });
    const operation = async () => {
      clientCreations += 1;
      const client = { id: clientCreations };
      await gate;
      state.client = client;
      return client;
    };

    const first = runShared(state, 'connectPromise', operation);
    const second = runShared(state, 'connectPromise', operation);
    release();

    const [firstClient, secondClient] = await Promise.all([first, second]);
    expect(firstClient).toBe(secondClient);
    expect(state.client).toBe(firstClient);
    expect(clientCreations).toBe(1);
    expect(state.connectPromise).toBeNull();
  });

  it('does not commit a pending login after clearSession invalidates its generation', async () => {
    const state = createLifecycleState();
    const client = { id: 'old-login' };
    const pending = startPendingLogin(state, { client }, vi.fn());
    const loginGeneration = state.loginGeneration;
    let release;
    const login = new Promise((resolve) => { release = resolve; })
      .then(() => commitLoginIfCurrent(state, loginGeneration, client));

    state.loginGeneration += 1;
    await pending.clear();
    release();

    await expect(login).resolves.toBe(false);
    expect(state.client).toBeUndefined();
  });

  it('does not commit a pending login after shutdown invalidates its generation', async () => {
    const state = createLifecycleState();
    const client = { id: 'shutdown-login' };
    const pending = startPendingLogin(state, { client }, vi.fn());
    const loginGeneration = state.loginGeneration;
    let release;
    const login = new Promise((resolve) => { release = resolve; })
      .then(() => commitLoginIfCurrent(state, loginGeneration, client));
    const shutdown = beginShutdown(state, () => pending.clear());

    release();
    await expect(login).resolves.toBe(false);
    await shutdown;
    expect(state.client).toBeUndefined();
    expect(state.status).toBe('stopped');
  });

  it('cancels a login when clearSession occurs during credential save', async () => {
    const state = createLifecycleState();
    const client = { id: 'clear-during-save' };
    const saveStarted = Promise.resolve();
    let releaseSave;
    const saveCredentials = vi.fn(() => new Promise((resolve) => { releaseSave = resolve; }));
    const reconnect = vi.fn();
    const login = finishLoginAfterCredentials(
      state,
      state.loginGeneration,
      saveCredentials,
      client,
      reconnect
    );

    await saveStarted;
    await Promise.resolve();
    state.loginGeneration += 1;
    state.client = null;
    releaseSave();

    await expect(login).rejects.toThrow('cancelled');
    expect(state.client).toBeNull();
    expect(reconnect).not.toHaveBeenCalled();
  });

  it('cancels a login when shutdown occurs during credential save', async () => {
    const state = createLifecycleState();
    const client = { id: 'shutdown-during-save' };
    let releaseSave;
    const saveCredentials = vi.fn(() => new Promise((resolve) => { releaseSave = resolve; }));
    const reconnect = vi.fn();
    const login = finishLoginAfterCredentials(
      state,
      state.loginGeneration,
      saveCredentials,
      client,
      reconnect
    );
    const shutdown = beginShutdown(state, vi.fn());

    releaseSave();
    await expect(login).rejects.toThrow('cancelled');
    await shutdown;
    expect(state.client).toBeUndefined();
    expect(reconnect).not.toHaveBeenCalled();
  });

  it('stops the reconnect timer during shutdown', async () => {
    vi.useFakeTimers();
    try {
      const state = createLifecycleState();
      let ticks = 0;
      state.reconnectTimer = globalThis.setInterval(() => { ticks += 1; }, 10);

      await beginShutdown(state, vi.fn());
      await vi.advanceTimersByTimeAsync(100);

      expect(state.reconnectTimer).toBeNull();
      expect(ticks).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it('runs shutdown cleanup once when shutdown is repeated', async () => {
    const state = createLifecycleState();
    const cleanup = vi.fn().mockResolvedValue(undefined);

    const first = beginShutdown(state, cleanup);
    const second = beginShutdown(state, cleanup);

    expect(second).toBe(first);
    await Promise.all([first, second]);
    expect(cleanup).toHaveBeenCalledTimes(1);
  });

  it('rejects every new operation after shutdown', async () => {
    const state = createLifecycleState();
    await beginShutdown(state, vi.fn());

    expect(() => trackOperation(state, 'connect', () => undefined)).toThrow(
      'shutting down'
    );
    expect(() => runShared(state, 'connectPromise', () => undefined)).toThrow(
      'shutting down'
    );
  });

  it('releases a failed shared operation and permits the next attempt', async () => {
    const state = createLifecycleState();
    const operation = vi
      .fn()
      .mockRejectedValueOnce(new Error('failed'))
      .mockResolvedValueOnce('connected');

    await expect(runShared(state, 'connectPromise', operation)).rejects.toThrow('failed');
    await expect(runShared(state, 'connectPromise', operation)).resolves.toBe('connected');
    expect(operation).toHaveBeenCalledTimes(2);
  });

  it('tracks operations until their underlying promise settles', async () => {
    const state = createLifecycleState();
    let release;
    const operation = new Promise((resolve) => { release = resolve; });
    const tracked = trackOperation(state, 'getChats', () => operation);

    await Promise.resolve();
    expect(state.pendingOperations.size).toBe(1);
    release([]);
    await tracked;
    expect(state.pendingOperations.size).toBe(0);
  });
});
