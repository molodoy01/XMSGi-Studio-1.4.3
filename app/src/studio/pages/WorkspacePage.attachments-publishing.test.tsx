import { act } from 'react';
import { waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Chat } from '@studio/types';
import { chatA, workspacePageStyles, workspaceTestState, renderWorkspacePage, resetWorkspacePageTestEnvironment } from './WorkspacePage.testUtils';

describe('WorkspacePage attachments and publishing', () => {
  beforeEach(resetWorkspacePageTestEnvironment);

  async function typeEditorText(value: string) {
      const editor = document.querySelector('[role="textbox"]') as HTMLDivElement;
      await act(async () => {
        editor.textContent = value;
        editor.dispatchEvent(new InputEvent('input', { bubbles: true }));
      });
    }
  
  async function openExportMenu() {
      const exportTrigger = document.querySelector('.workspace-page-editor-export-trigger') as HTMLButtonElement;
      await act(async () => {
        exportTrigger.click();
      });
      return document.querySelector('.workspace-page-editor-export-menu') as HTMLDivElement;
    }
  
  function pickExportFormat(menu: HTMLDivElement, extension: '.txt' | '.json') {
      return Array.from(menu.querySelectorAll('button'))
        .find((button) => button.textContent?.includes(extension)) as HTMLButtonElement;
    }

  it('shows a photo album tooltip after a deliberate hover', async () => {
      const { unmount } = await renderWorkspacePage();
      const albumButton = document.querySelector<HTMLButtonElement>('[aria-label="Add photo album"]')!;
      const albumInfo = document.querySelector<HTMLElement>('#workspace-page-photo-album-limits')!;
      const albumControls = albumButton.parentElement!;
  
      expect(albumButton.getAttribute('aria-describedby')).toBe('workspace-page-photo-album-limits');
      expect(albumInfo.getAttribute('role')).toBe('tooltip');
      expect(albumInfo.querySelector('strong')?.textContent).toBe('Photo album');
      expect(albumInfo.textContent).toContain('Up to 10 individual attachments');
      expect(albumInfo.textContent).toContain('up to 3 albums');
      expect(albumInfo.textContent).toContain('up to 10 photos in each');
      expect(albumInfo.textContent).toContain('30 attachments total');
      expect(workspacePageStyles).toMatch(/\.workspace-page-rich-text-toolbar\s*\{[^}]*z-index:\s*20;[^}]*transform:\s*none;/);
      expect(workspacePageStyles).toMatch(/\.workspace-page-rich-text-toolbar\.is-airy\s*\{[^}]*z-index:\s*30;/);
      expect(workspacePageStyles).toMatch(/\.workspace-page-rich-text-album-controls\.is-info-visible\s+\.workspace-page-rich-text-album-info/);
      expect(workspacePageStyles).toMatch(/html\[data-theme='light'\] \.workspace-page \.workspace-page-rich-text-album-info\s*\{[^}]*background:\s*rgba\(255, 255, 255, 0\.98\);[^}]*color:\s*#52636d;/);
      expect(workspacePageStyles).toMatch(/html\[data-theme='light'\] \.workspace-page \.workspace-page-rich-text-album-info strong\s*\{\s*color:\s*#263944;/);
  
      vi.useFakeTimers();
      try {
        await act(async () => {
          const eraser = document.querySelector<HTMLButtonElement>('.workspace-page-rich-text-clear')!;
          eraser.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
        });
        expect(albumControls).not.toHaveClass('is-info-visible');
        await act(async () => { await vi.advanceTimersByTimeAsync(450); });
        expect(albumControls).not.toHaveClass('is-info-visible');
  
        await act(async () => {
          albumButton.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
        });
        expect(albumControls).not.toHaveClass('is-info-visible');
        await act(async () => { await vi.advanceTimersByTimeAsync(449); });
        expect(albumControls).not.toHaveClass('is-info-visible');
        await act(async () => { await vi.advanceTimersByTimeAsync(1); });
        expect(albumControls).toHaveClass('is-info-visible');
        await act(async () => {
          albumButton.dispatchEvent(new MouseEvent('mouseout', { bubbles: true, relatedTarget: document.body }));
        });
        expect(albumControls).not.toHaveClass('is-info-visible');
      } finally {
        vi.useRealTimers();
        unmount();
      }
    });
  
  it('adds photos to an existing album and opens its thumbnails in the attachment loupe', async () => {
      const { unmount } = await renderWorkspacePage();
      const albumInput = document.querySelector<HTMLInputElement>('input[accept*="image/png"][multiple]')!;
      const selectImages = async (names: string[]) => {
        await act(async () => {
          Object.defineProperty(albumInput, 'files', {
            value: names.map((name) => new File(['image'], name, { type: 'image/png' })),
            configurable: true,
          });
          albumInput.dispatchEvent(new Event('change', { bubbles: true }));
          await new Promise((resolve) => window.setTimeout(resolve, 0));
        });
      };
  
      await selectImages(['album-one-a.png', 'album-one-b.png']);
      const initialCard = document.querySelector('.workspace-page-photo-album-card') as HTMLElement;
      const albumId = initialCard.dataset.albumId;
      expect(initialCard).not.toHaveAttribute('title');
      expect(initialCard).toHaveAttribute('aria-label');
      expect(initialCard.querySelectorAll('.workspace-page-photo-album-preview img')).toHaveLength(2);
  
      await act(async () => {
        (initialCard.querySelector('.workspace-page-photo-album-add') as HTMLButtonElement).click();
      });
      await selectImages(['album-one-c.png']);
  
      const albumCards = document.querySelectorAll('.workspace-page-photo-album-card');
      expect(albumCards).toHaveLength(1);
      expect((albumCards[0] as HTMLElement).dataset.albumId).toBe(albumId);
      expect(albumCards[0].querySelectorAll('.workspace-page-photo-album-preview img')).toHaveLength(3);
      expect(albumCards[0].querySelector('.workspace-page-photo-album-add')).toHaveAttribute('aria-label', 'Add photos to this album');
  
      const previewThumbnail = albumCards[0].querySelector<HTMLImageElement>('.workspace-page-photo-album-preview img')!;
      vi.useFakeTimers();
      try {
        await act(async () => {
          previewThumbnail.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
          await vi.advanceTimersByTimeAsync(1000);
        });
        expect(document.querySelector('.workspace-page-attachment-preview img')?.getAttribute('src')).toMatch(/^data:image\/png;base64,/);
      } finally {
        vi.useRealTimers();
        unmount();
      }
    });
  
  it('adds JFIF files with generic MIME as JPEG images to a photo album', async () => {
      const { unmount } = await renderWorkspacePage();
      const albumInput = document.querySelector<HTMLInputElement>('input[accept*=".jfif"][multiple]')!;
      const jfif = new File(['image'], 'photo.jfif', { type: 'application/octet-stream' });
      vi.mocked(window.draftStorage.readImageDataUrl!).mockResolvedValue({
        success: true,
        dataUrl: 'data:image/jpeg;base64,dGVzdA==',
      });
  
      await act(async () => {
        Object.defineProperty(albumInput, 'files', { value: [jfif], configurable: true });
        albumInput.dispatchEvent(new Event('change', { bubbles: true }));
        await new Promise((resolve) => window.setTimeout(resolve, 0));
      });
  
      try {
        await waitFor(() => {
          expect(window.draftStorage.copyAttachment).toHaveBeenCalledWith(jfif);
          expect(window.draftStorage.readImageDataUrl).toHaveBeenCalledWith('/stored/photo.jfif');
          expect(document.querySelector('.workspace-page-photo-album-preview img')).toHaveAttribute(
            'src',
            'data:image/jpeg;base64,dGVzdA==',
          );
        });
      } finally {
        unmount();
      }
    });
  
  it('enforces the ten-photo limit when appending to an existing album', async () => {
      const { unmount } = await renderWorkspacePage();
      const albumInput = document.querySelector<HTMLInputElement>('input[accept*="image/png"][multiple]')!;
      const selectImages = async (names: string[]) => {
        await act(async () => {
          Object.defineProperty(albumInput, 'files', {
            value: names.map((name) => new File(['image'], name, { type: 'image/png' })),
            configurable: true,
          });
          albumInput.dispatchEvent(new Event('change', { bubbles: true }));
          await new Promise((resolve) => window.setTimeout(resolve, 0));
        });
      };
  
      await selectImages(Array.from({ length: 9 }, (_, index) => `album-${index}.png`));
      const albumCard = document.querySelector<HTMLElement>('.workspace-page-photo-album-card')!;
      await act(async () => {
        (albumCard.querySelector('.workspace-page-photo-album-add') as HTMLButtonElement).click();
      });
      await selectImages(['album-last.png', 'album-over-limit.png']);
  
      expect(document.querySelectorAll('.workspace-page-photo-album-card')).toHaveLength(1);
      expect(document.querySelector('.workspace-page-photo-album-card')).toHaveTextContent('10 attachments');
      expect(document.querySelector('.workspace-page-publish-transient-feedback.is-error')?.textContent)
        .toContain('Album photo limit: 10.');
      unmount();
    });
  
  it('adds up to three photo album cards with ten photos each and removes an album as a group', async () => {
      const { unmount } = await renderWorkspacePage();
      const albumInput = document.querySelector<HTMLInputElement>('input[accept*="image/png"][multiple]')!;
      const selectAlbum = async (prefix: string, count: number) => {
        const files = Array.from({ length: count }, (_, index) => new File(
          [`${prefix}-${index}`],
          `${prefix}-${index}.png`,
          { type: 'image/png' },
        ));
        await act(async () => {
          Object.defineProperty(albumInput, 'files', { value: files, configurable: true });
          albumInput.dispatchEvent(new Event('change', { bubbles: true }));
          await new Promise((resolve) => window.setTimeout(resolve, 0));
        });
      };
  
      await selectAlbum('first', 11);
      expect(document.querySelectorAll('.workspace-page-photo-album-card')).toHaveLength(1);
      expect(document.querySelector('.workspace-page-photo-album-card')).toHaveTextContent('10 attachments');
      expect(document.querySelector('.workspace-page-publish-transient-feedback.is-error')?.textContent)
        .toContain('Album photo limit: 10.');
  
      await selectAlbum('second', 10);
      await selectAlbum('third', 10);
      expect(document.querySelectorAll('.workspace-page-photo-album-card')).toHaveLength(3);
      expect(document.querySelectorAll('.workspace-page-attachment-card')).toHaveLength(3);
      expect(document.querySelector<HTMLButtonElement>('[aria-label="Add photo album"]')?.disabled).toBe(true);
      expect(window.draftStorage.copyAttachment).toHaveBeenCalledTimes(30);
  
      await selectAlbum('fourth', 1);
      expect(document.querySelectorAll('.workspace-page-photo-album-card')).toHaveLength(3);
      expect(window.draftStorage.copyAttachment).toHaveBeenCalledTimes(30);
      expect(document.querySelector('.workspace-page-publish-transient-feedback.is-error')?.textContent)
        .toContain('Photo album limit: 3.');
  
      await act(async () => {
        (document.querySelector('.workspace-page-photo-album-card .workspace-page-attachment-remove') as HTMLButtonElement).click();
        await new Promise((resolve) => window.setTimeout(resolve, 0));
      });
      expect(document.querySelectorAll('.workspace-page-photo-album-card')).toHaveLength(2);
      unmount();
    });
  
  it('limits standalone attachments to ten while still allowing photo albums', async () => {
      const { unmount } = await renderWorkspacePage();
      const fileInput = document.querySelector<HTMLInputElement>('.workspace-page-hidden-file-input')!;
      const standaloneFiles = Array.from({ length: 11 }, (_, index) => new File(
        [`file-${index}`],
        `file-${index}.png`,
        { type: 'image/png' },
      ));
  
      await act(async () => {
        Object.defineProperty(fileInput, 'files', { value: standaloneFiles, configurable: true });
        fileInput.dispatchEvent(new Event('change', { bubbles: true }));
        await new Promise((resolve) => window.setTimeout(resolve, 0));
      });
  
      expect(document.querySelectorAll('.workspace-page-attachment-card')).toHaveLength(10);
      expect(window.draftStorage.copyAttachment).toHaveBeenCalledTimes(10);
      expect(document.querySelector('.workspace-page-publish-transient-feedback.is-error')?.textContent)
        .toContain('File limit: 10.');
  
      const albumInput = document.querySelector<HTMLInputElement>('input[accept*="image/png"][multiple]')!;
      await act(async () => {
        Object.defineProperty(albumInput, 'files', {
          value: [new File(['photo'], 'album-photo.png', { type: 'image/png' })],
          configurable: true,
        });
        albumInput.dispatchEvent(new Event('change', { bubbles: true }));
        await new Promise((resolve) => window.setTimeout(resolve, 0));
      });
  
      expect(document.querySelectorAll('.workspace-page-attachment-card')).toHaveLength(11);
      expect(document.querySelectorAll('.workspace-page-photo-album-card')).toHaveLength(1);
      expect(window.draftStorage.copyAttachment).toHaveBeenCalledTimes(11);
      unmount();
    });
  
  it('rejects image formats Telegram would upload as documents in a photo album', async () => {
      const { unmount } = await renderWorkspacePage();
      const albumInput = document.querySelector<HTMLInputElement>('input[accept*="image/png"][multiple]')!;
      const gifFile = new File(['gif-image'], 'unsupported.gif', { type: 'image/gif' });
  
      await act(async () => {
        Object.defineProperty(albumInput, 'files', { value: [gifFile], configurable: true });
        albumInput.dispatchEvent(new Event('change', { bubbles: true }));
        await new Promise((resolve) => window.setTimeout(resolve, 0));
      });
  
      expect(window.draftStorage.copyAttachment).not.toHaveBeenCalled();
      expect(document.querySelectorAll('.workspace-page-photo-album-card')).toHaveLength(0);
      expect(document.querySelector('.workspace-page-publish-transient-feedback.is-error'))
        .toHaveTextContent('Use JPG, PNG, or WebP.');
      unmount();
    });
  
  it('converts WebP images to PNG before adding them to a photo album', async () => {
      const { unmount } = await renderWorkspacePage();
      const albumInput = document.querySelector<HTMLInputElement>('input[accept*="image/webp"][multiple]')!;
      const imageFiles = Array.from({ length: 9 }, (_, index) => new File(
        [`png-image-${index}`],
        `photo-${index}.png`,
        { type: 'image/png' },
      ));
      const webpFile = new File(['webp-image'], 'photo.webp', { type: 'application/octet-stream' });
      const bitmap = { width: 2, height: 2, close: vi.fn() } as unknown as ImageBitmap;
      const drawImage = vi.fn();
      vi.stubGlobal('createImageBitmap', vi.fn().mockResolvedValue(bitmap));
      const getContext = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ drawImage } as unknown as CanvasRenderingContext2D);
      const toBlob = vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((callback) => {
        callback(new Blob(['png-image'], { type: 'image/png' }));
      });
  
      try {
        await act(async () => {
          Object.defineProperty(albumInput, 'files', { value: [...imageFiles, webpFile], configurable: true });
          albumInput.dispatchEvent(new Event('change', { bubbles: true }));
          await new Promise((resolve) => window.setTimeout(resolve, 0));
        });
  
        expect(window.draftStorage.copyAttachment).toHaveBeenCalledWith(expect.objectContaining({
          name: 'photo.png',
          type: 'image/png',
        }));
        expect(window.draftStorage.copyAttachment).toHaveBeenCalledTimes(10);
        expect(drawImage).toHaveBeenCalledOnce();
        expect(bitmap.close).toHaveBeenCalledOnce();
        expect(document.querySelector('.workspace-page-photo-album-card')).toHaveTextContent('10 attachments');
      } finally {
        getContext.mockRestore();
        toBlob.mockRestore();
        vi.unstubAllGlobals();
        unmount();
      }
    });
  
  it('blocks sending a restored photo album that contains an unsupported image format', async () => {
      workspaceTestState.inMemoryDraftStore = {
        schemaVersion: 2,
        migrationVersion: 1,
        savedDrafts: [],
        workspaceDraft: {
          body: 'Restored photo album',
          entities: [],
          attachments: [{
            id: 'restored-webp',
            type: 'image',
            name: 'restored.webp',
            mimeType: 'image/webp',
            size: 10,
            path: 'C:/media/restored.webp',
            position: 0,
            albumId: 'restored-album',
          }],
          savedAt: '12:00',
        },
      };
      const handleSendDraftNow = vi.fn().mockResolvedValue(true);
      const { unmount } = await renderWorkspacePage({ handleSendDraftNow });
  
      await act(async () => {
        (document.querySelector('.workspace-page-publish-main') as HTMLButtonElement).click();
        await Promise.resolve();
      });
  
      expect(handleSendDraftNow).not.toHaveBeenCalled();
      unmount();
    });
  
  it('exports the current editor text as a .txt file through the format menu', async () => {
      const { unmount } = await renderWorkspacePage();
      await typeEditorText('Hello export');
  
      const exportTrigger = document.querySelector('.workspace-page-editor-export-trigger') as HTMLButtonElement;
      expect(exportTrigger).toBeTruthy();
      expect(exportTrigger.getAttribute('aria-label')).toBe('Export editor text');
      const menu = await openExportMenu();
      const txtOption = pickExportFormat(menu, '.txt');
      await act(async () => {
        txtOption.click();
        await Promise.resolve();
      });
  
      expect(window.draftStorage.exportText).toHaveBeenCalledWith('Hello export', 'txt');
      expect(document.querySelector('.workspace-page-editor-export-menu')).toBeNull();
      expect(document.querySelector('.workspace-page-publish-transient-feedback.is-success')?.textContent).toBe('Text exported to file.');
      unmount();
    });
  
  it('exports the current editor text as a JSON file through the format menu', async () => {
      const { unmount } = await renderWorkspacePage();
      await typeEditorText('Structured body');
  
      const menu = await openExportMenu();
      const jsonOption = pickExportFormat(menu, '.json');
      await act(async () => {
        jsonOption.click();
        await Promise.resolve();
      });
  
      const call = vi.mocked(window.draftStorage.exportText).mock.calls[
        vi.mocked(window.draftStorage.exportText).mock.calls.length - 1
      ];
      expect(call?.[1]).toBe('json');
      expect(JSON.parse(String(call?.[0])).text).toBe('Structured body');
      expect(document.querySelector('.workspace-page-publish-transient-feedback.is-success')?.textContent).toBe('Text exported to file.');
      unmount();
    });
  
  it('blocks editor text export when there is no text and shows a warning', async () => {
      const { unmount } = await renderWorkspacePage();
      await typeEditorText('');
  
      const menu = await openExportMenu();
      const txtOption = pickExportFormat(menu, '.txt');
      await act(async () => {
        txtOption.click();
        await Promise.resolve();
      });
  
      expect(window.draftStorage.exportText).not.toHaveBeenCalled();
      expect(document.querySelector('.workspace-page-publish-transient-feedback.is-warning')?.textContent).toBe('No text to export.');
      unmount();
    });
  
  it('stays silent when the editor text export dialog is cancelled', async () => {
      vi.mocked(window.draftStorage.exportText).mockResolvedValueOnce({ success: false, cancelled: true });
      const { unmount } = await renderWorkspacePage();
      await typeEditorText('Cancel me');
  
      const menu = await openExportMenu();
      const txtOption = pickExportFormat(menu, '.txt');
      await act(async () => {
        txtOption.click();
        await Promise.resolve();
      });
  
      expect(window.draftStorage.exportText).toHaveBeenCalledTimes(1);
      expect(document.querySelector('.workspace-page-publish-transient-feedback')).toBeNull();
      unmount();
    });
  
  it('surfaces editor text export failures in the shared footer status', async () => {
      vi.mocked(window.draftStorage.exportText).mockResolvedValueOnce({ success: false, error: 'Disk is full.' });
      const { unmount } = await renderWorkspacePage();
      await typeEditorText('Body to fail');
  
      const menu = await openExportMenu();
      const txtOption = pickExportFormat(menu, '.txt');
      await act(async () => {
        txtOption.click();
        await Promise.resolve();
      });
  
      expect(document.querySelector('.workspace-page-publish-transient-feedback.is-error')?.textContent).toContain('Disk is full.');
      unmount();
    });
  
  it('closes the editor export format menu when clicking outside', async () => {
      const { unmount } = await renderWorkspacePage();
      await typeEditorText('Outside click');
  
      await openExportMenu();
      expect(document.querySelector('.workspace-page-editor-export-menu')).toBeTruthy();
  
      await act(async () => {
        document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      });
      expect(document.querySelector('.workspace-page-editor-export-menu')).toBeNull();
      expect(window.draftStorage.exportText).not.toHaveBeenCalled();
      unmount();
    });
  
  it('duplicates chat lookup errors in the shared footer status', async () => {
      vi.mocked(window.telegram.findChat).mockResolvedValueOnce({ success: false, error: 'Chat not found.' });
      const { unmount } = await renderWorkspacePage();
      await act(async () => {
        (document.querySelector('.workspace-page-chat-trigger') as HTMLButtonElement).click();
      });
      await act(async () => {
        (document.querySelector('.workspace-page-chat-stage-add') as HTMLButtonElement).click();
      });
      const queryInput = document.querySelector('.workspace-page-chat-stage-add-form input') as HTMLInputElement;
      await act(async () => {
        const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
        setter?.call(queryInput, '@missing');
        queryInput.dispatchEvent(new Event('input', { bubbles: true }));
      });
      await act(async () => {
        (document.querySelector('.workspace-page-chat-stage-add-form button') as HTMLButtonElement).click();
        await Promise.resolve();
      });
  
      expect(document.querySelector('.workspace-page-chat-stage-add-form [role="alert"]')).toBeNull();
      expect(document.querySelector('.workspace-page-publish-transient-feedback.is-error')?.textContent).toContain('Chat not found.');
      unmount();
    });
  
  it('duplicates preview history errors in the shared footer with a retry action', async () => {
      vi.mocked(window.telegram.getChatHistory).mockResolvedValueOnce({ success: false, error: 'History unavailable.' });
      const { unmount } = await renderWorkspacePage({ connected: true });
  
      expect(window.telegram.getChatHistory).toHaveBeenCalledWith({ chatId: chatA.id, limit: 50 });
      expect(document.querySelector('.chat-preview-state.is-error')).toBeNull();
      expect(document.querySelector('.workspace-page-publish-transient-feedback.is-error')?.textContent)
        .toContain('Chat history unavailable.');
      expect(document.querySelector('.workspace-page-publish-transient-feedback .workspace-page-send-retry')?.textContent).toBe('Retry');
      unmount();
    });
  
  it('does not reload preview history when the selected chat metadata changes', async () => {
      const { rerender, unmount } = await renderWorkspacePage({ connected: true });
  
      expect(window.telegram.getChatHistory).toHaveBeenCalledTimes(1);
  
      await act(async () => {
        rerender({ selectedChat: { ...chatA, avatarDataUrl: 'data:image/jpeg;base64,avatar' } });
        await Promise.resolve();
      });
  
      expect(window.telegram.getChatHistory).toHaveBeenCalledTimes(1);
      unmount();
    });
  
  it('passes the cached chat avatar to preview history', async () => {
      const cachedAvatarDataUrl = 'data:image/jpeg;base64,avatar';
      const { unmount } = await renderWorkspacePage({
        connected: true,
        selectedChat: { ...chatA, avatarDataUrl: cachedAvatarDataUrl },
      });
  
      expect(window.telegram.getChatHistory).toHaveBeenCalledWith({
        chatId: chatA.id,
        limit: 50,
        cachedAvatarDataUrl,
      });
      unmount();
    });
  
  it('omits an invalid cached chat avatar when loading preview history', async () => {
      const { unmount } = await renderWorkspacePage({
        connected: true,
        selectedChat: { ...chatA, avatarDataUrl: 'data:image/svg+xml;base64,PHN2Zz4=' },
      });
  
      expect(window.telegram.getChatHistory).toHaveBeenCalledWith({
        chatId: chatA.id,
        limit: 50,
      });
      unmount();
    });
  
  it('reuses a recent preview history when returning to a chat', async () => {
      const chatB: Chat = { id: 'chat-2', name: 'Beta Team', type: 'group' };
      vi.mocked(window.telegram.getChatHistory).mockResolvedValue({
        success: true,
        history: {
          chat: {
            id: chatA.id,
            title: chatA.name,
            username: chatA.username,
            type: chatA.type,
            avatarDataUrl: '',
            topic: '',
          },
          messages: [{
            id: 'history-1',
            text: 'Recent channel post',
            date: '2026-11-05T12:00:00.000Z',
            outgoing: false,
          }],
        },
      });
      const { rerender, unmount } = await renderWorkspacePage({ connected: true });
  
      expect(window.telegram.getChatHistory).toHaveBeenCalledTimes(1);
  
      await act(async () => {
        rerender({ chats: [chatA, chatB], selectedChat: chatB });
        await Promise.resolve();
        await Promise.resolve();
      });
      expect(window.telegram.getChatHistory).toHaveBeenCalledTimes(2);
  
      await act(async () => {
        rerender({ selectedChat: { ...chatA, avatarDataUrl: 'data:image/jpeg;base64,avatar' } });
        await Promise.resolve();
      });
  
      expect(window.telegram.getChatHistory).toHaveBeenCalledTimes(2);
      unmount();
    });
  
  it('does not cache an empty preview history', async () => {
      const chatB: Chat = { id: 'chat-2', name: 'Beta Team', type: 'group' };
      vi.mocked(window.telegram.getChatHistory).mockResolvedValue({
        success: true,
        history: {
          chat: {
            id: chatA.id,
            title: chatA.name,
            username: chatA.username,
            type: chatA.type,
            avatarDataUrl: '',
            topic: '',
          },
          messages: [],
        },
      });
      const { rerender, unmount } = await renderWorkspacePage({ connected: true });
  
      await act(async () => {
        rerender({ chats: [chatA, chatB], selectedChat: chatB });
        await Promise.resolve();
        await Promise.resolve();
      });
      await act(async () => {
        rerender({ selectedChat: chatA });
        await Promise.resolve();
        await Promise.resolve();
      });
  
      expect(window.telegram.getChatHistory).toHaveBeenCalledTimes(3);
      unmount();
    });
  
  it('explains forbidden chat history without offering a retry', async () => {
      vi.mocked(window.telegram.getChatHistory).mockResolvedValueOnce({ success: false, error: 'CHAT_FORBIDDEN' });
      const { unmount } = await renderWorkspacePage({ connected: true });
  
      const feedback = document.querySelector('.workspace-page-publish-transient-feedback.is-error');
      expect(feedback?.textContent).toContain('No access to this chat.');
      expect(feedback?.querySelector('.workspace-page-send-retry')).toBeNull();
      unmount();
    });
  
  it('does not expose instanceof runtime errors in preview history feedback', async () => {
      vi.mocked(window.telegram.getChatHistory).mockRejectedValueOnce(new TypeError("Right-hand side of 'instanceof' is not callable"));
      const { unmount } = await renderWorkspacePage({ connected: true });
  
      const feedback = document.querySelector('.workspace-page-publish-transient-feedback.is-error');
      expect(feedback?.textContent).toContain('Chat history unavailable.');
      expect(feedback?.textContent).not.toContain('instanceof');
      expect(feedback?.querySelector('.workspace-page-send-retry')?.textContent).toBe('Retry');
      unmount();
    });
  
  it('duplicates attachment size errors in the shared footer status', async () => {
      const { unmount } = await renderWorkspacePage();
      vi.useFakeTimers();
      const oversizedFile = new File(['image'], 'large-photo.png', { type: 'image/png' });
      Object.defineProperty(oversizedFile, 'size', { value: 50 * 1024 * 1024 + 1 });
      const fileInput = document.querySelector('.workspace-page-hidden-file-input') as HTMLInputElement;
      Object.defineProperty(fileInput, 'files', { value: [oversizedFile], configurable: true });
  
      await act(async () => {
        fileInput.dispatchEvent(new Event('change', { bubbles: true }));
        await Promise.resolve();
      });
  
      expect(document.querySelector('.workspace-page-empty-attachments')).toBeNull();
      expect(document.querySelector('.workspace-page-publish-transient-feedback.is-error')?.textContent).toContain('large-photo.png');
      expect(window.draftStorage.copyAttachment).not.toHaveBeenCalled();
      await act(async () => {
        await vi.advanceTimersByTimeAsync(3360);
      });
      expect(document.querySelector('.workspace-page-publish-transient-feedback.is-error')).toBeNull();
      vi.useRealTimers();
      unmount();
    });
  
  it('reserves the aggregate attachment limit across overlapping selections', async () => {
      const pendingCopies: Array<(result: { success: boolean; attachment?: { name: string; path: string; size: number } }) => void> = [];
      vi.mocked(window.draftStorage.copyAttachment).mockImplementation(() => new Promise((resolve) => {
        pendingCopies.push(resolve);
      }));
      const filesForBatch = (prefix: string) => Array.from({ length: 4 }, (_, index) => {
        const file = new File([''], `${prefix}-${index}.png`, { type: 'image/png' });
        Object.defineProperty(file, 'size', { value: 50 * 1024 * 1024 });
        return file;
      });
      const firstBatch = filesForBatch('first');
      const secondBatch = filesForBatch('second');
      const { unmount } = await renderWorkspacePage();
      const fileInput = document.querySelector('.workspace-page-hidden-file-input') as HTMLInputElement;
  
      await act(async () => {
        Object.defineProperty(fileInput, 'files', { value: firstBatch, configurable: true });
        fileInput.dispatchEvent(new Event('change', { bubbles: true }));
        Object.defineProperty(fileInput, 'files', { value: secondBatch, configurable: true });
        fileInput.dispatchEvent(new Event('change', { bubbles: true }));
        await Promise.resolve();
      });
  
      expect(window.draftStorage.copyAttachment).toHaveBeenCalledTimes(4);
      expect(document.querySelector('.workspace-page-publish-transient-feedback.is-error')?.textContent)
        .toContain('200 MB');
  
      await act(async () => {
        pendingCopies.forEach((resolve, index) => resolve({
          success: true,
          attachment: { name: firstBatch[index].name, path: `/stored/${firstBatch[index].name}`, size: firstBatch[index].size },
        }));
        await Promise.resolve();
      });
  
      expect(document.querySelectorAll('.workspace-page-attachment-card')).toHaveLength(4);
      unmount();
    });
  
  it('does not attach stale files after a successful publish clears the composer', async () => {
      let resolveCopy!: (result: { success: boolean; attachment?: { name: string; path: string; size: number } }) => void;
      const copyPromise = new Promise<{ success: boolean; attachment?: { name: string; path: string; size: number } }>((resolve) => {
        resolveCopy = resolve;
      });
      vi.mocked(window.draftStorage.copyAttachment).mockReturnValue(copyPromise);
      const { rerender, unmount } = await renderWorkspacePage();
      const file = new File(['image'], 'late-photo.png', { type: 'image/png' });
      const fileInput = document.querySelector('.workspace-page-hidden-file-input') as HTMLInputElement;
  
      await act(async () => {
        Object.defineProperty(fileInput, 'files', { value: [file], configurable: true });
        fileInput.dispatchEvent(new Event('change', { bubbles: true }));
        await Promise.resolve();
      });
      expect(window.draftStorage.copyAttachment).toHaveBeenCalledTimes(1);
  
      rerender({ successPulse: true });
      resolveCopy({
        success: true,
        attachment: { name: file.name, path: `/stored/${file.name}`, size: file.size },
      });
  
      await act(async () => {
        await copyPromise;
        await Promise.resolve();
      });
  
      expect(document.querySelectorAll('.workspace-page-attachment-card')).toHaveLength(0);
      unmount();
    });
});
