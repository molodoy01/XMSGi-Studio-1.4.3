import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useConnectionRecoveryNotice } from './useConnectionRecoveryNotice';

describe('useConnectionRecoveryNotice', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('hides the recovery message after 15 seconds while the recovery state stays active', () => {
    vi.useFakeTimers();
    const { result } = renderHook(({ active, connected, offline }) => (
      useConnectionRecoveryNotice(active, connected, offline)
    ), {
      initialProps: { active: true, connected: false, offline: false },
    });

    expect(result.current).toBe('reconnecting');

    act(() => vi.advanceTimersByTime(14_999));
    expect(result.current).toBe('reconnecting');

    act(() => vi.advanceTimersByTime(1));
    expect(result.current).toBeNull();
  });

  it('clears the notice when the connection recovers and starts a fresh timeout on a later outage', () => {
    vi.useFakeTimers();
    const { result, rerender } = renderHook(
      ({ active, connected, offline }) => useConnectionRecoveryNotice(active, connected, offline),
      { initialProps: { active: true, connected: false, offline: false } },
    );

    act(() => vi.advanceTimersByTime(5_000));
    rerender({ active: false, connected: false, offline: false });
    expect(result.current).toBeNull();

    rerender({ active: true, connected: false, offline: false });
    expect(result.current).toBe('reconnecting');

    act(() => vi.advanceTimersByTime(15_000));
    expect(result.current).toBeNull();
  });

  it('keeps the offline message visible for 15 seconds after the offline state begins', () => {
    vi.useFakeTimers();
    const { result, rerender } = renderHook(
      ({ active, connected, offline }) => useConnectionRecoveryNotice(active, connected, offline),
      { initialProps: { active: true, connected: false, offline: false } },
    );

    act(() => vi.advanceTimersByTime(10_000));
    rerender({ active: true, connected: false, offline: true });
    expect(result.current).toBe('offline');

    act(() => vi.advanceTimersByTime(14_999));
    expect(result.current).toBe('offline');

    act(() => vi.advanceTimersByTime(1));
    expect(result.current).toBeNull();
  });

  it('keeps a success notice visible until the first pointer or keyboard interaction', () => {
    vi.useFakeTimers();
    const { result, rerender } = renderHook(
      ({ active, connected, offline }) => useConnectionRecoveryNotice(active, connected, offline),
      { initialProps: { active: true, connected: false, offline: false } },
    );

    rerender({ active: false, connected: true, offline: false });
    expect(result.current).toBe('restored');

    act(() => vi.advanceTimersByTime(60_000));
    expect(result.current).toBe('restored');

    act(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab' })));
    expect(result.current).toBeNull();
  });

  it('dismisses the success notice on pointer interaction', () => {
    vi.useFakeTimers();
    const { result, rerender } = renderHook(
      ({ active, connected, offline }) => useConnectionRecoveryNotice(active, connected, offline),
      { initialProps: { active: true, connected: false, offline: false } },
    );

    rerender({ active: false, connected: true, offline: false });
    expect(result.current).toBe('restored');

    act(() => window.dispatchEvent(new PointerEvent('pointerdown')));
    expect(result.current).toBeNull();
  });

  it('does not show a success notice for an initial connection', () => {
    const { result } = renderHook(() => useConnectionRecoveryNotice(false, true, false));

    expect(result.current).toBeNull();
  });
});
