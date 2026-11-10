import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, expect, it, vi, describe } from 'vitest';
import type { ScheduledMessage } from '@/types';
import { LocaleProvider } from '@/lib/i18n';
import { SAVED_STUDIO_DRAFTS_UPDATED_EVENT, writeWorkspaceDraftStoreFallback } from '@studio/lib/draftStore';
import { HistoryDrawer } from './HistoryDrawer';
import { normalizePlannerDraft, normalizeSavedDraft, normalizeScheduledMessages, sortHistoryItems } from './historyModel';
import { readGlobalStyles, workspacePageStyles, scheduledMessage, channel, upcomingRecord, completedRecord, personalUpcomingRecord, renderHistory, renderHistoryPage, searchHistory, selectHistorySource } from './HistoryDrawer.testUtils';

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

  it('groups search and navigation controls in one dock below the records', () => {
      const { container } = renderHistory();
      const recordList = container.querySelector('.history-record-list')!;
      const searchDock = container.querySelector('.history-search-dock')!;
      const navigationDock = container.querySelector('.history-drawer-footer')!;
      const toolsDock = container.querySelector('.history-drawer-tools')!;
  
      expect(recordList.compareDocumentPosition(searchDock) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
      expect(searchDock.compareDocumentPosition(navigationDock) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
      expect(searchDock.parentElement).toBe(toolsDock);
      expect(navigationDock.parentElement).toBe(toolsDock);
      expect(screen.getByRole('search')).toBeInTheDocument();
    });
  
  it('renders the history interface in English when English is selected', () => {
      window.localStorage.setItem('awaitmsg_locale', 'en');
      renderHistory();
  
      expect(screen.getByRole('dialog', { name: 'Posts' })).toBeInTheDocument();
      expect(screen.getByRole('textbox', { name: 'Search history' })).toBeInTheDocument();
      expect(screen.getByRole('textbox', { name: 'Search history' })).toHaveAttribute('placeholder', 'Search history...');
      expect(screen.getByRole('tab', { name: 'Scheduled' })).toBeInTheDocument();
    });
  
  it('hides the reminders category in Personal posts', () => {
      renderHistory([]);
  
      fireEvent.click(screen.getByRole('button', { name: 'Планер' }));
  
      expect(screen.queryByRole('tab', { name: /Напоминания/ })).not.toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /План/ })).toBeInTheDocument();
    });
  
  it('resets a previously selected reminders category when opening Posts', () => {
      window.localStorage.setItem('xmsgi-history-filters', JSON.stringify({
        sourceFilter: 'personal',
        statusFilter: 'notes',
      }));
      renderHistory([]);
  
      expect(screen.queryByRole('tab', { name: /Напоминания/ })).not.toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /План/ })).toHaveAttribute('aria-selected', 'true');
    });
  
  it('restores the source and status tabs after remounting', () => {
      const draft = normalizeSavedDraft({
        id: 'persisted-history-draft',
        name: 'Persisted draft',
        body: 'Draft content',
        color: 'coral',
        createdAt: '2026-09-28T10:00:00.000Z',
        updatedAt: '2026-09-29T18:35:00.000Z',
      });
      const firstView = renderHistory([upcomingRecord, draft]);
      fireEvent.click(screen.getByRole('button', { name: 'Studio' }));
      fireEvent.click(screen.getByRole('tab', { name: 'Черновики' }));
      firstView.unmount();
  
      const secondView = renderHistory([upcomingRecord, draft]);
      try {
        expect(screen.getByRole('button', { name: 'Studio' })).toHaveAttribute('aria-pressed', 'true');
        expect(screen.getByRole('tab', { name: 'Черновики' })).toHaveAttribute('aria-selected', 'true');
        expect(screen.getByText('Persisted draft')).toBeInTheDocument();
      } finally {
        secondView.unmount();
      }
    });
  
  it('normalizes both sources without colliding on matching IDs', () => {
      const duplicateIdMessage = { ...scheduledMessage, id: '123' };
      const personal = normalizeScheduledMessages([duplicateIdMessage], 'personal', 'upcoming', []);
      const workspace = normalizeScheduledMessages([duplicateIdMessage], 'workspace', 'upcoming', []);
  
      expect(personal[0].source).toBe('personal');
      expect(workspace[0].source).toBe('workspace');
      expect(personal[0].id).not.toBe(workspace[0].id);
      expect(personal[0].status).toBe('scheduled');
    });
  
  it('normalizes persisted Studio drafts and sorts each category by its required time', () => {
      const draft = normalizeSavedDraft({
        id: 'draft-1',
        name: 'Launch note',
        body: 'A new feature is ready',
        createdAt: '2026-09-28T10:00:00.000Z',
        updatedAt: '2026-09-29T18:35:00.000Z',
      });
      const scheduled = normalizeScheduledMessages([
        { ...scheduledMessage, id: 'later', when: '2026-09-29T21:00:00.000Z' },
        { ...scheduledMessage, id: 'sooner', when: '2026-09-29T20:00:00.000Z' },
      ], 'workspace', 'upcoming', []);
      const sent = normalizeScheduledMessages([
        { ...scheduledMessage, id: 'older', sentAt: '2026-09-29T16:00:00.000Z' },
        { ...scheduledMessage, id: 'newer', sentAt: '2026-09-29T17:00:00.000Z' },
      ], 'personal', 'sent', []);
  
      expect(draft).toMatchObject({ source: 'workspace', status: 'draft', title: 'Launch note' });
      expect(sortHistoryItems(scheduled, 'scheduled').map((item) => item.original.kind === 'scheduled' && item.original.message.id))
        .toEqual(['sooner', 'later']);
      expect(sortHistoryItems(sent, 'sent').map((item) => item.original.kind === 'scheduled' && item.original.message.id))
        .toEqual(['newer', 'older']);
      expect(sortHistoryItems([draft, normalizeSavedDraft({
        id: 'draft-2',
        name: 'Older note',
        body: 'Earlier',
        createdAt: '2026-09-27T10:00:00.000Z',
        updatedAt: '2026-09-29T17:00:00.000Z',
      })], 'drafts')[0].id).toBe(draft.id);
    });
  
  it('normalizes failed and cancelled statuses already present in runtime data', () => {
      const errorMessage = { ...scheduledMessage, status: 'failed' as ScheduledMessage['status'] };
      const cancelledMessage = { ...scheduledMessage, id: 'cancelled-runtime', status: 'cancelled' as ScheduledMessage['status'] };
      const [errorRecord] = normalizeScheduledMessages([errorMessage], 'workspace', 'upcoming', []);
      const [cancelledRecord] = normalizeScheduledMessages([cancelledMessage], 'workspace', 'upcoming', []);
  
      expect(errorRecord.status).toBe('failed');
      expect(cancelledRecord.status).toBe('cancelled');
      expect(sortHistoryItems([
        { ...errorRecord, updatedAt: '2026-09-29T18:00:00.000Z' },
        { ...cancelledRecord, updatedAt: '2026-09-29T19:00:00.000Z' },
        normalizeScheduledMessages([{ ...scheduledMessage, id: 'soon', when: '2026-09-29T20:00:00.000Z' }], 'workspace', 'upcoming', [])[0],
      ], 'scheduled').map((record) => record.status)).toEqual(['scheduled', 'cancelled', 'failed']);
    });
  
  it('shows failed retry attempts in All and hides them from Studio', () => {
      const retryFailure = normalizeScheduledMessages([{
        ...scheduledMessage,
        id: 'failed-attempt-1',
        text: 'Неудачная повторная отправка',
        status: 'failed',
        lastError: 'Telegram rejected the previous attempt.',
        retryAction: 'send',
      }], 'workspace', 'upcoming', [channel])[0];
  
      renderHistory([upcomingRecord, retryFailure]);
  
      expect(screen.getByText('Релиз нового набора шаблонов для Telegram-канала')).toBeInTheDocument();
      expect(screen.getByText('Неудачная повторная отправка')).toBeInTheDocument();
      selectHistorySource('Studio');
      expect(screen.queryByText('Неудачная повторная отправка')).not.toBeInTheDocument();
      expect(screen.queryByText('Telegram rejected the previous attempt.')).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Повторить отправку' })).not.toBeInTheDocument();
    });
  
  it('keeps drafts in a dedicated section instead of mixing them into the queue UI', async () => {
      const draft = {
        id: 'draft-queue-separate-1',
        name: 'Draft note',
        body: 'Draft body for separate history section',
        createdAt: '2026-09-28T10:00:00.000Z',
        updatedAt: '2026-09-29T18:35:00.000Z',
      };
      Object.defineProperty(window, 'draftStorage', {
        configurable: true,
        value: {
          load: async () => ({
            success: true,
            store: {
              schemaVersion: 1,
              migrationVersion: 1,
              savedDrafts: [draft],
              workspaceDraft: null,
            },
          }),
        },
      });
  
      renderHistory([upcomingRecord]);
      fireEvent.click(screen.getByRole('tab', { name: 'Черновики' }));
  
      expect(await screen.findByText('Draft note')).toBeInTheDocument();
      expect(screen.queryByText(/Черновики вынесены отдельно/i)).not.toBeInTheDocument();
      expect(screen.getByRole('tab', { name: 'Черновики' }).textContent).toContain('1');
      delete (window as { draftStorage?: unknown }).draftStorage;
    });
  
  it('loads saved Studio drafts from browser fallback storage when the desktop bridge is unavailable', async () => {
      const originalDraftStorage = Object.getOwnPropertyDescriptor(window, 'draftStorage');
      try {
        Reflect.deleteProperty(window, 'draftStorage');
        expect(writeWorkspaceDraftStoreFallback({
          schemaVersion: 3,
          migrationVersion: 1,
          savedDrafts: [{
            id: 'browser-studio-draft',
            name: 'Browser draft',
            body: 'Draft available without the desktop bridge',
            createdAt: '2026-09-28T10:00:00.000Z',
            updatedAt: '2026-09-29T18:35:00.000Z',
          }],
          workspaceDraft: null,
          documentHistories: {},
        })).toBe(true);
  
        renderHistory([]);
        fireEvent.click(screen.getByRole('tab', { name: 'Черновики' }));
  
        expect(await screen.findByText('Browser draft')).toBeInTheDocument();
      } finally {
        if (originalDraftStorage) Object.defineProperty(window, 'draftStorage', originalDraftStorage);
        else Reflect.deleteProperty(window, 'draftStorage');
        window.localStorage.removeItem('xmsgi-draft-store-fallback');
        window.localStorage.removeItem('awaitmsg-draft-store-fallback');
      }
    });
  
  it('shows a load error instead of claiming saved drafts are absent', async () => {
      const originalDraftStorage = Object.getOwnPropertyDescriptor(window, 'draftStorage');
      try {
        Object.defineProperty(window, 'draftStorage', {
          configurable: true,
          value: { load: vi.fn().mockResolvedValue({ success: false, error: 'storage unavailable' }) },
        });
  
        renderHistory([]);
        fireEvent.click(screen.getByRole('tab', { name: 'Черновики' }));
  
        expect(await screen.findByText('Черновики не загружены.')).toBeInTheDocument();
        expect(screen.queryByText('В этой категории пока пусто')).not.toBeInTheDocument();
      } finally {
        if (originalDraftStorage) Object.defineProperty(window, 'draftStorage', originalDraftStorage);
        else Reflect.deleteProperty(window, 'draftStorage');
      }
    });
  
  it('refreshes saved Studio drafts while Posts remains open', async () => {
      const originalDraftStorage = Object.getOwnPropertyDescriptor(window, 'draftStorage');
      const draft = {
        id: 'live-studio-draft',
        name: 'Newly saved draft',
        body: 'Saved while Posts is open',
        createdAt: '2026-09-28T10:00:00.000Z',
        updatedAt: '2026-09-29T18:35:00.000Z',
      };
      const load = vi.fn()
        .mockResolvedValueOnce({
          success: true,
          store: { schemaVersion: 1, migrationVersion: 1, savedDrafts: [], workspaceDraft: null },
        })
        .mockResolvedValue({
          success: true,
          store: { schemaVersion: 1, migrationVersion: 1, savedDrafts: [draft], workspaceDraft: null },
        });
      Object.defineProperty(window, 'draftStorage', {
        configurable: true,
        value: { load },
      });
  
      try {
        renderHistory([]);
        fireEvent.click(screen.getByRole('tab', { name: 'Черновики' }));
        expect(await screen.findByText('В этой категории пока пусто')).toBeInTheDocument();
  
        window.dispatchEvent(new Event(SAVED_STUDIO_DRAFTS_UPDATED_EVENT));
  
        expect(await screen.findByText('Newly saved draft')).toBeInTheDocument();
        expect(load).toHaveBeenCalledTimes(2);
      } finally {
        if (originalDraftStorage) Object.defineProperty(window, 'draftStorage', originalDraftStorage);
        else Reflect.deleteProperty(window, 'draftStorage');
      }
    });
  
  it('does not show stale Studio drafts while reloading Posts after closing and reopening', async () => {
      const originalDraftStorage = Object.getOwnPropertyDescriptor(window, 'draftStorage');
      const oldDraft = {
        id: 'old-draft',
        name: 'Old draft',
        body: 'Old content',
        createdAt: '2026-09-28T10:00:00.000Z',
        updatedAt: '2026-09-28T10:00:00.000Z',
      };
      const newDraft = {
        id: 'new-draft',
        name: 'New draft',
        body: 'New content',
        createdAt: '2026-09-29T10:00:00.000Z',
        updatedAt: '2026-09-29T10:00:00.000Z',
      };
      const storeFor = (draft: typeof oldDraft) => ({
        schemaVersion: 1,
        migrationVersion: 1,
        savedDrafts: [draft],
        workspaceDraft: null,
      });
      let resolveReload!: (result: { success: boolean; store: ReturnType<typeof storeFor> }) => void;
      const reload = new Promise<{ success: boolean; store: ReturnType<typeof storeFor> }>((resolve) => {
        resolveReload = resolve;
      });
      const load = vi.fn()
        .mockResolvedValueOnce({ success: true, store: storeFor(oldDraft) })
        .mockReturnValueOnce(reload);
      Object.defineProperty(window, 'draftStorage', {
        configurable: true,
        value: { load },
      });
  
      const drawer = (isOpen: boolean) => (
        <LocaleProvider>
          <HistoryDrawer
            isOpen={isOpen}
            onClose={vi.fn()}
            records={[]}
            onCancel={vi.fn()}
            onReschedule={vi.fn()}
            onSendNow={vi.fn()}
            onDelete={vi.fn()}
            onOpenDraft={vi.fn()}
            onClearSent={vi.fn()}
            onClearDrafts={vi.fn().mockResolvedValue(true)}
          />
        </LocaleProvider>
      );
  
      try {
        const view = render(drawer(true));
        fireEvent.click(screen.getByRole('tab', { name: 'Черновики' }));
        expect(await screen.findByText('Old draft')).toBeInTheDocument();
  
        view.rerender(drawer(false));
        view.rerender(drawer(true));
  
        expect(screen.queryByText('Old draft')).not.toBeInTheDocument();
        expect(screen.getByText('Черновики загружаются.')).toBeInTheDocument();
        await act(async () => {
          resolveReload({ success: true, store: storeFor(newDraft) });
          await reload;
        });
        expect(await screen.findByText('New draft')).toBeInTheDocument();
      } finally {
        if (originalDraftStorage) Object.defineProperty(window, 'draftStorage', originalDraftStorage);
        else Reflect.deleteProperty(window, 'draftStorage');
      }
    });
  
  it('opens the records list at the top', () => {
      const originalScrollHeight = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'scrollHeight');
      Object.defineProperty(HTMLElement.prototype, 'scrollHeight', {
        configurable: true,
        get: () => 640,
      });
  
      try {
        const props = {
          onClose: vi.fn(),
          records: [upcomingRecord, personalUpcomingRecord],
          onCancel: vi.fn(),
          onReschedule: vi.fn(),
          onSendNow: vi.fn(),
          onDelete: vi.fn(),
          onOpenDraft: vi.fn(),
          onClearSent: vi.fn(),
        };
        const view = render(<LocaleProvider><HistoryDrawer {...props} isOpen={false} /></LocaleProvider>);
  
        view.rerender(<LocaleProvider><HistoryDrawer {...props} isOpen /></LocaleProvider>);
  
        expect(view.container.querySelector('.history-record-list')?.scrollTop).toBe(0);
      } finally {
        if (originalScrollHeight) {
          Object.defineProperty(HTMLElement.prototype, 'scrollHeight', originalScrollHeight);
        } else {
          Reflect.deleteProperty(HTMLElement.prototype, 'scrollHeight');
        }
      }
    });
  
  it('finds records by scheduled time', () => {
      searchHistory('17:30');
  
      expect(screen.getByText('XMSGi Updates')).toBeInTheDocument();
      expect(screen.getAllByRole('article')).toHaveLength(1);
    });
  
  it('finds records by message text', () => {
      searchHistory('шаблонов telegram');
  
      expect(screen.getByText('XMSGi Updates')).toBeInTheDocument();
      expect(screen.getAllByRole('article')).toHaveLength(1);
    });
  
  it('finds records by chat name', () => {
      searchHistory('@xmsgi_updates');
  
      expect(screen.getByText('XMSGi Updates')).toBeInTheDocument();
      expect(screen.getAllByRole('article')).toHaveLength(1);
    });
  
  it('finds records by attachment name', () => {
      searchHistory('brief.pdf');
  
      expect(screen.getByText('XMSGi Updates')).toBeInTheDocument();
      expect(screen.getAllByRole('article')).toHaveLength(1);
    });
  
  it('shows frequent hashtags as quick filters and searches by clicking one', () => {
      const taggedRecord = normalizeScheduledMessages([{
        ...scheduledMessage,
        id: 'tagged-record',
        text: 'Запуск #studio #release',
      }], 'workspace', 'sent', [channel])[0];
      const repeatedTagRecord = normalizeScheduledMessages([{
        ...scheduledMessage,
        id: 'repeated-tag-record',
        text: 'План #release',
        attachments: [],
      }], 'personal', 'sent', [])[0];
      const { container } = renderHistory([taggedRecord, repeatedTagRecord]);
  
      const tagGroup = within(screen.getByRole('group', { name: 'Фильтр по хэштегам' }));
      expect(tagGroup.getByRole('button', { name: '#release' })).toHaveAttribute('title', '#release (2)');
      expect(tagGroup.getByRole('button', { name: '#studio' })).toBeInTheDocument();
  
      fireEvent.click(tagGroup.getByRole('button', { name: '#release' }));
  
      expect(screen.getAllByRole('article')).toHaveLength(2);
      expect(screen.getByRole('textbox', { name: 'Поиск по истории' })).toHaveValue('#release');
      expect(container.querySelector('.history-search-tags')).not.toBeInTheDocument();
    });
  
  it('matches hashtags without case sensitivity and supports Cyrillic hashtags', () => {
      const taggedRecord = normalizeScheduledMessages([{
        ...scheduledMessage,
        id: 'cyrillic-tagged-record',
        text: 'Обновление #РелизКанала',
      }], 'workspace', 'sent', [channel])[0];
  
      renderHistory([taggedRecord]);
      fireEvent.change(screen.getByRole('textbox', { name: 'Поиск по истории' }), {
        target: { value: '#релизканала' },
      });
  
      expect(screen.getByText('XMSGi Updates')).toBeInTheDocument();
      expect(screen.getAllByRole('article')).toHaveLength(1);
    });
  
  it('finds Planner drafts by reminder type', () => {
      const plannerDraft = normalizePlannerDraft(
        'Собрать материалы',
        null,
        '2026-09-29T17:30:00.000Z',
        [],
        [],
        'meeting',
      );
      renderHistory(plannerDraft ? [plannerDraft] : []);
      fireEvent.click(screen.getByRole('tab', { name: 'Черновики' }));
      fireEvent.change(screen.getByRole('textbox', { name: 'Поиск по истории' }), {
        target: { value: 'встреча' },
      });
  
      expect(screen.getByRole('article')).toHaveTextContent('Собрать материалы');
    });
  
  it('counts results within the selected category and clears an empty search', () => {
      renderHistory([upcomingRecord, personalUpcomingRecord, completedRecord]);
      expect(screen.getByText('Показано 2 из 2')).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'Планер' }));
      expect(screen.getByText('Показано 1 из 1')).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'Экспортировать текущую категорию' }));
      expect(screen.getByRole('menu', { name: 'Формат экспорта' })).toBeInTheDocument();
      fireEvent.change(screen.getByRole('textbox', { name: 'Поиск по истории' }), {
        target: { value: 'нет такого сообщения' },
      });
  
      expect(screen.getByText('Найдено 0 из 2')).toBeInTheDocument();
      expect(screen.getByText('Ничего не найдено')).toBeInTheDocument();
      expect(screen.queryByRole('menu', { name: 'Формат экспорта' })).not.toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'Очистить поиск' }));
  
      expect(screen.getAllByRole('article')).toHaveLength(1);
      expect(screen.getByText('Показано 1 из 1')).toBeInTheDocument();
    });
  
  it('reserves the clear-button slot while the search is empty', () => {
      const { container } = renderHistory();
      const clearButton = container.querySelector<HTMLButtonElement>('.history-search-clear')!;
  
      expect(clearButton).toBeDisabled();
      expect(clearButton).toHaveClass('is-reserved');
      fireEvent.change(screen.getByRole('textbox', { name: 'Поиск по истории' }), {
        target: { value: 'x' },
      });
      expect(clearButton).toBeEnabled();
      expect(clearButton).not.toHaveClass('is-reserved');
    });
  
  it('places the clear button beside the input and keeps the result count last', () => {
      const { container } = renderHistory();
      const input = screen.getByRole('textbox', { name: 'Поиск по истории' });
      const clearButton = screen.getByRole('button', { name: 'Очистить поиск' });
      const resultCount = container.querySelector('.history-result-count')!;
  
      expect(input.compareDocumentPosition(clearButton) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
      expect(clearButton.compareDocumentPosition(resultCount) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });
  
  it('groups a long history list by calendar day', () => {
      const nextDayRecord = normalizeScheduledMessages([{
        ...scheduledMessage,
        id: 'scheduled-next-day',
        when: '2026-09-30T17:30:00.000Z',
      }], 'workspace', 'upcoming', [channel])[0];
      renderHistory([upcomingRecord, nextDayRecord]);
  
      expect(screen.getAllByRole('heading', { level: 3 })).toHaveLength(2);
      expect(screen.getAllByRole('article')).toHaveLength(2);
    });
  
  it('keeps one date strip pinned and updates its label while scrolling Posts', () => {
      const styles = readGlobalStyles();
      window.localStorage.setItem('xmsgi-history-filters', JSON.stringify({ statusFilter: 'drafts' }));
      const firstDraft = normalizeSavedDraft({
        id: 'posts-first-day',
        name: 'First draft',
        body: 'First',
        createdAt: '2026-09-29T10:00:00.000Z',
        updatedAt: '2026-09-29T10:00:00.000Z',
      });
      const secondDraft = normalizeSavedDraft({
        id: 'posts-next-day',
        name: 'Second draft',
        body: 'Second',
        createdAt: '2026-09-30T10:00:00.000Z',
        updatedAt: '2026-09-30T10:00:00.000Z',
      });
      const { container } = renderHistoryPage([firstDraft, secondDraft]);
      const list = container.querySelector<HTMLDivElement>('.history-record-list')!;
      const stickyDate = container.querySelector<HTMLDivElement>('.history-date-sticky')!;
      const [firstRecord, secondRecord] = Array.from(list.querySelectorAll<HTMLElement>('.history-record'));
  
      expect(list.querySelectorAll('.history-date-heading')).toHaveLength(0);
      expect(container.querySelector('.history-list-pane')).toContainElement(stickyDate);
      expect(container.querySelector('.history-list-pane')).toContainElement(list);
      expect(stickyDate.compareDocumentPosition(list) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
      expect(stickyDate).toHaveTextContent(firstRecord.dataset.historyDayLabel!);
      expect(styles).toMatch(
        /\.history-date-sticky\s*\{[^}]*display:\s*flex;[^}]*min-width:\s*0;[^}]*align-items:\s*center;[^}]*flex:\s*0 0 auto;[^}]*width:\s*100%;[^}]*box-sizing:\s*border-box;/,
      );
      expect(styles).toMatch(/\.history-date-sticky\s*\{[^}]*height:\s*40px;[^}]*min-height:\s*40px;/);
      expect(styles).toMatch(
        /\.history-draft-color-filters\s*\{[^}]*flex:\s*0 0 auto;[^}]*max-width:\s*calc\(100% - 96px\);[^}]*padding-block:\s*4px;[^}]*margin-block:\s*-4px;[^}]*flex-wrap:\s*nowrap;[^}]*overflow-x:\s*auto;/,
      );
      expect(styles).toMatch(
        /@container \(max-width:\s*480px\)\s*\{\s*\.history-content\.is-page \.history-draft-color-filters\s*\{\s*max-width:\s*calc\(100% - 88px\);\s*justify-content:\s*flex-start;\s*transform:\s*none;\s*box-sizing:\s*border-box;\s*padding-left:\s*3px;\s*padding-right:\s*10px;/,
      );
      expect(styles).toMatch(
        /\.history-content\.is-page \.history-draft-color-filters \.workspace-page-draft-selected-color\s*\{\s*display:\s*none;/,
      );
      expect(styles).toMatch(
        /\.history-date-sticky-label\s*\{[^}]*flex:\s*0 1 auto;[^}]*min-width:\s*0;[^}]*overflow:\s*hidden;[^}]*text-overflow:\s*ellipsis;/,
      );
      expect(styles).toMatch(
        /\.history-draft-color-filters\s*\{[^}]*gap:\s*2px;/,
      );
      expect(styles).toMatch(
        /\.history-draft-color-filters \.workspace-page-draft-color-filter\s*\{[^}]*width:\s*35px;[^}]*min-width:\s*35px;[^}]*flex:\s*0 0 35px;[^}]*grid-template-columns:\s*15px 18px;/,
      );
      expect(styles).toMatch(
        /\.history-draft-color-filters \.workspace-page-draft-color-count\s*\{[^}]*width:\s*18px;[^}]*min-width:\s*18px;[^}]*font-size:\s*11px;[^}]*font-variant-numeric:\s*tabular-nums;[^}]*white-space:\s*nowrap;[^}]*text-align:\s*center;/,
      );
      expect(styles).toMatch(
        /\.history-draft-color-filters \.workspace-page-draft-color-dot\s*\{[^}]*border-radius:\s*50%;/,
      );
      Object.defineProperty(list, 'clientTop', { configurable: true, value: 0 });
      Object.defineProperty(list, 'getBoundingClientRect', {
        configurable: true,
        value: () => new DOMRect(0, 0, 400, 300),
      });
      Object.defineProperty(firstRecord, 'getBoundingClientRect', {
        configurable: true,
        value: () => new DOMRect(0, -120, 400, 100),
      });
      Object.defineProperty(secondRecord, 'getBoundingClientRect', {
        configurable: true,
        value: () => new DOMRect(0, 20, 400, 100),
      });
  
      fireEvent.scroll(list);
      expect(stickyDate).toHaveTextContent(secondRecord.dataset.historyDayLabel!);
    });
  
  it('uses the same color-dot hover treatment in both themes as Studio', () => {
      expect(workspacePageStyles).toMatch(
        /html\[data-theme='light'\] \.history-drawer\.is-page \.history-draft-color-filters .*:is\(:hover, :focus-visible\) \.workspace-page-draft-color-dot,\s*html\[data-theme='dark'\] \.history-drawer\.is-page \.history-draft-color-filters .*:is\(:hover, :focus-visible\) \.workspace-page-draft-color-dot\s*\{[^}]*box-shadow:\s*0 0 0 2px var\(--draft-swatch-color\), 0 0 7px 1px color-mix\(in srgb, var\(--draft-swatch-color\) 56%, transparent\) !important;/,
      );
      expect(workspacePageStyles).toMatch(
        /html\[data-theme\] \.history-drawer\.is-page \.history-draft-color-filters \.workspace-page-draft-color-filter\[aria-pressed='true'\] \.workspace-page-draft-color-dot\s*\{[\s\S]*?transform:\s*none !important;/,
      );
    });
  
  it('keeps mixed Planner and Studio drafts together in All without applying a saved color filter', () => {
      window.localStorage.setItem('xmsgi-history-filters', JSON.stringify({ statusFilter: 'drafts' }));
      window.localStorage.setItem('xmsgi_saved_draft_color_filter', 'coral');
      const studioDraft = normalizeSavedDraft({
        id: 'posts-all-studio-draft',
        name: 'Studio draft in All',
        body: 'Studio',
        color: 'coral',
        createdAt: '2026-09-29T09:00:00.000Z',
        updatedAt: '2026-09-29T09:00:00.000Z',
      });
      const plannerDraft = normalizePlannerDraft('Planner draft in All', null, '2026-09-29T10:00:00.000Z')!;
      const { container } = renderHistoryPage([studioDraft, plannerDraft]);

      expect(container.querySelector('.history-source-select')).toHaveTextContent('Все');
      expect(container.querySelector('.history-draft-color-filters')).toBeNull();
      expect(container.querySelectorAll('.history-record')).toHaveLength(2);
      expect(screen.getByText('Studio draft in All')).toBeInTheDocument();
      expect(screen.getByText('Planner draft in All')).toBeInTheDocument();
    });

  it('filters Studio drafts by color on the active date strip and keeps zero-match colors clearable', () => {
      window.localStorage.setItem('xmsgi-history-filters', JSON.stringify({ statusFilter: 'drafts' }));
      window.localStorage.removeItem('xmsgi_saved_draft_color_filter');
      const grayDraft = normalizeSavedDraft({
        id: 'posts-gray-draft',
        name: 'Gray draft',
        body: 'Gray',
        color: 'gray',
        createdAt: '2026-09-29T10:00:00.000Z',
        updatedAt: '2026-09-29T10:00:00.000Z',
      });
      const coralDraft = normalizeSavedDraft({
        id: 'posts-coral-draft',
        name: 'Coral draft',
        body: 'Coral',
        color: 'coral',
        createdAt: '2026-09-29T09:00:00.000Z',
        updatedAt: '2026-09-29T09:00:00.000Z',
      });
      const plannerDraft = normalizePlannerDraft('Planner draft without a color', null, '2026-09-29T08:00:00.000Z')!;
      const { container, unmount } = renderHistoryPage([grayDraft, coralDraft, plannerDraft]);
      selectHistorySource('Studio');
      const stickyDate = container.querySelector<HTMLDivElement>('.history-date-sticky')!;
      const filterGroup = stickyDate.querySelector<HTMLDivElement>('.history-draft-color-filters')!;
      const grayFilter = filterGroup.querySelector<HTMLButtonElement>('[data-color="gray"]')!.closest('button')!;
      const coralFilter = filterGroup.querySelector<HTMLButtonElement>('[data-color="coral"]')!.closest('button')!;
      const amberFilter = filterGroup.querySelector<HTMLButtonElement>('[data-color="amber"]')!.closest('button')!;
  
      expect(container.querySelector('.history-date-sticky-label')).toHaveTextContent(
        container.querySelector('.history-record')?.getAttribute('data-history-day-label') ?? '',
      );
      expect(grayFilter).toHaveTextContent('1');
      expect(coralFilter).toHaveTextContent('1');
      expect(amberFilter).toHaveTextContent('0');
      expect(grayFilter).toHaveAttribute('aria-pressed', 'false');
      expect(coralFilter).toHaveAttribute('aria-pressed', 'false');
      expect(grayFilter.querySelector('.workspace-page-draft-color-dot')).toHaveStyle({ borderRadius: '50%' });
  
      fireEvent.mouseEnter(coralFilter);
      expect(container.querySelector('.workspace-page-draft-selected-color')).toHaveAttribute('data-color', 'coral');
      expect(container.querySelector('.workspace-page-draft-selected-color')).toHaveTextContent(/\S/);
      fireEvent.mouseLeave(coralFilter);
      expect(container.querySelector('.workspace-page-draft-selected-color')).toBeNull();
  
      fireEvent.click(coralFilter);
      expect(coralFilter).toHaveAttribute('aria-pressed', 'true');
      expect(container.querySelector('.workspace-page-draft-selected-color')).toHaveAttribute('data-color', 'coral');
      expect(container.querySelectorAll('.history-record')).toHaveLength(1);
      expect(container.querySelector('[data-draft-color="coral"]')).toBeInTheDocument();
      expect(screen.queryByText('Planner draft without a color')).not.toBeInTheDocument();
  
      fireEvent.mouseEnter(amberFilter);
      expect(container.querySelector('.workspace-page-draft-selected-color')).toHaveAttribute('data-color', 'amber');
      fireEvent.mouseLeave(amberFilter);
      expect(container.querySelector('.workspace-page-draft-selected-color')).toHaveAttribute('data-color', 'coral');
  
      fireEvent.click(amberFilter);
      expect(amberFilter).toHaveAttribute('aria-pressed', 'true');
      expect(container.querySelector('.workspace-page-draft-selected-color')).toHaveAttribute('data-color', 'amber');
      expect(container.querySelector('.workspace-page-draft-selected-color')).toHaveTextContent(/\S/);
      expect(container.querySelectorAll('.history-record')).toHaveLength(0);
      expect(screen.queryByText('Planner draft without a color')).not.toBeInTheDocument();
      expect(container.querySelector('.history-date-sticky')).toContainElement(filterGroup);
      fireEvent.click(amberFilter);
      expect(container.querySelectorAll('.history-record')).toHaveLength(2);
      expect(amberFilter).toHaveAttribute('aria-pressed', 'false');
      expect(container.querySelector('.workspace-page-draft-selected-color')).toBeNull();
  
      fireEvent.click(coralFilter);
      expect(container.querySelectorAll('.history-record')).toHaveLength(1);
      expect(coralFilter).toHaveAttribute('aria-pressed', 'true');
      fireEvent.click(coralFilter);
      expect(container.querySelectorAll('.history-record')).toHaveLength(2);
      expect(coralFilter).toHaveAttribute('aria-pressed', 'false');
      expect(window.localStorage.getItem('xmsgi_saved_draft_color_filter')).toBeNull();
      unmount();
    });
  
  it('automatically selects the only draft color when that is the only color remaining', async () => {
      window.localStorage.setItem('xmsgi-history-filters', JSON.stringify({ statusFilter: 'drafts' }));
      window.localStorage.setItem('xmsgi_saved_draft_color_filter', 'coral');
      const grayDraft = normalizeSavedDraft({
        id: 'posts-only-gray-draft',
        name: 'Only gray draft',
        body: 'Gray',
        color: 'gray',
        createdAt: '2026-09-29T10:00:00.000Z',
        updatedAt: '2026-09-29T10:00:00.000Z',
      });
      const { container } = renderHistoryPage([grayDraft]);
      selectHistorySource('Studio');
      const grayFilter = await screen.findByRole('button', { name: 'Цвет черновика: Серый' });
  
      await waitFor(() => expect(grayFilter).toHaveAttribute('aria-pressed', 'true'));
      expect(container.querySelector('.history-record')).toHaveAttribute('data-draft-color', 'gray');
      expect(window.localStorage.getItem('xmsgi_saved_draft_color_filter')).toBe('gray');
    });
});
