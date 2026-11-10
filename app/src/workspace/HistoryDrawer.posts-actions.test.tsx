import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, expect, it, vi, describe } from 'vitest';
import { normalizePlannerDraft } from './historyModel';
import { upcomingRecord, completedRecord, workspaceSentRecord, renderHistoryPage, selectHistorySource } from './HistoryDrawer.testUtils';

vi.mock('@/services/chatAppService', () => ({
  telegramGetChatHistory: vi.fn(),
}));

describe('Posts page split view', () => {
  beforeEach(() => {
      window.localStorage.removeItem('xmsgi-history-filters');
      window.localStorage.removeItem('xmsgi-history-selected-record');
      window.localStorage.removeItem('xmsgi_dismissed_draft_color_auto_filter');
    });

  it('shows the compact preview and copy toolbar without sharing and keeps record actions in its menu', async () => {
      const clipboardDescriptor = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
      const writeText = vi.fn().mockResolvedValue(undefined);
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: { writeText },
      });
  
      try {
        const { container } = renderHistoryPage([completedRecord]);
        fireEvent.click(container.querySelector('.history-record-open')!);
  
        const toolbar = container.querySelector<HTMLDivElement>('.history-detail-toolbar')!;
        expect(within(toolbar).getByRole('button', { name: 'Preview' })).toBeInTheDocument();
        expect(within(toolbar).getByRole('button', { name: 'Copy' })).toBeInTheDocument();
        expect(within(toolbar).getByRole('button', { name: 'Use' })).toBeInTheDocument();
        expect(within(toolbar).getByRole('button', { name: 'More' })).toBeInTheDocument();
        expect(within(toolbar).queryByRole('button', { name: /share/i })).not.toBeInTheDocument();
  
        fireEvent.click(within(toolbar).getByRole('button', { name: 'Copy' }));
        await waitFor(() => expect(writeText).toHaveBeenCalledWith(completedRecord.text));
        expect(within(toolbar).getByRole('button', { name: 'Copied' })).toBeInTheDocument();
  
        const scheduledView = renderHistoryPage([upcomingRecord]);
        fireEvent.click(scheduledView.container.querySelector('.history-record-open')!);
        const scheduledToolbar = scheduledView.container.querySelector<HTMLDivElement>('.history-detail-toolbar')!;
        fireEvent.click(within(scheduledToolbar).getByRole('button', { name: 'More' }));
        const actionsMenu = within(scheduledToolbar).getByRole('menu');
        expect(within(actionsMenu).queryByRole('menuitem', { name: 'Edit' })).not.toBeInTheDocument();
        expect(within(actionsMenu).getByRole('menuitem', { name: 'Send now' })).toBeInTheDocument();
        expect(within(actionsMenu).getByRole('menuitem', { name: 'Cancel' })).toBeInTheDocument();
      } finally {
        if (clipboardDescriptor) {
          Object.defineProperty(navigator, 'clipboard', clipboardDescriptor);
        } else {
          Reflect.deleteProperty(navigator, 'clipboard');
        }
      }
    });
  
  it('copies a single photo with the post text, but copies only text for multiple photos', async () => {
      const clipboardDescriptor = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
      const writeText = vi.fn().mockResolvedValue(undefined);
      const write = vi.fn().mockResolvedValue(undefined);
      class MockClipboardItem {
        constructor(public readonly items: Record<string, Blob>) {}
      }
      vi.stubGlobal('ClipboardItem', MockClipboardItem);
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: { writeText, write },
      });
  
      try {
        const singlePhoto = normalizePlannerDraft(
          'Post with one photo',
          null,
          '2026-10-25T10:00:00.000Z',
          [],
          ['data:image/png;base64,aW1hZ2U='],
        )!;
        const singleView = renderHistoryPage([singlePhoto]);
        fireEvent.click(singleView.container.querySelector('.history-record-open')!);
        fireEvent.click(screen.getByRole('button', { name: 'Copy' }));
  
        await waitFor(() => expect(write).toHaveBeenCalledOnce());
        const clipboardItem = write.mock.calls[0][0][0] as MockClipboardItem;
        expect(clipboardItem.items['image/png']).toBeInstanceOf(Blob);
        expect(await clipboardItem.items['text/plain'].text()).toBe('Post with one photo');
        expect(writeText).not.toHaveBeenCalled();
  
        singleView.unmount();
        window.localStorage.removeItem('xmsgi-history-selected-record');
        const multiplePhotos = normalizePlannerDraft(
          'Post with multiple photos',
          null,
          '2026-10-25T10:00:00.000Z',
          [],
          ['data:image/png;base64,aW1hZ2U=', 'data:image/png;base64,b3RoZXI='],
        )!;
        const multipleView = renderHistoryPage([multiplePhotos]);
        fireEvent.click(multipleView.container.querySelector('.history-record-open')!);
        fireEvent.click(screen.getByRole('button', { name: 'Copy' }));
  
        await waitFor(() => expect(writeText).toHaveBeenCalledWith('Post with multiple photos'));
        expect(write).toHaveBeenCalledOnce();
      } finally {
        vi.unstubAllGlobals();
        if (clipboardDescriptor) {
          Object.defineProperty(navigator, 'clipboard', clipboardDescriptor);
        } else {
          Reflect.deleteProperty(navigator, 'clipboard');
        }
      }
    });
  
  it('falls back to copying the post text when copying a single photo fails', async () => {
      const clipboardDescriptor = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
      const writeText = vi.fn().mockResolvedValue(undefined);
      const write = vi.fn().mockRejectedValue(new Error('Image clipboard is unavailable.'));
      class MockClipboardItem {
        constructor(public readonly items: Record<string, Blob>) {}
      }
      vi.stubGlobal('ClipboardItem', MockClipboardItem);
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: { writeText, write },
      });
  
      try {
        const draft = normalizePlannerDraft(
          'Keep this text even if the image fails',
          null,
          '2026-10-25T10:00:00.000Z',
          [],
          ['data:image/png;base64,aW1hZ2U='],
        )!;
        const { container } = renderHistoryPage([draft]);
        fireEvent.click(container.querySelector('.history-record-open')!);
        const toolbar = container.querySelector<HTMLDivElement>('.history-detail-toolbar')!;
        fireEvent.click(within(toolbar).getByRole('button', { name: 'Copy' }));
  
        await waitFor(() => expect(writeText).toHaveBeenCalledWith(draft.text));
        expect(within(toolbar).getByRole('button', { name: 'Copied' })).toBeInTheDocument();
      } finally {
        vi.unstubAllGlobals();
        if (clipboardDescriptor) {
          Object.defineProperty(navigator, 'clipboard', clipboardDescriptor);
        } else {
          Reflect.deleteProperty(navigator, 'clipboard');
        }
      }
    });
  
  it('resets the copy button after its temporary confirmation', async () => {
      const clipboardDescriptor = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: { writeText: vi.fn().mockResolvedValue(undefined) },
      });
      vi.useFakeTimers();
  
      try {
        const { container } = renderHistoryPage([completedRecord]);
        fireEvent.click(container.querySelector('.history-record-open')!);
        const toolbar = container.querySelector<HTMLDivElement>('.history-detail-toolbar')!;
        fireEvent.click(within(toolbar).getByRole('button', { name: 'Copy' }));
  
        await act(async () => {
          await Promise.resolve();
          await Promise.resolve();
        });
        expect(within(toolbar).getByRole('button', { name: 'Copied' })).toBeInTheDocument();
  
        act(() => {
          vi.advanceTimersByTime(1600);
        });
        expect(within(toolbar).getByRole('button', { name: 'Copy' })).toBeInTheDocument();
      } finally {
        vi.useRealTimers();
        if (clipboardDescriptor) {
          Object.defineProperty(navigator, 'clipboard', clipboardDescriptor);
        } else {
          Reflect.deleteProperty(navigator, 'clipboard');
        }
      }
    });
  
  it('uses the selected post text with the active editor from the detail toolbar', async () => {
      const onUseDraft = vi.fn().mockResolvedValue(true);
      const { container, onClose } = renderHistoryPage([completedRecord], onUseDraft);
      fireEvent.click(container.querySelector('.history-record-open')!);
      fireEvent.click(screen.getByRole('button', { name: 'Use' }));
  
      await waitFor(() => {
        expect(onUseDraft).toHaveBeenCalledWith(completedRecord, 'studio');
        expect(onClose).toHaveBeenCalledWith(false);
      });
    });
  
  it('hides Edit and Use in Studio from the scheduled post detail actions menu', () => {
      const { container } = renderHistoryPage([upcomingRecord]);
      fireEvent.click(container.querySelector('.history-record-open')!);
      fireEvent.click(screen.getByRole('button', { name: 'More' }));
      expect(screen.queryByRole('menuitem', { name: 'Use in Studio' })).not.toBeInTheDocument();
      expect(screen.queryByRole('menuitem', { name: 'Edit' })).not.toBeInTheDocument();
      expect(screen.queryByRole('menuitem', { name: 'Open in Planner' })).not.toBeInTheDocument();
    });
  
  it('returns the post list to the top when source, category, or search changes', () => {
      const { container } = renderHistoryPage([upcomingRecord, workspaceSentRecord]);
      const recordList = container.querySelector<HTMLDivElement>('.history-record-list')!;
  
      recordList.scrollTop = 240;
      fireEvent.click(screen.getByRole('tab', { name: 'Sent' }));
      expect(recordList.scrollTop).toBe(0);
  
      recordList.scrollTop = 180;
      selectHistorySource('Studio');
      expect(recordList.scrollTop).toBe(0);
  
      recordList.scrollTop = 120;
      fireEvent.change(screen.getByRole('textbox', { name: 'Search history' }), {
        target: { value: 'release' },
      });
      expect(recordList.scrollTop).toBe(0);
    });
  
  it('supports arrow, Home, and End navigation across status tabs', () => {
      renderHistoryPage([upcomingRecord, workspaceSentRecord]);
      const scheduledTab = screen.getByRole('tab', { name: 'Scheduled' });
      const sentTab = screen.getByRole('tab', { name: 'Sent' });
      const draftsTab = screen.getByRole('tab', { name: 'Drafts' });
  
      expect(scheduledTab).toHaveAttribute('tabindex', '0');
      expect(sentTab).toHaveAttribute('tabindex', '-1');
  
      fireEvent.keyDown(scheduledTab, { key: 'ArrowRight' });
      expect(sentTab).toHaveFocus();
      expect(sentTab).toHaveAttribute('aria-selected', 'true');
      expect(sentTab).toHaveAttribute('tabindex', '0');
      fireEvent.keyDown(sentTab, { key: 'End' });
      expect(draftsTab).toHaveFocus();
      expect(draftsTab).toHaveAttribute('aria-selected', 'true');
  
      fireEvent.keyDown(draftsTab, { key: 'ArrowRight' });
      expect(scheduledTab).toHaveFocus();
      expect(scheduledTab).toHaveAttribute('aria-selected', 'true');
      fireEvent.keyDown(scheduledTab, { key: 'Home' });
      expect(scheduledTab).toHaveFocus();
    });
  
  it('focuses and selects the history query with Ctrl+F or Cmd+F', () => {
      renderHistoryPage([upcomingRecord]);
      const search = screen.getByRole('textbox', { name: 'Search history' }) as HTMLInputElement;
      fireEvent.change(search, { target: { value: 'launch' } });
  
      fireEvent.keyDown(document, { key: 'f', ctrlKey: true });
  
      expect(search).toHaveFocus();
      expect(search.selectionStart).toBe(0);
      expect(search.selectionEnd).toBe('launch'.length);
    });
  
  it('returns keyboard focus to the selected post after leaving mobile details', async () => {
      const previousMatchMedia = Object.getOwnPropertyDescriptor(window, 'matchMedia');
      Object.defineProperty(window, 'matchMedia', {
        configurable: true,
        value: vi.fn((media: string) => ({
          matches: media === '(max-width: 900px)',
          media,
          onchange: null,
          addListener: vi.fn(),
          removeListener: vi.fn(),
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
          dispatchEvent: vi.fn(),
        })),
      });
  
      try {
        const { container } = renderHistoryPage([upcomingRecord]);
        const rowButton = container.querySelector('.history-record-open') as HTMLButtonElement;
        fireEvent.click(rowButton);
        fireEvent.click(screen.getByRole('button', { name: 'Back to posts' }));
  
        await waitFor(() => expect(container.querySelector('.history-record-open')).toHaveFocus());
      } finally {
        if (previousMatchMedia) Object.defineProperty(window, 'matchMedia', previousMatchMedia);
        else Reflect.deleteProperty(window, 'matchMedia');
      }
    });
});
