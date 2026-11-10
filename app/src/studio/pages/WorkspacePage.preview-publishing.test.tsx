import { act } from 'react';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Chat } from '@studio/types';
import { readInitialWorkspaceDraft, type WorkspaceDraft } from '../lib/draftStore';
import { WorkspacePage } from './WorkspacePage';
import { normalizeAttachments, readWorkspaceDraftStoreFallback, writeWorkspaceDraftStoreFallback } from './WorkspacePageExports';
import { chatA, workspacePageStyles, workspaceTestState, renderWorkspacePage, resetWorkspacePageTestEnvironment } from './WorkspacePage.testUtils';

describe('WorkspacePage preview and publishing', () => {
  beforeEach(resetWorkspacePageTestEnvironment);

  it('updates the live preview device clock at the start of each minute', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(2026, 9, 3, 10, 30, 59));
      const { unmount } = await renderWorkspacePage();
      const previewClock = document.querySelector('.chat-preview-mobile-system-bar > span:first-child');
      const formatPreviewTime = (date: Date) => date.toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      });
  
      try {
        expect(previewClock).toHaveTextContent(formatPreviewTime(new Date(2026, 9, 3, 10, 30, 59)));
        await act(async () => {
          await vi.advanceTimersByTimeAsync(1_100);
        });
        expect(previewClock).toHaveTextContent(formatPreviewTime(new Date(2026, 9, 3, 10, 31, 0)));
      } finally {
        unmount();
        vi.useRealTimers();
      }
    });
  
  it('does not hydrate the Studio editor from the shared Planner active draft', () => {
      localStorage.setItem('xmsgi:active-draft:v1', JSON.stringify({
        id: 'quick-planner:active',
        message: 'Planner message',
        entities: [],
        attachments: [{ name: 'removed.png', path: 'C:/photos/removed.png' }],
        selectedChatId: null,
        updatedAt: '2026-10-21T00:00:00.000Z',
      }));
  
      expect(readInitialWorkspaceDraft()).toEqual({});
    });
  
  it('loads stored image attachments through the draft preview bridge', async () => {
      workspaceTestState.inMemoryDraftStore.migrationVersion = 1;
      workspaceTestState.inMemoryDraftStore.workspaceDraft = {
        documentId: 'image-preview-test',
        body: 'Draft with an image',
        entities: [],
        attachments: [{
          id: 'stored-photo',
          name: 'OIP.webp',
          type: 'image',
          mimeType: 'image/webp',
          path: '/stored/OIP.webp',
          size: 1024,
          position: 0,
        }],
        savedAt: '12:00',
      };
      vi.mocked(window.draftStorage.readImageDataUrl!).mockResolvedValue({
        success: true,
        dataUrl: 'data:image/webp;base64,dGVzdA==',
      });
  
      const { unmount } = await renderWorkspacePage();
  
      try {
        await waitFor(() => {
          expect(window.draftStorage.readImageDataUrl).toHaveBeenCalledWith('/stored/OIP.webp');
          expect(document.querySelector('.workspace-page-attachment-thumbnail')).toHaveAttribute(
            'src',
            'data:image/webp;base64,dGVzdA==',
          );
        });
      } finally {
        unmount();
      }
    });
  
  it('restores legacy JFIF files as JPEG images in the attachment chips', async () => {
      workspaceTestState.inMemoryDraftStore.migrationVersion = 1;
      workspaceTestState.inMemoryDraftStore.workspaceDraft = {
        documentId: 'legacy-jfif-preview-test',
        body: 'Draft with a JFIF image',
        entities: [],
        attachments: [{
          id: 'legacy-jfif',
          name: 'OIP (1).jfif',
          type: 'file',
          mimeType: 'application/octet-stream',
          path: '/stored/OIP (1).jfif',
          size: 1024,
          position: 0,
        }],
        savedAt: '12:00',
      };
      vi.mocked(window.draftStorage.readImageDataUrl!).mockResolvedValue({
        success: true,
        dataUrl: 'data:image/jpeg;base64,dGVzdA==',
      });
  
      const { unmount } = await renderWorkspacePage();
  
      try {
        await waitFor(() => {
          expect(window.draftStorage.readImageDataUrl).toHaveBeenCalledWith('/stored/OIP (1).jfif');
          expect(document.querySelector('.workspace-page-attachment-thumbnail')).toHaveAttribute(
            'src',
            'data:image/jpeg;base64,dGVzdA==',
          );
        });
      } finally {
        unmount();
      }
    });
  
  it('loads file URL image attachments through the draft preview bridge', async () => {
      workspaceTestState.inMemoryDraftStore.migrationVersion = 1;
      workspaceTestState.inMemoryDraftStore.workspaceDraft = {
        documentId: 'file-url-image-preview-test',
        body: 'Draft with a file URL image',
        entities: [],
        attachments: [{
          id: 'stored-file-url-photo',
          name: '01 (16).png',
          type: 'image',
          mimeType: 'image/png',
          path: 'file:///C:/Users/malod/AppData/Local/XMSGi-Workspace-Agent/drafts/01%20(16).png',
          size: 1024,
          position: 0,
        }],
        savedAt: '12:00',
      };
      vi.mocked(window.draftStorage.readImageDataUrl!).mockResolvedValue({
        success: true,
        dataUrl: 'data:image/png;base64,dGVzdA==',
      });
  
      const { unmount } = await renderWorkspacePage();
  
      try {
        await waitFor(() => {
          expect(window.draftStorage.readImageDataUrl).toHaveBeenCalledWith(
            'C:/Users/malod/AppData/Local/XMSGi-Workspace-Agent/drafts/01 (16).png',
          );
          expect(document.querySelector('.workspace-page-attachment-thumbnail')).toHaveAttribute(
            'src',
            'data:image/png;base64,dGVzdA==',
          );
          expect(document.querySelector('img[src^="file:"]')).toBeNull();
        });
      } finally {
        unmount();
      }
    });
  
  it('preserves photo album identity when normalizing draft attachments', () => {
      const attachments = normalizeAttachments([{
        id: 'album-photo-1',
        name: 'photo.png',
        type: 'image',
        mimeType: 'image/png',
        path: '/stored/photo.png',
        size: 100,
        position: 0,
        albumId: 'album-1',
      }]);
  
      expect(attachments[0].albumId).toBe('album-1');
      expect(normalizeAttachments([{ name: 'legacy.png', path: '/stored/legacy.png' }])[0].albumId).toBeUndefined();
    });
  
  it('does not mount inactive stage panels while editing the main message', async () => {
      const { unmount } = await renderWorkspacePage();
  
      try {
        const stageContent = document.querySelector('.workspace-page-rich-text-stage-content');
        expect(stageContent?.childElementCount).toBe(0);
      } finally {
        unmount();
      }
    });
  
  it('does not show the local clock in Studio', async () => {
      const { unmount } = await renderWorkspacePage();
  
      try {
        expect(document.querySelector('.local-date-time-clock')).toBeNull();
      } finally {
        unmount();
      }
    });
  
  it('renders the main composer labels in the selected Russian locale', async () => {
      localStorage.setItem('awaitmsg_locale', 'ru');
      const { unmount } = await renderWorkspacePage();
  
      expect(document.querySelector('.workspace-page-editor-title-text')?.textContent).toBe('Создать публикацию');
      expect(document.querySelector('.workspace-page-publish-menu-toggle')?.getAttribute('aria-label'))
        .toBe('Другие действия с публикацией');
      expect(document.querySelector('.workspace-page-publish-main .workspace-page-publish-trigger-main'))
        .toHaveTextContent('Отправить');
      expect(document.querySelector('.workspace-page-attachment-toggle')?.getAttribute('aria-label')).toBe('Добавить файл');
      expect(document.querySelector('.workspace-page-preview-toggle:not(.workspace-page-attachment-toggle)')?.getAttribute('aria-label'))
        .toBe('Скрыть предпросмотр');
      expect(document.querySelector('.workspace-page-mode-button-template')?.textContent).toBe('Шаблоны');
      expect(document.querySelector('.workspace-page-mode-button-draft')?.textContent).toBe('Черновики');
      unmount();
    });

  it('uses concise Russian labels for every publish-menu action', async () => {
      localStorage.setItem('awaitmsg_locale', 'ru');
      const { unmount } = await renderWorkspacePage();

      await act(async () => fireEvent.click(document.querySelector('.workspace-page-publish-menu-toggle')!));
      expect(document.querySelector('.workspace-page-publish-option.is-draft')).toHaveTextContent('Черновики');
      await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Планировать' })));
      expect(document.querySelector('.workspace-page-publish-main .workspace-page-publish-trigger-main'))
        .toHaveTextContent('Планировать');
      expect(document.querySelectorAll('.workspace-page-schedule-compact-button')[0]).toHaveTextContent('Время');
      expect(document.querySelectorAll('.workspace-page-schedule-compact-button')[1]).toHaveTextContent('Повтор');
      await act(async () => fireEvent.click(document.querySelector('.workspace-page-publish-menu-toggle')!));
      expect(document.querySelector('.workspace-page-publish-option.is-send')).toHaveTextContent('Сейчас');
      await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Сейчас' })));
      await act(async () => fireEvent.click(document.querySelector('.workspace-page-publish-menu-toggle')!));
      await act(async () => fireEvent.click(document.querySelector('.workspace-page-publish-option.is-draft')!));
      expect(document.querySelector('.workspace-page-publish-main .workspace-page-publish-trigger-main'))
        .toHaveTextContent('Сохранить');

      unmount();
    });
  
  it('uses the larger scheduled action label only in English', async () => {
      localStorage.setItem('awaitmsg_locale', 'en');
      const english = await renderWorkspacePage();
      await act(async () => fireEvent.click(document.querySelector('.workspace-page-publish-menu-toggle')!));
      await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Schedule' })));
      expect(document.querySelector('.workspace-page-publish-main.is-scheduled .workspace-page-publish-trigger-main')?.classList.contains('is-english')).toBe(true);
      english.unmount();
  
      localStorage.setItem('awaitmsg_locale', 'ru');
      const russian = await renderWorkspacePage();
      await act(async () => fireEvent.click(document.querySelector('.workspace-page-publish-menu-toggle')!));
      expect(document.querySelector('.workspace-page-publish-menu-compact')).not.toHaveClass('is-russian');
      await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Сейчас' })));
      await act(async () => fireEvent.click(document.querySelector('.workspace-page-publish-menu-toggle')!));
      expect(document.querySelector('.workspace-page-publish-option.is-scheduled')).toHaveTextContent('Планировать');
      await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Планировать' })));
      expect(document.querySelector('.workspace-page-publish-main.is-scheduled .workspace-page-publish-trigger-main')?.classList.contains('is-english')).toBe(false);
      russian.unmount();
    });
  
  it('raises the two publish choices over the editor without adding a panel', async () => {
      const { unmount } = await renderWorkspacePage();
      const actionRow = document.querySelector('.workspace-page-action-row.workspace-page-schedule-row')!;
      const toggle = document.querySelector<HTMLButtonElement>('.workspace-page-publish-menu-toggle')!;
      const raisedLayerRuleStart = workspacePageStyles.lastIndexOf('.workspace-page-action-row.workspace-page-schedule-row.is-publish-menu-open {');
      const floatingChoicesRuleStart = workspacePageStyles.lastIndexOf('.workspace-page .workspace-page-submit-actions .workspace-page-publish-menu-compact {');
      const raisedLayerRule = workspacePageStyles.slice(raisedLayerRuleStart).match(/\{([^}]*)\}/)?.[1] ?? '';
      const floatingChoicesRule = workspacePageStyles.slice(floatingChoicesRuleStart).match(/\{([^}]*)\}/)?.[1] ?? '';
  
      expect(raisedLayerRule).toMatch(/z-index:\s*1201/);
      expect(floatingChoicesRule).toMatch(/position:\s*absolute/);
      expect(floatingChoicesRule).toMatch(/pointer-events:\s*none/);
  
      await act(async () => toggle.click());
      expect(actionRow.classList.contains('is-publish-menu-open')).toBe(true);
      expect(document.querySelector('.workspace-page-publish-menu')).not.toBeNull();
      expect(document.querySelectorAll('.workspace-page-publish-option')).toHaveLength(2);
  
      await act(async () => toggle.click());
      expect(actionRow.classList.contains('is-publish-menu-open')).toBe(false);
      unmount();
    });
  
  it('keeps floating publish choices aligned with the primary button in the dark theme', () => {
      expect(workspacePageStyles).toMatch(/\.workspace-page-submit-actions \.workspace-page-publish-menu-compact\s*\{[^}]*top:\s*50%;[^}]*left:\s*0;[^}]*width:\s*100%;/);
      expect(workspacePageStyles).toMatch(/html\[data-theme='dark'\] \.workspace-page \.workspace-page-submit-actions \.workspace-page-publish-menu-compact \.workspace-page-publish-option:not\(\.is-selected\),\s*html\[data-theme='dark'\] \.workspace-page \.workspace-page-submit-actions \.workspace-page-publish-menu-compact \.workspace-page-publish-option:not\(\.is-selected\) > span\s*\{\s*color:\s*#d4dde3 !important;/);
      expect(workspacePageStyles).toMatch(/html\[data-theme='dark'\] \.workspace-page \.workspace-page-submit-actions \.workspace-page-publish-menu-compact \.workspace-page-publish-option:not\(\.is-selected\):is\(:hover, :focus-visible\),\s*html\[data-theme='dark'\] \.workspace-page \.workspace-page-submit-actions \.workspace-page-publish-menu-compact \.workspace-page-publish-option:not\(\.is-selected\):is\(:hover, :focus-visible\) > span\s*\{\s*color:\s*#f2f7fa !important;/);
      expect(workspacePageStyles).toMatch(/\.workspace-page-submit-actions \.workspace-page-publish-choice-slot\.is-above\s*\{[^}]*translateY\(calc\(-100% - 6px\)\)/);
      expect(workspacePageStyles).toMatch(/\.workspace-page-submit-actions \.workspace-page-publish-choice-slot\.is-below\s*\{[^}]*translateY\(6px\)/);
    });
  
  it('keeps the live current action inside the editor and updates it with the selected chat', async () => {
      localStorage.setItem('awaitmsg_locale', 'en');
      const { rerender, unmount } = await renderWorkspacePage();
  
      try {
        const editorShell = document.querySelector('.workspace-page-editor-shell') as HTMLElement;
        const summary = editorShell.querySelector('.workspace-page-mode-summary') as HTMLElement;
  
        expect(summary).not.toBeNull();
        expect(document.querySelector('.workspace-page-editor-heading .workspace-page-mode-summary')).toBeNull();
        expect(summary.querySelector('strong')?.textContent).toContain('Alpha Team');
  
        const nextChat = { ...chatA, id: 'chat-2', name: 'Beta Team' };
        rerender({ selectedChat: nextChat, chats: [nextChat] });
  
        expect(editorShell.querySelector('.workspace-page-mode-summary strong')?.textContent).toContain('Beta Team');
      } finally {
        unmount();
      }
    });
  
  it.each([
      [{ ...chatA, name: 'Alex Example', type: 'private' as const, username: 'alex_example' }, '@alex_example'],
      [{ ...chatA, name: 'Alex Example', type: 'private' as const, username: undefined }, 'Private chat'],
      [{ ...chatA, name: 'Design group', type: 'group' as const, username: 'design' }, 'Group chat'],
    ])('shows chat details instead of repeating the selected chat name', async (selectedChat, expectedSubtitle) => {
      localStorage.setItem('awaitmsg_locale', 'en');
      const { rerender, unmount } = await renderWorkspacePage({
        selectedChat,
        chats: [selectedChat],
      });
  
      try {
        const trigger = document.querySelector('.workspace-page-chat-trigger')!;
        expect(trigger.querySelector('strong')).toHaveTextContent(selectedChat.name);
        expect(trigger.querySelector('.workspace-page-chat-trigger-copy span')).toHaveTextContent(expectedSubtitle);
        expect(trigger.querySelector('.workspace-page-chat-trigger-copy span')).not.toHaveTextContent(selectedChat.name);
  
        rerender({ selectedChat: { ...selectedChat, username: '@alex_example' }, chats: [{ ...selectedChat, username: '@alex_example' }] });
        if (selectedChat.type === 'private') {
          expect(trigger.querySelector('.workspace-page-chat-trigger-copy span')).toHaveTextContent('@alex_example');
        }
      } finally {
        unmount();
      }
    });
  
  it.each([
      ['en', 'Saved Messages', 'Private chat'],
      ['ru', 'Сохранённые сообщения', 'Личный чат'],
    ])('shows the private chat type under Saved Messages in %s', async (locale, expectedName, expectedSubtitle) => {
      localStorage.setItem('awaitmsg_locale', locale);
      const savedMessagesChat: Chat = { ...chatA, id: 'chat-saved', name: 'Saved Messages', type: 'private' };
      const { unmount } = await renderWorkspacePage({
        selectedChat: savedMessagesChat,
        chats: [savedMessagesChat],
      });
  
      try {
        const trigger = document.querySelector('.workspace-page-chat-trigger')!;
        expect(trigger.querySelector('strong')).toHaveTextContent(expectedName);
        expect(trigger.querySelector('.workspace-page-chat-trigger-copy span')).toHaveTextContent(expectedSubtitle);
        expect(trigger.querySelector('.workspace-page-chat-trigger-copy span')).not.toHaveTextContent(expectedName);
      } finally {
        unmount();
        localStorage.removeItem('awaitmsg_locale');
      }
    });
  
  it('hides the chat name in the current action for Saved Messages', async () => {
      localStorage.setItem('awaitmsg_locale', 'en');
      const savedMessagesChat: Chat = { ...chatA, id: 'chat-saved', name: 'Saved Messages', type: 'private' };
      const { rerender, unmount } = await renderWorkspacePage();
  
      try {
        const editorShell = document.querySelector('.workspace-page-editor-shell') as HTMLElement;
        expect(editorShell.querySelector('.workspace-page-mode-summary strong')?.textContent).toContain('Alpha Team');
  
        rerender({ selectedChat: savedMessagesChat, chats: [savedMessagesChat] });
  
        const summary = editorShell.querySelector('.workspace-page-mode-summary strong')?.textContent ?? '';
        expect(summary).toBe('Send now');
        expect(summary).not.toContain('Saved Messages');
        expect(summary).not.toContain('·');
      } finally {
        unmount();
      }
    });
  
  it('keeps time and repeat stages at the workspace top after scrolling', async () => {
      localStorage.setItem('awaitmsg_locale', 'en');
      const { unmount } = await renderWorkspacePage();
  
      try {
        const workspaceMain = document.querySelector('.workspace-page-main') as HTMLElement;
        workspaceMain.scrollTop = 431;
  
        await act(async () => {
          (document.querySelector('.workspace-page-publish-menu-toggle') as HTMLButtonElement).click();
        });
        const scheduleOption = document.querySelector('.workspace-page-publish-option.is-scheduled') as HTMLButtonElement;
        await act(async () => scheduleOption.click());
  
        const scheduleControls = document.querySelectorAll('.workspace-page-schedule-compact-button');
        await act(async () => (scheduleControls[0] as HTMLButtonElement).click());
        expect(workspaceMain.scrollTop).toBe(0);
  
        workspaceMain.scrollTop = 431;
        await act(async () => (scheduleControls[1] as HTMLButtonElement).click());
        expect(workspaceMain.scrollTop).toBe(0);
      } finally {
        unmount();
      }
    });
  
  it('falls back to localStorage when the Electron bridge is unavailable', async () => {
      const store = {
        schemaVersion: 3,
        migrationVersion: 1,
        savedDrafts: [],
        workspaceDraft: { body: 'fallback content', savedAt: '12:00' },
        documentHistories: {},
      };
  
      writeWorkspaceDraftStoreFallback(store);
  
      expect(readWorkspaceDraftStoreFallback()).toEqual(store);
  
      const { unmount } = await renderWorkspacePage();
  
      expect(document.querySelector('.workspace-page-publish-menu-toggle')).not.toBeNull();
      unmount();
    });
  
  it('does not seed over an unreadable browser fallback store', async () => {
      const originalDraftStorage = Object.getOwnPropertyDescriptor(window, 'draftStorage');
      Reflect.deleteProperty(window, 'draftStorage');
      localStorage.removeItem('xmsgi-default-draft-seeded-v1');
      const original = '{damaged draft store';
      localStorage.setItem('xmsgi-draft-store-fallback', original);
      localStorage.setItem('awaitmsg-draft-store-fallback', 'legacy data');
  
      try {
        const { unmount } = await renderWorkspacePage();
        await waitFor(() => expect(document.body.textContent).toContain('invalid JSON'));
        expect(localStorage.getItem('xmsgi-draft-store-fallback')).toBe(original);
        expect(localStorage.getItem('awaitmsg-draft-store-fallback')).toBe('legacy data');
        expect(localStorage.getItem('xmsgi-default-draft-seeded-v1')).toBeNull();
        unmount();
      } finally {
        if (originalDraftStorage) Object.defineProperty(window, 'draftStorage', originalDraftStorage);
      }
    });
  
  it('clears saved drafts through the history handler and preserves the workspace draft', async () => {
      const savedDraft = {
        id: 'history-clear-draft',
        documentId: 'history-clear-document',
        name: 'Saved draft',
        body: 'Saved content',
        createdAt: '2026-09-28T10:00:00.000Z',
        updatedAt: '2026-09-29T18:35:00.000Z',
      };
      const workspaceDraft = {
        body: 'Unsaved editor content',
        savedAt: '12:00',
        attachments: [],
      };
      workspaceTestState.inMemoryDraftStore = {
        schemaVersion: 2,
        migrationVersion: 1,
        savedDrafts: [savedDraft],
        workspaceDraft,
        documentHistories: {},
      };
      let clearHistoryDrafts: (() => Promise<boolean>) | null = null;
      const { unmount } = await renderWorkspacePage({
        onRegisterHistoryDraftClearHandler: (handler) => { clearHistoryDrafts = handler; },
      });
  
      let cleared = false;
      await act(async () => {
        cleared = await clearHistoryDrafts?.() ?? false;
      });
  
      expect(cleared).toBe(true);
      expect(workspaceTestState.inMemoryDraftStore.savedDrafts).toEqual([]);
      expect(workspaceTestState.inMemoryDraftStore.workspaceDraft).toMatchObject({ body: 'Unsaved editor content' });
      expect(workspaceTestState.inMemoryDraftStore.documentHistories?.['history-clear-document']?.[0].snapshot).toMatchObject({ body: 'Saved content' });
      unmount();
    });
  
  it('deletes one saved draft through the history handler and keeps the others', async () => {
      const drafts = [
        { id: 'delete-one', documentId: 'delete-document', name: 'Delete one', body: 'Selected draft', createdAt: '2026-09-28T10:00:00.000Z', updatedAt: '2026-09-29T18:35:00.000Z' },
        { id: 'keep-one', name: 'Keep one', body: 'Other draft', createdAt: '2026-09-28T10:00:00.000Z', updatedAt: '2026-09-29T18:36:00.000Z' },
      ];
      workspaceTestState.inMemoryDraftStore = {
        schemaVersion: 2,
        migrationVersion: 1,
        savedDrafts: drafts,
        workspaceDraft: { body: 'Unsaved editor content', savedAt: '12:00', attachments: [] },
        documentHistories: {},
      };
      let deleteHistoryDraft: ((draftId: string) => Promise<boolean>) | null = null;
      const { unmount } = await renderWorkspacePage({
        onRegisterHistoryDraftDeleteHandler: (handler) => { deleteHistoryDraft = handler; },
      });
      const saveCountBeforeDelete = vi.mocked(window.draftStorage.save).mock.calls.length;
  
      let deleted = false;
      await act(async () => {
        deleted = await deleteHistoryDraft?.('delete-one') ?? false;
      });
  
      expect(deleted).toBe(true);
      expect(workspaceTestState.inMemoryDraftStore.savedDrafts.map((draft: { id: string }) => draft.id)).toEqual(['keep-one']);
      expect(workspaceTestState.inMemoryDraftStore.workspaceDraft).toMatchObject({ body: 'Unsaved editor content' });
      expect(workspaceTestState.inMemoryDraftStore.documentHistories?.['delete-document']?.[0].snapshot).toMatchObject({ body: 'Selected draft' });
      expect(vi.mocked(window.draftStorage.save).mock.calls.length - saveCountBeforeDelete).toBe(1);
      unmount();
    });
  
  it('adds a history draft and restores replaced text when the added draft is cleared', async () => {
      const savedDraft = {
        id: 'use-in-composer',
        name: 'Composer draft',
        body: 'Text copied into the composer',
        entities: [],
        attachments: [],
        selectedChat: chatA,
        createdAt: '2026-09-28T10:00:00.000Z',
        updatedAt: '2026-09-29T18:35:00.000Z',
      };
      workspaceTestState.inMemoryDraftStore = {
        schemaVersion: 2,
        migrationVersion: 1,
        savedDrafts: [savedDraft],
        workspaceDraft: {
          documentId: 'history-use-existing-document',
          body: 'Existing Studio document',
          entities: [],
          attachments: [],
          savedAt: '12:00',
        },
      };
      let useHistoryDraft: ((draft: typeof savedDraft) => Promise<boolean>) | null = null;
      const notify = vi.fn();
      const { unmount } = await renderWorkspacePage({
        showNotification: notify,
        onRegisterHistoryDraftUseHandler: (handler) => { useHistoryDraft = handler; },
      });
      const editor = document.querySelector<HTMLElement>('[aria-label="Post content"]')!;
      act(() => editor.focus());
  
      let applied = false;
      await act(async () => {
        applied = await useHistoryDraft?.(savedDraft) ?? false;
      });
  
      expect(applied).toBe(true);
      expect(editor?.getAttribute('aria-hidden')).toBe('false');
      expect(editor?.textContent).toBe(savedDraft.body);
      expect(workspaceTestState.inMemoryDraftStore.savedDrafts).toEqual([]);
      expect(workspaceTestState.inMemoryDraftStore.workspaceDraft).toMatchObject({ body: savedDraft.body });
      expect(document.querySelector('.workspace-page-publish-transient-feedback.is-success')?.textContent)
        .toContain('Draft added successfully.');
      expect(notify).not.toHaveBeenCalledWith('Draft added successfully.', 'success', 'Studio');
      expect(screen.queryByRole('button', { name: 'Restore previous text' })).not.toBeInTheDocument();
      expect(workspaceTestState.inMemoryDraftStore.documentHistories?.['history-use-existing-document']?.some((version) => (
        (version.snapshot as WorkspaceDraft).body === 'Existing Studio document'
        && version.reason === 'before-replacement'
      ))).toBe(true);
  
      await act(async () => {
        screen.getByRole('button', { name: 'Clear editor text' }).click();
      });
  
      expect(editor.textContent).toBe('Existing Studio document');
      expect(workspaceTestState.inMemoryDraftStore.workspaceDraft).toMatchObject({
        documentId: 'history-use-existing-document',
        body: 'Existing Studio document',
      });
      expect(workspaceTestState.inMemoryDraftStore.savedDrafts).toEqual([]);
      expect(document.querySelector('.workspace-page-publish-transient-feedback.is-success')?.textContent)
        .toContain('Your previous text has been restored in the editor.');
      expect(notify).not.toHaveBeenCalledWith(
        'Your previous text has been restored in the editor.',
        'success',
        'Studio',
      );
      unmount();
    });
  
  it('restores replaced Studio text only after a successful send', async () => {
      const savedDraft = {
        id: 'send-restores-previous',
        name: 'Send this draft',
        body: 'Selected draft content',
        entities: [],
        attachments: [],
        selectedChat: chatA,
        createdAt: '2026-09-28T10:00:00.000Z',
        updatedAt: '2026-09-29T18:35:00.000Z',
      };
      workspaceTestState.inMemoryDraftStore = {
        schemaVersion: 2,
        migrationVersion: 1,
        savedDrafts: [savedDraft],
        workspaceDraft: {
          documentId: 'previous-document',
          body: 'Previous Studio content',
          entities: [],
          attachments: [],
          savedAt: '12:00',
        },
      };
      let rerenderWithSuccess: ((nextOverrides?: Partial<React.ComponentProps<typeof WorkspacePage>>) => void) | null = null;
      const notify = vi.fn();
      const handleSendDraftNow = vi.fn()
        .mockResolvedValueOnce(false)
        .mockImplementationOnce(async () => {
          rerenderWithSuccess?.({
            successPulse: false,
          });
          await Promise.resolve();
          rerenderWithSuccess?.({
            successPulse: true,
            lastAction: 'sent',
          });
          await Promise.resolve();
          return true;
        });
      let useHistoryDraft: ((draft: typeof savedDraft) => Promise<boolean>) | null = null;
      const { unmount, rerender } = await renderWorkspacePage({
        showNotification: notify,
        handleSendDraftNow,
        onRegisterHistoryDraftUseHandler: (handler) => { useHistoryDraft = handler; },
      });
      rerenderWithSuccess = rerender;
      const editor = document.querySelector<HTMLElement>('[aria-label="Post content"]')!;
  
      await act(async () => {
        expect(await useHistoryDraft?.(savedDraft)).toBe(true);
      });
      expect(editor.textContent).toBe(savedDraft.body);
      await act(async () => {
        (document.querySelector('.workspace-page-publish-menu-toggle') as HTMLButtonElement).click();
      });
      await act(async () => {
        (document.querySelector('.workspace-page-publish-option.is-send') as HTMLButtonElement).click();
      });
  
      await act(async () => {
        (document.querySelector('.workspace-page-publish-main') as HTMLButtonElement).click();
        await Promise.resolve();
      });
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
      expect(handleSendDraftNow).toHaveBeenCalledOnce();
      expect(editor.textContent).toBe(savedDraft.body);
      expect(document.querySelector('.workspace-page-publish-transient-feedback')?.textContent)
        .toContain('Message not sent.');
  
      vi.useFakeTimers();
      await act(async () => {
        (document.querySelector('.workspace-page-send-retry') as HTMLButtonElement).click();
        await Promise.resolve();
      });
      expect(handleSendDraftNow).toHaveBeenCalledTimes(2);
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
      await act(async () => Promise.resolve());
      expect(handleSendDraftNow).toHaveBeenCalledTimes(2);
      expect(handleSendDraftNow.mock.calls[1][7]).toBe(true);
      expect(notify).not.toHaveBeenCalledWith('Message sent.', 'success', 'Studio', undefined, 3360);
      expect(document.querySelector('.workspace-page-publish-transient-feedback.is-success')?.textContent)
        .toContain('Message sent.');
      expect(editor.textContent).toBe('Previous Studio content');
      expect(workspaceTestState.inMemoryDraftStore.workspaceDraft).toMatchObject({ body: 'Previous Studio content' });
      expect(workspaceTestState.inMemoryDraftStore.savedDrafts).toEqual([]);
      expect(document.querySelector('.workspace-page-publish-main')).not.toBeDisabled();
      await act(async () => vi.advanceTimersByTimeAsync(3360));
      expect(handleSendDraftNow).toHaveBeenCalledTimes(2);
      expect(document.querySelector('.workspace-page-publish-transient-feedback')).toBeNull();
      expect(notify).not.toHaveBeenCalledWith(
        'Your previous text has been restored in the editor.',
        'success',
        'Studio',
      );
      unmount();
      vi.useRealTimers();
    });
  
  it('keeps replaced Studio text until a sent-but-unrecorded result is acknowledged', async () => {
      const savedDraft = {
        id: 'send-history-warning',
        name: 'Send this draft',
        body: 'Selected draft content',
        entities: [],
        attachments: [],
        selectedChat: chatA,
        createdAt: '2026-09-28T10:00:00.000Z',
        updatedAt: '2026-09-29T18:35:00.000Z',
      };
      workspaceTestState.inMemoryDraftStore = {
        schemaVersion: 2,
        migrationVersion: 1,
        savedDrafts: [savedDraft],
        workspaceDraft: {
          documentId: 'previous-document',
          body: 'Previous Studio content',
          entities: [],
          attachments: [],
          savedAt: '12:00',
        },
      };
      let rerenderWithSuccess: ((nextOverrides?: Partial<React.ComponentProps<typeof WorkspacePage>>) => void) | null = null;
      const notify = vi.fn();
      const handleSendDraftNow = vi.fn().mockImplementation(async () => {
        rerenderWithSuccess?.({ successPulse: true, lastAction: 'sent' });
        await Promise.resolve();
        return 'sent-history-failed' as const;
      });
      let useHistoryDraft: ((draft: typeof savedDraft) => Promise<boolean>) | null = null;
      const { unmount, rerender } = await renderWorkspacePage({
        showNotification: notify,
        handleSendDraftNow,
        onRegisterHistoryDraftUseHandler: (handler) => { useHistoryDraft = handler; },
      });
      rerenderWithSuccess = rerender;
      const editor = document.querySelector<HTMLElement>('[aria-label="Post content"]')!;
  
      await act(async () => {
        expect(await useHistoryDraft?.(savedDraft)).toBe(true);
      });
      await act(async () => {
        (document.querySelector('.workspace-page-publish-menu-toggle') as HTMLButtonElement).click();
      });
      await act(async () => {
        (document.querySelector('.workspace-page-publish-option.is-send') as HTMLButtonElement).click();
      });
      vi.useFakeTimers();
      await act(async () => {
        (document.querySelector('.workspace-page-publish-main') as HTMLButtonElement).click();
        await Promise.resolve();
      });
  
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
      expect(handleSendDraftNow).toHaveBeenCalledOnce();
      expect(handleSendDraftNow.mock.calls[0][7]).toBe(true);
      expect(notify).not.toHaveBeenCalledWith(
        'Telegram sent the message, but local history could not be saved. Do not resend this message.',
        'warning',
        'Studio',
        undefined,
        5000,
      );
      expect(document.querySelector('.workspace-page-publish-transient-feedback.is-warning')?.textContent)
        .toContain('Telegram sent the message, but local history could not be saved.');
      expect(editor.textContent).toBe(savedDraft.body);
      await act(async () => vi.advanceTimersByTimeAsync(4999));
      expect(editor.textContent).toBe(savedDraft.body);
      await act(async () => vi.advanceTimersByTimeAsync(1));
      expect(editor.textContent).toBe('Previous Studio content');
      expect(document.querySelector('.workspace-page-publish-transient-feedback.is-success')?.textContent)
        .toContain('Your previous text has been restored in the editor.');
      unmount();
      vi.useRealTimers();
    });
});
