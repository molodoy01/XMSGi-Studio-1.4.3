import { useEffect, type Dispatch, type RefObject, type SetStateAction } from 'react';

type WorkspacePublishMenuDismissOptions = {
  open: boolean;
  setOpen: Dispatch<SetStateAction<boolean>>;
  menuRef: RefObject<HTMLDivElement | null>;
  toggleRef: RefObject<HTMLButtonElement | null>;
};

export function useWorkspacePublishMenuDismiss({
  open,
  setOpen,
  menuRef,
  toggleRef,
}: WorkspacePublishMenuDismissOptions) {
  useEffect(() => {
    if (!open) return;

    const closePublishMenu = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        setOpen(false);
        toggleRef.current?.focus();
      }
    };

    document.addEventListener('mousedown', closePublishMenu);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('mousedown', closePublishMenu);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [menuRef, open, setOpen, toggleRef]);
}
