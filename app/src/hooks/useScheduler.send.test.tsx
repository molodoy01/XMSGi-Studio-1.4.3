import { act, waitFor } from '@testing-library/react';
import { expect, it, vi, afterEach, describe } from 'vitest';
import type { RichTextEntity, ScheduledMessage } from '@/types';
import { getCurrentTimeStr, getTodayStr } from '@/lib/utils';
import { renderWorkspaceHistory } from './useScheduler.testUtils';

describe("useScheduler immediate and draft sends", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('allows attachment-only messages to be sent immediately', async () => {
    const chat = { id: 'chat-1', name: 'Test chat' };
    const send = vi.fn().mockResolvedValue({ success: true, telegramMessageId: 501 });
    const { result } = renderWorkspaceHistory([], [], { send }, vi.fn(), 'workspace', chat);

    await waitFor(() => expect(result.current.scheduling).toBe(false));
    await act(async () => {
      result.current.dateEditedRef.current = true;
      result.current.timeEditedRef.current = true;
      result.current.setDate('2035-01-15');
      result.current.setTime('18:30');
      const sent = await result.current.handleSendDraftNow(chat, '', ['C:/demo/demo.pdf']);
      expect(sent).toBe(true);
    });

    expect(result.current.date).toBe(getTodayStr());
    expect(result.current.time).toMatch(/^\d{2}:\d{2}$/);
    expect(result.current.dateEditedRef.current).toBe(false);
    expect(result.current.timeEditedRef.current).toBe(false);
    expect(send).toHaveBeenCalledWith(
      chat.id,
      '',
      ['C:/demo/demo.pdf'],
      [],
      false,
      undefined,
      'account-1',
      expect.stringMatching(/^\d+:[a-z0-9]+$/i),
    );
  })

  it('suppresses completion success feedback when the caller manages the outcome notification', async () => {
    const chat = { id: 'chat-managed-outcome', name: 'Managed outcome chat' };
    const send = vi.fn().mockResolvedValue({ success: true, telegramMessageId: 503 });
    const showNotification = vi.fn();
    const { result } = renderWorkspaceHistory([], [], { send }, showNotification, 'workspace', chat);

    await waitFor(() => expect(result.current.scheduling).toBe(false));
    await act(async () => {
      await expect(result.current.handleSendDraftNow(
        chat,
        'Overlay draft',
        [],
        [],
        false,
        undefined,
        { suppressNotifications: true },
      )).resolves.toBe(true);
    });

    expect(send).toHaveBeenCalledOnce();
    expect(showNotification).not.toHaveBeenCalled();
  })

  it('suppresses send failure toast when the caller displays it in its own status area', async () => {
    const chat = { id: 'chat-managed-send-error', name: 'Managed send error chat' };
    const send = vi.fn().mockResolvedValue({ success: false, error: 'Telegram rejected the message.' });
    const showNotification = vi.fn();
    const { result } = renderWorkspaceHistory([], [], { send }, showNotification, 'workspace', chat);

    await waitFor(() => expect(result.current.scheduling).toBe(false));
    await act(async () => {
      await expect(result.current.handleSendDraftNow(
        chat,
        'Rejected draft',
        [],
        [],
        false,
        undefined,
        { suppressNotifications: true },
      )).resolves.toBe(false);
    });

    expect(send).toHaveBeenCalledOnce();
    expect(showNotification).not.toHaveBeenCalled();
  })

  it('clears the sending state for text sends with an empty attachment-groups array', async () => {
    const chat = { id: 'chat-empty-attachment-groups', name: 'Text chat' };
    const send = vi.fn().mockResolvedValue({ success: true, telegramMessageId: 502 });
    const { result } = renderWorkspaceHistory([], [], { send }, vi.fn(), 'workspace', chat);

    await waitFor(() => expect(result.current.scheduling).toBe(false));
    await act(async () => {
      await expect(result.current.handleSendDraftNow(
        chat,
        'Send text',
        [],
        [],
        false,
        undefined,
        {},
        [],
      )).resolves.toBe(true);
    });

    expect(send).toHaveBeenCalledOnce();
    expect(result.current.publishingDraft).toBe(false);
  })

  it('does not report success or clear a confirmed send when its history write fails', async () => {
    const previousLocale = window.localStorage.getItem('awaitmsg_locale');
    window.localStorage.setItem('awaitmsg_locale', 'en');
    try {
      const chat = { id: 'chat-send-history-failure', name: 'Send history failure chat' };
      const send = vi.fn().mockResolvedValue({ success: true, telegramMessageId: 1 });
      let resolveSnapshot!: (result: { success: boolean; error?: string }) => void;
      const saveScheduleHistory = vi.fn(({ field }: { field: string }) => field === 'snapshot'
        ? new Promise<{ success: boolean; error?: string }>((resolve) => { resolveSnapshot = resolve; })
        : Promise.resolve({ success: true }));
      const showNotification = vi.fn();
      const setMessage = vi.fn();
      const { result, loadScheduleHistory } = renderWorkspaceHistory(
        [],
        [],
        { send, saveScheduleHistory },
        showNotification,
        'workspace',
        chat,
        setMessage,
      );

      await waitFor(() => expect(loadScheduleHistory).toHaveBeenCalledWith('workspace'));
      await waitFor(() => expect(result.current.scheduling).toBe(false));
      let sendPromise!: Promise<boolean | 'sent-history-failed'>;
      await act(async () => {
        sendPromise = result.current.handleSendDraftNow(chat, 'Send exactly once');
        await waitFor(() => expect(saveScheduleHistory).toHaveBeenCalledWith(expect.objectContaining({ field: 'snapshot' })));
      });

      expect(send).toHaveBeenCalledOnce();
      await act(async () => {
        resolveSnapshot({ success: false, error: 'Disk full' });
        await expect(sendPromise).resolves.toBe('sent-history-failed');
      });
      expect(result.current.sent).toHaveLength(1);
      expect(result.current.publishingDraft).toBe(false);
      expect(setMessage).not.toHaveBeenCalledWith('');
      expect(showNotification).not.toHaveBeenCalledWith('Message sent to Telegram.', 'success', 'Sent');
      expect(showNotification).toHaveBeenCalledWith(
        'Message history could not be saved. It may return after the app restarts.',
        'warning',
        'Error',
      );
    } finally {
      if (previousLocale === null) window.localStorage.removeItem('awaitmsg_locale');
      else window.localStorage.setItem('awaitmsg_locale', previousLocale);
    }
  })

  it('does not clear a confirmed grouped send when a group history commit fails', async () => {
    const previousLocale = window.localStorage.getItem('awaitmsg_locale');
    window.localStorage.setItem('awaitmsg_locale', 'en');
    try {
      const chat = { id: 'chat-group-history-failure', name: 'Grouped history failure chat' };
      const send = vi.fn()
        .mockResolvedValueOnce({ success: true, telegramMessageId: 11 })
        .mockResolvedValueOnce({ success: true, telegramMessageId: 12 });
      const saveScheduleHistory = vi.fn(async ({ field }: { field: string }) => ({
        success: field !== 'snapshot',
        error: 'Disk full',
      }));
      const showNotification = vi.fn();
      const setMessage = vi.fn();
      const onAttachmentGroupResult = vi.fn();
      const { result, loadScheduleHistory } = renderWorkspaceHistory(
        [],
        [],
        { send, saveScheduleHistory },
        showNotification,
        'workspace',
        chat,
        setMessage,
      );

      await waitFor(() => expect(loadScheduleHistory).toHaveBeenCalledWith('workspace'));
      await act(async () => {
        await expect(result.current.handleSendDraftNow(
          chat,
          'Grouped send',
          ['first-media', 'second-media'],
          [],
          false,
          undefined,
          {},
          [['first-media'], ['second-media']],
          onAttachmentGroupResult,
        )).resolves.toBe('sent-history-failed');
      });

      expect(send).toHaveBeenCalledTimes(2);
      expect(onAttachmentGroupResult.mock.calls).toEqual([[0, true], [1, true]]);
      expect(setMessage).not.toHaveBeenCalledWith('');
      expect(showNotification).toHaveBeenCalledWith(
        'Message history could not be saved. It may return after the app restarts.',
        'warning',
        'Error',
      );
      expect(showNotification).not.toHaveBeenCalledWith('Message sent to Telegram.', 'success', 'Sent');
    } finally {
      if (previousLocale === null) window.localStorage.removeItem('awaitmsg_locale');
      else window.localStorage.setItem('awaitmsg_locale', previousLocale);
    }
  })

  it('keeps a single sending status while a multi-album draft is sent in groups', async () => {
    const chat = { id: 'chat-send-album-groups', name: 'Album send chat' };
    let resolveFirst!: (value: { success: boolean; telegramMessageIds: number[]; telegramMessageId: number }) => void;
    let resolveSecond!: (value: { success: boolean; telegramMessageId: number }) => void;
    const send = vi.fn()
      .mockImplementationOnce(() => new Promise<{ success: boolean; telegramMessageIds: number[]; telegramMessageId: number }>((resolve) => { resolveFirst = resolve; }))
      .mockImplementationOnce(() => new Promise<{ success: boolean; telegramMessageId: number }>((resolve) => { resolveSecond = resolve; }));
    const showNotification = vi.fn();
    const onAttachmentGroupResult = vi.fn();
    const { result } = renderWorkspaceHistory([], [], { send }, showNotification, 'workspace', chat);

    await waitFor(() => expect(result.current.scheduling).toBe(false));
    let batchPromise!: Promise<boolean | 'sent-history-failed'>;
    await act(async () => {
      batchPromise = result.current.handleSendDraftNow(
        chat,
        'Caption',
        ['one.png', 'two.png', 'three.png'],
        [],
        [['one.png', 'two.png'], ['three.png']],
        undefined,
        {},
        [['one.png', 'two.png'], ['three.png']],
        onAttachmentGroupResult,
      );
      await waitFor(() => expect(send).toHaveBeenCalledTimes(1));
    });

    expect(result.current.publishingDraft).toBe(true);
    await act(async () => {
      resolveFirst({ success: true, telegramMessageId: 1, telegramMessageIds: [1, 2] });
      await waitFor(() => expect(send).toHaveBeenCalledTimes(2));
    });
    expect(result.current.publishingDraft).toBe(true);
    expect(result.current.successPulse).toBe(false);
    expect(showNotification).not.toHaveBeenCalled();

    await act(async () => {
      resolveSecond({ success: true, telegramMessageId: 3 });
      await expect(batchPromise).resolves.toBe(true);
    });
    expect(result.current.publishingDraft).toBe(false);
    expect(result.current.successPulse).toBe(true);
    expect(showNotification).toHaveBeenCalledTimes(1);
    expect(onAttachmentGroupResult.mock.calls).toEqual([[0, true], [1, true]]);
    expect(send).toHaveBeenCalledTimes(2);
  })

  it('stops a grouped send at the first failure and reports later groups as unattempted', async () => {
    const chat = { id: 'chat-send-album-partial', name: 'Partial album chat' };
    const send = vi.fn()
      .mockResolvedValueOnce({ success: true, telegramMessageId: 1, telegramMessageIds: [1, 2] })
      .mockResolvedValueOnce({ success: false, error: 'Album upload failed.' });
    const showNotification = vi.fn();
    const onAttachmentGroupResult = vi.fn();
    const { result } = renderWorkspaceHistory([], [], { send }, showNotification, 'workspace', chat);
    const groups = [['one.png', 'two.png'], ['three.png'], ['four.png']];

    await waitFor(() => expect(result.current.scheduling).toBe(false));
    let sent: boolean | 'sent-history-failed' = true;
    await act(async () => {
      sent = await result.current.handleSendDraftNow(
        chat,
        'Caption',
        groups.flat(),
        [],
        groups,
        undefined,
        {},
        groups,
        onAttachmentGroupResult,
      );
    });

    expect(sent).toBe(false);
    expect(send).toHaveBeenCalledTimes(2);
    expect(onAttachmentGroupResult.mock.calls).toEqual([[0, true], [1, false], [2, false]]);
    expect(result.current.sent).toHaveLength(1);
    expect(result.current.sent[0].attachments).toEqual(groups[0]);
    expect(result.current.publishingDraft).toBe(false);
    expect(showNotification).toHaveBeenCalledTimes(1);
    expect(showNotification.mock.calls[0][1]).toBe('warning');
    expect(result.current.successPulse).toBe(false);
  })

  it('sends each attachment group separately and keeps the caption on the first group', async () => {
    const chat = { id: 'chat-send-album-groups', name: 'Album send chat' };
    const send = vi.fn()
      .mockResolvedValueOnce({ success: true, telegramMessageId: 1, telegramMessageIds: [1, 2] })
      .mockResolvedValueOnce({ success: true, telegramMessageId: 3 });
    const entities: RichTextEntity[] = [{ type: 'bold', offset: 0, length: 7 }];
    const setMessage = vi.fn();
    const { result } = renderWorkspaceHistory([], [], { send }, vi.fn(), 'workspace', chat, setMessage);

    await waitFor(() => expect(result.current.scheduling).toBe(false));
    await act(async () => {
      const sent = await result.current.handleSendDraftNow(
        chat,
        'Caption',
        ['one.png', 'two.png', 'three.png'],
        entities,
        [['one.png', 'two.png'], ['three.png']],
      );
      expect(sent).toBe(true);
    });

    expect(send).toHaveBeenCalledTimes(2);
    expect(send.mock.calls.map((call) => call.slice(0, 6))).toEqual([
      [chat.id, 'Caption', ['one.png', 'two.png'], entities, false, undefined],
      [chat.id, '', ['three.png'], [], false, undefined],
    ]);
    expect(setMessage).toHaveBeenCalledOnce();
    expect(setMessage).toHaveBeenCalledWith('');
  })

  it('keeps composer attachments and entities when scheduling for the current minute', async () => {
    const chat = { id: 'chat-current-minute', name: 'Current minute chat' };
    const attachments = ['C:/demo/photo.jpg'];
    const entities: RichTextEntity[] = [{ type: 'bold', offset: 0, length: 5 }];
    const send = vi.fn().mockResolvedValue({ success: true, telegramMessageId: 502 });
    const schedule = vi.fn();
    const { result, loadScheduleHistory } = renderWorkspaceHistory(
      [],
      [],
      { send, schedule },
      vi.fn(),
      'personal',
      chat,
      vi.fn(),
      attachments,
      entities,
      'Photo',
    );

    await waitFor(() => expect(loadScheduleHistory).toHaveBeenCalledWith('personal'));
    act(() => {
      result.current.setDate(getTodayStr());
      result.current.setTime(getCurrentTimeStr());
    });
    await act(async () => {
      await result.current.handleSchedule();
    });

    expect(send).toHaveBeenCalledOnce();
    expect(send.mock.calls[0].slice(0, 4)).toEqual([chat.id, 'Photo', attachments, entities]);
  })

  it('lets Quick Planner clear the message only after confirming the draft is unchanged', async () => {
    const chat = { id: 'chat-1', name: 'Test chat' };
    const setMessage = vi.fn();
    const { result } = renderWorkspaceHistory([], [], {
      send: vi.fn().mockResolvedValue({ success: true, telegramMessageId: 503 }),
    }, vi.fn(), 'personal', chat, setMessage);

    await waitFor(() => expect(result.current.upcoming).toEqual([]));
    await act(async () => {
      const sent = await result.current.handleSendDraftNow(
        chat,
        'First draft',
        [],
        [],
        false,
        undefined,
        { clearMessageOnSuccess: false },
      );
      expect(sent).toBe(true);
    });

    expect(setMessage).not.toHaveBeenCalled();
  })

  it('keeps an uncertain draft send unknown and does not repeat the request', async () => {
    const chat = { id: 'draft-retry', name: 'Draft retry chat' };
    const send = vi.fn().mockResolvedValue({
      success: false,
      error: 'Network response was lost.',
      code: 'ETIMEDOUT',
      category: 'network',
      retryable: true,
    });
    const { result } = renderWorkspaceHistory([], [], { send }, vi.fn(), 'workspace', chat);

    await waitFor(() => expect(result.current.scheduling).toBe(false));
    await act(async () => {
      await expect(result.current.handleSendDraftNow(chat, 'Retry same payload')).resolves.toBe(false);
    });
    expect(result.current.upcoming[0]).toMatchObject({ status: 'unknown', retryAction: undefined });

    await act(async () => {
      await expect(result.current.handleSendDraftNow(chat, 'Retry same payload')).resolves.toBe(false);
    });

    expect(send).toHaveBeenCalledOnce();
    expect(result.current.sent).toHaveLength(0);
  })

  it('restores an uncertain draft-send attempt without automatically repeating it', async () => {
    const chat = { id: 'draft-restart-retry', name: 'Draft restart chat' };
    const send = vi.fn().mockResolvedValue({
      success: false,
      error: 'Network response was lost.',
      code: 'ETIMEDOUT',
      category: 'network',
      retryable: true,
    });
    const firstRun = renderWorkspaceHistory([], [], { send }, vi.fn(), 'workspace', chat);

    await waitFor(() => expect(firstRun.result.current.scheduling).toBe(false));
    await act(async () => {
      await expect(firstRun.result.current.handleSendDraftNow(chat, 'Persist this attempt')).resolves.toBe(false);
    });
    const interruptedAttempt = firstRun.result.current.upcoming[0];
    const originalAttemptId = interruptedAttempt.sendAttemptId;
    expect(interruptedAttempt).toMatchObject({ status: 'unknown', retryAction: undefined });
    expect(originalAttemptId).toEqual(expect.stringMatching(/^\d+:[a-z0-9]+$/i));
    firstRun.unmount();

    const restarted = renderWorkspaceHistory([interruptedAttempt], [], { send }, vi.fn(), 'workspace', chat);
    await waitFor(() => expect(restarted.result.current.scheduling).toBe(false));
    await act(async () => {
      await expect(restarted.result.current.handleSendDraftNow(chat, 'Persist this attempt')).resolves.toBe(false);
    });

    expect(send).toHaveBeenCalledOnce();
    expect(restarted.result.current.upcoming[0]).toMatchObject({
      status: 'unknown',
      sendAttemptId: originalAttemptId,
    });
    expect(restarted.result.current.sent).toHaveLength(0);
    restarted.unmount();
  })

  it('restores an unknown send as Sent only when Telegram returns its correlated message ID', async () => {
    const unknown: ScheduledMessage = {
      id: 'unknown-send',
      chatId: 'chat-unknown',
      chatName: 'Unknown chat',
      text: 'Correlated send',
      when: '2035-01-15T18:00:00.000Z',
      createdAt: '2035-01-15T17:00:00.000Z',
      status: 'unknown',
      sendAttemptId: '1736962920000:stable-attempt',
    };
    const send = vi.fn();
    const reconcileSendAttempt = vi.fn().mockResolvedValue({
      success: true,
      state: 'sent',
      telegramMessageId: 42,
      telegramMessageIds: [42],
      sentAt: '2035-01-15T18:00:10.000Z',
    });
    const { result, saveScheduleHistory } = renderWorkspaceHistory(
      [unknown],
      [],
      { send, reconcileSendAttempt },
      vi.fn(),
    );

    await waitFor(() => expect(reconcileSendAttempt).toHaveBeenCalledOnce());
    await waitFor(() => expect(result.current.sent).toHaveLength(1));
    expect(result.current.upcoming).toHaveLength(0);
    expect(reconcileSendAttempt).toHaveBeenCalledWith({
      idempotencyKey: unknown.sendAttemptId,
      attachmentCount: 0,
    });
    expect(result.current.sent[0]).toMatchObject({
      id: unknown.id,
      status: 'sent',
      telegramMessageId: 42,
      sentAt: '2035-01-15T18:00:10.000Z',
    });
    expect(send).not.toHaveBeenCalled();
    expect(saveScheduleHistory).toHaveBeenCalledWith(expect.objectContaining({
      field: 'snapshot',
      messages: expect.objectContaining({
        sent: [expect.objectContaining({ id: unknown.id, telegramMessageId: 42 })],
      }),
    }));
  })

  it('keeps a nominally successful send unknown when the bridge omits its Telegram message ID', async () => {
    const chat = { id: 'missing-send-id', name: 'Missing send ID' };
    const send = vi.fn().mockResolvedValue({ success: true });
    const { result } = renderWorkspaceHistory([], [], { send }, vi.fn(), 'workspace', chat);

    await waitFor(() => expect(result.current.scheduling).toBe(false));
    await act(async () => {
      await expect(result.current.handleSendDraftNow(chat, 'Do not assume sent')).resolves.toBe(false);
    });

    expect(send).toHaveBeenCalledOnce();
    expect(result.current.sent).toHaveLength(0);
    expect(result.current.upcoming[0]).toMatchObject({
      status: 'unknown',
      retryAction: undefined,
    });
  })

  it('does not contact Telegram when the draft Sending record cannot be persisted', async () => {
    const chat = { id: 'draft-persist-before-send', name: 'Draft persist chat' };
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
    const { result } = renderWorkspaceHistory([], [], { send, saveScheduleHistory }, vi.fn(), 'workspace', chat);

    await waitFor(() => expect(result.current.scheduling).toBe(false));
    await act(async () => {
      await expect(result.current.handleSendDraftNow(chat, 'Persist before send')).resolves.toBe(false);
    });

    expect(send).not.toHaveBeenCalled();
    expect(result.current.upcoming[0]).toMatchObject({ status: 'failed', retryAction: 'send' });
  })

  it('keeps recovery Pending when the bridge returns an unknown send status', async () => {
    const unknown: ScheduledMessage = {
      id: 'unsupported-send-state',
      chatId: 'chat-unknown-state',
      chatName: 'Unknown state chat',
      text: 'Do not infer delivery',
      when: '2035-01-15T18:00:00.000Z',
      createdAt: '2035-01-15T17:00:00.000Z',
      status: 'unknown',
      sendAttemptId: '1736962920000:unsupported-state-attempt',
    };
    const reconcileSendAttempt = vi.fn().mockResolvedValue({
      success: true,
      state: 'delivered',
      telegramMessageId: 42,
    });
    const send = vi.fn();
    const { result } = renderWorkspaceHistory(
      [unknown],
      [],
      { send, reconcileSendAttempt },
    );

    await waitFor(() => expect(reconcileSendAttempt).toHaveBeenCalledOnce());
    await waitFor(() => expect(result.current.upcoming[0]?.status).toBe('unknown'));

    expect(result.current.sent).toHaveLength(0);
    expect(send).not.toHaveBeenCalled();
  })

  it('ignores a duplicate immediate draft-send while the first request is in flight', async () => {
    const chat = { id: 'draft-send-once', name: 'Draft send chat' };
    let resolveSend!: (result: { success: boolean; telegramMessageId?: string }) => void;
    const send = vi.fn(() => new Promise<{ success: boolean; telegramMessageId?: string }>((resolve) => { resolveSend = resolve; }));
    const { result } = renderWorkspaceHistory([], [], { send }, vi.fn(), 'workspace', chat);

    await waitFor(() => expect(result.current.scheduling).toBe(false));
    let firstAttempt!: Promise<boolean | 'sent-history-failed'>;
    let duplicateResult: boolean | 'sent-history-failed' = true;
    await act(async () => {
      firstAttempt = result.current.handleSendDraftNow(chat, 'Send once');
      await Promise.resolve();
      duplicateResult = await result.current.handleSendDraftNow(chat, 'Send once');
    });

    expect(duplicateResult).toBe(false);
    expect(send).toHaveBeenCalledOnce();
    const idempotencyKey = (send.mock.calls[0] as unknown[])[7];
    expect(idempotencyKey).toEqual(expect.stringMatching(/^\d+:[a-z0-9]+$/i));

    await act(async () => {
      resolveSend({ success: true, telegramMessageId: '506' });
      await expect(firstAttempt).resolves.toBe(true);
    });

    expect(send).toHaveBeenCalledOnce();
    expect(result.current.sent).toHaveLength(1);
  })
});
