import { act } from 'react';
import { fireEvent, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { templateA, savedDraftA, renderStage } from './WorkspaceTextStage.testUtils';

describe("WorkspaceTextStage templates and drafts", () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    window.localStorage.clear();
  });

  it('inserts the selected template and returns to editor mode', () => {
      const onModeChange = vi.fn();
      const onInsertTemplate = vi.fn();
      const { unmount } = renderStage({
        mode: 'template',
        onModeChange,
        onInsertTemplate,
        templates: [templateA],
      });
  
      const templateButton = Array.from(document.querySelectorAll('button')).find((button) =>
        button.textContent?.includes('Welcome')
      );
  
      expect(templateButton).toBeTruthy();
  
      act(() => {
        templateButton!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      });
  
      expect(onInsertTemplate).toHaveBeenCalledWith(templateA.body);
      expect(onModeChange).toHaveBeenCalledWith('editor');
      unmount();
    })
  it('searches templates by name and body and shows an empty search state', () => {
      const secondTemplate = { ...templateA, id: 'tpl-2', name: 'Announcement', body: 'Team update for Monday' };
      const { unmount } = renderStage({
        mode: 'template',
        templates: [templateA, secondTemplate],
      });
  
      const searchInput = screen.getByRole('searchbox', { name: 'Search templates' });
      expect(searchInput.closest('.workspace-page-template-stage-header')).not.toBeNull();
      fireEvent.change(searchInput, { target: { value: '  TEAM UPDATE  ' } });
      const templateStage = document.querySelector('.workspace-page-rich-text-template-stage:not(.workspace-page-rich-text-draft-stage)');
      expect(templateStage?.querySelectorAll('.workspace-page-template-stage-item')).toHaveLength(1);
      expect(templateStage?.querySelector('.workspace-page-template-stage-item strong')?.textContent).toBe('Announcement');
  
      fireEvent.change(searchInput, { target: { value: 'missing phrase' } });
      expect(templateStage?.querySelector('.workspace-page-template-stage-empty')?.textContent).toBe('No matching templates.');
  
      unmount();
    })
  it('shows template character counts beside the name in the compact draft-style row', () => {
      const { unmount } = renderStage({ mode: 'template', templates: [templateA] });
      const templateStage = document.querySelector('.workspace-page-rich-text-template-stage:not(.workspace-page-rich-text-draft-stage)');
      const templateButton = templateStage?.querySelector('.workspace-page-template-stage-item > button:first-child');
  
      expect(templateButton?.querySelector('strong')?.textContent).toBe('Welcome');
      expect(templateButton?.querySelector('.workspace-page-template-row-summary')?.textContent).toBe('19 characters');
      expect(templateButton?.querySelector('.workspace-page-template-row-summary')?.previousElementSibling?.tagName).toBe('STRONG');
  
      unmount();
    })
  it('exposes template backup import and export actions', () => {
      const onExportTemplates = vi.fn();
      const onImportTemplates = vi.fn();
      const { unmount } = renderStage({
        mode: 'template',
        onExportTemplates,
        onImportTemplates,
      });
  
      fireEvent.click(screen.getByRole('button', { name: 'Export' }));
      const backupFile = new File(['backup'], 'templates.json', { type: 'application/json' });
      fireEvent.change(document.querySelector<HTMLInputElement>('input[type="file"][aria-label*="Import"]')!, {
        target: { files: [backupFile] },
      });
  
      expect(onExportTemplates).toHaveBeenCalledOnce();
      expect(onImportTemplates).toHaveBeenCalledWith(backupFile);
  
      unmount();
    })
  it('opens the template editor and saves a new template from the stage form', () => {
      const setTemplateDraftName = vi.fn();
      const setTemplateDraftBody = vi.fn();
      const saveTemplateStage = vi.fn();
      const openTemplateEditor = vi.fn();
  
      const { unmount } = renderStage({
        mode: 'template',
        templateEditingId: 'new',
        templateDraftName: 'Meeting note',
        templateDraftBody: 'Body text',
        setTemplateDraftName,
        setTemplateDraftBody,
        saveTemplateStage,
        openTemplateEditor,
      });
  
      const templateEditor = document.querySelector('.workspace-page-template-stage-editor') as HTMLFormElement;
      const nameInput = templateEditor.querySelector('input') as HTMLInputElement;
      const bodyInput = templateEditor.querySelector('textarea') as HTMLTextAreaElement;
      const saveButton = document.querySelector('[form="workspace-template-editor-form"]') as HTMLButtonElement;
  
      expect(nameInput).toBeTruthy();
      expect(bodyInput).toBeTruthy();
      expect(document.querySelector('.workspace-page-template-header-info strong')?.textContent).toBe('New template');
      expect(nameInput.value).toBe('Meeting note');
      expect(bodyInput.value).toBe('Body text');
  
      act(() => {
        saveButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      });
  
      expect(saveTemplateStage).toHaveBeenCalledTimes(1);
      unmount();
    })
  it('keeps template Save enabled and focuses the name field when the name is missing', () => {
      const saveTemplateStage = vi.fn();
      const { unmount } = renderStage({
        mode: 'template',
        templateEditingId: 'new',
        templateDraftName: '',
        templateDraftBody: 'Body text',
        saveTemplateStage,
      });
  
      const nameInput = screen.getByRole('textbox', { name: 'Template name' }) as HTMLInputElement;
      const scrollIntoView = vi.fn();
      nameInput.scrollIntoView = scrollIntoView;
      const saveButton = screen.getByRole('button', { name: 'Save' }) as HTMLButtonElement;
  
      expect(saveButton).toBeEnabled();
      act(() => saveButton.click());
  
      expect(scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'center' });
      expect(nameInput).toHaveFocus();
      expect(saveTemplateStage).not.toHaveBeenCalled();
      unmount();
    })
  it('shows saved drafts in the template-style list and loads the selected draft', () => {
      const onInsertDraft = vi.fn();
      const { unmount } = renderStage({ mode: 'draft', onInsertDraft, savedDrafts: [savedDraftA] });
  
      const draftView = document.querySelector('.workspace-page-rich-text-draft-stage.is-active');
      const savedDraftButton = Array.from(draftView?.querySelectorAll('button') ?? []).find((button) => button.textContent?.includes('Follow-up'));
  
      expect(draftView?.classList.contains('workspace-page-rich-text-template-stage')).toBe(true);
      expect(draftView?.querySelector('header strong')?.textContent).toBe('Saved drafts');
      expect(draftView?.querySelector('.workspace-page-draft-header-info > span')?.textContent).toBe('1 saved');
      expect(savedDraftButton).toBeTruthy();
      expect(savedDraftButton?.querySelector('.workspace-page-draft-color-dot')?.getAttribute('data-color')).toBe('gray');
      expect(savedDraftButton?.querySelector('.workspace-page-draft-color-indicator')?.getAttribute('data-color-label')).toBe('Gray');
  
      act(() => {
        savedDraftButton!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      });
  
      expect(onInsertDraft).toHaveBeenCalledWith(savedDraftA);
      unmount();
    })
  it('shows all draft color filters with zero counts when there are no saved drafts', () => {
      window.localStorage.removeItem('xmsgi_saved_draft_color_filter');
      const { unmount } = renderStage({ mode: 'draft', savedDrafts: [] });
      const draftView = document.querySelector('.workspace-page-rich-text-draft-stage.is-active')!;
      const filterGroup = draftView.querySelector('.workspace-page-draft-color-filters');
  
      expect(filterGroup?.parentElement).toBe(draftView.querySelector('.workspace-page-stage-header'));
      for (const color of ['Gray', 'Coral', 'Amber', 'Green', 'Teal', 'Blue']) {
        expect(screen.getByRole('button', { name: `${color} draft color` })).toHaveTextContent('0');
      }
      expect(draftView.querySelector('.workspace-page-template-stage-empty')).toBeInTheDocument();
  
      unmount();
    })
  it('uses the editor export menu appearance for draft import options', () => {
      const onImportEditorText = vi.fn();
      const onImportDrafts = vi.fn();
      const { unmount } = renderStage({ mode: 'draft', onImportEditorText, onImportDrafts });
  
      act(() => screen.getByRole('button', { name: 'Import' }).click());
  
      const menu = screen.getByRole('menu', { name: 'Choose what to import' });
      const options = menu.querySelectorAll<HTMLButtonElement>('[role="menuitem"]');
      expect(menu).toHaveClass('workspace-page-editor-export-menu', 'workspace-page-draft-import-menu');
      expect(menu).not.toHaveClass('workspace-page-publish-menu-compact');
      expect(options).toHaveLength(2);
      expect(options[0]).toHaveClass('workspace-page-editor-export-option');
      expect(options[1]).toHaveClass('workspace-page-editor-export-option');
  
      act(() => options[0]!.click());
      expect(onImportEditorText).toHaveBeenCalledOnce();
      expect(onImportDrafts).not.toHaveBeenCalled();
  
      unmount();
    })
  it('hides the saved-on-device label in Russian draft headers', () => {
      window.localStorage.setItem('awaitmsg_locale', 'ru');
      const { unmount } = renderStage({ mode: 'draft', savedDrafts: [savedDraftA], draftStoreReady: true, draftStoreSaving: false });
      const status = document.querySelector('.workspace-page-draft-header-info span');
  
      expect(status?.textContent).toContain('Сохранено: 1');
      expect(status?.textContent).not.toContain('Сохранено на устройстве');
      unmount();
    })
  it('filters drafts by color and restores the full list when the selected color is pressed again', () => {
      const savedDrafts = [
        { ...savedDraftA, id: 'gray-draft', name: 'Gray draft', color: 'gray' as const },
        { ...savedDraftA, id: 'coral-draft', name: 'Coral draft', color: 'coral' as const },
        { ...savedDraftA, id: 'blue-draft', name: 'Blue draft', color: 'blue' as const },
      ];
      window.localStorage.setItem('xmsgi_saved_draft_color_filter', 'coral');
      const { unmount } = renderStage({ mode: 'draft', savedDrafts });
      const draftView = document.querySelector('.workspace-page-rich-text-draft-stage.is-active')!;
      const getRows = () => draftView.querySelectorAll('.workspace-page-template-stage-item');
      const filterGroup = draftView.querySelector('.workspace-page-draft-color-filters')!;
      const coralFilter = screen.getByRole('button', { name: 'Coral draft color' });
  
      expect(filterGroup.parentElement).toBe(draftView.querySelector('.workspace-page-stage-header'));
      expect(draftView.querySelector('.workspace-page-draft-list-area .workspace-page-draft-color-filters')).toBeNull();
      expect(draftView.querySelector('.workspace-page-draft-selected-color')).toBeNull();
      expect(getRows()).toHaveLength(3);
      expect(screen.getByRole('button', { name: 'Gray draft color' })).toHaveTextContent('1');
      expect(coralFilter).toHaveTextContent('1');
      expect(screen.getByRole('button', { name: 'Blue draft color' })).toHaveTextContent('1');
  
      const emptyColorFilter = screen.getByRole('button', { name: 'Green draft color' });
      expect(emptyColorFilter).toBeEnabled();
      act(() => emptyColorFilter.click());
      expect(emptyColorFilter).toHaveAttribute('aria-pressed', 'true');
      expect(draftView.querySelector('.workspace-page-draft-selected-color')).toHaveTextContent('Green');
      expect(getRows()).toHaveLength(0);
      act(() => emptyColorFilter.click());
      expect(emptyColorFilter).toHaveAttribute('aria-pressed', 'false');
      expect(getRows()).toHaveLength(3);
  
      act(() => fireEvent.mouseEnter(coralFilter));
      expect(draftView.querySelector('.workspace-page-draft-selected-color')).toHaveTextContent('Coral');
      expect(draftView.querySelector('.workspace-page-draft-selected-color')).toHaveAttribute('data-color', 'coral');
      act(() => fireEvent.mouseLeave(coralFilter));
      expect(draftView.querySelector('.workspace-page-draft-selected-color')).toBeNull();
  
      act(() => coralFilter.click());
      expect(getRows()).toHaveLength(1);
      expect(getRows()[0]?.querySelector('.workspace-page-draft-name')?.textContent).toBe('Coral draft');
      expect(coralFilter).toHaveAttribute('aria-pressed', 'true');
      expect(draftView.querySelector('.workspace-page-draft-selected-color')).toHaveTextContent('Coral');
      expect(window.localStorage.getItem('xmsgi_saved_draft_color_filter')).toBe('coral');
  
      const blueFilter = screen.getByRole('button', { name: 'Blue draft color' });
      act(() => fireEvent.mouseEnter(blueFilter));
      expect(draftView.querySelector('.workspace-page-draft-selected-color')).toHaveTextContent('Blue');
      expect(draftView.querySelector('.workspace-page-draft-selected-color')).toHaveAttribute('data-color', 'blue');
      act(() => fireEvent.mouseLeave(blueFilter));
      expect(draftView.querySelector('.workspace-page-draft-selected-color')).toHaveTextContent('Coral');
      expect(draftView.querySelector('.workspace-page-draft-selected-color')).toHaveAttribute('data-color', 'coral');
  
      act(() => coralFilter.click());
      expect(coralFilter).toHaveAttribute('aria-pressed', 'false');
      expect(getRows()).toHaveLength(3);
      unmount();
    })
  it('keeps the attachment count beside the draft name and the character count on the right', () => {
      const draftWithOneAttachment = {
        ...savedDraftA,
        id: 'draft-one-attachment',
        name: 'One attachment',
        attachments: [{ id: 'photo', type: 'image' as const, name: 'photo.png', mimeType: 'image/png', path: '/tmp/photo.png', size: 1234, position: 0 }],
      };
      const draftWithTwoAttachments = {
        ...savedDraftA,
        id: 'draft-2',
        name: 'Two attachments',
        attachments: [
          { id: 'photo', type: 'image' as const, name: 'photo.png', mimeType: 'image/png', path: '/tmp/photo.png', size: 1234, position: 0 },
          { id: 'brief', type: 'file' as const, name: 'brief.pdf', mimeType: 'application/pdf', path: '/tmp/brief.pdf', size: 4567, position: 0 },
        ],
      };
  
      const { unmount } = renderStage({ mode: 'draft', savedDrafts: [savedDraftA, draftWithOneAttachment, draftWithTwoAttachments] });
  
      const draftView = document.querySelector('.workspace-page-rich-text-draft-stage.is-active');
      const getDraftButton = (name: string) => Array.from(draftView?.querySelectorAll('button') ?? []).find((button) => button.textContent?.includes(name));
  
      expect(getDraftButton('Follow-up')?.textContent).toContain('19 characters');
      expect(getDraftButton('Follow-up')?.textContent).not.toContain('attachment');
      const oneAttachmentButton = getDraftButton('One attachment');
      const twoAttachmentsButton = getDraftButton('Two attachments');
      expect(oneAttachmentButton?.textContent).toContain('One attachment1 attachment');
      expect(oneAttachmentButton?.textContent).toContain('19 characters');
      expect(twoAttachmentsButton?.textContent).toContain('Two attachments2 attachments');
      expect(twoAttachmentsButton?.textContent).toContain('19 characters');
      expect(oneAttachmentButton?.querySelector('.workspace-page-draft-name')?.nextElementSibling?.classList.contains('workspace-page-draft-attachment-summary')).toBe(true);
      expect(oneAttachmentButton?.querySelector('.workspace-page-draft-row-summary')?.textContent).toBe('19 characters');
      unmount();
    })
  it('does not show inline rename controls for saved drafts', () => {
      const { unmount } = renderStage({ mode: 'draft' });
  
      expect(screen.queryByRole('button', { name: /Rename draft/ })).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument();
      expect(screen.queryByRole('textbox', { name: 'New draft name' })).not.toBeInTheDocument();
      unmount();
    })
  it('renders a draft editor with the template-style fields and save action', () => {
      const saveDraftStage = vi.fn();
      const { unmount } = renderStage({
        mode: 'draft',
        draftEditingId: 'new',
        draftColor: 'coral',
        draftName: 'New note',
        draftBodyText: 'Draft body',
        saveDraftStage,
      });
  
      const draftEditor = document.querySelector('#workspace-draft-editor-form') as HTMLFormElement;
      expect(document.querySelector('.workspace-page-draft-header-info strong')?.textContent).toBe('New draft');
      expect((draftEditor.querySelector('[aria-label="Draft name"]') as HTMLInputElement).value).toBe('New note');
      expect((draftEditor.querySelector('[aria-label="Draft text"]') as HTMLTextAreaElement).value).toBe('Draft body');
      expect(draftEditor.querySelector('[aria-label="Coral draft color"]')?.getAttribute('aria-checked')).toBe('true');
      expect(draftEditor.querySelector('.draft-color-selected-label')?.getAttribute('data-color')).toBe('coral');
  
      act(() => {
        (document.querySelector('[form="workspace-draft-editor-form"]') as HTMLButtonElement).click();
      });
  
      expect(saveDraftStage).toHaveBeenCalledTimes(1);
      unmount();
    })
  it('previews the hovered draft color name and restores the selected color name', () => {
      const { unmount } = renderStage({
        mode: 'draft',
        draftEditingId: 'new',
        draftColor: 'coral',
      });
      const colorLabel = document.querySelector('.draft-color-selected-label');
      const blueSwatch = screen.getByRole('radio', { name: 'Blue draft color' });
  
      expect(colorLabel).toHaveTextContent('Coral');
      fireEvent.mouseEnter(blueSwatch);
      expect(colorLabel).toHaveTextContent('Blue');
      expect(colorLabel).toHaveAttribute('data-color', 'blue');
  
      fireEvent.mouseLeave(blueSwatch);
      expect(colorLabel).toHaveTextContent('Coral');
      expect(colorLabel).toHaveAttribute('data-color', 'coral');
      unmount();
    })
  it('keeps draft Save enabled when fields are missing and flashes the first missing field', () => {
      const saveDraftStage = vi.fn();
      vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
        callback(0);
        return 0;
      });
      const { unmount } = renderStage({
        mode: 'draft',
        draftEditingId: 'new',
        draftName: '',
        draftBodyText: 'Draft body',
        saveDraftStage,
      });
  
      const nameInput = screen.getByRole('textbox', { name: 'Draft name' }) as HTMLInputElement;
      const scrollIntoView = vi.fn();
      nameInput.scrollIntoView = scrollIntoView;
      const saveButton = screen.getByRole('button', { name: 'Save' }) as HTMLButtonElement;
  
      expect(saveButton).toBeEnabled();
      act(() => saveButton.click());
  
      expect(scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'center' });
      expect(nameInput).toHaveFocus();
      expect(nameInput.closest('label')).toHaveClass('workspace-page-draft-field-attention');
      expect(saveDraftStage).not.toHaveBeenCalled();
      unmount();
      vi.restoreAllMocks();
    })
  it('focuses and flashes the draft text field when its content is missing', () => {
      const saveDraftStage = vi.fn();
      vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
        callback(0);
        return 0;
      });
      const { unmount } = renderStage({
        mode: 'draft',
        draftEditingId: 'new',
        draftName: 'New note',
        draftBodyText: '',
        saveDraftStage,
      });
  
      const bodyInput = screen.getByRole('textbox', { name: 'Draft text' }) as HTMLTextAreaElement;
      const scrollIntoView = vi.fn();
      bodyInput.scrollIntoView = scrollIntoView;
      const saveButton = screen.getByRole('button', { name: 'Save' }) as HTMLButtonElement;
  
      expect(saveButton).toBeEnabled();
      act(() => saveButton.click());
  
      expect(scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'center' });
      expect(bodyInput).toHaveFocus();
      expect(bodyInput.closest('label')).toHaveClass('workspace-page-draft-field-attention');
      expect(saveDraftStage).not.toHaveBeenCalled();
      unmount();
      vi.restoreAllMocks();
    })
});
