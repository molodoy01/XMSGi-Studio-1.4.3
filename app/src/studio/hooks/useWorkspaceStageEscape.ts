import { useEffect, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import type { Chat } from '../types';

type WorkspaceStageEscapeOptions = {
  stageMode: string;
  setStageMode: Dispatch<SetStateAction<'editor' | 'schedule' | 'template' | 'draft' | 'chat'>>;
  closeTemplateEditor: () => void;
  setSelectedChat: Dispatch<SetStateAction<Chat | null>>;
  chatOriginRef: MutableRefObject<Chat | null>;
  setWorkspaceSelectedChats: Dispatch<SetStateAction<Chat[]>>;
  focusEditorAfterStageEscapeRef: MutableRefObject<boolean>;
  setDraftEditingId: Dispatch<SetStateAction<string | null>>;
  setDraftName: Dispatch<SetStateAction<string>>;
  setDraftBodyText: Dispatch<SetStateAction<string>>;
  setDraftBodyEntities: Dispatch<SetStateAction<import('../types').RichTextEntity[]>>;
};

export function useWorkspaceStageEscape({
  stageMode,
  setStageMode,
  closeTemplateEditor,
  setSelectedChat,
  chatOriginRef,
  setWorkspaceSelectedChats,
  focusEditorAfterStageEscapeRef,
  setDraftEditingId,
  setDraftName,
  setDraftBodyText,
  setDraftBodyEntities,
}: WorkspaceStageEscapeOptions) {
  useEffect(() => {
    if (stageMode === 'editor') return;

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;

      event.preventDefault();
      if (stageMode === 'chat') {
        setSelectedChat(chatOriginRef.current);
        chatOriginRef.current = null;
        setWorkspaceSelectedChats([]);
      }
      focusEditorAfterStageEscapeRef.current = true;
      setStageMode('editor');
      closeTemplateEditor();
      setDraftEditingId(null);
      setDraftName('');
      setDraftBodyText('');
      setDraftBodyEntities([]);
    };

    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [
    chatOriginRef,
    closeTemplateEditor,
    focusEditorAfterStageEscapeRef,
    setDraftBodyEntities,
    setDraftBodyText,
    setDraftEditingId,
    setDraftName,
    setSelectedChat,
    setStageMode,
    setWorkspaceSelectedChats,
    stageMode,
  ]);
}
