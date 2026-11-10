import type { ComponentProps } from 'react';
import { ChatRemoveModal } from './ChatRemoveModal';
import { DocumentHistoryDialog } from './editor/DocumentHistoryDialog';

type Props = {
  chatRemoval: ComponentProps<typeof ChatRemoveModal>;
  history: ComponentProps<typeof DocumentHistoryDialog> | null;
};

export function WorkspacePageDialogs({ chatRemoval, history }: Props) {
  return (
    <>
      <ChatRemoveModal {...chatRemoval} />
      {history && <DocumentHistoryDialog {...history} />}
    </>
  );
}
