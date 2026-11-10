import { act } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EDITOR_APPEARANCE_STORAGE_KEY, writeEditorAppearancePreferences } from '@shared/editorAppearance';
import { hasDraftContent, normalizeAttachments, remapAttachmentPositions } from './WorkspacePageExports';
import { workspacePageStyles, colorThemeStyles, renderWorkspacePage, resetWorkspacePageTestEnvironment } from './WorkspacePage.testUtils';

describe('WorkspacePage editor and drafts', () => {
  beforeEach(resetWorkspacePageTestEnvironment);

  it('activates the editor highlight from buttons and preserves it in other windows', async () => {
      const { unmount } = await renderWorkspacePage();
      const editor = document.querySelector<HTMLElement>('[aria-label="Post content"]')!;
      const editorShell = editor.closest('.workspace-page-rich-text-editor')!;
  
      expect(editorShell.classList.contains('is-toolbar-active')).toBe(false);
      const menuToggle = document.querySelector<HTMLButtonElement>('.workspace-page-publish-menu-toggle')!;
      const historyScrollArea = document.createElement('div');
      historyScrollArea.className = 'history-record-list';
      historyScrollArea.style.overflowY = 'auto';
      Object.defineProperties(historyScrollArea, {
        scrollHeight: { configurable: true, value: 300 },
        clientHeight: { configurable: true, value: 100 },
      });
      document.body.appendChild(historyScrollArea);
      await act(async () => {
        historyScrollArea.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
      });
      expect(editorShell.classList.contains('is-toolbar-active')).toBe(false);
  
      await act(async () => menuToggle.click());
      expect(editorShell.classList.contains('is-toolbar-active')).toBe(true);
      await act(async () => menuToggle.click());
      expect(editorShell.classList.contains('is-toolbar-active')).toBe(true);
  
      await act(async () => editor.focus());
      expect(editorShell.classList.contains('is-toolbar-active')).toBe(true);
  
      await act(async () => menuToggle.click());
      expect(editorShell.classList.contains('is-toolbar-active')).toBe(true);
  
      const scheduleOption = Array.from(document.querySelectorAll('.workspace-page-publish-option'))
        .find((button) => button.textContent?.trim() === 'Schedule') as HTMLButtonElement;
      await act(async () => scheduleOption.click());
      expect(editorShell.classList.contains('is-toolbar-active')).toBe(true);
  
      await act(async () => {
        historyScrollArea.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
      });
      expect(editorShell.classList.contains('is-toolbar-active')).toBe(true);
  
      await act(async () => {
        document.body.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
      });
      expect(editorShell.classList.contains('is-toolbar-active')).toBe(false);
      await act(async () => {
        historyScrollArea.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
      });
      expect(editorShell.classList.contains('is-toolbar-active')).toBe(false);
      historyScrollArea.remove();
      unmount();
    });
  
  it('keeps the editor outline clear without a doubled light-theme contour', async () => {
      const { unmount } = await renderWorkspacePage();
      const editorShell = document.querySelector<HTMLElement>('.workspace-page-editor-shell')!;
      const editor = editorShell.querySelector('.workspace-page-rich-text-editor')!;
      const baseShellRule = workspacePageStyles.match(/\.workspace-page-editor-shell\s*\{([^}]*)\}/)?.[1] ?? '';
      const shellAfterRule = workspacePageStyles.match(/\.workspace-page-editor-shell::after\s*\{([^}]*)\}/)?.[1] ?? '';
      const outlineBaseRule = workspacePageStyles.match(/\.workspace-page-editor-shell\[data-editor-appearance='outline'\]\s*\{([^}]*)\}/)?.[1] ?? '';
      const outlineAfterRule = workspacePageStyles.match(/\.workspace-page-editor-shell\[data-editor-appearance='outline'\]::after\s*\{([^}]*)\}/)?.[1] ?? '';
      const toolbarRule = workspacePageStyles.match(/\.workspace-page-rich-text-toolbar\s*\{([^}]*)\}/)?.[1] ?? '';
      const lightEditorInputRule = workspacePageStyles.match(/\.workspace-page \.workspace-page-rich-text-input\s*\{([^}]*)\}/)?.[1] ?? '';
      const activeEditorRule = workspacePageStyles.match(/\.workspace-page-rich-text-input\.is-active\s*\{([^}]*)\}/)?.[1] ?? '';
      const activeEditorFillRule = workspacePageStyles.match(/\.workspace-page \.workspace-page-rich-text-input\.is-active\s*\{([^}]*)\}/)?.[1] ?? '';
      const activeEditorEdgeFillRule = workspacePageStyles.match(/\.workspace-page-rich-text-stage:has\(\.workspace-page-rich-text-input\.is-active\)::before\s*\{([^}]*)\}/)?.[1] ?? '';
      const dragOverlayRule = workspacePageStyles.match(/\.workspace-page-rich-text-editor\.is-drag-over \.workspace-page-rich-text-stage::before\s*\{([^}]*)\}/)?.[1] ?? '';
  
      expect(editor.classList.contains('is-toolbar-active')).toBe(false);
      expect(baseShellRule).toMatch(/border:\s*1px solid rgba\(112, 130, 143, 0\.24\)/);
      expect(baseShellRule).toMatch(/0 0 0 1px rgba\(var\(--editor-outline\),\s*0\.04\)/);
      expect(baseShellRule).toMatch(/0 10px 28px rgba\(34, 47, 58, 0\.08\)/);
      expect(shellAfterRule).toMatch(/opacity:\s*1/);
      expect(shellAfterRule).toMatch(/border:\s*1px solid rgba\(var\(--editor-outline\),\s*0\.38\)/);
      expect(outlineBaseRule).toMatch(/border-color:\s*rgba\(var\(--editor-outline\),\s*0\.34\)/);
      expect(outlineBaseRule).toMatch(/0 0 0 1px rgba\(var\(--editor-outline\),\s*0\.06\)/);
      expect(outlineAfterRule).toMatch(/opacity:\s*0\.5/);
      expect(outlineAfterRule).toMatch(/border-color:\s*rgba\(var\(--editor-outline\),\s*0\.26\)/);
      expect(toolbarRule).toMatch(/opacity:\s*1/);
      expect(toolbarRule).toMatch(/visibility:\s*visible/);
      expect(toolbarRule).toMatch(/transform:\s*none/);
      expect(workspacePageStyles).toMatch(/\.workspace-page-rich-text-editor\.is-toolbar-active \.workspace-page-rich-text-toolbar\.is-airy\s*\{\s*transform:\s*translateY\(11px\);/);
      expect(lightEditorInputRule).toMatch(/background:\s*#f7f8fa !important/);
      expect(lightEditorInputRule).toMatch(/border:\s*1px solid #e5e9ec/);
      expect(activeEditorFillRule).toMatch(/box-shadow:\s*none/);
      expect(activeEditorEdgeFillRule).toMatch(/background-position:\s*top, bottom/);
      expect(activeEditorEdgeFillRule).toMatch(/background-size:\s*100% 8px, 100% 8px/);
      expect(activeEditorEdgeFillRule).toMatch(/var\(--workspace-active-editor-edge-fill\) var\(--workspace-active-editor-edge-fade-left\), var\(--workspace-active-editor-edge-fill\) calc\(100% - var\(--workspace-active-editor-edge-fade-right\)\), transparent/);
      expect(activeEditorRule).toMatch(/margin-top:\s*8px/);
      expect(workspacePageStyles).toMatch(/\.workspace-page-rich-text-stage:has\(\.workspace-page-rich-text-input\.is-active\)\s*\{[^}]*--workspace-active-editor-edge-fill:\s*#f7f8fa;/);
      expect(workspacePageStyles).toMatch(/\.workspace-page-rich-text-stage:has\(\.workspace-page-rich-text-input\.is-active:focus\),\s*\.workspace-page-rich-text-stage:has\(\.workspace-page-rich-text-input\.is-active:focus-visible\)\s*\{\s*--workspace-active-editor-edge-fill:\s*#f5f7f8;/);
      expect(workspacePageStyles).toMatch(/html\[data-theme='light'\] \.workspace-page \.workspace-page-editor-shell\s*\{\s*background:\s*#f7f8fa !important;[^}]*border-color:\s*rgba\(var\(--editor-outline\), 0\.3\) !important;[^}]*0 0 0 1px rgba\(var\(--editor-outline\), 0\.08\)/);
      expect(workspacePageStyles).toMatch(/html\[data-theme='light'\] \.workspace-page \.workspace-page-editor-shell:not\(\[data-editor-appearance='outline'\]\):has\(\.workspace-page-rich-text-editor\.is-toolbar-active\)\s*\{\s*border-color:\s*rgba\(var\(--editor-outline\), 0\.3\) !important;\s*box-shadow:\s*0 0 0 1px rgba\(var\(--editor-outline\), 0\.08\),\s*0 10px 28px rgba\(34, 47, 58, 0\.08\) !important;/);
      expect(workspacePageStyles).toMatch(/html\[data-theme='light'\] \.workspace-page \.workspace-page-editor-shell:not\(\[data-editor-appearance='outline'\]\)::after\s*\{\s*opacity:\s*0 !important;\s*box-shadow:\s*none !important;/);
      expect(workspacePageStyles).toMatch(/html\[data-theme='light'\] \.workspace-page \.workspace-page-rich-text-input\s*\{\s*background:\s*#ffffff !important;/);
      expect(colorThemeStyles).toMatch(/html\[data-theme='light'\] \.workspace-page \.chat-preview-stand\.is-mobile \.chat-preview-window\s*\{\s*border-color:\s*#b6c3ca;[^}]*inset 0 0 0 1px rgba\(65, 88, 104, 0\.14\)/);
      expect(activeEditorEdgeFillRule).toMatch(/left:\s*10px;/);
      expect(workspacePageStyles).toMatch(/@media \(max-width: 1100px\)[\s\S]*?html\.electron-runtime \.workspace-page \.workspace-page-editor-shell:has\(\.workspace-page-rich-text-input\.is-active\) \.workspace-page-rich-text-input\s*\{\s*justify-self:\s*start;\s*width:\s*calc\(100% \+ 20px\);\s*max-width:\s*none;\s*margin-left:\s*-10px;/);
      expect(workspacePageStyles).toMatch(/@media \(max-width: 1100px\)[\s\S]*?html\.electron-runtime \.workspace-page \.workspace-page-rich-text-stage:has\(\.workspace-page-rich-text-input\.is-active\)::before\s*\{\s*right:\s*-10px;\s*left:\s*0;/);
      expect(workspacePageStyles).toMatch(/@media \(max-width: 1100px\)[\s\S]*?html\.electron-runtime \.workspace-page \.workspace-page-rich-text-stage:has\(\.workspace-page-rich-text-input\.is-active\)::after\s*\{\s*right:\s*-10px;\s*left:\s*-10px;/);
      expect(workspacePageStyles).toMatch(/@media \(max-width: 1100px\)\s*\{\s*html\.electron-runtime \.workspace-page \.workspace-page-rich-text-stage:has\(\.workspace-page-rich-text-input\.is-active\)\s*\{\s*overflow:\s*visible;/);
      expect(workspacePageStyles).toMatch(/html\[data-theme='light'\] \.workspace-page \.workspace-page-rich-text-stage:has\(\.workspace-page-rich-text-input\.is-active\)\s*\{\s*--workspace-active-editor-edge-fill:\s*#ffffff;/);
      expect(workspacePageStyles).toMatch(/--workspace-active-editor-edge-fade-left:\s*3\.5%;[^}]*--workspace-active-editor-edge-fade-right:\s*3\.5%;/);
      expect(colorThemeStyles).toMatch(/html\[data-theme='dark'\] \.workspace-page \.workspace-page-rich-text-stage:has\(\.workspace-page-rich-text-input\.is-active\)\s*\{\s*--workspace-active-editor-edge-fill:\s*#151d22;/);
      expect(colorThemeStyles).toMatch(/html\[data-theme='dark'\] \.workspace-page \.workspace-page-rich-text-stage:has\(\.workspace-page-rich-text-input\.is-active\)::before\s*\{\s*border-radius:\s*0;[^}]*background-image:\s*linear-gradient\(var\(--workspace-active-editor-edge-fill\), var\(--workspace-active-editor-edge-fill\)\),\s*linear-gradient\(var\(--workspace-active-editor-edge-fill\), var\(--workspace-active-editor-edge-fill\)\);[^}]*background-position:\s*left top, left bottom;\s*background-size:\s*100% 8px, 100% 8px;/);
      expect(workspacePageStyles).toMatch(/\.workspace-page \.workspace-page-rich-text-input\.is-active\s*\{\s*background:\s*linear-gradient\(90deg, transparent, #f7f8fa 3\.5%, #f7f8fa 96\.5%, transparent\) !important;\s*border-left-color:\s*transparent !important;\s*border-right-color:\s*transparent !important;/);
      expect(workspacePageStyles).toMatch(/html\[data-theme='light'\] \.workspace-page \.workspace-page-rich-text-input\.is-active\s*\{\s*background:\s*linear-gradient\(90deg, transparent, #ffffff 3\.5%, #ffffff 96\.5%, transparent\) !important;/);
      expect(colorThemeStyles).toMatch(/html\[data-theme='dark'\] \.workspace-page \.workspace-page-rich-text-input\.is-active,[\s\S]*?background:\s*#151d22 !important;/);
      expect(dragOverlayRule).toMatch(/height:\s*auto/);
      expect(workspacePageStyles).not.toMatch(/\.workspace-page-rich-text-stage::before\s*\{[^}]*top:\s*0/);
      expect(workspacePageStyles).toMatch(/workspace-page-rich-text-editor\.is-toolbar-active \.workspace-page-rich-text-input\s*\{[^}]*margin-bottom:\s*8px;/);
      expect(workspacePageStyles).toMatch(/\.workspace-page-rich-text-stage-view\s*\{[^}]*transform:\s*none;[^}]*transition:\s*opacity 180ms ease;/);
      expect(workspacePageStyles).not.toMatch(/\.workspace-page-rich-text-stage:has\(\.workspace-page-rich-text-stage-view\.is-active:not\(\.workspace-page-textarea\)\)/);
      expect(workspacePageStyles).not.toMatch(/\.workspace-page-rich-text-stage:has\(\.workspace-page-rich-text-chat-stage\.is-active\)\s*\{/);
      expect(workspacePageStyles).toMatch(/html\.electron-runtime \.workspace-page-rich-text-editor,\s*html\.electron-runtime \.workspace-page-rich-text-editor\.is-toolbar-active\s*\{\s*padding-bottom:\s*12px;/);
      expect(workspacePageStyles).toMatch(/html\.electron-runtime \.workspace-page-rich-text-editor\.is-toolbar-active \.workspace-page-rich-text-input\s*\{\s*flex:\s*1 1 auto;\s*margin-bottom:\s*8px;/);
      expect(workspacePageStyles).toMatch(/html\.electron-runtime \.workspace-page-rich-text-editor \.workspace-page-rich-text-toolbar\.is-airy,\s*html\.electron-runtime \.workspace-page-rich-text-editor\.is-toolbar-active \.workspace-page-rich-text-toolbar\.is-airy\s*\{\s*min-height:\s*34px;\s*margin:\s*4px 0 0 auto;\s*transform:\s*none;/);
      expect(workspacePageStyles).toMatch(/@media \(max-height: 720px\)\s*\{\s*html\.electron-runtime \.workspace-page-rich-text-editor,\s*html\.electron-runtime \.workspace-page-rich-text-editor\.is-toolbar-active\s*\{\s*padding-bottom:\s*6px;/);
      expect(workspacePageStyles).toMatch(/@media \(max-height: 720px\)[\s\S]*?html\.electron-runtime \.workspace-page-rich-text-editor\.is-toolbar-active \.workspace-page-rich-text-toolbar\.is-airy\s*\{\s*transform:\s*translateY\(11px\);/);
      expect(workspacePageStyles).toMatch(/@media \(max-width: 480px\)\s*\{\s*\.workspace-page-rich-text-editor\s*\{\s*padding-bottom:\s*6px;/);
      expect(workspacePageStyles).toMatch(/\.workspace-page-rich-text-stage::after\s*\{[^}]*position:\s*absolute;[^}]*bottom:\s*0;/);
      expect(workspacePageStyles).toMatch(/@media \(max-width: 840px\)[\s\S]*?html\.electron-runtime \.workspace-page-rich-text-editor\.is-toolbar-active \.workspace-page-rich-text-toolbar\.is-airy\s*\{\s*transform:\s*translateY\(15px\);/);
      expect(workspacePageStyles).toMatch(/@media \(max-width: 1100px\)\s*\{\s*\.workspace-page-rich-text-editor\s*\{\s*height:\s*100%;\s*padding-bottom:\s*6px;\s*\}\s*\.workspace-page-rich-text-editor \.workspace-page-rich-text-input\s*\{\s*flex:\s*1 1 0;\s*min-height:\s*0;\s*margin-bottom:\s*8px;\s*\}/);
      expect(workspacePageStyles).not.toMatch(/\.workspace-page-attachment-tray\.is-empty\s*\{[^}]*display:\s*none/);
      expect(workspacePageStyles).toMatch(/html\.electron-runtime \.workspace-page \.workspace-page-preview-panel\s*\{[^}]*width:\s*278px;[^}]*min-width:\s*278px;[^}]*max-width:\s*278px;[^}]*flex:\s*0 0 278px;/);
      expect(workspacePageStyles).toMatch(/html\.electron-runtime \.workspace-page \.workspace-page-editor-shell\s*\{\s*max-height:\s*none;\s*margin-bottom:\s*0;/);
      expect(workspacePageStyles).toMatch(/html\.electron-runtime \.workspace-page-rich-text-chat-stage\.is-active \.workspace-page-chat-stage-main\s*\{\s*flex:\s*1 1 0%;\s*min-height:\s*0;\s*overflow-y:\s*auto;/);
      expect(workspacePageStyles).toMatch(/\.workspace-page-editor-canvas:has\(\.workspace-page-rich-text-schedule-stage\.is-active:is\(\.is-time-focus, \.is-repeat-focus\)\) \.workspace-page-form-row-body\s*\{/);
      expect(workspacePageStyles).toMatch(/\.workspace-page-editor-shell:has\(\.workspace-page-rich-text-schedule-stage\.is-active\)\s*\{\s*width:\s*min\(100%, 815px\);/);
  
      unmount();
    });
  
  it('lowers chat, template, draft, import, and export footer buttons by three pixels', () => {
      expect(workspacePageStyles).toMatch(
        /\.workspace-page-rich-text-chat-stage > \.workspace-page-chat-stage-footer button,\s*\.workspace-page-rich-text-template-stage > \.workspace-page-template-stage-footer button:not\(\.workspace-page-editor-export-option\)\s*\{\s*translate:\s*0 3px;/,
      );
    });
  
  it('keeps the Schedule Time and Repeat controls readable at compact Electron widths', () => {
      expect(workspacePageStyles).toMatch(/@media \(max-width: 840px\)[\s\S]*?html\.electron-runtime \.workspace-page-action-left-group \.workspace-page-schedule-compact-button\s*\{[^}]*flex:\s*0 0 80px !important;[^}]*width:\s*80px !important;[^}]*min-width:\s*80px !important;[^}]*font-size:\s*14px !important;/);
      expect(workspacePageStyles).toMatch(/\.workspace-page-schedule-compact-button\s*\{[^}]*font-size:\s*13px !important;/);
    });
  
  it('shows three attachment chips before scrolling the attachment tray', () => {
      expect(workspacePageStyles).toMatch(/\.workspace-page-attachment-card\s*\{[^}]*flex:\s*0 0 calc\(\(688px - 16px\) \/ 3 - 15px\);[^}]*width:\s*calc\(\(688px - 16px\) \/ 3 - 15px\);/);
      expect(workspacePageStyles).toMatch(/\.workspace-page-attachment-tray\s*\{\s*display:\s*grid;\s*grid-template-rows:\s*10px minmax\(0, 1fr\);/);
      expect(workspacePageStyles).toMatch(/\.workspace-page-attachment-tray \.workspace-page-media-items\s*\{[^}]*box-sizing:\s*border-box;[^}]*width:\s*100%;[^}]*max-width:\s*640px;[^}]*min-width:\s*0;[^}]*overflow-x:\s*auto;[^}]*gap:\s*0;[^}]*padding:\s*0 0 0 12px;/);
      expect(workspacePageStyles).toMatch(/\.workspace-page-attachment-tray \.workspace-page-media-items\s*\{[^}]*align-items:\s*center;/);
      expect(workspacePageStyles).toMatch(/\.workspace-page-attachment-tray\s*\{[^}]*flex:\s*0 0 56px;[^}]*height:\s*56px;[^}]*min-height:\s*56px;/);
      expect(workspacePageStyles).toMatch(/@media \(max-width: 1100px\)[\s\S]*?\.workspace-page-attachment-tray \.workspace-page-media-items\s*\{[^}]*gap:\s*0;[^}]*max-width:\s*min\(640px, 100%\);/);
      expect(workspacePageStyles).toMatch(/@media \(max-width: 1100px\)[\s\S]*?\.workspace-page-attachment-tray \.workspace-page-attachment-scrollbar\s*\{[^}]*max-width:\s*min\(640px, 100%\);/);
      expect(workspacePageStyles).toMatch(/@media \(max-width: 1100px\)[\s\S]*?\.workspace-page-attachment-card\s*\{[^}]*flex:\s*0 0 min\(220px, calc\(100vw - 40px\)\);[^}]*width:\s*min\(220px, calc\(100vw - 40px\)\);[^}]*min-width:\s*156px;/);
      expect(workspacePageStyles).toMatch(/@media \(max-width: 1100px\)[\s\S]*?\.workspace-page-attachment-thumbnail,\s*\.workspace-page-attachment-file-mark\s*\{\s*flex:\s*0 0 26px;\s*width:\s*26px;\s*height:\s*26px;/);
      expect(workspacePageStyles).toMatch(/@media \(max-width: 1100px\)[\s\S]*?\.workspace-page-attachment-copy\s*\{\s*display:\s*grid;/);
      expect(workspacePageStyles).toMatch(/\.workspace-page-attachment-scrollbar\s*\{[^}]*position:\s*relative;[^}]*height:\s*8px;/);
      expect(workspacePageStyles).toMatch(/\.workspace-page-attachment-scrollbar\.is-visible\s*\{\s*visibility:\s*visible;/);
      expect(workspacePageStyles).toMatch(/\.workspace-page-attachment-scrollbar-thumb\s*\{[^}]*position:\s*absolute;[^}]*border-radius:\s*999px;/);
    });
  
  it('insets the outer attachment and publish controls from the editor edges', () => {
      expect(workspacePageStyles).toMatch(
        /\.workspace-page-schedule-row > \.workspace-page-media-row > \.workspace-page-attachment-toggle\s*\{\s*margin-left:\s*5px;/,
      );
      expect(workspacePageStyles).toMatch(
        /\.workspace-page-schedule-row > \.workspace-page-submit-actions\s*\{\s*margin-right:\s*5px;/,
      );
    });
  
  it('limits the attachment tray to two chips beside the live preview at narrow Electron widths', () => {
      expect(workspacePageStyles).toMatch(
        /@media \(max-width: 1100px\)\s*\{\s*html\.electron-runtime \.workspace-page-main:has\(\.workspace-page-preview-panel\[data-visible='true'\]\) \.workspace-page-attachment-tray \.workspace-page-media-items,\s*html\.electron-runtime \.workspace-page-main:has\(\.workspace-page-preview-panel\[data-visible='true'\]\) \.workspace-page-attachment-tray \.workspace-page-attachment-scrollbar\s*\{\s*max-width:\s*min\(456px, 100%\);/,
      );
    });
  
  it('keeps the Electron post input inset and centered inside the editor stage', () => {
      expect(workspacePageStyles).toMatch(/html\.electron-runtime \.workspace-page-rich-text-stage > \.workspace-page-textarea\.workspace-page-rich-text-stage-view\.is-active\s*\{[^}]*justify-self:\s*center;[^}]*width:\s*min\(calc\(92% \+ 24px\), 720px, 100%\);[^}]*max-width:\s*720px/);
    });
  
  it('keeps the Time picker and quick actions usable at the minimum Electron height', () => {
      expect(workspacePageStyles).toMatch(/@media \(max-width: 1100px\) and \(max-height: 540px\)[\s\S]*?html\.electron-runtime \.workspace-page-rich-text-stage:has\(\.workspace-page-rich-text-schedule-stage\.is-active\.is-time-focus\)\s*\{[^}]*min-height:\s*228px;[^}]*max-height:\s*228px;/);
      expect(workspacePageStyles).toMatch(/html\.electron-runtime \.workspace-page-rich-text-schedule-stage\.is-time-focus \.workspace-page-schedule-main\s*\{[^}]*grid-template-rows:\s*36px minmax\(0, 1fr\);[^}]*grid-template-areas:[\s\S]*?'date-time date-time'[\s\S]*?'quick-date quick-time';[^}]*overflow-y:\s*auto;/);
      expect(workspacePageStyles).toMatch(/html\.electron-runtime \.workspace-page-rich-text-schedule-stage\.is-time-focus \.workspace-page-schedule-quick-date-panel,[\s\S]*?\.workspace-page-schedule-quick-time-panel\s*\{[^}]*display:\s*grid;/);
      expect(workspacePageStyles).toMatch(/html\.electron-runtime \.workspace-page-rich-text-stage:has\(\.workspace-page-rich-text-schedule-stage\.is-active\.is-repeat-focus\)\s*\{[^}]*min-height:\s*228px;[^}]*max-height:\s*228px;/);
      expect(workspacePageStyles).toMatch(/html\.electron-runtime \.workspace-page-rich-text-schedule-stage\.is-repeat-focus \.workspace-page-schedule-main\s*\{[^}]*height:\s*auto;[^}]*min-height:\s*0;[^}]*overflow-y:\s*auto;/);
    });
  
  it('uses equal-width columns for Schedule time and quick actions on desktop', () => {
      expect(workspacePageStyles).toMatch(/@media \(min-width: 701px\)\s*\{\s*\.workspace-page-rich-text-schedule-stage\.is-time-focus \.workspace-page-schedule-main\s*\{\s*display:\s*grid;\s*grid-template-columns:\s*minmax\(0, 1fr\) minmax\(0, 1fr\);\s*grid-template-rows:\s*auto minmax\(0, 1fr\);\s*grid-template-areas:\s*'date-time date-time'\s*'quick-date quick-time';/);
      expect(workspacePageStyles).toMatch(/\.workspace-page-rich-text-schedule-stage\.is-time-focus \.workspace-page-schedule-quick-row\s*\{\s*display:\s*grid;\s*grid-template-columns:\s*repeat\(4, minmax\(0, 1fr\)\);\s*gap:\s*3px;\s*min-width:\s*0;\s*padding:\s*0;/);
      expect(workspacePageStyles).toMatch(/\.workspace-page-rich-text-schedule-stage\.is-time-focus \.workspace-page-schedule-options-heading\s*\{\s*justify-self:\s*stretch;\s*text-align:\s*left;/);
    });
  
  it('keeps the default blue accent when custom action colors are written', async () => {
      localStorage.removeItem(EDITOR_APPEARANCE_STORAGE_KEY);
      const { unmount } = await renderWorkspacePage();
      const editorShell = document.querySelector<HTMLElement>('.workspace-page-editor-shell')!;
  
      expect(editorShell.dataset.editorAppearance).toBe('outline');
      expect(editorShell.style.getPropertyValue('--editor-outline')).toBe('35, 157, 251');
  
      await act(async () => {
        writeEditorAppearancePreferences({
          style: 'outline',
          palette: 'custom',
          modeColors: { send: '#287fa6', schedule: '#b482f5', draft: '#f58b37' },
        });
      });
  
      expect(editorShell.dataset.editorAppearance).toBe('outline');
      expect(editorShell.style.getPropertyValue('--editor-outline')).toBe('35, 157, 251');
  
      await act(async () => {
        (document.querySelector('.workspace-page-publish-menu-toggle') as HTMLButtonElement).click();
      });
      const scheduleOption = document.querySelector<HTMLButtonElement>('.workspace-page-publish-option.is-scheduled')!;
      await act(async () => scheduleOption.click());
      expect(editorShell.style.getPropertyValue('--editor-outline')).toBe('35, 157, 251');
  
      await act(async () => {
        writeEditorAppearancePreferences({
          style: 'monochrome',
          palette: 'custom',
          modeColors: { send: '#287fa6', schedule: '#b482f5', draft: '#f58b37' },
        });
      });
      expect(editorShell.style.getPropertyValue('--editor-outline')).toBe('35, 157, 251');
  
      unmount();
      localStorage.removeItem(EDITOR_APPEARANCE_STORAGE_KEY);
    });
  
  it('keeps the outline divider crisp over the clean light editor surface', () => {
      const pageRule = workspacePageStyles.match(/\.workspace-page\s*\{([^}]*)\}/)?.[1] ?? '';
      const shellRule = workspacePageStyles.match(/\.workspace-page-editor-shell\s*\{([^}]*)\}/)?.[1] ?? '';
      const stageRule = workspacePageStyles.match(/\.workspace-page-rich-text-stage\s*\{([^}]*)\}/)?.[1] ?? '';
      const dividerRule = workspacePageStyles.match(/\.workspace-page-rich-text-stage::after\s*\{([^}]*)\}/)?.[1] ?? '';
      const darkDividerRule = workspacePageStyles.match(/html\[data-theme='dark'\] \.workspace-page \.workspace-page-rich-text-stage::after\s*\{([^}]*)\}/)?.[1] ?? '';
      const lightDividerRule = workspacePageStyles.match(/html\[data-theme='light'\] \.workspace-page \.workspace-page-rich-text-stage::after\s*\{([^}]*)\}/)?.[1] ?? '';
  
      expect(pageRule).toMatch(/radial-gradient\(ellipse 72% 62% at 45% 42%/);
      expect(pageRule).toMatch(/var\(--void\)/);
      expect(shellRule).not.toMatch(/radial-gradient/);
      expect(shellRule).toMatch(/background:\s*linear-gradient\(155deg, #ffffff, #fbfcfd\)/);
      expect(shellRule).toMatch(/0 0 0 1px rgba\(var\(--editor-outline\), 0\.04\)/);
      expect(stageRule).toMatch(/rgba\(var\(--editor-outline-bright\), 0\.48\)/);
      expect(dividerRule).toMatch(/filter:\s*none/);
      expect(darkDividerRule).toMatch(/height:\s*3px/);
      expect(darkDividerRule).toMatch(/rgba\(var\(--editor-outline-bright\), 0\.82\)/);
      expect(darkDividerRule).toMatch(/drop-shadow\(0 0 5px rgba\(var\(--editor-outline\), 0\.38\)\)/);
      expect(lightDividerRule).toMatch(/height:\s*3px/);
      expect(lightDividerRule).toMatch(/rgba\(var\(--editor-outline-bright\), 0\.96\)/);
      expect(lightDividerRule).toMatch(/drop-shadow\(0 0 5px rgba\(var\(--editor-outline\), 0\.46\)\)/);
    });
  
  it('keeps the editor counter and eraser visible in the light theme', () => {
      expect(colorThemeStyles).toMatch(
        /html\[data-theme='light'\] \.workspace-page \.workspace-page-rich-text-meta-row\s*\{\s*opacity:\s*1 !important;/,
      );
      expect(colorThemeStyles).toMatch(
        /html\[data-theme='light'\] \.workspace-page \.workspace-page-rich-text-meta-row > \.workspace-page-character-count\s*\{\s*color:\s*#344b5a !important;\s*font-weight:\s*500;/,
      );
      expect(colorThemeStyles).toMatch(
        /html\[data-theme='light'\] \.workspace-page \.workspace-page-rich-text-meta-row > \.workspace-page-rich-text-clear\s*\{\s*color:\s*#3f6277 !important;/,
      );
      expect(colorThemeStyles).toMatch(
        /html\[data-theme='light'\] \.workspace-page \.workspace-page-rich-text-clear\.is-hidden\s*\{\s*visibility:\s*visible !important;\s*pointer-events:\s*none;/,
      );
      expect(colorThemeStyles).toMatch(
        /html\[data-theme='light'\] \.workspace-page \.workspace-page-rich-text-clear:hover,\s*html\[data-theme='light'\] \.workspace-page \.workspace-page-rich-text-clear:focus-visible\s*\{\s*background:\s*#e4eef3;/,
      );
    });
  
  it('matches dark-theme toolbar chip and divider geometry in the light theme', () => {
      expect(workspacePageStyles).toMatch(/\.workspace-page-rich-text-stage\s*\{[^}]*editor-outline-bright\), 0\.48/);
      expect(workspacePageStyles).toMatch(/\.workspace-page-rich-text-stage::after\s*\{[^}]*bottom:\s*0;[^}]*height:\s*2px;/);
      expect(workspacePageStyles).toMatch(/html\[data-theme='light'\] \.workspace-page \.workspace-page-editor-shell\s*\{[^}]*border-color:\s*rgba\(var\(--editor-outline\), 0\.3\) !important;/);
      expect(workspacePageStyles).toMatch(/html\[data-theme='light'\] \.workspace-page \.workspace-page-editor-shell:not\(\[data-editor-appearance='outline'\]\)::after\s*\{\s*opacity:\s*0 !important;\s*box-shadow:\s*none !important;/);
      expect(colorThemeStyles).toMatch(/html\[data-theme='light'\] \.workspace-page \.workspace-page-rich-text-toolbar button\[aria-pressed='true'\]:not\(:hover\):not\(:focus-visible\),\s*html\[data-theme='light'\] \.workspace-page \.workspace-page-rich-text-toolbar button\.is-open:not\(:hover\):not\(:focus-visible\)\s*\{[^}]*border-color:\s*#9dc9e5 !important;[^}]*background:\s*#e3f3fc !important;[^}]*color:\s*#176c9c !important;/);
      expect(colorThemeStyles).toMatch(/html\[data-theme='light'\] \.workspace-page \.workspace-page-rich-text-toolbar\.is-airy \.workspace-page-rich-text-leading-tools > \.workspace-page-rich-text-tool-anchor > button,[\s\S]*? \.workspace-page-rich-text-toolbar-actions > \.workspace-page-rich-text-format-option,[\s\S]*?\{\s*width:\s*32px !important;\s*min-width:\s*32px !important;\s*height:\s*32px !important;\s*min-height:\s*32px !important;/);
    });
  
  it('updates publish actions without changing the blue editor outline', async () => {
      const { unmount } = await renderWorkspacePage();
      const publishButton = document.querySelector('.workspace-page-publish-main')!;
      const editorShell = document.querySelector<HTMLElement>('.workspace-page-editor-shell')!;
      const menuToggle = document.querySelector<HTMLButtonElement>('.workspace-page-publish-menu-toggle')!;
      expect(editorShell.style.getPropertyValue('--editor-outline')).toBe('35, 157, 251');
      expect(publishButton.classList.contains('is-send')).toBe(true);
      expect(editorShell.classList.contains('is-scheduled')).toBe(false);
      expect(editorShell.classList.contains('is-draft')).toBe(false);
  
      await act(async () => menuToggle.click());
      const scheduleOption = Array.from(document.querySelectorAll('.workspace-page-publish-option'))
        .find((button) => button.textContent?.trim() === 'Schedule') as HTMLButtonElement;
      await act(async () => scheduleOption.click());
      expect(publishButton.classList.contains('is-scheduled')).toBe(true);
      expect(editorShell.classList.contains('is-scheduled')).toBe(true);
      expect(editorShell.style.getPropertyValue('--editor-outline')).toBe('35, 157, 251');
  
      await act(async () => menuToggle.click());
      const draftOption = Array.from(document.querySelectorAll('.workspace-page-publish-option'))
        .find((button) => button.textContent?.trim() === 'Save draft') as HTMLButtonElement;
      await act(async () => draftOption.click());
      expect(publishButton.classList.contains('is-draft')).toBe(true);
      expect(editorShell.classList.contains('is-draft')).toBe(true);
      expect(editorShell.style.getPropertyValue('--editor-outline')).toBe('35, 157, 251');
      unmount();
    });
  
  it('keeps the browser runtime quiet when draft storage is unavailable', async () => {
      const originalDraftStorage = Object.getOwnPropertyDescriptor(window, 'draftStorage');
      Reflect.deleteProperty(window, 'draftStorage');
      localStorage.removeItem('xmsgi-draft-store-fallback');
      localStorage.removeItem('awaitmsg-draft-store-fallback');
  
      try {
        const { unmount } = await renderWorkspacePage();
        expect(document.body.textContent).not.toContain('Saved drafts are unavailable in this runtime.');
        unmount();
      } finally {
        if (originalDraftStorage) {
          Object.defineProperty(window, 'draftStorage', originalDraftStorage);
        } else {
          Reflect.deleteProperty(window, 'draftStorage');
        }
      }
    });
  
  it('treats attachment-only drafts as valid content', () => {
      expect(hasDraftContent('', normalizeAttachments([{ name: 'demo.png', path: 'C:/demo/demo.png' }]))).toBe(true);
      expect(hasDraftContent('', normalizeAttachments([{ name: 'demo.png', previewUrl: 'data:image/png;base64,AAA' }]))).toBe(true);
      expect(hasDraftContent('', [])).toBe(false);
    });
  
  it('keeps browser fallback attachments that only have previewUrl data', () => {
      expect(normalizeAttachments([{ name: 'demo.png', previewUrl: 'data:image/png;base64,AAA' }])).toEqual([
        {
          id: 'legacy-0-demo.png',
          type: 'image',
          name: 'demo.png',
          mimeType: 'image/png',
          path: 'data:image/png;base64,AAA',
          size: 0,
          previewUrl: 'data:image/png;base64,AAA',
          position: 0,
        },
      ]);
    });
  
  it('keeps attachments anchored to their text when the body changes', () => {
      const attachments = normalizeAttachments([
        { id: 'before', name: 'before.png', path: '/before.png', position: 3 },
        { id: 'after', name: 'after.png', path: '/after.png', position: 6 },
      ]);
  
      expect(remapAttachmentPositions(attachments, 'Hello world', 'Hello brave world').map(({ id, position }) => ({ id, position })))
        .toEqual([{ id: 'before', position: 3 }, { id: 'after', position: 12 }]);
      expect(remapAttachmentPositions(attachments, 'Hello world', 'Hello world!')).toBe(attachments);
    });
  
  it('opens the compact schedule shell by default for the active preview state', async () => {
      document.body.dataset.livePreview = 'true';
  
      const { unmount } = await renderWorkspacePage();
  
      expect(document.querySelector('.workspace-page-rich-text-schedule-stage.is-active')).not.toBeNull();
      expect(document.querySelector('.workspace-page-schedule-empty-panel')).not.toBeNull();
  
      document.body.removeAttribute('data-live-preview');
      unmount();
    });
  
  it('opens the custom schedule calendar below its date field and selects today', async () => {
      document.body.dataset.livePreview = 'true';
      const today = new Date();
      const todayValue = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
      const setDate = vi.fn();
      const { unmount } = await renderWorkspacePage({ date: todayValue, setDate });
      const dateField = document.querySelector<HTMLElement>('.workspace-page-schedule-inline-date')!;
      const dateButton = dateField.querySelector<HTMLButtonElement>('button')!;
      vi.spyOn(dateField, 'getBoundingClientRect').mockReturnValue(new DOMRect(200, 100, 320, 38));
  
      await act(async () => dateButton.click());
  
      const picker = document.querySelector<HTMLElement>('.quick-planner-date-picker')!;
      expect(picker.getAttribute('role')).toBe('dialog');
      expect(picker.style.top).toBe('144px');
      const todayButton = Array.from(picker.querySelectorAll<HTMLButtonElement>('button'))
        .find((button) => button.textContent?.trim() === String(today.getDate()))!;
      expect(todayButton.disabled).toBe(false);
  
      await act(async () => todayButton.click());
  
      expect(setDate).toHaveBeenCalledWith(todayValue);
      expect(document.querySelector('.quick-planner-date-picker')).toBeNull();
      document.body.removeAttribute('data-live-preview');
      unmount();
    });
  
  it('opens the time list below its trigger and scrolls to the first available time', async () => {
      vi.useFakeTimers();
      const now = new Date(2026, 9, 3, 10, 30, 30);
      vi.setSystemTime(now);
      document.body.dataset.livePreview = 'true';
      const todayValue = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      const setTime = vi.fn();
      const previousScrollIntoView = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'scrollIntoView');
      const scrollIntoView = vi.fn();
      Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: scrollIntoView });
      let unmount = () => {};
      try {
        ({ unmount } = await renderWorkspacePage({ date: todayValue, time: '10:30', setTime }));
        const timeField = document.querySelector<HTMLElement>('.workspace-page-schedule-inline-time')!;
        const timeButton = timeField.querySelector<HTMLButtonElement>('button')!;
        vi.spyOn(timeField, 'getBoundingClientRect').mockReturnValue(new DOMRect(200, 100, 220, 38));
  
        await act(async () => timeButton.click());
  
        const picker = document.querySelector<HTMLElement>('.workspace-page-schedule-time-picker')!;
        expect(picker.style.top).toBe('144px');
        const firstAvailableTime = picker.querySelector<HTMLButtonElement>('[role="option"]:not(:disabled)');
        expect(firstAvailableTime).toBeTruthy();
        expect(scrollIntoView).toHaveBeenCalledWith({ block: 'center' });
        expect(scrollIntoView.mock.instances[0]).toBe(firstAvailableTime);
      } finally {
        document.body.removeAttribute('data-live-preview');
        unmount();
        if (previousScrollIntoView) Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', previousScrollIntoView);
        else Reflect.deleteProperty(HTMLElement.prototype, 'scrollIntoView');
        vi.useRealTimers();
      }
    });
  
  it('moves a manually selected schedule time forward after it expires', async () => {
      vi.useFakeTimers();
      const now = new Date(2026, 9, 3, 10, 30, 30);
      vi.setSystemTime(now);
      document.body.dataset.livePreview = 'true';
      const todayValue = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      const setTime = vi.fn<(value: string | ((current: string) => string)) => void>();
      const { rerender, unmount } = await renderWorkspacePage({ date: todayValue, time: '10:31', setTime });
  
      try {
        const timeButton = document.querySelector<HTMLButtonElement>('.workspace-page-schedule-inline-time button')!;
        await act(async () => timeButton.click());
  
        const futureTime = Array.from(document.querySelectorAll<HTMLButtonElement>('.workspace-page-schedule-time-picker [role="option"]'))
          .find((option) => option.textContent?.trim() === '10:45')!;
        expect(futureTime.disabled).toBe(false);
        await act(async () => futureTime.click());
        expect(setTime).toHaveBeenLastCalledWith('10:45');
        rerender({ time: '10:45' });
  
        vi.setSystemTime(new Date(2026, 9, 3, 10, 46, 30));
        await act(async () => {
          await vi.advanceTimersByTimeAsync(30_100);
        });
  
        expect(setTime).toHaveBeenLastCalledWith(expect.any(Function));
        const updateTime = setTime.mock.lastCall?.[0];
        expect(typeof updateTime).toBe('function');
        if (typeof updateTime === 'function') expect(updateTime('10:45')).toBe('10:48');
      } finally {
        document.body.removeAttribute('data-live-preview');
        unmount();
        vi.useRealTimers();
      }
    });
  
  it('hides the drafts control while the composer is in schedule mode', async () => {
      document.body.dataset.livePreview = 'true';
      try {
        const { unmount } = await renderWorkspacePage();
        const draftButton = Array.from(document.querySelectorAll('button')).find((button) => button.textContent?.trim() === 'Draft');
        expect(draftButton).toBeUndefined();
        unmount();
      } finally {
        document.body.removeAttribute('data-live-preview');
      }
    });
  
  it('removes the legacy preview eyelashes and keeps the compact mode row flexible', async () => {
      localStorage.setItem('xmsgi-preview-layout', JSON.stringify({ visible: true }));
      const { unmount } = await renderWorkspacePage();
      const toggle = document.querySelector<HTMLButtonElement>('button[aria-label="Hide preview"]');
  
      try {
        expect(toggle?.getAttribute('aria-label')).toBe('Hide preview');
        await act(async () => {
          toggle?.click();
        });
  
        expect(toggle?.getAttribute('aria-label')).toBe('Show preview');
        expect(toggle?.querySelector('.workspace-page-preview-eyelashes')).toBeNull();
        expect(workspacePageStyles).toMatch(/html\.electron-runtime \.workspace-page-main:has\(\.workspace-page-preview-panel\[data-visible='false'\]\) \.workspace-page-editor-panel\s*\{\s*align-items:\s*center;/);
        expect(workspacePageStyles).toMatch(/html\.electron-runtime \.workspace-page-main:has\(\.workspace-page-preview-panel\[data-visible='false'\]\) \.workspace-page-editor-panel\s*\{\s*width:\s*100%;\s*flex:\s*1 1 100%;/);
        expect(workspacePageStyles).toMatch(/html\.electron-runtime \.workspace-page-main:has\(\.workspace-page-preview-panel\[data-visible='false'\]\) \.workspace-page-preview-panel\[data-visible='false'\]\s*\{\s*display:\s*none;/);
        expect(workspacePageStyles).toMatch(/html\.electron-runtime \.workspace-page \.workspace-page-editor-shell:has\(\.workspace-page-rich-text-input\.is-active\) \.workspace-page-rich-text-input\s*\{\s*width:\s*100%;\s*max-width:\s*none;/);
  
        const modeButtons = [...document.querySelectorAll('.workspace-page-mode-button, .workspace-page-schedule-compact-button')];
        expect(modeButtons.length).toBeGreaterThan(0);
        modeButtons.forEach((button) => {
          const style = getComputedStyle(button);
          expect(style.minWidth).not.toBe('96px');
          expect(style.flexBasis).not.toBe('96px');
        });
      } finally {
        unmount();
      }
    });
  
  it('auto-hides the Electron preview at compact widths without changing the saved preference', async () => {
      const originalInnerWidth = Object.getOwnPropertyDescriptor(window, 'innerWidth');
      const hadElectronRuntime = document.documentElement.classList.contains('electron-runtime');
      Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1024 });
      document.documentElement.classList.add('electron-runtime');
      const { unmount } = await renderWorkspacePage();
  
      try {
        const preview = document.querySelector<HTMLElement>('.workspace-page-preview-panel');
        const toggle = document.querySelector<HTMLButtonElement>('button[aria-label="Show preview"]');
        expect(preview?.dataset.visible).toBe('false');
        expect(toggle).toBeInTheDocument();
  
        await act(async () => {
          toggle?.click();
        });
  
        expect(preview?.dataset.visible).toBe('true');
        expect(JSON.parse(localStorage.getItem('xmsgi-preview-layout') ?? '{}').visible).toBe(true);
  
        Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1200 });
        await act(async () => {
          window.dispatchEvent(new Event('resize'));
        });
        expect(preview?.dataset.visible).toBe('true');
      } finally {
        unmount();
        if (hadElectronRuntime) {
          document.documentElement.classList.add('electron-runtime');
        } else {
          document.documentElement.classList.remove('electron-runtime');
        }
        if (originalInnerWidth) {
          Object.defineProperty(window, 'innerWidth', originalInnerWidth);
        } else {
          Reflect.deleteProperty(window, 'innerWidth');
        }
      }
    });
  
  it('aligns Electron editor and preview panel heights on desktop', () => {
      expect(workspacePageStyles).toMatch(/@media \(max-width: 1100px\)[\s\S]*?html\.electron-runtime \.workspace-page-main\s*\{[^}]*padding:\s*20px clamp\(10px, 1\.5vw, 16px\) 20px;/);
      expect(workspacePageStyles).toMatch(/@media \(min-width: 1101px\)[\s\S]*?html\.electron-runtime \.workspace-page-main\s*\{\s*padding-top:\s*32px;/);
      expect(workspacePageStyles).toMatch(/@media \(min-width: 1101px\)\s*\{\s*html\.electron-runtime \.workspace-page-main:has\(\.workspace-page-preview-panel\[data-visible='false'\]\) \.workspace-page-editor-panel\s*\{\s*flex-basis:\s*100%;\s*align-items:\s*center;/);
      expect(workspacePageStyles).toMatch(/@media \(min-width: 1101px\)[\s\S]*?html\.electron-runtime \.workspace-page-main:has\(\.workspace-page-preview-panel\[data-visible='false'\]\) \.workspace-page-preview-panel\[data-visible='false'\]\s*\{\s*display:\s*none;/);
      expect(workspacePageStyles).toMatch(/html\.electron-runtime \.workspace-page \.workspace-page-editor-panel\s*\{\s*height:\s*min\(100%, 655px\);\s*max-height:\s*655px;\s*align-self:\s*flex-start;/);
      expect(workspacePageStyles).toMatch(/html\.electron-runtime \.workspace-page \.workspace-page-editor-shell\s*\{\s*max-height:\s*none;\s*margin-bottom:\s*0;/);
      expect(workspacePageStyles).toMatch(/html\.electron-runtime \.workspace-page \.workspace-page-preview-panel:not\(\[data-collapsed='true'\]\)\s*\{\s*height:\s*min\(100%, 655px\);\s*max-height:\s*655px;\s*align-self:\s*flex-start;/);
    });
  
  it('aligns Studio editor and live preview heights on desktop', () => {
      expect(workspacePageStyles).toContain('height: min(535px, calc(100dvh - 172px));');
      expect(workspacePageStyles).toContain('height: min(535px, max(0px, calc(100dvh - 172px)));');
    });
  
  it('clamps preview drift on the first layout pass', async () => {
      const { unmount } = await renderWorkspacePage();
      const workspace = document.querySelector('.workspace-page') as HTMLElement;
      const editor = workspace.querySelector('.workspace-page-editor-shell') as HTMLElement;
      const previewPanel = workspace.querySelector('.workspace-page-preview-panel') as HTMLElement;
      const previewWindow = previewPanel.querySelector('.chat-preview-window') as HTMLElement;
      const workspaceMain = workspace.querySelector('.workspace-page-main') as HTMLElement;
  
      Object.defineProperty(editor, 'getBoundingClientRect', {
        configurable: true,
        value: () => ({ left: 0, right: 400, top: 0, bottom: 260, width: 400, height: 260 }),
      });
      Object.defineProperty(previewWindow, 'getBoundingClientRect', {
        configurable: true,
        value: () => ({ left: 420, right: 680, top: 0, bottom: 260, width: 260, height: 260 }),
      });
      Object.defineProperty(previewPanel, 'getBoundingClientRect', {
        configurable: true,
        value: () => ({ left: 420, right: 680, top: 0, bottom: 260, width: 260, height: 260 }),
      });
      Object.defineProperty(workspaceMain, 'getBoundingClientRect', {
        configurable: true,
        value: () => ({ left: 0, right: 1100, top: 0, bottom: 260, width: 1100, height: 260 }),
      });
      Object.defineProperty(previewPanel, 'offsetWidth', { configurable: true, value: 260 });
      Object.defineProperty(previewWindow, 'offsetWidth', { configurable: true, value: 260 });
  
      await act(async () => {
        window.dispatchEvent(new Event('resize'));
        await new Promise((resolve) => window.requestAnimationFrame(resolve));
        await new Promise((resolve) => window.requestAnimationFrame(resolve));
      });
  
      const offset = Number.parseFloat(previewPanel.style.getPropertyValue('--workspace-page-preview-horizontal-offset') || '0');
      expect(Math.abs(offset)).toBeLessThanOrEqual(12);
      unmount();
    });
  
  it('re-aligns the live preview when Studio regains focus after its layout shifts', async () => {
      const { unmount } = await renderWorkspacePage();
      const workspace = document.querySelector('.workspace-page') as HTMLElement;
      const editor = workspace.querySelector('.workspace-page-editor-shell') as HTMLElement;
      const previewPanel = workspace.querySelector('.workspace-page-preview-panel') as HTMLElement;
      const previewWindow = previewPanel.querySelector('.chat-preview-window') as HTMLElement;
      const workspaceMain = workspace.querySelector('.workspace-page-main') as HTMLElement;
      let workspaceRight = 720;
  
      Object.defineProperty(editor, 'getBoundingClientRect', {
        configurable: true,
        value: () => ({ left: 0, right: 400, top: 0, bottom: 260, width: 400, height: 260 }),
      });
      const previewBounds = () => {
        const offset = Number.parseFloat(previewPanel.style.getPropertyValue('--workspace-page-preview-horizontal-offset')) || 0;
        return { left: 420 + offset, right: 680 + offset, top: 0, bottom: 260, width: 260, height: 260 };
      };
      Object.defineProperty(previewWindow, 'getBoundingClientRect', { configurable: true, value: previewBounds });
      Object.defineProperty(previewPanel, 'getBoundingClientRect', { configurable: true, value: previewBounds });
      Object.defineProperty(workspaceMain, 'getBoundingClientRect', {
        configurable: true,
        value: () => ({ left: 0, right: workspaceRight, top: 0, bottom: 260, width: workspaceRight, height: 260 }),
      });
      Object.defineProperty(previewPanel, 'offsetWidth', { configurable: true, value: 260 });
      Object.defineProperty(previewWindow, 'offsetWidth', { configurable: true, value: 260 });
  
      await act(async () => {
        window.dispatchEvent(new Event('resize'));
        await new Promise((resolve) => window.requestAnimationFrame(resolve));
        await new Promise((resolve) => window.requestAnimationFrame(resolve));
      });
      expect(Number.parseFloat(previewPanel.style.getPropertyValue('--workspace-page-preview-horizontal-offset'))).toBe(10);
  
      workspaceRight = 700;
      await act(async () => {
        window.dispatchEvent(new Event('focus'));
        await new Promise((resolve) => window.requestAnimationFrame(resolve));
        await new Promise((resolve) => window.requestAnimationFrame(resolve));
      });
  
      expect(Number.parseFloat(previewPanel.style.getPropertyValue('--workspace-page-preview-horizontal-offset'))).toBe(0);
      unmount();
    });
  
  it('aligns the live preview before it becomes visible again', async () => {
      localStorage.setItem('xmsgi-preview-layout', JSON.stringify({ visible: true }));
      const { unmount } = await renderWorkspacePage();
      const workspace = document.querySelector('.workspace-page') as HTMLElement;
      const editor = workspace.querySelector('.workspace-page-editor-shell') as HTMLElement;
      const previewPanel = workspace.querySelector('.workspace-page-preview-panel') as HTMLElement;
      const previewWindow = previewPanel.querySelector('.chat-preview-window') as HTMLElement;
      const workspaceMain = workspace.querySelector('.workspace-page-main') as HTMLElement;
  
      Object.defineProperty(editor, 'getBoundingClientRect', {
        configurable: true,
        value: () => ({ left: 0, right: 400, top: 0, bottom: 260, width: 400, height: 260 }),
      });
      Object.defineProperty(previewWindow, 'getBoundingClientRect', {
        configurable: true,
        value: () => ({ left: 420, right: 680, top: 0, bottom: 260, width: 260, height: 260 }),
      });
      Object.defineProperty(previewPanel, 'getBoundingClientRect', {
        configurable: true,
        value: () => ({ left: 420, right: 680, top: 0, bottom: 260, width: 260, height: 260 }),
      });
      Object.defineProperty(workspaceMain, 'getBoundingClientRect', {
        configurable: true,
        value: () => ({ left: 0, right: 1100, top: 0, bottom: 260, width: 1100, height: 260 }),
      });
      Object.defineProperty(previewPanel, 'offsetWidth', { configurable: true, value: 260 });
      Object.defineProperty(previewWindow, 'offsetWidth', { configurable: true, value: 260 });
  
      try {
        await act(async () => {
          (document.querySelector('button[aria-label="Hide preview"]') as HTMLButtonElement).click();
        });
        await act(async () => {
          (document.querySelector('button[aria-label="Show preview"]') as HTMLButtonElement).click();
        });
  
        const offset = Number.parseFloat(previewPanel.style.getPropertyValue('--workspace-page-preview-horizontal-offset') || '0');
        expect(offset).toBe(12);
      } finally {
        unmount();
      }
    });
  
  it('registers the existing draft editor for History Drawer draft actions', async () => {
      const registerDraftOpener = vi.fn();
      const { unmount } = await renderWorkspacePage({ onRegisterHistoryDraftOpener: registerDraftOpener });
      const draft = {
        id: 'history-draft-1',
        name: 'History draft',
        body: 'Draft opened from history',
        createdAt: '2026-09-29T17:00:00.000Z',
        updatedAt: '2026-09-29T18:00:00.000Z',
      };
  
      expect(registerDraftOpener).toHaveBeenCalledWith(expect.any(Function));
      await act(async () => {
        registerDraftOpener.mock.calls[0][0](draft);
      });
  
      expect(document.querySelector('.workspace-page-rich-text-draft-stage.is-active')).not.toBeNull();
      unmount();
    });

  it('opens a draft from Posts on the main editor screen', async () => {
      const registerDraftUseHandler = vi.fn();
      const { unmount } = await renderWorkspacePage({ onRegisterHistoryDraftUseHandler: registerDraftUseHandler });
      const draft = {
        id: 'history-draft-use-1',
        name: 'Draft from Posts',
        body: 'Edit this saved draft',
        color: 'coral' as const,
        createdAt: '2026-09-29T17:00:00.000Z',
        updatedAt: '2026-09-29T18:00:00.000Z',
      };

      expect(registerDraftUseHandler).toHaveBeenCalledWith(expect.any(Function));
      await act(async () => {
        await registerDraftUseHandler.mock.calls[0][0](draft);
      });

      expect(document.querySelector('.workspace-page-rich-text-draft-stage.is-active')).toBeNull();
      expect(document.querySelector<HTMLInputElement>('[aria-label="Draft name"]')).toBeNull();
      expect(document.querySelector('[aria-label="Post content"]')).toHaveTextContent('Edit this saved draft');
      expect(document.querySelector('.workspace-page-publish-main')).toHaveClass('is-draft');
      expect(document.querySelector('.workspace-page-publish-main')).toHaveTextContent('Save draft');
      unmount();
    });
});
