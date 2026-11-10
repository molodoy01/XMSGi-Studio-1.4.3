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
  it('supports retained sign out, concurrent welcome back, and account removal', async () => {
    vi.resetModules();
    const originalLoad = nodeModule._load;
    const storageState = {
      API_ID: '1',
      API_HASH: 'hash',
      SESSION_STRING: 'session',
      signedOut: true
    };
    let connectError = null;
    let reconnectTick = null;
    nodeModule._load = function load(request, parent, isMain) {
      if (request === 'teleproto') {
        return {
          TelegramClient: class FakeTelegramClient {
            constructor() {
              this.connected = false;
              this.logOutCalls = 0;
              this.disconnectCalls = 0;
              globalThis.__telegramWelcomeClient = this;
            }

            connect() {
              if (connectError) return Promise.reject(connectError);
              this.connected = true;
              return Promise.resolve();
            }

            disconnect() {
              this.disconnectCalls += 1;
              this.connected = false;
              return Promise.resolve();
            }

            logOut() {
              this.logOutCalls += 1;
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
          loadAccountSecrets: () => ({ ...storageState }),
          saveAccountSecrets: () => true,
          getTelegramAuthState: () => ({
            hasSession: Boolean(storageState.SESSION_STRING),
            signedOut: storageState.signedOut
          }),
          setTelegramSignedOut: (value) => {
            storageState.signedOut = Boolean(value);
            return true;
          },
          clearAccountSecrets: () => {
            storageState.SESSION_STRING = '';
            storageState.signedOut = false;
            return true;
          }
        };
      }

      return originalLoad(request, parent, isMain);
    };

    try {
      const { createTelegramCore } = await import('./telegram.cjs');
      const core = createTelegramCore({ checkInternetConnection: async () => true });

      const welcomed = core.welcomeBack();
      const welcomedAgain = core.welcomeBack();
      expect(welcomedAgain).toBe(welcomed);
      await welcomed;
      expect(storageState.signedOut).toBe(false);
      expect(globalThis.__telegramWelcomeClient.logOutCalls).toBe(0);

      await core.signOutKeepSession();
      expect(globalThis.__telegramWelcomeClient.logOutCalls).toBe(0);
      expect(globalThis.__telegramWelcomeClient.disconnectCalls).toBe(1);
      expect(storageState.API_ID).toBe('1');
      expect(storageState.API_HASH).toBe('hash');
      expect(storageState.SESSION_STRING).toBe('session');
      expect(storageState.signedOut).toBe(true);

      vi.spyOn(globalThis, 'setInterval').mockImplementation((callback) => {
        reconnectTick = callback;
        return 100;
      });
      connectError = Object.assign(new Error('connect EHOSTUNREACH'), { code: 'EHOSTUNREACH' });
      await expect(core.welcomeBack()).rejects.toThrow('EHOSTUNREACH');
      expect(storageState.signedOut).toBe(false);
      expect(core.lifecycleState.reconnectTimer).toBe(100);
      expect(reconnectTick).toBeTypeOf('function');

      connectError = null;
      await reconnectTick();
      expect(storageState.signedOut).toBe(false);
      expect(core.lifecycleState.status).toBe('connected');

      await core.forgetTelegramAccount();
      expect(globalThis.__telegramWelcomeClient.logOutCalls).toBe(1);
      expect(storageState.SESSION_STRING).toBe('');
      expect(storageState.signedOut).toBe(false);
    } finally {
      nodeModule._load = originalLoad;
      delete globalThis.__telegramWelcomeClient;
      vi.restoreAllMocks();
      vi.resetModules();
    }
  });

  it('does not resurrect a client when retained sign out interrupts connect', async () => {
    vi.resetModules();
    const connectGate = createDeferred();
    const originalLoad = nodeModule._load;
    const storageState = {
      API_ID: '1',
      API_HASH: 'hash',
      SESSION_STRING: 'session',
      signedOut: false
    };
    nodeModule._load = function load(request, parent, isMain) {
      if (request === 'teleproto') {
        return {
          TelegramClient: class FakeTelegramClient {
            constructor() {
              this.connected = false;
              globalThis.__telegramConnectClient = this;
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
          loadAccountSecrets: () => ({ ...storageState }),
          saveAccountSecrets: () => true,
          setTelegramSignedOut: (value) => {
            storageState.signedOut = Boolean(value);
            return true;
          },
          clearAccountSecrets: () => true
        };
      }

      return originalLoad(request, parent, isMain);
    };

    try {
      const { createTelegramCore } = await import('./telegram.cjs');
      const core = createTelegramCore();
      const connecting = core.connectTelegram();

      await Promise.resolve();
      await Promise.resolve();
      expect(globalThis.__telegramConnectClient).toBeDefined();

      const signingOut = core.signOutKeepSession();
      connectGate.resolve();

      await signingOut;
      await expect(connecting).rejects.toThrow('cancelled');
      expect(storageState.signedOut).toBe(true);
      expect(core.lifecycleState.status).toBe('disconnected');
      expect(core.lifecycleState.reconnectTimer).toBeNull();
    } finally {
      connectGate.resolve();
      nodeModule._load = originalLoad;
      delete globalThis.__telegramConnectClient;
      vi.resetModules();
    }
  });

  it('ignores an invalid-session response from an in-flight request after retained sign out', async () => {
    vi.resetModules();
    const dialogsStarted = createDeferred();
    let rejectDialogs;
    const dialogsRequest = new Promise((resolve, reject) => {
      rejectDialogs = reject;
    });
    const originalLoad = nodeModule._load;
    const storageState = {
      API_ID: '1',
      API_HASH: 'hash',
      SESSION_STRING: 'session',
      signedOut: false,
    };
    let clearAccountSecretsCalls = 0;
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

            disconnect() {
              this.connected = false;
              return Promise.resolve();
            }

            getDialogs() {
              dialogsStarted.resolve();
              return dialogsRequest;
            }
          },
          Api: {},
        };
      }

      if (request === 'teleproto/sessions') {
        return { StringSession: class FakeStringSession {} };
      }

      if (request === './telegram-account-storage.cjs') {
        return {
          loadAccountSecrets: () => ({ ...storageState }),
          getTelegramAuthState: () => ({
            hasSession: Boolean(storageState.SESSION_STRING),
            signedOut: storageState.signedOut,
          }),
          setTelegramSignedOut: (value) => {
            storageState.signedOut = Boolean(value);
            return true;
          },
          clearAccountSecrets: () => {
            clearAccountSecretsCalls += 1;
            storageState.SESSION_STRING = '';
            storageState.signedOut = false;
            return true;
          },
        };
      }

      return originalLoad(request, parent, isMain);
    };

    try {
      const { createTelegramCore } = await import('./telegram.cjs');
      const core = createTelegramCore();
      const statusEvents = [];
      core.setTelegramStatusCallback((status) => statusEvents.push(status));
      const chatsRequest = core.getChats();

      await dialogsStarted.promise;
      await core.signOutKeepSession();
      rejectDialogs(Object.assign(new Error('AUTH_KEY_UNREGISTERED'), { code: 'AUTH_KEY_UNREGISTERED' }));

      await expect(chatsRequest).rejects.toMatchObject({ code: 'TELEGRAM_REQUEST_CANCELLED' });
      expect(statusEvents).not.toContainEqual(expect.objectContaining({ status: 'auth required' }));
      expect(statusEvents).not.toContainEqual(expect.objectContaining({ status: 'reauth_required' }));
      expect(clearAccountSecretsCalls).toBe(0);
      expect(storageState.SESSION_STRING).toBe('session');
      expect(storageState.signedOut).toBe(true);
    } finally {
      rejectDialogs?.(new Error('test cleanup'));
      nodeModule._load = originalLoad;
      vi.resetModules();
    }
  });
});
