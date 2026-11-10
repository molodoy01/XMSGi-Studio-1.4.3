import { useEffect, type RefObject } from 'react';

export function useWorkspaceEditorReloadGuard(workspaceRef: RefObject<HTMLDivElement | null>) {
  useEffect(() => {
    const preventEditorReload = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== 'r') return;
      const workspace = workspaceRef.current;
      if (!workspace || workspace.closest('[aria-hidden="true"]')) return;
      const editorShell = workspace.querySelector('.workspace-page-editor-shell');
      const targetIsInEditor = event.target instanceof Node && editorShell?.contains(event.target);
      const focusIsInEditor = editorShell?.contains(document.activeElement);
      if (!targetIsInEditor && !focusIsInEditor) return;

      event.preventDefault();
      event.stopPropagation();
    };

    window.addEventListener('keydown', preventEditorReload, true);
    return () => window.removeEventListener('keydown', preventEditorReload, true);
  }, [workspaceRef]);
}
