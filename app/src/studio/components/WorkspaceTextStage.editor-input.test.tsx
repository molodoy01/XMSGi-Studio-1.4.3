import { act, useDeferredValue, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { fireEvent } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LocaleProvider } from '@studio/lib/i18n';
import { getEditorTextOffset } from '@studio/lib/richText';
import type { RichTextEntity } from '@studio/types';
import { ChatPreviewStand } from './ChatPreviewStand';
import { RichTextEditor, chatA, renderRichTextEditor, captureAnimationFrames } from './WorkspaceTextStage.testUtils';

describe("WorkspaceTextStage editor input and scrolling", () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    window.localStorage.clear();
  });

  it('keeps the editable field directly in the text stage', () => {
      const { editor, unmount } = renderRichTextEditor();
  
      expect(editor.parentElement?.classList.contains('workspace-page-rich-text-stage')).toBe(true);
      expect(document.querySelector('.workspace-page-rich-text-meta-row')).not.toBeNull();
      expect(document.querySelector('.workspace-page-character-count')).toBeNull();
      expect(document.querySelector('.workspace-page-rich-text-clear')).toBeNull();
  
      unmount();
    })
  it('enables the eraser for whitespace, tabs, and empty line breaks', () => {
      const { container, onChange, unmount } = renderRichTextEditor({ text: '  \n\t  ' });
      const clearButton = container.querySelector<HTMLButtonElement>('[aria-label="Clear editor text"]');
  
      expect(clearButton).not.toBeNull();
      expect(clearButton).toBeEnabled();
      expect(clearButton).toHaveAttribute('aria-hidden', 'false');
  
      act(() => clearButton?.click());
  
      expect(onChange).toHaveBeenLastCalledWith('', []);
  
      unmount();
    })
  it('clears immediately while saving a checkpoint and restores the text if saving fails', async () => {
      let resolveCheckpoint: ((success: boolean) => void) | undefined;
      const onBeforeClear = vi.fn(() => new Promise<boolean>((resolve) => {
        resolveCheckpoint = resolve;
      }));
      const { container, editor, onChange, unmount } = renderRichTextEditor({
        text: 'Text to preserve',
        onBeforeClear,
      });
      const clearButton = container.querySelector<HTMLButtonElement>('[aria-label="Clear editor text"]')!;
  
      act(() => clearButton.click());
  
      expect(onBeforeClear).toHaveBeenCalledOnce();
      expect(editor.textContent).toBe('');
      expect(editor).toHaveAttribute('contenteditable', 'false');
      expect(editor).toHaveAttribute('aria-busy', 'true');
      expect(onChange).toHaveBeenLastCalledWith('', []);
  
      await act(async () => {
        resolveCheckpoint?.(false);
      });
  
      expect(editor.textContent).toBe('Text to preserve');
      expect(editor).toHaveAttribute('contenteditable', 'true');
      expect(editor).not.toHaveAttribute('aria-busy');
      expect(onChange).toHaveBeenLastCalledWith('Text to preserve', []);
  
      unmount();
    })
  it('keeps the placeholder hidden when Enter follows Tab even if the caret is temporarily unavailable', async () => {
      const { editor, container, unmount } = renderRichTextEditor();
      const selection = window.getSelection()!;
      const range = document.createRange();
      range.selectNodeContents(editor);
      range.collapse(true);
      selection.removeAllRanges();
      selection.addRange(range);
  
      await act(async () => {
        fireEvent.keyDown(editor, { key: 'Tab' });
        await Promise.resolve();
      });
  
      selection.removeAllRanges();
      act(() => fireEvent.keyDown(editor, { key: 'Enter' }));
  
      expect(editor.classList.contains('has-content')).toBe(true);
      expect(editor.classList.contains('is-empty')).toBe(false);
      expect(container.querySelector('.workspace-page-rich-text-inline-hint')).toBeNull();
  
      unmount();
    })
  it('inserts two line breaks and keeps the caret on the indented line after Tab + Enter', async () => {
      const { editor, onChange, unmount } = renderRichTextEditor({ text: 'hello' });
      act(() => editor.focus());
      const textNode = editor.firstChild!;
      const range = document.createRange();
      range.setStart(textNode, textNode.textContent?.length ?? 0);
      range.collapse(true);
      const selection = window.getSelection()!;
      selection.removeAllRanges();
      selection.addRange(range);
  
      await act(async () => {
        fireEvent.keyDown(editor, { key: 'Tab' });
        await Promise.resolve();
      });
      let enterWasPrevented = false;
      act(() => {
        enterWasPrevented = !fireEvent.keyDown(editor, { key: 'Enter' });
      });
  
      expect(enterWasPrevented).toBe(true);
      expect(editor.innerHTML).toBe('hello  <br><br>');
      expect(onChange).toHaveBeenLastCalledWith('hello  \n\n', []);
      expect(getEditorTextOffset(editor, selection.anchorNode!, selection.anchorOffset)).toBe('hello  \n\n'.length);
  
      unmount();
    })
  it('preserves the browser paragraph and caret when Enter inserts a block', () => {
      const { editor, onChange, unmount } = renderRichTextEditor();
      act(() => editor.focus());
      editor.innerHTML = '<div>first</div><div>second</div>';
      const secondText = editor.lastChild?.firstChild;
      expect(secondText).toBeInstanceOf(Text);
  
      const range = document.createRange();
      range.setStart(secondText!, 3);
      range.collapse(true);
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
  
      act(() => fireEvent.input(editor));
  
      expect(onChange).toHaveBeenLastCalledWith('first\nsecond', []);
      expect(editor.innerHTML).toBe('<div>first</div><div>second</div>');
      expect(selection?.anchorNode?.textContent).toBe('second');
      expect(selection?.anchorOffset).toBe(3);
  
      unmount();
    })
  it('leaves plain Enter to the browser native editor behavior', async () => {
      const { editor, onChange, unmount } = renderRichTextEditor({ text: '  first' });
      act(() => editor.focus());
      const line = document.createElement('div');
      line.textContent = '  first';
      editor.replaceChildren(line);
      const endOfLine = document.createRange();
      endOfLine.selectNodeContents(line);
      endOfLine.collapse(false);
      const selection = window.getSelection()!;
      selection.removeAllRanges();
      selection.addRange(endOfLine);
  
      let enterWasPrevented = false;
      await act(async () => {
        enterWasPrevented = !fireEvent.keyDown(editor, { key: 'Enter' });
        editor.innerHTML = '<div>  first</div><div><br></div>';
        fireEvent.input(editor, { inputType: 'insertParagraph' });
        await Promise.resolve();
      });
      expect(enterWasPrevented).toBe(false);
      expect(editor.innerHTML).toBe('<div>  first</div><div><br></div>');
      expect(onChange).toHaveBeenLastCalledWith('  first\n', []);
  
      unmount();
    })
  it('removes browser-inserted light span styling when Backspace joins lines', async () => {
      const { editor, onChange, unmount } = renderRichTextEditor({ text: 'word' });
      act(() => editor.focus());
      editor.innerHTML = '<div><br></div>word';
      const word = editor.lastChild!;
      const caret = document.createRange();
      caret.setStart(word, 0);
      caret.collapse(true);
      const selection = window.getSelection()!;
      selection.removeAllRanges();
      selection.addRange(caret);

      act(() => fireEvent.keyDown(editor, { key: 'Backspace' }));
      editor.innerHTML = '<span style="color: rgb(240, 246, 248)">word</span>';
      const mergedText = editor.firstChild!.firstChild!;
      const mergedCaret = document.createRange();
      mergedCaret.setStart(mergedText, 0);
      mergedCaret.collapse(true);
      selection.removeAllRanges();
      selection.addRange(mergedCaret);
      await act(async () => {
        fireEvent.input(editor, { inputType: 'deleteContentBackward' });
        await Promise.resolve();
      });

      expect(onChange).toHaveBeenLastCalledWith('word', []);
      expect(editor.innerHTML).toBe('word');
      expect(getEditorTextOffset(editor, selection.anchorNode!, selection.anchorOffset)).toBe(0);
      unmount();
    })
  it('does not intercept Enter during composition or on legacy keyboard events', async () => {
      const { editor, onChange, unmount } = renderRichTextEditor({ text: 'word' });
      act(() => editor.focus());
  
      let composingEnterWasPrevented = true;
      act(() => {
        composingEnterWasPrevented = !fireEvent.keyDown(editor, { key: 'Enter', isComposing: true });
      });
  
      expect(composingEnterWasPrevented).toBe(false);
      expect(editor.textContent).toBe('word');
  
      let legacyEnterWasPrevented = true;
      await act(async () => {
        legacyEnterWasPrevented = !fireEvent.keyDown(editor, { key: 'Enter', keyCode: 229 });
        editor.innerHTML = 'word<div><br></div>';
        fireEvent.input(editor, { inputType: 'insertParagraph' });
        await Promise.resolve();
      });
      expect(legacyEnterWasPrevented).toBe(false);
      expect(onChange).toHaveBeenLastCalledWith('word\n', []);
  
      unmount();
    })
  it('deletes a blank paragraph at the bottom without losing the previous line', async () => {
      const { editor, onChange, unmount } = renderRichTextEditor();
      act(() => editor.focus());
      editor.innerHTML = '<div>first</div><div><br></div>';
      const lastLine = editor.lastChild!;
      const caret = document.createRange();
      caret.setStart(lastLine, 0);
      caret.collapse(true);
      const selection = window.getSelection()!;
      selection.removeAllRanges();
      selection.addRange(caret);
  
      let backspaceWasPrevented = true;
      act(() => {
        backspaceWasPrevented = !fireEvent.keyDown(editor, { key: 'Backspace' });
      });
      expect(backspaceWasPrevented).toBe(false);
      editor.innerHTML = '<div>first</div>';
      const previousLine = editor.firstChild!;
      const endOfPreviousLine = document.createRange();
      endOfPreviousLine.selectNodeContents(previousLine);
      endOfPreviousLine.collapse(false);
      selection.removeAllRanges();
      selection.addRange(endOfPreviousLine);
      await act(async () => {
        fireEvent.input(editor, { inputType: 'deleteContentBackward' });
        await Promise.resolve();
      });
  
      expect(onChange).toHaveBeenLastCalledWith('first', []);
      expect(editor.innerHTML).toBe('<div>first</div>');
      expect(selection.anchorNode).toBe(previousLine);
      expect(selection.anchorOffset).toBe(1);
  
      unmount();
    })
  it('keeps every repeated Enter available to the browser native editor behavior', async () => {
      const { editor, onChange, unmount } = renderRichTextEditor();
      act(() => editor.focus());
  
      for (let index = 0; index < 5; index += 1) {
        let enterWasPrevented = false;
        await act(async () => {
          enterWasPrevented = !fireEvent.keyDown(editor, { key: 'Enter', repeat: index > 0 });
          editor.insertAdjacentHTML('beforeend', '<div><br></div>');
          fireEvent.input(editor, { inputType: 'insertParagraph' });
          await Promise.resolve();
        });
        expect(enterWasPrevented).toBe(false);
        act(() => fireEvent.keyUp(editor, { key: 'Enter' }));
        expect(onChange).toHaveBeenLastCalledWith('\n'.repeat(index + 1), []);
      }
  
      expect(editor.querySelectorAll('div')).toHaveLength(5);
      expect(onChange).toHaveBeenLastCalledWith('\n\n\n\n\n', []);
      expect(editor.classList.contains('has-content')).toBe(true);
      expect(editor.classList.contains('is-empty')).toBe(false);
  
      unmount();
    })
  it('keeps the caret in the latest empty paragraph after Enter release so Backspace can delete it', async () => {
      const { editor, onChange, unmount } = renderRichTextEditor();
      act(() => editor.focus());
      editor.innerHTML = '<div><br></div><div><br></div><div><br></div>';
  
      const lastLine = editor.lastChild!;
      const caret = document.createRange();
      caret.setStart(lastLine, 0);
      caret.collapse(true);
      const selection = window.getSelection()!;
      selection.removeAllRanges();
      selection.addRange(caret);
  
      act(() => fireEvent.keyUp(editor, { key: 'Enter' }));
      expect(selection.anchorNode).toBe(lastLine);
  
      let backspaceWasPrevented = true;
      act(() => {
        backspaceWasPrevented = !fireEvent.keyDown(editor, { key: 'Backspace' });
      });
      expect(backspaceWasPrevented).toBe(false);
  
      lastLine.remove();
      const remainingLastLine = editor.lastChild!;
      const remainingCaret = document.createRange();
      remainingCaret.setStart(remainingLastLine, 0);
      remainingCaret.collapse(true);
      selection.removeAllRanges();
      selection.addRange(remainingCaret);
      await act(async () => {
        fireEvent.input(editor, { inputType: 'deleteContentBackward' });
        await Promise.resolve();
      });
      expect(onChange).toHaveBeenLastCalledWith('\n\n', []);
      act(() => fireEvent.keyUp(editor, { key: 'Backspace' }));
      expect(selection.anchorNode).toBe(remainingLastLine);
  
      act(() => {
        backspaceWasPrevented = !fireEvent.keyDown(editor, { key: 'Backspace' });
      });
      expect(backspaceWasPrevented).toBe(false);
      remainingLastLine.remove();
      const finalLine = editor.lastChild!;
      const finalCaret = document.createRange();
      finalCaret.setStart(finalLine, 0);
      finalCaret.collapse(true);
      selection.removeAllRanges();
      selection.addRange(finalCaret);
      await act(async () => {
        fireEvent.input(editor, { inputType: 'deleteContentBackward' });
        await Promise.resolve();
      });
      expect(onChange).toHaveBeenLastCalledWith('\n', []);
  
      unmount();
    })
  it('passes paragraph breaks and formatting from the editor into the live preview', async () => {
      function EditorWithLivePreview() {
        const [text, setText] = useState('');
        const [entities, setEntities] = useState<RichTextEntity[]>([]);
        const previewText = useDeferredValue(text);
        const previewEntities = useDeferredValue(entities);
        const previewFeedRef = useRef<HTMLDivElement | null>(null);
  
        return (
          <LocaleProvider>
            <RichTextEditor
              text={text}
              entities={entities}
              onChange={(nextText, nextEntities) => {
                setText(nextText);
                setEntities(nextEntities);
              }}
              maxLength={4096}
            />
            <ChatPreviewStand
              chats={[chatA]}
              selectedChat={chatA}
              previewHistory={null}
              previewHistoryLoading={false}
              previewFeedRef={previewFeedRef}
              draftText={previewText}
              draftEntities={previewEntities}
              attachments={[]}
              previewTime="10:00"
              collapsed={false}
              chatListOpen={false}
              onToggleChatList={vi.fn()}
              onSelectChat={vi.fn()}
            />
          </LocaleProvider>
        );
      }
  
      const container = document.createElement('div');
      document.body.appendChild(container);
      const root = createRoot(container);
      act(() => root.render(<EditorWithLivePreview />));
      const editor = container.querySelector('[contenteditable="true"]') as HTMLDivElement;
      expect(container.querySelector('.workspace-page-rich-text-inline-hint')).toBeNull();
      act(() => editor.focus());
      expect(editor.classList.contains('is-empty')).toBe(true);
      expect(editor.classList.contains('is-focused')).toBe(true);
      expect(container.querySelector('.workspace-page-rich-text-inline-hint')).toBeNull();
      act(() => editor.blur());
      expect(editor.classList.contains('is-focused')).toBe(false);
      expect(container.querySelector('.workspace-page-rich-text-inline-hint')).toBeNull();
      act(() => editor.focus());
  
      await act(async () => {
        fireEvent.keyDown(editor, { key: 'Tab' });
        await Promise.resolve();
      });
  
      expect(editor.textContent).toBe('  ');
      expect(editor.classList.contains('has-content')).toBe(false);
      expect(editor.classList.contains('is-empty')).toBe(true);
      expect(container.querySelector('.workspace-page-rich-text-inline-hint')).toBeNull();
  
      await act(async () => {
        fireEvent.keyDown(editor, { key: 'Tab', shiftKey: true });
        await Promise.resolve();
      });
  
      expect(editor.textContent).toBe('');
      expect(editor.classList.contains('is-empty')).toBe(true);
      expect(container.querySelector('.workspace-page-rich-text-inline-hint')).toBeNull();
  
      editor.innerHTML = '';
      const emptySelection = window.getSelection()!;
      const emptyRange = document.createRange();
      emptyRange.selectNodeContents(editor);
      emptyRange.collapse(true);
      emptySelection.removeAllRanges();
      emptySelection.addRange(emptyRange);
      const simulateBrowserEnter = async (nextHtml: string, shiftKey = false) => {
        let wasPrevented = true;
        await act(async () => {
          wasPrevented = !fireEvent.keyDown(editor, { key: 'Enter', shiftKey });
          editor.innerHTML = nextHtml;
          fireEvent.input(editor, { inputType: shiftKey ? 'insertLineBreak' : 'insertParagraph' });
          await Promise.resolve();
        });
        expect(wasPrevented).toBe(false);
      };
      let emptyEnterWasPrevented = false;
      await act(async () => {
        emptyEnterWasPrevented = !fireEvent.keyDown(editor, { key: 'Enter' });
        editor.innerHTML = '<div><br></div>';
        fireEvent.input(editor, { inputType: 'insertParagraph' });
        await Promise.resolve();
      });
      expect(emptyEnterWasPrevented).toBe(false);
      expect(editor.classList.contains('has-content')).toBe(true);
      expect(editor.classList.contains('is-empty')).toBe(false);
      expect(container.querySelector('.chat-preview-draft-bubble')).toBeNull();
      await simulateBrowserEnter('<div><br></div><div><br></div>');
      expect(editor.innerHTML).toBe('<div><br></div><div><br></div>');
      expect(container.querySelector('.chat-preview-draft-bubble')).toBeNull();
      editor.innerHTML = '';
      await act(async () => {
        fireEvent.input(editor, { inputType: 'deleteContentBackward' });
        await Promise.resolve();
      });
      emptyRange.selectNodeContents(editor);
      emptyRange.collapse(true);
      emptySelection.removeAllRanges();
      emptySelection.addRange(emptyRange);
  
      let emptyShiftEnterWasPrevented = false;
      await act(async () => {
        emptyShiftEnterWasPrevented = !fireEvent.keyDown(editor, { key: 'Enter', shiftKey: true });
        editor.innerHTML = '<br>';
        fireEvent.input(editor, { inputType: 'insertLineBreak' });
        await Promise.resolve();
      });
      expect(emptyShiftEnterWasPrevented).toBe(false);
      expect(container.querySelector('.chat-preview-draft-bubble')).toBeNull();
      expect(editor.classList.contains('has-content')).toBe(true);
      expect(editor.classList.contains('is-empty')).toBe(false);
      expect(container.querySelector('.workspace-page-rich-text-inline-hint')).toBeNull();
  
      editor.innerHTML = '';
      emptyRange.selectNodeContents(editor);
      emptyRange.collapse(true);
      emptySelection.removeAllRanges();
      emptySelection.addRange(emptyRange);
  
      let emptyParagraphEnterWasPrevented = true;
      await act(async () => {
        emptyParagraphEnterWasPrevented = !fireEvent.keyDown(editor, { key: 'Enter' });
        editor.innerHTML = '<div><br></div><div><br></div>';
        fireEvent.input(editor, { inputType: 'insertParagraph' });
        await Promise.resolve();
      });
      expect(emptyParagraphEnterWasPrevented).toBe(false);
      expect(editor.classList.contains('has-content')).toBe(true);
      expect(container.querySelector('.chat-preview-draft-bubble')).toBeNull();
  
      editor.innerHTML = '<div><br></div>';
      const resetEmptyParagraphRange = document.createRange();
      resetEmptyParagraphRange.setStart(editor.firstChild!, 0);
      resetEmptyParagraphRange.collapse(true);
      emptySelection.removeAllRanges();
      emptySelection.addRange(resetEmptyParagraphRange);
      await simulateBrowserEnter('<div><br></div><div><br></div>');
      expect(editor.innerHTML).toBe('<div><br></div><div><br></div>');
  
      editor.innerHTML = '';
      emptyRange.selectNodeContents(editor);
      emptyRange.collapse(true);
      emptySelection.removeAllRanges();
      emptySelection.addRange(emptyRange);
      await act(async () => {
        fireEvent.input(editor, { inputType: 'deleteContentBackward' });
        await Promise.resolve();
      });
  
      await act(async () => {
        fireEvent.keyDown(editor, { key: 'Tab' });
        await Promise.resolve();
      });
      expect(editor.textContent).toBe('  ');
      expect(editor.classList.contains('has-content')).toBe(false);
      expect(container.querySelector('.workspace-page-rich-text-inline-hint')).toBeNull();
      let tabEnterWasPrevented = true;
      act(() => {
        tabEnterWasPrevented = !fireEvent.keyDown(editor, { key: 'Enter' });
      });
      expect(tabEnterWasPrevented).toBe(true);
      expect(editor.classList.contains('has-content')).toBe(true);
      expect(editor.classList.contains('is-empty')).toBe(false);
      expect(container.querySelector('.workspace-page-rich-text-inline-hint')).toBeNull();
      const emptyLineEraser = container.querySelector<HTMLButtonElement>('[aria-label="Clear editor text"]');
      expect(emptyLineEraser).toBeEnabled();
      expect(editor.innerHTML).toBe('  <br><br>  ');
      expect(container.querySelector('.chat-preview-draft-bubble')).toBeNull();
      await act(async () => {
        emptyLineEraser?.click();
        await Promise.resolve();
      });
      expect(editor.innerHTML).toBe('');
      act(() => editor.blur());
      expect(container.querySelector('.workspace-page-rich-text-inline-hint')).toBeNull();
      act(() => editor.focus());
  
      editor.innerHTML = '';
      await act(async () => {
        fireEvent.input(editor, { inputType: 'deleteContentBackward' });
        await Promise.resolve();
      });
      expect(editor.classList.contains('is-empty')).toBe(true);
      expect(editor).toHaveAttribute('data-placeholder', 'What shall we share?');
      expect(container.querySelector('.workspace-page-rich-text-inline-hint')).toBeNull();
  
      const secondLine = 'SecXond line';
      editor.innerHTML = '<div><strong>First</strong> line</div><div>SecXond line</div>';
      const secondLineText = editor.lastChild?.firstChild;
      const selection = window.getSelection()!;
      const range = document.createRange();
      range.setStart(secondLineText!, 4);
      range.collapse(true);
      selection.removeAllRanges();
      selection.addRange(range);
  
      try {
        await act(async () => {
          fireEvent.input(editor);
          await Promise.resolve();
        });
  
        expect(editor.classList.contains('has-content')).toBe(true);
        expect(editor.classList.contains('is-empty')).toBe(false);
        expect(container.querySelector('.workspace-page-rich-text-inline-hint')).toBeNull();
        expect(editor.innerHTML).toBe('<div><strong>First</strong> line</div><div>SecXond line</div>');
        expect(selection.anchorNode?.textContent).toBe(secondLine);
        expect(selection.anchorOffset).toBe(4);
        expect(container.querySelector('.chat-preview-draft-bubble .chat-preview-message')?.innerHTML)
          .toBe('<strong>First</strong> line<br>SecXond line');
  
        const currentSecondLine = editor.lastChild?.firstChild;
        const secondLineStart = document.createRange();
        secondLineStart.setStart(currentSecondLine!, 0);
        secondLineStart.collapse(true);
        selection.removeAllRanges();
        selection.addRange(secondLineStart);
  
        await act(async () => {
          fireEvent.keyDown(editor, { key: 'Tab' });
          await Promise.resolve();
        });
  
        expect(editor.innerHTML).toBe('<div><strong>First</strong> line</div><div>  SecXond line</div>');
        expect(container.querySelector('.chat-preview-draft-bubble .chat-preview-message')?.innerHTML)
          .toBe('<strong>First</strong> line<br>  SecXond line');
  
        await act(async () => {
          fireEvent.keyDown(editor, { key: 'Tab', shiftKey: true });
          await Promise.resolve();
        });
  
        expect(editor.innerHTML).toBe('<div><strong>First</strong> line</div><div>SecXond line</div>');
        expect(container.querySelector('.chat-preview-draft-bubble .chat-preview-message')?.innerHTML)
          .toBe('<strong>First</strong> line<br>SecXond line');
  
        const firstLineText = editor.querySelector('strong')?.firstChild;
        const lastLineBlock = editor.lastChild as HTMLElement;
        const selectedLines = document.createRange();
        selectedLines.setStart(firstLineText!, 0);
        selectedLines.setEnd(lastLineBlock, lastLineBlock.childNodes.length);
        selection.removeAllRanges();
        selection.addRange(selectedLines);
  
        await act(async () => {
          fireEvent.keyDown(editor, { key: 'Tab' });
          await Promise.resolve();
        });
  
        expect(editor.innerHTML).toBe('<div><strong>  First</strong> line</div><div>  SecXond line</div>');
        expect(container.querySelector('.chat-preview-draft-bubble .chat-preview-message')?.innerHTML)
          .toBe('<strong>  First</strong> line<br>  SecXond line');
  
        await act(async () => {
          fireEvent.keyDown(editor, { key: 'Tab', shiftKey: true });
          await Promise.resolve();
        });
  
        expect(editor.innerHTML).toBe('<div><strong>First</strong> line</div><div>SecXond line</div>');
        expect(container.querySelector('.chat-preview-draft-bubble .chat-preview-message')?.innerHTML)
          .toBe('<strong>First</strong> line<br>SecXond line');
  
        const currentSecondLineForTab = editor.lastChild?.firstChild;
        const indentLine = document.createRange();
        indentLine.setStart(currentSecondLineForTab!, 0);
        indentLine.collapse(true);
        selection.removeAllRanges();
        selection.addRange(indentLine);
        await act(async () => {
          fireEvent.keyDown(editor, { key: 'Tab' });
          await Promise.resolve();
        });
  
        const indentedLine = editor.lastChild as HTMLElement;
        const endOfIndentedLine = document.createRange();
        endOfIndentedLine.selectNodeContents(indentedLine);
        endOfIndentedLine.collapse(false);
        selection.removeAllRanges();
        selection.addRange(endOfIndentedLine);
  
        act(() => fireEvent.keyDown(editor, { key: 'Enter' }));
        expect(indentedLine.textContent).toBe('  SecXond line  ');
        expect(editor.querySelectorAll('br')).toHaveLength(2);
        expect(container.querySelector('.chat-preview-draft-bubble .chat-preview-message')?.innerHTML)
          .toBe('<strong>First</strong> line<br>  SecXond line<br><br>  ');
      } finally {
        act(() => root.unmount());
        container.remove();
      }
    })
  it('uses an external scrollbar to control long editor text', () => {
      const frames = captureAnimationFrames();
      const { editor, container, unmount } = renderRichTextEditor();
      Object.defineProperty(editor, 'clientHeight', { configurable: true, value: 100 });
      Object.defineProperty(editor, 'scrollHeight', { configurable: true, value: 400 });
      const scrollbar = container.querySelector<HTMLElement>('[role="scrollbar"]');
  
      expect(scrollbar).not.toBeNull();
      expect(scrollbar?.parentElement?.classList.contains('workspace-page-rich-text-stage-shell')).toBe(true);
      expect(scrollbar?.parentElement).not.toBe(editor.parentElement);
      expect(scrollbar).toHaveAttribute('aria-controls', 'workspace-page-rich-text-input');
  
      frames.flush();
      act(() => {
        editor.scrollTop = 150;
        editor.dispatchEvent(new Event('scroll'));
        editor.dispatchEvent(new Event('scroll'));
      });
  
      expect(frames.pendingCount).toBe(1);
      frames.flush();
      expect(scrollbar).toHaveAttribute('aria-valuenow', '50');
      expect(scrollbar?.querySelector('.workspace-page-rich-text-scrollbar-thumb')).toHaveStyle({ top: '37.5%', height: '25%' });
  
      act(() => {
        scrollbar?.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true, cancelable: true }));
      });
  
      expect(editor.scrollTop).toBe(300);
  
      unmount();
      vi.restoreAllMocks();
    })
  it('drags the editor scrollbar by grabbing its thumb', () => {
      const frames = captureAnimationFrames();
      const { editor, container, unmount } = renderRichTextEditor();
      Object.defineProperty(editor, 'clientHeight', { configurable: true, value: 100 });
      Object.defineProperty(editor, 'scrollHeight', { configurable: true, value: 400 });
      frames.flush();
      act(() => editor.dispatchEvent(new Event('scroll')));
      frames.flush();
      const scrollbar = container.querySelector<HTMLElement>('[role="scrollbar"]')!;
      const thumb = scrollbar.querySelector<HTMLElement>('.workspace-page-rich-text-scrollbar-thumb')!;
      Object.defineProperty(scrollbar, 'clientHeight', { configurable: true, value: 100 });
      Object.defineProperty(scrollbar, 'setPointerCapture', { configurable: true, value: vi.fn() });
      Object.defineProperty(scrollbar, 'hasPointerCapture', { configurable: true, value: vi.fn(() => true) });
      Object.defineProperty(scrollbar, 'releasePointerCapture', { configurable: true, value: vi.fn() });
  
      act(() => {
        fireEvent.pointerDown(thumb, { pointerId: 1, clientY: 10 });
        fireEvent.pointerMove(scrollbar, { pointerId: 1, clientY: 25 });
      });
  
      expect(editor.scrollTop).toBe(60);
      expect(scrollbar).toHaveClass('is-dragging');
      expect(scrollbar.setPointerCapture).toHaveBeenCalledWith(1);
  
      act(() => fireEvent.pointerUp(scrollbar, { pointerId: 1, clientY: 25 }));
  
      expect(scrollbar).not.toHaveClass('is-dragging');
      expect(scrollbar.releasePointerCapture).toHaveBeenCalledWith(1);
      unmount();
      vi.restoreAllMocks();
    })
});
