import type { ClipboardEvent, Dispatch, DragEvent, SetStateAction } from 'react';
import type { RefObject } from 'react';
import { normalizeEditorText } from '@studio/lib/richText';

type UseRichTextEditorInputOptions = {
  editorRef: RefObject<HTMLDivElement | null>;
  textLength: number;
  stageMode: string;
  getCaretOffset: (fallbackOffset: number) => number;
  onAddFiles?: (files: File[], position: number) => void;
  onPasteImages?: (files: File[]) => void;
  setDragOver: Dispatch<SetStateAction<boolean>>;
  emitChange: () => string | null;
};

export function useRichTextEditorInput({
  editorRef,
  textLength,
  stageMode,
  getCaretOffset,
  onAddFiles,
  onPasteImages,
  setDragOver,
  emitChange,
}: UseRichTextEditorInputOptions) {
  const handlePaste = (event: ClipboardEvent<HTMLDivElement>) => {
    event.preventDefault();

    const clipboardItems = Array.from(event.clipboardData.items)
      .filter((item) => item.kind === 'file')
      .map((item) => item.getAsFile())
      .filter((file): file is File => file !== null);
    const clipboardFiles = clipboardItems.length > 0 ? clipboardItems : Array.from(event.clipboardData.files ?? []);
    const preparedFiles = clipboardFiles.map((file) => {
      if (file.name) return file;
      const extension = file.type.split('/')[1]?.replace('jpeg', 'jpg') || 'png';
      return new File([file], `pasted-image-${Date.now()}.${extension}`, {
        type: file.type,
        lastModified: file.lastModified,
      });
    });
    const attachmentPosition = getCaretOffset(textLength);
    if (preparedFiles.length > 0) {
      if (onAddFiles) onAddFiles(preparedFiles, attachmentPosition);
      else onPasteImages?.(preparedFiles.filter((file) => file.type.startsWith('image/')));
    }

    const readyText = normalizeEditorText(event.clipboardData.getData('text/plain') || '')
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n');

    if (!readyText) return;

    const selection = window.getSelection();
    const editor = editorRef.current;
    if (!selection || !editor) return;

    const range = selection.rangeCount > 0 ? selection.getRangeAt(0).cloneRange() : document.createRange();
    range.deleteContents();
    const textNode = document.createTextNode(readyText);
    range.insertNode(textNode);
    range.setStartAfter(textNode);
    range.collapse(true);
    selection.removeAllRanges();
    selection.addRange(range);
    emitChange();
  };

  const isFileDrag = (event: DragEvent<HTMLDivElement>) => (
    stageMode === 'editor' && Array.from(event.dataTransfer.types).includes('Files')
  );

  const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
    if (!isFileDrag(event)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
    setDragOver(true);
  };

  const handleDragLeave = (event: DragEvent<HTMLDivElement>) => {
    const nextTarget = event.relatedTarget;
    if (nextTarget instanceof Node && event.currentTarget.contains(nextTarget)) return;
    setDragOver(false);
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    if (!isFileDrag(event)) return;
    event.preventDefault();
    event.stopPropagation();
    setDragOver(false);
    const files = Array.from(event.dataTransfer.files);
    if (files.length > 0) onAddFiles?.(files, getCaretOffset(textLength));
  };

  return { handlePaste, isFileDrag, handleDragOver, handleDragLeave, handleDrop };
}
