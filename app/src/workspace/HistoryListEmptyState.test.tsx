import { act, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LocaleProvider } from '@/lib/i18n';
import type { DraftColor } from '@studio/types';
import { HistoryListEmptyState } from './HistoryListEmptyState';
import type { HistorySourceFilter, HistoryStatusFilter } from './historyPresentation';

function renderEmptyState({
  pageMode = true,
  query = '',
  historyDataReady = true,
  statusFilter = 'scheduled',
  sourceFilter = 'all',
  selectedDraftColor = null,
}: {
  pageMode?: boolean;
  query?: string;
  historyDataReady?: boolean;
  statusFilter?: HistoryStatusFilter;
  sourceFilter?: HistorySourceFilter;
  selectedDraftColor?: DraftColor | null;
} = {}) {
  return render(
    <LocaleProvider>
      <HistoryListEmptyState
        pageMode={pageMode}
        historyDataReady={historyDataReady}
        draftsLoading={false}
        draftLoadFailed={false}
        query={query}
        statusFilter={statusFilter}
        sourceFilter={sourceFilter}
        selectedDraftColor={selectedDraftColor}
        onResetSearch={vi.fn()}
        onCreateInStudio={vi.fn()}
        onCreateInPlanner={vi.fn()}
        t={(key) => key}
      />
    </LocaleProvider>,
  );
}

describe('HistoryListEmptyState', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('delays the Posts message and create buttons until the empty state settles', () => {
    vi.useFakeTimers();
    const view = renderEmptyState();
    const copy = view.container.querySelector('.history-empty-page-copy')!;
    const createButton = copy.querySelector('button')!;

    expect(copy).toHaveAttribute('aria-hidden', 'true');
    expect(createButton).toBeDisabled();
    expect(view.container.querySelector('.history-empty-art')).toBeInTheDocument();

    act(() => vi.advanceTimersByTime(349));
    expect(copy).toHaveAttribute('aria-hidden', 'true');
    expect(createButton).toBeDisabled();

    act(() => vi.advanceTimersByTime(1));
    expect(copy).toHaveAttribute('aria-hidden', 'false');
    expect(createButton).toBeEnabled();
  });

  it('resets the delay when the empty message changes and keeps modal feedback immediate', () => {
    vi.useFakeTimers();
    const view = renderEmptyState();
    act(() => vi.advanceTimersByTime(350));
    expect(view.container.querySelector('.history-empty-page-copy')).toHaveAttribute('aria-hidden', 'false');

    view.rerender(
      <LocaleProvider>
        <HistoryListEmptyState
          pageMode
          historyDataReady
          draftsLoading={false}
          draftLoadFailed={false}
          query="missing"
          statusFilter="scheduled"
          sourceFilter="all"
          onResetSearch={vi.fn()}
          onCreateInStudio={vi.fn()}
          onCreateInPlanner={vi.fn()}
          t={(key) => key}
        />
      </LocaleProvider>,
    );
    expect(view.container.querySelector('.history-empty-page-copy')).toHaveAttribute('aria-hidden', 'true');
    act(() => vi.advanceTimersByTime(350));
    expect(view.container.querySelector('.history-empty-page-copy')).toHaveAttribute('aria-hidden', 'false');

    const modal = renderEmptyState({ pageMode: false });
    expect(modal.container.querySelector('.history-empty-page-copy')).toHaveAttribute('aria-hidden', 'false');
  });

  it('shows the loading spinner immediately and keeps it visible for at least 350 ms', () => {
    vi.useFakeTimers();
    const view = renderEmptyState({ historyDataReady: false, statusFilter: 'drafts' });
    const icon = view.container.querySelector('.history-empty-art-icon')!;

    expect(icon.querySelector('.history-loading-spinner')).toBeInTheDocument();

    act(() => vi.advanceTimersByTime(349));
    expect(icon.querySelector('.history-loading-spinner')).toBeInTheDocument();

    act(() => vi.advanceTimersByTime(1));
    expect(icon.querySelector('.history-loading-spinner')).toBeInTheDocument();
  });

  it('keeps spinning for the remainder of 350 ms when loading finishes early', () => {
    vi.useFakeTimers();
    const view = renderEmptyState({ historyDataReady: false, statusFilter: 'drafts' });
    act(() => vi.advanceTimersByTime(100));
    view.rerender(
      <LocaleProvider>
        <HistoryListEmptyState
          pageMode
          historyDataReady
          draftsLoading={false}
          draftLoadFailed={false}
          query=""
          statusFilter="drafts"
          sourceFilter="all"
          onResetSearch={vi.fn()}
          onCreateInStudio={vi.fn()}
          onCreateInPlanner={vi.fn()}
          t={(key) => key}
        />
      </LocaleProvider>,
    );

    const spinner = view.container.querySelector('.history-empty-art-icon .history-loading-spinner');
    expect(spinner).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(249));
    expect(spinner).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(1));
    expect(view.container.querySelector('.history-empty-art-icon .history-loading-spinner')).not.toBeInTheDocument();
  });

  it('hides the spinner immediately after a load that lasted at least 350 ms', () => {
    vi.useFakeTimers();
    const view = renderEmptyState({ historyDataReady: false, statusFilter: 'drafts' });
    act(() => vi.advanceTimersByTime(350));
    view.rerender(
      <LocaleProvider>
        <HistoryListEmptyState
          pageMode
          historyDataReady
          draftsLoading={false}
          draftLoadFailed={false}
          query=""
          statusFilter="drafts"
          sourceFilter="all"
          onResetSearch={vi.fn()}
          onCreateInStudio={vi.fn()}
          onCreateInPlanner={vi.fn()}
          t={(key) => key}
        />
      </LocaleProvider>,
    );

    expect(view.container.querySelector('.history-empty-art-icon .history-loading-spinner')).not.toBeInTheDocument();
  });

  it('shows the spinner for 350 ms when selecting empty Planner, Studio, and Errors sections', () => {
    vi.useFakeTimers();
    const planner = renderEmptyState({ sourceFilter: 'personal' });
    expect(planner.container.querySelector('.history-empty-art-icon .history-loading-spinner')).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(350));
    expect(planner.container.querySelector('.history-empty-art-icon .history-loading-spinner')).not.toBeInTheDocument();
    planner.unmount();

    const studio = renderEmptyState({ sourceFilter: 'workspace' });
    expect(studio.container.querySelector('.history-empty-art-icon .history-loading-spinner')).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(350));
    expect(studio.container.querySelector('.history-empty-art-icon .history-loading-spinner')).not.toBeInTheDocument();
    studio.unmount();

    const errors = renderEmptyState({ statusFilter: 'errors' });
    expect(errors.container.querySelector('.history-empty-art-icon .history-loading-spinner')).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(350));
    expect(errors.container.querySelector('.history-empty-art-icon .history-loading-spinner')).not.toBeInTheDocument();
  });

  it('shows the spinner for 350 ms when selecting empty Scheduled or Sent sections', () => {
    vi.useFakeTimers();
    const scheduled = renderEmptyState({ statusFilter: 'scheduled' });
    expect(scheduled.container.querySelector('.history-empty-art-icon .history-loading-spinner')).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(350));
    expect(scheduled.container.querySelector('.history-empty-art-icon .history-loading-spinner')).not.toBeInTheDocument();
    scheduled.unmount();

    const sent = renderEmptyState({ statusFilter: 'sent' });
    expect(sent.container.querySelector('.history-empty-art-icon .history-loading-spinner')).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(350));
    expect(sent.container.querySelector('.history-empty-art-icon .history-loading-spinner')).not.toBeInTheDocument();
  });

  it('shows the spinner for 350 ms when selecting a draft color with no matching drafts', () => {
    vi.useFakeTimers();
    const view = renderEmptyState({ statusFilter: 'drafts' });
    expect(view.container.querySelector('.history-empty-art-icon .history-loading-spinner')).not.toBeInTheDocument();

    view.rerender(
      <LocaleProvider>
        <HistoryListEmptyState
          pageMode
          historyDataReady
          draftsLoading={false}
          draftLoadFailed={false}
          query=""
          statusFilter="drafts"
          sourceFilter="all"
          selectedDraftColor="blue"
          onResetSearch={vi.fn()}
          onCreateInStudio={vi.fn()}
          onCreateInPlanner={vi.fn()}
          t={(key) => key}
        />
      </LocaleProvider>,
    );

    expect(view.container.querySelector('.history-empty-art-icon .history-loading-spinner')).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(349));
    expect(view.container.querySelector('.history-empty-art-icon .history-loading-spinner')).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(1));
    expect(view.container.querySelector('.history-empty-art-icon .history-loading-spinner')).not.toBeInTheDocument();
  });

  it('starts the spinner at a random rotation phase without changing its layout', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.25);
    const view = renderEmptyState({ historyDataReady: false });
    const spinner = view.container.querySelector('.history-empty-art-icon .history-loading-spinner')!;
    const arc = spinner.querySelector('.history-loading-spinner-arc')!;

    expect(arc).toHaveStyle({ animationDelay: '-200ms' });
    expect(spinner).toHaveClass('history-loading-spinner');
    expect(spinner).toHaveAttribute('viewBox', '0 0 24 24');
    expect(spinner.querySelector('.history-loading-spinner-track')).toHaveAttribute('r', '8');
    expect(arc).toHaveAttribute('r', '8');
    expect(spinner.querySelector('.history-loading-spinner-handle')).not.toBeInTheDocument();
  });
});
