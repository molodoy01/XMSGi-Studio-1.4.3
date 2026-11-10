import type { Dispatch, MutableRefObject, RefObject, SetStateAction } from 'react';
import type { RichTextEntity } from '@studio/types';
import { getEditorTextOffset } from '@studio/lib/richText';

type CreateClearEditorTextHandlerOptions = {
  editorRef: RefObject<HTMLDivElement | null>;
  clearPendingRef: MutableRefObject<boolean>;
  logicalTextLengthRef: MutableRefObject<number>;
  text: string;
  entities: RichTextEntity[];
  hasIndentedLineBreak: boolean;
  setHasIndentedLineBreak: Dispatch<SetStateAction<boolean>>;
  setClearPending: Dispatch<SetStateAction<boolean>>;
  onChange: (text: string, entities: RichTextEntity[]) => void;
  onBeforeClear?: () => boolean | Promise<boolean>;
  clearSelection: () => void;
  placeCaretAtStart: () => void;
  restoreTextSelection: (start: number, end: number) => void;
  setEditorFocused: Dispatch<SetStateAction<boolean>>;
};

export function createClearEditorTextHandler({
  editorRef,
  clearPendingRef,
  logicalTextLengthRef,
  text,
  entities,
  hasIndentedLineBreak,
  setHasIndentedLineBreak,
  setClearPending,
  onChange,
  onBeforeClear,
  clearSelection,
  placeCaretAtStart,
  restoreTextSelection,
  setEditorFocused,
}: CreateClearEditorTextHandlerOptions) {
  return async () => {
    if (clearPendingRef.current) return;
    const editor = editorRef.current;
    if (!editor) return;
    const previousHtml = editor.innerHTML;
    const previousHasIndentedLineBreak = hasIndentedLineBreak;
    const selection = window.getSelection();
    const selectionRange = selection && selection.rangeCount > 0 ? selection.getRangeAt(0) : null;
    const selectionOffsets = selectionRange
      && (selectionRange.startContainer === editor || editor.contains(selectionRange.startContainer))
      && (selectionRange.endContainer === editor || editor.contains(selectionRange.endContainer))
      ? {
          start: getEditorTextOffset(editor, selectionRange.startContainer, selectionRange.startOffset),
          end: getEditorTextOffset(editor, selectionRange.endContainer, selectionRange.endOffset),
        }
      : null;
    const clearAuthorization = onBeforeClear?.();
    if (clearAuthorization === false) return;
    const checkpointPending = clearAuthorization instanceof Promise;
    if (checkpointPending) {
      clearPendingRef.current = true;
      setClearPending(true);
    }

    editor.innerHTML = '';
    setHasIndentedLineBreak(false);
    logicalTextLengthRef.current = 0;
    clearSelection();
    onChange('', []);
    editor.focus();
    setEditorFocused(true);
    placeCaretAtStart();

    if (!checkpointPending) return;

    let checkpointSaved = false;
    try {
      checkpointSaved = await clearAuthorization;
    } finally {
      clearPendingRef.current = false;
      setClearPending(false);
    }

    if (!checkpointSaved && editorRef.current === editor) {
      editor.innerHTML = previousHtml;
      setHasIndentedLineBreak(previousHasIndentedLineBreak);
      logicalTextLengthRef.current = text.length;
      onChange(text, entities);
      editor.focus();
      setEditorFocused(true);
      if (selectionOffsets?.start !== null && selectionOffsets?.start !== undefined
        && selectionOffsets.end !== null && selectionOffsets.end !== undefined) {
        restoreTextSelection(selectionOffsets.start, selectionOffsets.end);
      } else {
        placeCaretAtStart();
      }
    }
  };
}
