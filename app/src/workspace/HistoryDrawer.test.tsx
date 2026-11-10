import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ScheduledMessage } from '@/types';
import { LocaleProvider } from '@/lib/i18n';
import { HistoryDrawer } from './HistoryDrawer';
import { normalizePlannerDraft, normalizeScheduledMessages } from './historyModel';
import { globalStyles, colorThemeStyles, scheduledMessage, channel, upcomingRecord, completedRecord, workspaceSentRecord, personalUpcomingRecord, renderHistory, renderHistoryPage, selectHistorySource, openSourceMenu } from './HistoryDrawer.testUtils';

vi.mock('@/services/chatAppService', () => ({
  telegramGetChatHistory: vi.fn(),
}));

describe('App-owned history mapping', () => {
  it('normalizes forbidden symbols in scheduled posts and preserves original source data', () => {
    const sourceMessage = {
      ...scheduledMessage,
      text: 'A\u200BB\u00A0C',
      entities: [{ type: 'bold' as const, offset: 2, length: 1 }],
    };
    const [record] = normalizeScheduledMessages([sourceMessage], 'workspace', 'sent', [channel]);

    expect(record.text).toBe('AB C');
    expect(record.entities).toEqual([{ type: 'bold', offset: 1, length: 1 }]);
    expect(record.original.kind === 'scheduled' && record.original.message.text).toBe(sourceMessage.text);
  });

  it('keeps detailed message cards compact in both themes and provides text-size controls', () => {
    window.localStorage.removeItem('xmsgi-history-filters');
    window.localStorage.removeItem('xmsgi-history-text-size');
    const { container } = renderHistoryPage([upcomingRecord]);
    fireEvent.click(container.querySelector('.history-record-open')!);

    const detailBody = container.querySelector('.history-detail-body')!;
    const bubble = container.querySelector('.history-detail-body .history-post-bubble')!;
    const [decrease, increase] = Array.from(container.querySelectorAll<HTMLButtonElement>('.history-detail-font-button'));

    const readingControls = container.querySelector('.history-detail-reading-controls');
    expect(readingControls?.parentElement).toBe(container.querySelector('.history-detail-topline'));
    expect(container.querySelector('.history-detail-meta-line .history-detail-time')).toBeInTheDocument();
    expect(readingControls?.parentElement).not.toBe(detailBody);
    expect(container.querySelector('.history-detail-toolbar .history-detail-font-button')).toBeNull();
    expect(globalStyles).toMatch(/\.history-detail-reading-controls\s*\{[^}]*margin-left:\s*auto;/);
    expect(globalStyles).toMatch(/\.history-detail-reading-controls \.history-detail-font-button\s*\{[^}]*min-width:\s*28px;[^}]*height:\s*22px;/);
    expect(globalStyles).toMatch(/\.history-detail-body\.is-details \.history-post-bubble\s*\{[^}]*width:\s*fit-content;[^}]*max-width:\s*100%;[^}]*margin:\s*0 auto;/);
    expect(globalStyles).toMatch(/html\[data-theme\] \.history-drawer\.is-page \.history-detail-body\.is-details\[data-text-size='small'\] \.history-post-text\s*\{\s*font-size:\s*14px;/);
    expect(globalStyles).toMatch(/html\[data-theme\] \.history-drawer\.is-page \.history-detail-body\.is-details\[data-text-size='large'\] \.history-post-text\s*\{\s*font-size:\s*18px;/);
    expect(bubble).toHaveTextContent('Релиз нового набора шаблонов');
    expect(detailBody).toHaveAttribute('data-text-size', 'default');
    expect(decrease).toBeEnabled();
    expect(increase).toBeEnabled();

    fireEvent.click(decrease);
    expect(detailBody).toHaveAttribute('data-text-size', 'small');
    expect(decrease).toBeDisabled();
    expect(increase).toBeEnabled();

    fireEvent.click(increase);
    expect(detailBody).toHaveAttribute('data-text-size', 'default');
    expect(decrease).toBeEnabled();
    expect(increase).toBeEnabled();

    fireEvent.click(increase);
    expect(detailBody).toHaveAttribute('data-text-size', 'large');
    expect(increase).toBeDisabled();
  });

  it('remembers the selected text size when Posts is reopened', async () => {
    window.localStorage.removeItem('xmsgi-history-text-size');
    window.localStorage.removeItem('xmsgi-history-selected-record');
    const firstView = renderHistoryPage([upcomingRecord]);
    fireEvent.click(firstView.container.querySelector('.history-record-open')!);
    fireEvent.click(screen.getByRole('button', { name: 'Increase post text size' }));
    expect(firstView.container.querySelector('.history-detail-body')).toHaveAttribute('data-text-size', 'large');
    firstView.unmount();

    const reopenedView = renderHistoryPage([upcomingRecord]);
    await waitFor(() => {
      expect(reopenedView.container.querySelector('.history-detail-body')).toHaveAttribute('data-text-size', 'large');
    });
  });

  it('renders loaded Markdown templates as formatted post history text', () => {
    const [record] = normalizeScheduledMessages([{
      ...scheduledMessage,
      text: '**ДЕЙСТВУЙ**\n**[Название]**\n[Главный результат]',
    }], 'workspace', 'sent', [channel]);

    expect(record.text).toBe('ДЕЙСТВУЙ\n[Название]\n[Главный результат]');
    expect(record.entities).toEqual([
      { type: 'bold', offset: 0, length: 8 },
      { type: 'bold', offset: 9, length: 10 },
    ]);
  });

  it('preserves attachments in planner draft history so either editor can restore them', () => {
    const record = normalizePlannerDraft(
      'Проверяем откат текста',
      channel,
      '2026-09-29T18:00:00.000Z',
      [{ type: 'bold', offset: 0, length: 9 }],
      ['C:\\files\\photo.png', 'C:\\files\\brief.pdf'],
    );

    expect(record).not.toBeNull();
    expect(record?.text).toBe('Проверяем откат текста');
    expect(record?.attachments).toEqual(['C:\\files\\photo.png', 'C:\\files\\brief.pdf']);
    expect(record?.original).toMatchObject({
      kind: 'planner-draft',
      text: 'Проверяем откат текста',
      attachments: ['C:\\files\\photo.png', 'C:\\files\\brief.pdf'],
    });
  });
});

describe('history drawer transient menus', () => {
  it('closes export menus when the drawer closes', () => {
    const renderDrawer = (isOpen: boolean) => (
      <LocaleProvider>
        <HistoryDrawer
          isOpen={isOpen}
          onClose={vi.fn()}
          records={[upcomingRecord]}
          onCancel={vi.fn()}
          onReschedule={vi.fn()}
          onSendNow={vi.fn()}
          onDelete={vi.fn()}
          onOpenDraft={vi.fn()}
          onClearSent={vi.fn()}
          onClearDrafts={vi.fn().mockResolvedValue(true)}
          onCancelQueue={vi.fn().mockResolvedValue(true)}
        />
      </LocaleProvider>
    );
    const view = render(renderDrawer(true));
    const exportButton = screen.getByRole('button', { name: 'Export current category' });

    fireEvent.click(exportButton);
    expect(view.container.querySelector('.history-export-menu')).toBeInTheDocument();

    view.rerender(renderDrawer(false));
    view.rerender(renderDrawer(true));

    expect(view.container.querySelector('.history-export-menu')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Export current category' })).toHaveAttribute('aria-expanded', 'false');
  });
});

describe('history filter selected states', () => {
  it('keeps full Russian category labels accessible', () => {
    window.localStorage.removeItem('xmsgi-history-filters');
    window.localStorage.setItem('awaitmsg_locale', 'ru');
    const { container } = renderHistory([upcomingRecord, workspaceSentRecord]);
    const statusFilters = container.querySelector('.history-status-filters') as HTMLElement;
    const scheduledTab = statusFilters.querySelector('[data-history-filter="scheduled"]') as HTMLElement;

    expect(scheduledTab).toHaveAttribute('aria-label', 'План');
    expect(scheduledTab.querySelector('.history-status-label')?.textContent).toBe('План');
  });

  it('shows All, Studio, Planner, and Errors in the source dropdown', () => {
    window.localStorage.removeItem('xmsgi-history-filters');
    window.localStorage.setItem('awaitmsg_locale', 'en');
    const { container } = renderHistoryPage([upcomingRecord, workspaceSentRecord]);
    const sourceFilters = container.querySelector('.history-source-filters') as HTMLDivElement;
    const statusFilters = container.querySelector('.history-status-filters') as HTMLDivElement;
    const activeStatus = statusFilters.querySelector<HTMLButtonElement>('[aria-selected="true"]')!;

    expect(sourceFilters.querySelector('.history-source-select')).toHaveTextContent('All');
    expect(activeStatus).toHaveAttribute('data-history-filter', 'scheduled');
    expect(activeStatus).toHaveClass('is-active');
    expect(container.querySelector('.history-glass-indicator')).toBeNull();

    const sourceMenu = openSourceMenu();
    expect(sourceMenu.container.querySelectorAll('[role="menuitemradio"]')).toHaveLength(4);
    expect(sourceMenu.container.querySelector('[data-history-filter="all"]')).toBeInTheDocument();
    expect(sourceMenu.container.querySelector('[data-history-filter="workspace"]')).toBeInTheDocument();
    expect(sourceMenu.container.querySelector('[data-history-filter="personal"]')).toBeInTheDocument();
    expect(sourceMenu.container.querySelector('[data-history-filter="errors"]')).toBeInTheDocument();
    fireEvent.click(sourceMenu.container.querySelector('[data-history-filter="workspace"]')!);
    fireEvent.click(statusFilters.querySelector('[data-history-filter="sent"]')!);

    expect(sourceFilters.querySelector('.history-source-select')).toHaveTextContent('Studio');
    expect(statusFilters.querySelector('[data-history-filter="sent"]')).toHaveClass('is-active');
  });

  it('keeps light category tabs borderless except for the selected accent capsule', () => {
    expect(colorThemeStyles).toMatch(
      /html\[data-theme='light'\] \.history-drawer\.is-page \.history-list-status-section \.history-status-tab,\s*html\[data-theme='light'\] \.history-drawer\.is-page \.history-list-status-section \.history-status-tab:hover,\s*html\[data-theme='light'\] \.history-drawer\.is-page \.history-list-status-section \.history-status-tab:focus-visible\s*\{\s*border-color:\s*transparent;\s*outline:\s*none;\s*box-shadow:\s*none;/,
    );
    expect(colorThemeStyles).toMatch(
      /html\[data-theme='light'\] \.history-drawer\.is-page \.history-list-status-section \.history-status-tab\.is-active:focus-visible\s*\{\s*background:\s*rgba\(40, 125, 163, 0\.08\);/,
    );
    expect(colorThemeStyles).toMatch(
      /html\[data-theme='light'\] \.history-drawer\.is-page \.history-list-status-section \.history-status-tab\.is-active,[\s\S]*?border-color:\s*rgba\(40, 125, 163, 0\.24\);[\s\S]*?background:\s*rgba\(40, 125, 163, 0\.08\);[\s\S]*?color:\s*#287da3;[\s\S]*?box-shadow:\s*none;/,
    );
    expect(colorThemeStyles).toMatch(
      /html\[data-theme='light'\] \.history-drawer\.is-page \.history-list-status-section \.history-status-tab \.history-filter-count,\s*html\[data-theme='light'\] \.history-drawer\.is-page \.history-list-status-section \.history-status-tab\.is-active \.history-filter-count\s*\{\s*border-color:\s*transparent;/,
    );
    expect(colorThemeStyles).toMatch(
      /html\[data-theme='dark'\] \.history-source-menu \.history-filter-count,[\s\S]*?html\[data-theme='light'\] \.history-source-menu \.history-source-option\[aria-checked='true'\] \.history-filter-count\s*\{\s*border-color:\s*transparent;\s*box-shadow:\s*none;/,
    );
    expect(globalStyles).toMatch(
      /\.history-list-status-section \.history-status-tab\s*\{[^}]*transition:\s*color 160ms ease;/,
    );
  });

  it('does not show a hover capsule on an unselected Posts category tab in either theme', () => {
    expect(colorThemeStyles).toMatch(
      /html\[data-theme='dark'\] \.history-drawer\.is-page \.history-list-status-section \.history-status-tab:not\(\.is-active\):hover\s*\{\s*border-color:\s*transparent;\s*background:\s*transparent;\s*box-shadow:\s*none;/,
    );
    expect(colorThemeStyles).toMatch(
      /html\[data-theme='dark'\] \.history-drawer\.is-page \.history-list-status-section \.history-status-tab:not\(\.is-active\):focus-visible\s*\{\s*background:\s*rgba\(154, 168, 184, 0\.08\);/,
    );
    expect(colorThemeStyles).toMatch(
      /html\[data-theme='light'\] \.history-drawer\.is-page \.history-list-status-section \.history-status-tab:not\(\.is-active\):hover\s*\{\s*border-color:\s*transparent;\s*background:\s*transparent;\s*box-shadow:\s*none;/,
    );
    expect(colorThemeStyles).toMatch(
      /html\[data-theme='light'\] \.history-drawer\.is-page \.history-list-status-section \.history-status-tab:not\(\.is-active\):focus-visible\s*\{\s*background:\s*#f1f5f7;/,
    );
  });

  it('enlarges unselected category labels on hover in both themes', () => {
    expect(colorThemeStyles).toMatch(
      /html\[data-theme='light'\] \.history-drawer\.is-page \.history-list-status-section \.history-status-tab:not\(\.is-active\):hover \.history-status-label,[\s\S]*?html\[data-theme='light'\] \.history-drawer\.is-page \.history-list-status-section \.history-status-tab:not\(\.is-active\):hover \.history-status-label-compact,[\s\S]*?transform:\s*scale\(1\);/,
    );
    expect(colorThemeStyles).toMatch(
      /html\[data-theme='dark'\] \.history-drawer\.is-page \.history-list-status-section \.history-status-tab:not\(\.is-active\):hover \.history-status-label,[\s\S]*?html\[data-theme='dark'\] \.history-drawer\.is-page \.history-list-status-section \.history-status-tab:not\(\.is-active\):hover \.history-status-label-compact,[\s\S]*?transform:\s*scale\(1\);/,
    );
  });

  it('enlarges the source selector label and arrow together in both themes', () => {
    expect(colorThemeStyles).toMatch(
      /\.history-drawer\.is-page \.history-list-source-row \.history-source-select\s*\{\s*font-size:\s*13px;\s*font-weight:\s*700;/,
    );
    expect(colorThemeStyles).toMatch(
      /\.history-drawer\.is-page \.history-list-source-row \.history-source-select > span:first-child,\s*\.history-drawer\.is-page \.history-list-source-row \.history-source-select > svg\s*\{\s*transition:\s*transform 160ms ease;/,
    );
    expect(colorThemeStyles).toMatch(
      /\.history-drawer\.is-page \.history-list-source-row \.history-source-select:is\(:hover, :focus-visible, \[aria-expanded='true'\]\) > span:first-child,\s*\.history-drawer\.is-page \.history-list-source-row \.history-source-select:is\(:hover, :focus-visible, \[aria-expanded='true'\]\) > svg\s*\{\s*transform:\s*scale\(1\.06\);/,
    );
  });

  it('keeps Posts search borderless and matching the detail panel in both states', () => {
    expect(colorThemeStyles).toMatch(
      /html\[data-theme='light'\] \.history-drawer\.is-page \.history-search,\s*html\[data-theme='light'\] \.history-drawer\.is-page \.history-search:not\(:focus-within\)\s*\{\s*border-color:\s*transparent;\s*background:\s*#edf1f3;\s*box-shadow:\s*none;/,
    );
    expect(colorThemeStyles).toMatch(
      /html\[data-theme='dark'\] \.history-drawer\.is-page \.history-search,\s*html\[data-theme='dark'\] \.history-drawer\.is-page \.history-search:not\(:focus-within\),\s*html\[data-theme='dark'\] \.history-drawer\.is-page \.history-search:focus-within\s*\{\s*border-color:\s*transparent;\s*background:\s*rgba\(16,\s*23,\s*29,\s*0\.72\);\s*box-shadow:\s*none;/,
    );
  });

  it('uses a subtle neutral gray outline for the focused Posts search in both themes', () => {
    expect(colorThemeStyles).toMatch(
      /html\[data-theme='dark'\] \.history-drawer\.is-page \.history-search:focus-within,\s*html\[data-theme='light'\] \.history-drawer\.is-page \.history-search:focus-within\s*\{\s*border-color:\s*rgba\(154, 168, 184, 0\.36\);\s*box-shadow:\s*none;/,
    );
  });

  it('uses a larger search icon in both themes', () => {
    expect(globalStyles).toMatch(/\.history-search > svg\s*\{\s*width:\s*21px;\s*height:\s*21px;\s*flex:\s*0 0 auto;/);
  });

  it('shortens the search placeholder and ellipsizes it when the Posts dock is narrow', () => {
    expect(globalStyles).toMatch(/\.history-search input\s*\{[^}]*text-overflow:\s*ellipsis;/);
    window.localStorage.removeItem('xmsgi-history-filters');
    window.localStorage.setItem('awaitmsg_locale', 'ru');
    renderHistoryPage([upcomingRecord]);

    expect(screen.getByRole('textbox', { name: 'Поиск по истории' })).toHaveAttribute('placeholder', 'Поиск по истории...');
  });

  it('wraps long error previews within narrow Posts records', () => {
    expect(globalStyles).toMatch(
      /\.history-record-error-preview\s*\{[^}]*max-width:\s*100%;[^}]*overflow-wrap:\s*anywhere;[^}]*white-space:\s*normal;/,
    );
    expect(colorThemeStyles).toMatch(
      /html\[data-theme='light'\] \.history-drawer\.is-page \.history-record-error-preview\s*\{\s*color:\s*#8f211b;\s*font-size:\s*13px;\s*font-weight:\s*600;/,
    );
  });

  it('keeps the global search hint while changing categories', () => {
    window.localStorage.removeItem('xmsgi-history-filters');
    window.localStorage.setItem('awaitmsg_locale', 'ru');
    const { container } = renderHistoryPage([upcomingRecord, workspaceSentRecord]);
    const search = screen.getByRole('textbox', { name: 'Поиск по истории' });
    const statusFilters = container.querySelector('.history-status-filters')!;

    expect(search).toHaveAttribute('placeholder', 'Поиск по истории...');

    fireEvent.click(statusFilters.querySelector('[data-history-filter="sent"]')!);
    expect(screen.getByRole('textbox', { name: 'Поиск по истории' })).toHaveAttribute('placeholder', 'Поиск по истории...');

    fireEvent.click(statusFilters.querySelector('[data-history-filter="drafts"]')!);
    expect(screen.getByRole('textbox', { name: 'Поиск по истории' })).toHaveAttribute('placeholder', 'Поиск по истории...');
  });

  it('searches across categories while respecting the selected source', () => {
    const { container } = renderHistoryPage([upcomingRecord, personalUpcomingRecord, completedRecord]);
    const search = screen.getByRole('textbox', { name: 'Поиск по истории' });

    fireEvent.change(search, { target: { value: 'подтвердить' } });

    expect(screen.getAllByRole('article')).toHaveLength(2);
    expect(screen.getByText('Найдено 2 из 3')).toBeInTheDocument();
    const results = screen.getAllByRole('article');
    expect(results.some((result) => result.textContent?.includes('Запланировано'))).toBe(true);
    expect(results.some((result) => result.textContent?.includes('Отправлено'))).toBe(true);

    const sentResult = results.find((result) => result.textContent?.includes('Отправлено'))!;
    fireEvent.click(sentResult.querySelector('.history-record-open')!);
    expect(container.querySelector('.history-detail-category')).toHaveTextContent('Категория: Отправлено');

    fireEvent.click(container.querySelector('[data-history-filter="sent"]')!);
    expect(screen.getAllByRole('article')).toHaveLength(2);

    selectHistorySource('Studio');
    expect(screen.queryAllByRole('article')).toHaveLength(0);
    expect(screen.getByText('Найдено 0 из 1')).toBeInTheDocument();
    expect(container.querySelector('[data-history-filter="scheduled"]')).toBeInTheDocument();
  });

  it('includes errors in All, excludes them from Studio and Planner, and isolates the Errors section', () => {
    const failedRecord = normalizeScheduledMessages([{
      ...scheduledMessage,
      id: 'failed-source-total',
      status: 'failed' as ScheduledMessage['status'],
      lastError: 'Telegram is temporarily unavailable.',
    }], 'workspace', 'upcoming', [channel])[0];
    window.localStorage.setItem('xmsgi-history-filters', JSON.stringify({
      sourceFilter: 'all',
      statusFilter: 'sent',
    }));
    const { container } = renderHistoryPage([completedRecord, workspaceSentRecord, failedRecord]);
    expect(screen.getAllByRole('article')).toHaveLength(3);
    expect(screen.getByText('Telegram is temporarily unavailable.')).toBeInTheDocument();
    let sourceMenu = openSourceMenu();
    expect(sourceMenu.container.querySelector('[data-history-filter="all"]')).toHaveTextContent('3');
    expect(sourceMenu.container.querySelector('[data-history-filter="workspace"]')).toHaveTextContent('1');
    expect(sourceMenu.container.querySelector('[data-history-filter="personal"]')).toHaveTextContent('1');
    expect(sourceMenu.container.querySelector('[data-history-filter="errors"]')).toHaveTextContent('1');

    fireEvent.click(sourceMenu.container.querySelector('[data-history-filter="errors"]')!);
    expect(screen.getAllByRole('article')).toHaveLength(1);
    expect(screen.getByText('Telegram is temporarily unavailable.')).toBeInTheDocument();
    expect(container.querySelector('.history-source-select')).toHaveTextContent(/^(Errors|Ошибки)/);
    expect(container.querySelector('.history-status-filters')).toHaveClass('is-errors-filter');
    expect(container.querySelectorAll('.history-status-tab .history-filter-count')).toHaveLength(3);
    expect(globalStyles).toMatch(/\.history-status-filters\.is-errors-filter \.history-filter-count\s*\{\s*visibility:\s*hidden;/);

    sourceMenu = openSourceMenu();
    expect(sourceMenu.container.querySelector('[data-history-filter="all"]')).toHaveTextContent('3');
    expect(sourceMenu.container.querySelector('[data-history-filter="workspace"]')).toHaveTextContent('1');
    expect(sourceMenu.container.querySelector('[data-history-filter="personal"]')).toHaveTextContent('1');
    fireEvent.click(sourceMenu.container.querySelector('[data-history-filter="workspace"]')!);
    expect(screen.queryByText('Telegram is temporarily unavailable.')).not.toBeInTheDocument();
    expect(screen.getAllByRole('article')).toHaveLength(1);
    expect(screen.getByText('Релиз нового набора шаблонов для Telegram-канала')).toBeInTheDocument();

    fireEvent.click(container.querySelector('[data-history-filter="scheduled"]')!);
    sourceMenu = openSourceMenu();
    expect(sourceMenu.container.querySelector('[data-history-filter="all"]')).toHaveTextContent('3');
    expect(sourceMenu.container.querySelector('[data-history-filter="workspace"]')).toHaveTextContent('1');
    expect(sourceMenu.container.querySelector('[data-history-filter="personal"]')).toHaveTextContent('1');
  });

  it('formats source, status, and result counters correctly at one thousand', () => {
    window.localStorage.setItem('awaitmsg_locale', 'en');
    const records = Array.from({ length: 1000 }, (_, index) => ({
      ...upcomingRecord,
      id: `scheduled-studio-${index}`,
    }));
    const { container, unmount } = renderHistoryPage(records);

    expect(container.querySelector('[data-history-filter="scheduled"] .history-filter-count')).toHaveTextContent('1,000');
    expect(container.querySelector('.history-result-count')).toHaveTextContent('Showing 1,000 of 1,000');

    const sourceMenu = openSourceMenu();
    expect(sourceMenu.getByRole('menuitemradio', { name: 'All' })).toHaveTextContent('1,000');
    expect(sourceMenu.getByRole('menuitemradio', { name: 'Studio' })).toHaveTextContent('1,000');

    unmount();
    const recordWithManyAttachments = {
      ...upcomingRecord,
      attachments: Array.from({ length: 1000 }, (_, index) => `C:\\files\\attachment-${index}.pdf`),
    };
    const { container: attachmentContainer } = renderHistoryPage([recordWithManyAttachments]);
    expect(attachmentContainer.querySelector('.history-record-attachment-count')).toHaveTextContent('1,000');
  });

  it('opens on the Planner source until a user-selected source is saved across reopen', () => {
    window.localStorage.removeItem('xmsgi-history-filters');
    const renderDrawer = (isOpen: boolean, sourceFilterOnOpen?: 'personal' | 'workspace') => (
      <LocaleProvider>
        <HistoryDrawer
          isOpen={isOpen}
          sourceFilterOnOpen={sourceFilterOnOpen}
          onClose={vi.fn()}
          records={[upcomingRecord, personalUpcomingRecord]}
          onCancel={vi.fn()}
          onReschedule={vi.fn()}
          onSendNow={vi.fn()}
          onDelete={vi.fn()}
          onOpenDraft={vi.fn()}
          onClearSent={vi.fn()}
          onClearDrafts={vi.fn().mockResolvedValue(true)}
          onCancelQueue={vi.fn().mockResolvedValue(true)}
        />
      </LocaleProvider>
    );
    const { container, rerender } = render(renderDrawer(true, 'personal'));

    expect(container.querySelector('[data-history-filter="personal"]')).toHaveAttribute('aria-pressed', 'true');
    expect(container.querySelector('[data-history-filter="workspace"]')).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(container.querySelector('[data-history-filter="workspace"]')!);
    expect(container.querySelector('[data-history-filter="workspace"]')).toHaveAttribute('aria-pressed', 'true');
    expect(container.querySelector('[data-history-filter="personal"]')).toHaveAttribute('aria-pressed', 'false');
    expect(JSON.parse(window.localStorage.getItem('xmsgi-history-filters') ?? '{}')).toMatchObject({
      sourceFilter: 'workspace',
      sourceFilterPinned: true,
    });

    rerender(renderDrawer(false));
    rerender(renderDrawer(true, 'personal'));
    expect(container.querySelector('[data-history-filter="workspace"]')).toHaveAttribute('aria-pressed', 'true');
    window.localStorage.removeItem('xmsgi-history-filters');
  });

  it('uses the active product source on first open even when an older source is pinned', () => {
    window.localStorage.setItem('xmsgi-history-filters', JSON.stringify({
      sourceFilter: 'workspace',
      sourceFilterPinned: true,
      statusFilter: 'scheduled',
    }));
    const { container } = render(
      <LocaleProvider>
        <HistoryDrawer
          isOpen
          sourceFilterOnOpen="personal"
          sourceFilterOnOpenMode="initial"
          onClose={vi.fn()}
          records={[upcomingRecord, personalUpcomingRecord]}
          onCancel={vi.fn()}
          onReschedule={vi.fn()}
          onSendNow={vi.fn()}
          onDelete={vi.fn()}
          onOpenDraft={vi.fn()}
          onClearSent={vi.fn()}
          onClearDrafts={vi.fn().mockResolvedValue(true)}
          onCancelQueue={vi.fn().mockResolvedValue(true)}
        />
      </LocaleProvider>,
    );

    expect(container.querySelector('[data-history-filter="personal"]')).toHaveAttribute('aria-pressed', 'true');
    expect(JSON.parse(window.localStorage.getItem('xmsgi-history-filters') ?? '{}')).toMatchObject({
      sourceFilter: 'personal',
      sourceFilterPinned: true,
    });
  });

  it('opens the requested Posts category and restores the saved category on close', () => {
    window.localStorage.setItem('xmsgi-history-filters', JSON.stringify({
      sourceFilter: 'all',
      statusFilter: 'scheduled',
    }));
    const renderDrawer = (isOpen: boolean, statusFilterOnOpen?: 'sent' | 'scheduled' | 'drafts') => (
      <LocaleProvider>
        <HistoryDrawer
          isOpen={isOpen}
          statusFilterOnOpen={statusFilterOnOpen}
          onClose={vi.fn()}
          records={[upcomingRecord, completedRecord, workspaceSentRecord]}
          onCancel={vi.fn()}
          onReschedule={vi.fn()}
          onSendNow={vi.fn()}
          onDelete={vi.fn()}
          onOpenDraft={vi.fn()}
          onClearSent={vi.fn()}
          onClearDrafts={vi.fn().mockResolvedValue(true)}
          onCancelQueue={vi.fn().mockResolvedValue(true)}
        />
      </LocaleProvider>
    );
    const { container, rerender } = render(renderDrawer(true, 'sent'));

    expect(container.querySelector('[data-history-filter="sent"]')).toHaveAttribute('aria-selected', 'true');
    expect(container.querySelector('[data-history-filter="scheduled"]')).toHaveAttribute('aria-selected', 'false');
    expect(JSON.parse(window.localStorage.getItem('xmsgi-history-filters') ?? '{}').statusFilter).toBe('scheduled');

    rerender(renderDrawer(false));
    expect(JSON.parse(window.localStorage.getItem('xmsgi-history-filters') ?? '{}').statusFilter).toBe('scheduled');
    rerender(renderDrawer(true));
    expect(container.querySelector('[data-history-filter="scheduled"]')).toHaveAttribute('aria-selected', 'true');
    window.localStorage.removeItem('xmsgi-history-filters');
  });

});
