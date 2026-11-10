import type { MutableRefObject, ReactNode } from 'react';
import type { RichTextEntity } from '@studio/types';

export interface RichTextEditorProps {
  text: string;
  entities: RichTextEntity[];
  onChange: (text: string, entities: RichTextEntity[]) => void;
  onAddFiles?: (files: File[], position: number) => void;
  onPasteImages?: (files: File[]) => void;
  inputRef?: MutableRefObject<HTMLDivElement | null>;
  stageContent?: ReactNode;
  stageMode?: 'editor' | 'schedule' | 'template' | 'draft' | 'chat';
  maxLength: number;
  onOpenAlbum?: (position: number) => void;
  albumDisabled?: boolean;
  onExportText?: (text: string, format: 'txt' | 'json') => void;
  onBeforeClear?: () => boolean | Promise<boolean>;
  onOpenVersionHistory?: () => void;
  selectedEffectId?: string | null;
  onEffectChange?: (effectId: string | null) => void;
}

export function shouldPreventEditorInsertion(currentLength: number, selectedLength: number, maxLength: number) {
  return currentLength - selectedLength >= maxLength;
}

export function isValidEditorLink(value: string): boolean {
  if (!value || value.length > 2048) return false;
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:' || url.protocol === 'tg:';
  } catch {
    return false;
  }
}
