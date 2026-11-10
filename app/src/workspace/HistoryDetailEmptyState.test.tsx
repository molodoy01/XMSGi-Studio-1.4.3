import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { HistoryDetailEmptyState } from './HistoryDetailEmptyState';

describe('HistoryDetailEmptyState', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('reveals the large-preview artwork and message together after the delay', () => {
    vi.useFakeTimers();
    const view = render(<HistoryDetailEmptyState title="Select a post" text="Choose a post." ready />);
    const copy = view.container.querySelector('.history-detail-empty-copy');
    const artwork = view.container.querySelector('.history-detail-empty-art');

    expect(copy).not.toHaveClass('is-visible');
    expect(artwork).not.toHaveClass('is-visible');

    act(() => vi.advanceTimersByTime(349));
    expect(copy).not.toHaveClass('is-visible');
    expect(artwork).not.toHaveClass('is-visible');

    act(() => vi.advanceTimersByTime(1));
    expect(copy).toHaveClass('is-visible');
    expect(artwork).toHaveClass('is-visible');
    expect(screen.getByText('Select a post')).toBeInTheDocument();

    view.rerender(<HistoryDetailEmptyState title="Nothing to review yet" text="No posts yet." ready />);
    expect(copy).not.toHaveClass('is-visible');
    expect(artwork).not.toHaveClass('is-visible');
    expect(copy).toHaveAttribute('aria-hidden', 'true');
    expect(screen.getByText('Select a post')).toBeInTheDocument();

    act(() => vi.advanceTimersByTime(349));
    expect(screen.getByText('Select a post')).toBeInTheDocument();

    act(() => vi.advanceTimersByTime(1));
    expect(screen.getByText('Nothing to review yet')).toBeInTheDocument();
    expect(copy).toHaveClass('is-visible');
    expect(artwork).toHaveClass('is-visible');
    expect(copy).toHaveAttribute('aria-hidden', 'false');
    expect(screen.queryByText('Select a post')).not.toBeInTheDocument();
  });

  it('keeps the message hidden until the history data is ready', () => {
    vi.useFakeTimers();
    const view = render(<HistoryDetailEmptyState title="Select a post" text="Choose a post." ready={false} />);
    const copy = view.container.querySelector('.history-detail-empty-copy');
    const artwork = view.container.querySelector('.history-detail-empty-art');

    act(() => vi.advanceTimersByTime(500));
    expect(copy).not.toHaveClass('is-visible');
    expect(artwork).not.toHaveClass('is-visible');

    view.rerender(<HistoryDetailEmptyState title="Select a post" text="Choose a post." ready />);
    act(() => vi.advanceTimersByTime(350));
    expect(copy).toHaveClass('is-visible');
    expect(artwork).toHaveClass('is-visible');
  });
});
