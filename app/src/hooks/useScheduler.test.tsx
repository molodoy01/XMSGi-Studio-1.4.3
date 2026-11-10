import { renderHook, waitFor } from '@testing-library/react';
import type { PropsWithChildren } from 'react';
import { expect, it, vi, afterEach, describe } from 'vitest';
import { LocaleProvider } from '@/lib/i18n';
import type { ScheduledMessage } from '@/types';
import { useScheduler } from './useScheduler';
import { renderWorkspaceHistory } from './useScheduler.testUtils';

describe("useScheduler history restoration and recovery", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('restores workspace messages and preserves the selected local time', async () => {
    const selectedLocalTime = new Date(2035, 0, 15, 17, 42, 0, 0);
    const when = selectedLocalTime.toISOString();
    const upcoming: ScheduledMessage[] = [{
      id: 'workspace-scheduled-1',
      operationId: 'workspace-scheduled-1',
      chatId: 'chat-1',
      chatName: 'Test chat',
      text: 'Stage A timezone check',
      when,
      createdAt: new Date().toISOString(),
      status: 'scheduled',
    }];
    const saveScheduleHistory = vi.fn().mockResolvedValue({ success: true });
    const loadScheduleHistory = vi.fn().mockResolvedValue({
      success: true,
      history: { upcoming, sent: [] },
      needsMigration: false,
    });
    vi.stubGlobal('telegram', { loadScheduleHistory, saveScheduleHistory });

    const wrapper = ({ children }: PropsWithChildren) => <LocaleProvider>{children}</LocaleProvider>;
    const { result } = renderHook(() => useScheduler({
      historyScope: 'workspace',
      connected: false,
      selectedChat: null,
      chats: [],
      message: '',
      showNotification: vi.fn(),
      setMessage: vi.fn(),
    }), { wrapper });

    await waitFor(() => expect(result.current.upcoming).toEqual(upcoming));

    const restoredTime = new Date(result.current.upcoming[0].when);
    expect([restoredTime.getFullYear(), restoredTime.getMonth(), restoredTime.getDate(), restoredTime.getHours(), restoredTime.getMinutes()])
      .toEqual([2035, 0, 15, 17, 42]);
    expect(loadScheduleHistory).toHaveBeenCalledWith('workspace');
    expect(saveScheduleHistory).not.toHaveBeenCalled();
  })

  it('exposes a failed history restore separately from a successfully empty history', async () => {
    const restoreError = new Error('History service unavailable');
    const showNotification = vi.fn();
    const { result } = renderWorkspaceHistory([], [], {
      loadScheduleHistory: vi.fn().mockRejectedValue(restoreError),
    }, showNotification);

    await waitFor(() => expect(result.current.historyReady).toBe(true));

    expect(result.current.historyLoadError).toBe(restoreError.message);
    expect(result.current.sent).toEqual([]);
    expect(showNotification).toHaveBeenCalledWith(
      restoreError.message,
      'error',
      expect.any(String),
    );
  })

  it('uses workspace-scoped local history when native history is unavailable', async () => {
    const storageKeys = [
      'awaitmsg_upcoming',
      'awaitmsg_workspace_upcoming',
      'awaitmsg_sent',
      'awaitmsg_workspace_sent',
    ];
    const previousValues = new Map(storageKeys.map((key) => [key, window.localStorage.getItem(key)]));
    const personalMessage: ScheduledMessage = {
      id: 'personal-only',
      chatId: 'personal-chat',
      chatName: 'Personal',
      text: 'Personal',
      when: '2035-01-15T17:42:00.000Z',
      createdAt: '2035-01-15T16:42:00.000Z',
      status: 'scheduled',
    };
    const workspaceMessage: ScheduledMessage = {
      id: 'workspace-only',
      chatId: 'workspace-chat',
      chatName: 'Workspace',
      text: 'Workspace',
      when: '2035-01-15T17:42:00.000Z',
      createdAt: '2035-01-15T16:42:00.000Z',
      status: 'scheduled',
    };
    window.localStorage.setItem('awaitmsg_upcoming', JSON.stringify([personalMessage]));
    window.localStorage.setItem('awaitmsg_workspace_upcoming', JSON.stringify([workspaceMessage]));
    window.localStorage.setItem('awaitmsg_sent', JSON.stringify([]));
    window.localStorage.setItem('awaitmsg_workspace_sent', JSON.stringify([]));
    vi.stubGlobal('telegram', {});

    const wrapper = ({ children }: PropsWithChildren) => <LocaleProvider>{children}</LocaleProvider>;
    const { result, unmount } = renderHook(() => useScheduler({
      historyScope: 'workspace',
      connected: false,
      selectedChat: null,
      chats: [],
      message: '',
      showNotification: vi.fn(),
      setMessage: vi.fn(),
    }), { wrapper });

    try {
      await waitFor(() => expect(result.current.scheduling).toBe(false));
      expect(result.current.upcoming).toEqual([workspaceMessage]);
      expect(result.current.sent).toEqual([]);
    } finally {
      unmount();
      for (const [key, value] of previousValues) {
        if (value === null) window.localStorage.removeItem(key);
        else window.localStorage.setItem(key, value);
      }
    }
  })

  it('restores Personal records from the separate personal history scope', async () => {
    const personalRecord: ScheduledMessage = {
      id: 'personal-restart-1',
      chatId: 'chat-1',
      chatName: 'Personal chat',
      text: 'Restore Personal history',
      when: '2035-01-15T17:42:00.000Z',
      createdAt: '2035-01-15T16:42:00.000Z',
      status: 'scheduled',
    };
    const { result, loadScheduleHistory } = renderWorkspaceHistory([personalRecord], [], {}, vi.fn(), 'personal');

    await waitFor(() => expect(result.current.upcoming).toEqual([personalRecord]));
    expect(loadScheduleHistory).toHaveBeenCalledWith('personal');
  })

  it('reconciles an overdue Pending operation as Scheduled without scheduling it again', async () => {
    const pending: ScheduledMessage = {
      id: 'overdue-pending-scheduled',
      operationId: 'pending-operation-1',
      chatId: 'chat-1',
      chatName: 'Test chat',
      text: 'Still scheduled in Telegram',
      when: new Date(Date.now() - 10 * 60_000).toISOString(),
      createdAt: new Date(Date.now() - 60 * 60_000).toISOString(),
      status: 'pending',
    };
    const reconcilePendingSchedule = vi.fn().mockResolvedValue({
      success: true,
      state: 'scheduled',
      telegramMessageId: '42001',
      telegramMessageIds: ['42001'],
    });
    const schedule = vi.fn();
    const { result, saveScheduleHistory } = renderWorkspaceHistory(
      [pending],
      [],
      { reconcilePendingSchedule, schedule },
    );

    await waitFor(() => expect(result.current.upcoming).toMatchObject([{
      id: pending.id,
      status: 'scheduled',
      telegramMessageId: '42001',
    }]));
    expect(reconcilePendingSchedule).toHaveBeenCalledWith(expect.objectContaining({
      chatId: pending.chatId,
      message: pending.text,
      telegramMessageIds: [],
    }));
    expect(schedule).not.toHaveBeenCalled();
    expect(saveScheduleHistory).toHaveBeenCalledWith(expect.objectContaining({
      scope: 'workspace',
      field: 'snapshot',
      messages: expect.objectContaining({
        upcoming: [expect.objectContaining({ id: pending.id, status: 'scheduled' })],
      }),
    }));
  })

  it('keeps an unlinked sent response Pending instead of trusting its message ID or sentAt', async () => {
    const pending: ScheduledMessage = {
      id: 'overdue-pending-sent',
      chatId: 'chat-1',
      chatName: 'Test chat',
      text: 'Already sent by Telegram',
      when: new Date(Date.now() - 10 * 60_000).toISOString(),
      createdAt: new Date(Date.now() - 60 * 60_000).toISOString(),
      status: 'pending',
    };
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const reconcilePendingSchedule = vi.fn().mockResolvedValue({
      success: true,
      state: 'sent',
      telegramMessageId: 'telegram-sent-1',
      sentAt: '2035-01-15T18:01:30.000Z',
    });
    const schedule = vi.fn();
    const send = vi.fn();
    const { result } = renderWorkspaceHistory(
      [pending],
      [],
      { reconcilePendingSchedule, schedule, send },
    );

    await waitFor(() => expect(reconcilePendingSchedule).toHaveBeenCalledOnce());
    expect(result.current.upcoming).toMatchObject([{ id: pending.id, status: 'pending' }]);
    expect(result.current.sent).toEqual([]);
    expect(schedule).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
    expect(consoleError).toHaveBeenCalledWith(
      'Telegram returned an unsupported or unlinked reconciliation state.',
      'sent',
    );
  })

  it('keeps an overdue operation Pending when Telegram lists provide no proof it was rejected', async () => {
    const pending: ScheduledMessage = {
      id: 'overdue-pending-unknown',
      chatId: 'chat-1',
      chatName: 'Test chat',
      text: 'State not present in available lists',
      when: new Date(Date.now() - 10 * 60_000).toISOString(),
      createdAt: new Date(Date.now() - 60 * 60_000).toISOString(),
      status: 'pending',
    };
    const reconcilePendingSchedule = vi.fn().mockResolvedValue({ state: 'unknown' });
    const schedule = vi.fn();
    const send = vi.fn();
    const { result } = renderWorkspaceHistory(
      [pending],
      [],
      { reconcilePendingSchedule, schedule, send },
    );

    await waitFor(() => expect(reconcilePendingSchedule).toHaveBeenCalledOnce());

    expect(result.current.upcoming).toMatchObject([{ id: pending.id, status: 'pending' }]);
    expect(result.current.sent).toEqual([]);
    expect(schedule).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
  })

  it('retains Pending after a network failure during Telegram reconciliation', async () => {
    const pending: ScheduledMessage = {
      id: 'overdue-pending-network-error',
      chatId: 'chat-1',
      chatName: 'Test chat',
      text: 'Telegram unavailable',
      when: new Date(Date.now() - 10 * 60_000).toISOString(),
      createdAt: new Date(Date.now() - 60 * 60_000).toISOString(),
      status: 'pending',
    };
    const reconcilePendingSchedule = vi.fn().mockRejectedValue(new Error('Telegram timeout'));
    const schedule = vi.fn();
    const send = vi.fn();
    const { result } = renderWorkspaceHistory(
      [pending],
      [],
      { reconcilePendingSchedule, schedule, send },
    );

    await waitFor(() => expect(reconcilePendingSchedule).toHaveBeenCalledOnce());

    expect(result.current.upcoming).toMatchObject([{ id: pending.id, status: 'pending' }]);
    expect(schedule).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
  })

  it('keeps an ambiguous Telegram response Pending and does not repeat the operation', async () => {
    const pending: ScheduledMessage = {
      id: 'overdue-pending-ambiguous',
      chatId: 'chat-1',
      chatName: 'Test chat',
      text: 'Ambiguous Telegram result',
      when: new Date(Date.now() - 10 * 60_000).toISOString(),
      createdAt: new Date(Date.now() - 60 * 60_000).toISOString(),
      status: 'pending',
    };
    const reconcilePendingSchedule = vi.fn().mockResolvedValue({ success: true });
    const schedule = vi.fn();
    const send = vi.fn();
    const { result } = renderWorkspaceHistory(
      [pending],
      [],
      { reconcilePendingSchedule, schedule, send },
    );

    await waitFor(() => expect(reconcilePendingSchedule).toHaveBeenCalledOnce());

    expect(result.current.upcoming).toMatchObject([{ id: pending.id, status: 'pending' }]);
    expect(schedule).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
  })

  it('keeps Pending when the bridge returns an unknown reconciliation status', async () => {
    const pending: ScheduledMessage = {
      id: 'overdue-pending-invalid-state',
      chatId: 'chat-1',
      chatName: 'Test chat',
      text: 'Unexpected bridge status',
      when: new Date(Date.now() - 10 * 60_000).toISOString(),
      createdAt: new Date(Date.now() - 60 * 60_000).toISOString(),
      status: 'pending',
    };
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const reconcilePendingSchedule = vi.fn().mockResolvedValue({
      success: true,
      state: 'complete',
      telegramMessageId: 'telegram-id',
    });
    const schedule = vi.fn();
    const send = vi.fn();
    const { result } = renderWorkspaceHistory(
      [pending],
      [],
      { reconcilePendingSchedule, schedule, send },
    );

    await waitFor(() => expect(reconcilePendingSchedule).toHaveBeenCalledOnce());

    expect(result.current.upcoming).toMatchObject([{ id: pending.id, status: 'pending' }]);
    expect(result.current.sent).toEqual([]);
    expect(schedule).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
  })

  it('rechecks Pending after a confirmed schedule cannot be saved', async () => {
    const pending: ScheduledMessage = {
      id: 'overdue-pending-save-failure',
      chatId: 'chat-1',
      chatName: 'Test chat',
      text: 'Keep pending on disk when write fails',
      when: new Date(Date.now() - 10 * 60_000).toISOString(),
      createdAt: new Date(Date.now() - 60 * 60_000).toISOString(),
      status: 'pending',
    };
    const showNotification = vi.fn();
    const reconcilePendingSchedule = vi.fn().mockResolvedValue({
      success: true,
      state: 'scheduled',
      telegramMessageId: '42002',
    });
    const failingSave = vi.fn().mockResolvedValue({ success: false, error: 'Disk full' });
    const firstRun = renderWorkspaceHistory(
      [pending],
      [],
      { reconcilePendingSchedule, saveScheduleHistory: failingSave },
      showNotification,
    );

    await waitFor(() => expect(firstRun.result.current.upcoming).toMatchObject([{
      id: pending.id,
      status: 'scheduled',
    }]));
    expect(failingSave).toHaveBeenCalledWith(expect.objectContaining({
      scope: 'workspace',
      field: 'snapshot',
      messages: expect.objectContaining({
        upcoming: [expect.objectContaining({ id: pending.id, status: 'scheduled' })],
      }),
    }));
    expect(showNotification).toHaveBeenCalledWith(
      expect.any(String),
      'warning',
      expect.any(String),
    );
    firstRun.unmount();

    const schedule = vi.fn();
    const send = vi.fn();
    const retryReconciliation = vi.fn().mockResolvedValue({ state: 'unknown' });
    const secondRun = renderWorkspaceHistory(
      [pending],
      [],
      { reconcilePendingSchedule: retryReconciliation, schedule, send },
    );
    await waitFor(() => expect(retryReconciliation).toHaveBeenCalledOnce());

    expect(secondRun.result.current.upcoming).toMatchObject([{ id: pending.id, status: 'pending' }]);
    expect(schedule).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
  })

  it('rechecks the same Pending operation after restart without duplicating it', async () => {
    const pending: ScheduledMessage = {
      id: 'restart-pending-idempotency',
      chatId: 'chat-1',
      chatName: 'Test chat',
      text: 'One operation across restarts',
      when: new Date(Date.now() - 10 * 60_000).toISOString(),
      createdAt: new Date(Date.now() - 60 * 60_000).toISOString(),
      status: 'pending',
    };
    const schedule = vi.fn();
    const send = vi.fn();
    const firstReconciliation = vi.fn().mockResolvedValue({ state: 'unknown' });
    const firstRun = renderWorkspaceHistory(
      [pending],
      [],
      { reconcilePendingSchedule: firstReconciliation, schedule, send },
    );
    await waitFor(() => expect(firstReconciliation).toHaveBeenCalledOnce());
    firstRun.unmount();

    const secondReconciliation = vi.fn().mockResolvedValue({
      success: true,
      state: 'sent',
      telegramMessageId: '42004',
      sentAt: '2035-01-15T18:01:30.000Z',
    });
    const secondRun = renderWorkspaceHistory(
      [pending],
      [],
      { reconcilePendingSchedule: secondReconciliation, schedule, send },
    );
    await waitFor(() => expect(secondReconciliation).toHaveBeenCalledOnce());

    expect(schedule).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
    expect(secondRun.result.current.upcoming).toMatchObject([{ id: pending.id, status: 'pending' }]);
    expect(secondRun.result.current.sent).toEqual([]);
  })

  it('normalizes legacy confirmed records to Scheduled during restore', async () => {
    const legacyRecord: ScheduledMessage = {
      id: 'legacy-confirmed-1',
      chatId: 'chat-1',
      chatName: 'Test chat',
      text: 'Legacy schedule status',
      when: '2035-01-15T17:42:00.000Z',
      createdAt: '2035-01-15T16:42:00.000Z',
      status: 'confirmed',
    };
    const { result } = renderWorkspaceHistory([legacyRecord], [], {});

    await waitFor(() => expect(result.current.upcoming[0]).toMatchObject({
      id: legacyRecord.id,
      status: 'scheduled',
    }));
  })

  it('restores Failed without retrying it or moving it to Sent', async () => {
    const failedMessage: ScheduledMessage = {
      id: 'failed-after-restart',
      chatId: 'chat-1',
      chatName: 'Test chat',
      text: 'Retry after restart',
      when: '2035-01-15T17:42:00.000Z',
      createdAt: '2035-01-15T16:42:00.000Z',
      status: 'failed',
      lastError: 'Telegram rejected the previous attempt.',
      retryAction: 'send',
      sendAttemptId: '1736962920000:stable-attempt',
    };
    const schedule = vi.fn();
    const { result } = renderWorkspaceHistory([failedMessage], [], { schedule });

    await waitFor(() => expect(result.current.upcoming).toEqual([failedMessage]));

    expect(result.current.sent).toHaveLength(0);
    expect(schedule).not.toHaveBeenCalled();
  })

  it('does not mark a scheduled record sent when its time passes', async () => {
    const message: ScheduledMessage = {
      id: 'past-scheduled-1',
      chatId: 'chat-1',
      chatName: 'Test chat',
      text: 'Wait for Telegram confirmation',
      when: new Date(Date.now() - 60_000).toISOString(),
      createdAt: new Date(Date.now() - 120_000).toISOString(),
      status: 'scheduled',
      telegramMessageId: 'telegram-scheduled-1',
    };
    const { result } = renderWorkspaceHistory([message], [], {});

    await waitFor(() => expect(result.current.upcoming).toEqual([message]));

    expect(result.current.sent).toHaveLength(0);
  })
});
