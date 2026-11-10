import { useCallback, type MutableRefObject } from 'react';

type UseWorkspaceEmptyMessageFocusOptions = {
  stageMode: 'editor' | 'schedule' | 'template' | 'draft' | 'chat';
  changeStageMode: (mode: 'editor' | 'schedule' | 'template' | 'draft' | 'chat') => void;
  draftBodyLength: number;
  bodyInputRef: MutableRefObject<HTMLDivElement | null>;
};

export function useWorkspaceEmptyMessageFocus({
  stageMode,
  changeStageMode,
  draftBodyLength,
  bodyInputRef,
}: UseWorkspaceEmptyMessageFocusOptions) {
  return useCallback(() => {
    const focusEditor = () => {
      const editor = bodyInputRef.current;
      if (!editor) return;

      editor.focus({ preventScroll: true });
      const selection = editor.ownerDocument.getSelection();
      if (!selection) return;

      const range = editor.ownerDocument.createRange();
      range.selectNodeContents(editor);
      range.collapse(false);
      selection.removeAllRanges();
      selection.addRange(range);
      editor.dataset.selectionStart = String(draftBodyLength);
      editor.dataset.selectionEnd = String(draftBodyLength);
    };

    if (stageMode !== 'editor') changeStageMode('editor');
    focusEditor();

    if (typeof window !== 'undefined') window.requestAnimationFrame(focusEditor);
    else focusEditor();
  }, [bodyInputRef, changeStageMode, draftBodyLength, stageMode]);
}
