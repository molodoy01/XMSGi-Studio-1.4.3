import { describe, expect, it, vi } from 'vitest';
import lifecycle from './telegram-lifecycle.cjs';

vi.mock('electron', () => ({
  app: { getPath: () => 'C:\\temp' },
  safeStorage: { isEncryptionAvailable: () => false }
}));

const {
  createLifecycleState,
  beginShutdown,
  trackOperation,
  startPendingLogin,
  withTimeout
} = lifecycle;

describe('single-account Telegram lifecycle', () => {
  it('times out without treating a late result as a new success', async () => {
    let release;
    const operation = new Promise((resolve) => { release = resolve; });
    const timed = withTimeout(operation, 10);

    await expect(timed).rejects.toMatchObject({ code: 'OPERATION_TIMEOUT' });
    release('late');
    await Promise.resolve();
  });

  it('uses timeout labels without invoking them as callbacks', async () => {
    let fireTimeout;
    const timed = withTimeout(new Promise(() => undefined), 10, 'Telegram shutdown drain', {
      setTimeout(callback) {
        fireTimeout = callback;
        return 1;
      },
      clearTimeout: vi.fn(),
    });

    expect(() => fireTimeout()).not.toThrow();
    await expect(timed).rejects.toMatchObject({
      message: 'Telegram shutdown drain timed out after 10 ms',
      code: 'OPERATION_TIMEOUT',
    });
  });

  it('never invokes a function passed where a timeout label is expected', async () => {
    let fireTimeout;
    const invalidTimeoutCallback = vi.fn();
    const timed = withTimeout(new Promise(() => undefined), 10, invalidTimeoutCallback, {
      setTimeout(callback) {
        fireTimeout = callback;
        return 1;
      },
      clearTimeout: vi.fn(),
    });

    expect(() => fireTimeout()).not.toThrow();
    await expect(timed).rejects.toMatchObject({
      message: 'Operation timed out after 10 ms',
      code: 'OPERATION_TIMEOUT',
    });
    expect(invalidTimeoutCallback).not.toHaveBeenCalled();
  });

  it('cleans timeout timers on success', async () => {
    const clearTimeoutMock = vi.fn();
    await expect(withTimeout(
      Promise.resolve('ok'),
      100,
      undefined,
      { setTimeout: globalThis.setTimeout, clearTimeout: clearTimeoutMock }
    )).resolves.toBe('ok');
    expect(clearTimeoutMock).toHaveBeenCalledTimes(1);
  });

  it('enforces one pending login and cleans it on clear/TTL', async () => {
    vi.useFakeTimers();
    const state = createLifecycleState({ loginTtlMs: 100 });
    const cleanup = vi.fn().mockResolvedValue(undefined);
    const pending = startPendingLogin(state, { client: {} }, cleanup);

    expect(() => startPendingLogin(state, { client: {} }, cleanup)).toThrow('already in progress');
    await vi.advanceTimersByTimeAsync(100);
    expect(state.pendingLogin).toBeNull();
    expect(cleanup).toHaveBeenCalledTimes(1);
    await pending.clear();
    expect(cleanup).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it('makes shutdown idempotent and blocks new operations', async () => {
    const state = createLifecycleState();
    const cleanup = vi.fn().mockResolvedValue(undefined);
    const first = beginShutdown(state, cleanup);
    const second = beginShutdown(state, cleanup);

    expect(first).toBe(second);
    await first;
    expect(state.status).toBe('stopped');
    expect(cleanup).toHaveBeenCalledTimes(1);
    expect(() => trackOperation(state, 'send', () => undefined)).toThrow('shutting down');
  });
});
