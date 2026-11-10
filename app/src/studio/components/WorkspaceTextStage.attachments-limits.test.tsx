import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { fireEvent } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getEditorTextOffset } from '@studio/lib/richText';
import { shouldPreventEditorInsertion } from './editor/richTextEditorUtils';
import { RichTextEditor, renderRichTextEditor, captureAnimationFrames } from './WorkspaceTextStage.testUtils';

describe("WorkspaceTextStage attachments and limits", () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    window.localStorage.clear();
  });

  it('drops one image into the draft and prevents the browser from opening it', () => {
      const onAddFiles = vi.fn();
      const { container, editor, unmount } = renderRichTextEditor({ onAddFiles });
      editor.textContent = 'Draft text';
      const selection = window.getSelection();
      const range = document.createRange();
      range.setStart(editor.firstChild!, 5);
      range.collapse(true);
      selection?.removeAllRanges();
      selection?.addRange(range);
  
      const image = new File(['image-bytes'], 'photo.png', { type: 'image/png' });
      const dataTransfer = { types: ['Files'], files: [image], dropEffect: 'none' };
      const dragOver = new Event('dragover', { bubbles: true, cancelable: true });
      Object.defineProperty(dragOver, 'dataTransfer', { value: dataTransfer });
      act(() => container.querySelector('.workspace-page-rich-text-editor')?.dispatchEvent(dragOver));
      expect(container.querySelector('.workspace-page-rich-text-editor')?.classList.contains('is-drag-over')).toBe(true);
  
      const drop = new Event('drop', { bubbles: true, cancelable: true });
      Object.defineProperty(drop, 'dataTransfer', { value: dataTransfer });
      act(() => container.querySelector('.workspace-page-rich-text-editor')?.dispatchEvent(drop));
  
      expect(drop.defaultPrevented).toBe(true);
      expect(onAddFiles).toHaveBeenCalledWith([image], 5);
      expect(container.querySelector('.workspace-page-rich-text-editor')?.classList.contains('is-drag-over')).toBe(false);
      unmount();
    })
  it('drops multiple files as one attachment batch', () => {
      const onAddFiles = vi.fn();
      const { container, unmount } = renderRichTextEditor({ onAddFiles });
      const image = new File(['image-bytes'], 'photo.png', { type: 'image/png' });
      const documentFile = new File(['report-bytes'], 'report.pdf', { type: 'application/pdf' });
      const drop = new Event('drop', { bubbles: true, cancelable: true });
      Object.defineProperty(drop, 'dataTransfer', {
        value: { types: ['Files'], files: [image, documentFile], dropEffect: 'none' },
      });
  
      act(() => container.querySelector('.workspace-page-rich-text-editor')?.dispatchEvent(drop));
  
      expect(drop.defaultPrevented).toBe(true);
      expect(onAddFiles).toHaveBeenCalledWith([image, documentFile], 0);
      unmount();
    })
  it('pastes clipboard images as attachments without inserting binary data into text', () => {
      const onAddFiles = vi.fn();
      const onChange = vi.fn();
      const { editor, unmount } = renderRichTextEditor({ onAddFiles, onChange });
      const image = new File(['clipboard-image'], 'clipboard.png', { type: 'image/png' });
      const paste = new Event('paste', { bubbles: true, cancelable: true });
      Object.defineProperty(paste, 'clipboardData', {
        value: {
          items: [{ kind: 'file', type: 'image/png', getAsFile: () => image }],
          files: [image],
          getData: () => '',
        },
      });
  
      act(() => editor.dispatchEvent(paste));
  
      expect(paste.defaultPrevented).toBe(true);
      expect(onAddFiles).toHaveBeenCalledWith([image], 0);
      expect(editor.textContent).toBe('');
      expect(onChange).not.toHaveBeenCalled();
      unmount();
    })
  it('selects a rich-editor line on a triple click and all text on a fourth click', () => {
      const { editor, unmount } = renderRichTextEditor({ text: 'First line\nSecond line\nThird line' });
      editor.textContent = 'First line\nSecond line\nThird line';
      const selection = window.getSelection();
      const range = document.createRange();
      range.setStart(editor.firstChild!, 14);
      range.setEnd(editor.firstChild!, 20);
      selection?.removeAllRanges();
      selection?.addRange(range);
  
      fireEvent.click(editor, { detail: 3 });
  
      expect(selection?.toString()).toBe('Second line');
      expect(selection?.rangeCount).toBe(1);
  
      fireEvent.click(editor, { detail: 4 });
      expect(selection?.toString()).toBe(editor.textContent);
      expect(editor).toHaveAttribute('data-selection-start', '0');
      expect(editor).toHaveAttribute('data-selection-end', String(editor.textContent?.length));
      unmount();
    })
  it('keeps ordinary plain-text paste working', () => {
      const onChange = vi.fn();
      const { editor, unmount } = renderRichTextEditor({ onChange });
      const selection = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(editor);
      range.collapse(false);
      selection?.removeAllRanges();
      selection?.addRange(range);
      const paste = new Event('paste', { bubbles: true, cancelable: true });
      Object.defineProperty(paste, 'clipboardData', {
        value: { items: [], files: [], getData: (type: string) => type === 'text/plain' ? 'ordinary pasted text' : '' },
      });
  
      act(() => editor.dispatchEvent(paste));
  
      expect(paste.defaultPrevented).toBe(true);
      expect(editor.textContent).toBe('ordinary pasted text');
      expect(onChange).toHaveBeenLastCalledWith('ordinary pasted text', []);
      unmount();
    })
  it('keeps the caret visible while typing and inserting text in successive pastes', () => {
      const frames = captureAnimationFrames();
      const previousRangeBounds = Object.getOwnPropertyDescriptor(Range.prototype, 'getBoundingClientRect');
      let caretBottom = 210;
      Object.defineProperty(Range.prototype, 'getBoundingClientRect', {
        configurable: true,
        value: function getBoundingClientRect(this: Range) {
          return this.collapsed
            ? { top: 0, bottom: 0, left: 0, right: 0, width: 0, height: 0, x: 0, y: 0, toJSON: () => ({}) }
            : { top: caretBottom - 16, bottom: caretBottom, left: 10, right: 10, width: 0, height: 16, x: 10, y: caretBottom - 16, toJSON: () => ({}) };
        },
      });
  
      try {
        const { editor, unmount } = renderRichTextEditor();
        Object.defineProperty(editor, 'clientHeight', { configurable: true, value: 100 });
        Object.defineProperty(editor, 'scrollHeight', { configurable: true, value: 500 });
        Object.defineProperty(editor, 'getBoundingClientRect', {
          configurable: true,
          value: () => ({ width: 300, height: 100, top: 100, right: 300, bottom: 200, left: 0, x: 0, y: 100, toJSON: () => ({}) }),
        });
        editor.textContent = 'Typed text';
        const selection = window.getSelection()!;
        const range = document.createRange();
        range.setStart(editor.firstChild!, editor.firstChild!.textContent!.length);
        range.collapse(true);
        selection.removeAllRanges();
        selection.addRange(range);
  
        act(() => fireEvent.input(editor, { inputType: 'insertText' }));
        frames.flush();
        expect(editor.scrollTop).toBe(14);
  
        for (let index = 0; index < 5; index += 1) {
          caretBottom += 14;
          const paste = new Event('paste', { bubbles: true, cancelable: true });
          Object.defineProperty(paste, 'clipboardData', {
            value: { items: [], files: [], getData: (type: string) => type === 'text/plain' ? ' pasted text' : '' },
          });
          act(() => editor.dispatchEvent(paste));
          frames.flush();
        }
  
        expect(editor.scrollTop).toBeGreaterThan(14);
        unmount();
      } finally {
        if (previousRangeBounds) Object.defineProperty(Range.prototype, 'getBoundingClientRect', previousRangeBounds);
        else Reflect.deleteProperty(Range.prototype, 'getBoundingClientRect');
        vi.restoreAllMocks();
      }
    })
  it('adds pasted clipboard images as attachments instead of dropping them', () => {
      const container = document.createElement('div');
      document.body.appendChild(container);
      const root = createRoot(container);
      const onPasteImages = vi.fn();
      const image = new File(['image-bytes'], 'clipboard-photo.png', { type: 'image/png' });
  
      act(() => {
        root.render(
          <RichTextEditor
            text=""
            entities={[]}
            onChange={vi.fn()}
            onPasteImages={onPasteImages}
            maxLength={4096}
          />,
        );
      });
  
      const editor = container.querySelector('[contenteditable="true"]') as HTMLDivElement;
      const pasteEvent = new Event('paste', { bubbles: true, cancelable: true });
      Object.defineProperty(pasteEvent, 'clipboardData', {
        value: {
          items: [{ kind: 'file', type: 'image/png', getAsFile: () => image }],
          getData: () => '',
        },
      });
  
      act(() => editor.dispatchEvent(pasteEvent));
  
      expect(pasteEvent.defaultPrevented).toBe(true);
      expect(onPasteImages).toHaveBeenCalledWith([image]);
  
      act(() => root.unmount());
      container.remove();
    })
  it('keeps the caret inside the editor after auto-trimming to max length', () => {
      const container = document.createElement('div');
      document.body.appendChild(container);
      const root = createRoot(container);
      const onChange = vi.fn();
  
      act(() => {
        root.render(<RichTextEditor text="" entities={[]} onChange={onChange} maxLength={10} />);
      });
  
      const editor = container.querySelector('[contenteditable="true"]') as HTMLDivElement;
      act(() => editor.focus());
      const selection = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(editor);
      range.collapse(false);
      selection?.removeAllRanges();
      selection?.addRange(range);
  
      act(() => {
        editor.textContent = 'abcdefghijk';
        editor.dispatchEvent(new Event('input', { bubbles: true }));
      });
  
      expect(editor.textContent).toBe('abcdefghij');
      expect(window.getSelection()?.rangeCount).toBeGreaterThan(0);
      expect(editor.contains(window.getSelection()?.anchorNode ?? null)).toBe(true);
  
      act(() => root.unmount());
      container.remove();
    })
  it('inserts a matching closing parenthesis and keeps the caret inside the pair', () => {
      const { editor, onChange, unmount } = renderRichTextEditor({ text: 'hello', maxLength: 10 });
      act(() => editor.focus());
      const selection = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(editor);
      range.collapse(false);
      selection?.removeAllRanges();
      selection?.addRange(range);
  
      act(() => fireEvent.keyDown(editor, { key: '(' }));
  
      expect(editor.textContent).toBe('hello()');
      expect(onChange).toHaveBeenLastCalledWith('hello()', []);
      expect(getEditorTextOffset(editor, selection!.anchorNode!, selection!.anchorOffset)).toBe(6);
  
      act(() => fireEvent.keyDown(editor, { key: ')' }));
  
      expect(editor.textContent).toBe('hello()');
      expect(getEditorTextOffset(editor, selection!.anchorNode!, selection!.anchorOffset)).toBe(7);
      unmount();
    })
  it('wraps selected text in parentheses', () => {
      const { editor, onChange, unmount } = renderRichTextEditor({ text: 'word' });
      act(() => editor.focus());
      const selection = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(editor);
      selection?.removeAllRanges();
      selection?.addRange(range);
  
      act(() => fireEvent.keyDown(editor, { key: '(' }));
  
      expect(editor.textContent).toBe('(word)');
      expect(onChange).toHaveBeenLastCalledWith('(word)', []);
      expect(getEditorTextOffset(editor, selection!.anchorNode!, selection!.anchorOffset)).toBe(1);
      expect(getEditorTextOffset(editor, selection!.focusNode!, selection!.focusOffset)).toBe(5);
      unmount();
    })
  it('removes an empty parenthesis pair together with Backspace', () => {
      const { editor, onChange, unmount } = renderRichTextEditor({ text: '()' });
      act(() => editor.focus());
      const selection = window.getSelection();
      const caret = document.createRange();
      caret.setStart(editor.firstChild!, 1);
      caret.collapse(true);
      selection?.removeAllRanges();
      selection?.addRange(caret);
  
      act(() => fireEvent.keyDown(editor, { key: 'Backspace' }));
  
      expect(editor.textContent).toBe('');
      expect(onChange).toHaveBeenLastCalledWith('', []);
      unmount();
    })
  it('does not insert a parenthesis pair when both characters exceed the limit', () => {
      const { editor, onChange, unmount } = renderRichTextEditor({ text: 'x', maxLength: 2 });
      act(() => editor.focus());
      const selection = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(editor);
      range.collapse(false);
      selection?.removeAllRanges();
      selection?.addRange(range);
  
      let wasPrevented = false;
      act(() => {
        wasPrevented = !fireEvent.keyDown(editor, { key: '(' });
      });
  
      expect(wasPrevented).toBe(true);
      expect(editor.textContent).toBe('x');
      expect(onChange).not.toHaveBeenCalled();
      unmount();
    })
  it('does not jump to the top when the caret has no measurable bounds at the text limit', () => {
      const frames = captureAnimationFrames();
      const previousRangeBounds = Object.getOwnPropertyDescriptor(Range.prototype, 'getBoundingClientRect');
      Object.defineProperty(Range.prototype, 'getBoundingClientRect', {
        configurable: true,
        value: () => ({ top: 0, bottom: 0, left: 0, right: 0, width: 0, height: 0, x: 0, y: 0, toJSON: () => ({}) }),
      });
  
      try {
        const { editor, unmount } = renderRichTextEditor({ maxLength: 10 });
        Object.defineProperty(editor, 'clientHeight', { configurable: true, value: 100 });
        Object.defineProperty(editor, 'scrollHeight', { configurable: true, value: 500 });
        Object.defineProperty(editor, 'getBoundingClientRect', {
          configurable: true,
          value: () => ({ width: 300, height: 100, top: 100, right: 300, bottom: 200, left: 0, x: 0, y: 100, toJSON: () => ({}) }),
        });
        editor.scrollTop = 140;
        act(() => editor.focus());
        act(() => {
          editor.textContent = 'abcdefghijk';
          editor.dispatchEvent(new Event('input', { bubbles: true }));
        });
  
        expect(editor.textContent).toBe('abcdefghij');
        frames.flush();
        expect(editor.scrollTop).toBe(140);
        unmount();
      } finally {
        if (previousRangeBounds) Object.defineProperty(Range.prototype, 'getBoundingClientRect', previousRangeBounds);
        else Reflect.deleteProperty(Range.prototype, 'getBoundingClientRect');
        vi.restoreAllMocks();
      }
    })
  it('blocks only insertions that would exceed the editor limit', () => {
      expect(shouldPreventEditorInsertion(4, 0, 4)).toBe(true);
      expect(shouldPreventEditorInsertion(4, 1, 4)).toBe(false);
      expect(shouldPreventEditorInsertion(3, 0, 4)).toBe(false);
    })
  it('removes hidden word-joiner and soft-hyphen characters from repeated input', () => {
      const container = document.createElement('div');
      document.body.appendChild(container);
      const root = createRoot(container);
      const onChange = vi.fn();
  
      act(() => {
        root.render(<RichTextEditor text="" entities={[]} onChange={onChange} maxLength={4096} />);
      });
  
      const editor = container.querySelector('[contenteditable="true"]') as HTMLDivElement;
      act(() => {
        editor.textContent = 'B'.repeat(300) + '\u2060\u00AD\u200E\u200F';
        editor.dispatchEvent(new Event('input', { bubbles: true }));
      });
  
      expect(editor.textContent).toBe('B'.repeat(300));
      expect(onChange).toHaveBeenLastCalledWith('B'.repeat(300), []);
  
      act(() => root.unmount());
      container.remove();
    })
  it('keeps long unbroken strings as plain text without injecting artificial wrap hints', () => {
      const container = document.createElement('div');
      document.body.appendChild(container);
      const root = createRoot(container);
      const onChange = vi.fn();
  
      act(() => {
        root.render(<RichTextEditor text="" entities={[]} onChange={onChange} maxLength={4096} />);
      });
  
      const editor = container.querySelector('[contenteditable="true"]') as HTMLDivElement;
      act(() => {
        editor.textContent = 'a'.repeat(500);
        editor.dispatchEvent(new Event('input', { bubbles: true }));
      });
  
      expect(editor.querySelector('wbr')).toBeNull();
      expect(editor.textContent).toBe('a'.repeat(500));
      expect(editor.textContent?.length).toBe(500);
  
      act(() => root.unmount());
      container.remove();
    })
});
