import type { ComponentProps, CSSProperties } from 'react';
import type { EditorAppearanceCssTokens } from '@shared/editorAppearance';
import { RichTextEditor } from './RichTextEditor';
import { WorkspaceAttachmentTray } from './WorkspaceAttachmentTray';
import { WorkspaceChatSelector } from './WorkspaceChatSelector';
import { WorkspacePageActionRows } from './WorkspacePageActionRows';
import { WorkspaceTextStage } from './WorkspaceTextStage';

type Props = {
  title: string;
  publishAction: 'send' | 'schedule' | 'draft';
  editorAppearance: string;
  editorAppearanceTokens: EditorAppearanceCssTokens;
  currentActionLabel: string;
  currentModeSummary: string;
  chatSelector: ComponentProps<typeof WorkspaceChatSelector>;
  editor: Omit<ComponentProps<typeof RichTextEditor>, 'stageContent'>;
  stage: ComponentProps<typeof WorkspaceTextStage>;
  attachmentTray: ComponentProps<typeof WorkspaceAttachmentTray>;
  actionRows: ComponentProps<typeof WorkspacePageActionRows>;
};

export function WorkspacePageEditorSection({
  title,
  publishAction,
  editorAppearance,
  editorAppearanceTokens,
  currentActionLabel,
  currentModeSummary,
  chatSelector,
  editor,
  stage,
  attachmentTray,
  actionRows,
}: Props) {
  return (
    <section className="workspace-page-panel workspace-page-editor-panel" aria-label={title}>
      <div className="workspace-page-editor-heading">
        <div className="workspace-page-editor-title">
          <span className="workspace-page-editor-title-text">{title}</span>
        </div>
      </div>

      <div
        className={`workspace-page-editor-shell${publishAction === 'schedule' ? ' is-scheduled' : publishAction === 'draft' ? ' is-draft' : ''}`}
        data-editor-appearance={editorAppearance}
        style={editorAppearanceTokens as CSSProperties}
      >
        <div className="workspace-page-mode-summary" aria-live="polite">
          <span className="workspace-page-mode-summary-label">{currentActionLabel}</span>
          <strong>{currentModeSummary}</strong>
        </div>
        <div className="workspace-page-editor-canvas">
          <WorkspaceChatSelector {...chatSelector} />
          <div className="workspace-page-form-row workspace-page-form-row-body">
            <RichTextEditor
              {...editor}
              stageContent={<WorkspaceTextStage {...stage} />}
            />
          </div>
        </div>

        <WorkspaceAttachmentTray {...attachmentTray} />
        <WorkspacePageActionRows {...actionRows} />
      </div>
    </section>
  );
}
