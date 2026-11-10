import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { fireEvent } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RichTextEditor, renderRichTextEditor } from './WorkspaceTextStage.testUtils';

describe("WorkspaceTextStage editor formatting", () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    window.localStorage.clear();
  });

  it('opens link entry inside the toolbar and confirms the selected text as a link', async () => {
      const container = document.createElement('div');
      document.body.appendChild(container);
      const root = createRoot(container);
      const onChange = vi.fn();
  
      act(() => {
        root.render(<RichTextEditor text="Read more" entities={[]} onChange={onChange} maxLength={4096} />);
      });
  
      const editor = container.querySelector('[contenteditable="true"]') as HTMLDivElement;
      act(() => editor.focus());
      const range = document.createRange();
      range.selectNodeContents(editor);
      const selection = window.getSelection()!;
      selection.removeAllRanges();
      selection.addRange(range);
      act(() => editor.dispatchEvent(new MouseEvent('mouseup', { bubbles: true })));
  
      const linkButton = container.querySelector('[aria-label="Insert link"]') as HTMLButtonElement;
      expect(linkButton.querySelector('.workspace-page-rich-text-link-trigger__icon svg')).not.toBeNull();
      act(() => linkButton.click());
  
      const popover = container.querySelector('[role="dialog"][aria-label="Insert link"]') as HTMLFormElement;
      expect(popover.parentElement?.classList.contains('workspace-page-rich-text-link-controls')).toBe(true);
      expect(popover.parentElement?.classList.contains('is-open')).toBe(true);
      expect(popover.closest('[role="toolbar"]')).not.toBeNull();
      expect(popover.parentElement?.nextElementSibling).toHaveClass('workspace-page-rich-text-toolbar-divider');
      expect(popover.querySelectorAll('button')).toHaveLength(2);
      expect(popover.querySelector('.workspace-page-rich-text-link-popover__cancel')?.textContent).toBe('Cancel');
      expect((popover.querySelector('button[type="submit"]') as HTMLButtonElement).disabled).toBe(true);
      expect(linkButton).toHaveAttribute('aria-expanded', 'true');
      act(() => linkButton.click());
      expect(container.querySelector('[role="dialog"][aria-label="Insert link"]')).toBeNull();
      expect(linkButton).toHaveAttribute('aria-expanded', 'false');
      act(() => linkButton.click());
  
      const reopenedPopover = container.querySelector('[role="dialog"][aria-label="Insert link"]') as HTMLFormElement;
      const input = reopenedPopover.querySelector('input') as HTMLInputElement;
      const valueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
      act(() => {
        valueSetter?.call(input, 'https://example.com');
        input.dispatchEvent(new Event('input', { bubbles: true }));
      });
      const confirmButton = reopenedPopover.querySelector('button[type="submit"]') as HTMLButtonElement;
      expect(confirmButton.disabled).toBe(false);
      act(() => confirmButton.click());
  
      expect(onChange).toHaveBeenLastCalledWith('Read more', [
        { type: 'text_url', offset: 0, length: 9, url: 'https://example.com' },
      ]);
      expect(container.querySelector('[role="dialog"][aria-label="Insert link"]')).toBeNull();
  
      act(() => editor.focus());
      act(() => root.unmount());
      container.remove();
    })
  it('matches open editor menus to the text field width in a narrow Electron window', () => {
      document.documentElement.classList.add('electron-runtime');
      const container = document.createElement('div');
      document.body.appendChild(container);
      const root = createRoot(container);
  
      act(() => {
        root.render(<RichTextEditor
          text="Message"
          entities={[]}
          onChange={vi.fn()}
          maxLength={4096}
          onEffectChange={vi.fn()}
          onExportText={vi.fn()}
        />);
      });
  
      const editorInput = container.querySelector<HTMLElement>('.workspace-page-rich-text-input.is-active')!;
      vi.spyOn(editorInput, 'getBoundingClientRect').mockReturnValue({
        x: 24, y: 80, left: 24, top: 80, right: 744, bottom: 420, width: 720, height: 340,
        toJSON: () => ({}),
      } as DOMRect);
      const toolbar = container.querySelector<HTMLElement>('.workspace-page-rich-text-toolbar')!;
      vi.spyOn(toolbar, 'getBoundingClientRect').mockReturnValue({
        x: 20, y: 30, left: 20, top: 30, right: 744, bottom: 70, width: 724, height: 40,
        toJSON: () => ({}),
      } as DOMRect);
      const linkAnchor = container.querySelector<HTMLElement>('.workspace-page-rich-text-link-controls')!;
      vi.spyOn(linkAnchor, 'getBoundingClientRect').mockReturnValue({
        x: 600, y: 40, left: 600, top: 40, right: 632, bottom: 70, width: 32, height: 30,
        toJSON: () => ({}),
      } as DOMRect);
      const linkButton = container.querySelector<HTMLButtonElement>('[aria-label="Insert link"]')!;
      act(() => linkButton.click());
  
      const popover = container.querySelector<HTMLElement>('.workspace-page-rich-text-link-popover')!;
      expect(popover.style.getPropertyValue('position')).toBe('fixed');
      expect(popover.style.getPropertyValue('left')).toBe('4px');
      expect(popover.style.getPropertyValue('top')).toBe('48px');
      expect(popover.style.getPropertyValue('width')).toBe('720px');
      expect(popover.querySelectorAll('button')).toHaveLength(2);
  
      act(() => linkButton.click());
      const [emojiButton, effectsButton] = container.querySelectorAll<HTMLButtonElement>('.workspace-page-rich-text-leading-tools button');
      act(() => emojiButton.click());
      const emojiPicker = document.body.querySelector<HTMLElement>('.workspace-page-rich-text-emoji-picker--floating')!;
      expect(emojiPicker.style.left).toBe('24px');
      expect(emojiPicker.style.width).toBe('720px');
  
      act(() => emojiButton.click());
      act(() => effectsButton.click());
      const effectsPicker = container.querySelector<HTMLElement>('.workspace-page-rich-text-effects-picker')!;
      expect(effectsPicker.style.getPropertyValue('position')).toBe('fixed');
      expect(effectsPicker.style.getPropertyValue('left')).toBe('4px');
      expect(effectsPicker.style.getPropertyValue('width')).toBe('720px');
  
      act(() => effectsButton.click());
      act(() => container.querySelector<HTMLButtonElement>('.workspace-page-editor-export-trigger')!.click());
      const exportMenu = container.querySelector<HTMLElement>('.workspace-page-editor-export-menu')!;
      expect(exportMenu.style.getPropertyValue('position')).toBe('fixed');
      expect(exportMenu.style.getPropertyValue('left')).toBe('4px');
      expect(exportMenu.style.getPropertyValue('width')).toBe('720px');
  
      act(() => root.unmount());
      container.remove();
      document.documentElement.classList.remove('electron-runtime');
    })
  it('closes link entry with Escape without changing the message', () => {
      const container = document.createElement('div');
      document.body.appendChild(container);
      const root = createRoot(container);
      const onChange = vi.fn();
  
      act(() => {
        root.render(<RichTextEditor text="Keep this text" entities={[]} onChange={onChange} maxLength={4096} />);
      });
  
      act(() => (container.querySelector('[aria-label="Insert link"]') as HTMLButtonElement).click());
      const input = container.querySelector('[role="dialog"] input[type="url"]') as HTMLInputElement;
      act(() => input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
  
      expect(container.querySelector('[role="dialog"][aria-label="Insert link"]')).toBeNull();
      expect((container.querySelector('[contenteditable="true"]') as HTMLDivElement).textContent).toBe('Keep this text');
      expect(onChange).not.toHaveBeenCalled();
  
      act(() => root.unmount());
      container.remove();
    })
  it('closes link entry when another button is pressed and lets that button work', () => {
      const container = document.createElement('div');
      const otherButton = document.createElement('button');
      const otherButtonAction = vi.fn();
      otherButton.addEventListener('click', otherButtonAction);
      document.body.append(container, otherButton);
      const root = createRoot(container);
  
      act(() => {
        root.render(<RichTextEditor text="Keep this text" entities={[]} onChange={vi.fn()} maxLength={4096} />);
      });
      act(() => (container.querySelector('[aria-label="Insert link"]') as HTMLButtonElement).click());
      expect(container.querySelector('[role="dialog"][aria-label="Insert link"]')).toBeTruthy();
  
      act(() => {
        otherButton.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
        otherButton.click();
      });
  
      expect(container.querySelector('[role="dialog"][aria-label="Insert link"]')).toBeNull();
      expect(otherButtonAction).toHaveBeenCalledOnce();
  
      act(() => root.unmount());
      container.remove();
      otherButton.remove();
    })
  it('closes link entry with Cancel without changing the message', () => {
      const container = document.createElement('div');
      document.body.appendChild(container);
      const root = createRoot(container);
      const onChange = vi.fn();
  
      act(() => {
        root.render(<RichTextEditor text="Keep this text" entities={[]} onChange={onChange} maxLength={4096} />);
      });
      act(() => (container.querySelector('[aria-label="Insert link"]') as HTMLButtonElement).click());
      act(() => (container.querySelector('.workspace-page-rich-text-link-popover__cancel') as HTMLButtonElement).click());
  
      expect(container.querySelector('[role="dialog"][aria-label="Insert link"]')).toBeNull();
      expect((container.querySelector('[contenteditable="true"]') as HTMLDivElement).textContent).toBe('Keep this text');
      expect(onChange).not.toHaveBeenCalled();
  
      act(() => root.unmount());
      container.remove();
    })
  it('opens the format toolbar with the selected format state remembered', () => {
      const { container, editor, unmount } = renderRichTextEditor({
        text: 'Bold text',
        entities: [{ type: 'bold', offset: 0, length: 4 }],
      });
      const boldText = editor.querySelector('strong')!;
      const range = document.createRange();
      range.selectNodeContents(boldText);
      const selection = window.getSelection()!;
      selection.removeAllRanges();
      selection.addRange(range);
  
      act(() => editor.dispatchEvent(new MouseEvent('mouseup', { bubbles: true })));
      const toolbar = container.querySelector('[role="toolbar"]')!;
      expect(toolbar.classList.contains('is-airy')).toBe(true);
      expect(toolbar.querySelector('[aria-label="Bold"]')?.getAttribute('aria-pressed')).toBe('true');
      expect(toolbar.querySelector('[aria-label="Italic"]')?.getAttribute('aria-pressed')).toBe('false');
  
      const previousExecCommand = Object.getOwnPropertyDescriptor(document, 'execCommand');
      const execCommand = vi.fn(() => true);
      Object.defineProperty(document, 'execCommand', { configurable: true, value: execCommand });
      act(() => (toolbar.querySelector('[aria-label="Bold"]') as HTMLButtonElement).click());
      expect(execCommand).toHaveBeenCalledWith('bold', false);
      if (previousExecCommand) Object.defineProperty(document, 'execCommand', previousExecCommand);
      else Reflect.deleteProperty(document, 'execCommand');
  
      unmount();
    })
  it('inserts an emoji at the saved editor selection', () => {
      window.localStorage.setItem('awaitmsg_locale', 'ru');
      const { container, editor, onChange, unmount } = renderRichTextEditor({ text: 'Write here' });
      const textNode = editor.firstChild as Text;
      const range = document.createRange();
      range.setStart(textNode, 5);
      range.collapse(true);
      const selection = window.getSelection()!;
      selection.removeAllRanges();
      selection.addRange(range);
      act(() => editor.dispatchEvent(new MouseEvent('mouseup', { bubbles: true })));
  
      expect(Array.from(container.querySelectorAll('.workspace-page-rich-text-toolbar button'), (button) => button.getAttribute('aria-label')))
        .toContain('Выбрать смайлик');
      const emojiButton = container.querySelector<HTMLButtonElement>('[aria-label="Выбрать смайлик"]')!;
      fireEvent.click(emojiButton);
      expect(document.querySelector('[role="dialog"][aria-label="Выбрать эмодзи"]')).not.toBeNull();
      const emojiPicker = document.querySelector('.workspace-page-rich-text-emoji-picker--floating');
      expect(emojiPicker).not.toBeNull();
      expect(emojiPicker?.parentElement).toBe(document.body);
      expect(document.querySelector('[role="tablist"][aria-label="Категории эмодзи"]')).not.toBeNull();
      const emojiSearch = document.querySelector<HTMLInputElement>('.quick-planner-emoji-search')!;
      fireEvent.change(emojiSearch, { target: { value: 'сердце' } });
      expect(document.querySelector('[role="tablist"][aria-label="Категории эмодзи"]')).not.toBeNull();
      fireEvent.click(document.querySelector('[aria-label="Вставить ❤️"]') as HTMLButtonElement);
  
      expect(editor.textContent).toBe('Write❤️ here');
      expect(onChange).toHaveBeenLastCalledWith('Write❤️ here', []);
      unmount();
    })
  it('uses Telegram-provided effect IDs from the Studio toolbar', async () => {
      const previousTelegram = Object.getOwnPropertyDescriptor(window, 'telegram');
      const getAvailableEffects = vi.fn().mockResolvedValue({
        success: true,
        effects: [
          { id: '123456789', emoticon: '🎉', premiumRequired: false },
          { id: '987654321', emoticon: '✨', premiumRequired: true },
        ],
      });
      Object.defineProperty(window, 'telegram', { configurable: true, value: { getAvailableEffects } });
      const onEffectChange = vi.fn();
      const { container, unmount } = renderRichTextEditor({ onEffectChange });
  
      await act(async () => { await Promise.resolve(); });
      expect(getAvailableEffects).toHaveBeenCalledOnce();
      expect(container.querySelectorAll('.workspace-page-rich-text-effect-option')).toHaveLength(0);
  
      fireEvent.click(container.querySelector('[aria-label="Message effects"]') as HTMLButtonElement);
      expect(container.querySelector('.workspace-page-rich-text-effects-picker')).not.toBeNull();
      expect(container.querySelectorAll('.workspace-page-rich-text-effect-option')).toHaveLength(2);
      expect(container.querySelector('[aria-label="Premium effect ✨"]')).toBeNull();
      fireEvent.click(container.querySelector('.workspace-page-rich-text-effect-option[aria-pressed="false"]') as HTMLButtonElement);
  
      expect(onEffectChange).toHaveBeenCalledWith('123456789');
      unmount();
      if (previousTelegram) Object.defineProperty(window, 'telegram', previousTelegram);
      else Reflect.deleteProperty(window, 'telegram');
    })
  it('does not mark partial formats active when a selection spans more than two styles', () => {
      const { container, editor, unmount } = renderRichTextEditor({
        text: 'styled plain',
      });
      act(() => {
        editor.innerHTML = '<strong><em><u>styled</u></em></strong> plain';
      });
      const range = document.createRange();
      range.selectNodeContents(editor);
      const selection = window.getSelection()!;
      selection.removeAllRanges();
      selection.addRange(range);
  
      act(() => editor.dispatchEvent(new MouseEvent('mouseup', { bubbles: true })));
  
      const toolbar = container.querySelector('[role="toolbar"]')!;
      expect(toolbar.querySelector('[aria-label="Bold"]')).toHaveAttribute('aria-pressed', 'false');
      expect(toolbar.querySelector('[aria-label="Italic"]')).toHaveAttribute('aria-pressed', 'false');
      expect(toolbar.querySelector('[aria-label="Underline"]')).toHaveAttribute('aria-pressed', 'false');
      unmount();
    })
  it('keeps more than two active formats independent when switching them off sequentially', () => {
      const { container, editor, unmount } = renderRichTextEditor({
        text: 'styled plain',
        entities: [
          { type: 'bold', offset: 0, length: 6 },
          { type: 'italic', offset: 0, length: 6 },
          { type: 'underline', offset: 0, length: 6 },
        ],
      });
      const textWalker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT);
      const styledText = textWalker.nextNode() as Text;
      const selection = window.getSelection()!;
      const range = document.createRange();
      range.setStart(styledText, 0);
      range.setEnd(styledText, styledText.textContent?.length ?? 0);
      expect(editor.querySelector('strong, b')).not.toBeNull();
      expect(editor.querySelector('em, i')).not.toBeNull();
      expect(editor.querySelector('u')).not.toBeNull();
      selection.removeAllRanges();
      selection.addRange(range);
      act(() => editor.dispatchEvent(new MouseEvent('mouseup', { bubbles: true })));
  
      const previousExecCommand = Object.getOwnPropertyDescriptor(document, 'execCommand');
      const selectorByCommand: Record<string, string> = {
        bold: 'b,strong',
        italic: 'i,em',
        underline: 'u',
      };
      const execCommand = vi.fn((command: string) => {
        const wrapper = editor.querySelector(selectorByCommand[command]);
        if (!wrapper?.parentNode) return true;
        const parent = wrapper.parentNode;
        while (wrapper.firstChild) parent.insertBefore(wrapper.firstChild, wrapper);
        wrapper.remove();
        return true;
      });
      Object.defineProperty(document, 'execCommand', { configurable: true, value: execCommand });
  
      try {
        const toolbar = container.querySelector('[role="toolbar"]')!;
        const bold = toolbar.querySelector<HTMLButtonElement>('[aria-label="Bold"]')!;
        const italic = toolbar.querySelector<HTMLButtonElement>('[aria-label="Italic"]')!;
        const underline = toolbar.querySelector<HTMLButtonElement>('[aria-label="Underline"]')!;
        expect(bold).toHaveAttribute('aria-pressed', 'true');
        expect(italic).toHaveAttribute('aria-pressed', 'true');
        expect(underline).toHaveAttribute('aria-pressed', 'true');
  
        act(() => bold.click());
        expect(bold).toHaveAttribute('aria-pressed', 'false');
        expect(italic).toHaveAttribute('aria-pressed', 'true');
        expect(underline).toHaveAttribute('aria-pressed', 'true');
  
        act(() => italic.click());
        expect(bold).toHaveAttribute('aria-pressed', 'false');
        expect(italic).toHaveAttribute('aria-pressed', 'false');
        expect(underline).toHaveAttribute('aria-pressed', 'true');
        expect(execCommand).toHaveBeenNthCalledWith(1, 'bold', false);
        expect(execCommand).toHaveBeenNthCalledWith(2, 'italic', false);
      } finally {
        if (previousExecCommand) Object.defineProperty(document, 'execCommand', previousExecCommand);
        else Reflect.deleteProperty(document, 'execCommand');
        unmount();
      }
    })
  it('toggles italic off and on when clicked repeatedly at a caret', () => {
      const { container, editor, unmount } = renderRichTextEditor({
        text: 'Italic text',
        entities: [{ type: 'italic', offset: 0, length: 6 }],
      });
      let italicEnabled = true;
      const previousQueryCommandState = Object.getOwnPropertyDescriptor(document, 'queryCommandState');
      const previousExecCommand = Object.getOwnPropertyDescriptor(document, 'execCommand');
      const execCommand = vi.fn((command: string) => {
        if (command === 'italic') italicEnabled = !italicEnabled;
        return true;
      });
      Object.defineProperty(document, 'queryCommandState', {
        configurable: true,
        value: (command: string) => command === 'italic' ? italicEnabled : false,
      });
      Object.defineProperty(document, 'execCommand', { configurable: true, value: execCommand });
  
      try {
        const italicText = editor.querySelector('em, i')?.firstChild;
        expect(italicText).not.toBeNull();
        const range = document.createRange();
        range.setStart(italicText!, 2);
        range.collapse(true);
        const selection = window.getSelection()!;
        selection.removeAllRanges();
        selection.addRange(range);
        act(() => editor.dispatchEvent(new MouseEvent('mouseup', { bubbles: true })));
  
        const italicButton = container.querySelector<HTMLButtonElement>('[aria-label="Italic"]')!;
        expect(italicButton.getAttribute('aria-pressed')).toBe('true');
  
        act(() => italicButton.click());
        expect(execCommand).toHaveBeenCalledWith('italic', false);
        expect(italicButton.getAttribute('aria-pressed')).toBe('false');
  
        act(() => italicButton.click());
        expect(execCommand).toHaveBeenCalledTimes(2);
        expect(italicButton.getAttribute('aria-pressed')).toBe('true');
      } finally {
        if (previousQueryCommandState) Object.defineProperty(document, 'queryCommandState', previousQueryCommandState);
        else Reflect.deleteProperty(document, 'queryCommandState');
        if (previousExecCommand) Object.defineProperty(document, 'execCommand', previousExecCommand);
        else Reflect.deleteProperty(document, 'execCommand');
        unmount();
      }
    })
  it('toggles italic off and on across multiple italic text runs', () => {
      const { container, editor, unmount } = renderRichTextEditor({
        text: 'one two three four',
        entities: [
          { type: 'italic', offset: 0, length: 3 },
          { type: 'italic', offset: 4, length: 3 },
          { type: 'italic', offset: 8, length: 5 },
          { type: 'italic', offset: 14, length: 4 },
        ],
      });
      let italicEnabled = true;
      const previousQueryCommandState = Object.getOwnPropertyDescriptor(document, 'queryCommandState');
      const previousExecCommand = Object.getOwnPropertyDescriptor(document, 'execCommand');
      const execCommand = vi.fn((command: string) => {
        if (command === 'italic') italicEnabled = !italicEnabled;
        return true;
      });
      Object.defineProperty(document, 'queryCommandState', {
        configurable: true,
        value: (command: string) => command === 'italic' ? italicEnabled : false,
      });
      Object.defineProperty(document, 'execCommand', { configurable: true, value: execCommand });
  
      try {
        const range = document.createRange();
        range.selectNodeContents(editor);
        const selection = window.getSelection()!;
        selection.removeAllRanges();
        selection.addRange(range);
        act(() => editor.dispatchEvent(new MouseEvent('mouseup', { bubbles: true })));
  
        const italicButton = container.querySelector<HTMLButtonElement>('[aria-label="Italic"]')!;
        expect(italicButton.getAttribute('aria-pressed')).toBe('true');
  
        act(() => italicButton.click());
        expect(execCommand).toHaveBeenCalledWith('italic', false);
        expect(italicButton.getAttribute('aria-pressed')).toBe('false');
  
        act(() => italicButton.click());
        expect(execCommand).toHaveBeenCalledTimes(2);
        expect(italicButton.getAttribute('aria-pressed')).toBe('true');
      } finally {
        if (previousQueryCommandState) Object.defineProperty(document, 'queryCommandState', previousQueryCommandState);
        else Reflect.deleteProperty(document, 'queryCommandState');
        if (previousExecCommand) Object.defineProperty(document, 'execCommand', previousExecCommand);
        else Reflect.deleteProperty(document, 'execCommand');
        unmount();
      }
    })
  it('applies every format option in turn while the toolbar stays visible', () => {
      const { container, editor, unmount } = renderRichTextEditor({
        text: 'Chain formats',
        entities: [],
      });
      act(() => editor.focus());
      const selection = window.getSelection()!;
      const range = document.createRange();
      range.selectNodeContents(editor);
      selection.removeAllRanges();
      selection.addRange(range);
  
      act(() => editor.dispatchEvent(new MouseEvent('mouseup', { bubbles: true })));
  
      const toolbar = container.querySelector<HTMLElement>('[role="toolbar"]')!;
  
      const previousExecCommand = Object.getOwnPropertyDescriptor(document, 'execCommand');
      const execCommand = vi.fn(() => true);
      Object.defineProperty(document, 'execCommand', { configurable: true, value: execCommand });
  
      const pressOption = (label: string) => {
        const option = toolbar.querySelector<HTMLButtonElement>(`[aria-label="${label}"]`)!;
        act(() => option.click());
        // Тулбар — воздушный ряд без попапа: каждая иконка переключается
        // следом за предыдущей без повторного открытия.
        expect(toolbar.isConnected).toBe(true);
      };
  
      pressOption('Bold');
      pressOption('Italic');
      pressOption('Underline');
      pressOption('Strikethrough');
  
      expect(execCommand).toHaveBeenNthCalledWith(1, 'bold', false);
      expect(execCommand).toHaveBeenNthCalledWith(2, 'italic', false);
      expect(execCommand).toHaveBeenNthCalledWith(3, 'underline', false);
      expect(execCommand).toHaveBeenNthCalledWith(4, 'strikeThrough', false);
  
      if (previousExecCommand) Object.defineProperty(document, 'execCommand', previousExecCommand);
      else Reflect.deleteProperty(document, 'execCommand');
  
      unmount();
    })
  it('keeps typing bold and italic after toggling the toolbar at an empty caret', () => {
      const { container, editor, onChange, unmount } = renderRichTextEditor();
      act(() => editor.focus());
  
      const selection = window.getSelection()!;
      const initialRange = document.createRange();
      initialRange.selectNodeContents(editor);
      initialRange.collapse(true);
      selection.removeAllRanges();
      selection.addRange(initialRange);
      act(() => editor.dispatchEvent(new MouseEvent('mouseup', { bubbles: true })));
  
      const boldButton = container.querySelector<HTMLButtonElement>('[aria-label="Bold"]')!;
      act(() => boldButton.click());
      expect(boldButton.getAttribute('aria-pressed')).toBe('true');
      const italicButton = container.querySelector<HTMLButtonElement>('[aria-label="Italic"]')!;
      act(() => italicButton.click());
      expect(italicButton.getAttribute('aria-pressed')).toBe('true');
  
      const marker = editor.querySelector('b i')?.firstChild as Text;
      expect(marker.textContent).toBe('\u200B');
      act(() => {
        marker.insertData(marker.length, 'A');
        const caretRange = document.createRange();
        caretRange.setStart(marker, marker.length);
        caretRange.collapse(true);
        selection.removeAllRanges();
        selection.addRange(caretRange);
        editor.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: 'A' }));
      });
  
      expect(editor.querySelector('b i')?.textContent).toBe('A');
      expect(boldButton.getAttribute('aria-pressed')).toBe('true');
      expect(italicButton.getAttribute('aria-pressed')).toBe('true');
  
      act(() => {
        const currentRange = selection.getRangeAt(0);
        const textNode = currentRange.startContainer as Text;
        const currentOffset = currentRange.startOffset;
        textNode.insertData(currentOffset, 'B');
        const caretRange = document.createRange();
        caretRange.setStart(textNode, currentOffset + 1);
        caretRange.collapse(true);
        selection.removeAllRanges();
        selection.addRange(caretRange);
        editor.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: 'B' }));
      });
  
      expect(editor.querySelector('b i')?.textContent).toBe('AB');
      expect(onChange).toHaveBeenLastCalledWith('AB', [
        { type: 'bold', offset: 0, length: 2 },
        { type: 'italic', offset: 0, length: 2 },
      ]);
      expect(boldButton.getAttribute('aria-pressed')).toBe('true');
      expect(italicButton.getAttribute('aria-pressed')).toBe('true');
      expect(selection.getRangeAt(0).startOffset).toBe(2);
  
      unmount();
    })
  it('keeps collapsed bold and italic active when native command state reports false', () => {
      const { container, editor, unmount } = renderRichTextEditor();
      const previousQueryCommandState = Object.getOwnPropertyDescriptor(document, 'queryCommandState');

      try {
        act(() => editor.focus());
        const selection = window.getSelection()!;
        const initialRange = document.createRange();
        initialRange.selectNodeContents(editor);
        initialRange.collapse(true);
        selection.removeAllRanges();
        selection.addRange(initialRange);
        act(() => editor.dispatchEvent(new MouseEvent('mouseup', { bubbles: true })));

        const boldButton = container.querySelector<HTMLButtonElement>('[aria-label="Bold"]')!;
        const italicButton = container.querySelector<HTMLButtonElement>('[aria-label="Italic"]')!;
        act(() => boldButton.click());
        act(() => italicButton.click());

        expect(editor.querySelector('b i')?.textContent).toBe('\u200B');
        expect(boldButton).toHaveAttribute('aria-pressed', 'true');
        expect(italicButton).toHaveAttribute('aria-pressed', 'true');

        Object.defineProperty(document, 'queryCommandState', {
          configurable: true,
          value: () => false,
        });
        const marker = editor.querySelector('b i')?.firstChild;
        expect(marker).not.toBeNull();
        const caretRange = document.createRange();
        caretRange.setStart(marker!, marker!.textContent?.length ?? 0);
        caretRange.collapse(true);
        selection.removeAllRanges();
        selection.addRange(caretRange);
        act(() => {
          editor.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
          document.dispatchEvent(new Event('selectionchange'));
        });

        expect(boldButton).toHaveAttribute('aria-pressed', 'true');
        expect(italicButton).toHaveAttribute('aria-pressed', 'true');
      } finally {
        if (previousQueryCommandState) Object.defineProperty(document, 'queryCommandState', previousQueryCommandState);
        else Reflect.deleteProperty(document, 'queryCommandState');
        unmount();
      }
    })
  it('keeps the format icon states when the native selection is cleared', () => {
      const { container, editor, unmount } = renderRichTextEditor({
        text: 'Bold text',
        entities: [{ type: 'bold', offset: 0, length: 4 }],
      });
      act(() => editor.focus());
      const strongElement = editor.querySelector('strong')!;
      const range = document.createRange();
      range.selectNodeContents(strongElement);
      const selection = window.getSelection()!;
      selection.removeAllRanges();
      selection.addRange(range);
  
      act(() => editor.dispatchEvent(new MouseEvent('mouseup', { bubbles: true })));
  
      const toolbar = container.querySelector<HTMLElement>('[role="toolbar"]')!;
      expect(toolbar.querySelector('[aria-label="Bold"]')?.getAttribute('aria-pressed')).toBe('true');
  
      act(() => {
        selection.removeAllRanges();
        document.dispatchEvent(new Event('selectionchange'));
      });
  
      expect(toolbar.querySelector('[aria-label="Bold"]')?.getAttribute('aria-pressed')).toBe('true');
  
      unmount();
    })
  it('preserves logical text and caret position for a long unbroken string', () => {
      const container = document.createElement('div');
      document.body.appendChild(container);
      const root = createRoot(container);
      const onChange = vi.fn();
  
      act(() => {
        root.render(<RichTextEditor text="" entities={[]} onChange={onChange} maxLength={4096} />);
      });
  
      const editor = container.querySelector('[contenteditable="true"]') as HTMLDivElement;
      const longText = 'B'.repeat(1000);
  
      act(() => {
        editor.textContent = longText;
        editor.dispatchEvent(new Event('input', { bubbles: true }));
      });
  
      expect(editor.textContent).toBe(longText);
      expect(editor.textContent?.length).toBe(1000);
      expect(editor.textContent?.includes('\n')).toBe(false);
      expect(editor.textContent?.includes('\u00AD')).toBe(false);
      expect(editor.textContent?.includes('\u200B')).toBe(false);
      expect(editor.textContent?.includes('\u2060')).toBe(false);
  
      const selection = window.getSelection();
      const range = document.createRange();
      range.setStart(editor.firstChild!, 250);
      range.setEnd(editor.firstChild!, 250);
      selection?.removeAllRanges();
      selection?.addRange(range);
  
      act(() => {
        editor.dispatchEvent(new Event('select', { bubbles: true }));
      });
  
      expect(selection?.anchorOffset).toBe(250);
      expect(selection?.focusOffset).toBe(250);
      expect(editor.contains(selection?.anchorNode ?? null)).toBe(true);
  
      act(() => root.unmount());
      container.remove();
    })
  it('normalizes non-breaking and zero-width characters from pasted content', () => {
      const container = document.createElement('div');
      document.body.appendChild(container);
      const root = createRoot(container);
      const onChange = vi.fn();
  
      act(() => {
        root.render(<RichTextEditor text="" entities={[]} onChange={onChange} maxLength={4096} />);
      });
  
      const editor = container.querySelector('[contenteditable="true"]') as HTMLDivElement;
      act(() => {
        editor.innerHTML = 'Hello&nbsp;&nbsp;world\u200B';
        editor.dispatchEvent(new Event('input', { bubbles: true }));
      });
  
      expect(onChange).toHaveBeenLastCalledWith('Hello  world', []);
  
      act(() => {
        editor.textContent = 'Hello\u00A0\u200BWorld';
        editor.dispatchEvent(new Event('input', { bubbles: true }));
      });
  
      expect(onChange).toHaveBeenLastCalledWith('Hello World', []);
  
      act(() => root.unmount());
      container.remove();
    })
  it('converts completed Markdown while typing and keeps the caret in place', () => {
      const container = document.createElement('div');
      document.body.appendChild(container);
      const root = createRoot(container);
      const onChange = vi.fn();
  
      act(() => {
        root.render(<RichTextEditor text="" entities={[]} onChange={onChange} maxLength={4096} />);
      });
  
      const editor = container.querySelector('[contenteditable="true"]') as HTMLDivElement;
      const source = 'Start **Жирный**';
      editor.textContent = source;
      const selection = window.getSelection();
      const range = document.createRange();
      range.setStart(editor.firstChild!, source.length);
      range.collapse(true);
      selection?.removeAllRanges();
      selection?.addRange(range);
  
      act(() => editor.dispatchEvent(new Event('input', { bubbles: true })));
  
      expect(onChange).toHaveBeenLastCalledWith('Start Жирный', [{ type: 'bold', offset: 6, length: 6 }]);
      expect(editor.textContent).toBe('Start Жирный');
      expect(editor.querySelector('strong')?.textContent).toBe('Жирный');
      expect(selection?.isCollapsed).toBe(true);
      expect(editor.contains(selection?.anchorNode ?? null)).toBe(true);
  
      const caretRange = document.createRange();
      caretRange.selectNodeContents(editor);
      caretRange.setEnd(selection!.anchorNode!, selection!.anchorOffset);
      expect(caretRange.toString()).toBe('Start Жирный');
  
      act(() => root.unmount());
      container.remove();
    })
  it('converts pasted Markdown but preserves ordinary asterisks', () => {
      const container = document.createElement('div');
      document.body.appendChild(container);
      const root = createRoot(container);
      const onChange = vi.fn();
  
      act(() => {
        root.render(<RichTextEditor text="" entities={[]} onChange={onChange} maxLength={4096} />);
      });
  
      const editor = container.querySelector('[contenteditable="true"]') as HTMLDivElement;
      const selection = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(editor);
      range.collapse(false);
      selection?.removeAllRanges();
      selection?.addRange(range);
  
      const clipboardData = {
        items: [],
        getData: vi.fn((type: string) => type === 'text/plain' ? '**Жирный** и 2 * 2 = 4' : '<strong>ignored</strong>'),
      };
      const pasteEvent = new Event('paste', { bubbles: true, cancelable: true });
      Object.defineProperty(pasteEvent, 'clipboardData', { value: clipboardData });
  
      act(() => editor.dispatchEvent(pasteEvent));
  
      expect(clipboardData.getData).toHaveBeenCalledWith('text/plain');
      expect(pasteEvent.defaultPrevented).toBe(true);
      expect(onChange).toHaveBeenLastCalledWith('Жирный и 2 * 2 = 4', [{ type: 'bold', offset: 0, length: 6 }]);
      expect(editor.textContent).toBe('Жирный и 2 * 2 = 4');
      expect(editor.querySelector('strong')?.textContent).toBe('Жирный');
  
      act(() => root.unmount());
      container.remove();
    })
});
