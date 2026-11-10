import { act, waitFor } from '@testing-library/react';
import { expect, it, vi, afterEach, describe } from 'vitest';
import type { ScheduledMessage } from '@/types';
import { getFutureReplacementTimes, renderWorkspaceHistory } from './useScheduler.testUtils';

describe("useScheduler schedule replacement", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it.each(['personal', 'workspace'] as const)('replaces %s schedules only after the new message is confirmed', async (historyScope) => {
    const chat = { id: 'chat-1', name: 'Test chat' };
    const { originalWhen, replacementDateTime } = getFutureReplacementTimes();
    const entities = [{ type: 'bold' as const, offset: 0, length: 10 }];
    const original: ScheduledMessage = {
      id: 'original-schedule',
      chatId: chat.id,
      chatName: chat.name,
      text: 'Original text',
      when: originalWhen,
      createdAt: new Date(Date.now() - 60_000).toISOString(),
      status: 'scheduled',
      telegramMessageId: 'telegram-original',
    };
    const events: string[] = [];
    const schedule = vi.fn(async () => {
      events.push('schedule');
      return { success: true, confirmed: true, telegramMessageId: 'telegram-replacement' };
    });
    const cancel = vi.fn(async () => {
      events.push('cancel');
      return { success: true };
    });
    const { result, loadScheduleHistory } = renderWorkspaceHistory(
      [original],
      [],
      { schedule, cancel },
      vi.fn(),
      historyScope,
      chat,
    );

    await waitFor(() => expect(loadScheduleHistory).toHaveBeenCalledWith(historyScope));
    await waitFor(() => expect(result.current.upcoming).toEqual([original]));
    let resultValue: boolean | 'sent-history-failed' | void = undefined;
    await act(async () => {
      resultValue = await result.current.handleSchedule({
        chatId: chat.id,
        message: 'Replacement text',
        ...replacementDateTime,
        attachments: ['C:/files/brief.pdf'],
        entities,
        silent: true,
        effect: 'fire',
        replaceMessage: original,
        waitForConfirmation: true,
      });
    });

    await waitFor(() => expect(result.current.upcoming).toHaveLength(1));
    expect(resultValue).toBe(true);
    expect(events).toEqual(['schedule', 'cancel']);
    expect(schedule).toHaveBeenCalledWith(expect.objectContaining({
      chatId: chat.id,
      message: 'Replacement text',
      attachments: ['C:/files/brief.pdf'],
      entities,
      silent: true,
      effect: 'fire',
    }));
    expect(result.current.upcoming[0]).toMatchObject({
      text: 'Replacement text',
      telegramMessageId: 'telegram-replacement',
      status: 'scheduled',
      attachments: ['C:/files/brief.pdf'],
      entities,
      silent: true,
      effect: 'fire',
    });
  })

  it('keeps the original schedule when Telegram does not confirm the replacement', async () => {
    const chat = { id: 'chat-1', name: 'Test chat' };
    const { originalWhen, replacementDateTime } = getFutureReplacementTimes();
    const original: ScheduledMessage = {
      id: 'original-schedule-unconfirmed',
      chatId: chat.id,
      chatName: chat.name,
      text: 'Original text',
      when: originalWhen,
      createdAt: new Date(Date.now() - 60_000).toISOString(),
      status: 'scheduled',
      telegramMessageId: 'telegram-original-unconfirmed',
    };
    const schedule = vi.fn().mockResolvedValue({ success: false, error: 'Schedule request failed.' });
    const cancel = vi.fn().mockResolvedValue({ success: true });
    const showNotification = vi.fn();
    const { result, loadScheduleHistory } = renderWorkspaceHistory(
      [original],
      [],
      { schedule, cancel },
      showNotification,
      'workspace',
      chat,
    );

    await waitFor(() => expect(loadScheduleHistory).toHaveBeenCalledWith('workspace'));
    await waitFor(() => expect(result.current.upcoming).toEqual([original]));
    let replacementResult: boolean | 'sent-history-failed' | void = undefined;
    await act(async () => {
      replacementResult = await result.current.handleSchedule({
        chatId: chat.id,
        message: 'Replacement text',
        ...replacementDateTime,
        replaceMessage: original,
        waitForConfirmation: true,
      });
    });
    expect(replacementResult).toBe(false);

    await waitFor(() => expect(result.current.upcoming).toHaveLength(2));
    expect(cancel).not.toHaveBeenCalled();
    expect(result.current.upcoming).toContainEqual(expect.objectContaining({
      id: original.id,
      status: 'scheduled',
      telegramMessageId: original.telegramMessageId,
    }));
    expect(showNotification).toHaveBeenCalledWith(expect.any(String), 'error', expect.any(String), expect.any(Object));
  })

  it('reports both cancel failures and blocks duplicate replacement attempts', async () => {
    const chat = { id: 'chat-1', name: 'Test chat' };
    const { originalWhen, replacementDateTime } = getFutureReplacementTimes();
    const original: ScheduledMessage = {
      id: 'original-schedule-failed-cancel',
      chatId: chat.id,
      chatName: chat.name,
      text: 'Original text',
      when: originalWhen,
      createdAt: new Date(Date.now() - 60_000).toISOString(),
      status: 'scheduled',
      telegramMessageId: 'telegram-original-failed-cancel',
    };
    const schedule = vi.fn().mockResolvedValue({
      success: true,
      confirmed: true,
      telegramMessageId: 'telegram-replacement-failed-cancel',
    });
    const cancel = vi.fn().mockResolvedValue({ success: false, error: 'Telegram cancellation failed.' });
    const showNotification = vi.fn();
    const { result, loadScheduleHistory } = renderWorkspaceHistory(
      [original],
      [],
      { schedule, cancel },
      showNotification,
      'workspace',
      chat,
    );

    await waitFor(() => expect(loadScheduleHistory).toHaveBeenCalledWith('workspace'));
    await waitFor(() => expect(result.current.upcoming).toEqual([original]));
    let replacementResult: boolean | 'sent-history-failed' | void = undefined;
    await act(async () => {
      replacementResult = await result.current.handleSchedule({
        chatId: chat.id,
        message: 'Replacement text',
        ...replacementDateTime,
        replaceMessage: original,
        waitForConfirmation: true,
      });
    });
    expect(replacementResult).toBe(false);

    await waitFor(() => {
      expect(result.current.upcoming).toHaveLength(2);
      expect(result.current.upcoming).toContainEqual(expect.objectContaining({
        id: original.id,
        status: 'failed',
        retryAction: 'cancel',
      }));
      expect(result.current.upcoming).toContainEqual(expect.objectContaining({
        text: 'Replacement text',
        status: 'failed',
        retryAction: 'cancel',
        telegramMessageId: 'telegram-replacement-failed-cancel',
      }));
    });
    expect(result.current.upcoming).toContainEqual(expect.objectContaining({
      id: original.id,
      status: 'failed',
      retryAction: 'cancel',
    }));
    expect(result.current.upcoming).toContainEqual(expect.objectContaining({
      text: 'Replacement text',
      status: 'failed',
      retryAction: 'cancel',
      telegramMessageId: 'telegram-replacement-failed-cancel',
    }));
    expect(showNotification).toHaveBeenCalledWith(expect.any(String), 'warning', expect.any(String));
    expect(cancel).toHaveBeenCalledTimes(2);

    let repeatedResult: boolean | 'sent-history-failed' | void = undefined;
    await act(async () => {
      repeatedResult = await result.current.handleSchedule({
        chatId: chat.id,
        message: 'Replacement text',
        ...replacementDateTime,
        replaceMessage: original,
        waitForConfirmation: true,
      });
    });
    expect(repeatedResult).toBe(false);
    expect(schedule).toHaveBeenCalledOnce();
    expect(showNotification).toHaveBeenCalledWith(expect.any(String), 'warning', expect.any(String));
  })

  it('rolls back the new schedule when cancelling the original fails', async () => {
    const chat = { id: 'chat-1', name: 'Test chat' };
    const { originalWhen, replacementDateTime } = getFutureReplacementTimes();
    const original: ScheduledMessage = {
      id: 'original-rollback-schedule',
      chatId: chat.id,
      chatName: chat.name,
      text: 'Original text',
      when: originalWhen,
      createdAt: new Date(Date.now() - 60_000).toISOString(),
      status: 'scheduled',
      telegramMessageId: 'telegram-original-rollback',
    };
    const schedule = vi.fn().mockResolvedValue({
      success: true,
      confirmed: true,
      telegramMessageId: 'telegram-replacement-rollback',
    });
    const cancel = vi.fn()
      .mockResolvedValueOnce({ success: false, error: 'Original cancellation failed.' })
      .mockResolvedValueOnce({ success: true });
    const showNotification = vi.fn();
    const { result, loadScheduleHistory } = renderWorkspaceHistory(
      [original],
      [],
      { schedule, cancel },
      showNotification,
      'personal',
      chat,
    );

    await waitFor(() => expect(loadScheduleHistory).toHaveBeenCalledWith('personal'));
    await waitFor(() => expect(result.current.upcoming).toEqual([original]));
    let replacementResult: boolean | 'sent-history-failed' | void = undefined;
    await act(async () => {
      replacementResult = await result.current.handleSchedule({
        chatId: chat.id,
        message: 'Replacement text',
        ...replacementDateTime,
        replaceMessage: original,
        waitForConfirmation: true,
      });
    });

    expect(replacementResult).toBe(false);
    expect(cancel).toHaveBeenCalledTimes(2);
    expect(result.current.upcoming).toEqual([expect.objectContaining({
      id: original.id,
      status: 'failed',
      retryAction: 'cancel',
    })]);
    expect(showNotification).toHaveBeenCalledWith(expect.any(String), 'warning', expect.any(String));

    let repeatedResult: boolean | 'sent-history-failed' | void = undefined;
    await act(async () => {
      repeatedResult = await result.current.handleSchedule({
        chatId: chat.id,
        message: 'Replacement text',
        ...replacementDateTime,
        replaceMessage: original,
        waitForConfirmation: true,
      });
    });
    expect(repeatedResult).toBe(false);
    expect(schedule).toHaveBeenCalledOnce();
  })

  it('cancels the replacement when Telegram reports the original was already sent', async () => {
    const chat = { id: 'chat-1', name: 'Test chat' };
    const { originalWhen, replacementDateTime } = getFutureReplacementTimes();
    const original: ScheduledMessage = {
      id: 'original-already-sent',
      chatId: chat.id,
      chatName: chat.name,
      text: 'Original text',
      when: originalWhen,
      createdAt: new Date(Date.now() - 60_000).toISOString(),
      status: 'scheduled',
      telegramMessageId: 'telegram-original-already-sent',
    };
    const schedule = vi.fn().mockResolvedValue({
      success: true,
      confirmed: true,
      telegramMessageId: 'telegram-replacement-race',
    });
    const cancel = vi.fn()
      .mockResolvedValueOnce({
        success: true,
        alreadySent: true,
        telegramMessageId: 'telegram-original-delivered',
        sentAt: new Date(Date.parse(originalWhen) + 30_000).toISOString(),
      })
      .mockResolvedValueOnce({ success: true });
    const { result, loadScheduleHistory } = renderWorkspaceHistory(
      [original],
      [],
      { schedule, cancel },
      vi.fn(),
      'workspace',
      chat,
    );

    await waitFor(() => expect(loadScheduleHistory).toHaveBeenCalledWith('workspace'));
    await waitFor(() => expect(result.current.upcoming).toEqual([original]));
    await act(async () => {
      await result.current.handleSchedule({
        chatId: chat.id,
        message: 'Replacement text',
        ...replacementDateTime,
        replaceMessage: original,
        waitForConfirmation: true,
      });
    });

    await waitFor(() => expect(cancel).toHaveBeenCalledTimes(2));
    expect(cancel).toHaveBeenNthCalledWith(2, expect.objectContaining({
      chatId: chat.id,
      telegramMessageId: 'telegram-replacement-race',
    }));
    expect(result.current.upcoming).toEqual([]);
    expect(result.current.sent[0]).toMatchObject({
      id: original.id,
      status: 'sent',
      telegramMessageId: 'telegram-original-delivered',
    });
  })

  it('cancels the linked original when a failed replacement is retried successfully', async () => {
    const chat = { id: 'chat-1', name: 'Test chat' };
    const original: ScheduledMessage = {
      id: 'retry-original-schedule',
      chatId: chat.id,
      chatName: chat.name,
      text: 'Original text',
      when: '2035-01-15T18:00:00.000Z',
      createdAt: '2035-01-14T18:00:00.000Z',
      status: 'scheduled',
      telegramMessageId: 'telegram-retry-original',
    };
    const replacement: ScheduledMessage = {
      id: 'retry-replacement-schedule',
      operationId: 'retry-replacement-operation',
      replacementOfId: original.id,
      chatId: chat.id,
      chatName: chat.name,
      text: 'Replacement text',
      when: '2035-01-15T19:00:00.000Z',
      createdAt: '2035-01-14T18:30:00.000Z',
      status: 'failed',
      retryAction: 'schedule',
    };
    const events: string[] = [];
    const schedule = vi.fn(async () => {
      events.push('schedule');
      return { success: true, confirmed: true, telegramMessageId: 'telegram-retried-replacement' };
    });
    const cancel = vi.fn(async () => {
      events.push('cancel');
      return { success: true };
    });
    const { result, loadScheduleHistory } = renderWorkspaceHistory(
      [original, replacement],
      [],
      { schedule, cancel },
      vi.fn(),
      'workspace',
      chat,
    );

    await waitFor(() => expect(loadScheduleHistory).toHaveBeenCalledWith('workspace'));
    await act(async () => {
      await result.current.handleRetry(replacement);
    });

    expect(events).toEqual(['schedule', 'cancel']);
    expect(result.current.upcoming).toHaveLength(1);
    expect(result.current.upcoming[0]).toMatchObject({
      id: replacement.id,
      status: 'scheduled',
      telegramMessageId: 'telegram-retried-replacement',
    });
  })

  it('allows attachment-only messages to be scheduled without text', async () => {
    const chat = { id: 'chat-1', name: 'Test chat' };
    const future = new Date(Date.now() + 60 * 60 * 1000);
    const date = `${future.getFullYear()}-${String(future.getMonth() + 1).padStart(2, '0')}-${String(future.getDate()).padStart(2, '0')}`;
    const time = `${String(future.getHours()).padStart(2, '0')}:${String(future.getMinutes()).padStart(2, '0')}`;
    const schedule = vi.fn().mockResolvedValue({ success: true, confirmed: true, telegramMessageId: 'telegram-scheduled-1' });
    const { result } = renderWorkspaceHistory([], [], { schedule }, vi.fn(), 'workspace', chat);

    await waitFor(() => expect(result.current.scheduling).toBe(false));
    await act(async () => {
      result.current.handleSchedule({
        chatId: chat.id,
        message: '',
        date,
        time,
        attachments: ['C:/demo/demo.pdf'],
      });
    });

    await waitFor(() => expect(schedule).toHaveBeenCalledTimes(1));
    expect(schedule).toHaveBeenCalledWith(expect.objectContaining({
      chatId: chat.id,
      message: '',
      attachments: ['C:/demo/demo.pdf'],
    }));
  })

  it('distinguishes attachment-only schedules by their attachments', async () => {
    const chat = { id: 'chat-1', name: 'Test chat' };
    const future = new Date(Date.now() + 60 * 60 * 1000);
    const date = `${future.getFullYear()}-${String(future.getMonth() + 1).padStart(2, '0')}-${String(future.getDate()).padStart(2, '0')}`;
    const time = `${String(future.getHours()).padStart(2, '0')}:${String(future.getMinutes()).padStart(2, '0')}`;
    const when = new Date(`${date}T${time}`).toISOString();
    const existingMessage: ScheduledMessage = {
      id: 'scheduled-photo-one',
      chatId: chat.id,
      chatName: chat.name,
      text: '',
      when,
      createdAt: new Date().toISOString(),
      status: 'scheduled',
      attachments: ['C:/demo/photo-one.png'],
    };
    const schedule = vi.fn().mockResolvedValue({
      success: true,
      confirmed: true,
      telegramMessageId: 'telegram-photo-two',
    });
    const { result, loadScheduleHistory } = renderWorkspaceHistory(
      [existingMessage],
      [],
      { schedule },
      vi.fn(),
      'workspace',
      chat,
    );

    await waitFor(() => expect(loadScheduleHistory).toHaveBeenCalledWith('workspace'));
    await act(async () => {
      result.current.handleSchedule({
        chatId: chat.id,
        message: '',
        date,
        time,
        attachments: ['C:/demo/photo-two.png'],
      });
    });

    await waitFor(() => expect(schedule).toHaveBeenCalledOnce());
    await waitFor(() => expect(result.current.upcoming).toContainEqual(expect.objectContaining({
      attachments: ['C:/demo/photo-two.png'],
      status: 'scheduled',
    })));

    await act(async () => {
      result.current.handleSchedule({
        chatId: chat.id,
        message: '',
        date,
        time,
        attachments: ['C:/demo/photo-two.png'],
      });
    });

    expect(schedule).toHaveBeenCalledOnce();
    expect(result.current.upcoming).toHaveLength(2);
  })
});
