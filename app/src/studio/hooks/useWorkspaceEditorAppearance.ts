import { useEffect, useMemo, useState } from 'react';
import {
  EDITOR_APPEARANCE_UPDATED_EVENT,
  getEditorAppearanceCssTokens,
  readEditorAppearancePreferences,
} from '@shared/editorAppearance';
import type { PublishAction } from '../components/WorkspacePageActionRows';

type WorkspaceEditorAppearanceOptions = {
  workspaceRef: { current: HTMLDivElement | null };
  publishAction: PublishAction;
};

export function useWorkspaceEditorAppearance({ workspaceRef, publishAction }: WorkspaceEditorAppearanceOptions) {
  const [editorAppearance, setEditorAppearance] = useState(readEditorAppearancePreferences);
  const editorAppearanceTokens = useMemo(
    () => getEditorAppearanceCssTokens(editorAppearance, publishAction),
    [editorAppearance, publishAction],
  );

  useEffect(() => {
    const refreshEditorAppearance = () => setEditorAppearance(readEditorAppearancePreferences());
    window.addEventListener(EDITOR_APPEARANCE_UPDATED_EVENT, refreshEditorAppearance);
    window.addEventListener('storage', refreshEditorAppearance);
    return () => {
      window.removeEventListener(EDITOR_APPEARANCE_UPDATED_EVENT, refreshEditorAppearance);
      window.removeEventListener('storage', refreshEditorAppearance);
    };
  }, []);

  useEffect(() => {
    const productShell = workspaceRef.current?.closest<HTMLElement>('.product-shell');
    if (!productShell) return undefined;

    productShell.style.setProperty('--studio-title-icon-color', `rgb(${editorAppearanceTokens['--editor-outline']})`);
    return () => {
      productShell.style.removeProperty('--studio-title-icon-color');
    };
  }, [editorAppearanceTokens, workspaceRef]);

  return { editorAppearance, editorAppearanceTokens };
}
