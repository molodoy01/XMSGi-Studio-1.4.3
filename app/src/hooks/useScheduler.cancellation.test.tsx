import { act, waitFor } from '@testing-library/react';
import { expect, it, vi, afterEach, describe } from 'vitest';
import type { ScheduledMessage } from '@/types';
import { createScheduleIdentityResult, localDateTimeAt, getFutureReplacementTimes, renderWorkspaceHistory } from './useScheduler.testUtils';

describe("useScheduler cancellation and bulk scheduling", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('keeps the scheduled record and reports cancellation errors', async () => {
    const message: ScheduledMessage = {
      id: 'cancel-failed',
      chatId: 'chat-1',
      chatName: 'Test chat',
      text: 'Keep this scheduled',
      when: '2035-01-15T18:00:00.000Z',
      createdAt: '2035-01-15T17:00:00.000Z',
      status: 'scheduled',
      telegramMessageId: 'telegram-cancel-failed',
    };
    const showNotification = vi.fn();
    const cancel = vi.fn().mockResolvedValue({
      success: false,
      error: 'Telegram cancellation failed.',
      code: 'TELEGRAM_REQUEST_CANCELLED',
      category: 'cancelled',
      retryable: false,
      cancelled: true,
    });
    const { result } = renderWorkspaceHistory([message], [], { cancel }, showNotification);

    await waitFor(() => expect(result.current.upcoming).toEqual([message]));
    await act(async () => { await result.current.handleCancelMessage(message); });

    await waitFor(() => expect(showNotification).toHaveBeenCalledWith(
      'Telegram cancellation failed.',
      'error',
      expect.any(String),
      expect.objectContaining({ operation: 'cancel', category: 'cancelled', code: 'TELEGRAM_REQUEST_CANCELLED', retryable: false }),
    ));
    expect(result.current.upcoming[0]).toMatchObject({
      id: message.id,
      status: 'failed',
      telegramMessageId: message.telegramMessageId,
      lastError: 'Telegram cancellation failed.',
      lastErrorDetails: expect.objectContaining({ operation: 'cancel', category: 'cancelled' }),
      retryAction: 'cancel',
    });
    expect(result.current.sent).toHaveLength(0);
  })

  it('allows retrying cancellation after Telegram rejects the first attempt', async () => {
    const message: ScheduledMessage = {
      id: 'cancel-retry',
      chatId: 'chat-1',
      chatName: 'Test chat',
      text: 'Cancel twice only after failure',
      when: '2035-01-15T18:00:00.000Z',
      createdAt: '2035-01-15T17:00:00.000Z',
      status: 'scheduled',
      telegramMessageId: 'telegram-cancel-retry',
    };
    const cancel = vi.fn()
      .mockResolvedValueOnce({ success: false, error: 'Network unavailable.' })
      .mockResolvedValueOnce({ success: true });
    const { result, showNotification } = renderWorkspaceHistory([message], [], { cancel });

    await waitFor(() => expect(result.current.upcoming).toEqual([message]));
    await act(async () => { await result.current.handleCancelMessage(message); });
    await waitFor(() => expect(showNotification).toHaveBeenCalledWith(
      'Network unavailable.',
      'error',
      expect.any(String),
      expect.objectContaining({ operation: 'cancel', category: 'unknown', retryable: false }),
    ));
    expect(result.current.upcoming[0]).toMatchObject({
      id: message.id,
      status: 'failed',
      telegramMessageId: message.telegramMessageId,
      lastError: 'Network unavailable.',
      retryAction: 'cancel',
    });

    await act(async () => { await result.current.handleCancelMessage(message); });
    await waitFor(() => expect(result.current.upcoming).toHaveLength(0));
    expect(cancel).toHaveBeenCalledTimes(2);
  })

  it('removes a scheduled record only after Telegram confirms cancellation', async () => {
    const message: ScheduledMessage = {
      id: 'cancel-success',
      chatId: 'chat-1',
      chatName: 'Test chat',
      text: 'Cancel through Telegram',
      when: '2035-01-15T18:00:00.000Z',
      createdAt: '2035-01-15T17:00:00.000Z',
      status: 'scheduled',
      telegramMessageId: 'telegram-cancel-success',
    };
    const cancel = vi.fn().mockResolvedValue({ success: true });
    const { result, saveScheduleHistory } = renderWorkspaceHistory([message], [], { cancel });

    await waitFor(() => expect(result.current.upcoming).toEqual([message]));
    await act(async () => { await result.current.handleCancelMessage(message); });

    await waitFor(() => expect(result.current.upcoming).toHaveLength(0));
    expect(cancel).toHaveBeenCalledWith({
      chatId: message.chatId,
      telegramMessageId: message.telegramMessageId,
      message: message.text,
      targetTimestamp: Math.floor(new Date(message.when).getTime() / 1000),
    });
    await waitFor(() => expect(saveScheduleHistory).toHaveBeenCalledWith({ scope: 'workspace', field: 'upcoming', messages: [] }));
  })

  it('preserves both results when distinct cancellations finish concurrently', async () => {
    const firstMessage: ScheduledMessage = {
      id: 'cancel-parallel-1',
      chatId: 'chat-1',
      chatName: 'Test chat',
      text: 'First cancellation',
      when: '2035-01-15T18:00:00.000Z',
      createdAt: '2035-01-15T17:00:00.000Z',
      status: 'scheduled',
      telegramMessageId: 'telegram-cancel-parallel-1',
    };
    const secondMessage: ScheduledMessage = {
      ...firstMessage,
      id: 'cancel-parallel-2',
      text: 'Second cancellation',
      telegramMessageId: 'telegram-cancel-parallel-2',
    };
    let resolveFirst!: (result: { success: boolean }) => void;
    let resolveSecond!: (result: { success: boolean }) => void;
    const cancel = vi.fn(({ telegramMessageId }: { telegramMessageId: string }) => new Promise<{ success: boolean }>((resolve) => {
      if (telegramMessageId === firstMessage.telegramMessageId) resolveFirst = resolve;
      else resolveSecond = resolve;
    }));
    const { result } = renderWorkspaceHistory([firstMessage, secondMessage], [], { cancel });

    await waitFor(() => expect(result.current.upcoming).toHaveLength(2));
    let firstAttempt!: Promise<boolean>;
    let secondAttempt!: Promise<boolean>;
    await act(async () => {
      firstAttempt = result.current.handleCancelMessage(firstMessage);
      secondAttempt = result.current.handleCancelMessage(secondMessage);
    });
    await waitFor(() => expect(cancel).toHaveBeenCalledTimes(2));

    await act(async () => {
      resolveFirst({ success: true });
      await firstAttempt;
    });
    await act(async () => {
      resolveSecond({ success: true });
      await secondAttempt;
    });

    expect(result.current.upcoming).toHaveLength(0);
  })

  it('cancels an attachment-only scheduled record with its Telegram ID', async () => {
    const message: ScheduledMessage = {
      id: 'cancel-photo-only',
      chatId: 'chat-1',
      chatName: 'Test chat',
      text: '',
      when: '2035-01-15T18:00:00.000Z',
      createdAt: '2035-01-15T17:00:00.000Z',
      status: 'scheduled',
      attachments: ['C:/demo/photo.png'],
      telegramMessageId: 'telegram-photo-only',
    };
    const cancel = vi.fn().mockResolvedValue({ success: true });
    const { result } = renderWorkspaceHistory([message], [], { cancel });

    await waitFor(() => expect(result.current.upcoming).toEqual([message]));
    await act(async () => { await result.current.handleCancelMessage(message); });

    expect(cancel).toHaveBeenCalledWith({
      chatId: message.chatId,
      telegramMessageId: message.telegramMessageId,
      message: '',
      targetTimestamp: Math.floor(new Date(message.when).getTime() / 1000),
    });
    await waitFor(() => expect(result.current.upcoming).toHaveLength(0));
  })

  it('does not call cancel for an attachment-only record without a Telegram ID', async () => {
    const message: ScheduledMessage = {
      id: 'cancel-photo-without-id',
      chatId: 'chat-1',
      chatName: 'Test chat',
      text: '',
      when: '2035-01-15T18:00:00.000Z',
      createdAt: '2035-01-15T17:00:00.000Z',
      status: 'scheduled',
      attachments: ['C:/demo/photo.png'],
    };
    const cancel = vi.fn().mockResolvedValue({ success: true });
    const { result, showNotification } = renderWorkspaceHistory([message], [], { cancel });

    await waitFor(() => expect(result.current.upcoming).toEqual([message]));
    await act(async () => { await result.current.handleCancelMessage(message); });

    expect(cancel).not.toHaveBeenCalled();
    expect(result.current.upcoming).toEqual([message]);
    expect(showNotification).toHaveBeenCalledWith(expect.any(String), 'error', expect.any(String));
  })

  it('cancels multiple scheduled records sequentially and uses the updated queue state', async () => {
    const firstMessage: ScheduledMessage = {
      id: 'cancel-batch-first',
      chatId: 'chat-1',
      chatName: 'Test chat',
      text: 'First scheduled message',
      when: '2035-01-15T18:00:00.000Z',
      createdAt: '2035-01-15T17:00:00.000Z',
      status: 'scheduled',
      telegramMessageId: 'telegram-cancel-first',
    };
    const secondMessage: ScheduledMessage = {
      ...firstMessage,
      id: 'cancel-batch-second',
      text: 'Second scheduled message',
      telegramMessageId: 'telegram-cancel-second',
    };
    const cancel = vi.fn().mockResolvedValue({ success: true });
    const { result } = renderWorkspaceHistory([firstMessage, secondMessage], [], { cancel });

    await waitFor(() => expect(result.current.upcoming).toHaveLength(2));
    let cancelled = false;
    await act(async () => {
      cancelled = await result.current.handleCancelMessages([firstMessage, secondMessage]);
    });

    expect(cancelled).toBe(true);
    expect(cancel).toHaveBeenCalledTimes(2);
    expect(cancel.mock.invocationCallOrder[0]).toBeLessThan(cancel.mock.invocationCallOrder[1]);
    expect(result.current.upcoming).toHaveLength(0);
  })

  it('deletes a sent record through the existing local history handler', async () => {
    const message: ScheduledMessage = {
      id: 'delete-sent',
      chatId: 'chat-1',
      chatName: 'Test chat',
      text: 'Already sent',
      when: '2035-01-15T18:00:00.000Z',
      createdAt: '2035-01-15T17:00:00.000Z',
      sentAt: '2035-01-15T18:01:00.000Z',
      status: 'sent',
    };
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const { result, saveScheduleHistory } = renderWorkspaceHistory([], [message], {});

    await waitFor(() => expect(result.current.sent).toEqual([message]));
    await act(async () => { await result.current.handleDeleteMessage(message); });

    await waitFor(() => expect(result.current.sent).toHaveLength(0));
    expect(saveScheduleHistory).toHaveBeenCalledWith({ scope: 'workspace', field: 'sent', messages: [] });
  })

  it('deletes a failed record without a second confirmation after the history dialog', async () => {
    const message: ScheduledMessage = {
      id: 'delete-failed-history',
      chatId: 'chat-1',
      chatName: 'Test chat',
      text: 'Failed schedule',
      when: '2035-01-15T18:00:00.000Z',
      createdAt: '2035-01-15T17:00:00.000Z',
      status: 'failed',
      lastError: 'Telegram did not confirm that the reminder was saved.',
      retryAction: 'schedule',
    };
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    const { result, saveScheduleHistory } = renderWorkspaceHistory([message], [], {});

    await waitFor(() => expect(result.current.upcoming).toEqual([message]));
    await act(async () => { await result.current.handleDeleteMessage(message, true); });

    await waitFor(() => expect(result.current.upcoming).toHaveLength(0));
    expect(confirm).not.toHaveBeenCalled();
    expect(saveScheduleHistory).toHaveBeenCalledWith({ scope: 'workspace', field: 'upcoming', messages: [] });
  })

  it('does not warn below the bulk scheduling threshold', async () => {
    const chat = { id: 'bulk-9', name: 'Bulk chat' };
    const { date, time } = getFutureReplacementTimes().replacementDateTime;
    const schedule = vi.fn().mockResolvedValue({ success: true, confirmed: true });
    const showNotification = vi.fn();
    const { result } = renderWorkspaceHistory([], [], { schedule }, showNotification, 'workspace', chat);

    await waitFor(() => expect(result.current.scheduling).toBe(false));
    vi.useFakeTimers();
    await act(async () => {
      await result.current.handleSchedule(
        { chatId: chat.id, message: 'Nine messages', date, time },
        { mode: 'daily', occurrences: 9 },
      );
      await vi.runAllTimersAsync();
    });
    vi.useRealTimers();

    expect(schedule).toHaveBeenCalledTimes(9);
    expect(showNotification.mock.calls.some(([, type, title]) => type === 'warning' && title === 'Mass scheduling warning')).toBe(false);
  })

  it('does not restore a cancelled record after schedule identity lookup', async () => {
    const chat = { id: 'identity-race-chat', name: 'Identity race chat' };
    const cancelledMessage: ScheduledMessage = {
      id: 'identity-race-cancelled',
      chatId: chat.id,
      chatName: chat.name,
      text: 'Cancel while identities load',
      when: '2035-01-15T18:00:00.000Z',
      createdAt: '2035-01-15T17:00:00.000Z',
      status: 'scheduled',
      telegramMessageId: 'telegram-identity-race',
    };
    let resolveIdentities!: (value: { success: boolean; identities: string[] }) => void;
    const getScheduleIdentities = vi.fn(() => new Promise<{ success: boolean; identities: string[] }>((resolve) => {
      resolveIdentities = resolve;
    }));
    const schedule = vi.fn().mockResolvedValue({ success: true, confirmed: true, telegramMessageId: 'new-scheduled-message' });
    const cancel = vi.fn().mockResolvedValue({ success: true });
    const { result } = renderWorkspaceHistory(
      [cancelledMessage],
      [],
      { getScheduleIdentities, schedule, cancel },
      vi.fn(),
      'workspace',
      chat,
    );
    const { date, time } = getFutureReplacementTimes().replacementDateTime;

    await waitFor(() => expect(result.current.upcoming).toEqual([cancelledMessage]));
    let scheduleRequest!: Promise<boolean | void | 'sent-history-failed'>;
    act(() => {
      scheduleRequest = result.current.handleSchedule({
        chatId: chat.id,
        message: 'New scheduled message',
        date,
        time,
        waitForConfirmation: true,
      });
    });
    await waitFor(() => expect(getScheduleIdentities).toHaveBeenCalledOnce());

    await act(async () => {
      await result.current.handleCancelMessage(cancelledMessage);
    });
    expect(result.current.upcoming).toHaveLength(0);

    await act(async () => {
      resolveIdentities({ success: true, identities: ['new-operation-identity'] });
      await scheduleRequest;
    });

    expect(result.current.upcoming.map((item) => item.id)).toHaveLength(1);
    expect(result.current.upcoming[0]).toMatchObject({ text: 'New scheduled message', status: 'scheduled' });
  })

  it('warns at ten messages for five seconds and continues scheduling once', async () => {
    const chat = { id: 'bulk-10', name: 'Bulk chat' };
    const { date, time } = getFutureReplacementTimes().replacementDateTime;
    const schedule = vi.fn(async () => ({ success: true, confirmed: true }));
    const getScheduleIdentities = vi.fn(async (operations: Array<Record<string, unknown>>) => createScheduleIdentityResult(operations));
    const showNotification = vi.fn();
    const { result } = renderWorkspaceHistory(
      [],
      [],
      { schedule, getScheduleIdentities },
      showNotification,
      'workspace',
      chat,
    );

    await waitFor(() => expect(result.current.scheduling).toBe(false));
    vi.useFakeTimers();
    await act(async () => {
      const firstRequest = result.current.handleSchedule(
        { chatId: chat.id, message: 'Ten messages', date, time },
        { mode: 'daily', occurrences: 10 },
      );
      const duplicateRequest = result.current.handleSchedule(
        { chatId: chat.id, message: 'Ten messages', date, time },
        { mode: 'daily', occurrences: 10 },
      );
      await Promise.all([firstRequest, duplicateRequest]);
      await vi.runAllTimersAsync();
    });
    vi.useRealTimers();

    const warningCall = showNotification.mock.calls.find(([, type, , , duration]) => type === 'warning' && duration === 5000);
    expect(warningCall?.[0]).toContain('10');
    expect(warningCall?.[1]).toBe('warning');
    expect(warningCall?.[4]).toBe(5000);
    expect(getScheduleIdentities).toHaveBeenCalledOnce();
    expect(schedule).toHaveBeenCalledTimes(10);
    expect(showNotification.mock.invocationCallOrder[0]).toBeLessThan(getScheduleIdentities.mock.invocationCallOrder[0]);
  })

  it('shows the correct count for the maximum repeat count', async () => {
    const previousLocale = window.localStorage.getItem('awaitmsg_locale');
    window.localStorage.setItem('awaitmsg_locale', 'en');

    try {
      const chat = { id: 'bulk-15', name: 'Bulk chat' };
      const schedule = vi.fn().mockResolvedValue({ success: true, confirmed: true });
      const showNotification = vi.fn();
      const { result, loadScheduleHistory } = renderWorkspaceHistory([], [], { schedule }, showNotification, 'workspace', chat);

      await waitFor(() => expect(loadScheduleHistory).toHaveBeenCalledWith('workspace'));
      vi.useFakeTimers();
      try {
        vi.setSystemTime(new Date('2035-01-15T12:00:00.000Z'));
        const { date, time } = localDateTimeAt(Date.now() + 60 * 60 * 1000);
        await act(async () => {
          await result.current.handleSchedule(
            { chatId: chat.id, message: 'Fifteen messages', date, time },
            { mode: 'daily', occurrences: 15 },
          );
          await vi.runAllTimersAsync();
        });
      } finally {
        vi.useRealTimers();
      }

      const warningCall = showNotification.mock.calls.find(([, type, , , duration]) => type === 'warning' && duration === 5000);
      expect([
        ['15 messages · FloodWait risk', 'Mass scheduling warning'],
        ['15 сообщений · риск FloodWait', 'Массовое планирование'],
      ]).toContainEqual([warningCall?.[0], warningCall?.[2]]);
      expect(warningCall?.[4]).toBe(5000);
      expect(schedule).toHaveBeenCalledTimes(15);
    } finally {
      if (previousLocale === null) window.localStorage.removeItem('awaitmsg_locale');
      else window.localStorage.setItem('awaitmsg_locale', previousLocale);
    }
  })
});
