import { renderHook } from '@testing-library/react';
import type { PropsWithChildren } from 'react';
import { vi } from 'vitest';
import { LocaleProvider } from '@/lib/i18n';
import type { Chat, RichTextEntity, ScheduledMessage } from '@/types';
import { useScheduler } from './useScheduler';

export function createScheduleIdentityResult(operations: Array<Record<string, unknown>>) {
  return {
    success: true,
    identities: operations.map((operation) => JSON.stringify({
      target: String(operation.chatId),
      message: operation.message,
      targetTimestamp: operation.targetTimestamp,
      attachmentHashes: operation.attachments ?? [],
      entities: operation.entities ?? [],
      silent: operation.silent === true,
      effect: operation.effect === undefined || operation.effect === null ? null : String(operation.effect),
    }) ?? ''),
  };
}

export function localDateTimeAt(timestamp: number) {
  const date = new Date(timestamp);
  const pad = (value: number) => String(value).padStart(2, '0');
  return {
    date: `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`,
    time: `${pad(date.getHours())}:${pad(date.getMinutes())}`,
  };
}

export function getFutureReplacementTimes() {
  const original = new Date(Date.now() + 30 * 60 * 1000);
  original.setSeconds(0, 0);
  const replacement = new Date(Date.now() + 60 * 60 * 1000);
  replacement.setSeconds(0, 0);
  return {
    originalWhen: original.toISOString(),
    replacementDateTime: localDateTimeAt(replacement.getTime()),
  };
}

export function renderWorkspaceHistory(upcoming: ScheduledMessage[], sent: ScheduledMessage[], telegramOverrides: Record<string, unknown>, showNotification = vi.fn(), historyScope: 'personal' | 'workspace' = 'workspace', selectedChat: Chat | null = null, setMessage = vi.fn(), attachments: string[] = [], entities: RichTextEntity[] = [], message = '') {
  const saveScheduleHistory = vi.fn().mockResolvedValue({ success: true });
  const loadScheduleHistory = vi.fn().mockResolvedValue({
    success: true,
    history: { upcoming, sent },
    needsMigration: false,
  });
  vi.stubGlobal('telegram', {
    loadScheduleHistory,
    saveScheduleHistory,
    getScheduleIdentities: vi.fn(async (operations: Array<Record<string, unknown>>) => createScheduleIdentityResult(operations)),
    ...telegramOverrides,
  });

  const wrapper = ({ children }: PropsWithChildren) => <LocaleProvider>{children}</LocaleProvider>;
  const hook = renderHook(() => useScheduler({
    historyScope,
    connected: true,
    selectedChat,
    chats: selectedChat ? [selectedChat] : [],
    message,
    composerAttachments: attachments,
    composerEntities: entities,
    showNotification,
    setMessage,
  }), { wrapper });

  return {
    ...hook,
    saveScheduleHistory: (telegramOverrides.saveScheduleHistory as typeof saveScheduleHistory | undefined) ?? saveScheduleHistory,
    loadScheduleHistory,
    showNotification,
    setMessage,
  };
}
