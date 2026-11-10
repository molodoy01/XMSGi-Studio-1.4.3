import { describe, expect, it, vi } from 'vitest';
import { createRequire } from 'node:module';
import process from 'node:process';
import lifecycle from './telegram-lifecycle.cjs';
import { createDeferred, shutdownWithDrain, runTrackedShared } from './telegram-lifecycle.testUtils.mjs';

vi.mock('electron', () => ({
  app: { getPath: () => 'C:\\temp' },
  safeStorage: { isEncryptionAvailable: () => false }
}));

const nodeRequire = createRequire(import.meta.url);
const nodeModule = nodeRequire('node:module');

const {
  createLifecycleState,
  beginShutdown,
  runShared,
  trackOperation,
  stopReconnect,
} = lifecycle;
const { createTelegramReconnect } = nodeRequire('./telegram-reconnect.cjs');


describe('single-account Telegram lifecycle', () => {
  it('uses backend environment API credentials without exposing their values in auth config', async () => {
    vi.resetModules();
    const previousApiId = process.env.API_ID;
    const previousApiHash = process.env.API_HASH;
    const originalLoad = nodeModule._load;
    process.env.API_ID = '123456';
    process.env.API_HASH = 'private-api-hash';
    nodeModule._load = function load(request, parent, isMain) {
      if (request === './telegram-account-storage.cjs') {
        return {
          loadAccountSecrets: () => ({ API_ID: '', API_HASH: '', SESSION_STRING: '', signedOut: false }),
          getTelegramAuthState: () => ({ hasSession: false, signedOut: false, userName: '' }),
          saveAccountSecrets: () => true,
          setTelegramSignedOut: () => true,
          clearAccountSecrets: () => true
        };
      }

      return originalLoad(request, parent, isMain);
    };

    try {
      const { createTelegramCore } = await import('./telegram.cjs');
      const config = createTelegramCore().getTelegramConfig();

      expect(config.hasCredentials).toBe(true);
      expect(config).not.toHaveProperty('API_ID');
      expect(config).not.toHaveProperty('API_HASH');
      expect(JSON.stringify(config)).not.toContain('private-api-hash');
    } finally {
      nodeModule._load = originalLoad;
      if (previousApiId === undefined) delete process.env.API_ID;
      else process.env.API_ID = previousApiId;
      if (previousApiHash === undefined) delete process.env.API_HASH;
      else process.env.API_HASH = previousApiHash;
      vi.resetModules();
    }
  });

  it('covers the lifecycle state vocabulary and terminal shutdown state', async () => {
    const state = createLifecycleState();

    expect(state.status).toBe('idle');
    state.status = 'connecting';
    expect(state.status).toBe('connecting');
    state.status = 'connected';
    expect(state.status).toBe('connected');
    state.status = 'reconnecting';
    expect(state.status).toBe('reconnecting');

    const shutdown = beginShutdown(state, vi.fn());
    expect(state.status).toBe('shutting-down');
    await shutdown;
    expect(state.status).toBe('stopped');
  });

  it('does not publish a late reconnect after Remember me signs out', async () => {
    const state = createLifecycleState();
    const connectGate = createDeferred();
    const connectStarted = createDeferred();
    const reconnectClient = {
      connected: false,
      connect: vi.fn(async () => {
        connectStarted.resolve();
        await connectGate.promise;
        reconnectClient.connected = true;
      }),
      disconnect: vi.fn(async () => {
        reconnectClient.connected = false;
      })
    };
    const notifyStatus = vi.fn();
    state.status = 'connected';
    state.client = reconnectClient;

    const reconnect = createTelegramReconnect({
      assertRunning: () => lifecycle.assertLifecycleRunning(state),
      getClient: () => state.client,
      lifecycleState: state,
      notifyStatus,
      runShared: (lifecycle, key, operation) => runShared(lifecycle, key, operation),
      stopReconnect: lifecycle.stopReconnect,
      telegramRequest: (operation) => operation(),
      trackOperation: (type, operation) => trackOperation(state, type, operation),
      withTimeout: (operation) => operation
    });

    const reconnecting = reconnect.reconnectTelegram();
    await connectStarted.promise;

    stopReconnect(state);
    state.status = 'disconnected';
    state.client = null;
    connectGate.resolve();

    await expect(reconnecting).resolves.toBe(false);
    expect(reconnectClient.disconnect).toHaveBeenCalledOnce();
    expect(reconnectClient.connected).toBe(false);
    expect(notifyStatus).not.toHaveBeenCalledWith('connected');
    expect(state.status).toBe('disconnected');
  });

  it('rejects network and reconnect starts after shutdown', async () => {
    const state = createLifecycleState();
    await shutdownWithDrain(state);

    expect(() => trackOperation(state, 'connect', () => undefined)).toThrow('shutting down');
    expect(() => runShared(state, 'connectPromise', () => undefined)).toThrow('shutting down');
    expect(state.client).toBeUndefined();
  });

  it('does not resurrect a client when connect is interrupted by shutdown', async () => {
    const state = createLifecycleState();
    const connectGate = createDeferred();
    let clientCreations = 0;
    const connect = () => runTrackedShared(state, 'connectPromise', 'connect', async () => {
      clientCreations += 1;
      await connectGate.promise;
      if (state.status !== 'idle') throw new Error('connect cancelled');
      state.client = { id: clientCreations };
      return state.client;
    });

    const connecting = connect();
    await Promise.resolve();
    const shutdown = shutdownWithDrain(state);
    connectGate.resolve();

    await expect(connecting).rejects.toThrow('cancelled');
    await shutdown;
    expect(clientCreations).toBe(1);
    expect(state.client).toBeUndefined();
  });

  it('does not resurrect the production Core client after clearSession during connect', async () => {
    vi.resetModules();
    const connectGate = createDeferred();
    const originalLoad = nodeModule._load;
    nodeModule._load = function load(request, parent, isMain) {
      if (request === 'teleproto') {
        return {
          TelegramClient: class FakeTelegramClient {
            constructor() {
              globalThis.__telegramFakeClient = this;
              this.connected = false;
            }

            connect() {
              return connectGate.promise.then(() => {
                this.connected = true;
              });
            }

            disconnect() {
              this.connected = false;
              return Promise.resolve();
            }
          },
          Api: {}
        };
      }

      if (request === 'teleproto/sessions') {
        return { StringSession: class FakeStringSession {} };
      }

      if (request === './telegram-account-storage.cjs') {
        return {
          loadAccountSecrets: () => ({ API_ID: '1', API_HASH: 'hash', SESSION_STRING: 'session' }),
          saveAccountSecrets: () => true,
          clearAccountSecrets: () => true
        };
      }

      return originalLoad(request, parent, isMain);
    };

    try {
      const { createTelegramCore } = await import('./telegram.cjs');
      const core = createTelegramCore({ apiId: 1, apiHash: 'hash', sessionString: 'session' });
      const connecting = core.connectTelegram();

      await Promise.resolve();
      await Promise.resolve();
      expect(globalThis.__telegramFakeClient).toBeDefined();

      await core.clearTelegramSession();
      connectGate.resolve();

      await expect(connecting).rejects.toThrow('cancelled');
      expect(core.lifecycleState.status).not.toBe('connected');
      expect(core.lifecycleState.reconnectTimer).toBeNull();
    } finally {
      connectGate.resolve();
      nodeModule._load = originalLoad;
      delete globalThis.__telegramFakeClient;
      vi.resetModules();
    }
  });

  it('times out a new Telegram connection and resets its lifecycle state', async () => {
    vi.resetModules();
    vi.useFakeTimers();
    const connectStarted = createDeferred();
    const originalLoad = nodeModule._load;
    nodeModule._load = function load(request, parent, isMain) {
      if (request === 'teleproto') {
        return {
          TelegramClient: class FakeTelegramClient {
            constructor() {
              this.connected = false;
              this.disconnect = vi.fn().mockResolvedValue(undefined);
              globalThis.__telegramTimeoutClient = this;
            }

            connect() {
              connectStarted.resolve();
              return new Promise(() => {});
            }
          },
          Api: {}
        };
      }

      if (request === 'teleproto/sessions') {
        return { StringSession: class FakeStringSession {} };
      }

      if (request === './telegram-account-storage.cjs') {
        return {
          loadAccountSecrets: () => ({ API_ID: '1', API_HASH: 'hash', SESSION_STRING: 'session' }),
          saveAccountSecrets: () => true,
          clearAccountSecrets: () => true
        };
      }

      return originalLoad(request, parent, isMain);
    };

    try {
      const { createTelegramCore } = await import('./telegram.cjs');
      const core = createTelegramCore({ apiId: 1, apiHash: 'hash', sessionString: 'session' });
      const connecting = core.connectTelegram();
      const connectionFailure = expect(connecting).rejects.toMatchObject({ code: 'OPERATION_TIMEOUT' });
      await connectStarted.promise;

      await vi.advanceTimersByTimeAsync(15000);

      await connectionFailure;
      expect(core.lifecycleState.status).toBe('disconnected');
      expect(core.lifecycleState.connectPromise).toBeNull();
      expect(globalThis.__telegramTimeoutClient.disconnect).toHaveBeenCalledOnce();
    } finally {
      nodeModule._load = originalLoad;
      delete globalThis.__telegramTimeoutClient;
      vi.useRealTimers();
      vi.resetModules();
    }
  });

  it('does not resurrect a pending connect after shutdown', async () => {
    vi.resetModules();
    const connectGate = createDeferred();
    const connectStarted = createDeferred();
    const originalLoad = nodeModule._load;
    nodeModule._load = function load(request, parent, isMain) {
      if (request === 'teleproto') {
        return {
          TelegramClient: class FakeTelegramClient {
            constructor() {
              this.connected = false;
              globalThis.__telegramShutdownClient = this;
            }

            connect() {
              connectStarted.resolve();
              return connectGate.promise.then(() => {
                this.connected = true;
              });
            }

            disconnect() {
              this.connected = false;
              return Promise.resolve();
            }
          },
          Api: {}
        };
      }

      if (request === 'teleproto/sessions') {
        return { StringSession: class FakeStringSession {} };
      }

      if (request === './telegram-account-storage.cjs') {
        return {
          loadAccountSecrets: () => ({ API_ID: '1', API_HASH: 'hash', SESSION_STRING: 'session' }),
          saveAccountSecrets: () => true,
          clearAccountSecrets: () => true
        };
      }

      return originalLoad(request, parent, isMain);
    };

    try {
      const { createTelegramCore } = await import('./telegram.cjs');
      const core = createTelegramCore({ apiId: 1, apiHash: 'hash', sessionString: 'session' });
      const connecting = core.connectTelegram();

      await connectStarted.promise;
      const shuttingDown = core.shutdownTelegram();
      connectGate.resolve();

      await expect(connecting).rejects.toThrow('cancelled');
      await shuttingDown;
      await Promise.resolve();

      expect(core.lifecycleState.status).toBe('stopped');
      expect(core.lifecycleState.reconnectTimer).toBeNull();
      expect(globalThis.__telegramShutdownClient.connected).toBe(false);
    } finally {
      connectGate.resolve();
      nodeModule._load = originalLoad;
      delete globalThis.__telegramShutdownClient;
      vi.resetModules();
    }
  });

  it('moves the core out of connected state after an invalid startup session', async () => {
    vi.resetModules();
    const originalLoad = nodeModule._load;
    const statusUpdates = [];
    nodeModule._load = function load(request, parent, isMain) {
      if (request === 'teleproto') {
        return {
          TelegramClient: class FakeTelegramClient {
            constructor() {
              this.connected = false;
            }

            connect() {
              this.connected = true;
              return Promise.resolve();
            }

            getDialogs() {
              const error = new Error('AUTH_KEY_UNREGISTERED');
              error.code = 'AUTH_KEY_UNREGISTERED';
              return Promise.reject(error);
            }

            disconnect() {
              this.connected = false;
              return Promise.resolve();
            }
          },
          Api: {}
        };
      }

      if (request === 'teleproto/sessions') {
        return { StringSession: class FakeStringSession {} };
      }

      if (request === './telegram-account-storage.cjs') {
        return {
          loadAccountSecrets: () => ({ API_ID: '1', API_HASH: 'hash', SESSION_STRING: 'session' }),
          saveAccountSecrets: () => true,
          clearAccountSecrets: () => true
        };
      }

      return originalLoad(request, parent, isMain);
    };

    try {
      const { createTelegramCore } = await import('./telegram.cjs');
      const core = createTelegramCore({ apiId: 1, apiHash: 'hash', sessionString: 'session' });
      core.setTelegramStatusCallback((status) => statusUpdates.push(status));

      await core.connectTelegram();
      await expect(core.getChats()).rejects.toMatchObject({
        code: 'TELEGRAM_SESSION_INVALID'
      });

      expect(core.lifecycleState.status).toBe('disconnected');
      expect(core.lifecycleState.reconnectTimer).toBeNull();
      expect(statusUpdates).not.toContainEqual(expect.objectContaining({
        status: 'auth required'
      }));
      expect(statusUpdates.at(-1)).toMatchObject({
        status: 'reauth_required',
        connected: false
      });
    } finally {
      nodeModule._load = originalLoad;
      vi.resetModules();
    }
  });
});
