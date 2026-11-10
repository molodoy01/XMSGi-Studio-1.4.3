import { useLayoutEffect, type MutableRefObject, type RefObject } from 'react';
import { richTextToHtml } from '../lib/richText';
import type { RichTextEntity } from '../types';

type WorkspaceEditorFocusOptions = {
  stageMode: string;
  draftBody: string;
  draftEntities: RichTextEntity[];
  editorRef: RefObject<HTMLDivElement | null>;
  focusRescheduledEditorAtEndRef: MutableRefObject<boolean>;
  focusPlannerEditorAtEndRef: MutableRefObject<boolean>;
  focusEditorAfterStageEscapeRef: MutableRefObject<boolean>;
};

export function useWorkspaceEditorFocus({
  stageMode,
  draftBody,
  draftEntities,
  editorRef,
  focusRescheduledEditorAtEndRef,
  focusPlannerEditorAtEndRef,
  focusEditorAfterStageEscapeRef,
}: WorkspaceEditorFocusOptions) {
  useLayoutEffect(() => {
    if (stageMode !== 'editor'
      || (!focusRescheduledEditorAtEndRef.current
        && !focusPlannerEditorAtEndRef.current
        && !focusEditorAfterStageEscapeRef.current)) return;

    const editor = editorRef.current;
    if (editor && (focusRescheduledEditorAtEndRef.current || focusPlannerEditorAtEndRef.current)) {
      const nextHtml = richTextToHtml(draftBody, draftEntities);
      if (editor.innerHTML !== nextHtml) editor.innerHTML = nextHtml;
    }

    const frameId = window.requestAnimationFrame(() => {
      const editor = editorRef.current;
      if (!editor) return;

      editor.focus({ preventScroll: true });
      const selection = window.getSelection();
      if (selection) {
        const range = document.createRange();
        range.selectNodeContents(editor);
        range.collapse(false);
        selection.removeAllRanges();
        selection.addRange(range);
      }

      const caretPosition = draftBody.length;
      editor.dataset.selectionStart = String(caretPosition);
      editor.dataset.selectionEnd = String(caretPosition);
      editor.scrollTop = Math.max(0, editor.scrollHeight - editor.clientHeight);
      focusRescheduledEditorAtEndRef.current = false;
      focusPlannerEditorAtEndRef.current = false;
      focusEditorAfterStageEscapeRef.current = false;
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [
    draftBody,
    draftEntities,
    editorRef,
    focusEditorAfterStageEscapeRef,
    focusPlannerEditorAtEndRef,
    focusRescheduledEditorAtEndRef,
    stageMode,
  ]);
}
