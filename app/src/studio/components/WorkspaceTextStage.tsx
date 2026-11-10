import type { ComponentProps } from 'react';
import { ChatSelectionStage } from '@studio/components/stages/ChatSelectionStage';
import { DraftsStage } from '@studio/components/stages/DraftsStage';
import { ScheduleStage } from '@studio/components/stages/ScheduleStage';
import { TemplatesStage } from '@studio/components/stages/TemplatesStage';
import type { StageMode } from '@studio/components/stages/types';

type Props = {
  mode: StageMode;
  schedule: Omit<ComponentProps<typeof ScheduleStage>, 'mode'>;
  templates: Omit<ComponentProps<typeof TemplatesStage>, 'mode'>;
  drafts: Omit<ComponentProps<typeof DraftsStage>, 'mode'>;
  chats: Omit<ComponentProps<typeof ChatSelectionStage>, 'mode'>;
};

export function WorkspaceTextStage({ mode, schedule, templates, drafts, chats }: Props) {
  if (mode === 'editor') return null;

  return (
    <>
      <ScheduleStage mode={mode} {...schedule} />
      <TemplatesStage mode={mode} {...templates} />
      <DraftsStage mode={mode} {...drafts} />
      <ChatSelectionStage mode={mode} {...chats} />
    </>
  );
}
