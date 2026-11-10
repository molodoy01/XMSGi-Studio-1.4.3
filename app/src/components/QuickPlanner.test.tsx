import { describe, expect, it, vi } from 'vitest';
import { quickPlannerStyles, colorThemeStyles, fontStyles } from './QuickPlanner.testUtils';
import { preloadPlannerFonts } from '@/lib/plannerFonts';

describe("QuickPlanner layout", () => {
  it('waits for Exo 2 instead of swapping from a fallback font', () => {
      const exo2FontFaces = fontStyles.match(/@font-face\s*\{[^}]*font-family:\s*'Exo 2';[^}]*\}/g) ?? [];
      expect(exo2FontFaces).toHaveLength(8);
      expect(exo2FontFaces.every((fontFace) => /font-display:\s*block;/.test(fontFace))).toBe(true);
    });
  it('preloads Exo 2 weights for Latin and Cyrillic before the app renders', async () => {
      const load = vi.fn().mockResolvedValue([]);

      await preloadPlannerFonts({ load });

      expect(load).toHaveBeenCalledTimes(4);
      expect(load).toHaveBeenNthCalledWith(1, '400 14px "Exo 2"', 'Quick Planner Планер');
      expect(load).toHaveBeenNthCalledWith(2, '500 14px "Exo 2"', 'Quick Planner Планер');
      expect(load).toHaveBeenNthCalledWith(3, '600 14px "Exo 2"', 'Quick Planner Планер');
      expect(load).toHaveBeenNthCalledWith(4, '700 14px "Exo 2"', 'Quick Planner Планер');
    });
  it('uses the workbench as the only editor contour in both themes', () => {
      expect(quickPlannerStyles).toMatch(
        /html\[data-theme='light'\] \.quick-planner \.quick-planner-message\s*\{[^}]*border-color:\s*transparent;[^}]*box-shadow:\s*none;/,
      );
      expect(quickPlannerStyles).toMatch(
        /html\[data-theme='light'\] \.quick-planner \.quick-planner-message:focus\s*\{[^}]*border-color:\s*transparent;[^}]*box-shadow:\s*none;/,
      );
      expect(quickPlannerStyles).toMatch(
        /html\[data-theme='dark'\] \.quick-planner \.quick-planner-message:not\(:focus\):not\(:hover\)\s*\{\s*border-color:\s*transparent;\s*box-shadow:\s*none;/,
      );
      expect(quickPlannerStyles).toMatch(
        /html\[data-theme='dark'\] \.quick-planner \.quick-planner-message:focus,\s*html\[data-theme='dark'\] \.quick-planner \.quick-planner-message:focus-visible\s*\{\s*border-color:\s*transparent;\s*box-shadow:\s*none;/,
      );
    });
  it('keeps the message field corners square in both themes', () => {
      expect(quickPlannerStyles).toMatch(/html\[data-theme='light'\] \.quick-planner \.quick-planner-message\s*\{\s*border-radius:\s*0;/);
      expect(quickPlannerStyles).toMatch(/html\[data-theme='dark'\] \.quick-planner \.quick-planner-message\s*\{\s*color-scheme:\s*dark;\s*border-color:\s*transparent;\s*border-radius:\s*0;/);
    });
  it('matches the dark Studio editor contour on the Planner workbench', () => {
      expect(quickPlannerStyles).toMatch(/\.quick-planner-workbench\s*\{[^}]*border-radius:\s*12px;/);
      expect(colorThemeStyles).toMatch(
        /html\[data-theme='dark'\] \.quick-planner-workbench\s*\{\s*border-color:\s*#35434c;[^}]*box-shadow:\s*0 14px 34px rgba\(0, 0, 0, 0\.24\);/,
      );
    });
  it('highlights the whole attachment chip when its remove button is hovered or focused', () => {
      expect(quickPlannerStyles).toMatch(
        /\.quick-planner-attachment:has\(button:hover\),\s*\.quick-planner-attachment:has\(button:focus-visible\)\s*\{[^}]*background-color:\s*#fbefed;/,
      );
      expect(quickPlannerStyles).toMatch(
        /\.quick-planner-attachment button:hover,\s*\.quick-planner-attachment button:focus-visible\s*\{[^}]*background:\s*transparent;[^}]*color:\s*#a5362c;/,
      );
      expect(colorThemeStyles).toMatch(
        /html\[data-theme='dark'\] \.quick-planner-attachment:has\(button:hover\),\s*html\[data-theme='dark'\] \.quick-planner-attachment:has\(button:focus-visible\)\s*\{[^}]*background-color:\s*rgba\(120, 48, 44, 0\.28\);/,
      );
    });
  it('uses a flat light workbench surface without a diagonal highlight', () => {
      expect(quickPlannerStyles).toMatch(
        /\.quick-planner-workbench\s*\{[^}]*background:\s*#f7f8fa;/,
      );
      expect(quickPlannerStyles).not.toMatch(
        /\.quick-planner-workbench\s*\{[^}]*background:\s*linear-gradient/,
      );
    });
  it('uses the same subtle background glow as Studio in both themes', () => {
      expect(quickPlannerStyles).toMatch(
        /\.quick-planner\s*\{[^}]*background:\s*radial-gradient\(ellipse 72% 62% at 45% 42%, rgba\(71, 124, 158, 0\.035\) 0%, rgba\(71, 124, 158, 0\.012\) 42%, transparent 78%\),\s*var\(--void\);/,
      );
      expect(colorThemeStyles).toMatch(
        /html\[data-theme='dark'\] \.quick-planner\s*\{[^}]*background:\s*radial-gradient\(ellipse 72% 62% at 45% 42%, rgba\(35, 157, 251, 0\.045\), transparent 78%\), var\(--void\);/,
      );
    });
  it('keeps 17px horizontal spacing around the message field at every viewport size', () => {
      expect(quickPlannerStyles).toMatch(
        /\.quick-planner-composer\s*\{[^}]*padding:\s*24px 17px 18px;/,
      );
      expect(quickPlannerStyles).toMatch(
        /@media \(max-width: 560px\)[\s\S]*?\.quick-planner-composer\s*\{[^}]*padding:\s*20px 17px 16px;/,
      );
      expect(quickPlannerStyles).toMatch(
        /\.quick-planner-message\s*\{[^}]*margin:\s*13px 0 -10px;/,
      );
      expect(quickPlannerStyles).toMatch(
        /@media \(max-width: 560px\)[\s\S]*?\.quick-planner-message\s*\{[^}]*margin-top:\s*11px;[^}]*margin-bottom:\s*-10px;/,
      );
      expect(quickPlannerStyles).toMatch(
        /html\.electron-runtime:has\(\.product-view\.is-active \.quick-planner\) \.quick-planner-message\s*\{\s*margin-bottom:\s*8px;/,
      );
    });
  it('spaces the Planner tool buttons evenly and lowers their row by 7px', () => {
      expect(quickPlannerStyles).toMatch(
        /\.quick-planner-tools\s*\{[^}]*gap:\s*7px;/,
      );
      expect(quickPlannerStyles).toMatch(
        /\.quick-planner-tools > \.quick-planner-tool-anchor\s*\{\s*flex:\s*0 0 48px;/,
      );
      expect(quickPlannerStyles).toMatch(
        /\.quick-planner-tools > \.quick-planner-tool-anchor \+ \.quick-planner-tool-anchor\s*\{\s*margin-left:\s*5px;/,
      );
      expect(quickPlannerStyles).toMatch(
        /\.quick-planner-tools-row\s*\{[^}]*transform:\s*translateY\(7px\);/,
      );
      expect(quickPlannerStyles).toMatch(
        /html\.electron-runtime:has\(\.product-view\.is-active \.quick-planner\) \.quick-planner-tools-row\s*\{\s*transform:\s*translateY\(-18px\);/,
      );
      expect(quickPlannerStyles).toMatch(
        /\.quick-planner-tools button\s*\{[^}]*width:\s*48px;[^}]*height:\s*40px;/,
      );
    });
  it('removes borders from inactive Planner mode switches while preserving the active one', () => {
      expect(quickPlannerStyles).toMatch(
        /html\[data-theme\] \.quick-planner \.quick-planner-mode-switch button:not\(\.is-active\)\s*\{\s*border:\s*0 !important;/,
      );
      expect(quickPlannerStyles).toMatch(
        /html\[data-theme\] \.quick-planner \.quick-planner-mode-switch button\.is-active\s*\{[^}]*border:\s*1px solid/,
      );
    });
});
