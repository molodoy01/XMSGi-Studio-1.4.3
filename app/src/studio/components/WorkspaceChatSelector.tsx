import { ChatAvatar } from './ChatAvatar';
import { ChatPickerChevron } from './ChatPickerChevron';
import type { Chat } from '../types';

type Props = {
  channelSelectorLabel: string;
  chooseChatLabel: string;
  chooseChatOrChannelTitle: string;
  selectedChat: Chat | null;
  selectedChatSubtitle: string;
  localizeChatName: (name: string) => string;
  onOpen: () => void;
  expanded: boolean;
};

export function WorkspaceChatSelector({
  channelSelectorLabel,
  chooseChatLabel,
  chooseChatOrChannelTitle,
  selectedChat,
  selectedChatSubtitle,
  localizeChatName,
  onOpen,
  expanded,
}: Props) {
  return (
    <div className="workspace-page-form-row">
      <label className="workspace-page-field-label" aria-label={channelSelectorLabel} />
      <div className="workspace-page-channel-picker">
        <button
          type="button"
          className="workspace-page-chat-trigger"
          onClick={onOpen}
          aria-label={chooseChatLabel}
          aria-expanded={expanded}
          title={chooseChatOrChannelTitle}
        >
          {selectedChat ? (
            <>
              <ChatAvatar name={selectedChat.name} src={selectedChat.avatarDataUrl} className="workspace-page-chat-trigger-avatar" />
              <span className="workspace-page-chat-trigger-copy">
                <strong>{localizeChatName(selectedChat.name)}</strong>
                <span>{selectedChatSubtitle}</span>
              </span>
              <ChatPickerChevron />
            </>
          ) : (
            <>
              <span>{chooseChatLabel}</span>
              <ChatPickerChevron />
            </>
          )}
        </button>
      </div>
    </div>
  );
}
