import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { telegramGetChatHistory } from '@/services/chatAppService';
import { normalizePlannerDraft, normalizeSavedDraft, normalizeSavedPlannerDraft } from './historyModel';
import { readGlobalStyles, globalStyles, colorThemeStyles, channel, upcomingRecord, workspaceSentRecord, anchoredSentRecord, renderHistoryPage } from './HistoryDrawer.testUtils';

vi.mock('@/services/chatAppService', () => ({
  telegramGetChatHistory: vi.fn(),
}));

describe('Posts page split view', () => {
  beforeEach(() => {
      window.localStorage.removeItem('xmsgi-history-filters');
      window.localStorage.removeItem('xmsgi-history-selected-record');
      window.localStorage.removeItem('xmsgi_dismissed_draft_color_auto_filter');
    });

  it('renders a text-only page title and one close control on the Posts page', () => {
      const { container } = renderHistoryPage([upcomingRecord]);
      const styles = readGlobalStyles();
  
      expect(screen.getByRole('heading', { name: 'Posts' })).toBeInTheDocument();
      expect(container.querySelector('.history-drawer-header-icon')).not.toBeInTheDocument();
      expect(container.querySelectorAll('.history-drawer-close')).toHaveLength(1);
      expect(container.querySelector('.history-drawer-controls')).toBeNull();
      expect(container.querySelector('.history-page-controls-close')).toBeNull();
      expect(styles).toMatch(
        /\.history-drawer-header\.is-page-header\s*\{[^}]*box-sizing:\s*border-box;[^}]*flex:\s*0 0 52px;[^}]*height:\s*52px;[^}]*min-height:\s*52px;/,
      );
      expect(styles).toMatch(/\.topbar\s*\{[^}]*flex:\s*0 0 var\(--app-topbar-height\);[^}]*height:\s*var\(--app-topbar-height\);/);
    });
  
  it('keeps the default selected post header compact on wide layouts', () => {
      const { container } = renderHistoryPage([upcomingRecord]);
      fireEvent.click(container.querySelector('.history-record-open')!);
  
      const detailHeader = container.querySelector('.history-detail-header')!;
      expect(detailHeader.querySelector('.history-detail-topline h2')).toHaveTextContent(upcomingRecord.title);
      expect(detailHeader.querySelector('.history-detail-topline .history-detail-category')).toBeInTheDocument();
      expect(detailHeader.querySelector('.history-detail-topline .history-detail-status')).toBeInTheDocument();
      expect(detailHeader.querySelector('.history-detail-topline time')).toBeInTheDocument();
      expect(detailHeader.querySelector('.history-detail-topline .history-detail-meta')).toBeInTheDocument();
  
      expect(globalStyles).toMatch(
        /\.history-detail-topline\s*\{[^}]*gap:\s*14px;[^}]*min-width:\s*0;/,
      );
      expect(globalStyles).toMatch(
        /\.history-detail-header h2\s*\{[^}]*font-size:\s*22px;[^}]*font-weight:\s*680;[^}]*letter-spacing:\s*-0\.035em;[^}]*overflow:\s*hidden;[^}]*text-overflow:\s*ellipsis;[^}]*white-space:\s*nowrap;/,
      );
      expect(globalStyles).toMatch(
        /@media \(max-width:\s*1120px\)\s*\{\s*\.history-drawer\.is-page \.history-detail-topline\s*\{[^}]*grid-template-areas:\s*"title meta"\s*"heading controls";/,
      );
    });
  
  it('restores the selected post after the Posts page is remounted', async () => {
      const firstView = renderHistoryPage([upcomingRecord]);
      fireEvent.click(firstView.container.querySelector('.history-record-open')!);
      await waitFor(() => {
        expect(window.localStorage.getItem('xmsgi-history-selected-record')).toBe(upcomingRecord.id);
      });
      firstView.unmount();
  
      const { container } = renderHistoryPage([upcomingRecord]);
      await waitFor(() => {
        expect(container.querySelector('.history-detail-panel')).toHaveAttribute('data-selected', 'true');
        expect(container.querySelector('.history-detail-header h2')).toHaveTextContent(upcomingRecord.title);
      });
    });
  
  it('closes the selected post preview and clears its selection after changing category', () => {
      const { container } = renderHistoryPage([upcomingRecord, workspaceSentRecord]);
      fireEvent.click(container.querySelector(`[data-history-record-id="${upcomingRecord.id}"]`)!);
      fireEvent.click(screen.getByRole('button', { name: 'Preview' }));
      expect(container.querySelector('.history-detail-body')).toHaveClass('is-preview');
      fireEvent.click(container.querySelector('[data-history-filter="sent"]')!);

      expect(container.querySelector('.history-detail-panel')).toHaveAttribute('data-selected', 'false');
      expect(container.querySelector('.history-detail-panel h2')).toHaveTextContent('Select a post');
      expect(container.querySelector('.history-detail-body')).not.toBeInTheDocument();
      expect(container.querySelector(`[data-history-record-id="${upcomingRecord.id}"]`)).not.toBeInTheDocument();
      expect(window.localStorage.getItem('xmsgi-history-selected-record')).toBeNull();

      fireEvent.click(container.querySelector('[data-history-filter="scheduled"]')!);
      expect(container.querySelector('.history-detail-panel')).toHaveAttribute('data-selected', 'false');
    });
  
  it('clears the restored post selection when that record no longer exists', async () => {
      window.localStorage.setItem('xmsgi-history-selected-record', upcomingRecord.id);
      const { container } = renderHistoryPage([]);
  
      await waitFor(() => {
        expect(window.localStorage.getItem('xmsgi-history-selected-record')).toBeNull();
        expect(container.querySelector('.history-detail-panel')).toHaveAttribute('data-selected', 'false');
      });
    });
  
  it('keeps search no-results feedback in the left list only', () => {
      const { container } = renderHistoryPage([upcomingRecord]);
      fireEvent.change(screen.getByRole('textbox', { name: 'Search history' }), {
        target: { value: 'no matching post' },
      });
  
      expect(container.querySelector('.history-empty strong')).toHaveTextContent('No results found');
      expect(container.querySelector('.history-detail-panel h2')).toHaveTextContent('Select a post');
      expect(container.querySelector('.history-detail-panel')).not.toHaveTextContent('No results found');
      expect(container.querySelector('.history-detail-panel')).not.toHaveTextContent('Sent');
    });
  
  it('keeps the detail pane empty when search and the selected category have no posts', () => {
      const { container } = renderHistoryPage([upcomingRecord]);
      fireEvent.click(container.querySelector('[data-history-filter="sent"]')!);
      const search = screen.getByRole('textbox', { name: 'Search history' });
  
      fireEvent.change(search, { target: { value: 'no matching post' } });
      expect(container.querySelector('.history-empty strong')).toHaveTextContent('No results found');
      expect(container.querySelector('.history-detail-empty h2')).toHaveTextContent('Nothing to review yet');
  
      fireEvent.change(search, { target: { value: 'шаблонов' } });
      expect(container.querySelector('.history-record-open')).toBeInTheDocument();
      expect(container.querySelector('.history-detail-empty h2')).toHaveTextContent('Select a post');
    });
  
  it('uses a subtle neutral gray for the full dark Posts detail panel', () => {
      expect(colorThemeStyles).toMatch(/html\[data-theme='dark'\] \.history-drawer\.is-page \.history-detail-panel\s*\{[^}]*border-color:\s*var\(--line\);[^}]*background:\s*var\(--surface-raised\);/);
    });
  
  it('uses the shared raised surface for dark Posts date bars and detail panels', () => {
      expect(colorThemeStyles).toMatch(/html\[data-theme='dark'\] \.history-drawer\.is-page \.history-content\.is-page \.history-date-heading,[\s\S]*?background:\s*var\(--surface-raised\);/);
      expect(colorThemeStyles).toMatch(/html\[data-theme='dark'\] \.history-drawer\.is-page \.history-detail-panel\s*\{[^}]*background:\s*var\(--surface-raised\);/);
    });
  
  it('highlights the selected Posts status consistently with a subtle accent capsule', () => {
      expect(colorThemeStyles).toMatch(/html\[data-theme='light'\] \.history-drawer\.is-page \.history-list-status-section \.history-status-tab\.is-active,\s*html\[data-theme='light'\] \.history-drawer\.is-page \.history-list-status-section \.history-status-tab\.is-active:hover,\s*html\[data-theme='light'\] \.history-drawer\.is-page \.history-list-status-section \.history-status-tab\.is-active:focus-visible\s*\{\s*border-color:\s*rgba\(103, 125, 139, 0\.2\);\s*background:\s*#eaf3f7;/);
      expect(colorThemeStyles).toMatch(/html\[data-theme='dark'\] \.history-drawer\.is-page \.history-list-status-section \.history-status-tab\.is-active,\s*html\[data-theme='dark'\] \.history-drawer\.is-page \.history-list-status-section \.history-status-tab\.is-active:hover,\s*html\[data-theme='dark'\] \.history-drawer\.is-page \.history-list-status-section \.history-status-tab\.is-active:focus-visible\s*\{\s*border-color:\s*rgba\(154, 168, 184, 0\.2\);\s*background:\s*rgba\(154, 168, 184, 0\.16\);/);
      expect(colorThemeStyles).toMatch(/html\[data-theme='light'\] \.history-drawer\.is-page \.history-list-status-section \.history-status-tab,\s*html\[data-theme='light'\] \.history-drawer\.is-page \.history-list-status-section \.history-status-tab:hover,\s*html\[data-theme='light'\] \.history-drawer\.is-page \.history-list-status-section \.history-status-tab:focus-visible,\s*html\[data-theme='light'\] \.history-drawer\.is-page \.history-list-status-section \.history-status-tab\.is-active,\s*html\[data-theme='light'\] \.history-drawer\.is-page \.history-list-status-section \.history-status-tab\.is-active:hover,\s*html\[data-theme='light'\] \.history-drawer\.is-page \.history-list-status-section \.history-status-tab\.is-active:focus-visible\s*\{\s*border-color:\s*rgba\(103, 125, 139, 0\.14\);/);
    });
  
  it('keeps the light category header aligned with the light Posts detail header', () => {
      expect(colorThemeStyles).toMatch(/html\[data-theme='light'\] \.history-drawer\.is-page \.history-detail-header\s*\{[^}]*background:\s*#fbfcfd;/);
      expect(colorThemeStyles).toMatch(/html\[data-theme='light'\] \.history-drawer\.is-page \.history-list-status-section\s*\{[^}]*background:\s*#fbfcfd;/);
    });
  
  it('adds only a subtle shadow below the app topbar in the light theme', () => {
      expect(colorThemeStyles).toMatch(
        /html\[data-theme='light'\] \.topbar\s*\{\s*z-index:\s*1;\s*box-shadow:\s*0 2px 5px rgba\(34, 47, 58, 0\.06\);\s*\}/,
      );
      expect(colorThemeStyles).not.toMatch(/html\[data-theme='dark'\] \.topbar\s*\{[^}]*box-shadow:/);
    });
  
  it('adds a stronger shadow behind the Posts category card in the light theme', () => {
      expect(colorThemeStyles).toMatch(
        /html\[data-theme='light'\] \.history-drawer\.is-page \.history-content\.is-page \.history-list-pane\s*\{[^}]*box-shadow:\s*0 10px 28px rgba\(34, 47, 58, 0\.12\), 0 2px 7px rgba\(34, 47, 58, 0\.07\);/,
      );
      expect(colorThemeStyles).not.toMatch(
        /html\[data-theme='dark'\] \.history-drawer\.is-page \.history-content\.is-page \.history-list-pane\s*\{[^}]*box-shadow:/,
      );
    });
  
  it('adds a little more shadow beneath the Posts search dock in the light theme', () => {
      expect(colorThemeStyles).toMatch(
        /html\[data-theme='light'\] \.history-drawer\.is-page \.history-drawer-tools\s*\{[^}]*box-shadow:\s*0 7px 22px rgba\(29, 48, 61, 0\.14\), 0 2px 6px rgba\(29, 48, 61, 0\.08\);/,
      );
    });
  
  it('positions only the Posts search field eight pixels down', () => {
      expect(globalStyles).toMatch(
        /\.history-drawer\.is-page \.history-search\s*\{[^}]*transform:\s*translate\(0,\s*8px\);/,
      );
    });
  
  it('moves only the Posts preview action buttons and labels down by two pixels', () => {
      expect(globalStyles).toMatch(
        /\.history-drawer\.is-page \.history-detail-toolbar\s*\{\s*transform:\s*translateY\(2px\);/,
      );
    });
  
  it('lowers Posts action icons and raises their labels by three pixels', () => {
      expect(globalStyles).toMatch(
        /\.history-drawer\.is-page \.history-detail-tool-icon\s*\{\s*width:\s*46px;[^}]*height:\s*46px;[^}]*transform:\s*translateY\(5px\);/,
      );
      expect(globalStyles).toMatch(
        /\.history-drawer\.is-page \.history-detail-tool-icon > svg\s*\{\s*transform:\s*translateY\(1px\);/,
      );
      expect(globalStyles).toMatch(
        /\.history-drawer\.is-page \.history-detail-tool-button > span:last-child\s*\{\s*transform:\s*translateY\(-2px\);/,
      );
    });
  
  it('lowers Posts footer icons and raises their labels by three pixels', () => {
      expect(globalStyles).toMatch(
        /\.history-drawer\.is-page \.history-action-label\s*\{[^}]*transform:\s*translateY\(-2px\);/,
      );
      expect(globalStyles).toMatch(
        /\.history-drawer\.is-page \.history-drawer-tools \.history-delete-button > svg,\s*\.history-drawer\.is-page \.history-drawer-tools \.history-export-button > svg\s*\{\s*transform:\s*translateY\(2px\);/,
      );
    });
  
  it('keeps the Posts preview card in place when opening and closing it', () => {
      expect(globalStyles).not.toMatch(
        /\.history-drawer\.is-page \.history-detail-panel\[data-selected='true'\]\s*\{[^}]*transform:/,
      );
    });
  
  it('keeps the Posts detail card top edge clear of an extra line', () => {
      expect(globalStyles).toMatch(
        /@media \(min-width:\s*761px\)\s*\{\s*\.history-drawer\.is-page \.history-detail-panel\s*\{[^}]*border-top-color:\s*transparent;/,
      );
      expect(globalStyles).not.toMatch(/\.history-drawer\.is-page \.history-detail-header::before/);
      expect(colorThemeStyles).not.toContain('--history-detail-panel-edge');
    });
  
  it('matches the normal Posts action strip background in preview mode', () => {
      expect(globalStyles).toMatch(
        /html\[data-theme\] \.history-drawer\.is-page \.history-detail-panel \.history-detail-actions\s*\{[^}]*border-top-color:\s*transparent;[^}]*background:\s*linear-gradient\([\s\S]*?transparent 0 2px,[\s\S]*?rgba\(154, 168, 184, 0\.12\) 2px 3px,[\s\S]*?rgba\(16, 23, 29, 0\.72\) 3px 100%/,
      );
      expect(colorThemeStyles).toMatch(
        /html\[data-theme='light'\] \.history-drawer\.is-page \.history-detail-panel \.history-detail-actions\s*\{[^}]*border-color:\s*#e3eaee;[^}]*border-top-color:\s*transparent;[^}]*background:\s*linear-gradient\([\s\S]*?transparent 0 2px,[\s\S]*?#e3eaee 2px 3px,[\s\S]*?#f1f7f9 3px,[\s\S]*?#fbfcfd 100%/,
      );
      expect(colorThemeStyles).not.toMatch(
        /history-detail-actions\.is-preview-open\s*\{/,
      );
    });
  
  it('removes only the bottom border of the message in the Posts large preview', () => {
      expect(globalStyles).toMatch(
        /@media \(min-width:\s*761px\)\s*\{[\s\S]*?\.history-drawer\.is-page \.history-detail-body\.is-preview \.history-detail-preview-current \.history-post-bubble\s*\{\s*border-bottom-color:\s*transparent;/,
      );
    });
  
  it('gives the Posts preview card the same lower shadow as the list card in the light theme', () => {
      expect(colorThemeStyles).toMatch(
        /html\[data-theme='light'\] \.history-drawer\.is-page \.history-detail-panel\s*\{[^}]*background:\s*#e9f2f7;[^}]*box-shadow:\s*0 10px 28px rgba\(34, 47, 58, 0\.12\), 0 2px 7px rgba\(34, 47, 58, 0\.07\);/,
      );
    });
  
  it('adds a subtle gradient to the light Posts preview action strip', () => {
      expect(colorThemeStyles).toMatch(
        /@media \(min-width:\s*761px\)\s*\{\s*html\[data-theme='light'\] \.history-drawer\.is-page \.history-detail-panel \.history-detail-actions\s*\{\s*border-color:\s*#e3eaee;\s*border-top-color:\s*transparent;\s*background:\s*linear-gradient\(/,
      );
    });
  
  it('makes the thin line below an expanded post more visible in the light theme', () => {
      expect(colorThemeStyles).toMatch(
        /html\[data-theme='light'\] \.history-drawer\.is-page \.history-post-expanded\s*\{\s*border-color:\s*#c5d2d9;\s*background:\s*#f9fbfc;/,
      );
    });
  
  it('uses a lighter background for the light Posts message list', () => {
      expect(colorThemeStyles).toMatch(
        /html\[data-theme='light'\] \.history-drawer\.is-page \.history-content\.is-page \.history-list-pane \.history-record-list\s*\{\s*background:\s*#f7f9fa;/,
      );
    });
  
  it('keeps a soft highlight in the middle of the dark Posts category header gradient', () => {
      expect(colorThemeStyles).toMatch(
        /html\[data-theme='dark'\] \.history-drawer\.is-page \.history-list-status-section\s*\{[^}]*background-color:\s*#191f23;[^}]*background-image:\s*linear-gradient\(110deg,\s*rgba\(55,\s*96,\s*112,\s*0\.26\),\s*rgba\(67,\s*107,\s*121,\s*0\.2\)\s*52%,\s*rgba\(18,\s*25,\s*32,\s*0\)\s*94%\);/,
      );
    });
  
  it('uses the same compact Posts header layout in both themes', () => {
      expect(colorThemeStyles).not.toMatch(/html\[data-theme='dark'\] \.history-drawer\.is-page \.history-detail-header\s*\{[^}]*min-height:\s*82px;/);
      expect(colorThemeStyles).not.toMatch(/html\[data-theme='light'\] \.history-drawer\.is-page \.history-detail-header\s*\{[^}]*min-height:\s*82px;/);
      expect(globalStyles).toMatch(/@media \(min-width:\s*1121px\)\s*\{\s*\.history-drawer\.is-page \.history-detail-header\s*\{[^}]*min-height:\s*65px;/);
      expect(globalStyles).toMatch(/\.history-drawer\.is-page \.history-detail-topline\s*\{[^}]*grid-template-areas:\s*"title meta"\s*"heading controls";/);
      expect(globalStyles).toMatch(/\.history-drawer\.is-page \.history-detail-heading\s*\{[^}]*grid-area:\s*heading;[^}]*width:\s*100%;/);
      expect(globalStyles).toMatch(/\.history-detail-reading-controls \.history-detail-font-button\s*\{[^}]*min-width:\s*28px;[^}]*height:\s*22px;/);
      expect(colorThemeStyles).toMatch(/html\[data-theme='dark'\] \.history-drawer\.is-page \.history-detail-body\.is-details \.history-post-bubble\s*\{\s*width:\s*fit-content;\s*max-width:\s*100%;/);
    });
  
  it('keeps the light Posts header compact with category pills under the title and controls under the date', () => {
      expect(colorThemeStyles).not.toMatch(/html\[data-theme='light'\] \.history-drawer\.is-page \.history-detail-header\s*\{[^}]*min-height:\s*82px;/);
      expect(globalStyles).toMatch(/@media \(min-width:\s*1121px\)\s*\{\s*\.history-drawer\.is-page \.history-detail-header\s*\{[^}]*min-height:\s*65px;/);
      expect(globalStyles).toMatch(/\.history-detail-reading-controls\s*\{[^}]*margin-left:\s*auto;/);
    });
  
  it('uses a graphite scrollbar thumb for the dark Posts text panel', () => {
      expect(colorThemeStyles).toMatch(/html\[data-theme='dark'\] \.history-drawer\.is-page \.history-detail-body\s*\{\s*scrollbar-color:\s*#59636b #191f23;\s*scrollbar-width:\s*thin;/);
      expect(colorThemeStyles).toMatch(/html\[data-theme='dark'\] \.history-drawer\.is-page \.history-detail-body::-webkit-scrollbar-track\s*\{\s*background:\s*#191f23;/);
      expect(colorThemeStyles).toMatch(/html\[data-theme='dark'\] \.history-drawer\.is-page \.history-detail-body::-webkit-scrollbar-thumb\s*\{\s*border-color:\s*var\(--surface-raised\);\s*background:\s*#59636b;\s*background-clip:\s*padding-box;/);
    });
  
  it('uses the search focus outline color for the dark Posts empty-state logo', () => {
      expect(colorThemeStyles).toMatch(/html\[data-theme='dark'\] \.history-drawer\.is-page \.history-detail-empty-art-icon\s*\{\s*border-color:\s*rgba\(154, 168, 184, 0\.62\);\s*color:\s*#eef1f5;\s*filter:\s*drop-shadow\(0 0 6px rgba\(35, 157, 251, 0\.2\)\);\s*box-shadow:\s*0 0 14px rgba\(35, 157, 251, 0\.1\);/);
      expect(colorThemeStyles).toMatch(/html\[data-theme='dark'\] \.history-drawer\.is-page \.history-detail-empty-art-spark\s*\{\s*border-color:\s*rgba\(154, 168, 184, 0\.62\);\s*box-shadow:\s*0 0 8px rgba\(154, 168, 184, 0\.18\);/);
    });
  
  it('uses more visible gray empty-state orbits without glow in the dark theme', () => {
      expect(colorThemeStyles).toMatch(/html\[data-theme='dark'\] \.history-drawer\.is-page \.history-detail-empty-art-orbit\s*\{\s*border-color:\s*rgba\(238, 241, 245, 0\.68\);\s*box-shadow:\s*none;/);
      expect(colorThemeStyles).toMatch(/html\[data-theme='dark'\] \.history-drawer\.is-page \.history-detail-empty-art-orbit--inner\s*\{\s*border-color:\s*rgba\(238, 241, 245, 0\.76\);\s*box-shadow:\s*none;/);
    });
  
  it('matches both dark Posts empty-state logos with a subtle blue glow', () => {
      expect(colorThemeStyles).toMatch(/html\[data-theme='dark'\] \.history-drawer\.is-page \.history-empty-art-orbit\s*\{\s*border-color:\s*rgba\(238, 241, 245, 0\.68\);\s*box-shadow:\s*none;/);
      expect(colorThemeStyles).toMatch(/html\[data-theme='dark'\] \.history-drawer\.is-page \.history-empty-art-orbit--inner\s*\{\s*border-color:\s*rgba\(238, 241, 245, 0\.76\);\s*box-shadow:\s*none;/);
      expect(colorThemeStyles).toMatch(/html\[data-theme='dark'\] \.history-drawer\.is-page \.history-empty-art-icon\s*\{\s*border-color:\s*rgba\(154, 168, 184, 0\.62\);\s*color:\s*#eef1f5;\s*filter:\s*drop-shadow\(0 0 6px rgba\(35, 157, 251, 0\.2\)\);\s*box-shadow:\s*0 0 14px rgba\(35, 157, 251, 0\.1\);/);
      expect(colorThemeStyles).toMatch(/html\[data-theme='dark'\] \.history-drawer\.is-page \.history-empty-art-spark\s*\{\s*border-color:\s*rgba\(154, 168, 184, 0\.62\);\s*box-shadow:\s*0 0 8px rgba\(154, 168, 184, 0\.18\);/);
      expect(colorThemeStyles).toMatch(/html\[data-theme='dark'\] \.history-drawer\.is-page \.history-detail-empty-art-icon\s*\{\s*border-color:\s*rgba\(154, 168, 184, 0\.62\);\s*color:\s*#eef1f5;\s*filter:\s*drop-shadow\(0 0 6px rgba\(35, 157, 251, 0\.2\)\);\s*box-shadow:\s*0 0 14px rgba\(35, 157, 251, 0\.1\);/);
    });
  
  it('uses the original gradient and shadow for the dark Posts message card', () => {
      expect(colorThemeStyles).toMatch(/html\[data-theme='dark'\] \.history-drawer\.is-page \.history-detail-body \.history-post-bubble\s*\{[^}]*border-color:\s*rgba\(126, 169, 191, 0\.3\);[^}]*background:\s*linear-gradient\(145deg,\s*rgba\(39, 61, 73, 0\.94\),\s*rgba\(23, 36, 47, 0\.98\)\);[^}]*box-shadow:\s*inset 0 1px 0 rgba\(224, 240, 248, 0\.06\), 0 8px 22px rgba\(0, 0, 0, 0\.14\);/);
    });
  
  it('does not brighten a selected dark Posts card on pointer hover', () => {
      expect(colorThemeStyles).toMatch(
        /html\[data-theme='dark'\] \.history-drawer\.is-page \.history-content\.is-page \.history-record\.is-selected \.history-record-open:is\(:hover, :focus, :focus-visible\)\s*\{[^}]*border-color:\s*transparent;[^}]*background:\s*transparent;[^}]*box-shadow:\s*none;/,
      );
    });
  
  it('keeps dark Posts hover highlighting subtle while using the selected card size', () => {
      expect(colorThemeStyles).toMatch(
        /html\[data-theme='dark'\] \.history-drawer\.is-page \.history-content\.is-page \.history-record\.is-selected:not\(:hover\):not\(:focus-within\)\s*\{[^}]*border-radius:\s*8px;/,
      );
      expect(colorThemeStyles).toMatch(
        /html\[data-theme='dark'\] \.history-drawer\.is-page \.history-content\.is-page \.history-record:not\(\.is-selected\):not\(\.is-hover-suppressed\):hover\s*\{[^}]*border-radius:\s*8px;[^}]*background:\s*rgba\(154, 168, 184, 0\.045\);[^}]*box-shadow:\s*none;/,
      );
      expect(colorThemeStyles).not.toMatch(
        /html\[data-theme='dark'\] \.history-drawer\.is-page \.history-content\.is-page \.history-record:not\(\.is-selected\):not\(\.is-hover-suppressed\):hover\s*\{[^}]*background:\s*linear-gradient/,
      );
      expect(colorThemeStyles).toMatch(
        /html\[data-theme='dark'\] \.history-drawer\.is-page \.history-content\.is-page \.history-record:not\(\.is-selected\):not\(\.is-hover-suppressed\):hover \.history-record-open:hover\s*\{\s*border-color:\s*transparent;\s*background:\s*transparent;\s*box-shadow:\s*none;/,
      );
      expect(colorThemeStyles).not.toMatch(
        /html\[data-theme='dark'\] \.history-drawer\.is-page \.history-content\.is-page \.history-record:not\(\.is-selected\):not\(\.is-hover-suppressed\):is\(:hover, :focus-within\)/,
      );
    });
  
  it('keeps the dark Posts side accent after deselecting a row', () => {
      expect(colorThemeStyles).toMatch(
        /html\[data-theme='dark'\] \.history-drawer\.is-page \.history-content\.is-page \.history-record\.is-hover-suppressed:is\(:hover, :focus-within\)\s*\{\s*border-color:\s*transparent;\s*border-bottom-color:\s*rgba\(154, 168, 184, 0\.12\);\s*border-radius:\s*0;\s*background:\s*transparent;\s*box-shadow:\s*none;/,
      );
      expect(colorThemeStyles).not.toMatch(
        /html\[data-theme='dark'\] \.history-drawer\.is-page \.history-content\.is-page \.history-record\.is-hover-suppressed:is\(:hover, :focus-within\)::before\s*\{\s*opacity:\s*0;/,
      );
      expect(colorThemeStyles).toMatch(
        /html\[data-theme='dark'\] \.history-drawer\.is-page \.history-content\.is-page \.history-record\.is-hover-suppressed \.history-record-open:is\(:hover, :focus, :focus-visible\)\s*\{\s*border-color:\s*transparent;\s*background:\s*transparent;\s*box-shadow:\s*none;/,
      );
      expect(colorThemeStyles).toMatch(
        /html\[data-theme='light'\] \.history-drawer\.is-page \.history-content\.is-page \.history-record:not\(\.is-selected\):not\(\.is-hover-suppressed\):hover/,
      );
    });
  
  it('keeps Posts record text width fixed while extending the row through the scrollbar gutter', () => {
      expect(globalStyles).toMatch(/\.history-content\.is-page \.history-list-pane \.history-record-list\s*\{[^}]*--history-scrollbar-gutter-width:\s*12px;[^}]*overflow-x:\s*hidden;[^}]*scrollbar-gutter:\s*stable;/);
      expect(globalStyles).toMatch(/\.history-content\.is-page \.history-list-pane \.history-record\s*\{\s*width:\s*calc\(100% \+ var\(--history-scrollbar-gutter-width\)\);\s*margin-right:\s*calc\(0px - var\(--history-scrollbar-gutter-width\)\);/);
      expect(globalStyles).toMatch(/\.history-content\.is-page \.history-list-pane \.history-record-open\s*\{\s*width:\s*calc\(100% - var\(--history-scrollbar-gutter-width\)\);/);
      expect(globalStyles).toMatch(/\.history-content\.is-page \.history-list-pane \.history-record-list::-webkit-scrollbar\s*\{\s*width:\s*var\(--history-scrollbar-gutter-width\);/);
    });
  
  it('keeps the Posts scrollbar track transparent in both themes', () => {
      expect(globalStyles).toMatch(/\.history-content\.is-page \.history-list-pane \.history-record-list\s*\{[^}]*scrollbar-color:\s*rgba\(154, 168, 184, 0\.72\) transparent;/);
      expect(globalStyles).toMatch(/\.history-content\.is-page \.history-list-pane \.history-record-list::-webkit-scrollbar-track\s*\{[^}]*background:\s*transparent;/);
      expect(colorThemeStyles).toMatch(/html\[data-theme='light'\] \.history-content\.is-page \.history-list-pane \.history-record-list\s*\{\s*scrollbar-color:\s*#c3cdd3 transparent;/);
      expect(colorThemeStyles).toMatch(/html\[data-theme='light'\] \.history-drawer\.is-page \.history-content\.is-page \.history-list-pane \.history-record-list::-webkit-scrollbar-track\s*\{\s*background:\s*transparent;/);
    });
  
  it('darkens the Posts message-list scrollbar until hover in dark theme', () => {
      expect(colorThemeStyles).toMatch(
        /html\[data-theme='dark'\] \.history-drawer\.is-page \.history-content\.is-page \.history-list-pane \.history-record-list::-webkit-scrollbar-thumb\s*\{\s*background:\s*#27313a;\s*background-clip:\s*padding-box;/,
      );
      expect(colorThemeStyles).toMatch(
        /html\[data-theme='dark'\] \.history-drawer\.is-page \.history-content\.is-page \.history-list-pane \.history-record-list::-webkit-scrollbar-thumb:hover\s*\{\s*background:\s*#73818c;\s*background-clip:\s*padding-box;/,
      );
      expect(colorThemeStyles).not.toMatch(
        /html\[data-theme='dark'\] \.history-drawer\.is-page \.history-content\.is-page \.history-list-pane \.history-record-list:hover\s*\{/,
      );
    });
  
  it('clearly marks the selected Posts record in both themes', () => {
      expect(globalStyles).toMatch(/\.history-drawer\.is-page \.history-content\.is-page \.history-record\.is-selected\s*\{\s*border-color:\s*transparent;[\s\S]*?border-bottom-color:[^;]+;[\s\S]*?background:\s*linear-gradient/);
      expect(globalStyles).toMatch(/\.history-content\.is-page \.history-list-pane \.history-record-list\s*\{[^}]*padding-right:\s*0;[^}]*padding-left:\s*0;[^}]*scrollbar-gutter:\s*stable;[^}]*scrollbar-width:\s*auto;[^}]*scrollbar-color:\s*rgba\(154, 168, 184, 0\.72\) transparent;/);
      expect(globalStyles).toMatch(/\.history-content\.is-page \.history-list-pane \.history-record-list::-webkit-scrollbar\s*\{\s*width:\s*var\(--history-scrollbar-gutter-width\);/);
      expect(globalStyles).toMatch(/\.history-content\.is-page \.history-list-pane \.history-record-list::-webkit-scrollbar-button\s*\{\s*display:\s*none !important;\s*width:\s*0 !important;\s*height:\s*0 !important;\s*min-width:\s*0 !important;\s*min-height:\s*0 !important;\s*-webkit-appearance:\s*none !important;/);
      expect(globalStyles).toMatch(/\.history-content\.is-page \.history-list-pane \.history-record-list::-webkit-scrollbar-button:vertical:decrement,\s*\.history-content\.is-page \.history-list-pane \.history-record-list::-webkit-scrollbar-button:vertical:increment,\s*\.history-content\.is-page \.history-list-pane \.history-record-list::-webkit-scrollbar-button:vertical:start:decrement,\s*\.history-content\.is-page \.history-list-pane \.history-record-list::-webkit-scrollbar-button:vertical:end:increment\s*\{\s*display:\s*none !important;\s*width:\s*0 !important;\s*height:\s*0 !important;/);
      expect(globalStyles).toMatch(/\.history-content\.is-page \.history-list-pane \.history-record-list::-webkit-scrollbar-track\s*\{\s*border-radius:\s*999px;\s*background:\s*transparent;/);
      expect(globalStyles).toMatch(/\.history-content\.is-page \.history-list-pane \.history-record-list::-webkit-scrollbar-thumb\s*\{\s*min-height:\s*32px;\s*border:\s*2px solid transparent;\s*border-radius:\s*999px;\s*background:\s*rgba\(154, 168, 184, 0\.72\);/);
      expect(globalStyles).toMatch(/\.history-drawer\.is-page \.history-content\.is-page \.history-record,\s*\.history-drawer\.is-page \.history-content\.is-page \.history-record\.is-draft\[data-draft-color\]\s*\{\s*padding:\s*3px 8px 3px 10px;/);
      expect(globalStyles).toMatch(/\.history-content\.is-page \.history-record-open\s*\{\s*padding:\s*2px 0 3px;/);
      expect(globalStyles).toMatch(/\.history-drawer\.is-page \.history-content\.is-page \.history-record-text\s*\{[^}]*text-align:\s*left;/);
      expect(globalStyles).toMatch(/\.history-drawer\.is-page \.history-content\.is-page \.history-record-open\s*\{\s*min-height:\s*88px;\s*grid-template-rows:\s*28px 22px 15px 16px auto;/);
      expect(globalStyles).toMatch(/\.history-drawer\.is-page \.history-content\.is-page \.history-record-chat\s*\{[^}]*grid-row:\s*3;/);
      expect(globalStyles).toMatch(/\.history-drawer\.is-page \.history-content\.is-page \.history-record-text\s*\{\s*grid-row:\s*4;/);
      expect(globalStyles).toMatch(/\.history-drawer\.is-page \.history-content\.is-page \.history-record-text\s*\{[^}]*line-height:\s*16px;[^}]*text-overflow:\s*ellipsis;[^}]*white-space:\s*nowrap;/);
      expect(globalStyles).toMatch(/\.history-drawer\.is-page \.history-content\.is-page \.history-record-chat\s*\{[^}]*top:\s*-3px;[^}]*text-overflow:\s*ellipsis;[^}]*white-space:\s*nowrap;/);
      expect(globalStyles).toMatch(/\.history-drawer\.is-page \.history-content\.is-page \.history-record-text\s*\{[^}]*top:\s*-3px;/);
      expect(colorThemeStyles).toMatch(/html\[data-theme='dark'\] \.history-drawer\.is-page \.history-content\.is-page \.history-record\.is-selected,[\s\S]*?border-color:\s*transparent;[\s\S]*?border-right-color:\s*rgba\(170, 184, 194, 0\.3\);[\s\S]*?border-left-color:\s*rgba\(170, 184, 194, 0\.3\);/);
      expect(colorThemeStyles).toMatch(/html\[data-theme='dark'\] \.history-drawer\.is-page \.history-content\.is-page \.history-record\.is-selected,\s*html\[data-theme='dark'\] \.history-drawer\.is-page \.history-content\.is-page \.history-record\.is-selected:hover,\s*html\[data-theme='dark'\] \.history-drawer\.is-page \.history-content\.is-page \.history-record\.is-selected:focus-within,[\s\S]*?background:\s*linear-gradient\(90deg, rgba\(154, 168, 184, 0\.16\), rgba\(154, 168, 184, 0\.045\) 88%, transparent\);[\s\S]*?box-shadow:\s*inset 0 0 0 1px rgba\(170, 184, 194, 0\.1\);/);
      expect(colorThemeStyles).toMatch(/html\[data-theme='dark'\] \.history-drawer\.is-page \.history-content\.is-page \.history-record\.is-selected::before\s*\{[^}]*top:\s*8px;[^}]*bottom:\s*8px;[^}]*width:\s*2px;[^}]*background:\s*#aab8c2;[^}]*opacity:\s*1;/);
      expect(colorThemeStyles).toMatch(/html\[data-theme='dark'\] \.history-drawer\.is-page \.history-content\.is-page \.history-record\.is-selected \.history-record-open:is\(:hover, :focus, :focus-visible\)\s*\{[^}]*border-color:\s*transparent;[^}]*background:\s*transparent;[^}]*box-shadow:\s*none;/);
      expect(colorThemeStyles).toMatch(/html\[data-theme='light'\] \.history-drawer\.is-page \.history-content\.is-page \.history-record\.is-selected,\s*html\[data-theme='light'\] \.history-drawer\.is-page \.history-content\.is-page \.history-record\.is-selected:hover,\s*html\[data-theme='light'\] \.history-drawer\.is-page \.history-content\.is-page \.history-record\.is-selected:focus-within,[\s\S]*?background:\s*linear-gradient\(90deg, rgba\(71, 124, 158, 0\.12\), rgba\(71, 124, 158, 0\.035\) 88%, transparent\);[\s\S]*?box-shadow:\s*inset 0 0 0 1px rgba\(71, 124, 158, 0\.1\);/);
      expect(colorThemeStyles).toMatch(/html\[data-theme='light'\] \.history-drawer\.is-page \.history-content\.is-page \.history-record\.is-selected,[\s\S]*?border-color:\s*transparent;[\s\S]*?border-right-color:\s*rgba\(71, 124, 158, 0\.32\);[\s\S]*?border-left-color:\s*rgba\(71, 124, 158, 0\.32\);/);
      expect(colorThemeStyles).toMatch(/html\[data-theme='light'\] \.history-drawer\.is-page \.history-content\.is-page \.history-record\.is-selected::before\s*\{[^}]*width:\s*3px;[^}]*background:\s*#477c9e;[^}]*opacity:\s*1;/);
    });
  
  it('applies a full-size light hover highlight to unselected Posts rows', () => {
      expect(globalStyles).toMatch(/\.history-drawer\.is-page \.history-content\.is-page \.history-record:hover,\s*\.history-drawer\.is-page \.history-content\.is-page \.history-record:focus-within\s*\{[^}]*background:\s*transparent;/);
      expect(colorThemeStyles).toMatch(/html\[data-theme='light'\] \.history-drawer\.is-page \.history-content\.is-page \.history-record:not\(\.is-selected\):not\(\.is-hover-suppressed\):hover\s*\{[^}]*border-radius:\s*8px;[^}]*background:\s*linear-gradient\(90deg, rgba\(255, 255, 255, 1\), rgba\(255, 255, 255, 0\.72\) 88%, transparent\);[^}]*box-shadow:\s*inset 0 0 0 1px rgba\(71, 124, 158, 0\.08\);/);
      expect(colorThemeStyles).not.toMatch(/\.history-record:not\(\.is-selected\):focus-within\s*\{[^}]*background:\s*linear-gradient\(90deg, rgba\(255, 255, 255, 1\)/);
    });
  
  it('enlarges the selected dark category label without shifting tab widths', () => {
      expect(colorThemeStyles).toMatch(/html\[data-theme='dark'\] \.history-drawer\.is-page \.history-list-status-section \.history-status-tab\.is-active,\s*html\[data-theme='dark'\] \.history-drawer\.is-page \.history-list-status-section \.history-status-tab\.is-active:hover,\s*html\[data-theme='dark'\] \.history-drawer\.is-page \.history-list-status-section \.history-status-tab\.is-active:focus-visible\s*\{[^}]*background:\s*rgba\(154, 168, 184, 0\.16\);/);
      expect(colorThemeStyles).toMatch(/html\[data-theme='dark'\] \.history-drawer\.is-page \.history-list-status-section \.history-status-tab\s*\{\s*font-size:\s*13px;\s*font-weight:\s*700;/);
      expect(colorThemeStyles).toMatch(/html\[data-theme='dark'\] \.history-drawer\.is-page \.history-list-status-section \.history-status-label,\s*html\[data-theme='dark'\] \.history-drawer\.is-page \.history-list-status-section \.history-status-label-compact\s*\{\s*display:\s*inline-block;\s*transform:\s*scale\(0\.92\);/);
      expect(colorThemeStyles).toMatch(/html\[data-theme='dark'\] \.history-drawer\.is-page \.history-list-status-section \.history-status-label-compact\s*\{\s*display:\s*none;/);
      expect(colorThemeStyles).toMatch(/@media \(max-width:\s*760px\)\s*\{\s*html\[data-theme='dark'\] \.history-drawer\.is-page \.history-list-status-section \.history-status-label\s*\{\s*display:\s*none;/);
      expect(colorThemeStyles).toMatch(/html\[data-theme='dark'\] \.history-drawer\.is-page \.history-list-status-section \.history-status-label-compact\s*\{\s*display:\s*inline-block;/);
      expect(colorThemeStyles).toMatch(/html\[data-theme='dark'\] \.history-drawer\.is-page \.history-list-status-section \.history-status-tab\.is-active \.history-status-label,\s*html\[data-theme='dark'\] \.history-drawer\.is-page \.history-list-status-section \.history-status-tab\.is-active \.history-status-label-compact\s*\{\s*transform:\s*scale\(1\);/);
      expect(colorThemeStyles).toMatch(/html\[data-theme='dark'\] \.history-drawer\.is-page \.history-list-status-section \.history-status-tab\.is-active:focus-visible\s*\{\s*background:\s*rgba\(154, 168, 184, 0\.24\);/);
      expect(colorThemeStyles).toMatch(/html\[data-theme='dark'\] \.history-drawer\.is-page \.history-list-status-section \.history-status-tab\.is-active \.history-filter-count\s*\{\s*border-color:\s*rgba\(35, 157, 251, 0\.24\);\s*background:\s*rgba\(35, 157, 251, 0\.12\);\s*color:\s*#a9ddff;/);
    });

  it('places the source selector beside the category caption on narrow panes without moving category tabs', () => {
    expect(colorThemeStyles).toMatch(
      /@container \(max-width:\s*480px\)\s*\{\s*html\[data-theme\] \.history-drawer\.is-page \.history-list-status-section\s*\{[^}]*grid-template-rows:\s*18px auto;[^}]*grid-template-areas:\s*"category source"\s*"filters filters";/,
    );
    expect(colorThemeStyles).toMatch(
      /html\[data-theme\] \.history-drawer\.is-page \.history-list-status-heading > \.history-page-filter-label\s*\{\s*grid-area:\s*category;/,
    );
    expect(colorThemeStyles).toMatch(
      /html\[data-theme\] \.history-drawer\.is-page \.history-list-status-heading > \.history-status-filters\s*\{\s*grid-area:\s*filters;/,
    );
    expect(colorThemeStyles).toMatch(
      /html\[data-theme\] \.history-drawer\.is-page \.history-list-source-row \.history-page-filter-section\.is-source-section\s*\{\s*grid-area:\s*source;/,
    );
    expect(colorThemeStyles).toMatch(
      /html\[data-theme\] \.history-drawer\.is-page \.history-list-source-label\s*\{\s*display:\s*inline-flex;\s*margin:\s*0;\s*font-size:\s*12px;\s*letter-spacing:\s*0\.08em;/,
    );
    expect(colorThemeStyles).toMatch(
      /html\[data-theme\] \.history-drawer\.is-page \.history-list-source-row \.history-source-select\s*\{[^}]*font-size:\s*12px;/,
    );
    expect(globalStyles).toMatch(/\.history-source-menu\s*\{[^}]*right:\s*0;/);
    expect(colorThemeStyles).toMatch(
      /\.history-drawer\.is-page \.history-list-source-row \.history-page-filter-section\.is-source-section\s*\{\s*box-sizing:\s*border-box;\s*width:\s*220px;\s*min-width:\s*220px;\s*flex:\s*0 0 220px;\s*justify-content:\s*flex-end;/,
    );
    expect(colorThemeStyles).toMatch(
      /\.history-drawer\.is-page \.history-list-source-row \.history-page-filter-section\.is-source-section \.history-source-filters\s*\{\s*position:\s*static;\s*width:\s*auto;/,
    );
  });
  
  it('removes the dark backing panel behind category tabs', () => {
      expect(colorThemeStyles).toMatch(
        /html\[data-theme='dark'\] \.history-drawer\.is-page \.history-list-status-section \.history-status-filters\s*\{\s*border-color:\s*transparent;\s*background:\s*transparent;\s*box-shadow:\s*none;/,
      );
    });
  
  it('uses the category accent for the selected dark source filter', () => {
      expect(colorThemeStyles).toMatch(
        /html\[data-theme='dark'\] \.history-drawer\.is-page \.history-list-source-row \.history-source-select > span:first-child,[\s\S]*?html\[data-theme='dark'\] \.history-drawer\.is-page \.history-list-source-row \.history-source-select\[aria-expanded='true'\] > span:first-child\s*\{\s*color:\s*var\(--accent\);/,
      );
      expect(colorThemeStyles).toMatch(
        /html\[data-theme='dark'\] \.history-source-menu \.history-source-option\[aria-checked='true'\]\s*\{\s*color:\s*var\(--accent\);/,
      );
      expect(colorThemeStyles).toMatch(
        /html\[data-theme='dark'\] \.history-source-menu \.history-source-option\[aria-checked='true'\] \.history-filter-count\s*\{\s*border-color:\s*rgba\(35, 157, 251, 0\.24\);\s*background:\s*rgba\(35, 157, 251, 0\.12\);\s*color:\s*#a9ddff;/,
      );
    });
  
  it('uses the selected category accent for the light source selector', () => {
      expect(colorThemeStyles).toMatch(
        /html\[data-theme='light'\] \.history-drawer\.is-page \.history-list-source-row \.history-source-select > span:first-child,[\s\S]*?html\[data-theme='light'\] \.history-source-menu \.history-source-option\[aria-checked='true'\]\s*\{\s*color:\s*#287da3;\s*font-weight:\s*700;/,
      );
    });
  
  it('keeps scrolling date and month separators white in the light theme', () => {
      expect(colorThemeStyles).toMatch(
        /html\[data-theme='light'\] \.history-drawer\.is-page \.history-date-heading,\s*html\[data-theme='light'\] \.history-drawer\.is-page \.history-date-sticky,\s*html\[data-theme='light'\] \.history-drawer\.is-page \.history-month-heading,\s*html\[data-theme='light'\] \.history-drawer\.is-page \.history-date-heading::before\s*\{\s*border-bottom-color:\s*#dce5e9;\s*background:\s*#ffffff;/,
      );
    });
  
  it('rebuilds mode tabs without shadows, filters, or decorative pseudo-elements', () => {
      const finalTabStyles = colorThemeStyles.slice(colorThemeStyles.lastIndexOf('html[data-theme] .history-drawer.is-page .history-list-status-section .history-status-filters'));
      expect(finalTabStyles).toMatch(/\.history-status-filters,[\s\S]*?\.history-status-tab \.history-filter-count\s*\{\s*box-shadow:\s*none;\s*filter:\s*none;\s*-webkit-filter:\s*none;/);
      expect(finalTabStyles).toMatch(/\.history-status-tab::before,[\s\S]*?\.history-status-tab::after\s*\{\s*display:\s*none;/);
      expect(finalTabStyles).toMatch(/html\[data-theme='dark'\][\s\S]*?\.history-status-tab\.is-active\s*\{\s*border-color:\s*transparent;\s*background:\s*transparent;/);
    });
  
  it('makes Posts section tabs slightly larger', () => {
      expect(colorThemeStyles).toMatch(
        /html\[data-theme\] \.history-drawer\.is-page \.history-list-status-section \.history-status-tab\s*\{\s*min-height:\s*38px;\s*padding-right:\s*11px;\s*padding-left:\s*11px;/,
      );
    });
  
  it('keeps Posts mode tabs free of shadows while highlighting the dark selection minimally', () => {
      const finalTabStyles = colorThemeStyles.slice(colorThemeStyles.lastIndexOf('html[data-theme] .history-drawer.is-page .history-list-status-section .history-status-filters'));
      expect(finalTabStyles).toMatch(/html\[data-theme='dark'\][\s\S]*?\.history-status-tab\.is-active\s*\{\s*border-color:\s*transparent;/);
      expect(finalTabStyles).toMatch(/html\[data-theme='light'\][\s\S]*?\.history-status-tab\.is-active:focus-visible\s*\{\s*border-color:\s*rgba\(103, 125, 139, 0\.2\);/);
      expect(finalTabStyles).toMatch(/box-shadow:\s*none;/);
    });
  
  it('anchors Posts empty-state artwork and keeps follow-up content beneath it', () => {
      expect(globalStyles).toMatch(/\.history-drawer\.is-page \.history-detail-empty\s*\{[^}]*display:\s*block;[^}]*position:\s*absolute;[^}]*inset:\s*0;/);
      expect(globalStyles).toMatch(/\.history-empty\.is-page-empty\s*\{\s*position:\s*relative;\s*display:\s*block;/);
      expect(globalStyles).toMatch(/\.history-empty-content\.is-page-empty-content\s*\{\s*position:\s*absolute;\s*top:\s*max\(24px, calc\(50% - 96px\)\);\s*right:\s*24px;\s*left:\s*24px;\s*display:\s*grid;\s*justify-items:\s*center;\s*gap:\s*6px;/);
      expect(globalStyles).toMatch(/@keyframes history-empty-in\s*\{\s*from\s*\{\s*opacity:\s*0;\s*\}\s*to\s*\{\s*opacity:\s*1;\s*\}\s*\}/);
      expect(globalStyles).toMatch(/\.history-drawer\.is-page \.history-detail-empty-content\s*\{[^}]*position:\s*absolute;[^}]*top:\s*calc\(50% - 25px\);[^}]*height:\s*0;[^}]*transform:\s*translateX\(-50%\);/);
      expect(globalStyles).toMatch(/\.history-drawer\.is-page \.history-detail-empty-copy\s*\{[^}]*position:\s*absolute;[^}]*top:\s*75px;[^}]*opacity:\s*0;[^}]*transition:\s*opacity 140ms ease-out;/);
      expect(globalStyles).toMatch(/\.history-drawer\.is-page \.history-detail-empty-copy\.is-visible\s*\{\s*visibility:\s*visible;\s*opacity:\s*1;/);
      expect(globalStyles).toMatch(/\.history-drawer\.is-page \.history-detail-empty-art\s*\{[^}]*position:\s*absolute;[^}]*top:\s*-65px;[^}]*left:\s*50%;[^}]*transform:\s*translateX\(-50%\);/);
      expect(globalStyles).toMatch(/@media \(min-width:\s*761px\)\s*\{\s*\.history-drawer\.is-page \.history-detail-empty-copy\s*\{\s*top:\s*85px;\s*\}\s*\.history-drawer\.is-page \.history-detail-empty-art\s*\{\s*top:\s*-75px;/);
      expect(globalStyles).toMatch(/\.history-drawer\.is-page \.history-detail-empty h2,\s*\.history-drawer\.is-page \.history-detail-empty p\s*\{[^}]*position:\s*static;/);
    });
  
  it('insets both Posts panels horizontally without scaling their contents', () => {
      expect(globalStyles).toMatch(
        /@media \(min-width:\s*761px\)\s*\{\s*\.history-content\.is-page \.history-list-pane\s*\{[^}]*margin-inline:\s*6px;/,
      );
      expect(globalStyles).toMatch(
        /\.history-content\.is-page\s*\{[^}]*column-gap:\s*14px;/,
      );
      expect(globalStyles).toMatch(
        /@media \(min-width:\s*761px\)\s*\{\s*\.history-drawer\.is-page \.history-detail-panel\s*\{[^}]*margin-inline:\s*6px;/,
      );
      expect(globalStyles).toMatch(
        /@media \(min-width:\s*761px\)\s*\{\s*\.history-content\.is-page \.history-list-pane\s*\{[^}]*margin-bottom:\s*2px;/,
      );
      expect(globalStyles).not.toMatch(/\.history-empty-content\.is-page-empty-content\s*\{[^}]*transform:\s*scale/);
      expect(globalStyles).not.toMatch(/\.history-drawer\.is-page \.history-detail-empty-content\s*\{[^}]*scale\(/);
    });
  
  it('aligns the Posts search and action dock with the inset list panel', () => {
      expect(globalStyles).toMatch(
        /\.history-drawer\.is-page \.history-drawer-tools\s*\{[^}]*width:\s*calc\(45% - 29\.2px\);[^}]*margin-right:\s*0;[^}]*margin-left:\s*17px;/,
      );
      expect(globalStyles).toMatch(
        /@media \(min-width:\s*761px\)\s*\{\s*\.history-content\.is-page \.history-list-pane\s*\{[^}]*margin-inline:\s*6px;/,
      );
    });
  
  it('closes the standalone Posts page when Escape is pressed', () => {
      const { container, onClose } = renderHistoryPage([upcomingRecord]);
      fireEvent.click(container.querySelector('.history-record-open')!);
  
      fireEvent.keyDown(document, { key: 'Escape' });
  
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  
  describe('Posts preview modes', () => {
      beforeEach(() => {
        vi.mocked(telegramGetChatHistory).mockReset();
      });
  
      it('shows plain text until Preview is explicitly opened', () => {
        const draft = normalizePlannerDraft(
          'Bold line\nsecond line',
          null,
          '2026-09-29T17:30:00.000Z',
          [{ type: 'bold', offset: 0, length: 4 }],
        );
        expect(draft).not.toBeNull();
        const { container } = renderHistoryPage([draft!]);
        fireEvent.click(container.querySelector('.history-record-open')!);
  
        expect(container.querySelector('.history-detail-body')).toHaveClass('is-details');
        expect(container.querySelector('.history-detail-plain-post')).toBeInTheDocument();
        expect(container.querySelector('.history-post-text')?.textContent).toBe('Bold line\nsecond line');
        expect(container.querySelector('.history-post-text strong')).toBeNull();
        expect(container.querySelector('.history-detail-preview-label')).toBeNull();
        expect(telegramGetChatHistory).not.toHaveBeenCalled();
  
        fireEvent.click(screen.getByRole('button', { name: 'Preview' }));
        expect(telegramGetChatHistory).not.toHaveBeenCalled();
        expect(container.querySelector('.history-detail-body')).toHaveClass('is-preview');
        expect(container.querySelector('.history-post-text strong')).toHaveTextContent('Bold');
        expect(container.querySelector('.history-detail-header')).toHaveClass('is-preview-open');
        expect(container.querySelector('.history-detail-preview-label')).toBeNull();
        expect(container.querySelector('.history-detail-preview-badge')).toHaveTextContent('Preview');
        expect(container.querySelector('.history-detail-preview-badge svg')).toHaveAttribute('aria-hidden', 'true');
        expect(container.querySelector('.history-detail-topline h2')?.nextElementSibling)
          .toBe(container.querySelector('.history-detail-preview-badge'));
        expect(container.querySelector('.history-detail-header')?.nextElementSibling)
          .toBe(container.querySelector('.history-detail-body'));
        expect(container.querySelector('.history-detail-actions')).toHaveClass('is-preview-open');
        expect(globalStyles).toMatch(/\.history-drawer\.is-page \.history-detail-actions\.is-preview-open\s*\{\s*border-top-color:\s*transparent;/);
        expect(globalStyles).not.toMatch(/\.history-detail-header\.is-preview-open\s*\{[^}]*border-bottom/);
        expect(colorThemeStyles).not.toMatch(/\.history-detail-header\.is-preview-open\s*\{[^}]*border-bottom/);
        expect(colorThemeStyles).toMatch(/html\[data-theme\] \.history-drawer\.is-page \.history-detail-header\s*\{\s*border-bottom-width:\s*2px;\s*border-bottom-color:\s*transparent;/);
        expect(globalStyles).toMatch(
          /@media \(min-width:\s*1121px\)\s*\{\s*\.history-drawer\.is-page \.history-detail-header\s*\{[^}]*min-height:\s*65px;[^}]*justify-content:\s*center;/,
        );
        expect(container.querySelector('.history-detail-preview-current')).toBeInTheDocument();
        expect(container.querySelector('.history-detail-preview-current .history-post-bubble'))
          .toHaveTextContent('Bold line');
        expect(container.querySelector('.history-detail-preview-current .history-post-text br'))
          .toBeInTheDocument();
  
        fireEvent.click(screen.getByRole('button', { name: 'Preview' }));
        expect(container.querySelector('.history-detail-body')).toHaveClass('is-details');
        expect(container.querySelector('.history-detail-plain-post')).toBeInTheDocument();
        expect(container.querySelector('.history-post-text strong')).toBeNull();
        expect(container.querySelector('.history-detail-preview-label')).toBeNull();
        expect(container.querySelector('.history-detail-preview-badge')).toBeNull();
        expect(screen.getByRole('button', { name: 'Preview' })).toHaveAttribute('aria-pressed', 'false');
      });
  
      it('opens the post preview without chat history or an empty spacer above the post', () => {
        const { container } = renderHistoryPage([anchoredSentRecord]);
        fireEvent.click(container.querySelector('.history-record-open')!);
        const detailBody = container.querySelector('.history-detail-body') as HTMLDivElement;
  
        fireEvent.click(screen.getByRole('button', { name: 'Preview' }));
  
        expect(detailBody).toHaveClass('is-preview');
        expect(telegramGetChatHistory).not.toHaveBeenCalled();
        expect(detailBody.scrollTop).toBe(0);
        expect(container.querySelector('.history-chat-preview')).not.toBeInTheDocument();
        expect(container.querySelector('.history-detail-preview-spacer')).not.toBeInTheDocument();
        expect(container.querySelector('.history-detail-preview-label')).not.toBeInTheDocument();
        expect(container.querySelector('.history-detail-reading-controls')?.parentElement)
          .toBe(container.querySelector('.history-detail-topline'));
        expect(container.querySelector('.history-detail-reading-controls')).toBeVisible();
        expect(container.querySelector('.history-detail-preview-badge')).toHaveTextContent('Preview');
        expect(container.querySelector('.history-detail-preview-badge svg')).toHaveAttribute('aria-hidden', 'true');
        expect(container.querySelector('.history-detail-preview-badge')?.compareDocumentPosition(
          container.querySelector('.history-detail-heading')!,
        )).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
        expect(container.querySelector('.history-detail-preview-current .history-post-bubble'))
          .toHaveTextContent('Релиз нового набора шаблонов для Telegram-канала');
  
        const [decrease, increase] = Array.from(container.querySelectorAll<HTMLButtonElement>('.history-detail-font-button'));
        fireEvent.click(increase);
        expect(detailBody).toHaveAttribute('data-text-size', 'large');
        expect(increase).toBeDisabled();
        fireEvent.click(decrease);
        expect(detailBody).toHaveAttribute('data-text-size', 'default');
      });
  
      it('keeps draft previews independent from selected chat history', () => {
        const draft = normalizeSavedDraft({
          id: 'draft-with-chat',
          name: 'Draft with selected chat',
          body: 'Saved Studio draft post',
          selectedChat: channel,
          attachments: [],
          createdAt: '2026-09-29T16:00:00.000Z',
          updatedAt: '2026-09-29T16:30:00.000Z',
        });
        const { container } = renderHistoryPage([draft]);
        fireEvent.click(container.querySelector('.history-record-open')!);
        fireEvent.click(screen.getByRole('button', { name: 'Preview' }));
  
        expect(telegramGetChatHistory).not.toHaveBeenCalled();
        expect(container.querySelector('.history-detail-body')).toHaveClass('is-preview');
        expect(container.querySelector('.history-detail-preview-current .history-post-bubble'))
          .toHaveTextContent('Saved Studio draft post');
      });
  
      it('keeps saved and active Planner draft previews free of chat history', () => {
        const savedDraft = normalizeSavedPlannerDraft({
          id: 'planner-draft-with-chat',
          message: 'Saved Planner draft post',
          attachments: [],
          entities: [],
          selectedChat: channel,
          reminderType: null,
          savedAt: '2026-09-29T16:30:00.000Z',
        });
        const savedView = renderHistoryPage([savedDraft]);
        fireEvent.click(savedView.container.querySelector('.history-record-open')!);
        fireEvent.click(screen.getByRole('button', { name: 'Preview' }));
  
        expect(telegramGetChatHistory).not.toHaveBeenCalled();
        expect(savedView.container.querySelector('.history-detail-preview-current .history-post-bubble'))
          .toHaveTextContent('Saved Planner draft post');
        savedView.unmount();
  
        const activeDraft = normalizePlannerDraft('Active Planner draft post', channel, '2026-09-29T16:30:00.000Z');
        expect(activeDraft).not.toBeNull();
        const activeView = renderHistoryPage([activeDraft!]);
        fireEvent.click(activeView.container.querySelector('.history-record-open')!);
        fireEvent.click(screen.getByRole('button', { name: 'Preview' }));
  
        expect(telegramGetChatHistory).not.toHaveBeenCalled();
        expect(activeView.container.querySelector('.history-detail-preview-current .history-post-bubble'))
          .toHaveTextContent('Active Planner draft post');
      });
  
      it('keeps Telegram preview typography by default and supports text-size controls', () => {
        expect(globalStyles).toMatch(/html\[data-theme\] \.history-drawer\.is-page \.history-detail-body\.is-preview \.history-post-text\s*\{[^}]*font-family:\s*Roboto,[^}]*font-size:\s*16px;[^}]*line-height:\s*1\.4;[^}]*white-space:\s*pre-wrap;/);
        expect(globalStyles).toMatch(/html\[data-theme\] \.history-drawer\.is-page \.history-detail-body\.is-preview\[data-text-size='small'\] \.history-post-text,\s*html\[data-theme\] \.history-drawer\.is-page \.history-detail-body\.is-details\[data-text-size='small'\] \.history-post-text\s*\{\s*font-size:\s*14px;/);
        expect(globalStyles).toMatch(/html\[data-theme\] \.history-drawer\.is-page \.history-detail-body\.is-preview\[data-text-size='large'\] \.history-post-text,\s*html\[data-theme\] \.history-drawer\.is-page \.history-detail-body\.is-details\[data-text-size='large'\] \.history-post-text\s*\{\s*font-size:\s*18px;/);
        expect(globalStyles).not.toContain('.history-detail-preview-spacer');
        expect(globalStyles).toMatch(/\.history-detail-preview-current\s*\{[^}]*width:\s*100%;[^}]*max-width:\s*none;[^}]*justify-content:\s*flex-end;[^}]*margin-top:\s*auto;/);
        expect(globalStyles).toMatch(/\.history-detail-preview-current \.history-post-bubble\s*\{[^}]*max-width:\s*min\(78%, 340px\);/);
      });
  
      it('anchors long previews at the bottom and keeps the selected text size in sync', () => {
        const { container } = renderHistoryPage([anchoredSentRecord]);
        fireEvent.click(container.querySelector('.history-record-open')!);
  
        const detailBody = container.querySelector('.history-detail-body') as HTMLDivElement;
        Object.defineProperties(detailBody, {
          clientHeight: { configurable: true, value: 300 },
          scrollHeight: { configurable: true, value: 520 },
        });
  
        fireEvent.click(screen.getByRole('button', { name: 'Preview' }));
        expect(detailBody.scrollTop).toBe(220);
        expect(detailBody).toHaveAttribute('data-text-size', 'default');
  
        fireEvent.click(screen.getByRole('button', { name: 'Increase post text size' }));
        expect(detailBody.scrollTop).toBe(220);
        expect(detailBody).toHaveAttribute('data-text-size', 'large');
  
        fireEvent.click(screen.getByRole('button', { name: 'Decrease post text size' }));
        fireEvent.click(screen.getByRole('button', { name: 'Decrease post text size' }));
        expect(detailBody.scrollTop).toBe(220);
        expect(detailBody).toHaveAttribute('data-text-size', 'small');
      });
    });
  
  it('shows schedule-specific actions instead of Copy and Use', () => {
      const { container } = renderHistoryPage([upcomingRecord]);
      fireEvent.click(container.querySelector('.history-record-open')!);
      const toolbar = container.querySelector<HTMLDivElement>('.history-detail-toolbar')!;
  
      expect(within(toolbar).getByRole('button', { name: 'Preview' })).toBeInTheDocument();
      expect(within(toolbar).getByRole('button', { name: 'Edit' })).toBeInTheDocument();
      expect(within(toolbar).getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
      expect(within(toolbar).queryByRole('button', { name: 'Copy' })).not.toBeInTheDocument();
      expect(within(toolbar).queryByRole('button', { name: 'Use' })).not.toBeInTheDocument();
    });

  it('keeps Copy and Use for sent posts', () => {
    const onUseDraft = vi.fn();
    const { container } = renderHistoryPage([workspaceSentRecord], onUseDraft);
    fireEvent.click(container.querySelector('.history-record-open')!);
    const toolbar = container.querySelector<HTMLDivElement>('.history-detail-toolbar')!;

    expect(within(toolbar).getByRole('button', { name: 'Copy' })).toBeInTheDocument();
    fireEvent.click(within(toolbar).getByRole('button', { name: 'Use' }));
    expect(onUseDraft).toHaveBeenCalledWith(workspaceSentRecord, 'studio');
  });
  
  it('restores Copy for drafts and hides Edit and Use in Studio from More', () => {
      const draft = normalizePlannerDraft(
        'A planner draft',
        null,
        '2026-09-29T17:30:00.000Z',
      );
      expect(draft).not.toBeNull();
      const { container, onOpenDraft } = renderHistoryPage([draft!], vi.fn());
      fireEvent.click(container.querySelector('.history-record-open')!);
      const toolbar = container.querySelector<HTMLDivElement>('.history-detail-toolbar')!;
  
      expect(within(toolbar).getByRole('button', { name: 'Preview' })).toBeInTheDocument();
      expect(within(toolbar).getByRole('button', { name: 'Copy' })).toBeInTheDocument();
      expect(within(toolbar).getByRole('button', { name: 'Use' })).toBeInTheDocument();
      expect(within(toolbar).queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument();
      fireEvent.click(within(toolbar).getByRole('button', { name: 'More' }));
      expect(screen.queryByRole('menuitem', { name: 'Chat Preview' })).not.toBeInTheDocument();
      expect(screen.queryByRole('menuitem', { name: 'Use draft' })).not.toBeInTheDocument();
      expect(screen.queryByRole('menuitem', { name: 'Use in Studio' })).not.toBeInTheDocument();
      expect(screen.queryByRole('menuitem', { name: 'Edit' })).not.toBeInTheDocument();
      expect(screen.queryByRole('menuitem', { name: 'Open in Planner' })).not.toBeInTheDocument();
      expect(onOpenDraft).not.toHaveBeenCalled();
    });
  
  it('right-aligns the detail toolbar and preserves themed message-card surfaces', () => {
      expect(globalStyles).toMatch(
        /\.history-drawer\.is-page \.history-detail-actions\s*\{[^}]*padding-top:\s*6px;[^}]*padding-bottom:\s*4px;[^}]*justify-content:\s*flex-end;/,
      );
      expect(globalStyles).toMatch(/\.history-drawer\.is-page \.history-delete-button,\s*\.history-drawer\.is-page \.history-export-button\s*\{[^}]*height:\s*44px;[^}]*min-height:\s*44px;/);
      expect(globalStyles).toMatch(/\.history-drawer\.is-page \.history-export-control\s*\{[^}]*gap:\s*2px;[^}]*transform:\s*translate\(10px,\s*5px\);/);
      expect(globalStyles).toMatch(/\.history-drawer\.is-page \.history-delete-button\s*\{[^}]*width:\s*44px;[^}]*flex-basis:\s*44px;/);
      expect(globalStyles).toMatch(
        /\.history-drawer\.is-page \.history-delete-action\.is-page-action\s*\{[^}]*flex-direction:\s*column;[^}]*margin-left:\s*36px;[^}]*transform:\s*translateY\(5px\);/,
      );
      expect(globalStyles).toMatch(/\.history-drawer\.is-page \.history-export-button\s*\{[^}]*width:\s*44px;[^}]*min-width:\s*44px;[^}]*justify-content:\s*center;[^}]*padding:\s*0;/);
      expect(globalStyles).toMatch(/\.history-drawer\.is-page \.history-action-label\s*\{[^}]*font-size:\s*10px;[^}]*line-height:\s*12px;[^}]*transform:\s*translateY\(-2px\);[^}]*white-space:\s*nowrap;/);
      expect(globalStyles).toMatch(/\.history-drawer\.is-page \.history-export-button::before\s*\{\s*left:\s*50%;\s*transform:\s*translate\(-50%,\s*-50%\);/);
      expect(globalStyles).toMatch(/\.history-drawer\.is-page \.history-drawer-tools \.history-delete-button > svg,\s*\.history-drawer\.is-page \.history-drawer-tools \.history-export-button > svg\s*\{\s*transform:\s*translateY\(2px\);/);
      expect(readFileSync(path.resolve(path.dirname(fileURLToPath(import.meta.url)), './HistoryFooterActions.tsx'), 'utf8'))
        .toMatch(/<Download size=\{24\}[\s\S]*?<Trash2 size=\{25\}/);
      expect(readFileSync(path.resolve(path.dirname(fileURLToPath(import.meta.url)), './HistoryDetailActions.tsx'), 'utf8'))
        .toMatch(/<Eye size=\{26\}[\s\S]*?<Copy size=\{23\}[\s\S]*?<Ellipsis size=\{24\}/);
      expect(globalStyles).toMatch(/\.history-drawer\.is-page \.history-detail-toolbar\s*\{\s*transform:\s*translateY\(2px\);/);
      expect(globalStyles).toMatch(/\.history-detail-tool-button\s*\{[^}]*min-height:\s*64px;/);
      expect(globalStyles).toMatch(/\.history-drawer\.is-page \.history-detail-tool-button > span:last-child\s*\{\s*transform:\s*translateY\(-2px\);/);
      expect(globalStyles).toMatch(/\.history-detail-tool-icon\s*\{[^}]*border-radius:\s*10px;/);
      expect(globalStyles).toMatch(
        /\.history-detail-body\.is-details\s*\{\s*padding:\s*14px;\s*white-space:\s*normal;/,
      );
      expect(globalStyles).toMatch(
        /\.history-detail-body\.is-details \.history-post-bubble\s*\{\s*width:\s*fit-content;\s*max-width:\s*100%;\s*margin:\s*0 auto;/,
      );
      expect(globalStyles).toMatch(
        /\.history-detail-body\.is-details \.history-post-attachments img\s*\{\s*max-width:\s*min\(100%,\s*360px\);\s*max-height:\s*min\(280px,\s*35vh\);/,
      );
      expect(globalStyles).toMatch(
        /html\[data-theme\] \.history-drawer\.is-page \.history-detail-body\.is-details \.history-post-text\s*\{\s*padding:\s*8px 10px;\s*font-size:\s*16px;\s*line-height:\s*1\.5;/,
      );
      expect(colorThemeStyles).toMatch(
        /html\[data-theme='dark'\] \.history-drawer\.is-page \.history-detail-body \.history-post-bubble\s*\{[^}]*border-color:\s*rgba\(126, 169, 191, 0\.3\);[^}]*background:\s*linear-gradient\(145deg, rgba\(39, 61, 73, 0\.94\), rgba\(23, 36, 47, 0\.98\)\);/,
      );
      expect(colorThemeStyles).toMatch(
        /html\[data-theme='light'\] \.history-drawer\.is-page \.history-detail-tool-icon\s*\{[^}]*background:\s*linear-gradient\(155deg,\s*#ffffff,\s*#f0f4f6\);/,
      );
      expect(colorThemeStyles).toMatch(
        /html\[data-theme='dark'\] \.history-drawer\.is-page \.history-detail-tool-button:not\(:hover\):not\(:focus-visible\):not\(\[aria-expanded='true'\]\) \.history-detail-tool-icon,[\s\S]*?html\[data-theme='light'\] \.history-drawer\.is-page \.history-detail-tool-button:not\(:hover\):not\(:focus-visible\):not\(\[aria-expanded='true'\]\) \.history-detail-tool-icon\s*\{[^}]*border-color:\s*transparent;[^}]*background:\s*transparent;[^}]*box-shadow:\s*none;/,
      );
      expect(colorThemeStyles).toMatch(
        /html\[data-theme='dark'\] \.history-drawer\.is-page \.history-detail-tool-button:hover:not\(:disabled\) \.history-detail-tool-icon,[\s\S]*?\.history-detail-tool-button\[aria-expanded='true'\] \.history-detail-tool-icon\s*\{[^}]*border-radius:\s*10px;[^}]*border-color:\s*rgba\(154,\s*183,\s*202,\s*0\.49\);[^}]*background:\s*linear-gradient\(/,
      );
      expect(colorThemeStyles).toMatch(
        /html\[data-theme='light'\] \.history-drawer\.is-page \.history-detail-tool-button:hover:not\(:disabled\) \.history-detail-tool-icon,[\s\S]*?\.history-detail-tool-button\[aria-expanded='true'\] \.history-detail-tool-icon\s*\{[^}]*border-radius:\s*10px;[^}]*border-color:\s*#b5cbd5;[^}]*background:\s*linear-gradient\(/,
      );
      expect(colorThemeStyles).toMatch(
        /html\[data-theme='light'\] \.history-drawer\.is-page \.history-detail-tool-button:hover:not\(:disabled\),\s*html\[data-theme='light'\] \.history-drawer\.is-page \.history-detail-tool-button:focus-visible,\s*html\[data-theme='light'\] \.history-drawer\.is-page \.history-detail-tool-button\[aria-expanded='true'\]\s*\{\s*color:\s*#315a6b;/,
      );
      expect(colorThemeStyles).toMatch(
        /html\[data-theme='light'\] \.history-drawer\.is-page \.history-detail-panel \.history-detail-actions\s*\{[^}]*border-color:\s*#e3eaee;/,
      );
      expect(colorThemeStyles).toMatch(
        /html\[data-theme='light'\] \.history-drawer\.is-page \.history-detail-action-menu\s*\{[^}]*border-radius:\s*16px;[^}]*background:\s*rgba\(255,\s*255,\s*255,\s*0\.96\);[^}]*box-shadow:/,
      );
      expect(colorThemeStyles).toMatch(
        /html\[data-theme='light'\] \.history-drawer\.is-page \.history-detail-menu-item:hover:not\(:disabled\),[\s\S]*?background:\s*#edf5f7;/,
      );
      expect(colorThemeStyles).toMatch(
        /html\[data-theme='dark'\] \.history-drawer\.is-page \.history-drawer-tools \.history-delete-button,[\s\S]*?html\[data-theme='light'\] \.history-drawer\.is-page \.history-drawer-tools \.history-export-button:disabled\s*\{[^}]*border-color:\s*transparent;/,
      );
      expect(colorThemeStyles).toMatch(
        /html\[data-theme='dark'\] \.history-drawer\.is-page \.history-drawer-tools \.history-delete-button:not\(:hover\):not\(:focus-visible\):not\(\[aria-expanded='true'\]\),[\s\S]*?html\[data-theme='light'\] \.history-drawer\.is-page \.history-drawer-tools \.history-export-button:not\(:hover\):not\(:focus-visible\)\s*\{[^}]*background:\s*transparent;[^}]*box-shadow:\s*none;/,
      );
      expect(globalStyles).toMatch(
        /\.history-drawer\.is-page \.history-delete-button::before,\s*\.history-drawer\.is-page \.history-export-button::before\s*\{[^}]*width:\s*44px;[^}]*height:\s*44px;[^}]*border-radius:\s*10px;[^}]*background:\s*transparent;/,
      );
      expect(colorThemeStyles).toMatch(
        /html\[data-theme='dark'\] \.history-drawer\.is-page \.history-drawer-tools \.history-delete-button:hover:not\(:disabled\)::before,[\s\S]*?html\[data-theme='light'\] \.history-drawer\.is-page \.history-drawer-tools \.history-export-button:focus-visible::before\s*\{[^}]*border-color:\s*rgba\(154,\s*183,\s*202,\s*0\.49\);[^}]*background:\s*linear-gradient\(155deg,/,
      );
      expect(colorThemeStyles).toMatch(
        /html\[data-theme='dark'\] \.history-drawer\.is-page \.history-drawer-tools \.history-delete-button:hover:not\(:disabled\),[\s\S]*?html\[data-theme='light'\] \.history-drawer\.is-page \.history-drawer-tools \.history-export-button:focus-visible\s*\{[^}]*background:\s*transparent;[^}]*box-shadow:\s*none;/,
      );
    });
});
