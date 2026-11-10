import { act } from 'react';
import { fireEvent, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { StudioPlannerTextPayload } from '@shared/bridge';
import { type WorkspaceDraft } from '../lib/draftStore';
import { EDITOR_APPEARANCE_STORAGE_KEY, writeEditorAppearancePreferences } from '@shared/editorAppearance';
import { chatA, workspacePageStyles, workspaceTestState, getInMemoryWorkspaceDraft, seedVersionHistoryDialogStore, renderWorkspacePage, openDraftsStage, saveEditorAsDraft, editComposerText, waitForWorkspaceAutosave, resetWorkspacePageTestEnvironment } from './WorkspacePage.testUtils';

describe('WorkspacePage Planner integration and history', () => {
  beforeEach(resetWorkspacePageTestEnvironment);

  it('opens Planner text in the main Studio editor and reuses the same workspace draft', async () => {
      localStorage.removeItem('awaitmsg-workspace-draft');
      workspaceTestState.inMemoryDraftStore = { schemaVersion: 2, migrationVersion: 1, savedDrafts: [], workspaceDraft: null };
      const registerPlannerTextOpener = vi.fn();
      const { unmount } = await renderWorkspacePage({ onRegisterPlannerTextOpener: registerPlannerTextOpener });
      const opener = registerPlannerTextOpener.mock.calls.map(([handler]) => handler)
        .find((handler) => typeof handler === 'function') as ((payload: StudioPlannerTextPayload) => Promise<boolean>) | undefined;
      const payload = {
        text: 'Message from Quick Planner',
        attachments: ['C:/planner/brief.pdf'],
        entities: [{ type: 'bold' as const, offset: 0, length: 7 }],
        effect: '123456789',
      };
  
      expect(opener).toBeTypeOf('function');
      let opened = false;
      await act(async () => {
        opened = await opener!(payload);
      });
  
      expect(opened).toBe(true);
      expect(document.querySelector('.workspace-page-rich-text-input.is-active')?.textContent)
        .toContain('Message from Quick Planner');
      expect(document.querySelector('[aria-label="Message effects"]')).toHaveAttribute('aria-pressed', 'true');
      expect(document.querySelector('.workspace-page-publish-transient-feedback.is-success')?.textContent)
        .toContain('Draft added successfully.');
      await act(async () => {
        opened = await opener!(payload);
        await new Promise((resolve) => window.setTimeout(resolve, 400));
      });
  
      expect(opened).toBe(true);
      expect(getInMemoryWorkspaceDraft().body).toBe('Message from Quick Planner');
      expect(getInMemoryWorkspaceDraft().entities).toEqual(payload.entities);
      expect(getInMemoryWorkspaceDraft().attachments[0]).toMatchObject({
        path: '/stored/brief.pdf',
        sourcePath: payload.attachments[0],
        name: 'brief.pdf',
      });
      expect(workspaceTestState.inMemoryDraftStore.savedDrafts).toHaveLength(0);
      unmount();
    });
  
  it('returns to the main Studio editor when opening Planner text from another stage', async () => {
      localStorage.removeItem('awaitmsg-workspace-draft');
      workspaceTestState.inMemoryDraftStore = { schemaVersion: 2, migrationVersion: 1, savedDrafts: [], workspaceDraft: null };
      const registerPlannerTextOpener = vi.fn();
      const { unmount } = await renderWorkspacePage({ onRegisterPlannerTextOpener: registerPlannerTextOpener });
      const opener = registerPlannerTextOpener.mock.calls.map(([handler]) => handler)
        .find((handler) => typeof handler === 'function') as ((payload: StudioPlannerTextPayload) => Promise<boolean>) | undefined;
      await openDraftsStage();
  
      let opened = false;
      await act(async () => {
        opened = await opener!({ text: 'Planner text from another stage', attachments: [], entities: [] });
      });
  
      expect(opened).toBe(true);
      expect(document.querySelector('.workspace-page-rich-text-input.is-active')?.textContent)
        .toContain('Planner text from another stage');
      expect(document.querySelector('.workspace-page-mode-button-draft.is-active')).toBeNull();
      unmount();
    });
  
  it('opens a photo-only Planner payload in Studio', async () => {
      localStorage.removeItem('awaitmsg-workspace-draft');
      workspaceTestState.inMemoryDraftStore = { schemaVersion: 2, migrationVersion: 1, savedDrafts: [], workspaceDraft: null };
      const registerPlannerTextOpener = vi.fn();
      const { unmount } = await renderWorkspacePage({ onRegisterPlannerTextOpener: registerPlannerTextOpener });
      const opener = registerPlannerTextOpener.mock.calls.map(([handler]) => handler)
        .find((handler) => typeof handler === 'function') as ((payload: StudioPlannerTextPayload) => Promise<boolean>) | undefined;
      let opened = false;
      await act(async () => {
        opened = await opener!({ text: '', attachments: ['C:/planner/photo.png'], entities: [] });
      });
  
      expect(opened).toBe(true);
      expect(window.draftStorage?.copyAttachmentPath).toHaveBeenCalledWith('C:/planner/photo.png');
      expect(document.querySelector('.workspace-page-attachment-name')).toHaveTextContent('photo.png');
      unmount();
    });

  it('restores the previous Studio document when clearing text opened from Planner', async () => {
      localStorage.removeItem('awaitmsg-workspace-draft');
      workspaceTestState.inMemoryDraftStore = {
        schemaVersion: 2,
        migrationVersion: 1,
        savedDrafts: [],
        workspaceDraft: {
          documentId: 'planner-clear-previous-document',
          body: 'Previous Studio document',
          entities: [],
          attachments: [],
          savedAt: '12:00',
        },
      };
      const registerPlannerTextOpener = vi.fn();
      const { unmount } = await renderWorkspacePage({ onRegisterPlannerTextOpener: registerPlannerTextOpener });
      const opener = registerPlannerTextOpener.mock.calls.map(([handler]) => handler)
        .find((handler) => typeof handler === 'function') as ((payload: StudioPlannerTextPayload) => Promise<boolean>) | undefined;

      await act(async () => {
        expect(await opener!({ text: 'Text from Planner', attachments: [], entities: [] })).toBe(true);
        await new Promise((resolve) => window.setTimeout(resolve, 400));
      });

      await act(async () => {
        screen.getByRole('button', { name: 'Clear editor text' }).click();
        await new Promise((resolve) => window.setTimeout(resolve, 0));
      });

      expect(document.querySelector('.workspace-page-rich-text-input.is-active')?.textContent)
        .toContain('Previous Studio document');
      expect(document.querySelector('.workspace-page-rich-text-input.is-active')?.textContent)
        .not.toContain('Text from Planner');
      expect(getInMemoryWorkspaceDraft()).toMatchObject({
        documentId: 'planner-clear-previous-document',
        body: 'Previous Studio document',
      });
      expect(document.querySelector('.workspace-page-publish-transient-feedback.is-success')?.textContent)
        .toContain('Your previous text has been restored in the editor.');
      unmount();
    });
  
  it('preserves a different Studio document in history before opening Planner text without creating duplicate drafts', async () => {
      localStorage.removeItem('awaitmsg-workspace-draft');
      workspaceTestState.inMemoryDraftStore = {
        schemaVersion: 2,
        migrationVersion: 1,
        savedDrafts: [],
        workspaceDraft: { body: 'Existing Studio document', attachments: [], savedAt: '12:00' },
      };
      const registerPlannerTextOpener = vi.fn();
      const { unmount } = await renderWorkspacePage({ onRegisterPlannerTextOpener: registerPlannerTextOpener });
      const opener = registerPlannerTextOpener.mock.calls.map(([handler]) => handler)
        .find((handler) => typeof handler === 'function') as ((payload: StudioPlannerTextPayload) => Promise<boolean>) | undefined;
      let opened = true;
      await act(async () => {
        opened = await opener?.({ text: 'Planner document', attachments: [], entities: [] }) ?? true;
      });
      await act(async () => {
        await new Promise((resolve) => window.setTimeout(resolve, 400));
      });
  
      expect(opened).toBe(true);
      expect(document.querySelector('.workspace-page-rich-text-input.is-active')?.textContent)
        .toContain('Planner document');
      expect(document.querySelector('.workspace-page-publish-transient-feedback.is-success')?.textContent)
        .toContain('Draft added successfully.');
      expect(workspaceTestState.inMemoryDraftStore.savedDrafts).toHaveLength(0);
      expect(Object.values(workspaceTestState.inMemoryDraftStore.documentHistories ?? {}).flat().some((version) => (
        (version.snapshot as WorkspaceDraft).body === 'Existing Studio document'
      ))).toBe(true);
      expect(getInMemoryWorkspaceDraft().body).toBe('Planner document');
  
      await act(async () => {
        opened = await opener!({ text: 'Planner document', attachments: [], entities: [] });
      });
      await act(async () => {
        await new Promise((resolve) => window.setTimeout(resolve, 400));
      });
      expect(opened).toBe(true);
      expect(workspaceTestState.inMemoryDraftStore.savedDrafts).toHaveLength(0);
      expect(Object.values(workspaceTestState.inMemoryDraftStore.documentHistories ?? {}).flat().filter((version) => (
        (version.snapshot as WorkspaceDraft).body === 'Existing Studio document'
      ))).toHaveLength(1);
      unmount();
    });
  
  it('keeps existing Studio work when its history checkpoint fails before opening Planner text', async () => {
      localStorage.removeItem('awaitmsg-workspace-draft');
      workspaceTestState.inMemoryDraftStore = {
        schemaVersion: 2,
        migrationVersion: 1,
        savedDrafts: [],
        workspaceDraft: { body: 'Keep this Studio document', attachments: [], savedAt: '12:00' },
      };
      vi.mocked(window.draftStorage.save).mockResolvedValueOnce({ success: false, error: 'Disk unavailable' });
      const registerPlannerTextOpener = vi.fn();
      const { unmount } = await renderWorkspacePage({ onRegisterPlannerTextOpener: registerPlannerTextOpener });
      const opener = registerPlannerTextOpener.mock.calls.map(([handler]) => handler)
        .find((handler) => typeof handler === 'function') as ((payload: StudioPlannerTextPayload) => Promise<boolean>) | undefined;
      let opened = true;
      await act(async () => {
        opened = await opener?.({ text: 'Do not lose this document', attachments: [], entities: [] }) ?? true;
      });
  
      expect(opened).toBe(false);
      expect(document.querySelector('.workspace-page-rich-text-input.is-active')?.textContent)
        .toContain('Keep this Studio document');
      expect(workspaceTestState.inMemoryDraftStore.savedDrafts).toHaveLength(0);
      unmount();
    });
  
  it('restores the previous Studio document after successfully saving Planner text', async () => {
      localStorage.removeItem('awaitmsg-workspace-draft');
      workspaceTestState.inMemoryDraftStore = {
        schemaVersion: 2,
        migrationVersion: 1,
        savedDrafts: [],
        workspaceDraft: {
          body: 'Previous Studio post',
          entities: [{ type: 'bold', offset: 0, length: 8 }],
          attachments: [{ name: 'original.pdf', path: 'C:/files/original.pdf' }],
          selectedChat: chatA,
          date: '2026-01-10',
          time: '09:00',
          repeatMode: 'none',
          repeatDays: [],
          repeatOccurrences: 1,
          savedAt: '12:00',
        },
      };
      const registerPlannerTextOpener = vi.fn();
      const { unmount } = await renderWorkspacePage({ onRegisterPlannerTextOpener: registerPlannerTextOpener });
      const opener = registerPlannerTextOpener.mock.calls.map(([handler]) => handler)
        .find((handler) => typeof handler === 'function') as ((payload: StudioPlannerTextPayload) => Promise<boolean>) | undefined;
  
      await act(async () => {
        expect(await opener!({ text: 'Planner post', attachments: [], entities: [] })).toBe(true);
        await new Promise((resolve) => window.setTimeout(resolve, 400));
      });
      await saveEditorAsDraft();
  
      expect(workspaceTestState.inMemoryDraftStore.savedDrafts.map((draft) => draft.body)).toEqual(['Planner post']);
      expect(getInMemoryWorkspaceDraft().body).toBe('Previous Studio post');
      const editor = document.querySelector('.workspace-page-rich-text-input.is-active');
      expect(editor?.textContent).toContain('Previous Studio post');
      expect(editor?.textContent).not.toContain('Planner post');
      expect(editor?.querySelector('strong')?.textContent).toBe('Previous');
      expect(document.body.textContent).toContain('original.pdf');
      expect(getInMemoryWorkspaceDraft()).toMatchObject({
        body: 'Previous Studio post',
        entities: [{ type: 'bold', offset: 0, length: 8 }],
        attachments: [expect.objectContaining({ path: '/stored/original.pdf', sourcePath: 'C:/files/original.pdf' })],
        selectedChat: chatA,
        date: '2026-01-10',
        time: '09:00',
      });
      expect(Object.values(workspaceTestState.inMemoryDraftStore.documentHistories ?? {}).flat().some((version) => (
        (version.snapshot as WorkspaceDraft).body === 'Planner post'
        && version.reason === 'publish'
      ))).toBe(true);
      unmount();
    });
  
  it('keeps Planner text in the editor when saving it as a draft fails', async () => {
      localStorage.removeItem('awaitmsg-workspace-draft');
      workspaceTestState.inMemoryDraftStore = {
        schemaVersion: 2,
        migrationVersion: 1,
        savedDrafts: [],
        workspaceDraft: { body: 'Previous Studio post', attachments: [], savedAt: '12:00' },
      };
      const registerPlannerTextOpener = vi.fn();
      const { unmount } = await renderWorkspacePage({ onRegisterPlannerTextOpener: registerPlannerTextOpener });
      const opener = registerPlannerTextOpener.mock.calls.map(([handler]) => handler)
        .find((handler) => typeof handler === 'function') as ((payload: StudioPlannerTextPayload) => Promise<boolean>) | undefined;
      await act(async () => {
        await opener!({ text: 'Planner post', attachments: [], entities: [] });
        await new Promise((resolve) => window.setTimeout(resolve, 400));
      });
      vi.mocked(window.draftStorage.save).mockResolvedValueOnce({ success: false, error: 'Disk unavailable' });
  
      await saveEditorAsDraft();
  
      expect(document.querySelector('.workspace-page-rich-text-input.is-active')?.textContent).toContain('Planner post');
      expect(document.querySelector('.workspace-page-rich-text-input.is-active')?.textContent).not.toContain('Previous Studio post');
      // The previous Studio document is preserved as a history checkpoint, not as a temporary draft,
      // so a failed save leaves no half-written entry in the saved drafts list.
      expect(workspaceTestState.inMemoryDraftStore.savedDrafts).toHaveLength(0);
      expect(Object.values(workspaceTestState.inMemoryDraftStore.documentHistories ?? {}).flat().some((version) => (
        (version.snapshot as WorkspaceDraft).body === 'Previous Studio post'
        && version.reason === 'before-replacement'
      ))).toBe(true);
      unmount();
    });
  
  it('does not delete a matching user-saved draft when restoring after Planner save', async () => {
      localStorage.removeItem('awaitmsg-workspace-draft');
      const existingUserDraft = {
        id: 'user-saved-previous-post',
        name: 'My saved Studio post',
        body: 'Previous Studio post',
        entities: [],
        attachments: [],
        selectedChat: chatA,
        date: '2026-01-10',
        time: '09:00',
        repeatMode: 'none' as const,
        repeatDays: [],
        repeatOccurrences: 1,
        createdAt: '2026-09-28T10:00:00.000Z',
        updatedAt: '2026-09-29T18:35:00.000Z',
      };
      workspaceTestState.inMemoryDraftStore = {
        schemaVersion: 2,
        migrationVersion: 1,
        savedDrafts: [existingUserDraft],
        workspaceDraft: {
          body: 'Previous Studio post',
          attachments: [],
          savedAt: '12:00',
          selectedChat: chatA,
          date: '2026-01-10',
          time: '09:00',
          repeatMode: 'none',
          repeatDays: [],
          repeatOccurrences: 1,
        },
      };
      const registerPlannerTextOpener = vi.fn();
      const { unmount } = await renderWorkspacePage({ onRegisterPlannerTextOpener: registerPlannerTextOpener });
      const opener = registerPlannerTextOpener.mock.calls.map(([handler]) => handler)
        .find((handler) => typeof handler === 'function') as ((payload: StudioPlannerTextPayload) => Promise<boolean>) | undefined;
      await act(async () => {
        await opener!({ text: 'Planner post', attachments: [], entities: [] });
        await new Promise((resolve) => window.setTimeout(resolve, 400));
      });
  
      await saveEditorAsDraft();
  
      expect(workspaceTestState.inMemoryDraftStore.savedDrafts).toEqual(expect.arrayContaining([
        expect.objectContaining({ id: existingUserDraft.id, body: existingUserDraft.body }),
        expect.objectContaining({ body: 'Planner post' }),
      ]));
      expect(getInMemoryWorkspaceDraft().body).toBe('Previous Studio post');
      unmount();
    });
  
  it.each([
      { lastAction: 'sent' as const },
      { lastAction: 'scheduled' as const },
    ])('restores the previous Studio document after Planner text is $lastAction', async ({ lastAction }) => {
      localStorage.removeItem('awaitmsg-workspace-draft');
      workspaceTestState.inMemoryDraftStore = {
        schemaVersion: 2,
        migrationVersion: 1,
        savedDrafts: [],
        workspaceDraft: { body: 'Previous Studio post', attachments: [], savedAt: '12:00' },
      };
      const registerPlannerTextOpener = vi.fn();
      const { rerender, unmount } = await renderWorkspacePage({ onRegisterPlannerTextOpener: registerPlannerTextOpener });
      const opener = registerPlannerTextOpener.mock.calls.map(([handler]) => handler)
        .find((handler) => typeof handler === 'function') as ((payload: StudioPlannerTextPayload) => Promise<boolean>) | undefined;
      await act(async () => {
        await opener!({ text: 'Planner post', attachments: [], entities: [] });
        await new Promise((resolve) => window.setTimeout(resolve, 400));
      });
  
      await act(async () => {
        rerender({ successPulse: true, lastAction });
        await new Promise((resolve) => window.setTimeout(resolve, 400));
      });
  
      expect(workspaceTestState.inMemoryDraftStore.savedDrafts).toHaveLength(0);
      expect(getInMemoryWorkspaceDraft().body).toBe('Previous Studio post');
      expect(document.querySelector('.workspace-page-rich-text-input.is-active')?.textContent).toContain('Previous Studio post');
      expect(document.querySelector('.workspace-page-rich-text-input.is-active')?.textContent).not.toContain('Planner post');
      expect(document.querySelector('.workspace-page-publish-transient-feedback'))
        .toHaveTextContent('Your previous text has been restored in the editor.');
      expect(document.querySelector('.workspace-page-publish-transient-feedback')).toHaveClass('is-success');
      expect(Object.values(workspaceTestState.inMemoryDraftStore.documentHistories ?? {}).flat().some((version) => (
        (version.snapshot as WorkspaceDraft).body === 'Planner post'
        && version.reason === 'publish'
      ))).toBe(true);
      unmount();
    });
  
  it('does not register an empty Studio document for restoration after opening Planner text', async () => {
      localStorage.removeItem('awaitmsg-workspace-draft');
      workspaceTestState.inMemoryDraftStore = {
        schemaVersion: 2,
        migrationVersion: 1,
        savedDrafts: [],
        workspaceDraft: null,
      };
      const registerPlannerTextOpener = vi.fn();
      const { rerender, unmount } = await renderWorkspacePage({ onRegisterPlannerTextOpener: registerPlannerTextOpener });
      const opener = registerPlannerTextOpener.mock.calls.map(([handler]) => handler)
        .find((handler) => typeof handler === 'function') as ((payload: StudioPlannerTextPayload) => Promise<boolean>) | undefined;
  
      await act(async () => {
        await opener!({ text: 'Planner post', attachments: [], entities: [] });
        await new Promise((resolve) => window.setTimeout(resolve, 400));
      });
      await act(async () => {
        rerender({ successPulse: true, lastAction: 'sent' });
        await new Promise((resolve) => window.setTimeout(resolve, 400));
      });
  
      expect(document.querySelector('.workspace-page-rich-text-input.is-active')?.textContent).not.toContain('Planner post');
      expect(workspaceTestState.inMemoryDraftStore.savedDrafts).toHaveLength(0);
      unmount();
    });
  
  it('persists previous versions with the workspace draft and reloads them in History', async () => {
      localStorage.removeItem('awaitmsg-workspace-draft');
      workspaceTestState.inMemoryDraftStore = {
        schemaVersion: 3,
        migrationVersion: 1,
        savedDrafts: [],
        documentHistories: {},
        workspaceDraft: {
          documentId: 'history-reload-document',
          body: 'Original post before reload',
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
      };
      const firstMount = await renderWorkspacePage();
  
      await editComposerText('Updated post after typing');
      await waitForWorkspaceAutosave();
  
      expect(workspaceTestState.inMemoryDraftStore.workspaceDraft).toMatchObject({ body: 'Updated post after typing' });
      expect(workspaceTestState.inMemoryDraftStore.documentHistories?.['history-reload-document']?.map((version) => (version.snapshot as WorkspaceDraft).body))
        .toEqual(['Original post before reload']);
      firstMount.unmount();
  
      const secondMount = await renderWorkspacePage();
      await act(async () => {
        (document.querySelector('.workspace-page-version-history-trigger') as HTMLButtonElement).click();
      });
      expect(document.querySelector('[role="dialog"]')?.textContent).toContain('Original post before reload');
      secondMount.unmount();
    });
  
  it('coalesces autosave history checkpoints while persisting every latest edit', async () => {
      localStorage.removeItem('awaitmsg-workspace-draft');
      const documentId = 'coalesced-edit-history-document';
      workspaceTestState.inMemoryDraftStore = {
        schemaVersion: 3,
        migrationVersion: 1,
        savedDrafts: [],
        documentHistories: {},
        workspaceDraft: {
          documentId,
          body: 'Original post before edits',
          entities: [],
          attachments: [],
          selectedChat: chatA,
          date: '',
          time: '',
          repeatMode: 'none',
          repeatDays: [],
          repeatOccurrences: 1,
          savedAt: '12:00',
        },
      };
      const { unmount } = await renderWorkspacePage();
  
      await editComposerText('First saved edit');
      await waitForWorkspaceAutosave();
      await editComposerText('Latest saved edit');
      await waitForWorkspaceAutosave();
  
      expect(workspaceTestState.inMemoryDraftStore.workspaceDraft).toMatchObject({ body: 'Latest saved edit' });
      expect(workspaceTestState.inMemoryDraftStore.documentHistories?.[documentId]?.map((version) => (
        (version.snapshot as WorkspaceDraft).body
      ))).toEqual(['Original post before edits']);
      unmount();
    });
  
  it('keeps version history open while changing the selected document', async () => {
      localStorage.removeItem('awaitmsg-workspace-draft');
      const previousAppearance = localStorage.getItem(EDITOR_APPEARANCE_STORAGE_KEY);
      writeEditorAppearancePreferences({
        style: 'outline',
        palette: 'custom',
        modeColors: { send: '#287fa6', schedule: '#b482f5', draft: '#f58b37' },
      });
      const { otherDocumentId } = seedVersionHistoryDialogStore();
      const { unmount } = await renderWorkspacePage();
  
      await act(async () => {
        (document.querySelector('.workspace-page-version-history-trigger') as HTMLButtonElement).click();
      });
  
      const dialog = document.querySelector('.workspace-page-version-history-dialog') as HTMLElement;
      const dialogRule = workspacePageStyles.match(/\.workspace-page-version-history-dialog\s*\{([^}]*)\}/)?.[1] ?? '';
      const documentMenuRule = workspacePageStyles.match(/\.workspace-page-version-history-document-menu\s*\{([^}]*)\}/)?.[1] ?? '';
      const documentMenuOpenRule = workspacePageStyles.match(/\.workspace-page-version-history-list\.is-document-menu-open\s*\{([^}]*)\}/)?.[1] ?? '';
      const headerRule = workspacePageStyles.match(/\.workspace-page-version-history-header\s*\{([^}]*)\}/)?.[1] ?? '';
      const dividerRule = workspacePageStyles.match(/\.workspace-page-version-history-list\s*\{([^}]*)\}/)?.[1] ?? '';
      const dialogFocusRule = workspacePageStyles.match(/\.workspace-page-version-history-dialog:focus\s*\{([^}]*)\}/)?.[1] ?? '';
      const hoverRule = workspacePageStyles.match(/\.workspace-page-version-history-dialog button:hover:not\(:disabled\),\s*\.workspace-page-version-history-dialog button:active:not\(:disabled\)\s*\{([^}]*)\}/)?.[1] ?? '';
      const electronBackdropRule = workspacePageStyles.match(/html\.electron-runtime \.workspace-page-version-history-backdrop\s*\{([^}]*)\}/)?.[1] ?? '';
      expect(dialog.style.getPropertyValue('--version-history-accent')).toBe('35, 157, 251');
      expect(dialog.querySelector('.workspace-page-version-history-icon svg')).not.toBeNull();
      expect(headerRule).toMatch(/justify-content:\s*center/);
      expect(dialogRule).toMatch(/border:\s*1px solid rgba\(154, 168, 184, 0\.16\)/);
      expect(dialogRule).toMatch(/height:\s*min\(660px, calc\(100dvh - 72px\)\)/);
      expect(documentMenuRule).toMatch(/max-height:\s*min\(346px, calc\(100dvh - 414px\)\)/);
      expect(documentMenuOpenRule).toMatch(/overflow:\s*hidden/);
      expect(dialogFocusRule).toMatch(/outline:\s*none/);
      expect(dividerRule).toMatch(/border-right:\s*1px solid rgba\(154, 168, 184, 0\.12\)/);
      expect(hoverRule).toMatch(/background:\s*transparent !important/);
      expect(hoverRule).toMatch(/box-shadow:\s*none !important/);
      expect(electronBackdropRule).toMatch(/backdrop-filter:\s*none/);
  
      await act(async () => {
        writeEditorAppearancePreferences({
          style: 'outline',
          palette: 'custom',
          modeColors: { send: '#ff6699', schedule: '#b482f5', draft: '#f58b37' },
        });
      });
      expect(dialog.style.getPropertyValue('--version-history-accent')).toBe('35, 157, 251');
  
      const documentPicker = dialog.querySelector('.workspace-page-version-history-document-trigger') as HTMLButtonElement;
      await act(async () => {
        documentPicker.click();
      });
      expect(documentPicker.getAttribute('aria-expanded')).toBe('true');
      expect(dialog.querySelector('[role="listbox"]')).not.toBeNull();
      const versionList = dialog.querySelector('.workspace-page-version-history-list')!;
      expect(versionList).toHaveClass('is-document-menu-open');
      expect(versionList.querySelector('.workspace-page-version-history-item')).not.toBeNull();
      const otherDocumentOption = dialog.querySelector(`[role="option"][value="${otherDocumentId}"]`) as HTMLButtonElement;
      await act(async () => {
        otherDocumentOption.click();
      });
  
      expect(documentPicker.getAttribute('aria-expanded')).toBe('false');
      expect(versionList).not.toHaveClass('is-document-menu-open');
      expect(document.querySelector('.workspace-page-version-history-dialog')).not.toBeNull();
      expect(document.querySelector('.workspace-page-version-history-preview')?.textContent)
        .toContain('Other historical document');
      unmount();
      if (previousAppearance === null) localStorage.removeItem(EDITOR_APPEARANCE_STORAGE_KEY);
      else localStorage.setItem(EDITOR_APPEARANCE_STORAGE_KEY, previousAppearance);
    });
  
  it('opens the document picker with the keyboard and Escape closes it before the dialog', async () => {
      localStorage.removeItem('awaitmsg-workspace-draft');
      seedVersionHistoryDialogStore();
      const { unmount } = await renderWorkspacePage();
  
      await act(async () => {
        (document.querySelector('.workspace-page-version-history-trigger') as HTMLButtonElement).click();
      });
  
      const dialog = document.querySelector('.workspace-page-version-history-dialog') as HTMLElement;
      const documentPicker = dialog.querySelector('.workspace-page-version-history-document-trigger') as HTMLButtonElement;
      await act(async () => {
        documentPicker.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
      });
      expect(documentPicker.getAttribute('aria-expanded')).toBe('true');
      const versionList = dialog.querySelector('.workspace-page-version-history-list')!;
      expect(versionList).toHaveClass('is-document-menu-open');
  
      await act(async () => {
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      });
      expect(documentPicker.getAttribute('aria-expanded')).toBe('false');
      expect(versionList).not.toHaveClass('is-document-menu-open');
      expect(document.querySelector('.workspace-page-version-history-dialog')).not.toBeNull();
  
      await act(async () => {
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      });
      expect(document.querySelector('.workspace-page-version-history-dialog')).toBeNull();
      unmount();
    });
  
  it('closes version history only when the backdrop itself is clicked', async () => {
      localStorage.removeItem('awaitmsg-workspace-draft');
      seedVersionHistoryDialogStore();
      const { unmount } = await renderWorkspacePage();
  
      await act(async () => {
        (document.querySelector('.workspace-page-version-history-trigger') as HTMLButtonElement).click();
      });
  
      const dialog = document.querySelector('.workspace-page-version-history-dialog') as HTMLElement;
      const backdrop = dialog.parentElement as HTMLElement;
      await act(async () => {
        dialog.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      });
      expect(document.querySelector('.workspace-page-version-history-dialog')).not.toBeNull();
  
      await act(async () => {
        backdrop.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      });
      expect(document.querySelector('.workspace-page-version-history-dialog')).toBeNull();
      unmount();
    });
  
  it('restores the selected version with ordered attachments and document metadata', async () => {
      localStorage.removeItem('awaitmsg-workspace-draft');
      const oldSnapshot: WorkspaceDraft = {
        documentId: 'restore-complete-document',
        body: 'Previous Studio post',
        entities: [{ type: 'bold', offset: 0, length: 8 }],
        attachments: [
          { id: 'first', type: 'file', name: 'first.pdf', mimeType: 'application/pdf', size: 11, path: 'C:/files/first.pdf', position: 0 },
          { id: 'second', type: 'image', name: 'second.png', mimeType: 'image/png', size: 22, path: 'C:/files/second.png', position: 3 },
          { id: 'third', type: 'file', name: 'third.docx', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', size: 33, path: 'C:/files/third.docx', position: 5 },
        ],
        selectedChat: chatA,
        date: '2035-01-15',
        time: '18:30',
        repeatMode: 'weekly',
        repeatDays: ['monday'],
        repeatOccurrences: 4,
        savedAt: '10:00',
      };
      workspaceTestState.inMemoryDraftStore = {
        schemaVersion: 3,
        migrationVersion: 1,
        savedDrafts: [],
        documentHistories: {
          [oldSnapshot.documentId!]: [{
            id: 'restore-version-1',
            documentId: oldSnapshot.documentId!,
            createdAt: '2026-10-01T12:00:00.000Z',
            reason: 'edit',
            snapshot: oldSnapshot as unknown as Record<string, unknown>,
          }],
        },
        workspaceDraft: {
          documentId: oldSnapshot.documentId,
          body: 'Current Studio post',
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
      };
      const setSelectedChat = vi.fn();
      const setDate = vi.fn();
      const setTime = vi.fn();
      const { rerender, unmount } = await renderWorkspacePage({ setSelectedChat, setDate, setTime });
  
      await act(async () => {
        (document.querySelector('.workspace-page-version-history-trigger') as HTMLButtonElement).click();
      });
      expect(document.querySelector('.workspace-page-version-history-preview')?.textContent).toContain('Previous Studio post');
      await act(async () => {
        (document.querySelector('.workspace-page-version-history-restore') as HTMLButtonElement).click();
        await new Promise((resolve) => window.setTimeout(resolve, 0));
      });
      const restoreConfirmation = screen.getByRole('alertdialog');
      await act(async () => {
        fireEvent.click(within(restoreConfirmation).getByRole('button', { name: 'Apply' }));
      });
      rerender({ date: '2035-01-15', time: '18:30' });
      await act(async () => {
        await new Promise((resolve) => window.setTimeout(resolve, 500));
      });
  
      const editor = document.querySelector('.workspace-page-rich-text-input.is-active');
      expect(editor?.textContent).toContain('Previous Studio post');
      expect(editor?.querySelector('strong')?.textContent).toBe('Previous');
      expect(workspaceTestState.inMemoryDraftStore.workspaceDraft).toMatchObject({
        body: 'Previous Studio post',
        documentId: oldSnapshot.documentId,
        attachments: [
          expect.objectContaining({ name: 'first.pdf', path: '/stored/first.pdf', position: 0 }),
          expect.objectContaining({ name: 'second.png', path: '/stored/second.png', position: 3 }),
          expect.objectContaining({ name: 'third.docx', path: '/stored/third.docx', position: 5 }),
        ],
        date: '2035-01-15',
        time: '18:30',
        repeatMode: 'weekly',
        repeatDays: ['monday'],
        repeatOccurrences: 4,
      });
      expect(setSelectedChat).toHaveBeenCalledWith(chatA);
      expect(setDate).toHaveBeenCalledWith('2035-01-15');
      expect(setTime).toHaveBeenCalledWith('18:30');
      expect(workspaceTestState.inMemoryDraftStore.documentHistories?.[oldSnapshot.documentId!]).toHaveLength(2);
      unmount();
    });
});
