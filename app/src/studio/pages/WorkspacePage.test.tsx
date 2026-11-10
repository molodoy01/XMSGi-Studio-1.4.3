import { act } from 'react';
import { describe, expect, it } from 'vitest';
import { workspacePageStyles, plannerNotificationStyles, globalStyles, colorThemeStyles, themeTokenStyles, renderWorkspacePage } from './WorkspacePage.testUtils';

describe('WorkspacePage version history restore colors', () => {
  it('keeps the restore action readable in the light theme, including when disabled', () => {
    expect(colorThemeStyles).toMatch(
      /html\[data-theme='light'\] \.workspace-page-version-history-restore\s*\{[^}]*color:\s*#8f3434;/,
    );
    expect(colorThemeStyles).toMatch(
      /html\[data-theme='light'\] \.workspace-page-version-history-restore:disabled\s*\{[^}]*color:\s*#65717a;[^}]*opacity:\s*1;/,
    );
  });
});

describe('WorkspacePage editor line breaks', () => {
  it('keeps contenteditable line breaks inline so Enter advances by one row', () => {
    const lineBreakRule = workspacePageStyles.match(/\.workspace-page-rich-text-input br\s*\{([^}]*)\}/)?.[1] ?? '';

    expect(lineBreakRule).not.toMatch(/display:\s*block/);
  });
});

describe('WorkspacePage publish action colors', () => {
  it('fills the editor card with the input and toolbar whether preview is shown or hidden', () => {
    expect(workspacePageStyles).toMatch(
      /\.workspace-page-editor-shell\s*\{[^}]*width:\s*min\(100%, 815px\);/,
    );
    expect(workspacePageStyles).toMatch(
      /html\.electron-runtime \.workspace-page \.workspace-page-rich-text-meta-row\s*\{[^}]*position:\s*static;[^}]*flex:\s*0 0 28px;[^}]*justify-content:\s*flex-end;[^}]*gap:\s*6px;[^}]*padding-right:\s*54px;[^}]*padding-left:\s*0;/,
    );
    expect(workspacePageStyles).toMatch(
      /html\.electron-runtime \.workspace-page \.workspace-page-rich-text-editor:not\(\.is-toolbar-active\) \.workspace-page-rich-text-meta-row,\s*html\.electron-runtime \.workspace-page \.workspace-page-rich-text-editor:has\(\.workspace-page-rich-text-input\.is-empty\) \.workspace-page-rich-text-meta-row\s*\{\s*opacity:\s*0\.45;/,
    );
    expect(workspacePageStyles).toMatch(
      /html\.electron-runtime \.workspace-page \.workspace-page-rich-text-meta-row > \.workspace-page-character-count\s*\{[^}]*position:\s*absolute;[^}]*right:\s*48px;[^}]*bottom:\s*-32px;[^}]*display:\s*inline-flex;[^}]*width:\s*56px;[^}]*min-width:\s*56px;[^}]*border:\s*0;[^}]*border-radius:\s*7px;[^}]*background:\s*transparent;[^}]*font-size:\s*13px;[^}]*font-variant-numeric:\s*tabular-nums;/,
    );
    expect(workspacePageStyles).toMatch(
      /html\.electron-runtime \.workspace-page-rich-text-editor \.workspace-page-rich-text-toolbar\.is-airy,\s*html\.electron-runtime \.workspace-page-rich-text-editor\.is-toolbar-active \.workspace-page-rich-text-toolbar\.is-airy\s*\{\s*min-height:\s*34px;\s*margin:\s*4px 0 0 auto;\s*transform:\s*none;/,
    );
    expect(workspacePageStyles).toMatch(
      /html\.electron-runtime \.workspace-page \.workspace-page-rich-text-meta-row > \.workspace-page-rich-text-clear\s*\{[^}]*position:\s*absolute;[^}]*right:\s*20px;[^}]*bottom:\s*-32px;[^}]*width:\s*28px;[^}]*height:\s*28px;/,
    );
    expect(workspacePageStyles).toMatch(
      /html\.electron-runtime \.workspace-page \.workspace-page-rich-text-meta-row > \.workspace-page-rich-text-clear svg\s*\{\s*width:\s*22px;\s*height:\s*22px;/,
    );
    expect(workspacePageStyles).toMatch(
      /html\.electron-runtime \.workspace-page \.workspace-page-rich-text-meta-row > \.workspace-page-rich-text-clear:hover:not\(:disabled\),\s*html\.electron-runtime \.workspace-page \.workspace-page-rich-text-meta-row > \.workspace-page-rich-text-clear:focus-visible:not\(:disabled\)\s*\{\s*background:\s*rgba\(var\(--editor-outline\), 0\.06\);\s*color:\s*var\(--editor-outline-bright\);\s*box-shadow:\s*none;\s*transform:\s*none;/,
    );
    expect(workspacePageStyles).toMatch(
      /html\.electron-runtime \.workspace-page \.workspace-page-rich-text-meta-row > \.workspace-page-rich-text-clear:not\(\.is-hidden\)\s*\{[^}]*visibility:\s*visible;[^}]*pointer-events:\s*auto;/,
    );
    expect(workspacePageStyles).toMatch(
      /html\.electron-runtime \.workspace-page \.workspace-page-rich-text-meta-row > \.workspace-page-rich-text-clear\.is-hidden\s*\{[^}]*visibility:\s*visible;[^}]*pointer-events:\s*none;/,
    );
    expect(workspacePageStyles).toMatch(
      /html\.electron-runtime \.workspace-page \.workspace-page-rich-text-editor \.workspace-page-rich-text-toolbar\.is-airy\s*\{[^}]*position:\s*absolute;[^}]*top:\s*0;[^}]*right:\s*0;[^}]*left:\s*auto;[^}]*width:\s*max-content;[^}]*justify-content:\s*flex-start;[^}]*padding:\s*3px 6px 1px;[^}]*border:\s*0;[^}]*background:\s*transparent;[^}]*box-shadow:\s*none;[^}]*transform:\s*translateY\(-4px\);/,
    );
    expect(workspacePageStyles).toMatch(
      /html\.electron-runtime\[data-theme='light'\] \.workspace-page \.workspace-page-rich-text-editor \.workspace-page-rich-text-toolbar\.is-airy\s*\{\s*right:\s*21px;\s*transform:\s*translateY\(-9px\);/,
    );
    expect(workspacePageStyles).toMatch(
      /html\.electron-runtime \.workspace-page \.workspace-page-rich-text-toolbar\.is-airy button svg\s*\{\s*transform:\s*translateY\(-1px\);/,
    );
    expect(workspacePageStyles).toMatch(
      /html\.electron-runtime \.workspace-page \.workspace-page-rich-text-toolbar\.is-airy button:not\(\.workspace-page-editor-export-option\):hover:not\(:disabled\),\s*html\.electron-runtime \.workspace-page \.workspace-page-rich-text-toolbar\.is-airy button:not\(\.workspace-page-editor-export-option\):focus-visible:not\(:disabled\)\s*\{\s*border-color:\s*transparent !important;\s*border-radius:\s*7px !important;\s*background:\s*rgba\(154, 168, 184, 0\.14\) !important;\s*color:\s*var\(--text\) !important;\s*transform:\s*none !important;\s*box-shadow:\s*none !important;/,
    );
    expect(workspacePageStyles).toMatch(
      /html\.electron-runtime\[data-theme='light'\] \.workspace-page \.workspace-page-rich-text-toolbar\.is-airy button:not\(\.workspace-page-editor-export-option\):hover:not\(:disabled\),\s*html\.electron-runtime\[data-theme='light'\] \.workspace-page \.workspace-page-rich-text-toolbar\.is-airy button:not\(\.workspace-page-editor-export-option\):focus-visible:not\(:disabled\)\s*\{\s*background:\s*rgba\(154, 168, 184, 0\.11\) !important;/,
    );
    expect(workspacePageStyles).toMatch(
      /\.workspace-page-rich-text-toolbar\.is-airy > button:nth-child\(n\)\s*\{\s*min-width:\s*32px;/,
    );
    expect(workspacePageStyles).toMatch(
      /html\.electron-runtime \.workspace-page \.workspace-page-rich-text-stage\s*\{\s*margin-bottom:\s*0;/,
    );
    expect(workspacePageStyles).toMatch(
      /html\.electron-runtime \.workspace-page-main:has\(\.workspace-page-preview-panel\[data-visible='false'\]\) \.workspace-page-editor-shell\s*\{[^}]*width:\s*min\(100%, 815px\);[^}]*margin-inline:\s*auto;/,
    );
    expect(workspacePageStyles).not.toMatch(
      /workspace-page-rich-text-editor:has\(\.workspace-page-rich-text-chat-stage\.is-active, \.workspace-page-rich-text-template-stage\.is-active\)::before/,
    );
    expect(workspacePageStyles).toMatch(
      /html\.electron-runtime \.workspace-page \.workspace-page-rich-text-stage:has\(\.workspace-page-rich-text-chat-stage\.is-active, \.workspace-page-rich-text-template-stage\.is-active, \.workspace-page-rich-text-schedule-stage\.is-active\)\s*\{[^}]*max-height:\s*none;[^}]*margin-bottom:\s*0;/,
    );
    expect(workspacePageStyles).toMatch(
      /html\.electron-runtime \.workspace-page \.workspace-page-editor-shell:has\(\.workspace-page-rich-text-chat-stage\.is-active, \.workspace-page-rich-text-template-stage\.is-active, \.workspace-page-rich-text-schedule-stage\.is-active\) \.workspace-page-rich-text-editor\s*\{[^}]*width:\s*100%;[^}]*max-width:\s*none;/,
    );
    expect(workspacePageStyles).toMatch(
      /html\.electron-runtime \.workspace-page \.workspace-page-rich-text-stage > \.workspace-page-rich-text-stage-view\.is-active:not\(\.workspace-page-textarea\)\s*\{[^}]*justify-self:\s*center;[^}]*width:\s*calc\(100% \+ 20px\);[^}]*max-width:\s*none;[^}]*margin-bottom:\s*8px;[^}]*margin-inline:\s*auto;/,
    );
    expect(workspacePageStyles).toMatch(
      /html\.electron-runtime \.workspace-page \.workspace-page-rich-text-stage > \.workspace-page-chat-stage\.is-active\s*\{[^}]*justify-self:\s*stretch;[^}]*width:\s*calc\(100% \+ 20px\);[^}]*max-width:\s*none;[^}]*margin-inline:\s*auto;/,
    );
    expect(workspacePageStyles).toMatch(
      /@media \(max-width: 1100px\)[\s\S]*?html\.electron-runtime \.workspace-page \.workspace-page-editor-shell:has\(\.workspace-page-rich-text-chat-stage\.is-active, \.workspace-page-rich-text-template-stage\.is-active, \.workspace-page-rich-text-schedule-stage\.is-active\) \.workspace-page-rich-text-editor\s*\{[^}]*width:\s*100%;[^}]*max-width:\s*none;/,
    );
    expect(workspacePageStyles).toMatch(
      /@media \(max-width: 1100px\)[\s\S]*?html\.electron-runtime \.workspace-page \.workspace-page-rich-text-stage > \.workspace-page-rich-text-stage-view\.is-active:not\(\.workspace-page-textarea\)\s*\{[^}]*width:\s*calc\(100% \+ 20px\);[^}]*max-width:\s*none;[^}]*margin-inline:\s*auto;/,
    );
    expect(workspacePageStyles).toMatch(
      /@media \(max-width: 1100px\)[\s\S]*?html\.electron-runtime \.workspace-page \.workspace-page-rich-text-stage > \.workspace-page-chat-stage\.is-active\s*\{[^}]*width:\s*calc\(100% \+ 20px\);[^}]*max-width:\s*none;[^}]*margin-inline:\s*auto;/,
    );
    expect(workspacePageStyles).toMatch(
      /@media \(max-width: 1100px\)[\s\S]*?html\.electron-runtime \.workspace-page \.workspace-page-editor-shell:has\(\.workspace-page-rich-text-input\.is-active\) \.workspace-page-rich-text-input\s*\{\s*justify-self:\s*start;\s*width:\s*calc\(100% \+ 20px\);\s*max-width:\s*none;\s*margin-left:\s*-10px;/,
    );
    expect(workspacePageStyles).toMatch(
      /@media \(max-width: 1100px\)[\s\S]*?html\.electron-runtime \.workspace-page \.workspace-page-rich-text-stage:has\(\.workspace-page-rich-text-input\.is-active\)::before\s*\{\s*right:\s*-10px;\s*left:\s*0;/,
    );
    expect(workspacePageStyles).toMatch(
      /@media \(max-width: 1100px\)[\s\S]*?html\.electron-runtime \.workspace-page \.workspace-page-rich-text-stage:has\(\.workspace-page-rich-text-chat-stage\.is-active, \.workspace-page-rich-text-template-stage\.is-active\)\s*\{\s*overflow:\s*visible;/,
    );
    expect(workspacePageStyles).toMatch(
      /@media \(min-width: 1101px\)[\s\S]*?html\.electron-runtime \.workspace-page \.workspace-page-rich-text-stage:has\(\.workspace-page-rich-text-chat-stage\.is-active, \.workspace-page-rich-text-template-stage\.is-active\)\s*\{\s*overflow:\s*visible;/,
    );
    expect(workspacePageStyles).toMatch(
      /@media \(min-width: 1101px\)[\s\S]*?html\.electron-runtime \.workspace-page \.workspace-page-rich-text-stage > \.workspace-page-rich-text-chat-stage\.is-active,\s*html\.electron-runtime \.workspace-page \.workspace-page-rich-text-stage > \.workspace-page-rich-text-template-stage\.is-active\s*\{\s*justify-self:\s*stretch;\s*width:\s*calc\(100% \+ 13px\);\s*max-width:\s*none;\s*margin-right:\s*-13px;\s*margin-left:\s*0;/,
    );
    expect(workspacePageStyles).toMatch(
      /@media \(max-width: 1100px\)[\s\S]*?html\.electron-runtime \.workspace-page \.workspace-page-rich-text-stage > \.workspace-page-rich-text-chat-stage\.is-active,\s*html\.electron-runtime \.workspace-page \.workspace-page-rich-text-stage > \.workspace-page-rich-text-template-stage\.is-active\s*\{\s*justify-self:\s*stretch;\s*width:\s*calc\(100% \+ 12px\);\s*max-width:\s*none;\s*margin-right:\s*-12px;\s*margin-left:\s*0;/,
    );
    expect(workspacePageStyles).toMatch(
      /html\.electron-runtime\[data-theme='light'\] \.workspace-page \.workspace-page-rich-text-stage:has\(\.workspace-page-rich-text-chat-stage\.is-active, \.workspace-page-rich-text-template-stage\.is-active\)::after\s*\{\s*bottom:\s*0;\s*z-index:\s*10;/,
    );
    expect(workspacePageStyles).toMatch(
      /html\.electron-runtime \.workspace-page \.workspace-page-editor-shell \.workspace-page-form-row-body\s*\{[^}]*padding-right:\s*4px;[^}]*padding-left:\s*4px;/,
    );
    expect(workspacePageStyles).toMatch(
      /html\.electron-runtime \.workspace-page \.workspace-page-editor-shell \.workspace-page-action-row\s*\{[^}]*padding-right:\s*8px;[^}]*padding-left:\s*8px;/,
    );
    expect(workspacePageStyles).toMatch(
      /html\.electron-runtime\[data-theme='light'\] \.workspace-page \.workspace-page-editor-shell \.workspace-page-action-row\.workspace-page-schedule-row\s*\{\s*padding-top:\s*5px;\s*padding-bottom:\s*5px;/,
    );
    expect(workspacePageStyles).toMatch(
      /@media \(max-width: 1100px\)[\s\S]*?html\.electron-runtime \.workspace-page \.workspace-page-rich-text-meta-row > \.workspace-page-character-count\s*\{[^}]*bottom:\s*-44px;[\s\S]*?html\.electron-runtime \.workspace-page \.workspace-page-rich-text-meta-row > \.workspace-page-rich-text-clear\s*\{[^}]*bottom:\s*-44px;/,
    );
    expect(workspacePageStyles).toMatch(
      /html\.electron-runtime \.workspace-page \.workspace-page-editor-shell:has\(\.workspace-page-rich-text-input\.is-active\) \.workspace-page-rich-text-editor,\s*html\.electron-runtime \.workspace-page \.workspace-page-editor-shell:has\(\.workspace-page-rich-text-input\.is-active\) \.workspace-page-rich-text-input\s*\{[^}]*width:\s*100%;[^}]*max-width:\s*none;/,
    );
    expect(workspacePageStyles).toMatch(
      /@media \(max-width: 1100px\)[\s\S]*?html\.electron-runtime \.workspace-page \.workspace-page-editor-shell:has\(\.workspace-page-rich-text-input\.is-active\) \.workspace-page-rich-text-editor,\s*html\.electron-runtime \.workspace-page \.workspace-page-editor-shell:has\(\.workspace-page-rich-text-input\.is-active\) \.workspace-page-rich-text-input\s*\{[^}]*width:\s*100%;[^}]*max-width:\s*none;/,
    );
    expect(workspacePageStyles).toMatch(
      /@media \(max-width: 1100px\)[\s\S]*?html\.electron-runtime \.workspace-page \.workspace-page-rich-text-stage > \.workspace-page-textarea\.workspace-page-rich-text-stage-view\.is-active:not\(\.workspace-page-rich-text-input\)\s*\{[^}]*width:\s*calc\(100% \+ 20px\);[^}]*max-width:\s*none;/,
    );
    expect(workspacePageStyles).not.toMatch(
      /@media \(max-width: 1100px\)[\s\S]*?html\.electron-runtime \.workspace-page \.workspace-page-editor-shell:has\(\.workspace-page-rich-text-input\.is-active\) \.workspace-page-rich-text-input\s*\{[^}]*justify-self:\s*center;[^}]*width:\s*calc\(100% \+ 20px\);[^}]*max-width:\s*none;/,
    );
    expect(workspacePageStyles).toMatch(
      /@media \(max-width: 1100px\)[\s\S]*?html\.electron-runtime \.workspace-page \.workspace-page-rich-text-meta-row > \.workspace-page-character-count\s*\{[^}]*bottom:\s*-44px;/,
    );
    expect(workspacePageStyles).toMatch(
      /@media \(max-width: 1100px\)[\s\S]*?html\.electron-runtime \.workspace-page \.workspace-page-rich-text-meta-row > \.workspace-page-rich-text-clear\s*\{[^}]*bottom:\s*-44px;/,
    );
    expect(workspacePageStyles).toMatch(
      /\.workspace-page-rich-text-template-stage \.workspace-page-template-stage-footer \.workspace-page-template-stage-add\s*\{\s*border-radius:\s*999px;/,
    );
    expect(colorThemeStyles).toMatch(
      /html\[data-theme='light'\] \.workspace-page \.workspace-page-rich-text-template-stage > \.workspace-page-template-stage-footer \.workspace-page-template-stage-add\s*\{\s*border-radius:\s*999px !important;/,
    );
    expect(colorThemeStyles).toMatch(
      /html\[data-theme\] \.workspace-page \.workspace-page-rich-text-stage-view button\s*\{\s*border-radius:\s*999px !important;/,
    );
    expect(workspacePageStyles).toMatch(
      /@media \(max-width: 1100px\)[\s\S]*?html\.electron-runtime \.workspace-page \.workspace-page-rich-text-scrollbar-track\s*\{\s*flex-basis:\s*12px;\s*width:\s*12px;\s*margin-left:\s*-7px;\s*background:\s*linear-gradient\(to right, transparent 7px, rgba\(255, 255, 255, 0\.035\) 7px\);/,
    );
    expect(workspacePageStyles).toMatch(
      /@media \(max-width: 1100px\)[\s\S]*?html\.electron-runtime \.workspace-page \.workspace-page-rich-text-scrollbar-thumb::before\s*\{\s*left:\s*7px;/,
    );
    expect(workspacePageStyles).toMatch(
      /@media \(max-width: 1100px\)[\s\S]*?html\.electron-runtime \.workspace-page \.workspace-page-rich-text-editor \.workspace-page-rich-text-toolbar\.is-airy\s*\{[^}]*position:\s*absolute;[^}]*top:\s*0;[^}]*right:\s*0;[^}]*width:\s*max-content;[^}]*max-width:\s*100%;[^}]*transform:\s*translateY\(-4px\);/,
    );
    expect(workspacePageStyles).toMatch(
      /@media \(max-width: 1100px\)[\s\S]*?html\.electron-runtime \.workspace-page \.workspace-page-rich-text-meta-row > \.workspace-page-character-count\s*\{[^}]*position:\s*absolute;[^}]*right:\s*48px;[^}]*bottom:\s*-44px;[^}]*width:\s*56px;[^}]*min-width:\s*56px;/,
    );
    expect(workspacePageStyles).toMatch(
      /@media \(max-width: 1100px\)[\s\S]*?html\.electron-runtime \.workspace-page \.workspace-page-rich-text-meta-row > \.workspace-page-rich-text-clear\s*\{[^}]*position:\s*absolute;[^}]*right:\s*20px;[^}]*bottom:\s*-44px;[^}]*width:\s*28px;[^}]*height:\s*28px;/,
    );
    expect(workspacePageStyles).toMatch(
      /@media \(max-width: 1100px\)[\s\S]*?html\.electron-runtime\[data-theme='light'\] \.workspace-page \.workspace-page-rich-text-editor \.workspace-page-rich-text-toolbar\.is-airy\s*\{\s*right:\s*6px;\s*transform:\s*translateY\(-9px\);/,
    );
    expect(workspacePageStyles).toMatch(
      /@media \(max-width: 1100px\)[\s\S]*?html\.electron-runtime\[data-theme='dark'\] \.workspace-page \.workspace-page-rich-text-editor \.workspace-page-rich-text-toolbar\.is-airy\s*\{\s*right:\s*5px;\s*transform:\s*translate\(-3px, -9px\);/,
    );
    expect(workspacePageStyles).toMatch(
      /@media \(max-width: 1100px\)[\s\S]*?html\.electron-runtime \.workspace-page \.workspace-page-rich-text-toolbar\.is-airy button:not\(\.workspace-page-editor-export-option\),\s*html\.electron-runtime \.workspace-page \.workspace-page-rich-text-toolbar\.is-airy \.workspace-page-rich-text-tool-icon-trigger\s*\{\s*width:\s*32px;\s*min-width:\s*32px;\s*height:\s*32px;\s*min-height:\s*32px;/,
    );
    expect(workspacePageStyles).toMatch(
      /@media \(max-width: 1100px\)[\s\S]*?html\.electron-runtime \.workspace-page-rich-text-toolbar\.is-airy button:not\(\.workspace-page-editor-export-option\)\s*\{\s*width:\s*26px;\s*min-width:\s*26px;\s*height:\s*26px;\s*min-height:\s*26px;/,
    );
    expect(workspacePageStyles).toMatch(
      /html\.electron-runtime \.workspace-page \.workspace-page-editor-shell \.workspace-page-action-row\.workspace-page-schedule-row\s*\{[^}]*display:\s*flex;[^}]*width:\s*100%;[^}]*flex-wrap:\s*nowrap;[^}]*justify-content:\s*space-between;/,
    );
    expect(workspacePageStyles).toMatch(
      /html\.electron-runtime \.workspace-page \.workspace-page-editor-shell \.workspace-page-schedule-row > \.workspace-page-submit-actions\s*\{[^}]*flex:\s*0 0 auto;[^}]*margin-left:\s*auto;/,
    );
  });

  it('preserves desktop action button sizes in compact Electron windows', () => {
    expect(workspacePageStyles).toMatch(
      /@media \(max-width: 1100px\)[\s\S]*?html\.electron-runtime \.workspace-page \.workspace-page-editor-shell \.workspace-page-schedule-row > \.workspace-page-action-left-group \.workspace-page-mode-button,[\s\S]*?\.workspace-page-schedule-compact-button\s*\{\s*flex:\s*0 0 auto !important;\s*width:\s*auto !important;\s*min-width:\s*82px !important;[\s\S]*?height:\s*40px !important;[\s\S]*?font-size:\s*13px !important;/,
    );
    expect(workspacePageStyles).toMatch(
      /html\.electron-runtime \.workspace-page \.workspace-page-editor-shell \.workspace-page-schedule-row > \.workspace-page-submit-actions \.workspace-page-publish-main\s*\{\s*flex:\s*0 0 120px !important;\s*width:\s*120px !important;\s*min-width:\s*120px !important;/,
    );
    expect(workspacePageStyles).toMatch(
      /html\.electron-runtime \.workspace-page \.workspace-page-editor-shell \.workspace-page-schedule-row \.workspace-page-media-row \.workspace-page-attachment-toggle,[\s\S]*?\.workspace-page-preview-toggle\s*\{\s*flex:\s*0 0 40px !important;\s*width:\s*40px !important;[\s\S]*?height:\s*40px !important;/,
    );
  });

  it('hides the Studio section title while keeping the editor section labelled', () => {
    expect(workspacePageStyles).toMatch(
      /\.workspace-page \.workspace-page-editor-title-text\s*\{\s*visibility:\s*hidden;/,
    );
    expect(workspacePageStyles).toMatch(
      /\.workspace-page \.chat-preview-toolbar-label\s*\{\s*visibility:\s*hidden;/,
    );
    expect(workspacePageStyles).toMatch(
      /@media \(max-width: 1100px\)\s*\{\s*html\.electron-runtime \.workspace-page \.chat-preview-toolbar-label\s*\{\s*display:\s*none;/,
    );
    expect(workspacePageStyles).not.toMatch(/\.workspace-page \.workspace-page-editor-heading\s*\{\s*display:\s*none/);
  });

  it('matches the scheduled publish label size to the menu option', () => {
    expect(workspacePageStyles).toMatch(
      /\.workspace-page-publish-main\.is-scheduled \.workspace-page-publish-trigger-main\s*\{[^}]*font-size:\s*12px;[^}]*letter-spacing:\s*0\.1em;[^}]*overflow-wrap:\s*normal;[^}]*white-space:\s*nowrap;/,
    );
    expect(workspacePageStyles).toMatch(
      /\.workspace-page-publish-menu-compact \.workspace-page-publish-option span\s*\{[^}]*font-size:\s*12px;[^}]*letter-spacing:\s*0\.02em;/,
    );
  });

  it('slightly enlarges the English send label in the main publish button', () => {
    expect(workspacePageStyles).toMatch(
      /\.workspace-page-publish-main\.is-send \.workspace-page-publish-trigger-main\.is-english\s*\{\s*font-size:\s*13px;/,
    );
  });

  it('keeps the active arrow contour animation but removes its pointer-positioned highlight after pointer leave', () => {
    expect(workspacePageStyles).toMatch(
      /\.workspace-page-submit-actions \.workspace-page-publish-menu-toggle\.is-active:not\(:hover\):not\(:focus-visible\)::after\s*\{\s*background:\s*conic-gradient\(\s*rgba\(238, 250, 255, 0\.38\),\s*rgba\(188, 231, 250, 0\.24\),\s*rgba\(238, 250, 255, 0\.38\)\s*\);/,
    );
    expect(workspacePageStyles).toMatch(
      /\.workspace-page-submit-actions \.workspace-page-publish-menu-toggle\.is-active::after,[\s\S]*?animation:\s*workspace-action-rim-breathe 2\.4s ease-in-out infinite;/,
    );
  });

  it('uses the same typography for every publish mode option', () => {
    expect(workspacePageStyles).toMatch(
      /\.workspace-page \.workspace-page-submit-actions \.workspace-page-publish-menu-compact \.workspace-page-publish-option span\s*\{[^}]*font-size:\s*12px !important;[^}]*font-weight:\s*600;[^}]*letter-spacing:\s*0\.1em;/,
    );
    expect(workspacePageStyles).not.toContain('.workspace-page-publish-menu-compact.is-russian');
  });

  it('keeps current-action value typography close to its unchanged label', () => {
    expect(workspacePageStyles).toMatch(
      /\.workspace-page-mode-summary-label\s*\{[^}]*font-size:\s*12px;[^}]*font-weight:\s*600;[^}]*letter-spacing:\s*0\.14em;/,
    );
    expect(workspacePageStyles).toMatch(
      /\.workspace-page-mode-summary strong\s*\{[^}]*font-family:\s*inherit;[^}]*font-size:\s*12px;[^}]*font-weight:\s*500;[^}]*letter-spacing:\s*0\.14em;/,
    );
  });

  it('places two publish mode buttons over and under the primary action without a panel', () => {
    expect(workspacePageStyles).toMatch(
      /\.workspace-page \.workspace-page-submit-actions \.workspace-page-publish-main-wrap\s*\{[^}]*position:\s*relative;[^}]*width:\s*112px;/,
    );
    expect(workspacePageStyles).toMatch(
      /@media \(min-width: 761px\) and \(max-width: 1100px\)\s*\{\s*\.workspace-page \.workspace-page-submit-actions \.workspace-page-publish-main-wrap\s*\{[^}]*width:\s*clamp\(90px,\s*18vw,\s*140px\);/,
    );
    expect(workspacePageStyles).toMatch(
      /@media \(max-width: 760px\)\s*\{\s*html\.electron-runtime \.workspace-page \.workspace-page-submit-actions \.workspace-page-publish-main-wrap\s*\{[^}]*width:\s*clamp\(92px,\s*14vw,\s*116px\);/,
    );
    expect(workspacePageStyles).toMatch(
      /@media \(min-width: 761px\)\s*\{\s*html\.electron-runtime \.workspace-page \.workspace-page-submit-actions \.workspace-page-publish-main-wrap\s*\{[^}]*width:\s*120px !important;[^}]*max-width:\s*120px !important;/,
    );
    expect(workspacePageStyles).toMatch(
      /html\.electron-runtime \.workspace-page \.workspace-page-submit-actions \.workspace-page-publish-main-wrap > \.workspace-page-publish-main\s*\{[^}]*width:\s*120px !important;/,
    );
    expect(workspacePageStyles).toMatch(
      /html\.electron-runtime \.workspace-page \.workspace-page-submit-actions \.workspace-page-publish-menu-compact \.workspace-page-publish-option\s*\{[^}]*width:\s*120px !important;[^}]*min-width:\s*120px !important;[^}]*max-width:\s*120px !important;/,
    );
    expect(workspacePageStyles).toMatch(
      /\.workspace-page-submit-actions \.workspace-page-publish-menu-compact\s*\{[^}]*position:\s*absolute;[^}]*top:\s*50%;[^}]*height:\s*0;[^}]*pointer-events:\s*none;/,
    );
    expect(workspacePageStyles).toMatch(
      /\.workspace-page-publish-choice-slot\.is-above\s*\{\s*transform:\s*translateY\(calc\(-100% - 6px\)\);/,
    );
    expect(workspacePageStyles).toMatch(
      /\.workspace-page-publish-choice-slot\.is-below\s*\{\s*transform:\s*translateY\(6px\);/,
    );
    expect(workspacePageStyles).toMatch(
      /\.workspace-page \.workspace-page-submit-actions \.workspace-page-publish-menu-compact \.workspace-page-publish-option span\s*\{[^}]*font-size:\s*12px !important;[^}]*font-weight:\s*600;[^}]*letter-spacing:\s*0\.1em;[^}]*text-transform:\s*uppercase;/,
    );
    expect(workspacePageStyles).toMatch(
      /\.workspace-page \.workspace-page-submit-actions \.workspace-page-publish-main-wrap > \.workspace-page-publish-main\s*\{[^}]*width:\s*100% !important;[^}]*min-width:\s*100% !important;[^}]*max-width:\s*100%;[^}]*box-sizing:\s*border-box !important;/,
    );
    expect(workspacePageStyles).toMatch(
      /\.workspace-page \.workspace-page-submit-actions \.workspace-page-publish-menu-compact \.workspace-page-publish-option\s*\{[^}]*width:\s*100% !important;[^}]*min-width:\s*100% !important;[^}]*max-width:\s*100% !important;[^}]*height:\s*38px !important;[^}]*min-height:\s*38px !important;[^}]*max-height:\s*38px !important;[^}]*box-sizing:\s*border-box !important;/,
    );
    expect(workspacePageStyles).toMatch(
      /\.workspace-page \.workspace-page-submit-actions \.workspace-page-publish-main-wrap\.is-menu-open > \.workspace-page-publish-main\s*\{[^}]*visibility:\s*hidden;[^}]*pointer-events:\s*none;/,
    );
  });

  it('keeps the editor field fixed and scrolls long text inside it', () => {
    const activeEditorRule = workspacePageStyles.match(
      /\.workspace-page-rich-text-input\.is-active\s*\{([^}]*)\}/,
    )?.[1] ?? '';

    expect(activeEditorRule).toMatch(/box-sizing:\s*border-box;/);
    expect(activeEditorRule).toMatch(/width:\s*100%;/);
    expect(activeEditorRule).toMatch(/max-width:\s*100%;/);
    expect(activeEditorRule).toMatch(/min-height:\s*0;/);
    expect(activeEditorRule).toMatch(/max-height:\s*100%;/);
    expect(activeEditorRule).toMatch(/overflow-x:\s*hidden;/);
    expect(activeEditorRule).toMatch(/overflow-y:\s*auto;/);
    expect(activeEditorRule).toMatch(/overscroll-behavior-y:\s*contain;/);
    expect(activeEditorRule).toMatch(/overflow-anchor:\s*none;/);

    expect(workspacePageStyles).toMatch(
      /\.workspace-page-rich-text-stage\s*\{[^}]*grid-template-rows:\s*minmax\(0, 1fr\);[^}]*overflow:\s*hidden;/,
    );
    expect(workspacePageStyles).toMatch(
      /\.workspace-page-rich-text-stage-shell\s*\{[^}]*display:\s*flex;[^}]*gap:\s*7px;/,
    );
    expect(workspacePageStyles).toMatch(
      /\.workspace-page-rich-text-stage:has\(\.workspace-page-rich-text-input\.is-active\)\s*\{[^}]*box-sizing:\s*border-box;[^}]*padding-left:\s*10px;/,
    );
    expect(workspacePageStyles).toMatch(
      /\.workspace-page-rich-text-scrollbar-track\s*\{[^}]*position:\s*relative;[^}]*flex:\s*0 0 5px;/,
    );
    expect(workspacePageStyles).not.toMatch(/\.workspace-page-rich-text-input\.is-expanded/);
  });

  it('uses dark message notification surfaces for the dark chat wallpaper in light theme', () => {
    expect(colorThemeStyles).toMatch(/html\[data-theme='light'\] \.workspace-page \.chat-preview-window\.theme-telegram \.chat-preview-history-entry\s*\{[^}]*background:\s*rgba\(19, 30, 42, 0\.94\);[^}]*color:\s*#e7edf3;/);
    expect(colorThemeStyles).toMatch(/html\[data-theme='light'\] \.workspace-page \.chat-preview-window\.theme-telegram \.chat-preview-history-entry\.is-outgoing\s*\{[^}]*background:\s*rgba\(31, 57, 78, 0\.96\);/);
    expect(colorThemeStyles).toMatch(/html\[data-theme='light'\] \.workspace-page \.chat-preview-window\.theme-custom \.chat-preview-history-entry\s*\{[^}]*background:\s*rgba\(19, 30, 42, 0\.94\);[^}]*color:\s*#e7edf3;/);
    expect(colorThemeStyles).toMatch(/html\[data-theme='light'\] \.workspace-page \.chat-preview-window\.theme-custom \.chat-preview-history-entry\.is-outgoing\s*\{[^}]*background:\s*rgba\(31, 57, 78, 0\.96\);/);
  });

  it('uses a cohesive dark palette for publishing controls', () => {
    expect(themeTokenStyles).toMatch(/:root\[data-theme='dark'\]\s*\{[\s\S]*?--void:\s*#0e1317;[\s\S]*?--surface-raised:\s*#182127;[\s\S]*?--surface-muted:\s*#202a31;[\s\S]*?--surface-hover:\s*#29363e;/);
    expect(colorThemeStyles).toMatch(/html\[data-theme='dark'\] \.quick-planner-workbench\s*\{[^}]*linear-gradient\(155deg, #19232a, #141b20\);/);
    expect(colorThemeStyles).toMatch(/html\[data-theme='dark'\] \.workspace-page-editor-shell\s*\{[^}]*border-color:\s*#35434c;[^}]*radial-gradient\(ellipse 88% 48% at 50% 0%, rgba\(35, 157, 251, 0\.035\), transparent 74%\),\s*linear-gradient\(155deg, #19232a, #141b20\);/);
    expect(colorThemeStyles).toMatch(/html\[data-theme='dark'\] \.workspace-page\s*\{\s*color-scheme:\s*dark;\s*background:\s*radial-gradient\(ellipse 72% 62% at 45% 42%, rgba\(35, 157, 251, 0\.045\), transparent 78%\), var\(--void\);/);
    expect(colorThemeStyles).toMatch(/html\[data-theme='dark'\] \.workspace-page-editor-shell:not\(\[data-editor-appearance='outline'\]\):has\(\.workspace-page-rich-text-editor\.is-toolbar-active\)\s*\{\s*border-color:\s*#35434c;\s*box-shadow:\s*inset 0 0 0 1px rgba\(255, 255, 255, 0\.025\), 0 14px 34px rgba\(0, 0, 0, 0\.24\);/);
    expect(colorThemeStyles).toMatch(/html\[data-theme='dark'\] \.workspace-page-editor-shell:not\(\[data-editor-appearance='outline'\]\)::after\s*\{\s*opacity:\s*0;\s*box-shadow:\s*none;/);
    expect(colorThemeStyles).toMatch(/html\[data-theme='dark'\] \.workspace-page \.workspace-page-editor-shell\[data-editor-appearance='outline'\]:is\(:has\(\.workspace-page-rich-text-input:focus\), :has\(\.workspace-page-rich-text-editor\.is-toolbar-active\)\)\s*\{\s*border-color:\s*#35434c !important;\s*box-shadow:\s*inset 0 0 0 1px rgba\(255, 255, 255, 0\.025\), 0 14px 34px rgba\(0, 0, 0, 0\.24\) !important;/);
    expect(colorThemeStyles).toMatch(/html\[data-theme='light'\] \.workspace-page \.workspace-page-editor-shell\[data-editor-appearance='outline'\]:is\(:has\(\.workspace-page-rich-text-input:focus\), :has\(\.workspace-page-rich-text-editor\.is-toolbar-active\)\)\s*\{\s*border-color:\s*rgba\(var\(--editor-outline\), 0\.3\) !important;\s*box-shadow:\s*0 0 0 1px rgba\(var\(--editor-outline\), 0\.08\), 0 10px 28px rgba\(34, 47, 58, 0\.08\) !important;/);
    expect(colorThemeStyles).toMatch(/html\[data-theme='dark'\] \.workspace-page \.workspace-page-editor-shell\[data-editor-appearance='outline'\]:is\(:has\(\.workspace-page-rich-text-input:focus\), :has\(\.workspace-page-rich-text-editor\.is-toolbar-active\)\)::after,\s*html\[data-theme='light'\] \.workspace-page \.workspace-page-editor-shell\[data-editor-appearance='outline'\]:is\(:has\(\.workspace-page-rich-text-input:focus\), :has\(\.workspace-page-rich-text-editor\.is-toolbar-active\)\)::after\s*\{\s*opacity:\s*0\.5 !important;\s*border-color:\s*rgba\(var\(--editor-outline\), 0\.26\) !important;/);
    expect(colorThemeStyles).not.toMatch(/\.workspace-page-editor-shell\[data-editor-appearance='outline'\]:hover/);
    expect(colorThemeStyles).toMatch(/html\[data-theme='dark'\] \.history-drawer\.is-page \.history-list-status-section \.history-status-tab\.is-active\s*\{[^}]*rgba\(35, 157, 251, 0\.14\)/);
    expect(colorThemeStyles).toMatch(/html\[data-theme='dark'\] \.workspace-page-submit-actions \.workspace-page-publish-main:not\(:disabled\)\s*\{\s*border-color:\s*#34414a !important;\s*background:\s*var\(--surface-muted\) !important;\s*color:\s*#d4dde3 !important;/);
  });

  it('retains the light publish palette and aligns the dark publish button with other controls', () => {
    expect(workspacePageStyles).toMatch(
      /html\[data-theme='light'\] \.workspace-page \.workspace-page-submit-actions \.workspace-page-publish-main:is\(\.is-send, \.is-scheduled, \.is-draft\):not\(:disabled\)\s*\{\s*border-color:\s*#d7dfe4 !important;\s*background:\s*#f0f2f4 !important;\s*color:\s*#3a4650 !important;/,
    );
    expect(workspacePageStyles).toMatch(
      /html\[data-theme='light'\] \.workspace-page \.workspace-page-submit-actions \.workspace-page-publish-main:is\(\.is-send, \.is-scheduled, \.is-draft\):is\(:hover, :focus-visible\):not\(:disabled\)\s*\{\s*border-color:\s*#239dfb !important;\s*background:\s*#239dfb !important;\s*color:\s*#ffffff !important;/,
    );
    expect(workspacePageStyles).toMatch(
      /html\[data-theme='dark'\] \.workspace-page \.workspace-page-submit-actions \.workspace-page-publish-main:is\(\.is-send, \.is-scheduled, \.is-draft\):not\(:disabled\)\s*\{\s*border-color:\s*#34414a !important;\s*background:\s*var\(--surface-muted\) !important;\s*color:\s*#d4dde3 !important;\s*box-shadow:\s*none !important;/,
    );
  });

  it('keeps light-theme editor action buttons on one tint and slightly widens Send', () => {
    expect(colorThemeStyles).toMatch(
      /html\[data-theme='light'\] \.workspace-page \.workspace-page-action-row\.workspace-page-schedule-row > \.workspace-page-submit-actions > \.workspace-page-publish-main:is\(\.is-send, \.is-scheduled, \.is-draft\),[\s\S]*?\{\s*border-color:\s*#c2d2db !important;\s*background:\s*#eaf1f5 !important;[\s\S]*?color:\s*#405a68 !important;/,
    );
    expect(colorThemeStyles).toMatch(
      /\.workspace-page-action-row\.workspace-page-schedule-row > \.workspace-page-action-left-group > \.workspace-page-preview-toggle:is\(:hover, :focus-visible, :active, \.is-active, \[aria-pressed='true'\]\),[\s\S]*?\{\s*border-color:\s*#c2d2db !important;\s*background:\s*#eaf1f5 !important;/,
    );
    expect(colorThemeStyles).toMatch(
      /\.workspace-page-submit-actions > \.workspace-page-publish-main:is\(\.is-send, \.is-scheduled, \.is-draft\):hover:not\(:disabled\),[\s\S]*?\{\s*border-color:\s*#c2d2db !important;\s*background:\s*#eaf1f5 !important;/,
    );
    expect(colorThemeStyles).toMatch(
      /\.workspace-page-action-left-group > \.workspace-page-preview-toggle:is\(:hover, :focus-visible\):not\(:disabled\),[\s\S]*?\{\s*border-color:\s*#91afbf !important;\s*background:\s*#d7e6ed !important;/,
    );
    expect(colorThemeStyles).toMatch(
      /workspace-page-submit-actions > \.workspace-page-publish-main\s*\{\s*flex:\s*0 0 120px !important;\s*width:\s*120px !important;\s*min-width:\s*120px !important;/,
    );
    expect(colorThemeStyles).toMatch(
      /@media \(max-width:\s*480px\)\s*\{\s*html\[data-theme='light'\][\s\S]*?workspace-page-submit-actions > \.workspace-page-publish-main\s*\{\s*flex-basis:\s*96px !important;\s*width:\s*96px !important;\s*min-width:\s*96px !important;/,
    );
  });

  it('highlights the full saved-draft row instead of the name button alone', () => {
    expect(workspacePageStyles).toMatch(/html\[data-theme='light'\] \.workspace-page \.workspace-page-rich-text-template-stage\.workspace-page-rich-text-draft-stage \.workspace-page-template-stage-item:is\(:hover, :focus-within\)\s*\{\s*border-radius:\s*6px;\s*background:\s*#edf2f5 !important;/);
    expect(workspacePageStyles).toMatch(/html\[data-theme='dark'\] \.workspace-page \.workspace-page-rich-text-template-stage\.workspace-page-rich-text-draft-stage \.workspace-page-template-stage-item:is\(:hover, :focus-within\)\s*\{\s*border-radius:\s*6px;\s*background:\s*#20272c !important;/);
    expect(workspacePageStyles).toMatch(/rich-text-template-stage\.workspace-page-rich-text-draft-stage \.workspace-page-template-stage-item button:hover:not\(:disabled\):not\(\.is-selected\),[\s\S]*?button:focus-visible:not\(:disabled\):not\(\.is-selected\)\s*\{\s*border-color:\s*transparent !important;\s*background:\s*transparent !important;\s*background-color:\s*transparent !important;\s*background-image:\s*none !important;\s*box-shadow:\s*none !important;/);
  });

  it('uses the saved-draft row highlight for template items', () => {
    expect(workspacePageStyles).toMatch(/html\[data-theme='light'\] \.workspace-page \.workspace-page-rich-text-template-stage:not\(\.workspace-page-rich-text-draft-stage\) \.workspace-page-template-stage-item:is\(:hover, :focus-within\)\s*\{\s*border-radius:\s*6px;\s*background:\s*#f5fafc !important;/);
    expect(workspacePageStyles).toMatch(/html\[data-theme='dark'\] \.workspace-page \.workspace-page-rich-text-template-stage:not\(\.workspace-page-rich-text-draft-stage\) \.workspace-page-template-stage-item:is\(:hover, :focus-within\)\s*\{\s*border-radius:\s*6px;\s*background:\s*#20272c !important;/);
    expect(colorThemeStyles).toMatch(/html\[data-theme='light'\] \.workspace-page \.workspace-page-rich-text-template-stage:not\(\.workspace-page-rich-text-draft-stage\) \.workspace-page-template-stage-item:hover,[\s\S]*?background:\s*#f5fafc !important;/);
    expect(colorThemeStyles).toMatch(/html\[data-theme='dark'\] \.workspace-page \.workspace-page-rich-text-template-stage:not\(\.workspace-page-rich-text-draft-stage\) \.workspace-page-template-stage-item:hover,[\s\S]*?background:\s*#20272c !important;/);
    expect(workspacePageStyles).toMatch(/rich-text-template-stage:not\(\.workspace-page-rich-text-draft-stage\) \.workspace-page-template-stage-item button:hover:not\(:disabled\):not\(\.is-selected\),[\s\S]*?button:focus-visible:not\(:disabled\):not\(\.is-selected\)\s*\{\s*border-color:\s*transparent !important;\s*background:\s*transparent !important;\s*background-color:\s*transparent !important;\s*background-image:\s*none !important;\s*box-shadow:\s*none !important;/);
  });

  it('adapts template search colors and focus state to both themes', () => {
    expect(colorThemeStyles).toMatch(/html\[data-theme='dark'\] \.workspace-page \.workspace-page-rich-text-template-stage \.workspace-page-template-stage-search input,[\s\S]*?background:\s*#151b20 !important;[\s\S]*?color:\s*#e2e7eb;/);
    expect(colorThemeStyles).toMatch(/html\[data-theme='dark'\] \.workspace-page \.workspace-page-rich-text-template-stage \.workspace-page-template-stage-search input:focus,[\s\S]*?border-color:\s*#239dfb;[\s\S]*?box-shadow:\s*0 0 0 2px rgba\(35, 157, 251, 0\.18\);/);
    expect(colorThemeStyles).toMatch(/html\[data-theme='light'\] \.workspace-page \.workspace-page-rich-text-template-stage \.workspace-page-template-stage-search input\s*\{[^}]*background:\s*#ffffff !important;[^}]*color:\s*#26343d !important;/);
    expect(colorThemeStyles).toMatch(/html\[data-theme='light'\] \.workspace-page \.workspace-page-rich-text-template-stage \.workspace-page-template-stage-search input:focus\s*\{[^}]*border-color:\s*#8ab8cf !important;[^}]*box-shadow:\s*0 0 0 3px rgba\(71, 124, 158, 0\.14\) !important;/);
  });

  it('forces the template search field to a compact height', () => {
    expect(workspacePageStyles).toMatch(/\.workspace-page \.workspace-page-rich-text-template-stage \.workspace-page-template-stage-search input\s*\{[^}]*height:\s*24px !important;[^}]*min-height:\s*24px !important;/);
    expect(workspacePageStyles).toMatch(/\.workspace-page-template-stage-search\s*\{[^}]*flex:\s*0 1 180px;[^}]*max-width:\s*220px;[^}]*margin:\s*0 0 0 auto;/);
  });

  it('reduces the full template footer height with compact navigation buttons', () => {
    expect(workspacePageStyles).toMatch(/\.workspace-page-rich-text-template-stage > \.workspace-page-template-stage-footer\s*\{[^}]*min-height:\s*24px !important;[^}]*padding:\s*0 4px !important;/);
    expect(workspacePageStyles).toMatch(/\.workspace-page-rich-text-template-stage \.workspace-page-template-stage-footer \.workspace-page-stage-secondary,[\s\S]*?\.workspace-page-stage-primary\s*\{[^}]*height:\s*22px;[^}]*min-height:\s*22px !important;/);
  });

  it('matches the chat selection footer height to the compact template footer', () => {
    expect(workspacePageStyles).toMatch(/\.workspace-page-rich-text-chat-stage \.workspace-page-chat-stage-footer\s*\{[^}]*min-height:\s*24px !important;[^}]*padding:\s*0 4px !important;/);
    expect(workspacePageStyles).toMatch(/\.workspace-page-rich-text-chat-stage \.workspace-page-chat-stage-footer \.workspace-page-stage-secondary,[\s\S]*?\.workspace-page-stage-primary\s*\{[^}]*height:\s*22px;[^}]*min-height:\s*22px !important;/);
    expect(workspacePageStyles).toMatch(/\.workspace-page-rich-text-chat-stage \.workspace-page-chat-stage-add,[\s\S]*?\.workspace-page-chat-favorites-filter\s*\{[^}]*height:\s*22px;[^}]*min-height:\s*22px !important;/);
  });

  it('aligns the schedule back and done buttons with the chat selection footer', () => {
    expect(workspacePageStyles).toMatch(/\.workspace-page-rich-text-schedule-stage > \.workspace-page-schedule-footer\s*\{[^}]*align-items:\s*center;[^}]*min-height:\s*24px !important;[^}]*padding:\s*0 4px !important;/);
    expect(workspacePageStyles).toMatch(/\.workspace-page-rich-text-schedule-stage \.workspace-page-schedule-footer \.workspace-page-stage-secondary,[\s\S]*?\.workspace-page-stage-primary\s*\{[^}]*height:\s*22px;[^}]*min-height:\s*22px !important;/);
  });

  it('improves light-theme contrast for compact template and chat footer controls', () => {
    expect(colorThemeStyles).toMatch(/html\[data-theme='light'\] \.workspace-page \.workspace-page-rich-text-template-stage > \.workspace-page-template-stage-footer \.workspace-page-stage-secondary,[\s\S]*?\.workspace-page-rich-text-chat-stage > \.workspace-page-chat-stage-footer \.workspace-page-chat-favorites-filter\s*\{[^}]*border:\s*1px solid #bdcfd8 !important;[^}]*background:\s*#f1f6f8 !important;[^}]*color:\s*#35566a !important;/);
    expect(colorThemeStyles).toMatch(/html\[data-theme='light'\] \.workspace-page \.workspace-page-rich-text-template-stage > \.workspace-page-template-stage-footer \.workspace-page-stage-primary,[\s\S]*?\.workspace-page-rich-text-chat-stage > \.workspace-page-chat-stage-footer \.workspace-page-stage-primary\s*\{[^}]*background:\s*#dcecf4 !important;[^}]*color:\s*#294f65 !important;/);
    expect(colorThemeStyles).toMatch(/html\[data-theme='light'\] \.workspace-page \.workspace-page-rich-text-template-stage > \.workspace-page-template-stage-footer button:hover:not\(:disabled\),[\s\S]*?\.workspace-page-rich-text-chat-stage > \.workspace-page-chat-stage-footer button:focus-visible:not\(:disabled\)\s*\{[^}]*background:\s*#e2eff4 !important;[^}]*color:\s*#244b62 !important;/);
  });

  it('removes the light-theme wallpaper picker strip and scrollbar', () => {
    expect(colorThemeStyles).toMatch(/html\[data-theme='light'\] \.workspace-page \.chat-preview-wallpaper-quick-picker\s*\{[^}]*padding:\s*0;[^}]*border:\s*0;[^}]*background:\s*transparent;[^}]*box-shadow:\s*none;[^}]*scrollbar-width:\s*none;/);
    expect(colorThemeStyles).toMatch(/html\[data-theme='light'\] \.workspace-page \.chat-preview-wallpaper-quick-picker::-webkit-scrollbar\s*\{\s*display:\s*none;/);
  });

  it('gives desktop live-preview menu buttons contrast against the light menu surface', () => {
    expect(colorThemeStyles).toMatch(/html\[data-theme='light'\] \.workspace-page \.chat-preview-stand \.chat-preview-options-menu \.chat-preview-expand\s*\{[^}]*border:\s*1px solid #c8d3da;[^}]*background:\s*#e6ecef;[^}]*color:\s*#344854;/);
    expect(colorThemeStyles).toMatch(/html\[data-theme='light'\] \.workspace-page \.chat-preview-stand \.chat-preview-options-menu \.chat-preview-expand:hover,[\s\S]*?background:\s*#d3dfe5;[\s\S]*?color:\s*#243b49;/);
  });

  it('adapts mobile status and header controls to custom wallpapers in light theme', () => {
    expect(colorThemeStyles).toMatch(/html\[data-theme='light'\] \.workspace-page \.chat-preview-stand\.is-mobile \.chat-preview-window\.theme-custom \.chat-preview-mobile-system-bar\s*\{[^}]*background:\s*rgba\(242, 246, 248, 0\.82\);[^}]*color:\s*#263b49;/);
    expect(colorThemeStyles).toMatch(/html\[data-theme='light'\] \.workspace-page \.chat-preview-stand\.is-mobile \.chat-preview-window\.theme-custom \.chat-preview-header\s*\{[^}]*background:\s*rgba\(242, 246, 248, 0\.9\);[^}]*color:\s*#36444d;/);
    expect(colorThemeStyles).toMatch(/html\[data-theme='light'\] \.workspace-page \.chat-preview-stand\.is-mobile \.chat-preview-window\.theme-custom \.chat-preview-header-copy strong\s*\{\s*color:\s*#26343d;/);
    expect(colorThemeStyles).toMatch(/html\[data-theme='light'\] \.workspace-page \.chat-preview-stand\.is-mobile \.chat-preview-window\.theme-custom \.chat-preview-mobile-back,[\s\S]*?\.chat-preview-header-actions > \.chat-preview-expand\s*\{[^}]*border:\s*1px solid transparent;[^}]*background:\s*transparent;[^}]*color:\s*#2d4554;/);
    expect(colorThemeStyles).toMatch(/html\[data-theme='light'\] \.workspace-page \.chat-preview-stand\.is-mobile \.chat-preview-window\.theme-custom \.chat-preview-mobile-back:hover,[\s\S]*?\.chat-preview-header-actions > \.chat-preview-expand:focus-visible\s*\{[^}]*background:\s*rgba\(38, 59, 73, 0\.08\);[^}]*color:\s*#1d3442;/);
    expect(colorThemeStyles).toMatch(/html\[data-theme='light'\] \.workspace-page \.chat-preview-stand\.is-mobile \.chat-preview-window\.theme-custom \.chat-preview-composer\s*\{[^}]*background:\s*rgba\(242, 246, 248, 0\.9\);[^}]*color:\s*#476170;/);
    expect(colorThemeStyles).toMatch(/html\[data-theme='light'\] \.workspace-page \.chat-preview-stand\.is-mobile \.chat-preview-window\.theme-custom \.chat-preview-composer-input\s*\{[^}]*background:\s*rgba\(255, 255, 255, 0\.78\);[^}]*color:\s*#738590;/);
  });

  it('spaces the draft color swatches and flashes only the missing input on save', () => {
    expect(workspacePageStyles).toMatch(/workspace-page-draft-color-field \.draft-color-control \.draft-color-picker\s*\{\s*transform:\s*translateX\(-8px\);/);
    expect(workspacePageStyles).toMatch(/workspace-page-draft-field-attention :is\(input, textarea\)\s*\{\s*animation:\s*workspace-page-draft-focus-pulse 1\.1s ease-in-out 2;/);
    expect(workspacePageStyles).toMatch(/--draft-focus-pulse-shadow:\s*0 0 0 3px rgba\(71, 124, 158, 0\.14\);/);
    expect(workspacePageStyles).toMatch(/--draft-focus-pulse-shadow:\s*0 0 0 2px rgba\(35, 157, 251, 0\.18\);/);
    expect(workspacePageStyles).toMatch(/@keyframes workspace-page-draft-focus-pulse\s*\{[\s\S]*?box-shadow:\s*var\(--draft-focus-pulse-shadow\);/);
  });

  it('removes rectangular active backgrounds from draft sort color filters', () => {
    expect(workspacePageStyles).toMatch(
      /html\[data-theme\] \.workspace-page \.workspace-page-rich-text-draft-stage \.workspace-page-draft-color-filter:is\(:hover, :focus, :focus-visible, :active, \[aria-pressed='true'\]\)\s*\{[^}]*background:\s*transparent !important;[^}]*background-color:\s*transparent !important;[^}]*box-shadow:\s*none !important;[^}]*transform:\s*none !important;/,
    );
    expect(workspacePageStyles).toMatch(
      /workspace-page-draft-color-filter:is\(:hover, :focus, :focus-visible, :active, \[aria-pressed='true'\]\) > span:not\(\.workspace-page-draft-color-dot\)\s*\{[^}]*background:\s*transparent !important;[^}]*background-color:\s*transparent !important;/,
    );
    expect(workspacePageStyles).toMatch(
      /workspace-page-draft-color-filter\[aria-pressed='true'\] \.workspace-page-draft-color-dot\s*\{[^}]*background:\s*var\(--draft-swatch-color\) !important;[^}]*box-shadow:\s*0 0 0 2px var\(--draft-swatch-color\), 0 0 7px 1px color-mix\(in srgb, var\(--draft-swatch-color\) 56%, transparent\) !important;/,
    );
    expect(workspacePageStyles).toMatch(/\.workspace-page-draft-color-filter:hover \.workspace-page-draft-color-dot\s*\{\s*transform:\s*scale\(1\.08\);/);
    expect(workspacePageStyles).toMatch(
      /html\[data-theme='light'\] \.workspace-page \.workspace-page-rich-text-draft-stage \.workspace-page-draft-color-filters \.workspace-page-draft-color-filter:is\(:hover, :focus-visible\) \.workspace-page-draft-color-dot\s*\{[^}]*border:\s*1px solid rgba\(255, 255, 255, 0\.9\) !important;[^}]*box-shadow:\s*0 0 0 2px var\(--draft-swatch-color\), 0 0 7px 1px color-mix\(in srgb, var\(--draft-swatch-color\) 56%, transparent\) !important;/,
    );
    expect(workspacePageStyles).toMatch(
      /html\[data-theme='dark'\] \.workspace-page \.workspace-page-rich-text-draft-stage \.workspace-page-draft-color-filters \.workspace-page-draft-color-filter:is\(:hover, :focus-visible\) \.workspace-page-draft-color-dot\s*\{[^}]*border:\s*1px solid rgba\(255, 255, 255, 0\.9\) !important;[^}]*box-shadow:\s*0 0 0 2px var\(--draft-swatch-color\), 0 0 7px 1px color-mix\(in srgb, var\(--draft-swatch-color\) 56%, transparent\) !important;/,
    );
    expect(workspacePageStyles).not.toMatch(/html\[data-theme\] \.workspace-page .*workspace-page-draft-color-filter .*workspace-page-draft-color-dot\.is-selected\s*\{/);
    expect(colorThemeStyles).not.toMatch(/workspace-page-draft-footer \.workspace-page-schedule-summary\.has-draft-color-picker .*draft-color-swatch:is\(:hover, :focus-visible\)/);
  });

  it('fixes the black selected-swatch background only in the open new-draft form', () => {
    expect(workspacePageStyles).toMatch(
      /html\[data-theme\] \.workspace-page \.workspace-page-rich-text-draft-stage\.has-draft-editor \.workspace-page-draft-color-field \.draft-color-picker \.draft-color-swatch:is\(:hover, :focus-visible, \.is-selected\)\s*\{[^}]*background:\s*var\(--draft-swatch-color\) !important;[^}]*background-color:\s*var\(--draft-swatch-color\) !important;[^}]*box-shadow:\s*0 0 0 2px var\(--draft-swatch-color\), 0 0 7px 1px color-mix\(in srgb, var\(--draft-swatch-color\) 56%, transparent\) !important;[^}]*transform:\s*none !important;/,
    );
    expect(workspacePageStyles).not.toMatch(/html\[data-theme\] \.workspace-page \.workspace-page-rich-text-draft-stage \.draft-color-picker \.draft-color-swatch/);
  });

  it('uses the open draft form color ring in the draft footer picker', () => {
    expect(workspacePageStyles).toMatch(
      /html\[data-theme\] \.workspace-page \.workspace-page-draft-footer \.workspace-page-schedule-summary\.has-draft-color-picker \.draft-color-picker \.draft-color-swatch:is\(:hover, :focus-visible, \.is-selected\)\s*\{[^}]*background:\s*var\(--draft-swatch-color\) !important;[^}]*box-shadow:\s*0 0 0 2px var\(--draft-swatch-color\), 0 0 7px 1px color-mix\(in srgb, var\(--draft-swatch-color\) 56%, transparent\) !important;[^}]*transform:\s*none !important;/,
    );
  });

  it('colors the selected draft color name to match its swatch', () => {
    expect(workspacePageStyles).toMatch(/\.draft-color-selected-label\[data-color='gray'\]\s*\{\s*color:\s*#8b929a;/);
    expect(workspacePageStyles).toMatch(/\.draft-color-selected-label\[data-color='coral'\]\s*\{\s*color:\s*#e56f68;/);
    expect(workspacePageStyles).toMatch(/\.draft-color-selected-label\[data-color='amber'\]\s*\{\s*color:\s*#d9a13c;/);
    expect(workspacePageStyles).toMatch(/\.draft-color-selected-label\[data-color='green'\]\s*\{\s*color:\s*#55a87c;/);
    expect(workspacePageStyles).toMatch(/\.draft-color-selected-label\[data-color='teal'\]\s*\{\s*color:\s*#269ca3;/);
    expect(workspacePageStyles).toMatch(/\.draft-color-selected-label\[data-color='blue'\]\s*\{\s*color:\s*#548ed3;/);
  });

  it('reveals saved draft color names only when the color dot is hovered or focused', () => {
    expect(workspacePageStyles).toMatch(/\.workspace-page-draft-color-indicator\s*\{[^}]*position:\s*relative;/);
    expect(workspacePageStyles).toMatch(/\.workspace-page-draft-color-indicator::after\s*\{[^}]*position:\s*absolute;[^}]*right:\s*calc\(100% \+ 6px\);[^}]*content:\s*attr\(data-color-label\);[^}]*opacity:\s*0;/);
    expect(workspacePageStyles).toMatch(/\.workspace-page-draft-color-indicator:hover::after,[\s\S]*?\.workspace-page-draft-color-indicator:focus-visible::after\s*\{[^}]*opacity:\s*1;[^}]*transform:\s*translate\(0, -50%\);/);
    expect(workspacePageStyles).toMatch(/\.workspace-page-rich-text-draft-stage \.workspace-page-template-stage-item strong\s*\{[^}]*overflow:\s*visible;/);
    expect(workspacePageStyles).toMatch(/\.workspace-page-template-stage-item > button:first-child\s*\{[^}]*overflow:\s*visible;/);
    expect(workspacePageStyles).toMatch(/\.workspace-page-draft-color-indicator\s*\{[^}]*z-index:\s*1;[^}]*padding:\s*4px 0;/);
  });

  it('styles draft color filters like the editor swatches with counts', () => {
    expect(workspacePageStyles).toMatch(/\.workspace-page-draft-color-filters\s*\{[^}]*display:\s*flex;[^}]*align-items:\s*center;/);
    expect(workspacePageStyles).toMatch(/\.workspace-page-draft-selected-color\s*\{[^}]*font-size:\s*12px;[^}]*font-weight:\s*400;[^}]*letter-spacing:\s*0\.08em;[^}]*line-height:\s*1\.4;[^}]*text-transform:\s*uppercase;/);
    expect(workspacePageStyles).toMatch(/\.workspace-page-draft-color-filter \.workspace-page-draft-color-dot\s*\{[^}]*width:\s*18px;[^}]*height:\s*18px;[^}]*border:\s*1px solid rgba\(245, 247, 250, 0\.42\);[^}]*box-shadow:\s*inset 0 0 0 1px color-mix\(in srgb, var\(--draft-swatch-color\) 72%, transparent\);/);
    expect(workspacePageStyles).toMatch(/\.draft-color-picker \.draft-color-swatch\s*\{[^}]*width:\s*18px;[^}]*height:\s*18px;[^}]*flex:\s*0 0 18px;/);
    expect(workspacePageStyles).not.toMatch(/\.workspace-page-rich-text-draft-stage \.workspace-page-draft-color-filters \.workspace-page-draft-color-filter:is\(:hover, :focus-visible\)\s*\{[^}]*box-shadow:\s*none !important;/);
    expect(workspacePageStyles).toMatch(/\.workspace-page-draft-color-filter \.workspace-page-draft-color-dot\.is-selected\s*\{[^}]*border:\s*1px solid rgba\(255, 255, 255, 0\.9\);[^}]*box-shadow:\s*inset 0 0 0 2px color-mix\(in srgb, var\(--draft-swatch-color\) 72%, transparent\), 0 0 6px color-mix\(in srgb, var\(--draft-swatch-color\) 56%, transparent\) !important;/);
    expect(workspacePageStyles).toMatch(/\.workspace-page-draft-color-filter:hover \.workspace-page-draft-color-dot\s*\{\s*transform:\s*scale\(1\.08\);/);
    expect(workspacePageStyles).toMatch(/\.workspace-page-draft-color-filters \.workspace-page-draft-color-dot\[data-color='coral'\]\s*\{[^}]*--draft-swatch-color:\s*#e56f68;/);
    expect(workspacePageStyles).toMatch(/\.workspace-page-draft-list-header\s*\{[^}]*align-items:\s*center;/);
    expect(workspacePageStyles).toMatch(/\.workspace-page-draft-color-filters\s*\{[^}]*margin-left:\s*auto;/);
  });

  it('keeps attachment remove icons consistent across narrow and wide layouts', () => {
    expect(colorThemeStyles).toMatch(/html\[data-theme='light'\] \.workspace-page \.workspace-page-attachment-remove\s*\{\s*color:\s*#536a78;/);
    expect(colorThemeStyles).not.toMatch(/html\[data-theme='light'\] \.workspace-page \.workspace-page-attachment-remove\s*\{[^}]*text-shadow:/);
    expect(workspacePageStyles).toMatch(/\.workspace-page-attachment-remove\s*\{[^}]*top:\s*50%;[^}]*right:\s*3px;[^}]*width:\s*20px;[^}]*height:\s*20px;[^}]*background:\s*transparent;[^}]*transform:\s*translateY\(-50%\);/);
    expect(workspacePageStyles).not.toMatch(/@media \(max-width: 760px\)\s*\{[^}]*\.workspace-page-attachment-remove\s*\{/);
    expect(colorThemeStyles).not.toMatch(/@media \(max-width: 760px\)\s*\{[^}]*\.workspace-page-attachment-remove/);
    expect(workspacePageStyles).toMatch(
      /\.workspace-page-attachment-remove\s*\{[^}]*font-size:\s*17px;[^}]*line-height:\s*1;/,
    );
    expect(workspacePageStyles).toMatch(
      /\.workspace-page-attachment-card:has\(\.workspace-page-attachment-remove:hover\),\s*\.workspace-page-attachment-card:has\(\.workspace-page-attachment-remove:focus-visible\)\s*\{[^}]*background-color:\s*rgba\(120, 48, 44, 0\.28\);/,
    );
    expect(colorThemeStyles).toMatch(
      /html\[data-theme='light'\] \.workspace-page \.workspace-page-attachment-card:has\(\.workspace-page-attachment-remove:hover\),\s*html\[data-theme='light'\] \.workspace-page \.workspace-page-attachment-card:has\(\.workspace-page-attachment-remove:focus-visible\)\s*\{[^}]*background-color:\s*#fbefed;/,
    );
    expect(workspacePageStyles).toMatch(
      /\.workspace-page-attachment-remove:hover,\s*\.workspace-page-attachment-remove:focus-visible\s*\{[^}]*background:\s*transparent;/,
    );
    expect(colorThemeStyles).toMatch(
      /html\[data-theme='light'\] \.workspace-page \.workspace-page-attachment-remove:hover,[\s\S]*?background:\s*transparent;/,
    );
  });

  it('keeps draft footer buttons the same compact height as template stage buttons', () => {
    expect(workspacePageStyles).toMatch(
      /\.workspace-page-rich-text-draft-stage \.workspace-page-draft-stage-footer \.workspace-page-stage-secondary,\s*\.workspace-page-rich-text-draft-stage \.workspace-page-draft-stage-footer \.workspace-page-stage-primary\s*\{\s*height:\s*22px;\s*min-height:\s*22px !important;\s*padding:\s*0 11px;/,
    );
  });

  it('shortens the draft name input in a narrow open draft editor', () => {
    expect(workspacePageStyles).toMatch(
      /@container draft-stage \(max-width: 900px\)\s*\{[\s\S]*?\.workspace-page-rich-text-draft-stage\.has-draft-editor \.workspace-page-draft-name-row\s*\{\s*grid-template-columns:\s*minmax\(0,\s*1fr\) 260px;[\s\S]*?\.workspace-page-rich-text-draft-stage\.has-draft-editor \.workspace-page-draft-name-field\s*\{\s*width:\s*min\(calc\(100% - 50px\),\s*440px\);/,
    );
    expect(workspacePageStyles).toMatch(
      /\.workspace-page-rich-text-draft-stage\.has-draft-editor \.workspace-page-draft-color-field\s*\{\s*width:\s*260px;\s*min-width:\s*260px;/,
    );
    expect(workspacePageStyles).toMatch(
      /\.workspace-page-rich-text-draft-stage\.has-draft-editor \.draft-color-selected-label\s*\{[^}]*width:\s*auto;[^}]*min-width:\s*36px;[^}]*flex:\s*0 0 auto;[^}]*text-align:\s*right;[^}]*white-space:\s*nowrap;/,
    );
    expect(workspacePageStyles).toMatch(
      /\.workspace-page-rich-text-draft-stage\.has-draft-editor \.workspace-page-draft-color-field \.draft-color-control \.draft-color-picker\s*\{\s*transform:\s*translateX\(-10px\);/,
    );
    expect(workspacePageStyles).toMatch(
      /\.workspace-page-rich-text-draft-stage\.has-draft-editor \.workspace-page-draft-color-field \.draft-color-control\s*\{\s*gap:\s*18px;/,
    );
  });

  it('aligns draft name and body labels with the draft section heading', () => {
    expect(workspacePageStyles).toMatch(
      /\.workspace-page-rich-text-draft-stage\.has-draft-editor \.workspace-page-draft-name-field > span,\s*\.workspace-page-rich-text-draft-stage\.has-draft-editor \.workspace-page-template-stage-editor > label > span,\s*\.workspace-page-rich-text-template-stage:not\(\.workspace-page-rich-text-draft-stage\) \.workspace-page-template-stage-editor > label > span\s*\{\s*margin-left:\s*4px;/,
    );
  });

  it('aligns template editor labels with the template section heading', () => {
    expect(workspacePageStyles).toMatch(
      /\.workspace-page-rich-text-template-stage:not\(\.workspace-page-rich-text-draft-stage\) \.workspace-page-template-stage-editor > label > span/,
    );
  });

  it('matches the template body width and only allows vertical draft body resizing', () => {
    expect(workspacePageStyles).toMatch(
      /\.workspace-page-rich-text-draft-stage \.workspace-page-template-stage-editor label:last-of-type textarea\s*\{\s*box-sizing:\s*border-box;\s*width:\s*100%;\s*min-width:\s*0;\s*max-width:\s*100%;\s*min-height:\s*0;\s*height:\s*100%;\s*resize:\s*vertical;\s*overflow:\s*auto;/,
    );
    expect(workspacePageStyles).not.toMatch(
      /\.workspace-page-rich-text-draft-stage \.workspace-page-template-stage-editor label:last-of-type textarea\s*\{[^}]*overflow:\s*hidden;/,
    );
  });

  it('uses the editor export menu option styling for the draft import menu', () => {
    expect(workspacePageStyles).toMatch(
      /\.workspace-page-editor-export \.workspace-page-editor-export-option,\s*\.workspace-page-draft-import-menu \.workspace-page-editor-export-option\s*\{[^}]*min-height:\s*40px;[^}]*padding:\s*8px 12px;[^}]*border-radius:\s*8px;/,
    );
    expect(colorThemeStyles).toMatch(
      /html\[data-theme='dark'\] \.workspace-page-editor-export-menu \.workspace-page-editor-export-option\s*\{\s*color:\s*#d4dde3 !important;/,
    );
    expect(workspacePageStyles).toMatch(
      /\.workspace-page-editor-export \.workspace-page-editor-export-option:hover,[\s\S]*?\.workspace-page-draft-import-menu \.workspace-page-editor-export-option:focus-visible\s*\{[^}]*background:\s*rgba\(154, 168, 184, 0\.12\);/,
    );
  });

  it('aligns the draft import and export actions next to the add-draft button', () => {
    expect(workspacePageStyles).toMatch(/\.workspace-page-rich-text-draft-stage:not\(\.has-draft-editor\) \.workspace-page-draft-stage-tools\s*\{[^}]*grid-column:\s*2;[^}]*justify-self:\s*end;/);
    expect(workspacePageStyles).toMatch(/\.workspace-page-rich-text-draft-stage:not\(\.has-draft-editor\) \.workspace-page-draft-stage-add\s*\{[^}]*grid-column:\s*3;[^}]*justify-self:\s*end;/);
    expect(workspacePageStyles).not.toMatch(/@container draft-stage \(max-width: 530px\)[\s\S]*?\.workspace-page-rich-text-draft-stage:not\(\.has-draft-editor\) \.workspace-page-draft-stage-tools\s*\{[^}]*grid-row:\s*1;/);
  });

  it('aligns saved draft names at a consistent inset from the left edge', () => {
    expect(workspacePageStyles).toMatch(/\.workspace-page-template-stage-item > button:first-child\s*\{[^}]*grid-template-columns:\s*minmax\(0, 1fr\);/);
    expect(workspacePageStyles).toMatch(/\.workspace-page-rich-text-draft-stage \.workspace-page-template-stage-item strong\s*\{[^}]*position:\s*relative;[^}]*display:\s*block;[^}]*width:\s*100%;/);
    expect(workspacePageStyles).toMatch(/\.workspace-page-rich-text-draft-stage \.workspace-page-template-stage-item strong > \.workspace-page-draft-name\s*\{[^}]*width:\s*100%;[^}]*padding-left:\s*24px;/);
    expect(workspacePageStyles).toMatch(/\.workspace-page-rich-text-draft-stage \.workspace-page-template-stage-item strong > \.workspace-page-draft-color-indicator\s*\{[^}]*left:\s*8px;/);
    expect(workspacePageStyles).toMatch(/\.workspace-page-template-stage-item\s*\{[^}]*padding:\s*5px 6px;/);
  });

  it('keeps saved draft name and summary on one line with improved title typography', () => {
    expect(workspacePageStyles).toMatch(/\.workspace-page \.workspace-page-rich-text-draft-stage \.workspace-page-template-stage-item > button:first-child\s*\{[^}]*display:\s*flex;[^}]*align-items:\s*center;/);
    expect(workspacePageStyles).toMatch(/\.workspace-page \.workspace-page-rich-text-draft-stage \.workspace-page-template-stage-item > button:first-child > strong\s*\{[^}]*font-size:\s*15px;[^}]*font-weight:\s*600;/);
    expect(workspacePageStyles).toMatch(/\.workspace-page \.workspace-page-rich-text-draft-stage \.workspace-page-template-stage-item > button:first-child > \.workspace-page-draft-row-summary\s*\{[^}]*margin-left:\s*auto;[^}]*margin-right:\s*8px;[^}]*font-size:\s*11px;/);
    expect(workspacePageStyles).toMatch(/\.workspace-page \.workspace-page-rich-text-draft-stage \.workspace-page-template-stage-item > button:first-child > \.workspace-page-draft-attachment-summary\s*\{/);
  });
});

describe('WorkspacePage feedback layout', () => {
  it('uses shared semantic feedback colors in Studio and Planner', () => {
    expect(themeTokenStyles).toMatch(/--feedback-error:\s*#b42318;/);
    expect(themeTokenStyles).toMatch(/--feedback-warning:\s*#805500;/);
    expect(themeTokenStyles).toMatch(/--feedback-success:\s*#267544;/);
    expect(workspacePageStyles).toMatch(/\.workspace-page-publish-transient-feedback\.is-error\s*\{[^}]*color:\s*var\(--feedback-error\);/);
    expect(workspacePageStyles).toMatch(/\.workspace-page-publish-transient-feedback\.is-warning,[\s\S]*?color:\s*var\(--feedback-warning\);/);
    expect(workspacePageStyles).toMatch(/\.workspace-page-publish-transient-feedback\.is-success\s*\{[^}]*color:\s*var\(--feedback-success\);/);
    expect(workspacePageStyles).not.toMatch(/html\[data-theme='light'\] \.workspace-page-publish-transient-feedback\.is-error:not\(\.has-detail\),[^{]*\{[^}]*color:\s*inherit;/);
    expect(plannerNotificationStyles).toMatch(/\.quick-planner \.quick-planner-action-feedback\.is-error\s*\{[^}]*color:\s*var\(--feedback-error\);/);
    expect(plannerNotificationStyles).toMatch(
      /\.quick-planner-compose-footer \.quick-planner-action-feedback\.is-connection-status\s*\{[^}]*max-width:\s*min\(560px,\s*calc\(100vw - 32px\)\);[^}]*padding:\s*8px 12px;[^}]*border-radius:\s*8px;[^}]*background:\s*var\(--surface-raised\);[^}]*white-space:\s*nowrap;/,
    );
    expect(workspacePageStyles).toMatch(
      /\.workspace-page-publish-transient-feedback\.is-connection-status\s*\{[^}]*max-width:\s*min\(560px,\s*calc\(100vw - 32px\)\);[^}]*padding:\s*8px 12px;[^}]*border-radius:\s*8px;[^}]*background:\s*var\(--surface-raised\);[^}]*white-space:\s*nowrap;/,
    );
    expect(plannerNotificationStyles).toMatch(/\.quick-planner \.quick-planner-action-feedback\.is-warning,[\s\S]*?color:\s*var\(--feedback-warning\);/);
    expect(plannerNotificationStyles).toMatch(/\.quick-planner \.quick-planner-action-feedback\.is-success\s*\{[^}]*color:\s*var\(--feedback-success\);/);
  });

  it('insets editor warnings and errors forty pixels from the footer edge', () => {
    expect(workspacePageStyles).toMatch(
      /\.workspace-page-publish-transient-feedback\s*\{[^}]*right:\s*40px;/,
    );
    expect(workspacePageStyles).toMatch(
      /\.workspace-page-publish-transient-feedback\.is-mass-warning\s*\{[^}]*left:\s*40px;/,
    );
    expect(workspacePageStyles).toMatch(
      /\.workspace-page-publish-transient-feedback\.is-connection-offline\s*\{[^}]*animation:\s*workspace-publish-feedback-in/,
    );
    expect(workspacePageStyles).toMatch(
      /html\[data-theme='light'\] \.workspace-page-publish-transient-feedback\.is-error\.is-connection-status\s*\{[^}]*max-width:\s*min\(560px,\s*calc\(100vw - 32px\)\);[^}]*padding:\s*8px 12px;[^}]*border-radius:\s*8px;[^}]*white-space:\s*nowrap;/,
    );
    expect(workspacePageStyles).toMatch(
      /html\[data-theme='light'\] \.workspace-page-publish-transient-feedback\.is-progress\.is-connection-status\s*\{[^}]*max-width:\s*min\(560px,\s*calc\(100vw - 32px\)\);[^}]*padding:\s*8px 12px;[^}]*border-radius:\s*8px;[^}]*background:\s*var\(--surface-raised\);[^}]*white-space:\s*nowrap;/,
    );
    expect(workspacePageStyles).toMatch(
      /\.workspace-page-publish-transient-feedback\.is-retriggered\s*\{[^}]*animation:\s*planner-notification-retrigger 620ms ease-out;/,
    );
    expect(globalStyles).toMatch(
      /@keyframes planner-notification-retrigger[\s\S]*?translate:\s*0 -3px;/,
    );
  });
});

describe('WorkspacePage connection status', () => {
  it('shows a spinner while reconnecting and a persistent error after timeout', async () => {
    const view = await renderWorkspacePage({ connectionRecoveryStatus: 'reconnecting' });
    const status = document.querySelector('.workspace-page-publish-transient-feedback');

    expect(status).toHaveAttribute('role', 'status');
    expect(status?.querySelector('.workspace-page-connection-spinner')).toBeInTheDocument();

    view.rerender({ connectionRecoveryStatus: 'offline' });
    const offlineStatus = document.querySelector('.workspace-page-publish-transient-feedback');
    expect(offlineStatus).toHaveAttribute('role', 'alert');
    expect(offlineStatus).toHaveClass('is-connection-offline', 'is-connection-status');
    expect(offlineStatus?.querySelector('.workspace-page-connection-spinner')).not.toBeInTheDocument();
    expect(offlineStatus).toHaveTextContent(/нет соединения|telegram is unavailable/i);
  });

  it('shows the restored connection status in the publish footer until dismissed', async () => {
    const view = await renderWorkspacePage({ connectionRecoveryStatus: 'restored' });
    const status = document.querySelector('.workspace-page-publish-transient-feedback');

    expect(status).toHaveAttribute('role', 'status');
    expect(status).toHaveClass('is-success', 'is-persistent');
    expect(status).toHaveTextContent(/connection restored|подключение восстановлено/i);
    expect(workspacePageStyles).toMatch(
      /\.workspace-page-publish-transient-feedback\.is-persistent\s*\{[^}]*animation-name:\s*workspace-publish-feedback-in;[^}]*animation-duration:\s*360ms;[^}]*animation-delay:\s*0ms;/,
    );

    view.unmount();
  });

  it('restores editor focus when the empty-message warning appears from another stage', async () => {
    const { unmount } = await renderWorkspacePage();

    const templateButton = document.querySelector<HTMLButtonElement>('.workspace-page-mode-button-template');
    expect(templateButton).toBeTruthy();

    await act(async () => {
      templateButton!.click();
    });

    const editor = document.querySelector<HTMLDivElement>('.workspace-page-rich-text-input');
    expect(editor).toBeTruthy();

    const otherField = document.querySelector<HTMLInputElement>('input') ?? editor;
    expect(otherField).toBeTruthy();
    await act(async () => {
      otherField?.focus();
    });

    const sendButton = document.querySelector<HTMLButtonElement>('.workspace-page-publish-main');
    expect(sendButton).toBeTruthy();

    await act(async () => {
      sendButton!.click();
    });

    await act(async () => {
      await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));
    });

    expect(document.activeElement).toBe(editor);
    const feedback = document.querySelector('.workspace-page-publish-transient-feedback');
    expect(feedback).toHaveTextContent(/add a message|enter a message|enter message|введите текст|введите сообщение/i);

    unmount();
  });
});
