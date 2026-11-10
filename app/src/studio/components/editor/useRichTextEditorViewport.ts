import { useEffect, useRef, useState } from 'react';
import type { KeyboardEvent, PointerEvent, RefObject } from 'react';

type ScrollMetrics = {
  scrollTop: number;
  scrollHeight: number;
  clientHeight: number;
};

export function useRichTextEditorViewport(editorRef: RefObject<HTMLDivElement | null>) {
  const editorScrollbarRef = useRef<HTMLDivElement | null>(null);
  const editorScrollDragRef = useRef<{ pointerY: number; scrollTop: number } | null>(null);
  const [editorScrollMetrics, setEditorScrollMetrics] = useState<ScrollMetrics>({
    scrollTop: 0,
    scrollHeight: 0,
    clientHeight: 0,
  });
  const [editorScrollbarDragging, setEditorScrollbarDragging] = useState(false);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return undefined;

    let metricsFrame: number | null = null;
    const syncScrollMetrics = () => {
      if (metricsFrame !== null) return;
      metricsFrame = window.requestAnimationFrame(() => {
        metricsFrame = null;
        const next = {
          scrollTop: editor.scrollTop,
          scrollHeight: editor.scrollHeight,
          clientHeight: editor.clientHeight,
        };
        setEditorScrollMetrics((current) => (
          current.scrollTop === next.scrollTop
          && current.scrollHeight === next.scrollHeight
          && current.clientHeight === next.clientHeight
            ? current
            : next
        ));
      });
    };

    editor.addEventListener('scroll', syncScrollMetrics, { passive: true });
    const resizeObserver = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(syncScrollMetrics);
    resizeObserver?.observe(editor);
    const mutationObserver = typeof MutationObserver === 'undefined' ? null : new MutationObserver(syncScrollMetrics);
    mutationObserver?.observe(editor, { childList: true, characterData: true, subtree: true });
    syncScrollMetrics();

    return () => {
      editor.removeEventListener('scroll', syncScrollMetrics);
      resizeObserver?.disconnect();
      mutationObserver?.disconnect();
      if (metricsFrame !== null) window.cancelAnimationFrame(metricsFrame);
    };
  }, [editorRef, setEditorScrollMetrics]);

  const editorScrollbarCanScroll = editorScrollMetrics.scrollHeight > editorScrollMetrics.clientHeight + 1;
  const editorScrollbarThumbHeight = editorScrollbarCanScroll
    ? Math.min(100, Math.max(10, editorScrollMetrics.clientHeight / editorScrollMetrics.scrollHeight * 100))
    : 100;
  const editorScrollbarThumbTop = editorScrollbarCanScroll
    ? editorScrollMetrics.scrollTop / (editorScrollMetrics.scrollHeight - editorScrollMetrics.clientHeight)
      * (100 - editorScrollbarThumbHeight)
    : 0;

  const handleEditorScrollbarPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    const editor = editorRef.current;
    const track = editorScrollbarRef.current;
    if (!editor || !track) return;

    const maxScroll = Math.max(0, editor.scrollHeight - editor.clientHeight);
    const trackHeight = track.clientHeight;
    const thumbHeight = Math.min(trackHeight, Math.max(16, editor.clientHeight / Math.max(1, editor.scrollHeight) * trackHeight));
    const target = event.target as HTMLElement;

    if (target.closest('.workspace-page-rich-text-scrollbar-thumb')) {
      editorScrollDragRef.current = { pointerY: event.clientY, scrollTop: editor.scrollTop };
      setEditorScrollbarDragging(true);
      track.setPointerCapture(event.pointerId);
    } else {
      const trackBounds = track.getBoundingClientRect();
      const travel = Math.max(1, trackHeight - thumbHeight);
      const position = (event.clientY - trackBounds.top - thumbHeight / 2) / travel;
      editor.scrollTop = Math.max(0, Math.min(maxScroll, position * maxScroll));
    }
    event.preventDefault();
  };

  const handleEditorScrollbarPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const drag = editorScrollDragRef.current;
    const editor = editorRef.current;
    const track = editorScrollbarRef.current;
    if (!drag || !editor || !track) return;

    const maxScroll = Math.max(0, editor.scrollHeight - editor.clientHeight);
    const trackHeight = track.clientHeight;
    const thumbHeight = Math.min(trackHeight, Math.max(16, editor.clientHeight / Math.max(1, editor.scrollHeight) * trackHeight));
    const travel = Math.max(1, trackHeight - thumbHeight);
    editor.scrollTop = Math.max(0, Math.min(maxScroll, drag.scrollTop + (event.clientY - drag.pointerY) / travel * maxScroll));
  };

  const handleEditorScrollbarPointerUp = (event: PointerEvent<HTMLDivElement>) => {
    editorScrollDragRef.current = null;
    setEditorScrollbarDragging(false);
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const handleEditorScrollbarLostPointerCapture = () => {
    editorScrollDragRef.current = null;
    setEditorScrollbarDragging(false);
  };

  const handleEditorScrollbarKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const editor = editorRef.current;
    if (!editor) return;

    const pageStep = Math.max(40, editor.clientHeight * 0.75);
    const nextScrollTop = event.key === 'ArrowDown' ? editor.scrollTop + 40
      : event.key === 'ArrowUp' ? editor.scrollTop - 40
        : event.key === 'PageDown' ? editor.scrollTop + pageStep
          : event.key === 'PageUp' ? editor.scrollTop - pageStep
            : event.key === 'Home' ? 0
              : event.key === 'End' ? editor.scrollHeight - editor.clientHeight
                : null;
    if (nextScrollTop === null) return;

    event.preventDefault();
    editor.scrollTop = nextScrollTop;
  };

  const scheduleCaretIntoView = () => {
    const editor = editorRef.current;
    if (!editor) return;

    window.requestAnimationFrame(() => {
      if (!editor.isConnected) return;
      const selection = window.getSelection();
      if (!selection || !selection.isCollapsed || !selection.focusNode
        || (selection.focusNode !== editor && !editor.contains(selection.focusNode))) return;

      const range = document.createRange();
      range.setStart(selection.focusNode, selection.focusOffset);
      range.collapse(true);
      if (typeof range.getBoundingClientRect !== 'function') return;

      const isMeasurable = (rect: DOMRect) => (
        Number.isFinite(rect.top) && Number.isFinite(rect.bottom) && rect.height > 0
      );
      let caretRect = range.getBoundingClientRect();
      if (!isMeasurable(caretRect)) {
        const focusNode = selection.focusNode;
        const candidates: Array<{ node: Text; start: number; end: number }> = [];
        const findEdgeTextNode = (node: Node | undefined, direction: -1 | 1): Text | null => {
          if (!node) return null;
          if (node.nodeType === Node.TEXT_NODE) {
            return (node.textContent?.length ?? 0) > 0 ? node as Text : null;
          }
          const children = Array.from(node.childNodes);
          if (direction < 0) children.reverse();
          for (const child of children) {
            const textNode = findEdgeTextNode(child, direction);
            if (textNode) return textNode;
          }
          return null;
        };
        const addCharacterCandidate = (textNode: Text | null, offset: number, direction: -1 | 1) => {
          if (!textNode) return;
          if (direction < 0 && offset > 0) {
            const start = offset > 1
              && /[\uDC00-\uDFFF]/.test(textNode.data[offset - 1])
              && /[\uD800-\uDBFF]/.test(textNode.data[offset - 2])
              ? offset - 2
              : offset - 1;
            candidates.push({ node: textNode, start, end: offset });
          } else if (direction > 0 && offset < textNode.length) {
            const end = offset + 1 < textNode.length
              && /[\uD800-\uDBFF]/.test(textNode.data[offset])
              && /[\uDC00-\uDFFF]/.test(textNode.data[offset + 1])
              ? offset + 2
              : offset + 1;
            candidates.push({ node: textNode, start: offset, end });
          }
        };

        if (focusNode.nodeType === Node.TEXT_NODE) {
          const textNode = focusNode as Text;
          addCharacterCandidate(textNode, selection.focusOffset, -1);
          addCharacterCandidate(textNode, selection.focusOffset, 1);
        } else {
          const previousNode = findEdgeTextNode(focusNode.childNodes[selection.focusOffset - 1], -1);
          const nextNode = findEdgeTextNode(focusNode.childNodes[selection.focusOffset], 1);
          addCharacterCandidate(previousNode, previousNode?.length ?? 0, -1);
          addCharacterCandidate(nextNode, 0, 1);
        }

        for (const candidate of candidates) {
          const adjacentRange = document.createRange();
          adjacentRange.setStart(candidate.node, candidate.start);
          adjacentRange.setEnd(candidate.node, candidate.end);
          const rect = adjacentRange.getBoundingClientRect();
          if (isMeasurable(rect)) {
            caretRect = rect;
            break;
          }
        }
      }
      if (!isMeasurable(caretRect)) return;

      const editorRect = editor.getBoundingClientRect();
      const visibleTop = editorRect.top + editor.clientTop;
      const visibleBottom = visibleTop + editor.clientHeight;
      const inset = 4;

      if (caretRect.top < visibleTop + inset) {
        editor.scrollTop -= visibleTop + inset - caretRect.top;
      } else if (caretRect.bottom > visibleBottom - inset) {
        editor.scrollTop += caretRect.bottom - visibleBottom + inset;
      }
    });
  };

  return {
    editorScrollbarRef,
    editorScrollMetrics,
    editorScrollbarDragging,
    editorScrollbarCanScroll,
    editorScrollbarThumbHeight,
    editorScrollbarThumbTop,
    handleEditorScrollbarPointerDown,
    handleEditorScrollbarPointerMove,
    handleEditorScrollbarPointerUp,
    handleEditorScrollbarLostPointerCapture,
    handleEditorScrollbarKeyDown,
    scheduleCaretIntoView,
  };
}
