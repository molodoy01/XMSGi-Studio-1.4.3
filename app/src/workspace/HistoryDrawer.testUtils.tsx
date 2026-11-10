import { fireEvent, render, screen, within } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readColorThemeStyles, readGlobalStyles as readAppGlobalStyles, readHistoryStyles, readWorkspacePageStyles } from '../test/globalStyles';
import { vi } from 'vitest';
import type { Chat, ScheduledMessage } from '@/types';
import { LocaleProvider } from '@/lib/i18n';
import { HistoryDrawer } from './HistoryDrawer';
import { normalizeScheduledMessages } from './historyModel';

export const readGlobalStyles = () => {
  const stylesDirectory = path.dirname(fileURLToPath(import.meta.url));
  const historyStyles = readHistoryStyles();
  const indexStyles = readAppGlobalStyles();
  const historyOverrides = readFileSync(path.resolve(stylesDirectory, '../styles/history-layout-overrides.css'), 'utf8');
  return `${historyStyles}\n${indexStyles}\n${historyOverrides}`;
};

export const globalStyles = readGlobalStyles();

export const colorThemeStyles = readColorThemeStyles();

export const workspacePageStyles = readWorkspacePageStyles();

export const scheduledMessage: ScheduledMessage = {
  id: 'scheduled-studio-1',
  chatId: 'chat-1',
  chatName: 'XMSGi Updates',
  text: 'Релиз нового набора шаблонов для Telegram-канала',
  attachments: ['C:\\files\\brief.pdf'],
  when: '2026-09-29T17:30:00.000Z',
  createdAt: '2026-09-29T16:00:00.000Z',
  status: 'confirmed',
};

export const channel: Chat = { id: 'chat-1', name: 'XMSGi Updates', username: 'xmsgi_updates', type: 'channel' };

export const upcomingRecord = normalizeScheduledMessages([scheduledMessage], 'workspace', 'upcoming', [channel])[0];

export const completedRecord = normalizeScheduledMessages([{
    ...scheduledMessage,
    id: 'completed-personal-1',
    chatName: 'Личные заметки',
    text: 'Подтвердить встречу',
    attachments: [],
    status: 'sent',
  }], 'personal', 'sent', [channel])[0];

export const workspaceSentRecord = normalizeScheduledMessages([{
  ...scheduledMessage,
  id: 'completed-studio-1',
  status: 'sent',
}], 'workspace', 'sent', [channel])[0];

export const anchoredSentRecord = normalizeScheduledMessages([{
  ...scheduledMessage,
  id: 'anchored-sent-1',
  status: 'sent',
  telegramMessageId: 567,
}], 'workspace', 'sent', [channel])[0];

export const personalUpcomingRecord = normalizeScheduledMessages([{
    ...scheduledMessage,
    id: 'scheduled-personal-1',
    chatName: 'Личное',
    text: 'Подтвердить встречу',
    attachments: [],
  }], 'personal', 'upcoming', [])[0];

export function renderHistory(
  records = [upcomingRecord],
  onCancel = vi.fn(),
  onDelete = vi.fn(),
  onSendNow = vi.fn(),
  onOpenDraft = vi.fn(),
  onReschedule = vi.fn(),
  onClearSent = vi.fn().mockResolvedValue({ deleted: 0, failed: 0 }),
  onClearDrafts = vi.fn().mockResolvedValue(true),
  onCancelQueue = vi.fn().mockResolvedValue(true),
  onUseDraft = vi.fn(),
  draftDestination: 'planner' | 'studio' = 'studio',
) {
  const onClose = vi.fn();
  const view = render(
    <LocaleProvider>
      <HistoryDrawer
        isOpen
        onClose={onClose}
        records={records}
        onCancel={onCancel}
        onReschedule={onReschedule}
        onSendNow={onSendNow}
        onDelete={onDelete}
        onOpenDraft={onOpenDraft}
        onUseDraft={onUseDraft}
        draftDestination={draftDestination}
        onClearSent={onClearSent}
        onClearDrafts={onClearDrafts}
        onCancelQueue={onCancelQueue}
      />
    </LocaleProvider>,
  );
  return { ...view, onClose, onCancel, onDelete, onSendNow, onOpenDraft, onUseDraft, onReschedule, onClearSent, onClearDrafts, onCancelQueue };
}

export function renderHistoryPage(
  records = [upcomingRecord],
  onUseDraft = vi.fn(),
  onReschedule = vi.fn(),
  onDelete = vi.fn(),
) {
  const onClose = vi.fn();
  const onOpenDraft = vi.fn();
  const view = render(
    <LocaleProvider>
      <HistoryDrawer
        isOpen
        pageMode
        onClose={onClose}
        records={records}
        onCancel={vi.fn()}
        onReschedule={onReschedule}
        onSendNow={vi.fn()}
        onDelete={onDelete}
        onOpenDraft={onOpenDraft}
        onUseDraft={onUseDraft}
        onClearSent={vi.fn().mockResolvedValue({ deleted: 0, failed: 0 })}
        onCancelQueue={vi.fn()}
      />
    </LocaleProvider>,
  );
  return { ...view, onClose, onOpenDraft, onUseDraft, onReschedule, onDelete };
}

export function searchHistory(query: string) {
  renderHistory();
  fireEvent.change(screen.getByRole('textbox', { name: 'Поиск по истории' }), {
    target: { value: query },
  });
}

export function selectHistorySource(label: string) {
  const filter = label === 'Studio'
    ? 'workspace'
    : label === 'Planner'
      ? 'personal'
      : 'all';
  const sourceMenuButton = document.querySelector<HTMLButtonElement>('.history-source-select');
  if (sourceMenuButton) {
    fireEvent.click(sourceMenuButton);
    fireEvent.click(document.querySelector(`.history-source-menu [data-history-filter="${filter}"]`)!);
    return;
  }

  fireEvent.click(document.querySelector(`.history-source-filters [data-history-filter="${filter}"]`)!);
}

export function openSourceMenu() {
  fireEvent.click(document.querySelector('.history-source-select')!);
  const menu = document.querySelector<HTMLElement>('.history-source-menu')!;
  return { ...within(menu), container: menu };
}

export function selectHistoryErrors() {
  const drawerErrorFilter = document.querySelector<HTMLButtonElement>('.history-source-filters [data-history-filter="errors"]');
  if (drawerErrorFilter) {
    fireEvent.click(drawerErrorFilter);
    return;
  }

  const sourceMenuButton = document.querySelector<HTMLButtonElement>('.history-source-select')!;
  fireEvent.click(sourceMenuButton);
  fireEvent.click(within(document.querySelector('.history-source-menu')!).getByRole('menuitemradio', { name: 'Ошибки' }));
}

export function mockHistoryRecordScroll(container: HTMLElement, recordBounds = { top: 350, height: 100 }, scale = 1) {
  const list = container.querySelector('.history-record-list') as HTMLDivElement;
  const record = list.querySelector('.history-record') as HTMLElement;
  const dateHeading = list.querySelector('.history-date-heading') as HTMLElement;
  const scrollTo = vi.fn();
  Object.defineProperties(list, {
    clientHeight: { configurable: true, value: 300 },
    offsetHeight: { configurable: true, value: 300 },
    scrollTop: { configurable: true, writable: true, value: 20 },
    getBoundingClientRect: { configurable: true, value: () => new DOMRect(0, 100 * scale, 400 * scale, 300 * scale) },
    scrollTo: { configurable: true, value: scrollTo },
  });
  Object.defineProperty(record, 'getBoundingClientRect', {
    configurable: true,
    value: () => new DOMRect(0, recordBounds.top * scale, 400 * scale, recordBounds.height * scale),
  });
  Object.defineProperty(dateHeading, 'getBoundingClientRect', {
    configurable: true,
    value: () => new DOMRect(0, 100 * scale, 400 * scale, 34 * scale),
  });
  return scrollTo;
}

export function stubDownloads() {
  const blobs: Blob[] = [];
  const filenames: string[] = [];
  vi.spyOn(window, 'setTimeout').mockImplementation(((handler: TimerHandler) => {
    if (typeof handler === 'function') handler();
    return 0;
  }) as typeof window.setTimeout);
  const createObjectURL = vi.fn((blob: Blob) => {
    blobs.push(blob);
    return `blob:scheduled-export-${blobs.length}`;
  });
  const revokeObjectURL = vi.fn();
  const anchorClick = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
    filenames.push(this.download);
  });

  vi.stubGlobal('URL', { createObjectURL, revokeObjectURL });
  return { blobs, filenames, anchorClick };
}

export function readBlob(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(blob);
  });
}
