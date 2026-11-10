import { act } from 'react';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BUILT_IN_TEMPLATES } from '../lib/builtInTemplates';
import { chatA, workspacePageStyles, workspaceTestState, renderWorkspacePage, openDraftsStage, saveEditorAsDraft, resetWorkspacePageTestEnvironment } from './WorkspacePage.testUtils';

describe('WorkspacePage draft stage and attachments', () => {
  beforeEach(resetWorkspacePageTestEnvironment);

  it('opens two button choices above and below the primary action without a popup panel', async () => {
    const { unmount } = await renderWorkspacePage();
    const primaryButton = document.querySelector('.workspace-page-publish-main') as HTMLButtonElement;
    await act(async () => {
      (document.querySelector('.workspace-page-publish-menu-toggle') as HTMLButtonElement).click();
    });

    const menu = document.querySelector('.workspace-page-publish-menu-compact');
    expect(menu).toBeInTheDocument();
    expect(menu).toHaveAttribute('role', 'group');
    expect(menu?.querySelectorAll('.workspace-page-publish-option')).toHaveLength(2);
    expect(menu?.querySelector('.workspace-page-publish-choice-slot.is-above .workspace-page-publish-option'))
      .toHaveTextContent('Schedule');
    expect(menu?.querySelector('.workspace-page-publish-choice-slot.is-below .workspace-page-publish-option'))
      .toHaveTextContent('Save draft');
    expect(primaryButton.parentElement).toHaveClass('is-menu-open');
    expect(primaryButton.parentElement).toHaveClass('workspace-page-publish-main-wrap');
    expect(menu?.querySelector('.workspace-page-publish-option')).toHaveClass('workspace-page-publish-main');
    expect(menu).not.toHaveTextContent('Send now');
    expect(menu).toHaveTextContent('Schedule');
    expect(menu).toHaveTextContent('Save draft');
    expect(primaryButton).toHaveTextContent('Send now');

    await act(async () => {
      (Array.from(menu?.querySelectorAll<HTMLButtonElement>('.workspace-page-publish-option') ?? [])
        .find((button) => button.textContent?.trim() === 'Save draft') as HTMLButtonElement).click();
    });

    expect(document.querySelector('.workspace-page-publish-menu-compact')).toBeNull();
    expect(primaryButton).toHaveTextContent('Save draft');

    unmount();
  });

  it('keeps the Draft button after Templates and opens its stage', async () => {
      const { unmount } = await renderWorkspacePage();
  
      const actionGroup = document.querySelector('.workspace-page-action-left-group');
      const leftGroupButtons = Array.from(actionGroup?.querySelectorAll(':scope > button') ?? [])
        .map((button) => button.textContent?.trim());
  
      expect(leftGroupButtons).toContain('Draft');
      expect(leftGroupButtons).not.toContain('Queue / History');
      expect((Array.from(actionGroup?.querySelectorAll(':scope > button') ?? [])
        .find((button) => button.textContent?.trim() === 'Templates') as HTMLButtonElement).title)
        .toBe('Open and manage reusable message templates');
  
      const menuToggle = document.querySelector('.workspace-page-publish-menu-toggle') as HTMLButtonElement;
      expect(menuToggle).not.toBeNull();
      expect(menuToggle.title).toBe('Choose Send now, Schedule, or Save draft');
  
      await act(async () => {
        menuToggle.click();
      });
  
      const draftMenuItem = Array.from(document.querySelectorAll('.workspace-page-publish-option'))
        .find((button) => button.textContent?.trim() === 'Save draft');
  
      expect(draftMenuItem).not.toBeNull();
  
      await act(async () => {
        (draftMenuItem as HTMLButtonElement).click();
      });
  
      const draftColorPicker = document.querySelector('.workspace-page-draft-footer .draft-color-picker');
      expect(draftColorPicker).not.toBeNull();
      const greenDraftColor = draftColorPicker?.querySelector('[aria-label="Green draft color"]') as HTMLButtonElement;
      await act(async () => {
        greenDraftColor.click();
      });
      expect(draftColorPicker?.parentElement?.firstElementChild?.textContent).toBe('Green');
  
      await act(async () => {
        (document.querySelector('.workspace-page-publish-main') as HTMLButtonElement).click();
      });
  
      expect(workspaceTestState.inMemoryDraftStore.savedDrafts[0]).toMatchObject({
        body: 'Hello world',
        color: 'green',
        entities: [],
        attachments: [],
        selectedChat: { id: chatA.id, name: chatA.name },
        date: '2026-01-10',
        time: '09:00',
        repeatMode: 'none',
      });
      expect(document.querySelector('.workspace-page-publish-transient-feedback.is-success')?.textContent).toBe('Draft saved.');
      expect(document.querySelector('.workspace-page-publish-main')).toHaveTextContent(/save draft/i);
      expect(document.querySelector('.workspace-page-publish-main')).not.toBeDisabled();
      expect(document.querySelector('.workspace-page-draft-meta')).toBeNull();
      expect(document.body.textContent).not.toContain('Draft not saved');
  
      const activeActionGroup = document.querySelector('.workspace-page-action-left-group');
      const actionButtons = Array.from(activeActionGroup?.querySelectorAll(':scope > button') ?? []);
      const draftToggle = actionButtons.find((button) => button.textContent?.trim() === 'Draft');
      const templatesButtonIndex = actionButtons.findIndex((button) => button.textContent?.trim() === 'Templates');
  
      expect(draftToggle).not.toBeNull();
      expect(templatesButtonIndex).toBeGreaterThanOrEqual(0);
      expect(actionButtons.indexOf(draftToggle as HTMLButtonElement)).toBe(templatesButtonIndex + 1);
      expect(draftToggle?.classList.contains('workspace-page-mode-button-template')).toBe(true);
      expect(draftToggle?.classList.contains('workspace-page-mode-button-draft')).toBe(true);
      const draftHoverRule = workspacePageStyles.match(/\.workspace-page-action-left-group \.workspace-page-mode-button-template\.workspace-page-mode-button-draft:hover[^{}]*\{([^}]*)\}/)?.[1] ?? '';
      expect(draftHoverRule).toMatch(/flex:\s*0 0 auto\s*!important/);
      const modeButtonHoverRule = workspacePageStyles.match(/\.workspace-page-action-left-group \.workspace-page-mode-button-template:hover,[\s\S]*?\.workspace-page-mode-button-history\.is-active\s*\{([^}]*)\}/)?.[1] ?? '';
      expect(modeButtonHoverRule).toMatch(/padding:\s*0 10px\s*!important/);
      expect(draftToggle?.classList.contains('is-active')).toBe(false);
      expect(draftToggle?.getAttribute('aria-pressed')).toBe('false');
      expect(draftToggle?.classList.contains('workspace-page-schedule-compact-button')).toBe(false);
      expect((draftToggle as HTMLButtonElement | undefined)?.title).toBe('Open saved drafts');
  
      await act(async () => {
        (draftToggle as HTMLButtonElement).click();
      });
  
      expect(document.querySelector('.workspace-page-rich-text-draft-stage.is-active strong')?.textContent).toBe('Saved drafts');
    expect(draftToggle?.classList.contains('is-active')).toBe(true);
    expect(draftToggle?.getAttribute('aria-pressed')).toBe('true');
      expect(document.querySelector('.workspace-page-rich-text-draft-stage .workspace-page-template-stage-item strong')?.textContent).toMatch(/^Draft /);

    const coralFilter = screen.getByRole('button', { name: 'Coral draft color' });
    await act(async () => coralFilter.click());
    expect(document.querySelectorAll('.workspace-page-rich-text-draft-stage .workspace-page-template-stage-item')).toHaveLength(0);

    await act(async () => {
      (draftToggle as HTMLButtonElement).click();
    });

    expect(draftToggle?.getAttribute('aria-pressed')).toBe('false');
    expect(document.querySelector('.workspace-page-rich-text-draft-stage.is-active')).toBeNull();

    await act(async () => {
      (draftToggle as HTMLButtonElement).click();
    });

    expect(draftToggle?.getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: 'Coral draft color' })).toHaveAttribute('aria-pressed', 'true');
    expect(document.querySelectorAll('.workspace-page-rich-text-draft-stage .workspace-page-template-stage-item')).toHaveLength(0);

    unmount();
    });

    it('preserves the selected draft color when re-entering Studio drafts and after remounting', async () => {
      const clickDraftToggle = async () => {
        const draftToggle = Array.from(document.querySelectorAll<HTMLButtonElement>('.workspace-page-action-left-group > button'))
          .find((button) => button.textContent?.trim() === 'Draft');
        expect(draftToggle).toBeTruthy();
        await act(async () => draftToggle!.click());
      };

      const firstMount = await renderWorkspacePage();
      await clickDraftToggle();

      const coralFilter = screen.getByRole('button', { name: 'Coral draft color' });
      await act(async () => coralFilter.click());
      expect(coralFilter).toHaveAttribute('aria-pressed', 'true');
      expect(localStorage.getItem('xmsgi_studio_draft_color_filter')).toBe('coral');

      await clickDraftToggle();
      await clickDraftToggle();
      expect(screen.getByRole('button', { name: 'Coral draft color' })).toHaveAttribute('aria-pressed', 'true');

      firstMount.unmount();
      const secondMount = await renderWorkspacePage();
      await clickDraftToggle();
      expect(screen.getByRole('button', { name: 'Coral draft color' })).toHaveAttribute('aria-pressed', 'true');
      secondMount.unmount();
    });
  
  it('keeps legacy data untouched when file-store migration fails', async () => {
      localStorage.setItem('awaitmsg-workspace-draft', JSON.stringify({
        body: 'Draft text remains available',
        entities: [],
        attachments: [],
        savedAt: '18:00',
      }));
      const legacyWorkspace = localStorage.getItem('awaitmsg-workspace-draft');
      vi.mocked(window.draftStorage.migrate).mockResolvedValueOnce({
        success: false,
        code: 'WRITE_FAILED',
        error: 'Disk unavailable',
      });
  
      const { unmount } = await renderWorkspacePage();
  
      expect(localStorage.getItem('awaitmsg-workspace-draft')).toBe(legacyWorkspace);
      expect(document.querySelector('[role="alert"]')?.textContent).toContain('Disk unavailable');
  
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
      });
  
      expect(document.querySelector('.workspace-page-publish-transient-feedback.is-warning')?.textContent).toContain('Disk unavailable');
      unmount();
    });
  
  it('provides import choices and draft export together in the centered footer', async () => {
      const { unmount } = await renderWorkspacePage();
      await openDraftsStage();
      const footer = document.querySelector('.workspace-page-draft-stage-footer');
      const exportButton = Array.from(footer?.querySelectorAll('button') ?? [])
        .find((button) => button.getAttribute('aria-label') === 'Export all drafts') as HTMLButtonElement;
      const importButton = Array.from(footer?.querySelectorAll('button') ?? [])
        .find((button) => button.getAttribute('aria-label') === 'Import') as HTMLButtonElement;
  
      expect(exportButton).toBeTruthy();
      expect(importButton).toBeTruthy();
      expect(importButton.title).toBe('Choose what to import');
      expect(footer?.querySelectorAll('.workspace-page-draft-stage-tools > button')).toHaveLength(1);
      expect(footer?.querySelector('[title="Export .txt"]')).toBeNull();
  
      vi.mocked(window.draftStorage.exportBackup).mockResolvedValueOnce({ success: true });
      await act(async () => {
        exportButton.click();
        await Promise.resolve();
      });
      expect(window.draftStorage.exportBackup).toHaveBeenCalledTimes(1);
      expect(document.querySelector('.workspace-page-publish-transient-feedback')?.textContent).toBe('Backup exported.');
  
      vi.mocked(window.draftStorage.importBackup).mockResolvedValueOnce({
        success: true,
        store: JSON.parse(JSON.stringify(workspaceTestState.inMemoryDraftStore)),
      });
      await act(async () => {
        importButton.click();
      });
      const backupOption = screen.getByRole('menuitem', { name: 'Import backup' });
      expect(screen.getByRole('menuitem', { name: 'Import .txt' })).toBeInTheDocument();
      await act(async () => {
        backupOption.click();
        await Promise.resolve();
      });
  
      expect(window.draftStorage.importBackup).toHaveBeenCalledTimes(1);
      expect(document.querySelector('.workspace-page-publish-transient-feedback')?.textContent).toBe('Drafts imported.');
      unmount();
    });
  
  it('shows a success status after saving a draft', async () => {
      workspaceTestState.inMemoryDraftStore.savedDrafts = [{
        id: 'older-draft',
        name: 'Older draft',
        body: 'Older body',
        createdAt: '2026-10-20T10:00:00.000Z',
        updatedAt: '2026-10-20T10:00:00.000Z',
      }];
      workspaceTestState.inMemoryDraftStore.migrationVersion = 1;
      const { unmount } = await renderWorkspacePage();
      await openDraftsStage();
  
      await act(async () => {
        (document.querySelector('.workspace-page-draft-stage-add') as HTMLButtonElement).click();
      });
      await act(async () => {
        fireEvent.change(screen.getByRole('textbox', { name: 'Draft name' }), { target: { value: 'Saved post' } });
        fireEvent.change(screen.getByRole('textbox', { name: 'Draft text' }), { target: { value: 'Draft body' } });
      });
      await act(async () => {
        fireEvent.submit(document.querySelector('#workspace-draft-editor-form') as HTMLFormElement);
        await Promise.resolve();
      });
  
      await waitFor(() => expect(window.draftStorage.save).toHaveBeenCalled());
      expect(workspaceTestState.inMemoryDraftStore.savedDrafts.map((draft) => draft.name)).toEqual(['Saved post', 'Older draft']);
      expect(document.querySelector('.workspace-page-publish-transient-feedback.is-success')?.textContent).toBe('Draft saved.');
      unmount();
    });
  
  it('shows a new draft immediately and restores the editor if persistence fails', async () => {
      let finishSave: (() => void) | null = null;
      const { unmount } = await renderWorkspacePage();
      await openDraftsStage();
      await act(async () => {
        (document.querySelector('.workspace-page-draft-stage-add') as HTMLButtonElement).click();
      });
      await act(async () => {
        fireEvent.change(screen.getByRole('textbox', { name: 'Draft name' }), { target: { value: 'Pending draft' } });
        fireEvent.change(screen.getByRole('textbox', { name: 'Draft text' }), { target: { value: 'Pending body' } });
      });
      const saveButton = document.querySelector('.workspace-page-draft-stage-footer button[type="submit"]') as HTMLButtonElement;
      await waitFor(() => expect(saveButton).not.toBeDisabled());
      vi.mocked(window.draftStorage.save).mockImplementationOnce(() => new Promise((resolve) => {
        finishSave = () => resolve({ success: false, code: 'WRITE_FAILED', error: 'Disk full' });
      }));
      await act(async () => {
        fireEvent.submit(document.querySelector('#workspace-draft-editor-form') as HTMLFormElement);
        await Promise.resolve();
      });
  
      await waitFor(() => expect(document.querySelector('.workspace-page-template-stage-item')).toHaveTextContent('Pending draft'));
      expect(screen.queryByRole('textbox', { name: 'Draft name' })).not.toBeInTheDocument();
      expect(document.querySelector('.workspace-page-template-stage-item')).toHaveTextContent('Pending draft');
      expect(workspaceTestState.inMemoryDraftStore.savedDrafts).toHaveLength(0);
  
      await act(async () => {
        finishSave?.();
        await Promise.resolve();
        await Promise.resolve();
      });
      await waitFor(() => expect(screen.getByRole('textbox', { name: 'Draft text' })).toHaveValue('Pending body'));
      expect(document.querySelector('.workspace-page-template-stage-item')).toBeNull();
      expect(document.querySelector('.workspace-page-publish-transient-feedback.is-warning')?.textContent).toContain('not saved');
      unmount();
    });
  
  it('does not offer inline rename for saved drafts in the quick menu', async () => {
      const savedDraft = {
        id: 'renameable-draft',
        name: 'Original name',
        body: 'Draft content stays unchanged',
        createdAt: '2026-10-20T10:00:00.000Z',
        updatedAt: '2026-10-20T10:00:00.000Z',
      };
      workspaceTestState.inMemoryDraftStore = {
        schemaVersion: 3,
        migrationVersion: 1,
        savedDrafts: [savedDraft],
        workspaceDraft: null,
      };
      const { unmount } = await renderWorkspacePage();
      const draftModeButton = Array.from(document.querySelectorAll('.workspace-page-action-left-group > button'))
        .find((button) => button.textContent?.trim() === 'Draft') as HTMLButtonElement;
      await act(async () => draftModeButton.click());
  
      expect(screen.queryByRole('button', { name: 'Rename draft “Original name”' })).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument();
      expect(screen.queryByRole('textbox', { name: 'New draft name' })).not.toBeInTheDocument();
      unmount();
    });
  
  it('keeps the selected save-draft action after saving the current post', async () => {
      workspaceTestState.inMemoryDraftStore.savedDrafts = [{
        id: 'older-draft',
        name: 'Older draft',
        body: 'Older body',
        createdAt: '2026-10-20T10:00:00.000Z',
        updatedAt: '2026-10-20T10:00:00.000Z',
      }];
      workspaceTestState.inMemoryDraftStore.migrationVersion = 1;
      workspaceTestState.inMemoryDraftStore.workspaceDraft = {
        body: 'Hello world',
        entities: [],
        attachments: [],
        savedAt: '12:00',
        date: '2026-01-10',
        time: '09:00',
        repeatMode: 'none',
        repeatDays: [],
        repeatOccurrences: 5,
      };
      const { unmount } = await renderWorkspacePage();
      vi.mocked(window.draftStorage.save).mockClear();
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
        await Promise.resolve();
      });
      await new Promise((resolve) => window.setTimeout(resolve, 400));
  
      expect(workspaceTestState.inMemoryDraftStore.savedDrafts.map((draft) => draft.body)).toEqual(['Hello world', 'Older body']);
      expect(window.draftStorage.save).toHaveBeenCalledOnce();
      expect(document.querySelector('.workspace-page-publish-transient-feedback.is-success')?.textContent).toBe('Draft saved.');
      expect(document.querySelector('.workspace-page-publish-main')).toHaveTextContent(/save draft/i);
      expect(document.querySelector('.workspace-page-publish-main')).toHaveClass('is-draft');
      expect(document.querySelector('.workspace-page-publish-main')).not.toBeDisabled();
      unmount();
    });
  
  it('shows a success status after a saved draft is deleted', async () => {
      const { unmount } = await renderWorkspacePage();
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
        await Promise.resolve();
      });
      const draftModeButton = Array.from(document.querySelectorAll('.workspace-page-action-left-group > button'))
        .find((button) => button.textContent?.trim() === 'Draft') as HTMLButtonElement;
      await act(async () => {
        draftModeButton.click();
      });
      expect(document.querySelectorAll('.workspace-page-template-stage-item')).toHaveLength(1);
  
      const deleteButton = document.querySelector('.workspace-page-rich-text-draft-stage .workspace-page-template-stage-item > div button:last-child') as HTMLButtonElement;
      await act(async () => {
        deleteButton.click();
      });
  
      const confirmation = screen.getByRole('alertdialog');
      expect(confirmation).toHaveTextContent('Delete draft');
      const saveCountBeforeDelete = vi.mocked(window.draftStorage.save).mock.calls.length;
      await act(async () => {
        fireEvent.click(within(confirmation).getByRole('button', { name: 'Remove' }));
      });
      expect(document.querySelector('.workspace-page-template-stage-item')).toBeNull();
      expect(vi.mocked(window.draftStorage.save).mock.calls.length - saveCountBeforeDelete).toBe(1);
      expect(document.querySelector('.workspace-page-publish-transient-feedback.is-success')?.textContent).toBe('Draft deleted.');
      unmount();
    });
  
  it('shows an error when deleting a saved draft cannot be persisted', async () => {
      let finishDelete: (() => void) | null = null;
      vi.mocked(window.draftStorage.save).mockImplementation(async (store) => {
        workspaceTestState.inMemoryDraftStore = JSON.parse(JSON.stringify(store));
        return { success: true, store: JSON.parse(JSON.stringify(workspaceTestState.inMemoryDraftStore)) };
      });
      const { unmount } = await renderWorkspacePage();
      await act(async () => {
        (document.querySelector('.workspace-page-publish-menu-toggle') as HTMLButtonElement).click();
      });
      const saveDraftOption = Array.from(document.querySelectorAll('.workspace-page-publish-option'))
        .find((button) => button.textContent?.trim() === 'Save draft') as HTMLButtonElement;
      await act(async () => saveDraftOption.click());
      await act(async () => {
        (document.querySelector('.workspace-page-publish-main') as HTMLButtonElement).click();
        await Promise.resolve();
        await Promise.resolve();
      });
      const draftModeButton = Array.from(document.querySelectorAll('.workspace-page-action-left-group > button'))
        .find((button) => button.textContent?.trim() === 'Draft') as HTMLButtonElement;
      await act(async () => draftModeButton.click());
      await waitFor(() => expect(document.querySelector('.workspace-page-template-stage-item')).not.toBeNull());
      const deleteButton = document.querySelector('.workspace-page-rich-text-draft-stage .workspace-page-template-stage-item > div button:last-child') as HTMLButtonElement;
  
      await act(async () => deleteButton.click());
      vi.mocked(window.draftStorage.save).mockImplementationOnce(() => new Promise((resolve) => {
        finishDelete = () => resolve({ success: false, code: 'WRITE_FAILED', error: 'Disk full' });
      }));
      await act(async () => {
        fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Remove' }));
        await Promise.resolve();
        await Promise.resolve();
      });
  
      expect(document.querySelector('.workspace-page-template-stage-item')).toBeNull();
      await act(async () => {
        finishDelete?.();
        await Promise.resolve();
        await Promise.resolve();
      });
      await waitFor(() => expect(document.querySelector('.workspace-page-template-stage-item')).not.toBeNull());
      expect(workspaceTestState.inMemoryDraftStore.savedDrafts).toHaveLength(1);
      expect(document.querySelector('.workspace-page-publish-transient-feedback')?.textContent).toContain('not saved');
      expect(document.querySelector('.workspace-page-template-stage-item')).not.toBeNull();
      unmount();
    });
  
  it('keeps the drafts stage open on the first Escape and returns to the focused editor on the second', async () => {
      const { unmount } = await renderWorkspacePage();
      await saveEditorAsDraft();
      const draftModeButton = Array.from(document.querySelectorAll('.workspace-page-action-left-group > button'))
        .find((button) => button.textContent?.trim() === 'Draft') as HTMLButtonElement;
      await act(async () => draftModeButton.click());
  
      const deleteButton = document.querySelector('.workspace-page-rich-text-draft-stage .workspace-page-template-stage-item > div button:last-child') as HTMLButtonElement;
      await act(async () => deleteButton.click());
      expect(screen.getByRole('alertdialog')).toBeInTheDocument();
  
      await act(async () => {
        fireEvent.keyDown(document, { key: 'Escape', bubbles: true });
      });
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
      expect(document.querySelector('.workspace-page-rich-text-draft-stage.is-active')).not.toBeNull();
  
      await act(async () => {
        fireEvent.keyDown(document, { key: 'Escape', bubbles: true });
      });
      expect(document.querySelector('.workspace-page-rich-text-draft-stage.is-active')).toBeNull();
      await waitFor(() => expect(screen.getByRole('textbox', { name: 'Post content' })).toHaveFocus());
      unmount();
    });
  
  it('shows a success status after a template is deleted', async () => {
      localStorage.setItem('awaitmsg_domain_templates', JSON.stringify([{
        id: 'template-1',
        accountId: 'default-account',
        name: 'Welcome',
        body: 'Hello there',
        createdAt: '2026-09-26T10:00:00.000Z',
        updatedAt: '2026-09-26T10:00:00.000Z',
      }]));
      const { unmount } = await renderWorkspacePage();
      const templatesButton = Array.from(document.querySelectorAll('.workspace-page-action-left-group > button'))
        .find((button) => button.textContent?.trim() === 'Templates') as HTMLButtonElement;
      await act(async () => {
        templatesButton.click();
      });
  
      const deleteButton = document.querySelector('.workspace-page-rich-text-template-stage .workspace-page-template-stage-item > div button:last-child') as HTMLButtonElement;
      await act(async () => deleteButton.click());
      const confirmation = screen.getByRole('alertdialog');
      expect(confirmation).toHaveTextContent('Delete template “Welcome”?');
      await act(async () => {
        fireEvent.click(within(confirmation).getByRole('button', { name: 'Remove' }));
      });
      expect(document.querySelector('.workspace-page-rich-text-template-stage .workspace-page-template-stage-item')).toBeNull();
      expect(document.querySelector('.workspace-page-publish-transient-feedback.is-success')?.textContent).toBe('Template deleted.');
      unmount();
    });
  
  it('recovers a corrupt primary template store from valid legacy data', async () => {
      const corruptedTemplates = '{damaged templates';
      localStorage.setItem('xmsgi_domain_templates', corruptedTemplates);
      localStorage.setItem('awaitmsg_domain_templates', JSON.stringify([{
        id: 'legacy-template',
        accountId: 'default-account',
        name: 'Legacy',
        body: 'Do not overwrite',
        createdAt: '2026-09-26T10:00:00.000Z',
        updatedAt: '2026-09-26T10:00:00.000Z',
      }]));
  
      const { unmount } = await renderWorkspacePage();
  
      expect(screen.queryByText('Templates could not be loaded or saved. Existing data was left unchanged.')).toBeNull();
      expect(localStorage.getItem('xmsgi_domain_templates')).not.toBe(corruptedTemplates);
      expect(localStorage.getItem('xmsgi_domain_templates')).toContain('Do not overwrite');
      expect(localStorage.getItem('xmsgi_domain_templates_backup')).toContain('Do not overwrite');
      unmount();
    });
  
  it('reports template storage write failures', async () => {
      localStorage.setItem('awaitmsg_domain_templates', JSON.stringify([{
        id: 'template-write-failure',
        accountId: 'default-account',
        name: 'Writable template',
        body: 'Template body',
        createdAt: '2026-09-26T10:00:00.000Z',
        updatedAt: '2026-09-26T10:00:00.000Z',
      }]));
      const originalSetItem = Storage.prototype.setItem;
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, key: string, value: string) {
        if (key === 'xmsgi_domain_templates') throw new Error('Storage write failed');
        return originalSetItem.call(this, key, value);
      });
  
      try {
        const { unmount } = await renderWorkspacePage();
        expect(await screen.findByText('Templates could not be loaded or saved. Existing data was left unchanged.')).toBeInTheDocument();
        unmount();
      } finally {
        vi.restoreAllMocks();
      }
    });
  
  it('seeds the built-in templates for existing users without replacing their templates', async () => {
      localStorage.removeItem('xmsgi-built-in-templates-seeded-v1');
      const existingTemplate = {
        id: 'user-template',
        accountId: 'default-account',
        name: 'My template',
        body: 'User-owned template',
        createdAt: '2026-09-26T10:00:00.000Z',
        updatedAt: '2026-09-26T10:00:00.000Z',
      };
      localStorage.setItem('xmsgi_domain_templates', JSON.stringify([existingTemplate]));
  
      const { unmount } = await renderWorkspacePage();
      const templates = JSON.parse(localStorage.getItem('xmsgi_domain_templates') ?? '[]') as Array<{ id: string; name: string; body: string }>;
  
      expect(templates.slice(0, BUILT_IN_TEMPLATES.length).map(({ name, body }) => ({ name, body }))).toEqual(BUILT_IN_TEMPLATES);
      expect(templates.some(({ id, name, body }) => id === existingTemplate.id && name === existingTemplate.name && body === existingTemplate.body)).toBe(true);
      expect(localStorage.getItem('xmsgi-built-in-templates-seeded-v1')).toBe('1');
      unmount();
    });
  
  it('shows success statuses after creating and updating a template', async () => {
      const { unmount } = await renderWorkspacePage();
      const templatesButton = Array.from(document.querySelectorAll('.workspace-page-action-left-group > button'))
        .find((button) => button.textContent?.trim() === 'Templates') as HTMLButtonElement;
      await act(async () => {
        templatesButton.click();
      });
      await act(async () => {
        screen.getByRole('button', { name: '+ New template' }).click();
      });
  
      const nameInput = document.querySelector('[aria-label="Template name"]') as HTMLInputElement;
      const bodyInput = document.querySelector('#workspace-template-editor-form textarea') as HTMLTextAreaElement;
      await act(async () => {
        const nameSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
        const bodySetter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set;
        nameSetter?.call(nameInput, 'Greeting');
        nameInput.dispatchEvent(new Event('input', { bubbles: true }));
        bodySetter?.call(bodyInput, 'Hello!');
        bodyInput.dispatchEvent(new Event('input', { bubbles: true }));
      });
      await act(async () => {
        (document.querySelector('[form="workspace-template-editor-form"]') as HTMLButtonElement).click();
      });
  
      expect(document.querySelector('.workspace-page-publish-transient-feedback.is-success')?.textContent).toBe('Template created.');
      expect(document.querySelector('.workspace-page-rich-text-template-stage .workspace-page-template-stage-item strong')?.textContent).toContain('Greeting');
      const editButton = Array.from(document.querySelectorAll('.workspace-page-rich-text-template-stage .workspace-page-template-stage-item > div button'))
        .find((button) => button.textContent?.trim() === 'Edit') as HTMLButtonElement;
      await act(async () => {
        editButton.click();
      });
      const editedNameInput = document.querySelector('[aria-label="Template name"]') as HTMLInputElement;
      await act(async () => {
        const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
        setter?.call(editedNameInput, 'Updated greeting');
        editedNameInput.dispatchEvent(new Event('input', { bubbles: true }));
      });
      await act(async () => {
        (document.querySelector('[form="workspace-template-editor-form"]') as HTMLButtonElement).click();
      });
  
      expect(document.querySelector('.workspace-page-publish-transient-feedback.is-success')?.textContent).toBe('Template updated.');
      expect(document.querySelector('.workspace-page-rich-text-template-stage .workspace-page-template-stage-item strong')?.textContent).toContain('Updated greeting');
      unmount();
    });
  
  it('imports plain text into the editor without removing attached media', async () => {
      localStorage.setItem('awaitmsg-workspace-draft', JSON.stringify({
        body: 'Old editor text',
        entities: [{ type: 'bold', offset: 0, length: 3 }],
        attachments: [{ name: 'photo.png', path: '/managed/photo.png', size: 5 }],
        savedAt: '12:00',
        date: '2026-01-10',
        time: '09:00',
        repeatMode: 'none',
        repeatDays: [],
        repeatOccurrences: 1,
      }));
      vi.mocked(window.draftStorage.importText).mockResolvedValueOnce({ success: true, text: 'Imported plain text' });
      const { unmount } = await renderWorkspacePage();
      await openDraftsStage();
      const importButton = document.querySelector('.workspace-page-rich-text-draft-stage [aria-label="Import"]') as HTMLButtonElement;
  
      await act(async () => {
        importButton.click();
      });
      await act(async () => {
        screen.getByRole('menuitem', { name: 'Import .txt' }).click();
        await Promise.resolve();
      });
      const replaceConfirmation = screen.getByRole('alertdialog');
      await act(async () => {
        fireEvent.click(within(replaceConfirmation).getByRole('button', { name: 'Apply' }));
      });
  
      expect(document.querySelector('.workspace-page-rich-text-draft-stage.is-active')).toBeNull();
      expect((document.querySelector('[role="textbox"]') as HTMLDivElement).textContent).toContain('Imported plain text');
      expect(document.querySelector('.workspace-page-attachment-name')?.textContent).toBe('photo.png');
      expect(document.querySelector('.workspace-page-publish-transient-feedback')?.textContent).toBe('Text imported into the editor.');
      unmount();
    });
  
  it('duplicates text import failures in the shared footer status', async () => {
      vi.mocked(window.draftStorage.importText).mockResolvedValueOnce({
        success: false,
        cancelled: false,
        error: 'Text file is not valid UTF-8.',
      });
      const { unmount } = await renderWorkspacePage();
      await openDraftsStage();
  
      await act(async () => {
        (document.querySelector('[aria-label="Import"]') as HTMLButtonElement).click();
      });
      await act(async () => {
        screen.getByRole('menuitem', { name: 'Import .txt' }).click();
        await Promise.resolve();
      });
  
      expect(document.querySelector('.workspace-page-send-feedback[role="alert"]')).toBeNull();
      expect(document.querySelector('.workspace-page-publish-transient-feedback.is-error')?.textContent).toContain('Text file is not valid UTF-8.');
      unmount();
    });
  
  it('keeps the toolbar visible with connected editor formatting controls', async () => {
      const { unmount } = await renderWorkspacePage();
      const toolbar = document.querySelector('.workspace-page-rich-text-toolbar');
      const editingControls = Array.from(toolbar!.querySelectorAll<HTMLButtonElement>(
        '.workspace-page-rich-text-toolbar-actions .workspace-page-rich-text-format-option, .workspace-page-rich-text-toolbar-actions .workspace-page-rich-text-album-trigger, .workspace-page-rich-text-toolbar-actions .workspace-page-rich-text-link-trigger:not(.workspace-page-version-history-trigger):not(.workspace-page-rich-text-album-trigger)',
      ));
      const historyTrigger = toolbar!.querySelector<HTMLButtonElement>('.workspace-page-version-history-trigger');
      const exportTrigger = toolbar!.querySelector<HTMLButtonElement>('.workspace-page-editor-export-trigger');
      const editorMeta = document.querySelector('.workspace-page-rich-text-meta-row');
  
      expect(toolbar).not.toBeNull();
      expect(editorMeta).not.toBeNull();
      expect(editorMeta?.querySelector('.workspace-page-character-count')).not.toBeNull();
      expect(toolbar!.querySelector('.workspace-page-character-count')).toBeNull();
      const characterCount = editorMeta?.querySelector('.workspace-page-character-count');
      const eraser = editorMeta?.querySelector('.workspace-page-rich-text-clear');
      expect(eraser).not.toBeNull();
      expect(characterCount?.nextElementSibling).toBe(eraser);
      expect(toolbar!.querySelector('.workspace-page-rich-text-clear')).toBeNull();
      expect(editingControls).toHaveLength(6);
      expect(toolbar!.querySelector('.workspace-page-rich-text-format-clear')).toBeNull();
      expect(editingControls.every((button) => !button.disabled)).toBe(true);
      expect(historyTrigger).not.toBeNull();
      expect(historyTrigger?.disabled).toBe(false);
      expect(exportTrigger).not.toBeNull();
      expect(exportTrigger?.disabled).toBe(false);
      const activeEditorInput = document.querySelector('.workspace-page-rich-text-input.is-active');
      expect(activeEditorInput?.getAttribute('contenteditable')).toBe('true');
      expect(activeEditorInput?.parentElement?.classList.contains('workspace-page-rich-text-stage')).toBe(true);
      unmount();
    });
  
  it('keeps the link toolbar button in place and closes its popover on a second click', async () => {
      expect(workspacePageStyles).toMatch(/\.workspace-page-rich-text-link-controls\.is-open\s*\{\s*display:\s*block;\s*flex:\s*0 0 32px;\s*width:\s*32px;\s*height:\s*32px;/);
      expect(workspacePageStyles).toMatch(/\.workspace-page-rich-text-link-controls \.workspace-page-rich-text-link-popover\s*\{[^}]*position:\s*absolute;[^}]*top:\s*calc\(100% \+ 8px\);/);
      expect(workspacePageStyles).not.toMatch(/\.workspace-page-rich-text-link-controls \.workspace-page-rich-text-link-popover\s*\{[^}]*position:\s*static;/);
      expect(workspacePageStyles).toMatch(/\.workspace-page-rich-text-link-popover\s*\{[^}]*position:\s*absolute !important;[^}]*top:\s*calc\(100% \+ 8px\) !important;[^}]*bottom:\s*auto !important;/);
      expect(workspacePageStyles).toMatch(/\.workspace-page-rich-text-tool-popover\s*\{[^}]*top:\s*calc\(100% \+ 8px\);/);
      expect(workspacePageStyles).toMatch(/\.workspace-page-editor-export-menu\s*\{[^}]*top:\s*calc\(100% \+ 8px\);/);
      expect(workspacePageStyles).toMatch(/\.workspace-page-draft-import-menu\s*\{[^}]*top:\s*auto;[^}]*bottom:\s*calc\(100% \+ 8px\);/);
      expect(workspacePageStyles).toMatch(
        /@media \(max-width: 1100px\)[\s\S]*?html\.electron-runtime \.workspace-page \.workspace-page-rich-text-toolbar\.is-airy button:not\(\.workspace-page-editor-export-option\),\s*html\.electron-runtime \.workspace-page \.workspace-page-rich-text-toolbar\.is-airy \.workspace-page-rich-text-tool-icon-trigger\s*\{\s*width:\s*32px;\s*min-width:\s*32px;\s*height:\s*32px;\s*min-height:\s*32px;/,
      );
      const { unmount } = await renderWorkspacePage();
      const editor = document.querySelector('.workspace-page-rich-text-editor')!;
      const linkButton = document.querySelector<HTMLButtonElement>('.workspace-page-rich-text-link-controls > button')!;
      const wasToolbarActive = editor.classList.contains('is-toolbar-active');
  
      await act(async () => {
        linkButton.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
        linkButton.click();
      });
      expect(editor.classList.contains('is-toolbar-active')).toBe(wasToolbarActive);
      expect(linkButton).toHaveAttribute('aria-expanded', 'true');
      expect(document.querySelector('[role="dialog"][aria-label="Insert link"]')).not.toBeNull();
  
      await act(async () => {
        linkButton.click();
      });
      expect(linkButton).toHaveAttribute('aria-expanded', 'false');
      expect(document.querySelector('[role="dialog"][aria-label="Insert link"]')).toBeNull();
      unmount();
    });
  
  it('opens the image-only multi-select picker from the photo album toolbar button', async () => {
      const { unmount } = await renderWorkspacePage();
      const albumInput = document.querySelector<HTMLInputElement>('input[accept*="image/png"][multiple]');
      const click = vi.spyOn(albumInput!, 'click');
  
      act(() => {
        (document.querySelector('[aria-label="Add photo album"]') as HTMLButtonElement).click();
      });
  
      expect(albumInput).not.toBeNull();
      expect(click).toHaveBeenCalledOnce();
      unmount();
    });
});
