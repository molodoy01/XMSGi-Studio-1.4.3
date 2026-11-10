import { useCallback, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import type { Chat } from '../types';

export type WorkspaceStageMode = 'editor' | 'schedule' | 'template' | 'draft' | 'chat';

type WorkspaceStageModeOptions = {
  stageMode: WorkspaceStageMode;
  setStageMode: Dispatch<SetStateAction<WorkspaceStageMode>>;
  setScheduleFocus: Dispatch<SetStateAction<'repeat' | 'time' | null>>;
  setSelectedChat: Dispatch<SetStateAction<Chat | null>>;
  chatOriginRef: MutableRefObject<Chat | null>;
  setWorkspaceSelectedChats: Dispatch<SetStateAction<Chat[]>>;
  closeTemplateEditor: () => void;
  closeDraftEditor: () => void;
};

export function useWorkspaceStageMode({
  stageMode,
  setStageMode,
  setScheduleFocus,
  setSelectedChat,
  chatOriginRef,
  setWorkspaceSelectedChats,
  closeTemplateEditor,
  closeDraftEditor,
}: WorkspaceStageModeOptions) {
  return useCallback((nextMode: WorkspaceStageMode) => {
    if (nextMode !== 'schedule') setScheduleFocus(null);
    if (stageMode === 'chat' && nextMode !== 'chat') {
      setSelectedChat(chatOriginRef.current);
      chatOriginRef.current = null;
      setWorkspaceSelectedChats([]);
    }
    if (nextMode !== 'template') closeTemplateEditor();
    if (nextMode !== 'draft') closeDraftEditor();
    setStageMode(nextMode);
  }, [
    chatOriginRef,
    closeDraftEditor,
    closeTemplateEditor,
    setScheduleFocus,
    setSelectedChat,
    setStageMode,
    setWorkspaceSelectedChats,
    stageMode,
  ]);
}
