import { act, renderHook, waitFor } from '@testing-library/react';
import type { PropsWithChildren } from 'react';
import { expect, it, vi, afterEach, describe } from 'vitest';
import { LocaleProvider } from '@/lib/i18n';
import type { RichTextEntity, ScheduledMessage } from '@/types';
import { useScheduler } from './useScheduler';
import { getCurrentTimeStr, getTodayStr } from '@/lib/utils';
import { createScheduleIdentityResult, getFutureReplacementTimes, renderWorkspaceHistory } from './useScheduler.testUtils';

describe("useScheduler scheduling and attachments", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('keeps a new schedule Sending until the account rate-limit gate resumes', async () => {
    const chat = { id: 'chat-1', name: 'Test chat' };
    const future = new Date(Date.now() + 60 * 60 * 1000);
    const date = `${future.getFullYear()}-${String(future.getMonth() + 1).padStart(2, '0')}-${String(future.getDate()).padStart(2, '0')}`;
    const time = `${String(future.getHours()).padStart(2, '0')}:${String(future.getMinutes()).padStart(2, '0')}`;
    let resumeRateLimit!: (value: { success: boolean }) => void;
    const rateLimitGate = new Promise<{ success: boolean }>((resolve) => { resumeRateLimit = resolve; });
    const waitForRateLimit = vi.fn(() => rateLimitGate);
    const schedule = vi.fn().mockResolvedValue({ success: true, confirmed: true, id: 'telegram-scheduled-1' });
    const showNotification = vi.fn();
    const loadScheduleHistory = vi.fn().mockResolvedValue({
      success: true,
      history: { upcoming: [], sent: [] },
      needsMigration: false,
    });
    vi.stubGlobal('telegram', {
      loadScheduleHistory,
      saveScheduleHistory: vi.fn().mockResolvedValue({ success: true }),
      getScheduleIdentities: vi.fn(async (operations: Array<Record<string, unknown>>) => createScheduleIdentityResult(operations)),
      waitForRateLimit,
      schedule,
    });

    const wrapper = ({ children }: PropsWithChildren) => <LocaleProvider>{children}</LocaleProvider>;
    const { result } = renderHook(() => useScheduler({
      historyScope: 'workspace',
      connected: false,
      selectedChat: chat,
      chats: [chat],
      message: 'Wait for the account gate',
      showNotification,
      setMessage: vi.fn(),
    }), { wrapper });

    await waitFor(() => expect(loadScheduleHistory).toHaveBeenCalledWith('workspace'));
    await waitFor(() => expect(result.current.scheduling).toBe(false));
    await act(async () => {
      result.current.handleSchedule({
        chatId: chat.id,
        message: 'Wait for the account gate',
        date,
        time,
      }, { mode: 'none', occurrences: 1 });
      await Promise.resolve();
    });
    await waitFor(() => expect(waitForRateLimit).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(result.current.upcoming[0]).toMatchObject({
      chatId: chat.id,
      status: 'sending',
    }));

    expect(schedule).not.toHaveBeenCalled();

    await act(async () => {
      resumeRateLimit({ success: true });
    });
    await waitFor(() => expect(schedule).toHaveBeenCalledTimes(1));
    expect(schedule).toHaveBeenCalledWith(expect.objectContaining({
      chatId: chat.id,
      message: 'Wait for the account gate',
    }));
    await waitFor(() => expect(result.current.upcoming[0]).toMatchObject({ status: 'scheduled' }));
  })

  it('sends Planner photo attachments through Telegram scheduling and reports confirmation', async () => {
    const chat = { id: 'planner-photo-chat', name: 'Photo channel' };
    const future = new Date(Date.now() + 60 * 60 * 1000);
    const date = `${future.getFullYear()}-${String(future.getMonth() + 1).padStart(2, '0')}-${String(future.getDate()).padStart(2, '0')}`;
    const time = `${String(future.getHours()).padStart(2, '0')}:${String(future.getMinutes()).padStart(2, '0')}`;
    const schedule = vi.fn().mockResolvedValue({ success: true, confirmed: true, id: 'telegram-photo-schedule' });
    const { result, loadScheduleHistory } = renderWorkspaceHistory([], [], { schedule }, vi.fn(), 'personal', chat);
    await waitFor(() => expect(loadScheduleHistory).toHaveBeenCalledWith('personal'));
    await waitFor(() => expect(result.current.upcoming).toEqual([]));
    let scheduled = false;
    let scheduleRequest!: Promise<boolean | void | 'sent-history-failed'>;
    act(() => {
      scheduleRequest = result.current.handleSchedule({
        chatId: chat.id,
        message: 'Caption with photo',
        attachments: ['C:/planner/photo.png'],
        date,
        time,
        clearMessageOnSuccess: false,
        waitForConfirmation: true,
      });
    });
    await waitFor(() => expect(schedule).toHaveBeenCalledOnce());
    await act(async () => { scheduled = await scheduleRequest === true; });

    expect(scheduled).toBe(true);
    expect(schedule).toHaveBeenCalledWith(expect.objectContaining({
      chatId: chat.id,
      message: 'Caption with photo',
      attachments: ['C:/planner/photo.png'],
    }));
    expect(result.current.upcoming[0]).toMatchObject({
      text: 'Caption with photo',
      attachments: ['C:/planner/photo.png'],
      status: 'scheduled',
    });
  })

  it('resets the schedule date and time after a fully confirmed schedule', async () => {
    const chat = { id: 'chat-reset-date', name: 'Date reset chat' };
    const future = new Date(Date.now() + 60 * 60 * 1000);
    const date = `${future.getFullYear()}-${String(future.getMonth() + 1).padStart(2, '0')}-${String(future.getDate()).padStart(2, '0')}`;
    const time = `${String(future.getHours()).padStart(2, '0')}:${String(future.getMinutes()).padStart(2, '0')}`;
    const schedule = vi.fn().mockResolvedValue({ success: true, confirmed: true, id: 'scheduled-reset-date' });
    const { result } = renderWorkspaceHistory([], [], { schedule }, vi.fn(), 'workspace', chat);

    await waitFor(() => expect(result.current.scheduling).toBe(false));
    act(() => {
      result.current.dateEditedRef.current = true;
      result.current.timeEditedRef.current = true;
      result.current.setDate('2035-01-15');
      result.current.setTime('18:30');
    });

    let scheduleRequest!: Promise<boolean | void | 'sent-history-failed'>;
    act(() => {
      scheduleRequest = result.current.handleSchedule({
        chatId: chat.id,
        message: 'Schedule the next post',
        date,
        time,
        waitForConfirmation: true,
      });
    });
    await act(async () => {
      expect(await scheduleRequest).toBe(true);
    });

    expect(result.current.date).toBe(getTodayStr());
    expect(result.current.time).toBe(getCurrentTimeStr());
    expect(result.current.dateEditedRef.current).toBe(false);
    expect(result.current.timeEditedRef.current).toBe(false);
  })

  it('marks schedule failure Failed and retries through the same confirmed schedule flow', async () => {
    const chat = { id: 'chat-1', name: 'Test chat' };
    const future = new Date(Date.now() + 60 * 60 * 1000);
    const date = `${future.getFullYear()}-${String(future.getMonth() + 1).padStart(2, '0')}-${String(future.getDate()).padStart(2, '0')}`;
    const time = `${String(future.getHours()).padStart(2, '0')}:${String(future.getMinutes()).padStart(2, '0')}`;
    const events: string[] = [];
    const saveScheduleHistory = vi.fn(async ({ field }: { field: string }) => {
      if (field === 'upcoming') events.push('persist');
      return { success: true };
    });
    const schedule = vi.fn()
      .mockImplementationOnce(async () => {
        events.push('schedule');
        return { success: false, error: 'Telegram schedule failed.' };
      })
      .mockImplementationOnce(async () => {
        events.push('schedule-retry');
        return { success: true, confirmed: true, telegramMessageId: 'telegram-retry-1' };
      });
    const { result } = renderWorkspaceHistory([], [], { schedule, saveScheduleHistory }, vi.fn(), 'workspace', chat);

    await waitFor(() => expect(result.current.scheduling).toBe(false));
    await act(async () => {
      result.current.handleSchedule({ chatId: chat.id, message: 'Retry schedule', date, time });
    });
    await waitFor(() => expect(result.current.upcoming[0]).toMatchObject({
      status: 'failed',
      lastError: 'Telegram schedule failed.',
      retryAction: 'schedule',
    }));
    expect(events.indexOf('persist')).toBeLessThan(events.indexOf('schedule'));

    await act(async () => {
      await result.current.handleRetry(result.current.upcoming[0]);
    });

    expect(result.current.upcoming[0]).toMatchObject({
      status: 'scheduled',
      telegramMessageId: 'telegram-retry-1',
    });
    expect(schedule).toHaveBeenCalledTimes(2);
    expect(events.indexOf('persist')).toBeLessThan(events.indexOf('schedule-retry'));
  })

  it('keeps the draft and does not report success when a repeated schedule partially fails', async () => {
    const chat = { id: 'chat-partial-repeat', name: 'Partial repeat chat' };
    const { date, time } = getFutureReplacementTimes().replacementDateTime;
    const schedule = vi.fn()
      .mockResolvedValueOnce({ success: true, confirmed: true, telegramMessageId: 'scheduled-first' })
      .mockResolvedValueOnce({ success: false, error: 'Second schedule failed.' });
    const setMessage = vi.fn();
    const { result } = renderWorkspaceHistory(
      [],
      [],
      { schedule },
      vi.fn(),
      'workspace',
      chat,
      setMessage,
    );

    await waitFor(() => expect(result.current.scheduling).toBe(false));
    let scheduleRequest!: Promise<boolean | void | 'sent-history-failed'>;
    act(() => {
      scheduleRequest = result.current.handleSchedule(
        { chatId: chat.id, message: 'Preserve this draft', date, time, waitForConfirmation: true },
        { mode: 'daily', occurrences: 2 },
      );
    });
    let scheduled = true;
    await act(async () => {
      scheduled = await scheduleRequest === true;
    });

    expect(scheduled).toBe(false);
    expect(schedule).toHaveBeenCalledTimes(2);
    expect(result.current.upcoming).toEqual(expect.arrayContaining([
      expect.objectContaining({ status: 'scheduled', telegramMessageId: 'scheduled-first' }),
      expect.objectContaining({ status: 'failed', lastError: 'Second schedule failed.' }),
    ]));
    expect(setMessage).not.toHaveBeenCalled();
    expect(result.current.successPulse).toBe(false);
    expect(result.current.lastAction).toBeNull();
  })

  it('keeps a Telegram-confirmed retry scheduled when its final history write fails', async () => {
    const previousLocale = window.localStorage.getItem('awaitmsg_locale');
    window.localStorage.setItem('awaitmsg_locale', 'en');
    try {
      const chat = { id: 'retry-history-write-chat', name: 'Retry history chat' };
      const failedRecord: ScheduledMessage = {
        id: 'retry-history-write-record',
        chatId: chat.id,
        chatName: chat.name,
        text: 'Confirmed by Telegram on retry',
        when: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        createdAt: new Date().toISOString(),
        status: 'failed',
        retryAction: 'schedule',
      };
      const schedule = vi.fn().mockResolvedValue({
        success: true,
        confirmed: true,
        telegramMessageId: 'telegram-confirmed-on-retry',
      });
      const saveScheduleHistory = vi.fn(async ({ messages }: { messages: ScheduledMessage[] }) => ({
        success: !messages.some((message) => message.status === 'scheduled'),
        error: 'Disk full',
      }));
      const showNotification = vi.fn();
      const { result, loadScheduleHistory } = renderWorkspaceHistory(
        [failedRecord],
        [],
        { schedule, saveScheduleHistory },
        showNotification,
        'workspace',
        chat,
      );

      await waitFor(() => expect(loadScheduleHistory).toHaveBeenCalledWith('workspace'));
      await waitFor(() => expect(result.current.scheduling).toBe(false));
      await act(async () => result.current.handleRetry(result.current.upcoming[0]));

      expect(schedule).toHaveBeenCalledOnce();
      expect(result.current.upcoming[0]).toMatchObject({
        status: 'scheduled',
        telegramMessageId: 'telegram-confirmed-on-retry',
      });
      expect(showNotification).toHaveBeenCalledWith(
        'Telegram confirmed the schedule, but its history could not be saved. Check the queue before retrying.',
        'warning',
        'Error',
      );
      expect(showNotification).not.toHaveBeenCalledWith('Message scheduled in Telegram.', 'success', 'Scheduled');
    } finally {
      if (previousLocale === null) window.localStorage.removeItem('awaitmsg_locale');
      else window.localStorage.setItem('awaitmsg_locale', previousLocale);
    }
  })

  it('keeps a Telegram-confirmed schedule visible and warns when its final history commit fails', async () => {
    const previousLocale = window.localStorage.getItem('awaitmsg_locale');
    window.localStorage.setItem('awaitmsg_locale', 'en');
    try {
      const chat = { id: 'chat-history-write-failure', name: 'History write failure chat' };
      const saveScheduleHistory = vi.fn(async ({ messages }: { messages: ScheduledMessage[] }) => ({
        success: !messages.some((message) => message.status === 'scheduled'),
        error: 'Disk full',
      }));
      const schedule = vi.fn().mockResolvedValue({
        success: true,
        confirmed: true,
        telegramMessageId: 'telegram-confirmed-history-failure',
      });
      const showNotification = vi.fn();
      const { result, loadScheduleHistory } = renderWorkspaceHistory(
        [],
        [],
        { schedule, saveScheduleHistory },
        showNotification,
        'workspace',
        chat,
      );
      const future = new Date(Date.now() + 60 * 60 * 1000);
      const date = `${future.getFullYear()}-${String(future.getMonth() + 1).padStart(2, '0')}-${String(future.getDate()).padStart(2, '0')}`;
      const time = `${String(future.getHours()).padStart(2, '0')}:${String(future.getMinutes()).padStart(2, '0')}`;

      await waitFor(() => expect(loadScheduleHistory).toHaveBeenCalledWith('workspace'));
      await waitFor(() => expect(result.current.scheduling).toBe(false));
      await act(async () => {
        await result.current.handleSchedule({ chatId: chat.id, message: 'Persist the confirmation', date, time });
      });

      await waitFor(() => expect(result.current.scheduling).toBe(false));
      expect(schedule).toHaveBeenCalledOnce();
      expect(result.current.upcoming).toContainEqual(expect.objectContaining({
        status: 'scheduled',
        telegramMessageId: 'telegram-confirmed-history-failure',
      }));
      expect(showNotification).toHaveBeenCalledWith(
        'Telegram confirmed the schedule, but its history could not be saved. Check the queue before retrying.',
        'warning',
        'Error',
      );
    } finally {
      if (previousLocale === null) window.localStorage.removeItem('awaitmsg_locale');
      else window.localStorage.setItem('awaitmsg_locale', previousLocale);
    }
  })

  it('does not cancel the original schedule when the confirmed replacement cannot be persisted', async () => {
    const previousLocale = window.localStorage.getItem('awaitmsg_locale');
    window.localStorage.setItem('awaitmsg_locale', 'en');
    try {
      const chat = { id: 'chat-replacement-history-failure', name: 'Replacement history failure chat' };
      const future = new Date(Date.now() + 60 * 60 * 1000);
      const date = `${future.getFullYear()}-${String(future.getMonth() + 1).padStart(2, '0')}-${String(future.getDate()).padStart(2, '0')}`;
      const time = `${String(future.getHours()).padStart(2, '0')}:${String(future.getMinutes()).padStart(2, '0')}`;
      const original: ScheduledMessage = {
        id: 'replacement-original',
        telegramMessageId: 'telegram-original-replacement',
        chatId: chat.id,
        chatName: chat.name,
        text: 'Original schedule',
        when: new Date(future.getTime() + 30 * 60 * 1000).toISOString(),
        createdAt: new Date().toISOString(),
        status: 'scheduled',
      };
      const saveScheduleHistory = vi.fn(async ({ messages }: { messages: ScheduledMessage[] }) => ({
        success: !messages.some((item) => item.text === 'Replacement text'
          && item.telegramMessageId === 'telegram-confirmed-replacement'
          && item.status === 'scheduled'),
        error: 'Disk full',
      }));
      const schedule = vi.fn().mockResolvedValue({
        success: true,
        confirmed: true,
        telegramMessageId: 'telegram-confirmed-replacement',
      });
      const cancel = vi.fn().mockResolvedValue({ success: true });
      const showNotification = vi.fn();
      const { result, loadScheduleHistory } = renderWorkspaceHistory(
        [original],
        [],
        { schedule, cancel, saveScheduleHistory },
        showNotification,
        'workspace',
        chat,
      );

      await waitFor(() => expect(loadScheduleHistory).toHaveBeenCalledWith('workspace'));
      await waitFor(() => expect(result.current.scheduling).toBe(false));
      await act(async () => {
        await result.current.handleSchedule({
          chatId: chat.id,
          message: 'Replacement text',
          date,
          time,
          replaceMessage: original,
        });
      });

      await waitFor(() => expect(result.current.scheduling).toBe(false));
      expect(schedule).toHaveBeenCalledOnce();
      expect(cancel).not.toHaveBeenCalled();
      expect(result.current.upcoming).toContainEqual(expect.objectContaining({
        id: original.id,
        status: 'scheduled',
      }));
      expect(result.current.upcoming).toContainEqual(expect.objectContaining({
        status: 'scheduled',
        replacementOfId: original.id,
        telegramMessageId: 'telegram-confirmed-replacement',
      }));
      expect(showNotification).toHaveBeenCalledWith(
        'Telegram confirmed the schedule, but its history could not be saved. Check the queue before retrying.',
        'warning',
        'Error',
      );
    } finally {
      if (previousLocale === null) window.localStorage.removeItem('awaitmsg_locale');
      else window.localStorage.setItem('awaitmsg_locale', previousLocale);
    }
  })

  it('schedules each attachment group as a separate Telegram message', async () => {
    const chat = { id: 'chat-album-groups', name: 'Album group chat' };
    const future = new Date(Date.now() + 60 * 60 * 1000);
    const date = `${future.getFullYear()}-${String(future.getMonth() + 1).padStart(2, '0')}-${String(future.getDate()).padStart(2, '0')}`;
    const time = `${String(future.getHours()).padStart(2, '0')}:${String(future.getMinutes()).padStart(2, '0')}`;
    const schedule = vi.fn()
      .mockResolvedValueOnce({ success: true, confirmed: true, telegramMessageId: 'telegram-album-1' })
      .mockResolvedValueOnce({ success: true, confirmed: true, telegramMessageId: 'telegram-album-2' });
    const entities: RichTextEntity[] = [{ type: 'bold', offset: 0, length: 7 }];
    const { result } = renderWorkspaceHistory([], [], { schedule }, vi.fn(), 'workspace', chat);

    await waitFor(() => expect(result.current.scheduling).toBe(false));
    await act(async () => {
      result.current.handleSchedule({
        chatId: chat.id,
        message: 'Caption',
        date,
        time,
        attachments: ['one.png', 'two.png', 'three.png'],
        attachmentGroups: [['one.png', 'two.png'], ['three.png']],
        entities,
      });
    });

    await waitFor(() => expect(schedule).toHaveBeenCalledTimes(2), { timeout: 5000 });
    expect(schedule.mock.calls.map(([request]) => request)).toEqual([
      expect.objectContaining({ message: 'Caption', attachments: ['one.png', 'two.png'], entities }),
      expect.objectContaining({ message: '', attachments: ['three.png'], entities: [] }),
    ]);
    await waitFor(() => expect(result.current.upcoming.filter((item) => item.status === 'scheduled')).toHaveLength(2));
  })

  it('keeps partial fallback IDs in history and sends all of them on manual cancel retry', async () => {
    const chat = { id: 'chat-1', name: 'Test chat' };
    const future = new Date(Date.now() + 60 * 60 * 1000);
    const date = `${future.getFullYear()}-${String(future.getMonth() + 1).padStart(2, '0')}-${String(future.getDate()).padStart(2, '0')}`;
    const time = `${String(future.getHours()).padStart(2, '0')}:${String(future.getMinutes()).padStart(2, '0')}`;
    const telegramMessageIds = ['telegram-partial-1', 'telegram-partial-2'];
    const schedule = vi.fn().mockResolvedValue({
      success: false,
      error: 'Some attachments could not be scheduled.',
      telegramMessageId: telegramMessageIds[0],
      telegramMessageIds,
    });
    const cancel = vi.fn().mockResolvedValue({ success: true, alreadySent: false });
    const saveScheduleHistory = vi.fn().mockResolvedValue({ success: true });
    const { result } = renderWorkspaceHistory(
      [],
      [],
      { schedule, cancel, saveScheduleHistory },
      vi.fn(),
      'workspace',
      chat,
    );

    await waitFor(() => expect(result.current.scheduling).toBe(false));
    await act(async () => {
      result.current.handleSchedule({
        chatId: chat.id,
        message: '',
        date,
        time,
        attachments: ['C:/demo/one.png', 'C:/demo/two.png'],
      });
    });

    await waitFor(() => expect(result.current.upcoming[0]).toMatchObject({
      status: 'failed',
      telegramMessageId: telegramMessageIds[0],
      telegramMessageIds,
      retryAction: 'cancel',
    }));
    expect(saveScheduleHistory).toHaveBeenCalledWith(expect.objectContaining({
      field: 'upcoming',
      messages: expect.arrayContaining([expect.objectContaining({ telegramMessageIds })]),
    }));

    await act(async () => {
      await result.current.handleRetry(result.current.upcoming[0]);
    });

    expect(cancel).toHaveBeenCalledWith(expect.objectContaining({
      chatId: chat.id,
      telegramMessageId: telegramMessageIds[0],
      telegramMessageIds,
    }));
    expect(result.current.upcoming).toHaveLength(0);
    expect(schedule).toHaveBeenCalledOnce();
  })

  it('retains partial IDs when Retry leaves cleanup work for Cancel', async () => {
    const chat = { id: 'chat-1', name: 'Test chat' };
    const scheduled: ScheduledMessage = {
      id: 'failed-schedule-retry',
      chatId: chat.id,
      chatName: chat.name,
      text: '',
      when: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      createdAt: new Date().toISOString(),
      status: 'failed',
      retryAction: 'schedule',
      attachments: ['one.png', 'two.png', 'three.png'],
    };
    const telegramMessageIds = ['telegram-left-1', 'telegram-left-2'];
    const schedule = vi.fn().mockResolvedValue({
      success: false,
      error: 'Cleanup did not remove all scheduled files.',
      telegramMessageId: telegramMessageIds[0],
      telegramMessageIds,
    });
    const cancel = vi.fn().mockResolvedValue({ success: true, alreadySent: false });
    const { result } = renderWorkspaceHistory([scheduled], [], { schedule, cancel }, vi.fn(), 'workspace', chat);

    await waitFor(() => expect(result.current.upcoming).toEqual([scheduled]));
    await act(async () => {
      await result.current.handleRetry(scheduled);
    });

    expect(result.current.upcoming[0]).toMatchObject({
      status: 'failed',
      retryAction: 'cancel',
      telegramMessageId: telegramMessageIds[0],
      telegramMessageIds,
    });

    await act(async () => {
      await result.current.handleRetry(result.current.upcoming[0]);
    });

    expect(cancel).toHaveBeenCalledWith(expect.objectContaining({
      telegramMessageId: telegramMessageIds[0],
      telegramMessageIds,
    }));
    expect(result.current.upcoming).toHaveLength(0);
  })

  it('dedupes equal attachment content supplied through different paths', async () => {
    const chat = { id: 'chat-1', name: 'Test chat' };
    const future = new Date(Date.now() + 60 * 60 * 1000);
    const date = `${future.getFullYear()}-${String(future.getMonth() + 1).padStart(2, '0')}-${String(future.getDate()).padStart(2, '0')}`;
    const time = `${String(future.getHours()).padStart(2, '0')}:${String(future.getMinutes()).padStart(2, '0')}`;
    const when = new Date(`${date}T${time}`).toISOString();
    const existing: ScheduledMessage = {
      id: 'existing-media-operation',
      chatId: chat.id,
      chatName: chat.name,
      text: 'Same media operation',
      when,
      createdAt: new Date().toISOString(),
      status: 'scheduled',
      attachments: ['C:/first/same.bin'],
    };
    const getScheduleIdentities = vi.fn(async (operations: Array<Record<string, unknown>>) => ({
      success: true,
      identities: operations.map(() => 'stable:same-media-operation'),
    }));
    const schedule = vi.fn();
    const showNotification = vi.fn();
    const { result } = renderWorkspaceHistory(
      [existing],
      [],
      { getScheduleIdentities, schedule },
      showNotification,
      'workspace',
      chat,
    );

    await waitFor(() => expect(result.current.scheduling).toBe(false));
    await act(async () => {
      await result.current.handleSchedule({
        chatId: chat.id,
        message: existing.text,
        date,
        time,
        attachments: ['D:/second/same.bin'],
      });
    });

    expect(getScheduleIdentities).toHaveBeenCalledOnce();
    expect(schedule).not.toHaveBeenCalled();
    expect(result.current.upcoming).toHaveLength(1);
    expect(result.current.upcoming[0].operationIdentity).toBe('stable:same-media-operation');
    expect(showNotification).toHaveBeenCalledWith(expect.any(String), 'warning', expect.any(String));
  })

  it('does not schedule when a comparable legacy attachment identity cannot be verified', async () => {
    const chat = { id: 'chat-1', name: 'Test chat' };
    const future = new Date(Date.now() + 60 * 60 * 1000);
    const date = `${future.getFullYear()}-${String(future.getMonth() + 1).padStart(2, '0')}-${String(future.getDate()).padStart(2, '0')}`;
    const time = `${String(future.getHours()).padStart(2, '0')}:${String(future.getMinutes()).padStart(2, '0')}`;
    const when = new Date(`${date}T${time}`).toISOString();
    const existing: ScheduledMessage = {
      id: 'legacy-unreadable-media',
      chatId: chat.id,
      chatName: chat.name,
      text: 'Same media operation',
      when,
      createdAt: new Date().toISOString(),
      status: 'scheduled',
      attachments: ['C:/missing/legacy.bin'],
    };
    const getScheduleIdentities = vi.fn().mockResolvedValue({
      success: true,
      identities: ['stable:new-operation', null],
    });
    const schedule = vi.fn();
    const showNotification = vi.fn();
    const { result } = renderWorkspaceHistory(
      [existing],
      [],
      { getScheduleIdentities, schedule },
      showNotification,
      'workspace',
      chat,
    );

    await waitFor(() => expect(result.current.scheduling).toBe(false));
    await act(async () => {
      await result.current.handleSchedule({
        chatId: chat.id,
        message: existing.text,
        date,
        time,
        attachments: ['C:/missing/legacy.bin'],
      });
    });

    expect(schedule).not.toHaveBeenCalled();
    expect(result.current.upcoming).toEqual([existing]);
    expect(showNotification).toHaveBeenCalledWith(
      expect.any(String),
      'warning',
      expect.any(String),
      expect.objectContaining({ operation: 'validate', category: 'validation', retryable: false, code: 'LEGACY_MEDIA_IDENTITY_UNAVAILABLE' }),
    );
  })

  it('keeps a stored identity immutable when its attachment path later changes', async () => {
    const chat = { id: 'chat-1', name: 'Test chat' };
    const future = new Date(Date.now() + 60 * 60 * 1000);
    const date = `${future.getFullYear()}-${String(future.getMonth() + 1).padStart(2, '0')}-${String(future.getDate()).padStart(2, '0')}`;
    const time = `${String(future.getHours()).padStart(2, '0')}:${String(future.getMinutes()).padStart(2, '0')}`;
    const when = new Date(`${date}T${time}`).toISOString();
    const existing: ScheduledMessage = {
      id: 'original-file-operation',
      chatId: chat.id,
      chatName: chat.name,
      text: 'Same media operation',
      when,
      createdAt: new Date().toISOString(),
      status: 'scheduled',
      attachments: ['C:/same/mutable.bin'],
      operationIdentity: 'stable:original-content',
    };
    const getScheduleIdentities = vi.fn()
      .mockResolvedValueOnce({ success: true, identities: ['stable:preflight-content'] })
      .mockResolvedValueOnce({ success: true, identities: ['stable:actual-content'] });
    const schedule = vi.fn().mockResolvedValue({
      success: true,
      confirmed: true,
      telegramMessageId: 'telegram-new-content',
      operationIdentity: 'stable:actual-content',
    });
    const { result } = renderWorkspaceHistory(
      [existing],
      [],
      { getScheduleIdentities, schedule },
      vi.fn(),
      'workspace',
      chat,
    );

    await waitFor(() => expect(result.current.scheduling).toBe(false));
    await act(async () => {
      await result.current.handleSchedule({
        chatId: chat.id,
        message: existing.text,
        date,
        time,
        attachments: ['C:/same/mutable.bin'],
      });
    });

    await waitFor(() => expect(result.current.upcoming).toHaveLength(2));
    const newlyScheduled = result.current.upcoming.find((item) => item.id !== existing.id)!;
    expect(newlyScheduled.operationIdentity).toBe('stable:actual-content');
    expect(schedule).toHaveBeenCalledOnce();

    await act(async () => {
      await result.current.handleSchedule({
        chatId: chat.id,
        message: existing.text,
        date,
        time,
        attachments: ['C:/same/mutable.bin'],
      });
    });

    expect(schedule).toHaveBeenCalledOnce();
    expect(result.current.upcoming).toHaveLength(2);
  })

  it('updates a retried schedule identity to the key used for changed attachment bytes', async () => {
    const chat = { id: 'chat-1', name: 'Test chat' };
    const failed: ScheduledMessage = {
      id: 'failed-media-operation',
      operationId: 'failed-media-operation',
      chatId: chat.id,
      chatName: chat.name,
      text: 'Retry changed media',
      when: '2035-01-15T19:00:00.000Z',
      createdAt: '2035-01-14T18:30:00.000Z',
      status: 'failed',
      retryAction: 'schedule',
      attachments: ['C:/same/mutable.bin'],
      operationIdentity: 'stable:original-content',
    };
    const schedule = vi.fn().mockResolvedValue({
      success: true,
      confirmed: true,
      telegramMessageId: 'telegram-updated-content',
      operationIdentity: 'stable:changed-content',
    });
    const { result } = renderWorkspaceHistory([failed], [], { schedule }, vi.fn(), 'workspace', chat);

    await waitFor(() => expect(result.current.upcoming).toEqual([failed]));
    await act(async () => {
      await result.current.handleRetry(failed);
    });

    expect(result.current.upcoming[0]).toMatchObject({
      status: 'scheduled',
      telegramMessageId: 'telegram-updated-content',
      operationIdentity: 'stable:changed-content',
    });
  })

  it('cancels one distinct operation without leaving the other row stale', async () => {
    const chat = { id: 'chat-1', name: 'Test chat' };
    const future = new Date(Date.now() + 60 * 60 * 1000);
    const date = `${future.getFullYear()}-${String(future.getMonth() + 1).padStart(2, '0')}-${String(future.getDate()).padStart(2, '0')}`;
    const time = `${String(future.getHours()).padStart(2, '0')}:${String(future.getMinutes()).padStart(2, '0')}`;
    const schedule = vi.fn(async (operation: { entities?: unknown[]; effect?: string }) => ({
      success: true,
      confirmed: true,
      telegramMessageId: operation.effect ? 'telegram-effect-operation' : 'telegram-entity-operation',
    }));
    const cancel = vi.fn().mockResolvedValue({ success: true });
    const { result } = renderWorkspaceHistory([], [], { schedule, cancel }, vi.fn(), 'workspace', chat);

    await waitFor(() => expect(result.current.scheduling).toBe(false));
    await act(async () => {
      await result.current.handleSchedule({
        chatId: chat.id,
        message: 'Same operation text',
        date,
        time,
        entities: [{ type: 'bold', offset: 0, length: 4 }],
      });
    });
    await waitFor(() => expect(result.current.upcoming[0]?.status).toBe('scheduled'));

    await act(async () => {
      await result.current.handleSchedule({
        chatId: chat.id,
        message: 'Same operation text',
        date,
        time,
        effect: '123',
      });
    });
    await waitFor(() => expect(result.current.upcoming).toHaveLength(2));

    const firstOperation = result.current.upcoming.find((item) => item.telegramMessageId === 'telegram-entity-operation')!;
    await act(async () => {
      await result.current.handleCancelMessage(firstOperation);
    });

    expect(cancel).toHaveBeenCalledOnce();
    expect(cancel).toHaveBeenCalledWith(expect.objectContaining({ telegramMessageId: 'telegram-entity-operation' }));
    expect(result.current.upcoming).toHaveLength(1);
    expect(result.current.upcoming[0]).toMatchObject({
      status: 'scheduled',
      telegramMessageId: 'telegram-effect-operation',
    });
  })
});
