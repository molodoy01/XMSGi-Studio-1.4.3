import { act } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readWorkspaceDraftStoreFallback, writeWorkspaceDraftStoreFallback } from './WorkspacePageExports';
import { getInMemoryWorkspaceDraft, renderWorkspacePage, resetWorkspacePageTestEnvironment } from './WorkspacePage.testUtils';

describe('WorkspacePage autosave lifecycle', () => {
  beforeEach(resetWorkspacePageTestEnvironment);

  it('saves the latest draft through browser fallback without blocking close when successful', async () => {
      const originalDraftStorage = Object.getOwnPropertyDescriptor(window, 'draftStorage');
      const initialStore = {
        schemaVersion: 3,
        migrationVersion: 1,
        savedDrafts: [],
        documentHistories: {},
        workspaceDraft: {
          documentId: 'browser-close-document',
          body: 'Before editing',
          entities: [],
          attachments: [],
          savedAt: '12:00',
        },
      };
      writeWorkspaceDraftStoreFallback(initialStore);
      Reflect.deleteProperty(window, 'draftStorage');
  
      try {
        const { unmount } = await renderWorkspacePage();
        const editor = document.querySelector('[role="textbox"]') as HTMLDivElement;
        await act(async () => {
          editor.textContent = 'Latest browser fallback draft';
          editor.dispatchEvent(new InputEvent('input', { bubbles: true }));
        });
        const closeEvent = new Event('beforeunload', { cancelable: true });
  
        await act(async () => {
          window.dispatchEvent(closeEvent);
        });
  
        expect(closeEvent.defaultPrevented).toBe(false);
        expect(readWorkspaceDraftStoreFallback()?.workspaceDraft?.body).toBe('Latest browser fallback draft');
        unmount();
      } finally {
        if (originalDraftStorage) Object.defineProperty(window, 'draftStorage', originalDraftStorage);
        else Reflect.deleteProperty(window, 'draftStorage');
      }
    });
  
  it.each(['throws', 'does not write'] as const)(
      'prevents browser close and retains the latest draft when localStorage %s',
      async (failureMode) => {
        const originalDraftStorage = Object.getOwnPropertyDescriptor(window, 'draftStorage');
        const initialStore = {
          schemaVersion: 3,
          migrationVersion: 1,
          savedDrafts: [],
          documentHistories: {},
          workspaceDraft: {
            documentId: 'browser-close-failure-document',
            body: 'Previously saved text',
            entities: [],
            attachments: [],
            savedAt: '12:00',
          },
        };
        writeWorkspaceDraftStoreFallback(initialStore);
        const originalRaw = localStorage.getItem('xmsgi-draft-store-fallback');
        Reflect.deleteProperty(window, 'draftStorage');
        const originalSetItem = Storage.prototype.setItem;
        const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, key, value) {
          if (key === 'xmsgi-draft-store-fallback') {
            if (failureMode === 'throws') throw new DOMException('Storage unavailable', 'SecurityError');
            return;
          }
          return originalSetItem.call(this, key, value);
        });
  
        try {
          const { unmount } = await renderWorkspacePage();
          const editor = document.querySelector('[role="textbox"]') as HTMLDivElement;
          await act(async () => {
            editor.textContent = 'Unsaved latest browser draft';
            editor.dispatchEvent(new InputEvent('input', { bubbles: true }));
          });
          const closeEvent = new Event('beforeunload', { cancelable: true });
  
          await act(async () => {
            window.dispatchEvent(closeEvent);
          });
  
          expect(closeEvent.defaultPrevented).toBe(true);
          expect(localStorage.getItem('xmsgi-draft-store-fallback')).toBe(originalRaw);
          expect(editor.textContent).toContain('Unsaved latest browser draft');
          expect(readWorkspaceDraftStoreFallback()?.workspaceDraft?.body).toBe('Previously saved text');
          expect(document.body.textContent).toContain('Unsaved latest browser draft');
          expect(document.querySelector('.workspace-page-publish-transient-feedback.is-error')?.textContent).toBeTruthy();
  
          setItem.mockRestore();
          const retryEvent = new Event('beforeunload', { cancelable: true });
          await act(async () => {
            window.dispatchEvent(retryEvent);
          });
  
          expect(retryEvent.defaultPrevented).toBe(false);
          expect(readWorkspaceDraftStoreFallback()?.workspaceDraft?.body).toBe('Unsaved latest browser draft');
          unmount();
        } finally {
          setItem.mockRestore();
          if (originalDraftStorage) Object.defineProperty(window, 'draftStorage', originalDraftStorage);
          else Reflect.deleteProperty(window, 'draftStorage');
        }
      },
    );
  
  it('registers only one beforeunload handler across component updates and removes it on unmount', async () => {
      const addListener = vi.spyOn(window, 'addEventListener');
      const removeListener = vi.spyOn(window, 'removeEventListener');
      const { rerender, unmount } = await renderWorkspacePage();
      const registered = addListener.mock.calls.filter(([type]) => type === 'beforeunload');
      expect(registered.length).toBeGreaterThan(0);
  
      rerender({ scheduling: true });
      rerender({ scheduling: false });
  
      expect(addListener.mock.calls.filter(([type]) => type === 'beforeunload')).toHaveLength(registered.length);
      unmount();
      expect(removeListener.mock.calls.filter(([type]) => type === 'beforeunload')).toHaveLength(registered.length);
      addListener.mockRestore();
      removeListener.mockRestore();
    });
  
  it('restores the saved draft text after a reload', async () => {
      vi.useFakeTimers();
  
      try {
        const { unmount } = await renderWorkspacePage({
          selectedChat: null,
          date: '',
          time: '',
        });
  
        const editor = document.querySelector('[role="textbox"]') as HTMLDivElement;
        await act(async () => {
          editor.textContent = 'Reloaded draft text';
          editor.dispatchEvent(new InputEvent('input', { bubbles: true }));
          await Promise.resolve();
        });
  
        await act(async () => {
          vi.advanceTimersByTime(500);
          await Promise.resolve();
          await Promise.resolve();
        });
  
        const savedDraft = getInMemoryWorkspaceDraft();
        expect(savedDraft.body).toContain('Reloaded draft text');
  
        unmount();
  
        const reloaded = await renderWorkspacePage({
          selectedChat: null,
          date: '',
          time: '',
        });
  
        const restoredEditor = document.querySelector('[role="textbox"]') as HTMLDivElement;
        expect(restoredEditor.textContent).toContain('Reloaded draft text');
  
        reloaded.unmount();
      } finally {
        vi.useRealTimers();
      }
    });
});
