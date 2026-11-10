import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, expect, it, vi, describe } from 'vitest';
import type { ScheduledMessage } from '@/types';
import { LocaleProvider } from '@/lib/i18n';
import { HistoryDrawer } from './HistoryDrawer';
import { normalizePlannerDraft, normalizeSavedDraft, normalizeSavedPlannerDraft, normalizeScheduledMessages } from './historyModel';
import { readGlobalStyles, scheduledMessage, channel, upcomingRecord, completedRecord, workspaceSentRecord, personalUpcomingRecord, renderHistory, renderHistoryPage, selectHistorySource, openSourceMenu, selectHistoryErrors } from './HistoryDrawer.testUtils';

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

  it('keeps the empty date strip space stable when the selected category is empty and history is ready', async () => {
      const { container } = renderHistoryPage([]);

      await waitFor(() => {
        expect(container.querySelector('.history-record-list')).toHaveAttribute('aria-busy', 'false');
      });
      expect(container.querySelector('.history-date-sticky')).toHaveClass('is-empty');
      expect(readGlobalStyles()).toMatch(/\.history-date-sticky\.is-empty\s*\{\s*visibility:\s*hidden;\s*\}/);
      expect(readGlobalStyles()).toMatch(/\.history-date-sticky\s*\{[^}]*height:\s*40px;[^}]*min-height:\s*40px;/);
    });

  it('waits for all history data before automatically selecting the only draft color', async () => {
      const originalDraftStorage = Object.getOwnPropertyDescriptor(window, 'draftStorage');
      type DraftLoadResult = {
        success: true;
        store: {
          schemaVersion: 1;
          migrationVersion: 1;
          savedDrafts: never[];
          workspaceDraft: null;
        };
      };
      let resolveDraftLoad!: (result: DraftLoadResult) => void;
      Object.defineProperty(window, 'draftStorage', {
        configurable: true,
        value: {
          load: vi.fn(() => new Promise<DraftLoadResult>((resolve) => {
            resolveDraftLoad = resolve;
          })),
        },
      });

      window.localStorage.setItem('xmsgi-history-filters', JSON.stringify({ statusFilter: 'drafts' }));
      window.localStorage.removeItem('xmsgi_saved_draft_color_filter');
      const grayDraft = normalizeSavedDraft({
        id: 'posts-loading-only-gray-draft',
        name: 'Only gray draft',
        body: 'Gray',
        color: 'gray',
        createdAt: '2026-09-29T10:00:00.000Z',
        updatedAt: '2026-09-29T10:00:00.000Z',
      });
      const renderDrawer = (recordsReady: boolean) => (
        <LocaleProvider>
          <HistoryDrawer
            isOpen
            pageMode
            historyRecordsReady={recordsReady}
            sourceFilterOnOpen="workspace"
            statusFilterOnOpen="drafts"
            onClose={vi.fn()}
            records={[grayDraft]}
            onCancel={vi.fn()}
            onReschedule={vi.fn()}
            onSendNow={vi.fn()}
            onDelete={vi.fn()}
            onOpenDraft={vi.fn()}
            onClearSent={vi.fn()}
          />
        </LocaleProvider>
      );
  
      try {
        const view = render(renderDrawer(false));
        const grayFilter = await screen.findByRole('button', { name: 'Цвет черновика: Серый' });
        expect(grayFilter).toHaveAttribute('aria-pressed', 'false');
  
        await act(async () => {
          resolveDraftLoad({
            success: true,
            store: {
              schemaVersion: 1,
              migrationVersion: 1,
              savedDrafts: [],
              workspaceDraft: null,
            },
          });
        });
        view.rerender(renderDrawer(true));
  
        await waitFor(() => expect(grayFilter).toHaveAttribute('aria-pressed', 'true'));
      } finally {
        if (originalDraftStorage) Object.defineProperty(window, 'draftStorage', originalDraftStorage);
        else Reflect.deleteProperty(window, 'draftStorage');
      }
    });
  
  it('reserves the draft color filter row while drafts are loading', async () => {
    const originalDraftStorage = Object.getOwnPropertyDescriptor(window, 'draftStorage');
    type DraftLoadResult = {
      success: true;
      store: {
        schemaVersion: 1;
        migrationVersion: 1;
        savedDrafts: Array<{
          id: string;
          name: string;
          body: string;
          color: 'gray';
          createdAt: string;
          updatedAt: string;
        }>;
        workspaceDraft: null;
      };
    };
    let resolveDraftLoad!: (result: DraftLoadResult) => void;
    Object.defineProperty(window, 'draftStorage', {
      configurable: true,
      value: {
        load: vi.fn(() => new Promise<DraftLoadResult>((resolve) => {
          resolveDraftLoad = resolve;
        })),
      },
    });
    window.localStorage.setItem('xmsgi-history-filters', JSON.stringify({ statusFilter: 'drafts' }));

    const renderDrawer = (recordsReady: boolean) => (
      <LocaleProvider>
        <HistoryDrawer
          isOpen
          pageMode
          historyRecordsReady={recordsReady}
          sourceFilterOnOpen="workspace"
          statusFilterOnOpen="drafts"
          onClose={vi.fn()}
          records={[]}
          onCancel={vi.fn()}
          onReschedule={vi.fn()}
          onSendNow={vi.fn()}
          onDelete={vi.fn()}
          onOpenDraft={vi.fn()}
          onClearSent={vi.fn()}
        />
      </LocaleProvider>
    );

    try {
      const view = render(renderDrawer(false));
      const reservedRow = await waitFor(() => {
        const row = view.container.querySelector('.history-date-sticky.is-layout-reserve');
        expect(row).toBeInTheDocument();
        return row;
      });

      await act(async () => {
        resolveDraftLoad({
          success: true,
          store: {
            schemaVersion: 1,
            migrationVersion: 1,
            savedDrafts: [{
              id: 'loading-reserve-draft',
              name: 'Loaded draft',
              body: 'Draft body',
              color: 'gray',
              createdAt: '2026-09-29T10:00:00.000Z',
              updatedAt: '2026-09-29T10:00:00.000Z',
            }],
            workspaceDraft: null,
          },
        });
      });
      view.rerender(renderDrawer(true));

      const visibleRow = view.container.querySelector('.history-date-sticky');
      expect(visibleRow).toBe(reservedRow);
      expect(visibleRow).not.toHaveClass('is-layout-reserve');
      expect(visibleRow).toContainElement(view.container.querySelector('.history-draft-color-filters'));
    } finally {
      if (originalDraftStorage) Object.defineProperty(window, 'draftStorage', originalDraftStorage);
      else Reflect.deleteProperty(window, 'draftStorage');
    }
  });

  it('keeps the only draft color unselected after the user clears it, including after remount', async () => {
      window.localStorage.setItem('xmsgi-history-filters', JSON.stringify({ statusFilter: 'drafts' }));
      window.localStorage.removeItem('xmsgi_saved_draft_color_filter');
      const grayDraft = normalizeSavedDraft({
        id: 'posts-dismissible-only-gray-draft',
        name: 'Only gray draft',
        body: 'Gray',
        color: 'gray',
        createdAt: '2026-09-29T10:00:00.000Z',
        updatedAt: '2026-09-29T10:00:00.000Z',
      });
  
      const firstRender = renderHistoryPage([grayDraft]);
      selectHistorySource('Studio');
      const grayFilter = await screen.findByRole('button', { name: 'Цвет черновика: Серый' });
      await waitFor(() => expect(grayFilter).toHaveAttribute('aria-pressed', 'true'));
      fireEvent.click(grayFilter);
  
      expect(grayFilter).toHaveAttribute('aria-pressed', 'false');
      expect(firstRender.container.querySelectorAll('.history-record')).toHaveLength(1);
      expect(window.localStorage.getItem('xmsgi_saved_draft_color_filter')).toBeNull();
      expect(window.localStorage.getItem('xmsgi_dismissed_draft_color_auto_filter')).toBe('gray');
  
      firstRender.unmount();
      const secondRender = renderHistoryPage([grayDraft]);
      selectHistorySource('Studio');
      const reopenedGrayFilter = await screen.findByRole('button', { name: 'Цвет черновика: Серый' });
  
      expect(reopenedGrayFilter).toHaveAttribute('aria-pressed', 'false');
      expect(secondRender.container.querySelectorAll('.history-record')).toHaveLength(1);
      expect(window.localStorage.getItem('xmsgi_saved_draft_color_filter')).toBeNull();
    });

  it('clears the draft color filter when the Drafts tab is pressed again', async () => {
      window.localStorage.setItem('xmsgi-history-filters', JSON.stringify({ statusFilter: 'drafts' }));
      window.localStorage.setItem('xmsgi_saved_draft_color_filter', 'coral');
      const drafts = [
        normalizeSavedDraft({
          id: 'posts-coral-draft',
          name: 'Coral draft',
          body: 'Coral',
          color: 'coral',
          createdAt: '2026-09-29T10:00:00.000Z',
          updatedAt: '2026-09-29T10:00:00.000Z',
        }),
        normalizeSavedDraft({
          id: 'posts-blue-draft',
          name: 'Blue draft',
          body: 'Blue',
          color: 'blue',
          createdAt: '2026-09-29T11:00:00.000Z',
          updatedAt: '2026-09-29T11:00:00.000Z',
        }),
      ];
      const { container } = renderHistoryPage(drafts);
      selectHistorySource('Studio');
      const coralFilter = await screen.findByRole('button', { name: 'Цвет черновика: Коралловый' });
      const draftsTab = screen.getByRole('tab', { name: 'Черновики' });

      expect(coralFilter).toHaveAttribute('aria-pressed', 'true');
      expect(container.querySelectorAll('.history-record')).toHaveLength(1);

      fireEvent.click(draftsTab);

      expect(coralFilter).toHaveAttribute('aria-pressed', 'false');
      expect(container.querySelectorAll('.history-record')).toHaveLength(2);
      expect(window.localStorage.getItem('xmsgi_saved_draft_color_filter')).toBeNull();
    });
  
  it('renders a month heading inside the scrolling list for each scheduled and sent month', () => {
      const scheduledStudioRecord = normalizeScheduledMessages([{
        ...scheduledMessage,
        id: 'scheduled-studio-september',
        when: '2026-09-30T17:30:00.000Z',
      }], 'workspace', 'upcoming', [channel])[0];
      const scheduledPlannerRecord = normalizeScheduledMessages([{
        ...scheduledMessage,
        id: 'scheduled-planner-october',
        when: '2026-10-01T17:30:00.000Z',
      }], 'personal', 'upcoming', [])[0];
      const sentStudioRecord = normalizeScheduledMessages([{
        ...scheduledMessage,
        id: 'sent-studio-september',
        sentAt: '2026-09-30T18:00:00.000Z',
        status: 'sent',
      }], 'workspace', 'sent', [channel])[0];
      const sentPlannerRecord = normalizeScheduledMessages([{
        ...scheduledMessage,
        id: 'sent-planner-october',
        sentAt: '2026-10-01T18:00:00.000Z',
        status: 'sent',
      }], 'personal', 'sent', [])[0];
      const { container } = renderHistoryPage([
        scheduledStudioRecord,
        scheduledPlannerRecord,
        sentStudioRecord,
        sentPlannerRecord,
      ]);
      const styles = readGlobalStyles();
      const list = container.querySelector<HTMLDivElement>('.history-record-list')!;
      const scheduledRows = Array.from(list.querySelectorAll<HTMLElement>('.history-record'));
      const monthHeadings = Array.from(list.querySelectorAll<HTMLElement>('.history-month-heading'));
  
      expect(container.querySelector('.history-date-sticky')).toBeInTheDocument();
      expect(list).toContainElement(monthHeadings[0]);
      expect(monthHeadings).toHaveLength(2);
      expect(monthHeadings[0]).toHaveTextContent(scheduledRows[0].dataset.historyMonthLabel!);
      expect(styles).toMatch(
        /\.history-month-heading\s*\{[^}]*width:\s*calc\(100% \+ 32px\);[^}]*margin:\s*0 -16px;/,
      );
      expect(scheduledRows).toHaveLength(2);
      expect(scheduledRows[0].dataset.historyMonthLabel).not.toBe(scheduledRows[1].dataset.historyMonthLabel);
  
      fireEvent.click(container.querySelector('[data-history-filter="sent"]')!);
      const sentRows = Array.from(container.querySelectorAll<HTMLElement>('.history-record'));
      const sentHeadings = Array.from(container.querySelectorAll<HTMLElement>('.history-month-heading'));
      expect(container.querySelector('.history-date-sticky')).toBeInTheDocument();
      expect(sentRows).toHaveLength(2);
      expect(sentHeadings).toHaveLength(2);
      expect(sentHeadings[0]).toHaveTextContent(sentRows[0].dataset.historyMonthLabel!);
    });
  
  it('orders scheduled Posts by their planned date instead of their update time', () => {
      const records = normalizeScheduledMessages([
        {
          ...scheduledMessage,
          id: 'scheduled-sooner',
          when: '2026-09-29T17:30:00.000Z',
          lastAttemptAt: '2026-09-30T17:30:00.000Z',
        },
        {
          ...scheduledMessage,
          id: 'scheduled-later',
          when: '2026-09-30T17:30:00.000Z',
          lastAttemptAt: '2026-09-29T17:30:00.000Z',
        },
      ], 'workspace', 'upcoming', [channel]);
      const { container } = renderHistoryPage(records);
      const recordIds = Array.from(container.querySelectorAll<HTMLElement>('[data-history-record-id]'))
        .map((record) => record.dataset.historyRecordId);
  
      expect(recordIds).toEqual([
        'workspace:message:scheduled-sooner',
        'workspace:message:scheduled-later',
      ]);
    });
  
  it('shows failed retry rows in the dedicated Errors category', () => {
      const failedRecord = normalizeScheduledMessages([{
        ...scheduledMessage,
        id: 'failed-compact-row',
        attachments: [],
        status: 'failed' as ScheduledMessage['status'],
        lastError: 'Telegram не подтвердил отправку.',
        lastErrorDetails: {
          operation: 'publish',
          category: 'flood',
          retryable: true,
          message: 'Telegram не подтвердил отправку.',
          code: 'FLOOD_WAIT_45',
          waitSeconds: 45,
        },
        retryAction: 'send',
      }], 'workspace', 'upcoming', [channel])[0];
      const cancelledRecord = normalizeScheduledMessages([{
        ...scheduledMessage,
        id: 'cancelled-compact-row',
        attachments: [],
        text: 'Cancelled entry remains visible',
        status: 'cancelled' as ScheduledMessage['status'],
      }], 'personal', 'upcoming', [])[0];
      const imageRecord = { ...upcomingRecord, attachments: ['C:\\files\\launch-image.png'] };
  
      const { container } = renderHistoryPage([imageRecord, failedRecord, cancelledRecord]);
  
      const attachmentPreview = screen.getByLabelText('1 вложение');
      expect(attachmentPreview).toBeInTheDocument();
      expect(attachmentPreview.querySelector('img')).not.toHaveAttribute('src');
      fireEvent.error(attachmentPreview.querySelector('img') as HTMLImageElement);
      expect(attachmentPreview.querySelector('.history-record-attachment-image')).toHaveClass('is-unavailable');
      expect(screen.getAllByText(/Запланировано ·/)[0].parentElement).toHaveClass('history-record-meta');
      expect(screen.getByText('Cancelled entry remains visible')).toBeInTheDocument();
      expect(screen.getByText('Telegram не подтвердил отправку.')).toBeInTheDocument();
      expect(screen.queryByRole('tab', { name: 'Ошибки' })).not.toBeInTheDocument();
      const errorFilter = openSourceMenu().container.querySelector<HTMLButtonElement>('[data-history-filter="errors"]')!;
      expect(errorFilter).toHaveTextContent('1');
      fireEvent.click(errorFilter);
      expect(screen.getByText('Telegram не подтвердил отправку.')).toBeInTheDocument();
      fireEvent.click(container.querySelector('.history-record-open')!);
      expect(screen.getByRole('button', { name: 'Открыть в редакторе' })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Повторить отправку' })).not.toBeInTheDocument();
      expect(screen.getAllByRole('article')).toHaveLength(1);
    });
  
  it('switches from Errors to the selected source without showing its errors', () => {
      const failedRecord = normalizeScheduledMessages([{
        ...scheduledMessage,
        id: 'failed-source-switch',
        status: 'failed' as ScheduledMessage['status'],
        lastError: 'Telegram is temporarily unavailable.',
      }], 'workspace', 'upcoming', [channel])[0];
      const plannerFailedRecord = normalizeScheduledMessages([{
        ...scheduledMessage,
        id: 'failed-planner-source-switch',
        status: 'failed' as ScheduledMessage['status'],
        lastError: 'Planner error should stay hidden for Studio.',
      }], 'personal', 'upcoming', [channel])[0];
      const { container } = renderHistoryPage([failedRecord, plannerFailedRecord, upcomingRecord]);
  
      selectHistoryErrors();
      expect(screen.getByText('Telegram is temporarily unavailable.')).toBeInTheDocument();
  
      selectHistorySource('Studio');
  
      expect(container.querySelector('.history-source-select')).toHaveTextContent(/Studio/);
      expect(screen.queryByText('Telegram is temporarily unavailable.')).not.toBeInTheDocument();
      expect(screen.queryByText('Planner error should stay hidden for Studio.')).not.toBeInTheDocument();
      expect(screen.getAllByRole('article')).toHaveLength(1);
      expect(screen.getByText('Релиз нового набора шаблонов для Telegram-канала')).toBeInTheDocument();
    });
  
  it('shows all sources with errors in All, but keeps Studio and Planner free of errors', () => {
      const studioError = normalizeScheduledMessages([{
        ...scheduledMessage,
        id: 'failed-studio-section',
        status: 'failed' as ScheduledMessage['status'],
        lastError: 'Studio section error.',
      }], 'workspace', 'upcoming', [channel])[0];
      const plannerError = normalizeScheduledMessages([{
        ...scheduledMessage,
        id: 'failed-planner-section',
        status: 'failed' as ScheduledMessage['status'],
        lastError: 'Planner section error.',
      }], 'personal', 'upcoming', [channel])[0];
  
      renderHistoryPage([upcomingRecord, personalUpcomingRecord, studioError, plannerError]);
      expect(screen.getAllByRole('article')).toHaveLength(4);
      expect(screen.getByText('Studio section error.')).toBeInTheDocument();
      expect(screen.getByText('Planner section error.')).toBeInTheDocument();
  
      selectHistorySource('Studio');
      expect(screen.getAllByRole('article')).toHaveLength(1);
      expect(screen.getByText('Релиз нового набора шаблонов для Telegram-канала')).toBeInTheDocument();
      expect(screen.queryByText('Studio section error.')).not.toBeInTheDocument();
      expect(screen.queryByText('Planner section error.')).not.toBeInTheDocument();
  
      selectHistorySource('Planner');
      expect(screen.getAllByRole('article')).toHaveLength(1);
      expect(screen.getByText('Подтвердить встречу')).toBeInTheDocument();
      expect(screen.queryByText('Studio section error.')).not.toBeInTheDocument();
      expect(screen.queryByText('Planner section error.')).not.toBeInTheDocument();
  
      selectHistoryErrors();
      expect(screen.getAllByRole('article')).toHaveLength(2);
      expect(screen.getByText('Studio section error.')).toBeInTheDocument();
      expect(screen.getByText('Planner section error.')).toBeInTheDocument();
      expect(screen.queryByText('Подтвердить встречу')).not.toBeInTheDocument();
    });

  it('keeps the Errors section selected when it is empty and other categories have records', () => {
    const plannerDraft = normalizePlannerDraft('Draft must not replace empty Errors', null, '2026-10-25T11:00:00.000Z');
    const { container } = renderHistoryPage(plannerDraft ? [plannerDraft] : []);

    selectHistoryErrors();

    expect(container.querySelector('.history-source-select')).toHaveTextContent(/^(Errors|Ошибки)/);
    expect(container.querySelector('.history-status-filters')).toHaveClass('is-errors-filter');
    expect(screen.queryAllByRole('article')).toHaveLength(0);
    expect(screen.queryByText('Draft must not replace empty Errors')).not.toBeInTheDocument();
  });
  
  it('keeps failed records out of Drafts even when All is selected', () => {
      const failedRecord = normalizeScheduledMessages([{
        ...scheduledMessage,
        id: 'failed-excluded-from-drafts',
        status: 'failed' as ScheduledMessage['status'],
        lastError: 'This error must not appear in Drafts.',
      }], 'workspace', 'upcoming', [channel])[0];
      const plannerDraft = normalizePlannerDraft('Actual Planner draft', null, '2026-10-25T11:00:00.000Z');
      const { container } = renderHistoryPage(plannerDraft ? [failedRecord, plannerDraft] : [failedRecord]);
  
      fireEvent.click(container.querySelector('[data-history-filter="drafts"]')!);
  
      expect(screen.getByText('Actual Planner draft')).toBeInTheDocument();
      expect(screen.queryByText('This error must not appear in Drafts.')).not.toBeInTheDocument();
      expect(screen.getAllByRole('article')).toHaveLength(1);
      expect(container.querySelector('[data-history-filter="drafts"] .history-filter-count')).toHaveTextContent('1');
    });
  
  it('does not restore Errors as the active category from saved filters', () => {
      const failedRecord = normalizeScheduledMessages([{
        ...scheduledMessage,
        id: 'failed-saved-errors-filter',
        status: 'failed' as ScheduledMessage['status'],
        lastError: 'Saved Errors should not remain selected.',
      }], 'workspace', 'upcoming', [channel])[0];
      window.localStorage.setItem('xmsgi-history-filters', JSON.stringify({
        sourceFilter: 'all',
        statusFilter: 'errors',
      }));

      const { container } = renderHistoryPage([failedRecord]);

      expect(screen.getByText('Saved Errors should not remain selected.')).toBeInTheDocument();
      expect(container.querySelector('[data-history-filter="scheduled"]')).toHaveAttribute('aria-selected', 'true');
    });
  
  it('selects Errors as its own source section without offering a second source menu', () => {
      const failedRecord = normalizeScheduledMessages([{
        ...scheduledMessage,
        id: 'failed-exclusive-menu-selection',
        status: 'failed' as ScheduledMessage['status'],
        lastError: 'Exclusive Errors category.',
      }], 'workspace', 'upcoming', [channel])[0];
      const { container } = renderHistoryPage([failedRecord]);
  
      selectHistoryErrors();
      expect(container.querySelector('.history-source-select')).toHaveTextContent(/^(Errors|Ошибки)/);
      const sourceMenu = openSourceMenu();
      expect(sourceMenu.getByRole('menuitemradio', { name: 'Ошибки' })).toHaveAttribute('aria-checked', 'true');
      expect(sourceMenu.getByRole('menuitemradio', { name: 'Studio' })).toHaveAttribute('aria-checked', 'false');
      expect(sourceMenu.getByRole('menuitemradio', { name: 'Все' })).toHaveAttribute('aria-checked', 'false');
      expect(sourceMenu.getByRole('menuitemradio', { name: 'Планер' })).toHaveAttribute('aria-checked', 'false');
    });
  
  it('switches from Errors to the All source when a regular category is selected', () => {
      const failedRecord = normalizeScheduledMessages([{
        ...scheduledMessage,
        id: 'failed-switch-to-all-source',
        status: 'failed' as ScheduledMessage['status'],
        lastError: 'The error is not part of the Sent list.',
      }], 'workspace', 'upcoming', [channel])[0];
      window.localStorage.setItem('xmsgi-history-filters', JSON.stringify({
        sourceFilter: 'workspace',
        statusFilter: 'scheduled',
      }));
      const { container } = renderHistoryPage([failedRecord, completedRecord, workspaceSentRecord]);
  
      selectHistoryErrors();
      expect(screen.getAllByRole('article')).toHaveLength(1);
      expect(screen.getByText('The error is not part of the Sent list.')).toBeInTheDocument();
  
      fireEvent.click(container.querySelector('[data-history-filter="sent"]')!);
  
      expect(container.querySelector('.history-source-select')).toHaveTextContent(/All|Все/);
      expect(container.querySelector('[data-history-filter="sent"]')).toHaveAttribute('aria-selected', 'true');
      expect(screen.getAllByRole('article')).toHaveLength(3);
      expect(screen.getByText('Подтвердить встречу')).toBeInTheDocument();
      expect(screen.getByText('The error is not part of the Sent list.')).toBeInTheDocument();
    });
  
  it('switches from compact Errors to Studio records without filtering the Errors list by source', () => {
      const plannerFailedRecord = normalizeScheduledMessages([{
        ...scheduledMessage,
        id: 'failed-planner-compact-source-switch',
        status: 'failed' as ScheduledMessage['status'],
        lastError: 'Planner compact error.',
      }], 'personal', 'upcoming', [channel])[0];
      const failedRecord = normalizeScheduledMessages([{
        ...scheduledMessage,
        id: 'failed-compact-source-switch',
        status: 'failed' as ScheduledMessage['status'],
        lastError: 'Telegram is temporarily unavailable.',
      }], 'workspace', 'upcoming', [channel])[0];
      renderHistory([failedRecord, plannerFailedRecord, upcomingRecord]);
  
      selectHistoryErrors();
      expect(screen.getByText('Telegram is temporarily unavailable.')).toBeInTheDocument();
  
      fireEvent.click(screen.getByRole('button', { name: 'Studio' }));
  
      expect(screen.getByRole('button', { name: 'Ошибки' })).toHaveAttribute('aria-pressed', 'false');
      expect(screen.queryByText('Telegram is temporarily unavailable.')).not.toBeInTheDocument();
      expect(screen.queryByText('Planner compact error.')).not.toBeInTheDocument();
      expect(screen.getAllByRole('article')).toHaveLength(1);
      expect(screen.getByText('Релиз нового набора шаблонов для Telegram-канала')).toBeInTheDocument();
    });
  
  it('opens a failed post in Studio and puts deletion in its overflow menu', async () => {
      const failedRecord = normalizeScheduledMessages([{
        ...scheduledMessage,
        id: 'failed-open-editor',
        status: 'failed' as ScheduledMessage['status'],
        lastError: 'Telegram is temporarily unavailable.',
        retryAction: 'send',
      }], 'workspace', 'upcoming', [channel])[0];
      const onUseDraft = vi.fn().mockResolvedValue(true);
      const { container } = renderHistory(
        [failedRecord],
        vi.fn(),
        vi.fn(),
        vi.fn(),
        vi.fn(),
        vi.fn(),
        vi.fn(),
        vi.fn().mockResolvedValue(true),
        vi.fn().mockResolvedValue(true),
        onUseDraft,
      );
      selectHistoryErrors();
  
      expect(screen.queryByRole('button', { name: 'Повторить отправку' })).not.toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'Открыть в редакторе' }));
      await waitFor(() => expect(onUseDraft).toHaveBeenCalledWith(failedRecord, 'studio'));
  
      const overflowButton = container.querySelector<HTMLButtonElement>('.history-record-action.is-more')!;
      fireEvent.click(overflowButton);
      expect(screen.getByRole('menuitem', { name: 'Удалить' })).toBeInTheDocument();
      expect(screen.queryByRole('menuitem', { name: 'Повторить отправку' })).not.toBeInTheDocument();
    });
  
  it('explains why a failed post did not go through in the Errors details panel', () => {
      const failedRecord = normalizeScheduledMessages([{
        ...scheduledMessage,
        id: 'failed-reason-details',
        status: 'failed' as ScheduledMessage['status'],
        lastError: 'A wait of 45 seconds is required.',
        lastErrorDetails: {
          operation: 'publish',
          category: 'flood',
          retryable: true,
          message: 'A wait of 45 seconds is required.',
          code: 'FLOOD_WAIT_45',
          waitSeconds: 45,
        },
        retryAction: 'send',
      }], 'workspace', 'upcoming', [channel])[0];
      const { container } = renderHistoryPage([failedRecord], vi.fn());
      selectHistoryErrors();
      fireEvent.click(container.querySelector('.history-record-open')!);
  
      const toolbar = container.querySelector<HTMLElement>('.history-detail-toolbar')!;
      expect(within(toolbar).getAllByRole('button')).toHaveLength(2);
      expect(within(toolbar).getByRole('button', { name: 'Открыть в редакторе' })).toBeInTheDocument();
      expect(within(toolbar).getByRole('button', { name: 'Ещё' })).toBeInTheDocument();
      expect(within(toolbar).queryByRole('button', { name: 'Просмотр' })).not.toBeInTheDocument();
      expect(within(toolbar).queryByRole('button', { name: 'Копировать' })).not.toBeInTheDocument();
      expect(screen.getByRole('region', { name: 'Почему произошла ошибка' })).toHaveTextContent('Telegram временно ограничил частоту публикаций.');
      expect(screen.getByRole('region', { name: 'Почему произошла ошибка' })).not.toHaveTextContent('A wait of 45 seconds is required.');
      expect(screen.getByRole('region', { name: 'Почему произошла ошибка' })).toHaveTextContent('Отправка публикации');
      expect(screen.getByRole('region', { name: 'Почему произошла ошибка' })).toHaveTextContent('Можно попробовать ещё раз.');
      expect(screen.getByRole('region', { name: 'Почему произошла ошибка' })).toHaveTextContent('Дождитесь окончания ограничения и попробуйте снова.');
      expect(screen.getByRole('region', { name: 'Почему произошла ошибка' })).toHaveTextContent('45 сек.');
      expect(screen.getByRole('region', { name: 'Почему произошла ошибка' })).toHaveTextContent('FLOOD_WAIT_45');
    });
  
  const commonTelegramErrors: Array<[string, string, string]> = [
      ['CHAT_WRITE_FORBIDDEN', 'Telegram не разрешает этому аккаунту публиковать такой материал в чате.', 'Попросите администратора чата разрешить публикации или выберите другой чат.'],
      ['PEER_ID_INVALID', 'Telegram не смог открыть этот чат.', 'Проверьте, открывается ли чат и есть ли у аккаунта к нему доступ.'],
      ['FILE_PART_2_MISSING', 'Telegram не смог обработать одно из вложений.', 'Проверьте файл и попробуйте прикрепить его заново.'],
      ['MESSAGE_TOO_LONG', 'Сообщение превышает допустимую длину Telegram.', 'Сократите сообщение и попробуйте снова.'],
      ['SCHEDULE_DATE_TOO_LATE', 'Telegram не принял выбранное время планирования.', 'Выберите более позднее время и запланируйте публикацию снова.'],
    ];
  
  it.each(commonTelegramErrors)('shows a clear explanation and next step for %s', (code, cause, nextStep) => {
      const rawError = `Telegram error: ${code}`;
      const failedRecord = normalizeScheduledMessages([{
        ...scheduledMessage,
        id: `failed-${code}`,
        status: 'failed' as ScheduledMessage['status'],
        lastError: rawError,
        lastErrorDetails: {
          operation: 'publish',
          category: 'unknown',
          retryable: false,
          message: rawError,
          code,
        },
        retryAction: 'send',
      }], 'workspace', 'upcoming', [channel])[0];
      const { container, unmount } = renderHistoryPage([failedRecord]);
      selectHistoryErrors();
      fireEvent.click(container.querySelector('.history-record-open')!);
  
      const explanation = screen.getByRole('region', { name: 'Почему произошла ошибка' });
      expect(explanation).toHaveTextContent(cause);
      expect(explanation).toHaveTextContent(nextStep);
      expect(explanation).not.toHaveTextContent(rawError);
      expect(explanation).toHaveTextContent(code);
      unmount();
    });
  
  it('shows a concise actionable description when Telegram sent a scheduled post immediately', () => {
      const rawError = 'Telegram sent the message immediately instead of scheduling it.';
      const failedRecord = normalizeScheduledMessages([{
        ...scheduledMessage,
        id: 'failed-immediate-schedule',
        status: 'failed' as ScheduledMessage['status'],
        lastError: rawError,
        lastErrorDetails: {
          operation: 'publish',
          category: 'unknown',
          retryable: false,
          message: rawError,
          code: 'TELEGRAM_SCHEDULE_SENT_IMMEDIATELY',
        },
        retryAction: 'schedule',
      }], 'workspace', 'upcoming', [channel])[0];
      const { container } = renderHistoryPage([failedRecord]);
      selectHistoryErrors();
      fireEvent.click(container.querySelector('.history-record-open')!);
  
      const explanation = container.querySelector<HTMLElement>('.history-detail-error-explanation')!;
      expect(explanation).toHaveAttribute('aria-label', 'Что произошло');
      expect(explanation).toHaveTextContent('Что произошло');
      expect(explanation).toHaveTextContent(
        'Telegram отправил публикацию сразу, не запланировав её. Проверьте чат перед повторной отправкой.',
      );
      expect(explanation).not.toHaveTextContent(rawError);
      expect(explanation).not.toHaveTextContent('Автоматически повторить действие нельзя.');
      expect(explanation).not.toHaveTextContent('Планирование публикации');
      expect(explanation).not.toHaveTextContent('TELEGRAM_SCHEDULE_SENT_IMMEDIATELY');
    });
  
  it('filters the single Posts list across All, Studio, and Planner sources', () => {
      renderHistory([upcomingRecord, personalUpcomingRecord]);
  
      expect(screen.getAllByRole('article')).toHaveLength(2);
      fireEvent.click(screen.getByRole('button', { name: 'Studio' }));
      expect(screen.getAllByRole('article')).toHaveLength(1);
      expect(screen.getByText('XMSGi Updates')).toBeInTheDocument();
  
      fireEvent.click(screen.getByRole('button', { name: 'Планер' }));
      expect(screen.getAllByRole('article')).toHaveLength(1);
      expect(screen.getByRole('article')).toHaveTextContent('Подтвердить встречу');
  
      fireEvent.click(screen.getByRole('button', { name: 'Все' }));
      expect(screen.getAllByRole('article')).toHaveLength(2);
    });
  
  it('shows the most recently created scheduled record first across Planner and Studio in All', () => {
      const olderPersonalRecord = normalizeScheduledMessages([{
        ...scheduledMessage,
        id: 'older-personal',
        chatName: 'Planner older',
        createdAt: '2026-10-05T10:00:00.000Z',
        when: '2026-10-13T23:17:00.000Z',
      }], 'personal', 'upcoming', [])[0];
      const newerStudioRecord = normalizeScheduledMessages([{
        ...scheduledMessage,
        id: 'newer-studio',
        chatName: 'Studio newer',
        createdAt: '2026-10-05T12:00:00.000Z',
        when: '2026-10-07T23:17:00.000Z',
      }], 'workspace', 'upcoming', [channel])[0];
  
      renderHistory([olderPersonalRecord, newerStudioRecord]);
  
      const titles = screen.getAllByRole('article').map((article) => (
        article.querySelector('.history-record-heading strong')?.textContent
      ));
      expect(titles).toEqual(['Studio newer', 'Planner older']);
    });
  
  it('shows Planner drafts beside Studio posts in the shared Posts history', () => {
      const plannerDraft = normalizePlannerDraft('A saved Planner draft', null, '2026-10-06T10:00:00.000Z', [], [], 'meeting');
      renderHistory([upcomingRecord, personalUpcomingRecord, ...(plannerDraft ? [plannerDraft] : [])]);
  
      fireEvent.click(screen.getByRole('tab', { name: 'Черновики' }));
      expect(screen.getAllByRole('article')).toHaveLength(1);
      const plannerDraftCard = screen.getByRole('article');
      expect(plannerDraftCard).toHaveTextContent('A saved Planner draft');
      expect(plannerDraft?.draftColor).toBeUndefined();
      expect(plannerDraftCard).not.toHaveAttribute('data-draft-color');
      expect(plannerDraftCard.querySelector('.history-record-draft-dot')).toBeNull();
      expect(screen.getByLabelText('Встреча')).toHaveAttribute('data-reminder-type', 'meeting');
      fireEvent.click(screen.getByRole('button', { name: 'Планер' }));
  
      expect(screen.getByRole('tab', { name: 'Черновики' })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: 'Черновики' })).toHaveAttribute('aria-selected', 'true');
      expect(screen.getAllByRole('article')).toHaveLength(1);
      expect(screen.getByRole('article')).toHaveTextContent('A saved Planner draft');
    });
  
  it('opens saved Quick Planner drafts in the editor that opened Posts', async () => {
      const savedPlannerDraft = normalizeSavedPlannerDraft({
        id: 'saved-idea-1',
        message: 'An idea saved from Quick Planner',
        attachments: [],
        entities: [],
        reminderType: 'idea',
        savedAt: '2026-10-06T10:00:00.000Z',
      });
      const onUseDraft = vi.fn();
      renderHistory(
        [savedPlannerDraft],
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        onUseDraft,
        'planner',
      );
  
      fireEvent.click(screen.getByRole('tab', { name: 'Черновики' }));
      const savedPlannerDraftCard = screen.getByRole('article');
      expect(savedPlannerDraftCard).toHaveTextContent('An idea saved from Quick Planner');
      expect(savedPlannerDraft.draftColor).toBeUndefined();
      expect(savedPlannerDraftCard).not.toHaveAttribute('data-draft-color');
      expect(savedPlannerDraftCard.querySelector('.history-record-draft-dot')).toBeNull();
      expect(screen.getByLabelText('Идея')).toHaveAttribute('data-reminder-type', 'idea');
      fireEvent.click(screen.getByRole('button', { name: /Использовать черновик/ }));
  
      expect(onUseDraft).toHaveBeenCalledWith(savedPlannerDraft, 'planner');
      expect(screen.queryByText(/Где открыть черновик/)).not.toBeInTheDocument();
      expect(document.querySelector('.history-detail-draft-menu')).toBeNull();
      expect(document.querySelector('.history-draft-destination-menu')).toBeNull();
    });
  
  it('keeps Posts rendering for a legacy Quick Planner draft without a saved date', () => {
      const legacyDraft = normalizeSavedPlannerDraft({
        id: 'legacy-saved-idea',
        message: 'A legacy Planner draft without a date',
        attachments: [],
        entities: [],
        reminderType: null,
        savedAt: '',
      });
      renderHistory([legacyDraft]);
  
      fireEvent.click(screen.getByRole('tab', { name: 'Черновики' }));
  
      expect(screen.getByRole('article')).toHaveTextContent('A legacy Planner draft without a date');
      expect(screen.getByRole('article').querySelector('time')).not.toHaveAttribute('datetime', '');
    });
  
  it.each([
      ['Планер', 'planner'],
      ['Студия', 'studio'],
    ] as const)('opens a Quick Planner draft directly in the active %s editor', async (_destinationLabel, destination) => {
      const plannerDraft = normalizePlannerDraft(
        'An editable Quick Planner note',
        channel,
        '2026-10-06T10:00:00.000Z',
        [{ type: 'bold', offset: 3, length: 8 }],
        ['C:\\files\\planner-note.pdf'],
      );
      expect(plannerDraft).not.toBeNull();
      const { onUseDraft, onClose } = renderHistory(
        [plannerDraft!],
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        destination,
      );
      fireEvent.click(screen.getByRole('tab', { name: 'Черновики' }));
  
      fireEvent.click(screen.getByRole('button', { name: `Использовать черновик: ${plannerDraft!.title}` }));
  
      expect(onUseDraft).toHaveBeenCalledWith(plannerDraft, destination);
      expect(screen.queryByText(/Where would you like to open/)).not.toBeInTheDocument();
      expect(document.querySelector('.history-detail-draft-menu')).toBeNull();
      expect(document.querySelector('.history-draft-destination-menu')).toBeNull();
      await waitFor(() => expect(onClose).toHaveBeenCalledWith(false));
    });
  
  it('keeps Posts open when using a draft in the active editor fails', async () => {
      window.localStorage.setItem('awaitmsg_locale', 'en');
      const plannerDraft = normalizePlannerDraft(
        'An editable Quick Planner note',
        channel,
        '2026-10-06T10:00:00.000Z',
      )!;
      const onUseDraft = vi.fn().mockResolvedValue(false);
      const { onClose } = renderHistory([plannerDraft], undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, onUseDraft);
      fireEvent.click(screen.getByRole('tab', { name: 'Drafts' }));
      fireEvent.click(screen.getByRole('button', { name: `Open post: ${plannerDraft.title}` }));
      fireEvent.click(screen.getByRole('button', { name: /Use draft/ }));
      await waitFor(() => expect(onUseDraft).toHaveBeenCalledWith(plannerDraft, 'studio'));
      expect(onClose).not.toHaveBeenCalled();
      expect(screen.getByRole('dialog', { name: 'Posts' })).toBeInTheDocument();
      expect(screen.queryByText(/Where would you like to open/)).not.toBeInTheDocument();
    });
  
  it('uses the active editor from the draft detail toolbar', async () => {
      window.localStorage.setItem('awaitmsg_locale', 'en');
      const plannerDraft = normalizePlannerDraft(
        'An editable Quick Planner note',
        channel,
        '2026-10-06T10:00:00.000Z',
      )!;
      const onUseDraft = vi.fn().mockResolvedValue(true);
      const onClose = vi.fn();
      render(
        <LocaleProvider>
          <HistoryDrawer
            isOpen
            pageMode
            onClose={onClose}
            records={[plannerDraft]}
            onCancel={vi.fn()}
            onReschedule={vi.fn()}
            onSendNow={vi.fn()}
            onDelete={vi.fn()}
            onOpenDraft={vi.fn()}
            onUseDraft={onUseDraft}
            draftDestination="planner"
            onClearSent={vi.fn()}
          />
        </LocaleProvider>,
      );
  
      fireEvent.click(screen.getByRole('tab', { name: 'Drafts' }));
      fireEvent.click(screen.getByRole('button', { name: `Open post: ${plannerDraft.title}` }));
      fireEvent.click(screen.getByRole('button', { name: 'Use' }));
  
      await waitFor(() => {
        expect(onUseDraft).toHaveBeenCalledWith(plannerDraft, 'studio');
        expect(onClose).toHaveBeenCalledWith(false);
      });
      expect(screen.queryByText(/Where would you like to open/)).not.toBeInTheDocument();
      expect(document.querySelector('.history-detail-draft-menu')).toBeNull();
      expect(document.querySelector('.history-draft-destination-menu')).toBeNull();
    });
});
