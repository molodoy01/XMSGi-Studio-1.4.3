import { describe, expect, it, vi } from 'vitest';
import type { SavedDraft } from '@shared/types';
import { createAppHistoryDraftActions } from './appHistoryDraftActions';
import { completedRecord, workspaceSentRecord } from './workspace/HistoryDrawer.testUtils';

function createActions() {
  const showNotification = vi.fn();
  const handlePersonalDeleteMessage = vi.fn().mockResolvedValue(true);
  const handleWorkspaceDeleteMessage = vi.fn().mockResolvedValue(true);
  const dependencies = {
    browserDraftMode: false,
    clearActivePlannerDraft: vi.fn(() => true),
    handlePersonalDeleteMessage,
    openPlannerTextInStudio: vi.fn(() => true),
    nextPlannerDraftLoadRevision: vi.fn(() => 1),
    pendingStudioDraftUseWaitersRef: {
      current: new Set<(handler: (draft: SavedDraft) => Promise<boolean>) => void>(),
    },
    productViewRef: { current: 'planner' as const },
    setPlannerDraftLoadRequest: vi.fn(),
    setProductView: vi.fn(),
    showNotification,
    studioDraftDeleterRef: { current: null as ((draftId: string) => Promise<boolean>) | null },
    studioDraftOpenerRef: { current: null as ((draft: SavedDraft) => void) | null },
    studioDraftUseRef: { current: null as ((draft: SavedDraft) => Promise<boolean>) | null },
    studioScheduler: { handleDeleteMessage: handleWorkspaceDeleteMessage },
    t: (key: string) => key,
  };

  return {
    actions: createAppHistoryDraftActions(dependencies),
    showNotification,
    handlePersonalDeleteMessage,
    handleWorkspaceDeleteMessage,
  };
}

describe('App history record deletion', () => {
  it.each([
    ['personal', completedRecord],
    ['workspace', workspaceSentRecord],
  ] as const)('shows a success notice after deleting a sent %s record', async (source, record) => {
    const { actions, showNotification, handlePersonalDeleteMessage, handleWorkspaceDeleteMessage } = createActions();

    await expect(actions.deleteHistoryRecord(record)).resolves.toBe(true);

    const handler = source === 'personal' ? handlePersonalDeleteMessage : handleWorkspaceDeleteMessage;
    expect(handler).toHaveBeenCalledWith(
      record.original.kind === 'scheduled' ? record.original.message : undefined,
      true,
    );
    expect(showNotification).toHaveBeenCalledWith(
      'history.recordDeletedFromHistory',
      'success',
      'history.title',
    );
  });

  it('does not show a success notice when deleting a sent record fails', async () => {
    const { actions, showNotification, handleWorkspaceDeleteMessage } = createActions();
    handleWorkspaceDeleteMessage.mockResolvedValue(false);

    await expect(actions.deleteHistoryRecord(workspaceSentRecord)).resolves.toBe(false);

    expect(showNotification).not.toHaveBeenCalled();
  });
});
