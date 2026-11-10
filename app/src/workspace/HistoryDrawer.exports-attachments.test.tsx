import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi, describe } from 'vitest';
import { normalizeScheduledMessages } from './historyModel';
import { scheduledMessage, channel, upcomingRecord, completedRecord, personalUpcomingRecord, renderHistory, renderHistoryPage, mockHistoryRecordScroll } from './HistoryDrawer.testUtils';

vi.mock('@/services/chatAppService', () => ({
  telegramGetChatHistory: vi.fn(),
}));

describe('HistoryDrawer search', () => {
  beforeEach(() => {
      window.localStorage.removeItem('xmsgi-history-filters');
      window.localStorage.removeItem('xmsgi_saved_draft_color_filter');
      window.localStorage.removeItem('xmsgi_dismissed_draft_color_auto_filter');
      window.localStorage.setItem('awaitmsg_locale', 'ru');
    });

  it('expands a post in place, hides following posts and restores them on collapse', () => {
      renderHistory([upcomingRecord, personalUpcomingRecord]);
  
      fireEvent.click(screen.getByRole('button', { name: 'Показать полностью: XMSGi Updates' }));
  
      expect(screen.getByRole('button', { name: 'Свернуть: XMSGi Updates' })).toHaveAttribute('aria-expanded', 'true');
      expect(screen.getAllByRole('article')).toHaveLength(1);
      expect(screen.getByText('Релиз нового набора шаблонов для Telegram-канала')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Показать полностью: Личное' })).not.toBeInTheDocument();
  
      fireEvent.click(screen.getByRole('button', { name: 'Свернуть: XMSGi Updates' }));
  
      expect(screen.getByRole('button', { name: 'Показать полностью: Личное' })).toBeInTheDocument();
      expect(screen.getAllByRole('article')).toHaveLength(2);
    });
  
  it('collapses an expanded post from the empty rail beside its message', () => {
      const view = renderHistory([upcomingRecord, personalUpcomingRecord]);
      fireEvent.click(screen.getByRole('button', { name: 'Показать полностью: XMSGi Updates' }));
      const expandedBody = view.container.querySelector('.history-post-expanded')!;
      const bubble = expandedBody.querySelector('.history-post-bubble')!;
      const messageText = expandedBody.querySelector('.history-post-text')!;
      Object.defineProperty(bubble, 'getBoundingClientRect', {
        configurable: true,
        value: () => new DOMRect(100, 200, 240, 100),
      });
  
      fireEvent.click(messageText, { clientX: 20 });
      expect(screen.getByRole('article')).toHaveClass('is-expanded');
  
      fireEvent.click(expandedBody, { clientX: 20 });
  
      expect(screen.getAllByRole('article')).toHaveLength(2);
      expect(view.container.querySelector('.history-record.is-expanded')).toBeNull();
    });
  
  it('restores the history list position after collapsing a full-size post', () => {
      const view = renderHistory([upcomingRecord]);
      mockHistoryRecordScroll(view.container);
      const list = view.container.querySelector('.history-record-list') as HTMLDivElement;
  
      fireEvent.click(screen.getByRole('button', { name: 'Показать полностью: XMSGi Updates' }));
      list.scrollTop = 180;
      fireEvent.click(screen.getByRole('button', { name: 'Свернуть: XMSGi Updates' }));
  
      expect(list.scrollTop).toBe(20);
    });
  
  it.each([
      {
        name: 'summary row',
        record: upcomingRecord,
        status: null,
        trigger: 'Открыть публикацию: XMSGi Updates',
        bounds: { top: 350, height: 100 },
        scale: 1,
        expectedScrollTop: 70,
      },
      {
        name: 'summary row for a sent message',
        record: completedRecord,
        status: 'Отправлено',
        trigger: 'Открыть публикацию: Личные заметки',
        bounds: { top: 350, height: 100 },
        scale: 1,
        expectedScrollTop: 70,
      },
      {
        name: 'full-view action for a sent message',
        record: completedRecord,
        status: 'Отправлено',
        trigger: 'Показать полностью: Личные заметки',
        bounds: { top: 350, height: 100 },
        scale: 1,
        expectedScrollTop: 70,
      },
      {
        name: 'full-view action for a message taller than the viewport',
        record: completedRecord,
        status: 'Отправлено',
        trigger: 'Показать полностью: Личные заметки',
        bounds: { top: 250, height: 480 },
        scale: 1,
        expectedScrollTop: 350,
      },
      {
        name: 'full-view action at Electron zoom',
        record: completedRecord,
        status: 'Отправлено',
        trigger: 'Показать полностью: Личные заметки',
        bounds: { top: 350, height: 100 },
        scale: 0.7,
        expectedScrollTop: 70,
      },
    ])('keeps $name visible by scrolling only the history list', ({ record, status, trigger, bounds, scale, expectedScrollTop }) => {
      const view = renderHistory([record]);
      if (status) fireEvent.click(screen.getByRole('tab', { name: status }));
      const scrollTo = mockHistoryRecordScroll(view.container, bounds, scale);
  
      fireEvent.click(screen.getByRole('button', { name: trigger }));
  
      expect(scrollTo).toHaveBeenCalledWith({ top: expectedScrollTop, behavior: 'smooth' });
    });
  
  it('scrolls the history list to keep the opened actions menu visible', () => {
      const view = renderHistory([upcomingRecord]);
      const scrollTo = mockHistoryRecordScroll(view.container);
      const originalGetBoundingClientRect = HTMLElement.prototype.getBoundingClientRect;
      const getBoundingClientRect = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect');
      getBoundingClientRect.mockImplementation(function (this: HTMLElement) {
        return this.classList.contains('history-record-action-menu')
          ? new DOMRect(0, 350, 170, 100)
          : originalGetBoundingClientRect.call(this);
      });
  
      try {
        fireEvent.click(screen.getByRole('button', { name: 'Ещё' }));
  
        expect(scrollTo).toHaveBeenCalledWith({ top: 70, behavior: 'smooth' });
      } finally {
        getBoundingClientRect.mockRestore();
      }
    });
  
  it('scrolls the history list to keep the opened actions menu visible at Electron zoom', () => {
      const view = renderHistory([upcomingRecord]);
      const scrollTo = mockHistoryRecordScroll(view.container, { top: 350, height: 100 }, 0.7);
      const originalGetBoundingClientRect = HTMLElement.prototype.getBoundingClientRect;
      const getBoundingClientRect = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect');
      getBoundingClientRect.mockImplementation(function (this: HTMLElement) {
        return this.classList.contains('history-record-action-menu')
          ? new DOMRect(0, 245, 119, 70)
          : originalGetBoundingClientRect.call(this);
      });
  
      try {
        fireEvent.click(screen.getByRole('button', { name: 'Ещё' }));
  
        expect(scrollTo).toHaveBeenCalledWith({ top: 70, behavior: 'smooth' });
      } finally {
        getBoundingClientRect.mockRestore();
      }
    });
  
  it('re-aligns an expanded sent message when its image attachment loads', () => {
      const sentImageRecord = normalizeScheduledMessages([{
        ...scheduledMessage,
        id: 'sent-image-1',
        status: 'sent',
        sentAt: '2026-09-29T18:00:00.000Z',
        attachments: ['C:\\files\\sent-image.png'],
      }], 'personal', 'sent', [channel])[0];
      const view = renderHistory([sentImageRecord]);
      fireEvent.click(screen.getByRole('tab', { name: 'Отправлено' }));
      const scrollTo = mockHistoryRecordScroll(view.container, { top: 350, height: 100 });
  
      fireEvent.click(screen.getByRole('button', { name: 'Показать полностью: XMSGi Updates' }));
      expect(scrollTo).toHaveBeenCalledOnce();
  
      fireEvent.load(screen.getByRole('img', { name: 'sent-image.png' }));
  
      expect(scrollTo).toHaveBeenCalledTimes(2);
    });
  
  it('collapses an expanded message when switching to a category that hides it', () => {
      renderHistory([upcomingRecord, completedRecord]);
      fireEvent.click(screen.getByRole('button', { name: 'Открыть публикацию: XMSGi Updates' }));
      expect(screen.getByRole('article')).toHaveClass('is-expanded');
  
      fireEvent.click(screen.getByRole('tab', { name: 'Отправлено' }));
  
      expect(screen.getAllByRole('article')).toHaveLength(1);
      expect(screen.getByRole('article')).not.toHaveClass('is-expanded');
    });
  
  it('shows image attachments in the full post view', () => {
      const imageRecord = normalizeScheduledMessages([
        {
          ...scheduledMessage,
          text: 'A caption below the photo',
          attachments: ['C:\\files\\launch-image.png'],
        },
      ], 'workspace', 'upcoming', [channel])[0];
      const view = renderHistory([imageRecord]);
  
      fireEvent.click(screen.getByRole('button', { name: 'Открыть публикацию: XMSGi Updates' }));
  
      expect(screen.getByRole('img', { name: 'launch-image.png' })).not.toHaveAttribute('src');
      const bubble = view.container.querySelector('.history-post-bubble');
      expect(bubble?.firstElementChild).toHaveClass('history-post-attachments');
      expect(bubble?.querySelector('.history-post-text')).toHaveTextContent('A caption below the photo');
    });
  
  it('loads local JFIF attachments for the Posts list and details view', async () => {
      const originalDraftStorage = Object.getOwnPropertyDescriptor(window, 'draftStorage');
      const readImageDataUrl = vi.fn().mockResolvedValue({
        success: true,
        dataUrl: 'data:image/jpeg;base64,dGVzdA==',
      });
      Object.defineProperty(window, 'draftStorage', {
        configurable: true,
        value: { load: vi.fn(), readImageDataUrl },
      });
      const imagePath = 'file:///C:/Users/malod/AppData/Local/XMSGi-Workspace-Agent/drafts/OIP%20(1).jfif';
      const imageRecord = normalizeScheduledMessages([{
        ...scheduledMessage,
        attachments: [imagePath],
      }], 'workspace', 'upcoming', [channel])[0];
  
      try {
        const view = renderHistoryPage([imageRecord]);
        await waitFor(() => expect(readImageDataUrl).toHaveBeenCalledWith(
          'C:/Users/malod/AppData/Local/XMSGi-Workspace-Agent/drafts/OIP (1).jfif',
        ));
        await waitFor(() => expect(
          view.container.querySelector('.history-record-attachment-image img'),
        ).toHaveAttribute('src', 'data:image/jpeg;base64,dGVzdA=='));
        fireEvent.click(view.container.querySelector('.history-record-open')!);
        expect(view.container.querySelector('.history-post-attachments img')).toHaveAttribute(
          'src',
          'data:image/jpeg;base64,dGVzdA==',
        );
      } finally {
        if (originalDraftStorage) Object.defineProperty(window, 'draftStorage', originalDraftStorage);
        else Reflect.deleteProperty(window, 'draftStorage');
      }
    });
  
  it('does not repeat a chat name below an identical message title', () => {
      const savedMessagesRecord = normalizeScheduledMessages([{
        ...scheduledMessage,
        chatName: 'Saved Messages',
      }], 'workspace', 'upcoming', [])[0];
      const view = renderHistory([savedMessagesRecord]);
  
      expect(view.container.querySelector('.history-record-heading strong')).toHaveTextContent('Saved Messages');
      expect(view.container.querySelector('.history-record-chat')).toBeNull();
    });
  
  it('shows a magnified preview after hovering over history photos', () => {
      const imageRecord = normalizeScheduledMessages([{
        ...scheduledMessage,
        attachments: ['C:\\files\\launch-image.png'],
      }], 'workspace', 'upcoming', [channel])[0];
      const view = renderHistory([imageRecord]);
      const thumbnail = view.container.querySelector('.history-record-attachment-image img');
      if (!thumbnail) throw new Error('History photo thumbnail was not rendered.');
      vi.useFakeTimers();
  
      try {
        fireEvent.pointerEnter(thumbnail);
        act(() => vi.advanceTimersByTime(599));
        expect(document.body.querySelector('.message-attachment-preview')).toBeNull();
  
        act(() => vi.advanceTimersByTime(1));
        expect(document.body.querySelector('.message-attachment-preview img')).not.toHaveAttribute('src');
  
        fireEvent.pointerLeave(thumbnail);
        expect(document.body.querySelector('.message-attachment-preview')).toBeNull();
  
        fireEvent.click(screen.getByRole('button', { name: 'Открыть публикацию: XMSGi Updates' }));
        const fullSizeImage = screen.getByRole('img', { name: 'launch-image.png' });
        fireEvent.pointerEnter(fullSizeImage);
        act(() => vi.advanceTimersByTime(600));
        expect(document.body.querySelector('.message-attachment-preview')).toBeNull();
      } finally {
        vi.useRealTimers();
      }
    });
  
  it('shows schedule time and status only once the post is expanded', () => {
      const view = renderHistory([upcomingRecord]);
      const openButton = screen.getByRole('button', { name: 'Открыть публикацию: XMSGi Updates' });
  
      expect(openButton.querySelector('.history-record-date')).not.toBeNull();
      expect(openButton.querySelector('.history-record-heading time')).not.toBeNull();
  
      fireEvent.click(openButton);
  
      expect(openButton.querySelector('.history-record-date')).toBeNull();
      expect(openButton.querySelector('.history-record-heading time')).toBeNull();
      expect(view.container.querySelector('.history-post-time-row time')).toBeVisible();
      expect(view.container.querySelector('.history-post-time-row')).toHaveTextContent('Запланировано');
    });

  it('backs up the same current Posts scope across sources and reports omitted attachments', async () => {
    const originalDraftStorage = Object.getOwnPropertyDescriptor(window, 'draftStorage');
    let finishExport!: (result: { success: boolean; missingAttachments: number }) => void;
    const exportHistoryBackup = vi.fn().mockImplementation(() => new Promise((resolve) => {
      finishExport = resolve;
    }));
    Object.defineProperty(window, 'draftStorage', {
      configurable: true,
      value: { exportHistoryBackup },
    });

    try {
      renderHistory([upcomingRecord, personalUpcomingRecord]);
      fireEvent.click(screen.getByRole('button', { name: 'Экспортировать текущую категорию' }));
      fireEvent.click(screen.getByRole('menuitem', { name: 'Архив с файлами: текущий список (.zip)' }));

      expect(screen.queryByRole('menu', { name: 'Формат экспорта' })).not.toBeInTheDocument();
      expect(screen.queryByText('Подготовка резервной копии…')).not.toBeInTheDocument();
      finishExport({ success: true, missingAttachments: 1 });
      expect(await screen.findByText(/не удалось добавить вложения: 1/)).toBeInTheDocument();
      expect(exportHistoryBackup).toHaveBeenCalledWith({
        records: expect.arrayContaining([
          expect.objectContaining({ id: upcomingRecord.id }),
          expect.objectContaining({ id: personalUpcomingRecord.id }),
        ]),
        filters: { source: 'all', status: 'scheduled', query: '' },
      });
    } finally {
      if (originalDraftStorage) Object.defineProperty(window, 'draftStorage', originalDraftStorage);
      else Reflect.deleteProperty(window, 'draftStorage');
    }
  });

  it('exports only Ctrl-selected records and shows the selected total', async () => {
    const originalDraftStorage = Object.getOwnPropertyDescriptor(window, 'draftStorage');
    const exportHistoryBackup = vi.fn().mockResolvedValue({ success: true, missingAttachments: 0 });
    Object.defineProperty(window, 'draftStorage', {
      configurable: true,
      value: { exportHistoryBackup },
    });

    try {
      const secondRecord = normalizeScheduledMessages([{
        ...scheduledMessage,
        id: 'selected-export-record',
        text: 'Selected for export',
      }], 'workspace', 'upcoming', [channel])[0];
      const { container } = renderHistoryPage([upcomingRecord, secondRecord]);
      fireEvent.click(container.querySelector(`[data-history-record-id="${upcomingRecord.id}"]`)!, { ctrlKey: true });
      fireEvent.click(container.querySelector(`[data-history-record-id="${secondRecord.id}"]`)!, { ctrlKey: true });

      fireEvent.click(container.querySelector('.history-export-button')!);
      const exportMenu = screen.getByRole('menu', { name: /export|экспорт/i });
      expect(exportMenu).toHaveTextContent(/2/);
      expect(exportMenu).not.toHaveTextContent(upcomingRecord.title);
      expect(exportMenu).not.toHaveTextContent('Selected for export');
      fireEvent.click(screen.getByRole('menuitem', { name: /\.zip/ }));

      await waitFor(() => expect(exportHistoryBackup).toHaveBeenCalledOnce());
      expect(exportHistoryBackup).toHaveBeenCalledWith({
        records: [upcomingRecord, secondRecord],
        filters: { source: 'workspace', status: 'scheduled', query: '' },
      });
    } finally {
      if (originalDraftStorage) Object.defineProperty(window, 'draftStorage', originalDraftStorage);
      else Reflect.deleteProperty(window, 'draftStorage');
    }
  });
});
