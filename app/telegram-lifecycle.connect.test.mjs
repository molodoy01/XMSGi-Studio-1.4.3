import { describe, expect, it, vi } from 'vitest';
import { createRequire } from 'node:module';
import { createDeferred } from './telegram-lifecycle.testUtils.mjs';

vi.mock('electron', () => ({
  app: { getPath: () => 'C:\\temp' },
  safeStorage: { isEncryptionAvailable: () => false }
}));

const nodeRequire = createRequire(import.meta.url);
const nodeModule = nodeRequire('node:module');


describe('single-account Telegram lifecycle', () => {
  it('does not complete an in-flight send after clearSession', async () => {
    vi.resetModules();
    const sendGate = createDeferred();
    const sendStarted = createDeferred();
    const originalLoad = nodeModule._load;
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

            sendMessage() {
              sendStarted.resolve();
              return sendGate.promise;
            }

            logOut() {
              this.connected = false;
              return Promise.resolve();
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

      await core.connectTelegram();
      const sending = core.sendMessage('me', 'in-flight');
      await sendStarted.promise;

      await core.clearTelegramSession();
      const statusAfterClear = core.lifecycleState.status;
      sendGate.resolve();

      await expect(sending).rejects.toThrow();
      expect(statusAfterClear).not.toBe('connected');
      expect(core.lifecycleState.status).toBe(statusAfterClear);
    } finally {
      sendGate.resolve();
      nodeModule._load = originalLoad;
      vi.resetModules();
    }
  });

  it('does not complete an in-flight schedule after clearSession', async () => {
    vi.resetModules();
    const scheduleGate = createDeferred();
    const scheduleStarted = createDeferred();
    const originalLoad = nodeModule._load;
    nodeModule._load = function load(request, parent, isMain) {
      if (request === 'teleproto') {
        return {
          TelegramClient: class FakeTelegramClient {
            constructor() {
              this.connected = false;
              this.scheduleCalls = 0;
            }

            connect() {
              this.connected = true;
              return Promise.resolve();
            }

            getScheduledMessages() {
              this.scheduleCalls += 1;
              if (this.scheduleCalls === 1) {
                scheduleStarted.resolve();
                return scheduleGate.promise;
              }

              return Promise.resolve([
                { id: 42, message: 'scheduled', date: new Date(1700000000 * 1000) }
              ]);
            }

            sendMessage() {
              return Promise.resolve({ id: 42 });
            }

            logOut() {
              this.connected = false;
              return Promise.resolve();
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

      await core.connectTelegram();
      const scheduling = core.scheduleMessage('me', 'scheduled', undefined, undefined, 1700000000);
      await scheduleStarted.promise;

      await core.clearTelegramSession();
      scheduleGate.resolve([]);

      await expect(scheduling).rejects.toThrow();
      expect(core.lifecycleState.status).not.toBe('connected');
    } finally {
      scheduleGate.resolve([]);
      nodeModule._load = originalLoad;
      vi.resetModules();
    }
  });

  it('does not complete an in-flight cancel after clearSession', async () => {
    vi.resetModules();
    const cancelGate = createDeferred();
    const cancelStarted = createDeferred();
    const originalLoad = nodeModule._load;
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

            deleteScheduledMessages() {
              cancelStarted.resolve();
              return cancelGate.promise;
            }

            logOut() {
              this.connected = false;
              return Promise.resolve();
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

      await core.connectTelegram();
      const cancelling = core.cancelScheduledMessage('me', 42);
      await cancelStarted.promise;

      await core.clearTelegramSession();
      cancelGate.resolve();

      await expect(cancelling).rejects.toThrow();
      expect(core.lifecycleState.status).not.toBe('connected');
    } finally {
      cancelGate.resolve();
      nodeModule._load = originalLoad;
      vi.resetModules();
    }
  });

  it('does not resurrect a reconnect after clearSession', async () => {
    vi.resetModules();
    const reconnectGate = createDeferred();
    const reconnectStarted = createDeferred();
    const originalLoad = nodeModule._load;
    nodeModule._load = function load(request, parent, isMain) {
      if (request === 'teleproto') {
        return {
          TelegramClient: class FakeTelegramClient {
            constructor() {
              this.connected = false;
              this.connectCalls = 0;
              globalThis.__telegramReconnectClient = this;
            }

            connect() {
              this.connectCalls += 1;

              if (this.connectCalls === 1) {
                this.connected = true;
                return Promise.resolve();
              }

              reconnectStarted.resolve();
              return reconnectGate.promise.then(() => {
                this.connected = true;
              });
            }

            disconnect() {
              this.connected = false;
              return Promise.resolve();
            }

            logOut() {
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

      await core.connectTelegram();
      globalThis.clearInterval(core.lifecycleState.reconnectTimer);
      core.lifecycleState.reconnectTimer = null;
      globalThis.__telegramReconnectClient.connected = false;

      const reconnecting = core.connectTelegram();
      await reconnectStarted.promise;

      await core.clearTelegramSession();
      reconnectGate.resolve();

      await expect(reconnecting).rejects.toThrow('cancelled');
      expect(core.lifecycleState.status).not.toBe('connected');
      expect(core.lifecycleState.reconnectTimer).toBeNull();
    } finally {
      reconnectGate.resolve();
      nodeModule._load = originalLoad;
      delete globalThis.__telegramReconnectClient;
      vi.resetModules();
    }
  });

  it('cancels login when connect completes after clearSession', async () => {
    vi.resetModules();
    const connectGate = createDeferred();
    const connectStarted = createDeferred();
    const originalLoad = nodeModule._load;
    const saveAccountSecrets = vi.fn(() => true);
    nodeModule._load = function load(request, parent, isMain) {
      if (request === 'teleproto') {
        return {
          TelegramClient: class FakeTelegramClient {
            connect() {
              connectStarted.resolve();
              return connectGate.promise.then(() => {
                this.connected = true;
              });
            }

            sendCode() {
              return Promise.resolve({ phoneCodeHash: 'hash' });
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
          loadAccountSecrets: () => ({ API_ID: '1', API_HASH: 'hash', SESSION_STRING: '' }),
          saveAccountSecrets,
          clearAccountSecrets: () => true
        };
      }

      return originalLoad(request, parent, isMain);
    };

    let core;
    try {
      const { createTelegramCore } = await import('./telegram.cjs');
      core = createTelegramCore({ apiId: 1, apiHash: 'hash', sessionString: '' });
      const loggingIn = core.loginUser({ phoneNumber: '+15550000000' });

      await connectStarted.promise;
      await core.clearTelegramSession();
      connectGate.resolve();

      await expect(loggingIn).rejects.toThrow('cancelled');
      expect(core.lifecycleState.pendingLogin).toBeNull();
      expect(saveAccountSecrets).not.toHaveBeenCalled();
    } finally {
      connectGate.resolve();
      await core?.lifecycleState.pendingLogin?.clear();
      nodeModule._load = originalLoad;
      vi.resetModules();
    }
  });

  it('cancels login when sendCode completes after clearSession', async () => {
    vi.resetModules();
    const sendCodeGate = createDeferred();
    const sendCodeStarted = createDeferred();
    const originalLoad = nodeModule._load;
    const saveAccountSecrets = vi.fn(() => true);
    nodeModule._load = function load(request, parent, isMain) {
      if (request === 'teleproto') {
        return {
          TelegramClient: class FakeTelegramClient {
            connect() {
              this.connected = true;
              return Promise.resolve();
            }

            sendCode() {
              sendCodeStarted.resolve();
              return sendCodeGate.promise;
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
          loadAccountSecrets: () => ({ API_ID: '1', API_HASH: 'hash', SESSION_STRING: '' }),
          saveAccountSecrets,
          clearAccountSecrets: () => true
        };
      }

      return originalLoad(request, parent, isMain);
    };

    let core;
    try {
      const { createTelegramCore } = await import('./telegram.cjs');
      core = createTelegramCore({ apiId: 1, apiHash: 'hash', sessionString: '' });
      const loggingIn = core.loginUser({ phoneNumber: '+15550000000' });

      await sendCodeStarted.promise;
      await core.clearTelegramSession();
      sendCodeGate.resolve({ phoneCodeHash: 'late-hash' });

      await expect(loggingIn).rejects.toThrow('cancelled');
      expect(core.lifecycleState.pendingLogin).toBeNull();
      expect(saveAccountSecrets).not.toHaveBeenCalled();
    } finally {
      sendCodeGate.resolve({ phoneCodeHash: 'late-hash' });
      await core?.lifecycleState.pendingLogin?.clear();
      nodeModule._load = originalLoad;
      vi.resetModules();
    }
  });
});
