import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LocaleProvider } from '@studio/lib/i18n';
import { RichTextEditor, createLogoHarness } from './WorkspaceTextStage.testUtils';

describe("WorkspaceTextStage logo animation", () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    window.localStorage.clear();
  });

  it('animates the editor logo on the first focus only', () => {
      vi.useFakeTimers();
      const container = document.createElement('div');
      document.body.appendChild(container);
      const root = createRoot(container);
      const onChange = vi.fn();
      const renderEditor = (text: string) => root.render(
        <LocaleProvider><RichTextEditor text={text} entities={[]} onChange={onChange} onOpenAlbum={() => undefined} maxLength={4096} /></LocaleProvider>,
      );
  
      act(() => renderEditor(''));
      const editor = container.querySelector('[contenteditable="true"]') as HTMLDivElement;
      expect(container.querySelector('.workspace-page-rich-text-empty-logo')).toBeNull();
  
      const animation = { cancel: vi.fn(), onfinish: null } as unknown as Animation;
      const animate = vi.fn((keyframes: Keyframe[], options?: KeyframeAnimationOptions) => {
        void keyframes;
        void options;
        return animation;
      });
      Object.defineProperty(HTMLImageElement.prototype, 'animate', { configurable: true, value: animate });
      Object.defineProperty(HTMLImageElement.prototype, 'getBoundingClientRect', {
        configurable: true,
        value: () => ({ width: 240, height: 240, top: 0, right: 240, bottom: 240, left: 0, x: 0, y: 0, toJSON: () => ({}) }),
      });
      vi.spyOn(editor, 'getBoundingClientRect').mockReturnValue({
        width: 600,
        height: 300,
        top: 0,
        right: 600,
        bottom: 300,
        left: 0,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      } as DOMRect);
  
      act(() => editor.focus());
      const logo = container.querySelector('.workspace-page-rich-text-empty-logo');
      expect(logo).toBeTruthy();
      expect(window.getSelection()?.anchorNode).toBe(editor);
      expect(window.getSelection()?.anchorOffset).toBe(0);
      expect(editor.classList.contains('has-content')).toBe(false);
      expect(editor.classList.contains('is-empty')).toBe(true);
      expect(editor.getAttribute('data-placeholder')).toBe('What shall we share?');
      expect(logo?.querySelector('img')?.getAttribute('src')).toContain('logo.png');
      expect(editor.contains(logo)).toBe(false);
      expect(animate).toHaveBeenCalledTimes(1);
      expect(editor.classList.contains('is-logo-intro')).toBe(true);
      expect(animate.mock.calls[0][1]?.duration).toBe(4950);
      const keyframes = animate.mock.calls[0][0];
      expect(keyframes).toHaveLength(7);
      expect(keyframes[2]?.opacity).toBe(1);
      expect(keyframes[2]?.offset).toBe(0.4457218);
      expect(keyframes[2]?.transform).toContain('scale(1)');
      expect(keyframes[1]?.easing).toBe('cubic-bezier(0.32, 0.35, 0.4, 1)');
      expect(keyframes[3]?.offset).toBe(0.8699642);
      expect(keyframes[3]?.opacity).toBe(1);
      expect(keyframes[3]?.transform).toBe(keyframes[2]?.transform);
      expect(keyframes[3]?.easing).toBe('cubic-bezier(0.6, 0, 0.68, 0.65)');
      expect((keyframes[3]!.offset! - keyframes[2]!.offset!) * 4950).toBeCloseTo(2100, 0);
      expect(keyframes[4]?.offset).toBe(0.9208352);
      expect(keyframes[4]?.opacity).toBe(0.78);
      expect(keyframes[4]?.transform).toContain('scale(2.7)');
      expect(keyframes[4]?.easing).toBe('linear');
      expect(keyframes[5]?.offset).toBe(0.9591442);
      expect(keyframes[5]?.opacity).toBe(0.32);
      expect(keyframes[5]?.transform).toContain('scale(3.645');
      expect(keyframes[5]?.easing).toBe('linear');
      expect(keyframes[6]?.opacity).toBe(0);
      expect(keyframes[6]?.transform).toContain('scale(4.725');
      expect(keyframes.every((frame) => String(frame.transform).includes('rotateY(27deg)'))).toBe(true);
      expect(logo?.classList.contains('is-flying')).toBe(true);
  
      act(() => {
        editor.textContent = 'Hello';
        editor.dispatchEvent(new Event('input', { bubbles: true }));
      });
      expect(onChange).toHaveBeenCalledWith('Hello', []);
  
      act(() => renderEditor('Hello'));
      const flyingLogo = container.querySelector('.workspace-page-rich-text-empty-logo.is-flying');
      expect(flyingLogo).toBeTruthy();
      expect(editor.classList.contains('has-content')).toBe(true);
      expect(editor.classList.contains('is-empty')).toBe(false);
      expect(animate).toHaveBeenCalledTimes(1);
      expect(editor.classList.contains('has-content')).toBe(true);
      const clearTextButton = container.querySelector('[aria-label="Clear editor text"]') as HTMLButtonElement;
      expect(clearTextButton).not.toBeNull();
      expect(container.querySelector('.workspace-page-character-count')).not.toBeNull();
  
      act(() => clearTextButton.click());
      expect(onChange).toHaveBeenLastCalledWith('', []);
      act(() => renderEditor(''));
      expect(container.querySelector('[aria-label="Clear editor text"]')).toBeNull();
      expect(container.querySelector('.workspace-page-character-count')).toBeNull();
      expect(container.querySelector('.workspace-page-rich-text-meta-row')).not.toBeNull();
  
      act(() => {
        animation.onfinish?.call(animation, {} as AnimationPlaybackEvent);
      });
      expect(container.querySelector('.workspace-page-rich-text-empty-logo')).toBeNull();
      expect(editor.classList.contains('is-logo-intro')).toBe(true);
      expect(editor.classList.contains('is-logo-intro-finishing')).toBe(true);
  
      act(() => vi.advanceTimersByTime(180));
      expect(editor.classList.contains('is-logo-intro')).toBe(false);
      expect(editor.classList.contains('is-logo-intro-finishing')).toBe(false);
  
      act(() => editor.blur());
      expect(editor.classList.contains('is-logo-intro')).toBe(false);
  
      act(() => vi.advanceTimersByTime(5030));
      expect(container.querySelector('.workspace-page-rich-text-empty-logo')).toBeNull();
      expect(animation.cancel).not.toHaveBeenCalled();
  
      act(() => {
        editor.textContent = '';
        editor.dispatchEvent(new Event('input', { bubbles: true }));
      });
      act(() => renderEditor(''));
      expect(container.querySelector('.workspace-page-rich-text-empty-logo')).toBeNull();
  
      act(() => {
        editor.textContent = 'Again';
        editor.dispatchEvent(new Event('input', { bubbles: true }));
      });
      expect(container.querySelector('.workspace-page-rich-text-empty-logo')).toBeNull();
      expect(animate).toHaveBeenCalledTimes(1);
  
      act(() => editor.blur());
      act(() => editor.focus());
      expect(animate).toHaveBeenCalledTimes(1);
  
      act(() => root.unmount());
      container.remove();
      vi.useRealTimers();
    })
  it('uses a minimal animation duration when reduced motion is preferred', () => {
      vi.useFakeTimers();
      const previousMatchMedia = Object.getOwnPropertyDescriptor(window, 'matchMedia');
      Object.defineProperty(window, 'matchMedia', {
        configurable: true,
        value: vi.fn().mockReturnValue({ matches: true }),
      });
      const harness = createLogoHarness();
  
      try {
        act(() => harness.editor.focus());
        expect(harness.animate.mock.calls[0]?.[1]?.duration).toBe(1);
  
        act(() => vi.advanceTimersByTime(81));
        expect(harness.container.querySelector('.workspace-page-rich-text-empty-logo')).toBeNull();
      } finally {
        harness.cleanup();
        if (previousMatchMedia) Object.defineProperty(window, 'matchMedia', previousMatchMedia);
        else Reflect.deleteProperty(window, 'matchMedia');
        vi.useRealTimers();
      }
    })
  it('clears the pending logo timeout when the editor unmounts', () => {
      vi.useFakeTimers();
      const harness = createLogoHarness();
      const setTimeoutSpy = vi.spyOn(window, 'setTimeout');
      const clearTimeoutSpy = vi.spyOn(window, 'clearTimeout');
  
      try {
        act(() => harness.editor.focus());
        const duration = Number(harness.animate.mock.calls[0]?.[1]?.duration ?? 0);
        const timerIndex = setTimeoutSpy.mock.calls.findIndex(([, delay]) => delay === duration + 80);
        expect(timerIndex).toBeGreaterThanOrEqual(0);
        const logoTimeoutId = setTimeoutSpy.mock.results[timerIndex]?.value;
  
        harness.cleanup();
        expect(clearTimeoutSpy).toHaveBeenCalledWith(logoTimeoutId);
      } finally {
        harness.cleanup();
        setTimeoutSpy.mockRestore();
        clearTimeoutSpy.mockRestore();
        vi.useRealTimers();
      }
    })
});
