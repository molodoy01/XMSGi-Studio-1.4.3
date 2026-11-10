import { useEffect, type Dispatch, type SetStateAction } from 'react';

type WorkspaceEditorEscapeNavigationOptions = {
  stageMode: string;
  publishMenuOpen: boolean;
  chatListOpen: boolean;
  setChatListOpen: Dispatch<SetStateAction<boolean>>;
};

export function useWorkspaceEditorEscapeNavigation({
  stageMode,
  publishMenuOpen,
  chatListOpen,
  setChatListOpen,
}: WorkspaceEditorEscapeNavigationOptions) {
  useEffect(() => {
    if (stageMode !== 'editor' || publishMenuOpen) return;

    const returnToSchedule = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;

      event.preventDefault();
      if (chatListOpen) {
        setChatListOpen(false);
        return;
      }
      window.location.hash = '#/';
    };

    document.addEventListener('keydown', returnToSchedule);
    return () => document.removeEventListener('keydown', returnToSchedule);
  }, [chatListOpen, publishMenuOpen, setChatListOpen, stageMode]);
}
