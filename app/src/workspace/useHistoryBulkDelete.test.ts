import { describe, expect, it, vi } from 'vitest';
import type { HistoryTranslate } from './historyPresentation';
import { createHistoryBulkDeleteHandler } from './useHistoryBulkDelete';

const t = ((key: string, values?: Record<string, string>) => (
  Object.entries(values ?? {}).reduce((message, [name, value]) => message.replace(`{${name}}`, value), key)
)) as HistoryTranslate;

function createBulkDelete(onClearSent: () => Promise<{ deleted: number; failed: number }>) {
  const onShowNotification = vi.fn();
  const confirmCategoryDelete = createHistoryBulkDeleteHandler({
    filteredRecords: [],
    historyItems: [],
    queueCancellableRecords: [],
    localScheduleFailureRecords: [],
    selectedDraftColor: null,
    sourceFilter: 'all',
    bulkDeleteCategory: 'sent',
    bulkDeleteRecord: null,
    bulkDeleteSelection: [],
    bulkDeleteStopRequestedRef: { current: false },
    locale: 'en',
    t,
    onCancel: vi.fn(),
    onDelete: vi.fn(),
    onClearSent,
    onShowNotification,
    setBulkDeleteCategory: vi.fn(),
    setBulkDeleteRecordId: vi.fn(),
    setBulkDeleteBusy: vi.fn(),
    setBulkDeleteError: vi.fn(),
    setBulkDraftDeleteProgress: vi.fn(),
    setBulkDeleteCanStop: vi.fn(),
    setBulkDeleteStopRequested: vi.fn(),
    setBulkDeleteStoppedProgress: vi.fn(),
    setDraftItems: vi.fn(),
    setSelectedRecord: vi.fn(),
    setSelectedRecordIds: vi.fn(),
    setBulkDeleteSelection: vi.fn(),
  });

  return { confirmCategoryDelete, onShowNotification };
}

describe('history bulk delete notifications', () => {
  it('shows success after sent history is cleared', async () => {
    const { confirmCategoryDelete, onShowNotification } = createBulkDelete(async () => ({ deleted: 3, failed: 0 }));

    await confirmCategoryDelete();

    expect(onShowNotification).toHaveBeenCalledWith(
      'history.bulkSentDeleteSuccess',
      'success',
      'history.title',
    );
  });

  it('shows a partial-failure notification when only some records are cleared', async () => {
    const { confirmCategoryDelete, onShowNotification } = createBulkDelete(async () => ({ deleted: 2, failed: 1 }));

    await confirmCategoryDelete();

    expect(onShowNotification).toHaveBeenCalledWith(
      'history.bulkDeletePartial',
      'warning',
      'history.title',
    );
  });

  it('does not show success when clearing sent history fails', async () => {
    const { confirmCategoryDelete, onShowNotification } = createBulkDelete(async () => ({ deleted: 0, failed: 3 }));

    await confirmCategoryDelete();

    expect(onShowNotification).toHaveBeenCalledWith(
      'history.bulkDeleteFailure',
      'error',
      'history.title',
    );
    expect(onShowNotification).not.toHaveBeenCalledWith(
      expect.any(String),
      'success',
      expect.any(String),
    );
  });

  it('shows failure when the clear operation throws', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { confirmCategoryDelete, onShowNotification } = createBulkDelete(async () => {
      throw new Error('write failed');
    });

    await confirmCategoryDelete();

    expect(onShowNotification).toHaveBeenCalledWith('history.bulkDeleteFailure', 'error', 'history.title');
    consoleError.mockRestore();
  });
});
