import { useCallback, type Dispatch, type RefObject, type SetStateAction } from 'react';
import { insertTextAtSelection } from '../lib/templates';
import type { RichTextEntity } from '../types';

type WorkspaceTextInsertionOptions = {
  editorRef: RefObject<HTMLDivElement | null>;
  draftBody: string;
  setDraftBody: Dispatch<SetStateAction<string>>;
  setDraftEntities: Dispatch<SetStateAction<RichTextEntity[]>>;
};

export function useWorkspaceTextInsertion({
  editorRef,
  draftBody,
  setDraftBody,
  setDraftEntities,
}: WorkspaceTextInsertionOptions) {
  return useCallback((insertedText: string) => {
    const editor = editorRef.current;
    const selectionStart = Number(editor?.dataset.selectionStart);
    const selectionEnd = Number(editor?.dataset.selectionEnd);
    const hasSelection = Number.isFinite(selectionStart) && Number.isFinite(selectionEnd);
    const start = hasSelection ? selectionStart : draftBody.length;
    const end = hasSelection ? selectionEnd : draftBody.length;
    const { body: nextValue, caretPosition } = insertTextAtSelection(
      draftBody,
      insertedText,
      start,
      end,
    );

    setDraftBody(nextValue);
    setDraftEntities([]);

    if (!editor) return;

    editor.dataset.selectionStart = String(caretPosition);
    editor.dataset.selectionEnd = String(caretPosition);
    window.setTimeout(() => {
      editor.focus();
      const range = editor.ownerDocument.createRange();
      const walker = editor.ownerDocument.createTreeWalker(editor, NodeFilter.SHOW_TEXT);
      let remaining = caretPosition;
      let node = walker.nextNode();

      while (node) {
        const length = node.textContent?.length ?? 0;
        if (remaining <= length) {
          range.setStart(node, remaining);
          range.collapse(true);
          const selection = editor.ownerDocument.getSelection();
          selection?.removeAllRanges();
          selection?.addRange(range);
          break;
        }
        remaining -= length;
        node = walker.nextNode();
      }
    }, 0);
  }, [draftBody, editorRef, setDraftBody, setDraftEntities]);
}
