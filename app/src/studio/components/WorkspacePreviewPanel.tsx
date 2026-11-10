import { memo, type ComponentProps } from 'react';
import { ChatPreviewStand } from './ChatPreviewStand';

type Props = ComponentProps<typeof ChatPreviewStand> & {
  collapsed: boolean;
  visible: boolean;
};

const MemoizedChatPreviewStand = memo(ChatPreviewStand);

export function WorkspacePreviewPanel({ collapsed, visible, ...previewProps }: Props) {
  return (
    <section
      className="workspace-page-panel workspace-page-preview-panel"
      data-collapsed={collapsed ? 'true' : 'false'}
      data-visible={visible ? 'true' : 'false'}
    >
      <MemoizedChatPreviewStand {...previewProps} collapsed={collapsed} />
    </section>
  );
}
