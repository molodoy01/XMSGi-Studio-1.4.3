import { useEffect, useLayoutEffect, useState, type MouseEvent } from 'react';
import {
  DEFAULT_PREVIEW_LAYOUT,
  readPreviewLayout,
  writePreviewLayout,
  type PreviewLayout,
} from '../lib/workspacePreferences';

type WorkspacePreviewLayoutOptions = {
  workspaceRef: { current: HTMLDivElement | null };
};

export function useWorkspacePreviewLayout({ workspaceRef }: WorkspacePreviewLayoutOptions) {
  const [previewLayout, setPreviewLayout] = useState<PreviewLayout>(() => {
    const layout = readPreviewLayout() ?? DEFAULT_PREVIEW_LAYOUT;
    return {
      collapsed: layout.collapsed === true,
      visible: layout.visible ?? true,
    };
  });
  const [compactPreviewState, setCompactPreviewState] = useState(() => ({
    active: document.documentElement.classList.contains('electron-runtime') && window.innerWidth <= 1100,
    visible: null as boolean | null,
  }));
  const previewVisible = compactPreviewState.active
    ? compactPreviewState.visible ?? false
    : previewLayout.visible !== false;
  const previewCollapsed = previewLayout.collapsed === true;

  useEffect(() => {
    const updateCompactPreviewState = () => {
      const active = document.documentElement.classList.contains('electron-runtime') && window.innerWidth <= 1100;
      setCompactPreviewState((current) => current.active === active
        ? current
        : { active, visible: null });
    };

    window.addEventListener('resize', updateCompactPreviewState);
    return () => window.removeEventListener('resize', updateCompactPreviewState);
  }, []);

  useLayoutEffect(() => {
    const workspace = workspaceRef.current;
    const editor = workspace?.querySelector<HTMLElement>('.workspace-page-editor-shell');
    const previewPanel = workspace?.querySelector<HTMLElement>('.workspace-page-preview-panel');
    const previewWindow = previewPanel?.querySelector<HTMLElement>('.chat-preview-window');
    const workspaceMain = workspace?.querySelector<HTMLElement>('.workspace-page-main');
    if (!workspace || !editor || !previewPanel || !previewWindow || !workspaceMain) return undefined;

    const offsetProperty = '--workspace-page-preview-horizontal-offset';
    let animationFrame = 0;
    const observedAncestors: HTMLElement[] = [];
    for (let ancestor = workspace.parentElement; ancestor; ancestor = ancestor.parentElement) {
      observedAncestors.push(ancestor);
    }
    const alignPreview = () => {
      animationFrame = 0;
      if (previewPanel.dataset.visible === 'false' || previewPanel.dataset.collapsed === 'true') return;

      const editorBounds = editor.getBoundingClientRect();
      const previewBounds = previewWindow.getBoundingClientRect();
      const previewPanelBounds = previewPanel.getBoundingClientRect();
      const workspaceBounds = workspaceMain.getBoundingClientRect();
      if (!editorBounds.width || !previewBounds.width) return;

      const offset = Number.parseFloat(previewPanel.style.getPropertyValue(offsetProperty)) || 0;
      const previewWidthReserve = Number.parseFloat(getComputedStyle(previewPanel).getPropertyValue('--workspace-page-preview-window-width-reserve')) || 0;
      const previewShell = previewPanel.querySelector<HTMLElement>('.chat-preview-window-shell');
      const previewScale = previewPanel.offsetWidth > 0 ? previewPanelBounds.width / previewPanel.offsetWidth : 1;
      const alignedPreviewWidth = previewWidthReserve > 0 && previewShell
        ? Math.min(previewWindow.offsetWidth, Math.max(0, previewShell.clientWidth - previewWidthReserve))
        : previewWindow.offsetWidth;
      const editorGap = previewBounds.left - editorBounds.right;
      const viewportGap = workspaceBounds.right - previewBounds.right
        + (previewWindow.offsetWidth - alignedPreviewWidth) * previewScale;
      const rawOffset = offset - (editorGap - viewportGap) / 2;
      const alignmentLimitPx = 12;
      const nextOffset = Number.isFinite(rawOffset)
        ? Math.max(-alignmentLimitPx, Math.min(alignmentLimitPx, rawOffset))
        : 0;
      if (Math.abs(nextOffset - offset) > 0.25) {
        previewPanel.style.setProperty(offsetProperty, `${nextOffset}px`);
      }
    };
    const scheduleAlignment = () => {
      if (animationFrame) window.cancelAnimationFrame(animationFrame);
      animationFrame = window.requestAnimationFrame(alignPreview);
    };

    const resizeObserver = new ResizeObserver(scheduleAlignment);
    resizeObserver.observe(workspaceMain);
    resizeObserver.observe(editor);
    resizeObserver.observe(previewPanel);
    resizeObserver.observe(previewWindow);
    observedAncestors.forEach((ancestor) => resizeObserver.observe(ancestor));
    const mutationObserver = new MutationObserver(scheduleAlignment);
    [workspace, ...observedAncestors].forEach((element) => {
      mutationObserver.observe(element, {
        attributes: true,
        attributeFilter: ['class', 'hidden', 'style'],
        childList: true,
      });
    });
    window.addEventListener('resize', scheduleAlignment);
    window.addEventListener('focus', scheduleAlignment);
    window.addEventListener('pageshow', scheduleAlignment);
    window.addEventListener('scroll', scheduleAlignment, true);
    document.addEventListener('visibilitychange', scheduleAlignment);
    alignPreview();

    return () => {
      if (animationFrame) window.cancelAnimationFrame(animationFrame);
      resizeObserver.disconnect();
      mutationObserver.disconnect();
      window.removeEventListener('resize', scheduleAlignment);
      window.removeEventListener('focus', scheduleAlignment);
      window.removeEventListener('pageshow', scheduleAlignment);
      window.removeEventListener('scroll', scheduleAlignment, true);
      document.removeEventListener('visibilitychange', scheduleAlignment);
      previewPanel.style.removeProperty(offsetProperty);
    };
  }, [previewLayout.collapsed, previewVisible, workspaceRef]);

  useEffect(() => {
    writePreviewLayout(previewLayout);
  }, [previewLayout]);

  const togglePreviewVisibility = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    if (compactPreviewState.active) {
      setCompactPreviewState((current) => ({
        ...current,
        visible: !(current.visible ?? false),
      }));
      return;
    }

    setPreviewLayout((current) => {
      const nextVisible = current.visible ?? true;
      return {
        ...current,
        visible: !nextVisible,
        collapsed: nextVisible ? current.collapsed : false,
      };
    });
  };

  return {
    previewVisible,
    previewCollapsed,
    togglePreviewVisibility,
  };
}
