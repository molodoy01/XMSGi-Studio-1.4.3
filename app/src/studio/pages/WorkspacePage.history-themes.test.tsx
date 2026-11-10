import { act } from 'react';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PersistedDraftStore, ScheduledMessage } from '@studio/types';
import { type WorkspaceDraft } from '../lib/draftStore';
import { readWorkspaceDraftStoreFallback, writeWorkspaceDraftStoreFallback } from './WorkspacePageExports';
import { chatA, workspacePageStyles, plannerNotificationStyles, globalStyles, colorThemeStyles, workspaceTestState, getInMemoryWorkspaceDraft, renderWorkspacePage, waitForWorkspaceAutosave, resetWorkspacePageTestEnvironment } from './WorkspacePage.testUtils';

describe('WorkspacePage history and themes', () => {
  beforeEach(resetWorkspacePageTestEnvironment);

  it('opens a historical version as a new document without replacing either history', async () => {
      localStorage.removeItem('awaitmsg-workspace-draft');
      const currentDocumentId = 'copy-current-document';
      const sourceDocumentId = 'copy-source-document';
      workspaceTestState.inMemoryDraftStore = {
        schemaVersion: 3,
        migrationVersion: 1,
        savedDrafts: [],
        documentHistories: {
          [sourceDocumentId]: [{
            id: 'copy-source-version',
            documentId: sourceDocumentId,
            createdAt: '2026-10-01T12:00:00.000Z',
            reason: 'edit',
            snapshot: {
              documentId: sourceDocumentId,
              body: 'Source document copy',
              entities: [],
              attachments: [],
              selectedChat: chatA,
              date: '2026-01-10',
              time: '09:00',
              repeatMode: 'none',
              repeatDays: [],
              repeatOccurrences: 1,
              savedAt: '12:00',
            },
          }],
        },
        workspaceDraft: {
          documentId: currentDocumentId,
          body: 'Current document stays available',
          attachments: [],
          savedAt: '12:00',
        },
      };
      const { unmount } = await renderWorkspacePage();
      await act(async () => {
        (document.querySelector('.workspace-page-version-history-trigger') as HTMLButtonElement).click();
      });
      await act(async () => {
        (document.querySelector('.workspace-page-version-history-copy') as HTMLButtonElement).click();
        await new Promise((resolve) => window.setTimeout(resolve, 0));
      });
      const copyConfirmation = screen.getByRole('alertdialog');
      await act(async () => {
        fireEvent.click(within(copyConfirmation).getByRole('button', { name: 'Open as copy' }));
      });
      await waitForWorkspaceAutosave();
  
      const copyDocumentId = getInMemoryWorkspaceDraft().documentId;
      expect(copyDocumentId).toBeTruthy();
      expect(copyDocumentId).not.toBe(sourceDocumentId);
      expect(getInMemoryWorkspaceDraft().body).toBe('Source document copy');
      expect(document.querySelector('.workspace-page-rich-text-input.is-active')?.textContent).toContain('Source document copy');
      expect(workspaceTestState.inMemoryDraftStore.documentHistories?.[sourceDocumentId]?.map((version) => version.id)).toEqual(['copy-source-version']);
      expect(workspaceTestState.inMemoryDraftStore.documentHistories?.[currentDocumentId]?.[0].snapshot).toMatchObject({ body: 'Current document stays available' });
      unmount();
    });
  
  it('leaves the current document untouched when a historical attachment is missing', async () => {
      localStorage.removeItem('awaitmsg-workspace-draft');
      const documentId = 'history-missing-file-document';
      workspaceTestState.inMemoryDraftStore = {
        schemaVersion: 3,
        migrationVersion: 1,
        savedDrafts: [],
        documentHistories: {
          [documentId]: [{
            id: 'missing-file-version',
            documentId,
            createdAt: '2026-10-01T12:00:00.000Z',
            reason: 'edit',
            snapshot: {
              documentId,
              body: 'Historical post with missing file',
              entities: [],
              attachments: [{ id: 'missing', type: 'file', name: 'missing.pdf', mimeType: 'application/pdf', size: 0, path: 'C:/gone/missing.pdf', position: 0 }],
              selectedChat: chatA,
              date: '2026-01-10',
              time: '09:00',
              repeatMode: 'none',
              repeatDays: [],
              repeatOccurrences: 1,
              savedAt: '12:00',
            },
          }],
        },
        workspaceDraft: { documentId, body: 'Current safe post', attachments: [], savedAt: '12:00' },
      };
      vi.mocked(window.draftStorage.copyAttachmentPath).mockResolvedValueOnce({
        success: false,
        error: 'Source file does not exist.',
      });
      const { unmount } = await renderWorkspacePage();
  
      await act(async () => {
        (document.querySelector('.workspace-page-version-history-trigger') as HTMLButtonElement).click();
      });
      await act(async () => {
        (document.querySelector('.workspace-page-version-history-restore') as HTMLButtonElement).click();
        await new Promise((resolve) => window.setTimeout(resolve, 100));
      });
      const restoreConfirmation = screen.getByRole('alertdialog');
      await act(async () => {
        fireEvent.click(within(restoreConfirmation).getByRole('button', { name: 'Apply' }));
      });
  
      expect(document.querySelector('.workspace-page-rich-text-input.is-active')?.textContent).toContain('Current safe post');
      expect(getInMemoryWorkspaceDraft().body).toBe('Current safe post');
      expect(document.querySelector('.workspace-page-version-history-error')?.textContent).toContain('missing.pdf');
      expect(workspaceTestState.inMemoryDraftStore.documentHistories?.[documentId]).toHaveLength(1);
      unmount();
    });
  
  it('records the current document before clearing editor text', async () => {
      localStorage.removeItem('awaitmsg-workspace-draft');
      workspaceTestState.inMemoryDraftStore = {
        schemaVersion: 3,
        migrationVersion: 1,
        savedDrafts: [],
        documentHistories: {},
        workspaceDraft: { documentId: 'clear-document', body: 'Text before clear', entities: [], attachments: [], savedAt: '12:00' },
      };
      const { unmount } = await renderWorkspacePage();
  
      await act(async () => {
        (document.querySelector('.workspace-page-rich-text-clear') as HTMLButtonElement).click();
        await new Promise((resolve) => window.setTimeout(resolve, 0));
      });
      await waitForWorkspaceAutosave();
  
      expect(workspaceTestState.inMemoryDraftStore.documentHistories?.['clear-document']?.map((version) => ({
        documentId: version.documentId,
        reason: version.reason,
        body: (version.snapshot as WorkspaceDraft).body,
      }))).toEqual([{ documentId: 'clear-document', reason: 'before-clear', body: 'Text before clear' }]);
      expect(document.querySelector('.workspace-page-rich-text-input.is-active')?.textContent).toBe('');
      expect(workspaceTestState.inMemoryDraftStore.workspaceDraft).toBeNull();
      unmount();
    });
  
  it('clears editor text immediately while the history checkpoint is still saving', async () => {
      localStorage.removeItem('awaitmsg-workspace-draft');
      workspaceTestState.inMemoryDraftStore = {
        schemaVersion: 3,
        migrationVersion: 1,
        savedDrafts: [],
        documentHistories: {},
        workspaceDraft: { documentId: 'immediate-clear-document', body: 'Text before clear', entities: [], attachments: [], savedAt: '12:00' },
      };
      const { unmount } = await renderWorkspacePage();
      await waitForWorkspaceAutosave();
  
      let resolveSave!: (result: { success: boolean; store?: PersistedDraftStore }) => void;
      vi.mocked(window.draftStorage.save).mockImplementationOnce((store) => new Promise((resolve) => {
        resolveSave = resolve;
        void store;
      }));
  
      const editor = document.querySelector<HTMLElement>('.workspace-page-rich-text-input.is-active')!;
      await act(async () => {
        (document.querySelector('.workspace-page-rich-text-clear') as HTMLButtonElement).click();
        await Promise.resolve();
      });
  
      expect(editor.textContent).toBe('');
      expect(editor).toHaveAttribute('contenteditable', 'false');
      await waitFor(() => expect(window.draftStorage.save).toHaveBeenCalled());
      const saveCalls = vi.mocked(window.draftStorage.save).mock.calls;
      const submittedStore = saveCalls[saveCalls.length - 1]?.[0];
      expect(submittedStore?.documentHistories?.['immediate-clear-document']?.[0]?.snapshot)
        .toMatchObject({ body: 'Text before clear' });
  
      await act(async () => {
        workspaceTestState.inMemoryDraftStore = submittedStore!;
        resolveSave({ success: true, store: submittedStore });
        await Promise.resolve();
      });
  
      expect(editor.textContent).toBe('');
      expect(editor).toHaveAttribute('contenteditable', 'true');
      unmount();
    });
  
  it('does not clear editor text when the browser fallback cannot save a checkpoint', async () => {
      const originalDraftStorage = Object.getOwnPropertyDescriptor(window, 'draftStorage');
      const fallbackStore = {
        schemaVersion: 3,
        migrationVersion: 1,
        savedDrafts: [],
        documentHistories: {},
        workspaceDraft: {
          documentId: 'fallback-clear-document',
          body: 'Keep this if local storage is full',
          entities: [],
          attachments: [],
          savedAt: '12:00',
        },
      };
      writeWorkspaceDraftStoreFallback(fallbackStore);
      Reflect.deleteProperty(window, 'draftStorage');
      const originalSetItem = Storage.prototype.setItem;
      const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, key, value) {
        if (key === 'xmsgi-draft-store-fallback' || key === 'awaitmsg-draft-store-fallback') {
          throw new DOMException('Quota exceeded', 'QuotaExceededError');
        }
        return originalSetItem.call(this, key, value);
      });
      const { unmount } = await renderWorkspacePage();
  
      await act(async () => {
        (document.querySelector('.workspace-page-rich-text-clear') as HTMLButtonElement).click();
        await new Promise((resolve) => window.setTimeout(resolve, 0));
      });
  
      expect(document.querySelector('.workspace-page-rich-text-input.is-active')?.textContent).toContain('Keep this if local storage is full');
      expect(readWorkspaceDraftStoreFallback()?.workspaceDraft).toMatchObject({ body: 'Keep this if local storage is full' });
  
      unmount();
      setItem.mockRestore();
      if (originalDraftStorage) Object.defineProperty(window, 'draftStorage', originalDraftStorage);
    });
  
  it('records removed files in history without deleting the persistent copy', async () => {
      localStorage.removeItem('awaitmsg-workspace-draft');
      workspaceTestState.inMemoryDraftStore = {
        schemaVersion: 3,
        migrationVersion: 1,
        savedDrafts: [],
        documentHistories: {},
        workspaceDraft: {
          documentId: 'attachment-removal-document',
          body: 'Keep the image with this post',
          entities: [],
          attachments: [{ id: 'history-photo', type: 'image', name: 'photo.png', mimeType: 'image/png', size: 123, path: '/stored/photo.png', position: 4 }],
          savedAt: '12:00',
        },
      };
      const { unmount } = await renderWorkspacePage();
  
      await act(async () => {
        (document.querySelector('button[aria-label="Remove photo.png"]') as HTMLButtonElement).click();
        await new Promise((resolve) => window.setTimeout(resolve, 0));
      });
      await waitForWorkspaceAutosave();
  
      const versions = workspaceTestState.inMemoryDraftStore.documentHistories?.['attachment-removal-document'] ?? [];
      expect(versions.map((version) => ({
        documentId: version.documentId,
        reason: version.reason,
        body: (version.snapshot as WorkspaceDraft).body,
      }))).toEqual([{ documentId: 'attachment-removal-document', reason: 'before-attachment-removal', body: 'Keep the image with this post' }]);
      expect((versions[0].snapshot as WorkspaceDraft).attachments).toMatchObject([
        { name: 'photo.png', path: '/stored/photo.png', position: 4 },
      ]);
      expect(getInMemoryWorkspaceDraft().attachments).toEqual([]);
      expect(window.draftStorage.copyAttachmentPath).toHaveBeenCalledWith('/stored/photo.png');
      unmount();
    });
  
  it('removes an attachment chip without waiting for its history copy', async () => {
      localStorage.removeItem('awaitmsg-workspace-draft');
      workspaceTestState.inMemoryDraftStore = {
        schemaVersion: 3,
        migrationVersion: 1,
        savedDrafts: [],
        documentHistories: {},
        workspaceDraft: {
          documentId: 'immediate-attachment-removal-document',
          body: 'Keep the image with this post',
          entities: [],
          attachments: [{ id: 'history-photo', type: 'image', name: 'photo.png', mimeType: 'image/png', size: 123, path: '/stored/photo.png', position: 4 }],
          savedAt: '12:00',
        },
      };
      let finishCopy!: (result: { success: boolean; attachment: { name: string; path: string; size: number } }) => void;
      vi.mocked(window.draftStorage.copyAttachmentPath).mockReturnValueOnce(new Promise((resolve) => {
        finishCopy = resolve;
      }));
      const { unmount } = await renderWorkspacePage();
  
      await act(async () => {
        (document.querySelector('button[aria-label="Remove photo.png"]') as HTMLButtonElement).click();
        await Promise.resolve();
      });
  
      expect(document.querySelector('button[aria-label="Remove photo.png"]')).toBeNull();
      expect(getInMemoryWorkspaceDraft().attachments).toHaveLength(1);
  
      await act(async () => {
        finishCopy({ success: true, attachment: { name: 'photo.png', path: '/stored/photo.png', size: 123 } });
        await Promise.resolve();
        await Promise.resolve();
      });
      await waitFor(() => {
        expect(workspaceTestState.inMemoryDraftStore.documentHistories?.['immediate-attachment-removal-document']).toHaveLength(1);
      });
      unmount();
    });
  
  it('keeps native undo and redo shortcuts and opens History with Ctrl/Cmd+Shift+H', async () => {
      const { unmount } = await renderWorkspacePage();
      const editor = document.querySelector('[aria-label="Post content"]') as HTMLDivElement;
  
      const undoEvent = new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, bubbles: true, cancelable: true });
      const redoEvent = new KeyboardEvent('keydown', { key: 'y', ctrlKey: true, bubbles: true, cancelable: true });
      editor.dispatchEvent(undoEvent);
      editor.dispatchEvent(redoEvent);
      expect(undoEvent.defaultPrevented).toBe(false);
      expect(redoEvent.defaultPrevented).toBe(false);
  
      const openHistoryEvent = new KeyboardEvent('keydown', { key: 'H', ctrlKey: true, shiftKey: true, bubbles: true, cancelable: true });
      await act(async () => editor.dispatchEvent(openHistoryEvent));
      expect(openHistoryEvent.defaultPrevented).toBe(true);
      expect(document.querySelector('[role="dialog"]')).not.toBeNull();
  
      await act(async () => {
        (document.querySelector('.workspace-page-version-history-close') as HTMLButtonElement).click();
      });
      const input = document.createElement('input');
      document.body.appendChild(input);
      input.focus();
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'H', ctrlKey: true, shiftKey: true, bubbles: true, cancelable: true }));
      expect(document.querySelector('[role="dialog"]')).toBeNull();
      input.remove();
      unmount();
    });
  
  it('restores a scheduled post in the editor without canceling it immediately', async () => {
      const registerRescheduler = vi.fn();
      const handleCancelMessage = vi.fn();
      const setSelectedChat = vi.fn();
      const setDate = vi.fn();
      const setTime = vi.fn();
      const scheduledAt = new Date('2035-01-15T18:30:00.000Z');
      const message: ScheduledMessage = {
        id: 'studio-reschedule-1',
        chatId: chatA.id,
        chatName: chatA.name,
        text: 'Restore this scheduled post',
        when: scheduledAt.toISOString(),
        createdAt: '2035-01-15T17:00:00.000Z',
        status: 'confirmed',
        attachments: ['C:\\files\\brief.pdf'],
        entities: [{ type: 'bold', offset: 0, length: 7 }],
      };
      const { rerender, unmount } = await renderWorkspacePage({
        onRegisterHistoryRescheduleHandler: registerRescheduler,
        handleCancelMessage,
        setSelectedChat,
        setDate,
        setTime,
      });
      const menuToggle = document.querySelector<HTMLButtonElement>('.workspace-page-publish-menu-toggle')!;
      await act(async () => {
        menuToggle.click();
      });
      const scheduleOption = Array.from(document.querySelectorAll('.workspace-page-publish-option'))
        .find((button) => button.textContent?.trim() === 'Schedule') as HTMLButtonElement;
      await act(async () => {
        scheduleOption.click();
      });
      const restoredTimeButton = Array.from(document.querySelectorAll('.workspace-page-schedule-compact-button'))
        .find((button) => button.textContent?.trim() === 'Time') as HTMLButtonElement;
      await act(async () => {
        restoredTimeButton.click();
      });
      const dayInput = document.querySelector<HTMLInputElement>('[aria-label="Day"]')!;
      await act(async () => {
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(dayInput, '99');
        dayInput.dispatchEvent(new Event('input', { bubbles: true }));
      });
  
      expect(registerRescheduler).toHaveBeenCalledWith(expect.any(Function));
      const editor = document.querySelector<HTMLDivElement>('.workspace-page-rich-text-input')!;
      Object.defineProperties(editor, {
        scrollHeight: { configurable: true, value: 900 },
        clientHeight: { configurable: true, value: 200 },
      });
      await act(async () => {
        registerRescheduler.mock.calls[0][0](message);
      });
  
      const expectedDate = `${scheduledAt.getFullYear()}-${String(scheduledAt.getMonth() + 1).padStart(2, '0')}-${String(scheduledAt.getDate()).padStart(2, '0')}`;
      const expectedTime = `${String(scheduledAt.getHours()).padStart(2, '0')}:${String(scheduledAt.getMinutes()).padStart(2, '0')}`;
      rerender({
        date: expectedDate,
        time: expectedTime,
      });
      expect(editor.classList.contains('is-active')).toBe(true);
      await act(async () => {
        await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));
      });
      await act(async () => {
        await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));
      });
  
      expect(setSelectedChat).toHaveBeenCalledWith(chatA);
      expect(setDate).toHaveBeenCalledWith(expectedDate);
      expect(setTime).toHaveBeenCalledWith(expectedTime);
      expect(handleCancelMessage).not.toHaveBeenCalled();
      expect(editor.textContent).toContain(message.text);
      expect(document.activeElement).toBe(editor);
      expect(editor.dataset.selectionStart).toBe(String(message.text.length));
      expect(editor.dataset.selectionEnd).toBe(String(message.text.length));
      expect(editor.scrollTop).toBe(700);
      const visibleTimeButton = Array.from(document.querySelectorAll('.workspace-page-schedule-compact-button'))
        .find((button) => button.textContent?.trim() === 'Time') as HTMLButtonElement;
      await act(async () => {
        visibleTimeButton.click();
      });
      expect(document.querySelector<HTMLInputElement>('[aria-label="Day"]')?.value).toBe(String(scheduledAt.getDate()));
      expect(document.querySelector<HTMLInputElement>('[aria-label="Month"]')?.value).toBe(String(scheduledAt.getMonth() + 1).padStart(2, '0'));
      expect(document.querySelector<HTMLInputElement>('[aria-label="Year"]')?.value).toBe(String(scheduledAt.getFullYear()));
      expect(document.querySelector<HTMLInputElement>('[aria-label="Hours"]')?.value).toBe(expectedTime.slice(0, 2));
      expect(document.querySelector<HTMLInputElement>('[aria-label="Minutes"]')?.value).toBe(expectedTime.slice(3));
  
      unmount();
    });
  
  it('preserves all scheduled post data when draft hydration finishes after rescheduling starts', async () => {
      let finishDraftLoad!: (result: Awaited<ReturnType<typeof window.draftStorage.load>>) => void;
      workspaceTestState.inMemoryDraftStore = {
        schemaVersion: 2,
        migrationVersion: 1,
        savedDrafts: [],
        workspaceDraft: {
          body: 'An older workspace draft',
          entities: [],
          attachments: [{ name: 'old.pdf', path: 'C:\\files\\old.pdf' }],
          savedAt: '10:00',
          selectedChat: chatA,
          date: '2026-01-10',
          time: '09:00',
          repeatMode: 'none',
          repeatDays: [],
          repeatOccurrences: 5,
        },
      };
      vi.mocked(window.draftStorage.load).mockImplementationOnce(() => new Promise((resolve) => {
        finishDraftLoad = resolve;
      }));
  
      const registerRescheduler = vi.fn();
      const setDate = vi.fn();
      const setTime = vi.fn();
      const scheduledAt = new Date('2035-01-15T18:30:00.000Z');
      const message: ScheduledMessage = {
        id: 'studio-reschedule-before-hydration',
        chatId: chatA.id,
        chatName: chatA.name,
        text: 'Keep this exact scheduled text',
        when: scheduledAt.toISOString(),
        createdAt: '2035-01-15T17:00:00.000Z',
        status: 'confirmed',
        attachments: ['C:\\files\\brief.pdf', 'C:\\files\\photo.png'],
        entities: [{ type: 'bold', offset: 10, length: 5 }],
      };
      const { rerender, unmount } = await renderWorkspacePage({
        onRegisterHistoryRescheduleHandler: registerRescheduler,
        upcoming: [message],
        setDate,
        setTime,
      });
  
      try {
        await act(async () => {
          registerRescheduler.mock.calls[0][0](message);
        });
        const expectedDate = `${scheduledAt.getFullYear()}-${String(scheduledAt.getMonth() + 1).padStart(2, '0')}-${String(scheduledAt.getDate()).padStart(2, '0')}`;
        const expectedTime = `${String(scheduledAt.getHours()).padStart(2, '0')}:${String(scheduledAt.getMinutes()).padStart(2, '0')}`;
        rerender({ date: expectedDate, time: expectedTime });
        await act(async () => {
          finishDraftLoad({
            success: true,
            store: JSON.parse(JSON.stringify(workspaceTestState.inMemoryDraftStore)),
          });
        });
  
        const editor = document.querySelector('.workspace-page-rich-text-input.is-active');
        expect(editor?.textContent).toContain(message.text);
        expect(editor?.textContent).not.toContain('An older workspace draft');
        expect(document.body.textContent).toContain('brief.pdf');
        expect(document.body.textContent).toContain('photo.png');
        expect(document.querySelector('.workspace-page-rich-text-input.is-active strong')?.textContent).toBe('exact');
        const timeButton = Array.from(document.querySelectorAll('.workspace-page-schedule-compact-button'))
          .find((button) => button.textContent?.trim() === 'Time') as HTMLButtonElement;
        await act(async () => {
          timeButton.click();
        });
        expect(document.querySelector<HTMLInputElement>('[aria-label="Hours"]')?.value)
          .toBe(expectedTime.slice(0, 2));
        expect(document.querySelector<HTMLInputElement>('[aria-label="Minutes"]')?.value)
          .toBe(expectedTime.slice(3));
        expect(setDate).toHaveBeenCalledWith(expectedDate);
        expect(setDate).not.toHaveBeenCalledWith('2026-01-10');
        expect(setTime).toHaveBeenCalledWith(expectedTime);
        expect(setTime).not.toHaveBeenCalledWith('09:00');
      } finally {
        unmount();
      }
    });
  
  it('allows selecting publish modes before the message is ready without executing them', async () => {
      localStorage.setItem('awaitmsg-workspace-draft', JSON.stringify({
        body: '',
        entities: [],
        attachments: [],
        savedAt: '12:00',
        date: '',
        time: '',
        repeatMode: 'none',
        repeatDays: [],
        repeatOccurrences: 1,
      }));
      const handleSchedule = vi.fn();
      const handleSendDraftNow = vi.fn().mockResolvedValue(true);
      const { unmount } = await renderWorkspacePage({
        chats: [],
        selectedChat: null,
        date: '',
        time: '',
        handleSchedule,
        handleSendDraftNow,
      });
      const menuToggle = document.querySelector('.workspace-page-publish-menu-toggle') as HTMLButtonElement;
  
      for (const { menuLabel, buttonLabel } of [
        { menuLabel: 'Schedule', buttonLabel: 'Schedule' },
        { menuLabel: 'Save draft', buttonLabel: 'Save draft' },
        { menuLabel: 'Send now', buttonLabel: 'Send now' },
      ]) {
        await act(async () => {
          menuToggle.click();
        });
        const option = Array.from(document.querySelectorAll('.workspace-page-publish-option'))
          .find((button) => button.textContent?.trim() === menuLabel) as HTMLButtonElement;
  
        expect(option).toBeTruthy();
        expect(option.disabled).toBe(false);
  
        await act(async () => {
          option.click();
        });
  
        const primaryLabel = document.querySelector('.workspace-page-publish-trigger-main')?.textContent?.trim();
        expect(primaryLabel).toBe(buttonLabel);
        expect((document.querySelector('.workspace-page-publish-main') as HTMLButtonElement).disabled).toBe(false);
  
        if (menuLabel === 'Schedule') {
          expect(document.querySelector('.workspace-page-rich-text-schedule-stage.is-active')).toBeNull();
          const timeButton = Array.from(document.querySelectorAll('.workspace-page-schedule-compact-button'))
            .find((button) => button.textContent?.trim() === 'Time') as HTMLButtonElement;
          expect(timeButton).toBeTruthy();
          await act(async () => {
            timeButton.click();
          });
          expect(document.querySelector('.workspace-page-rich-text-schedule-stage.is-active')).not.toBeNull();
        }
  
        if (menuLabel === 'Save draft') {
          expect(document.querySelector('.workspace-page-rich-text-schedule-stage.is-active')).toBeNull();
        }
      }
  
      await act(async () => {
        menuToggle.click();
      });
      expect(document.querySelector('.workspace-page-publish-main.is-send')).toBeInTheDocument();
      expect(handleSchedule).not.toHaveBeenCalled();
      expect(handleSendDraftNow).not.toHaveBeenCalled();
      expect(workspaceTestState.inMemoryDraftStore.savedDrafts).toHaveLength(0);
      unmount();
    });
  
  it('keeps the selected publish mode planner-blue and unchanged on hover', () => {
      expect(workspacePageStyles).toMatch(/html\[data-theme='light'\] \.workspace-page \.workspace-page-publish-menu-compact \.workspace-page-publish-option\.is-selected:hover:not\(:disabled\),\s*html\[data-theme='light'\] \.workspace-page \.workspace-page-publish-menu-compact \.workspace-page-publish-option\.is-selected:focus-visible\s*\{[^}]*background:\s*#239dfb !important;[^}]*color:\s*#ffffff !important;[^}]*transform:\s*none;/);
      expect(workspacePageStyles).toMatch(/html\[data-theme='light'\] \.workspace-page \.workspace-page-publish-menu-compact \.workspace-page-publish-option\.is-selected\s*\{[^}]*background:\s*#239dfb !important;[^}]*color:\s*#ffffff !important;/);
      expect(workspacePageStyles).toMatch(/\.workspace-page-publish-menu-compact \.workspace-page-publish-option\.is-selected\s*\{[^}]*background:\s*#239dfb;[^}]*color:\s*#ffffff;/);
      expect(workspacePageStyles).toMatch(/\.workspace-page-publish-menu-compact \.workspace-page-publish-option\.is-selected\.is-send,[\s\S]*?\.workspace-page-publish-option\.is-selected\.is-draft:focus-visible\s*\{[^}]*background:\s*#239dfb !important;[^}]*color:\s*#ffffff !important;/);
      expect(workspacePageStyles).toMatch(/\.workspace-page \.workspace-page-publish-menu \.workspace-page-publish-option\.is-selected,[\s\S]*?\.workspace-page-publish-option\.is-selected\.is-draft\s*\{[^}]*background:\s*#239dfb !important;[^}]*color:\s*#ffffff !important;/);
      expect(workspacePageStyles).toMatch(/workspace-page-publish-option\.is-selected:hover::before,[\s\S]*?workspace-page-publish-option\.is-selected:focus-visible::after\s*\{\s*opacity:\s*0;/);
    });
  
  it('keeps every publish mode Planner blue', () => {
      expect(workspacePageStyles).toMatch(/\.workspace-page \.workspace-page-submit-actions \.workspace-page-publish-main:is\(\.is-send, \.is-scheduled, \.is-draft\):not\(:disabled\)\s*\{[^}]*border-color:\s*#239dfb !important;[^}]*background:\s*#239dfb !important;[^}]*color:\s*#ffffff !important;/);
      expect(workspacePageStyles).toMatch(/\.workspace-page \.workspace-page-submit-actions \.workspace-page-publish-main:is\(\.is-send, \.is-scheduled, \.is-draft\):is\(:hover, :focus-visible\):not\(:disabled\)\s*\{[^}]*background:\s*#239dfb !important;[^}]*filter:\s*brightness\(1\.04\);/);
      expect(workspacePageStyles).toMatch(/\.workspace-page \.workspace-page-submit-actions \.workspace-page-publish-main:is\(\.is-send, \.is-scheduled, \.is-draft\):active:not\(:disabled\)\s*\{[^}]*background:\s*#239dfb !important;[^}]*filter:\s*brightness\(0\.98\);/);
    });
  
  it('uses consistent light Studio control tones and toolbar chip sizing', () => {
      expect(colorThemeStyles).toMatch(/html\[data-theme='light'\] \.workspace-page\s*\{[^}]*--studio-control-background:\s*#f1f6f8;[^}]*--studio-control-border:\s*#cfdee5;[^}]*--studio-control-foreground:\s*#456477;/);
      expect(colorThemeStyles).toMatch(/html\[data-theme='light'\] \.workspace-page \.workspace-page-rich-text-toolbar\.is-airy \.workspace-page-rich-text-leading-tools > \.workspace-page-rich-text-tool-anchor > button,[\s\S]*? \.workspace-page-rich-text-toolbar-actions > \.workspace-page-rich-text-format-option,[\s\S]*?\{\s*width:\s*32px !important;[^}]*height:\s*32px !important;/);
      expect(colorThemeStyles).toMatch(/html\[data-theme='light'\] \.workspace-page \.workspace-page-action-row \.workspace-page-attachment-toggle,[\s\S]*?height:\s*40px !important;[^}]*min-height:\s*40px !important;/);
      expect(colorThemeStyles).toMatch(/html\[data-theme='light'\] \.workspace-page \.workspace-page-rich-text-toolbar button:hover:not\(:disabled\)\s*\{\s*background:\s*#e4eef3 !important;/);
    });
  
  it('prevents light-theme section buttons from shrinking when changing Studio stages', () => {
      expect(colorThemeStyles).toMatch(/html\[data-theme='light'\] \.workspace-page \.workspace-page-action-left-group \.workspace-page-mode-button-template,[\s\S]*?\.workspace-page-mode-button-template\[aria-pressed='true'\]\s*\{\s*flex-shrink:\s*0 !important;/);
    });
  
  it('styles chat search and add-chat inputs for the light theme', () => {
      expect(colorThemeStyles).toMatch(/html\[data-theme='light'\] \.workspace-page \.workspace-page-rich-text-chat-stage \.workspace-page-chat-stage-search input,[\s\S]*?html\[data-theme='light'\] \.workspace-page \.workspace-page-rich-text-chat-stage \.workspace-page-chat-stage-add-form input,[\s\S]*?html\[data-theme='light'\] \.workspace-page \.workspace-page-rich-text-template-stage \.workspace-page-template-stage-search input\s*\{[^}]*background:\s*#ffffff !important;[^}]*color:\s*#26343d !important;[^}]*color-scheme:\s*light;/);
      expect(colorThemeStyles).toMatch(/html\[data-theme='light'\] \.workspace-page \.workspace-page-rich-text-chat-stage \.workspace-page-chat-stage-search input:focus,[\s\S]*?html\[data-theme='light'\] \.workspace-page \.workspace-page-rich-text-chat-stage \.workspace-page-chat-stage-add-form input:focus,[\s\S]*?html\[data-theme='light'\] \.workspace-page \.workspace-page-rich-text-template-stage \.workspace-page-template-stage-search input:focus\s*\{[^}]*border-color:\s*#8ab8cf !important;[^}]*box-shadow:\s*0 0 0 3px rgba\(71, 124, 158, 0\.14\) !important;/);
      expect(colorThemeStyles).toMatch(/html\[data-theme='light'\] \.workspace-page \.workspace-page-rich-text-chat-stage \.workspace-page-chat-stage-search input::placeholder,[\s\S]*?html\[data-theme='light'\] \.workspace-page \.workspace-page-rich-text-chat-stage \.workspace-page-chat-stage-add-form input::placeholder,[\s\S]*?html\[data-theme='light'\] \.workspace-page \.workspace-page-rich-text-template-stage \.workspace-page-template-stage-search input::placeholder\s*\{\s*color:\s*#7c8b95 !important;/);
      expect(colorThemeStyles).toMatch(/html\[data-theme='light'\] \.workspace-page \.workspace-page-rich-text-chat-stage \.workspace-page-chat-stage-search input::selection,[\s\S]*?html\[data-theme='light'\] \.workspace-page \.workspace-page-rich-text-chat-stage \.workspace-page-chat-stage-add-form input::selection,[\s\S]*?html\[data-theme='light'\] \.workspace-page \.workspace-page-rich-text-template-stage \.workspace-page-template-stage-search input::selection,[\s\S]*?html\[data-theme='light'\] \.workspace-page \.workspace-page-rich-text-input::selection,[\s\S]*?html\[data-theme='light'\] \.workspace-page \.workspace-page-rich-text-input \*::selection\s*\{\s*background:\s*#d9dde0 !important;\s*color:\s*#26343d !important;/);
    });
  
  it('darkens attachment chip borders in the light theme without changing the background', () => {
      expect(colorThemeStyles).toMatch(
        /html\[data-theme='light'\] \.workspace-page \.workspace-page-attachment-card\s*\{\s*border-color:\s*#bdc9d0;\s*background:\s*#f8fafb;/,
      );
    });
  
  it('keeps the light-theme Studio calendar today visible and selected repeat options distinct', () => {
      expect(colorThemeStyles).toMatch(
        /html\[data-theme='light'\] \.quick-planner-date-picker-grid button\.is-today\s*\{[^}]*background:\s*#e2f2fc !important;[^}]*color:\s*#075f9d !important;[^}]*box-shadow:\s*inset 0 0 0 1px rgba\(8, 122, 203, 0\.16\) !important;/,
      );
      expect(colorThemeStyles).toMatch(
        /html\[data-theme='light'\] \.quick-planner-date-picker-grid button\.is-today\.is-selected,[\s\S]*?background:\s*#087acb !important;[^}]*color:\s*#ffffff !important;/,
      );
      expect(colorThemeStyles).toMatch(
        /html\[data-theme='light'\] \.workspace-page \.workspace-page-rich-text-schedule-stage \.workspace-page-schedule-repeat-menu button\.is-selected,[\s\S]*?\.workspace-page-weekday-list button\.is-selected\s*\{[^}]*background:\s*#cbdde6 !important;[^}]*color:\s*#244b62 !important;/,
      );
    });
  
  it('keeps Studio Done buttons light and adds only an outline on hover', () => {
      expect(colorThemeStyles).toMatch(
        /html\[data-theme='light'\] \.workspace-page \.workspace-page-rich-text-chat-stage > \.workspace-page-chat-stage-footer \.workspace-page-stage-primary:hover:not\(:disabled\),[\s\S]*?\.workspace-page-rich-text-schedule-stage > \.workspace-page-schedule-footer \.workspace-page-stage-primary:focus-visible:not\(:disabled\)\s*\{[^}]*outline:\s*1px solid rgba\(112, 157, 178, 0\.42\) !important;[^}]*background:\s*#f1f6f8 !important;/,
      );
    });
  
  it('keeps light Studio bottom buttons visually consistent across toggle states', () => {
      expect(workspacePageStyles).toMatch(/html\[data-theme='light'\] \.workspace-page \.workspace-page-submit-actions \.workspace-page-publish-main:is\(\.is-send, \.is-scheduled, \.is-draft\):is\(:hover, :focus-visible\):not\(:disabled\)\s*\{[^}]*border-color:\s*#239dfb !important;[^}]*background:\s*#239dfb !important;[^}]*color:\s*#ffffff !important;/);
      expect(colorThemeStyles).toMatch(/html\[data-theme='light'\] \.workspace-page \.workspace-page-action-row\.workspace-page-schedule-row > \.workspace-page-submit-actions > \.workspace-page-publish-main:hover:not\(:disabled\),[\s\S]*?\.workspace-page-publish-main:focus-visible:not\(:disabled\)\s*\{\s*border-color:\s*#168de8 !important;\s*background:\s*#168de8 !important;/);
      expect(workspacePageStyles).toMatch(/html\[data-theme='light'\] \.workspace-page \.workspace-page-publish-menu-compact \.workspace-page-publish-option\.is-selected:not\(:hover\):not\(:focus-visible\)\s*\{[^}]*border-color:\s*#239dfb !important;[^}]*background:\s*#239dfb !important;[^}]*color:\s*#ffffff !important;/);
      expect(workspacePageStyles).toMatch(/html\[data-theme='light'\] \.workspace-page \.workspace-page-publish-menu-compact \.workspace-page-publish-option:not\(\.is-selected\):is\(:hover, :focus-visible\):not\(:disabled\)\s*\{[^}]*border-color:\s*rgba\(35, 157, 251, 0\.52\) !important;[^}]*background:\s*#eaf6ff !important;[^}]*color:\s*#087acb !important;/);
      expect(workspacePageStyles).toMatch(/html\[data-theme='light'\] \.workspace-page \.workspace-page-publish-menu-compact \.workspace-page-publish-option\.is-selected:is\(:hover, :focus-visible\):not\(:disabled\)\s*\{[^}]*background:\s*#239dfb !important;[^}]*color:\s*#ffffff !important;[^}]*transform:\s*none !important;/);
      expect(workspacePageStyles).toMatch(/workspace-page-publish-option:is\(:hover, :focus-visible\)::before,[\s\S]*?workspace-page-publish-option:is\(:hover, :focus-visible\)::after\s*\{\s*opacity:\s*0 !important;/);
      expect(colorThemeStyles).not.toMatch(/\.workspace-page-action-left-group > button:hover:not\(:disabled\)\s*\{[^}]*background:\s*#6b9fb5 !important;/);
      expect(colorThemeStyles).not.toMatch(/\.workspace-page-action-row\.workspace-page-schedule-row button\[aria-pressed='true'\],[\s\S]*?background:\s*var\(--studio-control-background\) !important;/);
    });
  
  it('uses brand blue only on hover or focus for light-theme schedule controls', () => {
      expect(colorThemeStyles).toMatch(/--studio-control-hover:\s*rgba\(35, 157, 251, 0\.12\);[\s\S]*?--studio-control-selected:\s*#f0f2f4;/);
      expect(colorThemeStyles).toMatch(/border-color:\s*rgba\(35, 157, 251, 0\.42\) !important;\s*background:\s*var\(--studio-control-hover\) !important;\s*color:\s*#087acb !important;/);
      expect(colorThemeStyles).toMatch(/button\.is-selected:not\(:hover\):not\(:focus-visible\)\s*\{\s*border-color:\s*#d7dfe4 !important;\s*background:\s*var\(--studio-control-selected\) !important;\s*color:\s*#456477 !important;/);
      expect(workspacePageStyles).toMatch(/html\[data-theme='light'\] \.workspace-page \.workspace-page-rich-text-schedule-stage \.workspace-page-schedule-segment:hover,[\s\S]*?border-color:\s*rgba\(35, 157, 251, 0\.52\) !important;\s*background:\s*rgba\(35, 157, 251, 0\.12\) !important;/);
      expect(workspacePageStyles).toMatch(/button\.is-selected:not\(:hover\):not\(:focus-visible\)\s*\{\s*border-color:\s*#d7dfe4 !important;\s*background:\s*#f0f2f4 !important;\s*color:\s*#3a4650 !important;/);
    });
  
  it('uses a neutral highlight for dark-theme Studio buttons', () => {
      const darkPublishHover = workspacePageStyles.slice(
        workspacePageStyles.lastIndexOf("html[data-theme='dark'] .workspace-page .workspace-page-submit-actions .workspace-page-publish-main:is(.is-send, .is-scheduled, .is-draft):is(:hover, :focus-visible)"),
      );
      const darkPublishActive = workspacePageStyles.slice(
        workspacePageStyles.lastIndexOf("html[data-theme='dark'] .workspace-page .workspace-page-submit-actions .workspace-page-publish-main:is(.is-send, .is-scheduled, .is-draft):active"),
      );
      expect(darkPublishHover).toMatch(/border-color:\s*#59636b !important;[\s\S]*?linear-gradient\(135deg, #39434a, #2b343a 58%, #20272c\) !important;[\s\S]*?box-shadow:\s*0 4px 10px rgba\(0, 0, 0, 0\.22\), inset 0 1px 0 rgba\(255, 255, 255, 0\.12\) !important;/);
      expect(workspacePageStyles).toMatch(/html\[data-theme='dark'\] \.workspace-page \.workspace-page-schedule-menu-trigger:hover,[\s\S]*?box-shadow:\s*inset 0 0 0 1px rgba\(210, 218, 223, 0\.12\), 0 0 0 1px rgba\(210, 218, 223, 0\.05\) !important;/);
      expect(colorThemeStyles).toMatch(/html\[data-theme='dark'\] \.workspace-page \.workspace-page-rich-text-schedule-stage \.workspace-page-schedule-segment:hover,[\s\S]*?box-shadow:\s*0 0 0 2px rgba\(210, 218, 223, 0\.12\) !important;/);
      expect(colorThemeStyles).toMatch(/html\[data-theme='dark'\] \.workspace-page \.workspace-page-rich-text-schedule-stage \.workspace-page-schedule-quick-row button:hover:not\(:disabled\)[\s\S]*?\{\s*border-color:\s*#59636b !important;\s*background:\s*#252d32 !important;\s*color:\s*#e2e7eb !important;/);
      expect(colorThemeStyles).toMatch(/html\[data-theme='dark'\] \.workspace-page-rich-text-schedule-stage \.workspace-page-schedule-time-picker button:hover:not\(:disabled\),[\s\S]*?button:focus-visible:not\(:disabled\)\s*\{\s*border-color:\s*#59636b !important;\s*background:\s*#252d32 !important;\s*color:\s*#e2e7eb !important;/);
      expect(colorThemeStyles).toMatch(/html\[data-theme='dark'\] \.workspace-page-rich-text-schedule-stage \.workspace-page-schedule-time-picker button\.is-selected,[\s\S]*?\{\s*border-color:\s*#59636b !important;\s*background:\s*#293238 !important;\s*color:\s*#e2e7eb !important;/);
      expect(colorThemeStyles).toMatch(/html\[data-theme='dark'\] \.workspace-page \.workspace-page-rich-text-schedule-stage \.workspace-page-schedule-repeat-menu button\.is-selected,[\s\S]*?\.workspace-page-weekday-list button\.is-selected\s*\{\s*border-color:\s*#59636b !important;\s*background:\s*#39434a !important;\s*color:\s*#f2f5f7 !important;\s*box-shadow:\s*inset 0 1px 0 rgba\(255, 255, 255, 0\.1\) !important;/);
      const darkSelectedPublishOption = workspacePageStyles.slice(
        workspacePageStyles.lastIndexOf("html[data-theme='dark'] .workspace-page .workspace-page-submit-actions .workspace-page-publish-menu-compact .workspace-page-publish-option.is-selected,"),
      );
      expect(darkSelectedPublishOption).toMatch(/border-color:\s*#59636b !important;\s*background:\s*#39434a !important;\s*color:\s*#f2f5f7 !important;[\s\S]*?transform:\s*none !important;/);
      expect(darkSelectedPublishOption).toMatch(/\.workspace-page-publish-option\.is-selected::before,[\s\S]*?\.workspace-page-publish-option\.is-selected::after\s*\{\s*opacity:\s*0 !important;/);
      expect(workspacePageStyles).toMatch(/html\[data-theme='dark'\] \.workspace-page \.workspace-page-rich-text-toolbar button:hover:not\(:disabled\):not\(\.is-selected\),[\s\S]*?\.workspace-page-rich-text-template-stage button:hover:not\(:disabled\):not\(\.is-selected\):not\(\.workspace-page-draft-color-filter\),[\s\S]*?\.workspace-page-rich-text-chat-stage button:focus-visible:not\(:disabled\):not\(\.is-selected\)\s*\{\s*border-color:\s*#59636b !important;\s*background-color:\s*#39434a !important;\s*color:\s*#f2f5f7 !important;\s*box-shadow:\s*inset 0 1px 0 rgba\(255, 255, 255, 0\.1\) !important;\s*transform:\s*none;/);
      expect(workspacePageStyles).toMatch(/workspace-page-rich-text-template-stage button:focus-visible:not\(:disabled\):not\(\.is-selected\):not\(\.workspace-page-draft-color-filter\)/);
      expect(workspacePageStyles).not.toMatch(/html\[data-theme='dark'\] \.workspace-page \.workspace-page-action-left-group \.workspace-page-preview-toggle\[aria-pressed='true'\]/);
      expect(colorThemeStyles).not.toMatch(/html\[data-theme='dark'\] \.workspace-page \.workspace-page-action-left-group \.workspace-page-preview-toggle\[aria-pressed='true'\]/);
      expect(colorThemeStyles).toMatch(/html\[data-theme='dark'\] \.workspace-page \.workspace-page-submit-actions \.workspace-page-publish-menu-toggle:is\(:hover, :focus-visible, :active, \.is-active, \[aria-expanded='true'\], \[aria-pressed='true'\]\)\s*\{\s*border-color:\s*#59636b !important;\s*background:\s*#39434a !important;\s*color:\s*#f2f5f7 !important;\s*box-shadow:\s*inset 0 1px 0 rgba\(255, 255, 255, 0\.1\) !important;/);
      expect(darkPublishActive).toMatch(/\.workspace-page-publish-main:is\(\.is-send, \.is-scheduled, \.is-draft\):active:not\(:disabled\)\s*\{\s*border-color:\s*#59636b !important;\s*background:\s*#39434a !important;\s*color:\s*#f2f5f7 !important;\s*box-shadow:\s*inset 0 1px 0 rgba\(255, 255, 255, 0\.1\) !important;\s*filter:\s*none !important;\s*transform:\s*none !important;/);
      expect(colorThemeStyles).toMatch(/html\[data-theme='dark'\] \.workspace-page \.workspace-page-action-row\.workspace-page-schedule-row > \.workspace-page-submit-actions > \.workspace-page-publish-main\s*\{\s*flex:\s*0 0 120px !important;\s*width:\s*120px !important;\s*min-width:\s*120px !important;/);
      expect(colorThemeStyles).toMatch(/@media \(max-width:\s*480px\)\s*\{[\s\S]*?html\[data-theme='dark'\] \.workspace-page[\s\S]*?workspace-page-submit-actions > \.workspace-page-publish-main\s*\{\s*flex-basis:\s*96px !important;\s*width:\s*96px !important;\s*min-width:\s*96px !important;/);
    });
  
  it('dims past calendar dates and schedule times in the dark theme', () => {
      expect(colorThemeStyles).toMatch(/html\[data-theme='dark'\] \.quick-planner-date-picker-grid button:disabled\s*\{[^}]*color:\s*#697780 !important;[^}]*opacity:\s*0\.62;/);
      expect(colorThemeStyles).toMatch(/html\[data-theme='dark'\] \.quick-planner-time-list button:disabled\s*\{[^}]*color:\s*#697780 !important;[^}]*opacity:\s*0\.62;/);
      expect(colorThemeStyles).toMatch(/html\[data-theme='dark'\] \.workspace-page-schedule-time-picker button:disabled\s*\{[^}]*color:\s*#697780 !important;[^}]*opacity:\s*0\.62;/);
      expect(colorThemeStyles).toMatch(/html\[data-theme='dark'\] \.workspace-page-schedule-time-picker\s*\{[^}]*color-scheme:\s*dark;/);
      expect(colorThemeStyles).toMatch(/html\[data-theme='dark'\] \.workspace-page-schedule-time-picker,[\s\S]*?backdrop-filter:\s*blur\(16px\) saturate\(135%\) !important;/);
      expect(colorThemeStyles).toMatch(/html\[data-theme='dark'\] \.quick-planner-date-picker-grid button:hover:not\(:disabled\):not\(\.is-selected\),\s*html\[data-theme='dark'\] \.quick-planner-date-picker-grid button:focus-visible:not\(:disabled\):not\(\.is-selected\)\s*\{\s*color:\s*#e2f3ff !important;/);
    });
  
  it('uses a glass surface for compact dark-theme popovers', () => {
      expect(workspacePageStyles).toMatch(/html\[data-theme='dark'\] \.workspace-page \.workspace-page-schedule-time-menu,[\s\S]*?html\[data-theme='dark'\] \.workspace-page-rich-text-emoji-picker--floating\s*\{[\s\S]*?backdrop-filter:\s*blur\(16px\) saturate\(135%\) !important;/);
      expect(workspacePageStyles).toMatch(/html\[data-theme='dark'\] \.workspace-page-rich-text-emoji-picker--floating\s*\{[\s\S]*?backdrop-filter:\s*blur\(16px\) saturate\(135%\) !important;/);
      expect(plannerNotificationStyles).toMatch(/html\[data-theme='dark'\] \.quick-planner \.quick-planner-chat-menu,[\s\S]*?html\[data-theme='dark'\] \.quick-planner-emoji-picker--floating\s*\{[\s\S]*?backdrop-filter:\s*blur\(16px\) saturate\(135%\) !important;/);
      expect(plannerNotificationStyles).toMatch(/html\[data-theme='dark'\] \.quick-planner-emoji-picker--floating\s*\{[\s\S]*?backdrop-filter:\s*blur\(16px\) saturate\(135%\) !important;/);
      expect(globalStyles).toMatch(/html\[data-theme='dark'\] \.chat-picker-menu,\s*html\[data-theme='dark'\] \.history-source-menu\s*\{[^}]*backdrop-filter:\s*blur\(16px\) saturate\(135%\) !important;/);
      expect(colorThemeStyles).toMatch(/html\[data-theme='dark'\] \.quick-planner-schedule-popover,[\s\S]*?html\[data-theme='dark'\] \.workspace-page-schedule-time-menu\s*\{[\s\S]*?backdrop-filter:\s*blur\(16px\) saturate\(135%\) !important;/);
      expect(colorThemeStyles).toMatch(/html\[data-theme='dark'\] \.quick-planner-date-picker-grid button:not\(\.is-selected\):not\(:disabled\),[\s\S]*?background:\s*rgba\(15, 21, 26, 0\.42\) !important;/);
    });
});
