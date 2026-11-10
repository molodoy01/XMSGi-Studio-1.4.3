import { act, waitFor } from '@testing-library/react';
import { expect, it, vi, afterEach, describe } from 'vitest';
import type { ScheduledMessage } from '@/types';
import { getTodayStr } from '@/lib/utils';
import { renderWorkspaceHistory } from './useScheduler.testUtils';

describe("useScheduler Send Now", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('marks send-now as sent only after Telegram confirms success', async () => {
    const message: ScheduledMessage = {
      id: 'send-now-1',
      chatId: 'chat-1',
      chatName: 'Test chat',
      text: 'Send through Telegram',
      when: '2035-01-15T18:00:00.000Z',
      createdAt: '2035-01-15T17:00:00.000Z',
      status: 'scheduled',
      telegramMessageId: 'telegram-1',
      silent: true,
      effect: '12345',
    };
    const events: string[] = [];
    const cancel = vi.fn(async () => {
      events.push('cancel');
      return { success: true };
    });
    const send = vi.fn(async () => {
      events.push('send');
      return { success: true, telegramMessageId: '507' };
    });
    const saveScheduleHistory = vi.fn(async ({ field, messages }: { field: string; messages: ScheduledMessage[] }) => {
      if (field === 'upcoming' && messages.some((item) => item.id === message.id && item.telegramMessageId === undefined)) {
        events.push('persist-cleared-id');
      }
      return { success: true };
    });
    const showNotification = vi.fn();
    const { result } = renderWorkspaceHistory([message], [], { cancel, send, saveScheduleHistory }, showNotification);

    await waitFor(() => expect(result.current.upcoming).toEqual([message]));
    act(() => {
      result.current.dateEditedRef.current = true;
      result.current.timeEditedRef.current = true;
      result.current.setDate('2035-01-15');
      result.current.setTime('18:30');
    });
    await act(async () => {
      await result.current.handleSendNow(message);
    });

    await waitFor(() => expect(result.current.sent).toHaveLength(1));
    expect(result.current.date).toBe(getTodayStr());
    expect(result.current.time).toMatch(/^\d{2}:\d{2}$/);
    expect(result.current.dateEditedRef.current).toBe(false);
    expect(result.current.timeEditedRef.current).toBe(false);
    expect(result.current.sent[0]).toMatchObject({ status: 'sent', sentAt: expect.any(String) });
    expect(result.current.upcoming).toHaveLength(0);
    expect(cancel).toHaveBeenCalledWith({
      chatId: message.chatId,
      telegramMessageId: message.telegramMessageId,
      message: message.text,
      targetTimestamp: Math.floor(new Date(message.when).getTime() / 1000),
    });
    expect(send).toHaveBeenCalledWith(
      message.chatId,
      message.text,
      [],
      [],
      true,
      '12345',
      'account-1',
      expect.stringMatching(/^\d+:[a-z0-9]+$/i),
    );
    expect(events.indexOf('cancel')).toBeLessThan(events.indexOf('persist-cleared-id'));
    expect(events.indexOf('persist-cleared-id')).toBeLessThan(events.indexOf('send'));
    expect(showNotification.mock.calls.some(([, , , , actions]) => actions)).toBe(false);
  })

  it('keeps Send Now confirmed in memory and warns when its final history save fails', async () => {
    const message: ScheduledMessage = {
      id: 'send-now-history-write-failure',
      chatId: 'chat-send-now-history',
      chatName: 'Send Now history chat',
      text: 'Confirmed before local save',
      when: '2035-01-15T18:00:00.000Z',
      createdAt: '2035-01-15T17:00:00.000Z',
      status: 'scheduled',
    };
    const send = vi.fn().mockResolvedValue({
      success: true,
      telegramMessageId: 508,
      telegramMessageIds: [508],
      sentAt: '2035-01-15T18:00:10.000Z',
    });
    const saveScheduleHistory = vi.fn(async ({ field, messages }: {
      field: string;
      messages: ScheduledMessage[] | { upcoming: ScheduledMessage[]; sent: ScheduledMessage[] };
    }) => {
      const isFailedFinalSnapshot = field === 'snapshot'
        && !Array.isArray(messages)
        && messages.sent.some((item) => item.id === message.id && item.status === 'sent');
      return { success: !isFailedFinalSnapshot, error: isFailedFinalSnapshot ? 'Disk full' : undefined };
    });
    const showNotification = vi.fn();
    const { result } = renderWorkspaceHistory(
      [message],
      [],
      { send, saveScheduleHistory },
      showNotification,
    );

    await waitFor(() => expect(result.current.upcoming).toEqual([message]));
    act(() => {
      result.current.dateEditedRef.current = true;
      result.current.timeEditedRef.current = true;
      result.current.setDate('2035-01-15');
      result.current.setTime('18:30');
    });
    await act(async () => {
      await result.current.handleSendNow(message);
    });

    expect(result.current.date).toBe(getTodayStr());
    expect(result.current.time).toMatch(/^\d{2}:\d{2}$/);
    expect(result.current.dateEditedRef.current).toBe(false);
    expect(result.current.timeEditedRef.current).toBe(false);
    expect(result.current.sent[0]).toMatchObject({
      id: message.id,
      status: 'sent',
      telegramMessageId: 508,
      sentAt: '2035-01-15T18:00:10.000Z',
    });
    expect(result.current.upcoming).toHaveLength(0);
    expect(showNotification).toHaveBeenCalledWith(
      'Telegram sent the message, but history could not be saved. Do not retry this message.',
      'warning',
      expect.any(String),
    );

    await act(async () => {
      await result.current.handleSendNow(result.current.sent[0]);
    });
    expect(send).toHaveBeenCalledOnce();
  })

  it('does not call Telegram when the Send Now Sending record cannot be persisted', async () => {
    const message: ScheduledMessage = {
      id: 'send-now-persist-before-send',
      chatId: 'chat-send-now-persist',
      chatName: 'Send Now persist chat',
      text: 'Persist this Sending status first',
      when: '2035-01-15T18:00:00.000Z',
      createdAt: '2035-01-15T17:00:00.000Z',
      status: 'scheduled',
    };
    const send = vi.fn();
    const saveScheduleHistory = vi.fn(async ({ field, messages }: {
      field: string;
      messages: ScheduledMessage[] | { upcoming: ScheduledMessage[]; sent: ScheduledMessage[] };
    }) => {
      const containsSending = field === 'upcoming'
        && Array.isArray(messages)
        && messages.some((item) => item.status === 'sending');
      return { success: !containsSending, error: containsSending ? 'Disk full' : undefined };
    });
    const { result } = renderWorkspaceHistory(
      [message],
      [],
      { send, saveScheduleHistory },
    );

    await waitFor(() => expect(result.current.upcoming).toEqual([message]));
    await act(async () => {
      await result.current.handleSendNow(message);
    });

    expect(send).not.toHaveBeenCalled();
    expect(result.current.upcoming[0]).toMatchObject({ status: 'failed', retryAction: 'send' });
  })

  it('records Telegram reconciliation as Sent without sending a duplicate', async () => {
    const message: ScheduledMessage = {
      id: 'already-delivered-1',
      chatId: 'chat-1',
      chatName: 'Test chat',
      text: 'Telegram already delivered this',
      when: '2035-01-15T18:00:00.000Z',
      createdAt: '2035-01-15T17:00:00.000Z',
      status: 'scheduled',
      telegramMessageId: 'stale-schedule-id',
    };
    const cancel = vi.fn().mockResolvedValue({
      success: true,
      alreadySent: true,
      telegramMessageId: 'sent-telegram-id',
      sentAt: '2035-01-15T18:00:30.000Z',
    });
    const send = vi.fn();
    const { result } = renderWorkspaceHistory([message], [], { cancel, send });

    await waitFor(() => expect(result.current.upcoming).toEqual([message]));
    await act(async () => {
      await result.current.handleSendNow(message);
    });

    expect(result.current.upcoming).toHaveLength(0);
    expect(result.current.sent[0]).toMatchObject({
      id: message.id,
      status: 'sent',
      sentAt: '2035-01-15T18:00:30.000Z',
      telegramMessageId: 'sent-telegram-id',
    });
    expect(send).not.toHaveBeenCalled();
  })

  it('keeps an uncertain Send Now result unknown and blocks a repeat send', async () => {
    const message: ScheduledMessage = {
      id: 'send-now-failed',
      chatId: 'chat-1',
      chatName: 'Test chat',
      text: 'Telegram rejects this',
      when: '2035-01-15T18:00:00.000Z',
      createdAt: '2035-01-15T17:00:00.000Z',
      status: 'scheduled',
      telegramMessageId: 'telegram-schedule-to-cancel',
    };
    const showNotification = vi.fn();
    const cancel = vi.fn().mockResolvedValue({ success: true });
    const send = vi.fn().mockResolvedValue({
      success: false,
      error: 'Telegram rejected the message.',
      code: 'HTTP_503',
      category: 'network',
      retryable: true,
    });
    const { result } = renderWorkspaceHistory([message], [], { cancel, send }, showNotification);

    await waitFor(() => expect(result.current.upcoming).toEqual([message]));
    await act(async () => {
      await result.current.handleSendNow(message);
    });

    await waitFor(() => expect(showNotification).toHaveBeenCalledWith(
      expect.any(String),
      'warning',
      expect.any(String),
      expect.objectContaining({ operation: 'publish', category: 'network', code: 'HTTP_503', retryable: true }),
    ));
    expect(result.current.upcoming[0]).toMatchObject({
      id: message.id,
      status: 'unknown',
      lastError: 'Telegram rejected the message.',
      lastErrorDetails: expect.objectContaining({ operation: 'publish', category: 'network', code: 'HTTP_503', retryable: true }),
      retryAction: undefined,
      telegramMessageId: undefined,
    });
    expect(result.current.sent).toHaveLength(0);

    const unknownMessage = result.current.upcoming[0];
    await act(async () => {
      await result.current.handleRetry(unknownMessage);
    });

    expect(result.current.sent).toHaveLength(0);
    expect(result.current.upcoming[0]).toMatchObject({ status: 'unknown', id: message.id });
    expect(cancel).toHaveBeenCalledOnce();
    expect(send).toHaveBeenCalledOnce();
  })

  it('ignores a second concurrent Send Now call for the same record', async () => {
    const message: ScheduledMessage = {
      id: 'send-now-duplicate',
      chatId: 'chat-1',
      chatName: 'Test chat',
      text: 'Send once',
      when: '2035-01-15T18:00:00.000Z',
      createdAt: '2035-01-15T17:00:00.000Z',
      status: 'scheduled',
      telegramMessageId: 'telegram-scheduled-duplicate',
    };
    let resolveSend!: (result: { success: boolean; telegramMessageId: number }) => void;
    const send = vi.fn(() => new Promise<{ success: boolean; telegramMessageId: number }>((resolve) => { resolveSend = resolve; }));
    const cancel = vi.fn().mockResolvedValue({ success: true });
    const { result } = renderWorkspaceHistory([message], [], { cancel, send });

    await waitFor(() => expect(result.current.upcoming).toEqual([message]));
    let firstAttempt!: Promise<void>;
    await act(async () => {
      firstAttempt = result.current.handleSendNow(message);
      await Promise.resolve();
      await result.current.handleSendNow(message);
    });

    expect(cancel).toHaveBeenCalledOnce();
    expect(send).toHaveBeenCalledOnce();
    await act(async () => {
      resolveSend({ success: true, telegramMessageId: 42 });
      await firstAttempt;
    });
    expect(result.current.sent).toHaveLength(1);
  })

  it('preserves both results when distinct Send Now operations finish concurrently', async () => {
    const firstMessage: ScheduledMessage = {
      id: 'send-now-parallel-1',
      chatId: 'chat-1',
      chatName: 'Test chat',
      text: 'First message',
      when: '2035-01-15T18:00:00.000Z',
      createdAt: '2035-01-15T17:00:00.000Z',
      status: 'scheduled',
    };
    const secondMessage: ScheduledMessage = {
      ...firstMessage,
      id: 'send-now-parallel-2',
      text: 'Second message',
    };
    let resolveFirst!: (result: { success: boolean; telegramMessageId: number }) => void;
    let resolveSecond!: (result: { success: boolean; telegramMessageId: number }) => void;
    const send = vi.fn((chatId: string) => new Promise<{ success: boolean; telegramMessageId: number }>((resolve) => {
      if (chatId === 'chat-1') {
        if (!resolveFirst) resolveFirst = resolve;
        else resolveSecond = resolve;
      }
    }));
    const { result } = renderWorkspaceHistory([firstMessage, secondMessage], [], { send });

    await waitFor(() => expect(result.current.upcoming).toHaveLength(2));
    let firstAttempt!: Promise<void>;
    let secondAttempt!: Promise<void>;
    await act(async () => {
      firstAttempt = result.current.handleSendNow(firstMessage);
      secondAttempt = result.current.handleSendNow(secondMessage);
    });
    await waitFor(() => expect(send).toHaveBeenCalledTimes(2));

    await act(async () => {
      resolveFirst({ success: true, telegramMessageId: 41 });
      await firstAttempt;
    });
    await act(async () => {
      resolveSecond({ success: true, telegramMessageId: 42 });
      await secondAttempt;
    });

    expect(result.current.sent.map((item) => item.id).sort()).toEqual([
      firstMessage.id,
      secondMessage.id,
    ]);
    expect(result.current.upcoming).toHaveLength(0);
  })

  it('preserves both results when distinct schedule retries finish concurrently', async () => {
    const firstMessage: ScheduledMessage = {
      id: 'retry-schedule-parallel-1',
      chatId: 'chat-1',
      chatName: 'Test chat',
      text: 'First retry',
      when: '2035-01-15T18:00:00.000Z',
      createdAt: '2035-01-15T17:00:00.000Z',
      status: 'failed',
      retryAction: 'schedule',
    };
    const secondMessage: ScheduledMessage = {
      ...firstMessage,
      id: 'retry-schedule-parallel-2',
      text: 'Second retry',
    };
    let resolveFirst!: (result: { success: boolean; confirmed: boolean; telegramMessageId: string }) => void;
    let resolveSecond!: (result: { success: boolean; confirmed: boolean; telegramMessageId: string }) => void;
    const schedule = vi.fn(() => new Promise<{ success: boolean; confirmed: boolean; telegramMessageId: string }>((resolve) => {
      if (!resolveFirst) resolveFirst = resolve;
      else resolveSecond = resolve;
    }));
    const { result } = renderWorkspaceHistory([firstMessage, secondMessage], [], { schedule });

    await waitFor(() => expect(result.current.upcoming).toHaveLength(2));
    let firstAttempt!: Promise<void>;
    let secondAttempt!: Promise<void>;
    await act(async () => {
      firstAttempt = result.current.handleRetry(firstMessage);
      secondAttempt = result.current.handleRetry(secondMessage);
    });
    await waitFor(() => expect(schedule).toHaveBeenCalledTimes(2));

    await act(async () => {
      resolveFirst({ success: true, confirmed: true, telegramMessageId: 'retry-scheduled-1' });
      await firstAttempt;
    });
    await act(async () => {
      resolveSecond({ success: true, confirmed: true, telegramMessageId: 'retry-scheduled-2' });
      await secondAttempt;
    });

    expect(result.current.upcoming.map((item) => item.id).sort()).toEqual([
      firstMessage.id,
      secondMessage.id,
    ]);
    expect(result.current.upcoming.every((item) => item.status === 'scheduled')).toBe(true);
  })

  it('keeps Send Now behind the account FloodWait gate', async () => {
    const message: ScheduledMessage = {
      id: 'send-now-rate-limited',
      chatId: 'chat-1',
      chatName: 'Test chat',
      text: 'Wait until account is available',
      when: '2035-01-15T18:00:00.000Z',
      createdAt: '2035-01-15T17:00:00.000Z',
      status: 'scheduled',
    };
    let resumeRateLimit!: (result: { success: boolean }) => void;
    const rateLimitGate = new Promise<{ success: boolean }>((resolve) => { resumeRateLimit = resolve; });
    const waitForRateLimit = vi.fn(() => rateLimitGate);
    const send = vi.fn().mockResolvedValue({ success: true, telegramMessageId: 505 });
    const { result, loadScheduleHistory } = renderWorkspaceHistory([message], [], { waitForRateLimit, send });

    await waitFor(() => expect(result.current.upcoming).toEqual([message]));
    let attempt!: Promise<void>;
    await act(async () => {
      attempt = result.current.handleSendNow(message);
      await Promise.resolve();
    });

    expect(waitForRateLimit).toHaveBeenCalledOnce();
    expect(send).not.toHaveBeenCalled();
    expect(result.current.upcoming[0]).toMatchObject({ status: 'sending' });

    await act(async () => {
      resumeRateLimit({ success: true });
      await attempt;
    });

    expect(send).toHaveBeenCalledOnce();
    expect(result.current.sent).toHaveLength(1);
    expect(loadScheduleHistory).toHaveBeenCalledWith('workspace');
  })
});
