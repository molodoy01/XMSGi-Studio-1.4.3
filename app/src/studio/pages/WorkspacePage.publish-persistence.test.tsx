import { act } from 'react';
import { waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PersistedDraftStore, ScheduledMessage } from '@studio/types';
import { chatA, workspacePageStyles, workspaceTestState, getInMemoryWorkspaceDraft, renderWorkspacePage, openDraftsStage, editComposerText, resetWorkspacePageTestEnvironment } from './WorkspacePage.testUtils';

describe('WorkspacePage publish persistence', () => {
  beforeEach(resetWorkspacePageTestEnvironment);

  it('releases failed file reservations while retaining reservations for copied files', async () => {
      const pendingCopies: Array<(result: { success: boolean; attachment?: { name: string; path: string; size: number }; error?: string }) => void> = [];
      vi.mocked(window.draftStorage.copyAttachment).mockImplementation(() => new Promise((resolve) => {
        pendingCopies.push(resolve);
      }));
      const makeFile = (name: string) => {
        const file = new File([''], name, { type: 'image/png' });
        Object.defineProperty(file, 'size', { value: 50 * 1024 * 1024 });
        return file;
      };
      const firstBatch = Array.from({ length: 4 }, (_, index) => makeFile(`partial-${index}.png`));
      const { unmount } = await renderWorkspacePage();
      const fileInput = document.querySelector('.workspace-page-hidden-file-input') as HTMLInputElement;
  
      await act(async () => {
        Object.defineProperty(fileInput, 'files', { value: firstBatch, configurable: true });
        fileInput.dispatchEvent(new Event('change', { bubbles: true }));
        await Promise.resolve();
      });
      expect(window.draftStorage.copyAttachment).toHaveBeenCalledTimes(4);
  
      await act(async () => {
        pendingCopies.slice(0, 3).forEach((resolve, index) => resolve({
          success: true,
          attachment: { name: firstBatch[index].name, path: `/stored/${firstBatch[index].name}`, size: firstBatch[index].size },
        }));
        pendingCopies[3]({ success: false, error: 'Simulated copy failure.' });
      });
      expect(document.querySelectorAll('.workspace-page-attachment-card')).toHaveLength(3);
  
      const nextFile = makeFile('after-partial-failure.png');
      await act(async () => {
        Object.defineProperty(fileInput, 'files', { value: [nextFile], configurable: true });
        fileInput.dispatchEvent(new Event('change', { bubbles: true }));
        await Promise.resolve();
      });
      expect(window.draftStorage.copyAttachment).toHaveBeenCalledTimes(5);
  
      await act(async () => {
        pendingCopies[4]({
          success: true,
          attachment: { name: nextFile.name, path: `/stored/${nextFile.name}`, size: nextFile.size },
        });
      });
      expect(document.querySelectorAll('.workspace-page-attachment-card')).toHaveLength(4);
  
      const overLimitFile = new File(['extra'], 'over-limit.png', { type: 'image/png' });
      await act(async () => {
        Object.defineProperty(fileInput, 'files', { value: [overLimitFile], configurable: true });
        fileInput.dispatchEvent(new Event('change', { bubbles: true }));
        await Promise.resolve();
      });
      expect(window.draftStorage.copyAttachment).toHaveBeenCalledTimes(5);
      expect(document.querySelector('.workspace-page-publish-transient-feedback.is-error')?.textContent)
        .toContain('200 MB');
      unmount();
    });
  
  it('allows a new-generation upload before old copies settle and ignores their late results', async () => {
      const pendingCopies: Array<(result: { success: boolean; attachment?: { name: string; path: string; size: number } }) => void> = [];
      vi.mocked(window.draftStorage.copyAttachment).mockImplementation(() => new Promise((resolve) => {
        pendingCopies.push(resolve);
      }));
      const makeFile = (name: string, size: number) => {
        const file = new File([''], name, { type: 'image/png' });
        Object.defineProperty(file, 'size', { value: size });
        return file;
      };
      const staleBatch = Array.from({ length: 4 }, (_, index) => makeFile(`old-${index}.png`, 50 * 1024 * 1024));
      const nextFile = makeFile('new-draft.png', 1024);
      const { rerender, unmount } = await renderWorkspacePage();
      const fileInput = document.querySelector('.workspace-page-hidden-file-input') as HTMLInputElement;
  
      await act(async () => {
        Object.defineProperty(fileInput, 'files', { value: staleBatch, configurable: true });
        fileInput.dispatchEvent(new Event('change', { bubbles: true }));
        await Promise.resolve();
      });
      expect(window.draftStorage.copyAttachment).toHaveBeenCalledTimes(4);
  
      rerender({ successPulse: true });
      await act(async () => {
        Object.defineProperty(fileInput, 'files', { value: [nextFile], configurable: true });
        fileInput.dispatchEvent(new Event('change', { bubbles: true }));
        await Promise.resolve();
      });
      expect(window.draftStorage.copyAttachment).toHaveBeenCalledTimes(5);
  
      await act(async () => {
        pendingCopies[4]({
          success: true,
          attachment: { name: nextFile.name, path: `/stored/${nextFile.name}`, size: nextFile.size },
        });
      });
      expect(document.querySelectorAll('.workspace-page-attachment-card')).toHaveLength(1);
  
      await act(async () => {
        pendingCopies.slice(0, 4).forEach((resolve, index) => resolve({
          success: true,
          attachment: { name: staleBatch[index].name, path: `/stored/${staleBatch[index].name}`, size: staleBatch[index].size },
        }));
      });
      expect(document.querySelectorAll('.workspace-page-attachment-card')).toHaveLength(1);
      expect(document.querySelector('.workspace-page-attachment-name')?.textContent).toBe(nextFile.name);
      unmount();
    });
  
  it('does not let an old upload overwrite a selected saved draft', async () => {
      const pendingCopies: Array<(result: { success: boolean; attachment?: { name: string; path: string; size: number } }) => void> = [];
      vi.mocked(window.draftStorage.copyAttachment).mockImplementation(() => new Promise((resolve) => {
        pendingCopies.push(resolve);
      }));
      workspaceTestState.inMemoryDraftStore.savedDrafts = [{
        id: 'generation-draft',
        name: 'Transition draft',
        body: 'New draft body',
        createdAt: '2026-09-28T10:00:00.000Z',
        updatedAt: '2026-09-29T18:35:00.000Z',
        attachments: [],
      }];
      workspaceTestState.inMemoryDraftStore.migrationVersion = 1;
      const oldFiles = Array.from({ length: 4 }, (_, index) => {
        const file = new File([''], `old-draft-${index}.png`, { type: 'image/png' });
        Object.defineProperty(file, 'size', { value: 50 * 1024 * 1024 });
        return file;
      });
      const nextFile = new File(['new'], 'saved-draft-upload.png', { type: 'image/png' });
      const { unmount } = await renderWorkspacePage();
      const fileInput = document.querySelector('.workspace-page-hidden-file-input') as HTMLInputElement;
  
      await act(async () => {
        Object.defineProperty(fileInput, 'files', { value: oldFiles, configurable: true });
        fileInput.dispatchEvent(new Event('change', { bubbles: true }));
        await Promise.resolve();
      });
      expect(window.draftStorage.copyAttachment).toHaveBeenCalledTimes(4);
  
      await openDraftsStage();
      const draftButton = Array.from(document.querySelectorAll('.workspace-page-rich-text-draft-stage button'))
        .find((button) => button.textContent?.includes('Transition draft')) as HTMLButtonElement;
      expect(draftButton).toBeTruthy();
      await act(async () => { draftButton.click(); });
  
      await act(async () => {
        Object.defineProperty(fileInput, 'files', { value: [nextFile], configurable: true });
        fileInput.dispatchEvent(new Event('change', { bubbles: true }));
        await Promise.resolve();
      });
      expect(window.draftStorage.copyAttachment).toHaveBeenCalledTimes(5);
  
      await act(async () => {
        pendingCopies[4]({
          success: true,
          attachment: { name: nextFile.name, path: `/stored/${nextFile.name}`, size: nextFile.size },
        });
      });
      await act(async () => {
        pendingCopies.slice(0, 4).forEach((resolve, index) => resolve({
          success: true,
          attachment: { name: oldFiles[index].name, path: `/stored/${oldFiles[index].name}`, size: oldFiles[index].size },
        }));
      });
  
      expect(document.querySelectorAll('.workspace-page-attachment-card')).toHaveLength(1);
      expect(document.querySelector('.workspace-page-attachment-name')?.textContent).toBe(nextFile.name);
      expect(document.querySelector('.workspace-page-rich-text-input')?.textContent).toContain('New draft body');
      unmount();
    });
  
  it('ignores old uploads when persisted draft restoration replaces the composer', async () => {
      const pendingCopies: Array<(result: { success: boolean; attachment?: { name: string; path: string; size: number } }) => void> = [];
      vi.mocked(window.draftStorage.copyAttachment).mockImplementation(() => new Promise((resolve) => {
        pendingCopies.push(resolve);
      }));
      let resolveLoad!: (result: Awaited<ReturnType<typeof window.draftStorage.load>>) => void;
      vi.mocked(window.draftStorage.load).mockImplementation(() => new Promise((resolve) => {
        resolveLoad = resolve;
      }));
      const staleFiles = Array.from({ length: 4 }, (_, index) => {
        const file = new File([''], `before-restore-${index}.png`, { type: 'image/png' });
        Object.defineProperty(file, 'size', { value: 50 * 1024 * 1024 });
        return file;
      });
      const newFile = new File(['new'], 'after-restore.png', { type: 'image/png' });
      const { unmount } = await renderWorkspacePage();
      const fileInput = document.querySelector('.workspace-page-hidden-file-input') as HTMLInputElement;
  
      await act(async () => {
        Object.defineProperty(fileInput, 'files', { value: staleFiles, configurable: true });
        fileInput.dispatchEvent(new Event('change', { bubbles: true }));
        await Promise.resolve();
      });
      expect(window.draftStorage.copyAttachment).toHaveBeenCalledTimes(4);
  
      resolveLoad({
        success: true,
        needsMigration: false,
        store: {
          schemaVersion: 2,
          migrationVersion: 1,
          savedDrafts: [],
          workspaceDraft: { body: 'Restored workspace draft', attachments: [] },
        },
      });
      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
      });
  
      await act(async () => {
        Object.defineProperty(fileInput, 'files', { value: [newFile], configurable: true });
        fileInput.dispatchEvent(new Event('change', { bubbles: true }));
        await Promise.resolve();
      });
      expect(window.draftStorage.copyAttachment).toHaveBeenCalledTimes(5);
  
      await act(async () => {
        pendingCopies[4]({
          success: true,
          attachment: { name: newFile.name, path: `/stored/${newFile.name}`, size: newFile.size },
        });
        pendingCopies.slice(0, 4).forEach((resolve, index) => resolve({
          success: true,
          attachment: { name: staleFiles[index].name, path: `/stored/${staleFiles[index].name}`, size: staleFiles[index].size },
        }));
      });
  
      expect(document.querySelector('.workspace-page-rich-text-input')?.textContent).toContain('Restored workspace draft');
      expect(Array.from(document.querySelectorAll('.workspace-page-attachment-name')).map((node) => node.textContent))
        .toEqual([newFile.name]);
      unmount();
    });
  
  it('keeps only the scheduled and new files when rescheduling during an old upload', async () => {
      const pendingCopies: Array<(result: { success: boolean; attachment?: { name: string; path: string; size: number } }) => void> = [];
      vi.mocked(window.draftStorage.copyAttachment).mockImplementation(() => new Promise((resolve) => {
        pendingCopies.push(resolve);
      }));
      const registerRescheduler = vi.fn();
      const staleFiles = Array.from({ length: 4 }, (_, index) => {
        const file = new File([''], `stale-${index}.png`, { type: 'image/png' });
        Object.defineProperty(file, 'size', { value: 50 * 1024 * 1024 });
        return file;
      });
      const newFile = new File(['new'], 'after-reschedule.png', { type: 'image/png' });
      const scheduledPost: ScheduledMessage = {
        id: 'reschedule-with-pending-upload',
        chatId: chatA.id,
        chatName: chatA.name,
        text: 'Existing scheduled post',
        when: '2035-01-15T18:30:00.000Z',
        createdAt: '2035-01-15T17:00:00.000Z',
        status: 'scheduled',
        attachments: ['C:\\scheduled\\brief.pdf'],
      };
      const { unmount } = await renderWorkspacePage({ onRegisterHistoryRescheduleHandler: registerRescheduler });
      const fileInput = document.querySelector('.workspace-page-hidden-file-input') as HTMLInputElement;
  
      await act(async () => {
        Object.defineProperty(fileInput, 'files', { value: staleFiles, configurable: true });
        fileInput.dispatchEvent(new Event('change', { bubbles: true }));
        await Promise.resolve();
      });
      expect(window.draftStorage.copyAttachment).toHaveBeenCalledTimes(4);
  
      await act(async () => {
        registerRescheduler.mock.calls[0][0](scheduledPost);
      });
      await act(async () => {
        Object.defineProperty(fileInput, 'files', { value: [newFile], configurable: true });
        fileInput.dispatchEvent(new Event('change', { bubbles: true }));
        await Promise.resolve();
      });
      expect(window.draftStorage.copyAttachment).toHaveBeenCalledTimes(5);
  
      await act(async () => {
        pendingCopies[4]({
          success: true,
          attachment: { name: newFile.name, path: `/stored/${newFile.name}`, size: newFile.size },
        });
        pendingCopies.slice(0, 4).forEach((resolve, index) => resolve({
          success: true,
          attachment: { name: staleFiles[index].name, path: `/stored/${staleFiles[index].name}`, size: staleFiles[index].size },
        }));
      });
  
      expect(Array.from(document.querySelectorAll('.workspace-page-attachment-name')).map((node) => node.textContent))
        .toEqual(['brief.pdf', newFile.name]);
      unmount();
    });
  
  it('shows an enlarged preview when hovering or focusing an attached image', async () => {
      expect(workspacePageStyles).toMatch(
        /^\.workspace-page-attachment-preview\s*\{[^}]*position:\s*fixed;[^}]*pointer-events:\s*none;/m,
      );
      localStorage.setItem('awaitmsg-workspace-draft', JSON.stringify({
        body: 'Photo caption',
        entities: [],
        attachments: [{ name: 'photo.png', path: '/managed/photo.png', size: 5 }],
        savedAt: '12:00',
        date: '2026-01-10',
        time: '09:00',
        repeatMode: 'none',
        repeatDays: [],
        repeatOccurrences: 1,
      }));
      const { unmount } = await renderWorkspacePage();
      const thumbnail = document.querySelector('.workspace-page-attachment-thumbnail') as HTMLImageElement;
  
      expect(thumbnail).toBeTruthy();
      expect(thumbnail.closest('.workspace-page-attachment-card')).not.toHaveAttribute('title');
      expect(thumbnail.closest('.workspace-page-attachment-card')?.querySelector('.workspace-page-attachment-name')).toHaveTextContent('photo.png');
      vi.useFakeTimers();
      await act(async () => {
        thumbnail.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
      });
      expect(document.querySelector('.workspace-page-attachment-preview')).toBeNull();
      await act(async () => {
        await vi.advanceTimersByTimeAsync(999);
      });
      expect(document.querySelector('.workspace-page-attachment-preview')).toBeNull();
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1);
      });
      expect(document.querySelector('.workspace-page-attachment-preview img')?.getAttribute('alt')).toBe('photo.png');
  
      await act(async () => {
        thumbnail.dispatchEvent(new MouseEvent('mouseout', { bubbles: true }));
      });
      expect(document.querySelector('.workspace-page-attachment-preview')).toBeNull();
  
      await act(async () => {
        thumbnail.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
        await vi.advanceTimersByTimeAsync(999);
        thumbnail.dispatchEvent(new MouseEvent('mouseout', { bubbles: true }));
        await vi.advanceTimersByTimeAsync(1);
      });
      expect(document.querySelector('.workspace-page-attachment-preview')).toBeNull();
  
      await act(async () => {
        thumbnail.focus();
      });
      expect(document.querySelector('.workspace-page-attachment-preview')).not.toBeNull();
      await act(async () => {
        thumbnail.blur();
      });
      expect(document.querySelector('.workspace-page-attachment-preview')).toBeNull();
      unmount();
      vi.useRealTimers();
    });
  
  it('does not report a named draft as saved when the file-store write fails', async () => {
      let finishSave: (() => void) | null = null;
      vi.mocked(window.draftStorage.save).mockImplementationOnce(() => new Promise((resolve) => {
        finishSave = () => resolve({ success: false, code: 'WRITE_FAILED', error: 'Disk full' });
      }));
      const { unmount } = await renderWorkspacePage();
      await editComposerText('Failed draft content');
  
      await act(async () => {
        (document.querySelector('.workspace-page-publish-menu-toggle') as HTMLButtonElement).click();
      });
      const saveDraftOption = Array.from(document.querySelectorAll('.workspace-page-publish-option'))
        .find((button) => button.textContent?.trim() === 'Save draft') as HTMLButtonElement;
      await act(async () => {
        saveDraftOption.click();
      });
      await act(async () => {
        (document.querySelector('.workspace-page-publish-main') as HTMLButtonElement).click();
        await Promise.resolve();
      });
  
      expect(document.querySelector('[role="textbox"]')).toHaveTextContent('');
      expect(document.querySelector('.workspace-page-publish-main')).toBeDisabled();
      await act(async () => {
        finishSave?.();
        await Promise.resolve();
        await Promise.resolve();
      });
  
      expect(workspaceTestState.inMemoryDraftStore.savedDrafts).toHaveLength(0);
      expect(document.querySelector('[role="textbox"]')).toHaveTextContent('Failed draft content');
      expect(document.querySelector('[role="alert"]')?.textContent).toContain('Disk full');
      expect(document.querySelector('.workspace-page-publish-transient-feedback.is-error')?.textContent).toContain('Disk full');
      expect(document.querySelector('.workspace-page-publish-transient-feedback.is-success')).toBeNull();
      unmount();
    });
  
  it('shows a warning instead of success when Telegram sent but history persistence failed', async () => {
      const handleSendDraftNow = vi.fn().mockResolvedValue('sent-history-failed');
      const { unmount } = await renderWorkspacePage({ handleSendDraftNow });
      await editComposerText('Confirmed message');
  
      await act(async () => {
        (document.querySelector('.workspace-page-publish-main') as HTMLButtonElement).click();
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
      });
  
      expect(handleSendDraftNow).toHaveBeenCalledOnce();
      expect(document.querySelector('.workspace-page-publish-transient-feedback.is-warning')?.textContent)
        .toContain('Telegram sent the message, but local history could not be saved.');
      expect(document.querySelector('.workspace-page-publish-transient-feedback.is-success')).toBeNull();
      expect(document.querySelector('[aria-label="Post content"]')).toHaveTextContent('Confirmed message');
      unmount();
    });
  
  it('keeps the window open when the final synchronous flush fails', async () => {
      vi.mocked(window.draftStorage.flush).mockReturnValueOnce({
        success: false,
        code: 'WRITE_FAILED',
        error: 'Flush failed',
      });
      const { unmount } = await renderWorkspacePage();
      const closeEvent = new Event('beforeunload', { cancelable: true });
      Object.defineProperty(closeEvent, 'returnValue', { configurable: true, value: '', writable: true });
  
      await act(async () => {
        window.dispatchEvent(closeEvent);
        await Promise.resolve();
      });
  
      expect(closeEvent.defaultPrevented).toBe(true);
      expect(String(closeEvent.returnValue)).toContain('Draft data could not be saved');
      unmount();
    });
  
  it('recovers the complete draft after autosave and reload', async () => {
      vi.useFakeTimers();
  
      try {
        localStorage.setItem('awaitmsg-workspace-draft', JSON.stringify({
          body: 'Initial draft',
          entities: [{ type: 'bold', offset: 0, length: 7 }],
          attachments: [{ name: 'photo.png', path: '/tmp/photo.png', size: 1234 }],
          savedAt: '12:00',
          date: '2026-02-14',
          time: '18:30',
          repeatMode: 'weekly',
          repeatDays: ['Sat'],
          repeatOccurrences: 3,
        }));
  
        const setSelectedChat = vi.fn();
        const { unmount } = await renderWorkspacePage({
          selectedChat: chatA,
          setSelectedChat,
          date: '2026-02-14',
          time: '18:30',
        });
  
        const editor = document.querySelector('[role="textbox"]') as HTMLDivElement;
        await act(async () => {
          editor.innerHTML = '<strong>Recovered rich draft</strong>';
          editor.dispatchEvent(new InputEvent('input', { bubbles: true }));
          await Promise.resolve();
        });
  
        await act(async () => {
          vi.advanceTimersByTime(500);
          await Promise.resolve();
          await Promise.resolve();
        });
  
        const savedDraft = getInMemoryWorkspaceDraft();
        expect(savedDraft.body).toBe('Recovered rich draft');
        expect(savedDraft.entities).toEqual([{ type: 'bold', offset: 0, length: 20 }]);
        expect(savedDraft.selectedChat).toMatchObject({ id: chatA.id, name: chatA.name });
        expect(savedDraft.attachments).toMatchObject([{ name: 'photo.png', path: '/tmp/photo.png', size: 1234 }]);
        expect(savedDraft.date).toBe('2026-02-14');
        expect(savedDraft.time).toBe('18:30');
        expect(savedDraft.repeatMode).toBe('weekly');
        expect(savedDraft.repeatDays).toEqual(['Sat']);
  
        unmount();
  
        const reloaded = await renderWorkspacePage({
          selectedChat: null,
          setSelectedChat,
          date: '',
          time: '',
        });
  
        expect((document.querySelector('[role="textbox"]') as HTMLDivElement).textContent).toContain('Recovered rich draft');
        expect(setSelectedChat).toHaveBeenCalledWith(expect.objectContaining({ id: chatA.id }));
  
        reloaded.unmount();
      } finally {
        vi.useRealTimers();
      }
    });
  
  it('autosaves the latest draft text after debounce and restores it after reload without a manual action', async () => {
      vi.useFakeTimers();
  
      try {
        const { unmount } = await renderWorkspacePage({
          selectedChat: null,
          date: '',
          time: '',
        });
  
        const editor = document.querySelector('[role="textbox"]') as HTMLDivElement;
        await act(async () => {
          editor.textContent = 'Autosave draft 1';
          editor.dispatchEvent(new InputEvent('input', { bubbles: true }));
          await Promise.resolve();
        });
  
        act(() => {
          vi.advanceTimersByTime(200);
        });
  
        let savedDraft = getInMemoryWorkspaceDraft();
        expect(savedDraft.body).toBe('Hello world');
  
        await act(async () => {
          vi.advanceTimersByTime(400);
          await Promise.resolve();
          await Promise.resolve();
        });
  
        savedDraft = getInMemoryWorkspaceDraft();
        expect(savedDraft.body).toBe('Autosave draft 1');
  
        unmount();
  
        const reloaded = await renderWorkspacePage({
          selectedChat: null,
          date: '',
          time: '',
        });
  
        const restoredEditor = document.querySelector('[role="textbox"]') as HTMLDivElement;
        expect(restoredEditor.textContent).toContain('Autosave draft 1');
  
        reloaded.unmount();
      } finally {
        vi.useRealTimers();
      }
    });
  
  it('keeps the save-draft button enabled while typing triggers an autosave', async () => {
      vi.useFakeTimers();
  
      try {
        let resolveSave!: (result: { success: boolean; store?: PersistedDraftStore }) => void;
        vi.mocked(window.draftStorage.save).mockImplementationOnce((store) => new Promise((resolve) => {
          resolveSave = resolve;
          void store;
        }));
        const { unmount } = await renderWorkspacePage();
  
        await act(async () => {
          (document.querySelector('.workspace-page-publish-menu-toggle') as HTMLButtonElement).click();
        });
        const saveDraftOption = Array.from(document.querySelectorAll('.workspace-page-publish-option'))
          .find((button) => button.textContent?.trim() === 'Save draft') as HTMLButtonElement;
        await act(async () => saveDraftOption.click());
  
        const editor = document.querySelector('[role="textbox"]') as HTMLDivElement;
        await act(async () => {
          editor.textContent = 'Text being autosaved';
          editor.dispatchEvent(new InputEvent('input', { bubbles: true }));
          await Promise.resolve();
        });
        await act(async () => {
          vi.advanceTimersByTime(600);
          await Promise.resolve();
          await Promise.resolve();
        });
  
        const primaryButton = document.querySelector('.workspace-page-publish-main') as HTMLButtonElement;
        expect(window.draftStorage.save).toHaveBeenCalled();
        expect(primaryButton).toHaveTextContent(/save draft/i);
        expect(primaryButton).not.toBeDisabled();
  
        const submittedStore = vi.mocked(window.draftStorage.save).mock.calls[0]?.[0];
        await act(async () => {
          resolveSave({ success: true, store: submittedStore });
          await Promise.resolve();
        });
        unmount();
      } finally {
        vi.useRealTimers();
      }
    });
  
  it('resolves the registered Studio leave callback only after flushing the current draft', async () => {
      let flushBeforeLeave: (() => Promise<boolean>) | null = null;
      const registerFlush = vi.fn((flush: (() => Promise<boolean>) | null) => {
        flushBeforeLeave = flush;
      });
      let resolveSave!: (result: { success: boolean; store?: PersistedDraftStore }) => void;
      vi.mocked(window.draftStorage.save).mockImplementationOnce((store) => new Promise((resolve) => {
        resolveSave = resolve;
        void store;
      }));
      const { unmount } = await renderWorkspacePage({ onRegisterBeforeLeaveStudio: registerFlush });
      const editor = document.querySelector('[role="textbox"]') as HTMLDivElement;
      await act(async () => {
        editor.textContent = 'Persist before leaving Studio';
        editor.dispatchEvent(new InputEvent('input', { bubbles: true }));
        await Promise.resolve();
      });
  
      expect(flushBeforeLeave).toBeTypeOf('function');
      let flushCompleted = false;
      let flushPromise!: Promise<boolean>;
      await act(async () => {
        flushPromise = flushBeforeLeave!().then((result) => {
          flushCompleted = true;
          return result;
        });
        await Promise.resolve();
      });
      await waitFor(() => expect(window.draftStorage.save).toHaveBeenCalled());
      expect(flushCompleted).toBe(false);
      const saveCalls = vi.mocked(window.draftStorage.save).mock.calls;
      const submittedStore = saveCalls[saveCalls.length - 1]?.[0];
      expect(submittedStore?.workspaceDraft).toMatchObject({ body: 'Persist before leaving Studio' });
      workspaceTestState.inMemoryDraftStore = submittedStore!;
  
      await act(async () => {
        resolveSave({ success: true, store: submittedStore });
        await expect(flushPromise).resolves.toBe(true);
      });
  
      expect(getInMemoryWorkspaceDraft().body).toBe('Persist before leaving Studio');
      unmount();
    });
  
  it('flushes the latest draft on unexpected close before debounce completes', async () => {
      vi.useFakeTimers();
  
      try {
        const { unmount } = await renderWorkspacePage({
          selectedChat: null,
          date: '',
          time: '',
        });
  
        const editor = document.querySelector('[role="textbox"]') as HTMLDivElement;
        await act(async () => {
          editor.textContent = 'Draft before close';
          editor.dispatchEvent(new InputEvent('input', { bubbles: true }));
          await Promise.resolve();
        });
  
        window.dispatchEvent(new Event('beforeunload'));
  
        const savedDraft = getInMemoryWorkspaceDraft();
        expect(savedDraft.body).toBe('Draft before close');
  
        unmount();
      } finally {
        vi.useRealTimers();
      }
    });
});
