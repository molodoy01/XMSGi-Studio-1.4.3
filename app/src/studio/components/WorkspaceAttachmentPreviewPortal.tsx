import { createPortal } from 'react-dom';
import type { AttachmentPreview } from '../hooks/useWorkspaceAttachmentPreview';

type Props = {
  preview: AttachmentPreview | null;
  ariaLabel: string;
};

export function WorkspaceAttachmentPreviewPortal({ preview, ariaLabel }: Props) {
  if (!preview) return null;
  return createPortal(
    <div
      className="workspace-page-attachment-preview"
      style={{ left: preview.left, top: preview.top, width: preview.width, height: preview.height }}
      role="tooltip"
      aria-label={ariaLabel}
    >
      <img src={preview.src} alt={preview.name} />
    </div>,
    document.body,
  );
}
