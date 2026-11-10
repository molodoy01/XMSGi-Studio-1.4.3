import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi, describe } from 'vitest';
import { LocaleProvider } from '@/lib/i18n';
import { telegramGetChatHistory } from '@/services/chatAppService';
import { HistoryDrawer } from './HistoryDrawer';
import { QuickPlannerNavigationContext } from './QuickPlannerNavigationContext';
import { normalizePlannerDraft, normalizeSavedDraft, normalizeSavedPlannerDraft, normalizeScheduledMessages } from './historyModel';
import { globalStyles, colorThemeStyles, scheduledMessage, channel, upcomingRecord, completedRecord, workspaceSentRecord, renderHistoryPage, selectHistorySource } from './HistoryDrawer.testUtils';

vi.mock('@/services/chatAppService', () => ({
  telegramGetChatHistory: vi.fn(),
}));

describe('Posts page split view', () => {
  beforeEach(() => {
      window.localStorage.removeItem('xmsgi-history-filters');
      window.localStorage.removeItem('xmsgi-history-selected-record');
      window.localStorage.removeItem('xmsgi_dismissed_draft_color_auto_filter');
      window.localStorage.removeItem('xmsgi_saved_draft_color_filter');
    });

  it('selects multiple drafts with Ctrl-click and deletes only the selected count', async () => {
    const plannerDraft = normalizePlannerDraft('First planner draft', null, '2026-10-25T10:00:00.000Z')!;
    const savedDraft = normalizeSavedPlannerDraft({
      id: 'selected-planner-draft',
      message: 'Second planner draft',
      attachments: [],
      entities: [],
      reminderType: null,
      savedAt: '2026-10-25T09:00:00.000Z',
    });
    const onDelete = vi.fn().mockResolvedValue(true);
    const { container } = renderHistoryPage([plannerDraft, savedDraft], undefined, undefined, onDelete);

    fireEvent.click(container.querySelector(`[data-history-record-id="${plannerDraft.id}"]`)!, { ctrlKey: true });
    fireEvent.click(container.querySelector(`[data-history-record-id="${savedDraft.id}"]`)!, { ctrlKey: true });

    expect(container.querySelectorAll('.history-record.is-multi-selected')).toHaveLength(2);
    expect(container.querySelectorAll('.history-record.is-selected')).toHaveLength(0);
    expect(container.querySelector('.history-result-count')?.textContent).toMatch(/(?:Selected|Выбрано):\s*2/);
    expect(container.querySelector('.history-date-sticky')).not.toHaveTextContent(/Selected|Выбрано/);
    expect(container.querySelectorAll('.history-record-source.is-multi-selected')).toHaveLength(2);
    expect(container.querySelector('.history-record-source.is-multi-selected')).toHaveTextContent('Planner');
    expect(container.querySelector('.history-record-selection-check')).toBeNull();
    expect(container.querySelector('.history-export-control .history-action-label')).toHaveTextContent(/^Export$/);
    expect(container.querySelector('.history-delete-action .history-action-label')).toHaveTextContent(/^Delete$/);
    expect(container.querySelector('.history-export-button')).toHaveAccessibleName('Export');
    expect(container.querySelector('.history-delete-button')).toHaveAccessibleName('Delete drafts');
    expect(container.querySelector('.history-export-button')).not.toHaveAttribute('data-selected-count');
    fireEvent.click(container.querySelector('.history-delete-button')!);

    const confirmation = screen.getByRole('alertdialog', { name: /selected|выбранных/i });
    expect(confirmation).toHaveTextContent(/2/);
    expect(confirmation).not.toHaveTextContent('First planner draft');
    expect(confirmation).not.toHaveTextContent('Second planner draft');
    fireEvent.click(confirmation.querySelector<HTMLButtonElement>('.history-record-confirmation-action.is-primary')!);

    await waitFor(() => expect(onDelete).toHaveBeenCalledTimes(2));
    expect(onDelete).toHaveBeenCalledWith(plannerDraft, true);
    expect(onDelete).toHaveBeenCalledWith(savedDraft, true);
  });

  it('shows the multi-select hint only while the Ctrl or Cmd key is pressed', () => {
    const { container } = renderHistoryPage([upcomingRecord]);

    expect(container.querySelector('.history-selection-status')).toBeNull();

    fireEvent.keyDown(window, { key: 'Control' });
    expect(container.querySelector('.history-selection-status')).toHaveTextContent(/Ctrl\/Cmd\+click/i);
    expect(container.querySelector('.history-result-count')).toHaveTextContent(/Showing 1 of 1/);

    fireEvent.click(container.querySelector(`[data-history-record-id="${upcomingRecord.id}"]`)!, { ctrlKey: true });
    expect(container.querySelectorAll('.history-selection-status')).toHaveLength(1);
    expect(container.querySelector('.history-selection-status')).toHaveTextContent(/(?:Selected|Выбрано):\s*1/);
    expect(container.querySelector('.history-selection-status')).not.toHaveTextContent(/Ctrl\/Cmd\+click/i);

    fireEvent.keyUp(window, { key: 'Control' });
    expect(container.querySelector('.history-selection-status')).toHaveTextContent(/(?:Selected|Выбрано):\s*1/);

    fireEvent.click(container.querySelector(`[data-history-record-id="${upcomingRecord.id}"]`)!, { ctrlKey: true });
    expect(container.querySelector('.history-selection-status')).toBeNull();

    fireEvent.keyDown(window, { key: 'Meta' });
    expect(container.querySelector('.history-selection-status')).toHaveTextContent(/Ctrl\/Cmd\+click/i);

    fireEvent.keyUp(window, { key: 'Meta' });
    expect(container.querySelector('.history-selection-status')).toBeNull();
  });

  it('clears only the preview row highlight when Ctrl-selecting another record', () => {
    const personalRecord = normalizeScheduledMessages([{
      ...scheduledMessage,
      id: 'preview-highlight-personal-record',
      chatName: 'Personal schedule',
    }], 'personal', 'upcoming', [])[0];
    const { container } = renderHistoryPage([upcomingRecord, personalRecord]);
    fireEvent.click(container.querySelector(`[data-history-record-id="${upcomingRecord.id}"]`)!);

    expect(container.querySelector(`[data-history-record-id="${upcomingRecord.id}"]`)?.closest('.history-record'))
      .toHaveClass('is-selected');
    fireEvent.click(container.querySelector(`[data-history-record-id="${personalRecord.id}"]`)!, { ctrlKey: true });

    expect(container.querySelector(`[data-history-record-id="${upcomingRecord.id}"]`)?.closest('.history-record'))
      .not.toHaveClass('is-selected');
    expect(container.querySelector('.history-detail-panel')).toHaveTextContent(upcomingRecord.title);
    expect(container.querySelector(`[data-history-record-id="${personalRecord.id}"]`)?.closest('.history-record'))
      .toHaveClass('is-multi-selected');
  });

  it('opens the first non-empty category for the selected source', async () => {
      const studioDraft = normalizeSavedDraft({
        id: 'studio-draft',
        name: 'Studio draft',
        body: 'A saved Studio draft',
        entities: [],
        attachments: [],
        selectedChat: null,
        createdAt: '2026-10-25T10:00:00.000Z',
        updatedAt: '2026-10-25T10:00:00.000Z',
      });
      const plannerDraft = normalizePlannerDraft(
        'A Planner draft',
        null,
        '2026-10-25T11:00:00.000Z',
        [],
        [],
      )!;
      const { container } = renderHistoryPage([studioDraft, plannerDraft]);
      const statusFilters = container.querySelector('.history-status-filters')!;
  
      await waitFor(() => {
        expect(statusFilters.querySelector('[data-history-filter="drafts"]')).toHaveAttribute('aria-selected', 'true');
      });
  
      fireEvent.click(statusFilters.querySelector('[data-history-filter="scheduled"]')!);
      selectHistorySource('Studio');
      expect(statusFilters.querySelector('[data-history-filter="drafts"]')).toHaveAttribute('aria-selected', 'true');
      expect(screen.getByRole('article')).toHaveTextContent('Studio draft');
    });
  
  it('shows a populated category on the first Posts visit when scheduled is empty', async () => {
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
      window.localStorage.setItem('xmsgi-history-filters', JSON.stringify({
        sourceFilter: 'all',
        statusFilter: 'scheduled',
      }));
  
      try {
        const { container } = render(
          <LocaleProvider>
            <HistoryDrawer
              isOpen
              pageMode
              statusFilterOnOpen="scheduled"
              onClose={vi.fn()}
              records={[completedRecord]}
              onCancel={vi.fn()}
              onReschedule={vi.fn()}
              onSendNow={vi.fn()}
              onDelete={vi.fn()}
              onOpenDraft={vi.fn()}
              onClearSent={vi.fn()}
            />
          </LocaleProvider>,
        );
        const sentTab = container.querySelector('[data-history-filter="sent"]')!;
        const scheduledTab = container.querySelector('[data-history-filter="scheduled"]')!;
        expect(scheduledTab).toHaveAttribute('aria-selected', 'true');
  
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
  
        await waitFor(() => {
          expect(sentTab).toHaveAttribute('aria-selected', 'true');
        });
        expect(scheduledTab).toHaveAttribute('aria-selected', 'false');
        expect(screen.getByRole('article')).toHaveTextContent(completedRecord.text);
      } finally {
        if (originalDraftStorage) Object.defineProperty(window, 'draftStorage', originalDraftStorage);
        else Reflect.deleteProperty(window, 'draftStorage');
      }
    });
  
  it('waits for all history sources before showing records and selecting a category', async () => {
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
      window.localStorage.setItem('xmsgi-history-filters', JSON.stringify({
        sourceFilter: 'all',
        statusFilter: 'scheduled',
      }));
  
      const renderDrawer = (recordsReady: boolean) => (
        <LocaleProvider>
          <HistoryDrawer
            isOpen
            pageMode
            historyRecordsReady={recordsReady}
            statusFilterOnOpen="scheduled"
            onClose={vi.fn()}
            records={[completedRecord]}
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
        const sentTab = view.container.querySelector('[data-history-filter="sent"]')!;
        const scheduledTab = view.container.querySelector('[data-history-filter="scheduled"]')!;
  
        expect(scheduledTab).toHaveAttribute('aria-selected', 'true');
        expect(scheduledTab).not.toHaveClass('is-active');
        expect(sentTab).toBeDisabled();
        expect(view.container.querySelector('.history-filter-count')).toHaveTextContent('…');
        const reservedDateRow = view.container.querySelector('.history-date-sticky.is-layout-reserve');
        expect(reservedDateRow).toBeInTheDocument();
        expect(reservedDateRow).toHaveAttribute('aria-hidden', 'true');
        expect(screen.getByRole('status', { name: 'Loading Posts.' })).toBeInTheDocument();
        expect(view.container.querySelector('.history-empty-art')).toBeInTheDocument();
        expect(view.container.querySelector('.history-empty-art-icon .history-loading-spinner')).toBeInTheDocument();
        expect(view.container.querySelector('.history-empty-art-icon svg:not(.history-loading-spinner)')).not.toBeInTheDocument();
        expect(view.container.querySelector('.history-empty strong')).not.toBeInTheDocument();
        expect(view.container.querySelector('.history-empty > strong, .history-empty > span:not(.history-empty-art)')).not.toBeInTheDocument();
        expect(screen.queryByRole('article')).not.toBeInTheDocument();
  
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
  
        expect(scheduledTab).toHaveAttribute('aria-selected', 'true');
        expect(scheduledTab).not.toHaveClass('is-active');
        expect(screen.queryByRole('article')).not.toBeInTheDocument();
  
        view.rerender(renderDrawer(true));
  
        await waitFor(() => expect(sentTab).toHaveAttribute('aria-selected', 'true'));
        expect(scheduledTab).toHaveAttribute('aria-selected', 'false');
        expect(sentTab).toHaveClass('is-active');
        expect(screen.getByRole('article')).toHaveTextContent(completedRecord.text);
        expect(view.container.querySelector('.history-date-sticky')).toBe(reservedDateRow);
        expect(reservedDateRow).not.toHaveClass('is-layout-reserve');
        expect(reservedDateRow).not.toHaveAttribute('aria-hidden', 'true');
      } finally {
        if (originalDraftStorage) Object.defineProperty(window, 'draftStorage', originalDraftStorage);
        else Reflect.deleteProperty(window, 'draftStorage');
      }
    });
  
  it('keeps the selected drafts category while saved drafts reload', async () => {
      const originalDraftStorage = Object.getOwnPropertyDescriptor(window, 'draftStorage');
      const draft = {
        id: 'reloaded-studio-draft',
        name: 'Reloaded draft',
        body: 'Draft loaded after returning to Posts',
        createdAt: '2026-10-25T10:00:00.000Z',
        updatedAt: '2026-10-25T10:00:00.000Z',
      };
      type DraftLoadResult = {
        success: true;
        store: {
          schemaVersion: 1;
          migrationVersion: 1;
          savedDrafts: typeof draft[];
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
      window.localStorage.setItem('xmsgi-history-filters', JSON.stringify({
        sourceFilter: 'all',
        statusFilter: 'drafts',
      }));
  
      try {
        const { container } = renderHistoryPage([completedRecord]);
        const draftsTab = container.querySelector('[data-history-filter="drafts"]')!;
        const sentTab = container.querySelector('[data-history-filter="sent"]')!;
  
        expect(draftsTab).toHaveAttribute('aria-selected', 'true');
        expect(sentTab).toHaveAttribute('aria-selected', 'false');
  
        await act(async () => {
          resolveDraftLoad({
            success: true,
            store: {
              schemaVersion: 1,
              migrationVersion: 1,
              savedDrafts: [draft],
              workspaceDraft: null,
            },
          });
        });
  
        expect(await screen.findByText('Reloaded draft')).toBeInTheDocument();
        expect(draftsTab).toHaveAttribute('aria-selected', 'true');
        expect(sentTab).toHaveAttribute('aria-selected', 'false');
      } finally {
        if (originalDraftStorage) Object.defineProperty(window, 'draftStorage', originalDraftStorage);
        else Reflect.deleteProperty(window, 'draftStorage');
      }
    });
  
  it('switches to the only category with posts after drafts finish loading empty', async () => {
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
      window.localStorage.setItem('xmsgi-history-filters', JSON.stringify({
        sourceFilter: 'all',
        statusFilter: 'drafts',
      }));
  
      try {
        const { container } = renderHistoryPage([completedRecord]);
        const draftsTab = container.querySelector('[data-history-filter="drafts"]')!;
        const sentTab = container.querySelector('[data-history-filter="sent"]')!;
  
        expect(draftsTab).toHaveAttribute('aria-selected', 'true');
  
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
  
        await waitFor(() => {
          expect(sentTab).toHaveAttribute('aria-selected', 'true');
        });
        expect(draftsTab).toHaveAttribute('aria-selected', 'false');
        expect(sentTab.querySelector('.history-filter-count')).toHaveTextContent('1');
        expect(screen.getByRole('article')).toHaveTextContent(completedRecord.text);
      } finally {
        if (originalDraftStorage) Object.defineProperty(window, 'draftStorage', originalDraftStorage);
        else Reflect.deleteProperty(window, 'draftStorage');
      }
    });
  
  it('reselects the only populated category after Posts is reopened with unchanged counts', async () => {
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
      const pendingDraftLoads: Array<(result: DraftLoadResult) => void> = [];
      Object.defineProperty(window, 'draftStorage', {
        configurable: true,
        value: {
          load: vi.fn(() => new Promise<DraftLoadResult>((resolve) => {
            pendingDraftLoads.push(resolve);
          })),
        },
      });
      window.localStorage.setItem('xmsgi-history-filters', JSON.stringify({
        sourceFilter: 'all',
        statusFilter: 'drafts',
      }));
  
      const renderDrawer = (isOpen: boolean) => (
        <LocaleProvider>
          <HistoryDrawer
            isOpen={isOpen}
            pageMode={isOpen}
            onClose={vi.fn()}
            records={[completedRecord]}
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
        const view = render(renderDrawer(true));
        const sentTab = view.container.querySelector('[data-history-filter="sent"]')!;
        const draftsTab = view.container.querySelector('[data-history-filter="drafts"]')!;
        const resolveEmptyDrafts = () => pendingDraftLoads.shift()?.({
          success: true,
          store: {
            schemaVersion: 1,
            migrationVersion: 1,
            savedDrafts: [],
            workspaceDraft: null,
          },
        });
  
        await waitFor(() => expect(pendingDraftLoads).toHaveLength(1));
        await act(async () => { resolveEmptyDrafts(); });
        await waitFor(() => expect(sentTab).toHaveAttribute('aria-selected', 'true'));
  
        fireEvent.click(draftsTab);
        expect(draftsTab).toHaveAttribute('aria-selected', 'true');
        expect(sentTab).toHaveAttribute('aria-selected', 'false');
  
        view.rerender(renderDrawer(false));
        view.rerender(renderDrawer(true));
        await waitFor(() => expect(pendingDraftLoads).toHaveLength(1));
        await act(async () => { resolveEmptyDrafts(); });
  
        await waitFor(() => {
          expect(view.container.querySelector('[data-history-filter="sent"]')).toHaveAttribute('aria-selected', 'true');
        });
        expect(view.container.querySelector('[data-history-filter="drafts"]')).toHaveAttribute('aria-selected', 'false');
      } finally {
        if (originalDraftStorage) Object.defineProperty(window, 'draftStorage', originalDraftStorage);
        else Reflect.deleteProperty(window, 'draftStorage');
      }
    });
  
  it('shows both Studio and Planner drafts in All and separates them by source', async () => {
      const studioDraft = normalizeSavedDraft({
        id: 'all-studio-draft',
        name: 'Studio-only draft',
        body: 'Studio draft content',
        entities: [],
        attachments: [],
        selectedChat: null,
        createdAt: '2026-10-25T10:00:00.000Z',
        updatedAt: '2026-10-25T10:00:00.000Z',
      });
      const plannerDraft = normalizePlannerDraft(
        'Planner-only draft',
        null,
        '2026-10-25T11:00:00.000Z',
      )!;
      const { container } = renderHistoryPage([studioDraft, plannerDraft]);
  
      await waitFor(() => {
        expect(container.querySelector('[data-history-filter="drafts"]')).not.toBeDisabled();
      });
      fireEvent.click(container.querySelector('[data-history-filter="drafts"]')!);
  
      expect(screen.getAllByRole('article')).toHaveLength(2);
      expect(screen.getByText('Studio-only draft')).toBeInTheDocument();
      expect(screen.getByText('Planner-only draft')).toBeInTheDocument();
  
      selectHistorySource('Studio');
      expect(screen.getAllByRole('article')).toHaveLength(1);
      expect(screen.getByText('Studio-only draft')).toBeInTheDocument();
      expect(screen.queryByText('Planner-only draft')).not.toBeInTheDocument();
  
      selectHistorySource('Planner');
      expect(screen.getAllByRole('article')).toHaveLength(1);
      expect(screen.getByText('Planner-only draft')).toBeInTheDocument();
      expect(screen.queryByText('Studio-only draft')).not.toBeInTheDocument();
    });
  
  it('keeps the scheduled category selected when the chosen source has no records', async () => {
      const { container } = renderHistoryPage([]);
      const statusFilters = container.querySelector('.history-status-filters')!;
      await waitFor(() => {
        expect(statusFilters.querySelector('[data-history-filter="scheduled"]')).toHaveAttribute('aria-selected', 'true');
      });
      expect(screen.getByText('Nothing in this category yet')).toBeInTheDocument();
      expect(container.querySelector('[data-history-filter="scheduled"] .history-filter-count')).toHaveClass('is-zero');
      expect(container.querySelector('.history-detail-empty h2')).toHaveTextContent('Nothing to review yet');
      expect(container.querySelector('.history-detail-empty p')).toHaveTextContent('Posts matching the selected category and source will appear here.');
    });
  
  it('keeps the Posts page full-height when switching between empty categories', () => {
      const { container } = renderHistoryPage([]);
      const statusFilters = container.querySelector<HTMLDivElement>('.history-status-filters')!;
  
      expect(globalStyles).toMatch(
        /\.history-drawer\.is-page\s*\{[^}]*grid-template-rows:\s*auto\s+minmax\(0,\s*1fr\)\s+auto;/,
      );
  
      for (const category of ['scheduled', 'sent', 'drafts']) {
        const tab = statusFilters.querySelector<HTMLButtonElement>(`[data-history-filter="${category}"]`)!;
        fireEvent.click(tab);
        expect(tab).toHaveAttribute('aria-selected', 'true');
        expect(container.querySelector('.history-drawer.is-page')).toBeInTheDocument();
        expect(screen.getByText('Nothing in this category yet')).toBeInTheDocument();
      }
    });
  
  it('anchors Posts below the topbar and preserves bottom dock alignment', () => {
      expect(globalStyles).toMatch(
        /\.product-shell-content\.is-posts\s*\{[^}]*height:\s*calc\(100dvh - var\(--app-topbar-height\) - var\(--electron-titlebar-height\)\);[^}]*min-height:\s*0;[^}]*flex:\s*0\s*0\s*calc\(100dvh - var\(--app-topbar-height\) - var\(--electron-titlebar-height\)\);/,
      );
      expect(globalStyles).toMatch(
        /\.history-drawer\.is-page \.history-drawer-tools\s*\{[^}]*position:\s*sticky;[^}]*inset-block-end:\s*0;[^}]*bottom:\s*0;[^}]*align-self:\s*end;/,
      );
    });
  
  it('offers product-specific create actions for an empty category, but not empty search results', async () => {
      const openStudio = vi.fn();
      const openQuickPlan = vi.fn();
      render(
        <LocaleProvider>
          <QuickPlannerNavigationContext.Provider value={{
            currentSection: 'posts',
            openStudio,
            openQuickPlan,
            openPosts: vi.fn(),
            openSettings: vi.fn(),
          }}>
            <HistoryDrawer
              isOpen
              pageMode
              onClose={vi.fn()}
              records={[]}
              onCancel={vi.fn()}
              onReschedule={vi.fn()}
              onSendNow={vi.fn()}
              onDelete={vi.fn()}
              onOpenDraft={vi.fn()}
              onClearSent={vi.fn()}
            />
          </QuickPlannerNavigationContext.Provider>
        </LocaleProvider>,
      );
      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Create in Studio' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Create in Planner' })).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: 'Create in Studio' }));
      fireEvent.click(screen.getByRole('button', { name: 'Create in Planner' }));
      expect(openStudio).toHaveBeenCalledOnce();
      expect(openQuickPlan).toHaveBeenCalledOnce();
      expect(document.querySelector('.history-empty-art')).toHaveAttribute('aria-hidden', 'true');
  
      fireEvent.change(screen.getByRole('textbox', { name: 'Search history' }), {
        target: { value: 'no match' },
      });
      expect(screen.queryByRole('button', { name: 'Create in Studio' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Create in Planner' })).not.toBeInTheDocument();
    });
  
  it('offers an empty-state create action matching the selected source', async () => {
      renderHistoryPage([]);
  
      selectHistorySource('Studio');
      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Create in Studio' })).toBeInTheDocument();
      });
      expect(screen.queryByRole('button', { name: 'Create in Planner' })).not.toBeInTheDocument();
  
      selectHistorySource('Planner');
      await waitFor(() => {
        expect(screen.queryByRole('button', { name: 'Create in Studio' })).not.toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Create in Planner' })).toBeInTheDocument();
      });
    });
  
  it('keeps search and bottom actions in the Posts dock', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-09-28T12:00:00.000Z'));
      try {
        const { container } = renderHistoryPage([upcomingRecord, workspaceSentRecord]);
        const pageHeader = container.querySelector<HTMLDivElement>('.history-drawer-header')!;
        const listPane = container.querySelector<HTMLDivElement>('.history-list-pane')!;
        const statusFilters = listPane.querySelector<HTMLDivElement>('.history-status-filters')!;
        const statusSection = listPane.querySelector<HTMLDivElement>('.history-list-status-section')!;
        const sourceRow = statusSection.querySelector<HTMLDivElement>('.history-list-source-row')!;
        const sourceSection = sourceRow.querySelector<HTMLDivElement>('.is-source-section')!;
        const sourceFilters = sourceSection.querySelector<HTMLDivElement>('.history-source-filters')!;
        const statusHeading = statusSection.querySelector<HTMLDivElement>('.history-list-status-heading')!;
        const detailPanel = container.querySelector<HTMLDivElement>('.history-detail-panel')!;
        const recordList = container.querySelector<HTMLDivElement>('.history-record-list')!;
        const tools = container.querySelector<HTMLDivElement>('.history-drawer-tools')!;
        const footer = tools.querySelector<HTMLDivElement>('.history-drawer-footer')!;
        const searchDock = tools.querySelector<HTMLDivElement>('.history-search-dock')!;
  
        expect(container.querySelector('.history-drawer-controls')).toBeNull();
        expect(container.querySelector('.history-page-controls-close')).toBeNull();
        expect(pageHeader.querySelectorAll('.history-drawer-close')).toHaveLength(1);
        expect(listPane).toContainElement(statusFilters);
        expect(statusSection).toContainElement(statusFilters);
        expect(colorThemeStyles).toMatch(
          /@media \(min-width:\s*1121px\)\s*\{[\s\S]*?\.history-drawer\.is-page \.history-list-status-heading > \.history-status-filters\s*\{\s*width:\s*max-content;[^}]*flex:\s*0 1 auto;[\s\S]*?\.history-drawer\.is-page \.history-list-status-section \.history-status-filters\s*\{\s*justify-content:\s*flex-start;[^}]*gap:\s*4px;[\s\S]*?\.history-drawer\.is-page \.history-list-status-section \.history-status-tab\s*\{\s*flex:\s*0 0 auto;/,
        );
        expect(colorThemeStyles).toMatch(
          /html\[data-theme='dark'\] \.history-drawer\.is-page \.history-list-status-section \.history-status-tab\s*\{[^}]*font-size:\s*12px;/,
        );
        expect(colorThemeStyles).toMatch(
          /html\[data-theme='dark'\] \.history-drawer\.is-page \.history-list-status-section \.history-status-tab \.history-filter-count\s*\{[^}]*font-size:\s*11px;/,
        );
        expect(colorThemeStyles).toMatch(
          /html\[data-theme='light'\] \.history-drawer\.is-page \.history-list-status-section \.history-status-tab \.history-filter-count\s*\{[^}]*font-size:\s*11px;/,
        );
        expect(colorThemeStyles).toMatch(
          /html\[data-theme='light'\] \.history-drawer\.is-page \.history-list-status-section \.history-status-tab \.history-filter-count\.is-zero\s*\{[^}]*color:\s*#687b82;/,
        );
        expect(colorThemeStyles).toMatch(
          /html\[data-theme='dark'\] \.history-drawer\.is-page \.history-list-status-section \.history-status-tab \.history-filter-count\.is-zero\s*\{[^}]*color:\s*#87969d;/,
        );
        expect(globalStyles).toMatch(
          /\.history-drawer\.is-page \.history-drawer-tools\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)\s+auto;[^}]*gap:\s*20px;/,
        );
        expect(colorThemeStyles).toMatch(
          /@media \(min-width:\s*761px\)\s*\{[\s\S]*?\.history-drawer\.is-page \.history-list-status-section\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)\s+164px;[\s\S]*?\.history-drawer\.is-page \.history-list-source-row \.history-page-filter-section\.is-source-section\s*\{[^}]*width:\s*164px;[^}]*min-width:\s*164px;[^}]*flex:\s*0 0 164px;[^}]*justify-content:\s*flex-end;[^}]*padding-right:\s*10px;/,
        );
        expect(colorThemeStyles).toMatch(
          /\.history-drawer\.is-page \.history-list-source-row \.history-page-filter-section\.is-source-section\s*\{[^}]*padding:\s*0 10px 0 12px;/,
        );
        expect(colorThemeStyles).toMatch(
          /\.history-drawer\.is-page \.history-list-source-label\s*\{\s*font-size:\s*12px;/,
        );
        expect(colorThemeStyles).toMatch(
          /html\[data-theme='light'\] \.history-drawer\.is-page \.history-list-status-heading \.history-page-filter-label,\s*html\[data-theme='light'\] \.history-drawer\.is-page \.history-list-source-label\s*\{\s*color:\s*#5b7079;\s*font-size:\s*12px;\s*font-weight:\s*600;\s*letter-spacing:\s*0\.07em;/,
        );
        expect(colorThemeStyles).toMatch(
          /\.history-drawer\.is-page \.history-list-source-row \.history-source-select\s*\{\s*min-height:\s*38px;[^}]*padding:\s*0 12px;[^}]*font-size:\s*12px;/,
        );
        expect(colorThemeStyles).toMatch(/\.history-source-option\s*\{\s*min-height:\s*44px;\s*font-size:\s*13px;/);
        expect(globalStyles).toMatch(/\.history-source-menu\s*\{\s*position:\s*absolute;[^}]*width:\s*178px;[^}]*border:\s*0;[^}]*box-shadow:\s*0 6px 14px rgba\(0, 0, 0, 0\.24\);/);
        expect(globalStyles).toMatch(/\.history-source-menu\s*\{[^}]*transform-origin:\s*top right;[^}]*animation:\s*history-source-menu-drop-in 180ms cubic-bezier\(0\.2, 0\.8, 0\.2, 1\) both;/);
        expect(globalStyles).toMatch(/@media \(prefers-reduced-motion:\s*reduce\)\s*\{\s*\.history-source-menu\s*\{\s*animation:\s*none;/);
        expect(colorThemeStyles).toMatch(
          /@media \(min-width:\s*1121px\)\s*\{[\s\S]*?\.history-drawer\.is-page \.history-list-source-row \.history-page-filter-section\.is-source-section\s*\{\s*justify-content:\s*space-between;\s*padding:\s*0 10px 0 12px;/,
        );
        expect(globalStyles).not.toMatch(/\.history-list-status-section \.history-status-tab::before/);
        expect(colorThemeStyles).not.toMatch(/\.history-list-status-section \.history-status-tab(?::not\(\.is-active\))?:(?:hover|focus-visible)::before/);
        expect(statusSection.compareDocumentPosition(recordList) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
        expect(pageHeader.compareDocumentPosition(statusSection) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
        expect(recordList.compareDocumentPosition(tools) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
        expect(tools).toContainElement(searchDock);
        expect(searchDock.compareDocumentPosition(footer) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
        expect(globalStyles).toMatch(/\.history-drawer\.is-page \.history-drawer-tools\s*\{[^}]*width:\s*calc\(45% - 29\.2px\);[^}]*margin-right:\s*0;[^}]*margin-left:\s*17px;[^}]*padding:\s*11px 8px;[^}]*transform:\s*translate\(2px,\s*-17px\);/);
        expect(globalStyles).toMatch(/\.history-drawer\.is-page \.history-drawer-tools\s*\{[^}]*border-top-left-radius:\s*0;[^}]*border-top-right-radius:\s*0;/);
        expect(globalStyles).toMatch(/\.history-content\.is-page \.history-list-pane\s*\{[^}]*border-radius:\s*12px 12px 0 0;/);
        expect(globalStyles).not.toMatch(/\.history-content\.is-page \.history-list-pane\s*\{[^}]*top:\s*-2px;/);
        expect(globalStyles).toMatch(/@media \(min-width:\s*761px\)\s*\{\s*\.history-drawer\.is-page \.history-drawer-tools\s*\{\s*padding-top:\s*3px;[^}]*position:\s*sticky;[^}]*inset-block-end:\s*0;[^}]*left:\s*4px;[^}]*transform:\s*translate\(2px,\s*-11px\);/);
        expect(globalStyles).toMatch(/\.history-drawer\.is-page \.history-export-control\s*\{[^}]*gap:\s*2px;[^}]*transform:\s*translate\(10px,\s*5px\);/);
        expect(globalStyles).toMatch(/\.history-content\.is-page \.history-list-pane\s*\{[^}]*margin-bottom:\s*2px;/);
        expect(globalStyles).toMatch(/\.history-drawer\.is-page \.history-search-dock\s*\{[^}]*width:\s*100%;[^}]*min-width:\s*0;/);
        expect(globalStyles).not.toMatch(/\.history-drawer\.is-page \.history-search-dock\s*\{[^}]*transform:\s*translateX\(/);
        expect(globalStyles).toMatch(/\.history-drawer\.is-page \.history-result-count\s*\{[^}]*padding-left:\s*0;[^}]*text-align:\s*center;/);
        expect(footer).not.toContainElement(statusFilters);
        expect(footer).toContainElement(container.querySelector('.history-export-button'));
        expect(footer).toContainElement(container.querySelector('.history-delete-button'));
        const exportControl = footer.querySelector('.history-export-control')!;
        const deleteAction = footer.querySelector('.history-delete-action')!;
        expect(exportControl.compareDocumentPosition(deleteAction) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
        expect(screen.getByRole('search')).toBeInTheDocument();
        expect(screen.getByRole('tablist', { name: 'Post status' })).toBeInTheDocument();
        expect(statusHeading).toContainElement(statusFilters);
        expect(sourceSection).toContainElement(sourceFilters);
        expect(sourceRow).toContainElement(sourceSection);
        expect(statusHeading.compareDocumentPosition(sourceRow) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
        expect(detailPanel).not.toContainElement(sourceFilters);
        expect(pageHeader).toBeInTheDocument();
        expect(sourceSection.querySelector('.history-list-source-label')).toHaveTextContent('Source');
        expect(sourceSection.querySelector('.history-source-select')).toHaveTextContent('All');
        expect(statusHeading).toHaveTextContent('Category');
        expect(statusHeading).toContainElement(statusFilters);
        fireEvent.click(screen.getByRole('tab', { name: 'Sent' }));
        expect(container.querySelector('.history-drawer-tools')).toBeInTheDocument();
        const deleteButton = container.querySelector<HTMLButtonElement>('.history-delete-button');
        expect(deleteButton).toBeInTheDocument();
        expect(deleteButton).not.toHaveAttribute('title');
        expect(deleteButton).toHaveAttribute('aria-label');
        expect(container.querySelector('.history-export-button')).toBeInTheDocument();
      } finally {
        vi.useRealTimers();
      }
    });
  
  it('keeps the full list visible while showing the selected post details separately', async () => {
      const secondRecord = normalizeScheduledMessages([{
        ...scheduledMessage,
        id: 'scheduled-studio-2',
        text: 'Вторая публикация остаётся в списке',
        when: '2026-09-30T17:30:00.000Z',
      }], 'workspace', 'upcoming', [channel])[0];
      const { container } = renderHistoryPage([upcomingRecord, secondRecord]);
  
      expect(container.querySelectorAll('.history-record')).toHaveLength(2);
      expect(container.querySelector('.history-detail-empty h2')).toHaveTextContent('Select a post');
      expect(container.querySelector('.history-detail-empty-art')).toHaveAttribute('aria-hidden', 'true');
      expect(container.querySelector('.history-detail-empty-art-icon')).toBeInTheDocument();
      expect(container.querySelector('.history-detail-empty-art-orbit--outer')).toBeInTheDocument();
      expect(container.querySelector('.history-detail-empty-art-spark--left')).toBeInTheDocument();
  
      fireEvent.click(container.querySelector('.history-record-open')!);
  
      expect(container.querySelectorAll('.history-record')).toHaveLength(2);
      expect(screen.getAllByText('Релиз нового набора шаблонов для Telegram-канала').length).toBeGreaterThan(0);
      expect(screen.getByText('Вторая публикация остаётся в списке')).toBeInTheDocument();
      expect(container.querySelector('.history-detail-preview-label')).not.toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'brief.pdf' }))
        .toHaveAttribute('download', 'brief.pdf');
      expect(screen.getByRole('button', { name: 'Back to posts' })).toBeInTheDocument();
      expect(container.querySelector('.history-detail-category')).toHaveTextContent('Category: Scheduled');
      expect(container.querySelector('.history-record-open')).toHaveAttribute('aria-pressed', 'true');
  
      fireEvent.click(screen.getByRole('button', { name: 'Preview' }));
      expect(container.querySelector('.history-detail-body')).toHaveClass('is-preview');
      expect(telegramGetChatHistory).not.toHaveBeenCalled();
      expect(container.querySelector('.history-detail-preview-spacer')).not.toBeInTheDocument();
      expect(container.querySelector('.history-detail-preview-current')).toHaveTextContent('Релиз нового набора шаблонов для Telegram-канала');
    });
  
  it('clears the selected post when its row is clicked again', () => {
      const { container } = renderHistoryPage([upcomingRecord]);
      const recordButton = container.querySelector<HTMLButtonElement>('.history-record-open')!;
  
      fireEvent.click(recordButton);
      expect(container.querySelector('.history-detail-panel')).toHaveTextContent('Релиз нового набора шаблонов для Telegram-канала');
      expect(recordButton).toHaveAttribute('aria-pressed', 'true');
  
      fireEvent.click(recordButton, { detail: 1 });
      expect(container.querySelector('.history-record')).not.toHaveClass('is-selected');
      expect(container.querySelector('.history-record')).toHaveClass('is-hover-suppressed');
      expect(recordButton).toHaveAttribute('aria-pressed', 'false');
  
      fireEvent.pointerLeave(recordButton, { relatedTarget: recordButton.querySelector('.history-record-heading') });
      expect(container.querySelector('.history-record')).toHaveClass('is-hover-suppressed');
  
      fireEvent.pointerLeave(container.querySelector('.history-record')!);
      expect(container.querySelector('.history-record')).not.toHaveClass('is-hover-suppressed');
    });
  
  it('clears the selected draft when its row is clicked again', () => {
      const draft = normalizePlannerDraft('A draft to close', null, '2026-10-06T10:00:00.000Z');
      expect(draft).not.toBeNull();
      const { container } = renderHistoryPage([draft!]);
      fireEvent.click(container.querySelector('[data-history-filter="drafts"]')!);
      const recordButton = container.querySelector<HTMLButtonElement>('.history-record-open')!;
  
      fireEvent.click(recordButton);
      expect(container.querySelector('.history-detail-panel')).toHaveTextContent('A draft to close');
      expect(recordButton).toHaveAttribute('aria-pressed', 'true');
  
      fireEvent.click(recordButton, { detail: 1 });
      expect(container.querySelector('.history-record')).not.toHaveClass('is-selected');
      expect(container.querySelector('.history-record')).toHaveClass('is-hover-suppressed');
      expect(recordButton).toHaveAttribute('aria-pressed', 'false');
  
      fireEvent.pointerLeave(container.querySelector('.history-record')!);
      expect(container.querySelector('.history-record')).not.toHaveClass('is-hover-suppressed');
    });
});
