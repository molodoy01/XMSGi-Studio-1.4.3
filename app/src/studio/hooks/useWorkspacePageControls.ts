import { useEffect, useRef, useState, type MutableRefObject } from 'react';
import type { DraftColor, SavedDraft, ScheduledMessage } from '../types';
import type { ChatWallpaper } from '../components/ChatPreviewStand';
import type { ScheduleRepeatOptions } from '../lib/scheduling';
import type { WorkspacePageProps } from '../pages/workspacePageTypes';
import {
  isLivePreviewSurface,
  readChatWallpaper,
  readPublishAction,
  writePublishAction,
} from '../lib/workspacePreferences';
import type { PendingDraftReplacement } from './useWorkspaceDraftReplacement';
import type { PublishAction } from '../components/WorkspacePageActionRows';
import { useWorkspaceChatSelection } from './useWorkspaceChatSelection';
import { useWorkspacePreviewHistory } from './useWorkspacePreviewHistory';
import { useWorkspacePublishFeedback } from './useWorkspacePublishFeedback';
import { useWorkspaceRuntimeStatus } from './useWorkspaceRuntimeStatus';
import { useWorkspaceScheduleClock } from './useWorkspaceScheduleClock';
import { useWorkspaceEditorAppearance } from './useWorkspaceEditorAppearance';
import { useWorkspacePreviewLayout } from './useWorkspacePreviewLayout';

type UseWorkspacePageControlsOptions = Pick<
  WorkspacePageProps,
  'connected' | 'selectedChat' | 'setSelectedChat' | 'chats' | 'date' | 'time' | 'setDate' | 'setTime'
> & {
  workspaceRef: MutableRefObject<HTMLDivElement | null>;
};

export function useWorkspacePageControls({
  connected,
  selectedChat,
  setSelectedChat,
  chats,
  date,
  time,
  setDate,
  setTime,
  workspaceRef,
}: UseWorkspacePageControlsOptions) {
  const [stageMode, setStageMode] = useState<'editor' | 'schedule' | 'template' | 'draft' | 'chat'>(() => (
    isLivePreviewSurface() ? 'schedule' : 'editor'
  ));
  const {
    selectedChats: workspaceSelectedChats,
    setSelectedChats: setWorkspaceSelectedChats,
    originRef: workspaceChatOriginRef,
    openChatSelection,
    backFromChatSelection,
    completeChatSelection,
  } = useWorkspaceChatSelection({ selectedChat, setSelectedChat, chats, setStageMode });
  const [scheduleFocus, setScheduleFocus] = useState<'repeat' | 'time' | null>(() => (
    isLivePreviewSurface() ? 'time' : null
  ));
  const [followCurrentTime, setFollowCurrentTime] = useState(true);
  const [scheduleSelectionConfirmed, setScheduleSelectionConfirmed] = useState(false);
  const [repeatMode, setRepeatMode] = useState<ScheduleRepeatOptions['mode']>('none');
  const [repeatDays, setRepeatDays] = useState<string[]>([]);
  const [repeatOccurrences, setRepeatOccurrences] = useState(5);
  const [draftColor, setDraftColor] = useState<DraftColor>('gray');
  const previewHistoryState = useWorkspacePreviewHistory({ connected, selectedChat });
  const [chatLookupError, setChatLookupError] = useState('');
  const [, setChatWallpaper] = useState<ChatWallpaper>(() => readChatWallpaper());
  const [chatListOpen, setChatListOpen] = useState(false);
  const [publishMenuOpen, setPublishMenuOpen] = useState(false);
  const [sendError, setSendError] = useState('');
  const pendingDraftReplacementRef = useRef<PendingDraftReplacement | null>(null);
  const suppressDraftReplacementSuccessClearRef = useRef(false);
  const completeDraftReplacementRef = useRef<(showRestoreFeedback?: boolean) => Promise<boolean>>(async () => false);
  const publishFeedbackState = useWorkspacePublishFeedback();
  const runtimeStatus = useWorkspaceRuntimeStatus({ connected });
  const scheduleClockNow = useWorkspaceScheduleClock({
    stageMode, date, time, followCurrentTime, setDate, setTime,
  });
  const [publishAction, setPublishAction] = useState<PublishAction>(() => readPublishAction());
  useEffect(() => {
    writePublishAction(publishAction);
  }, [publishAction]);
  const editorAppearanceState = useWorkspaceEditorAppearance({ workspaceRef, publishAction });
  const [rescheduleSource, setRescheduleSource] = useState<ScheduledMessage | null>(null);
  const rescheduleSourceRef = useRef<ScheduledMessage | null>(null);
  // Keep the prior editor document available until the Planner text is successfully sent or saved.
  const plannerRestoreRef = useRef<{ draft: SavedDraft | null } | null>(null);
  const scheduleSubmissionPendingRef = useRef(false);
  const scheduleSubmissionStartedRef = useRef(false);
  const publishMenuRef = useRef<HTMLDivElement | null>(null);
  const publishMenuToggleRef = useRef<HTMLButtonElement | null>(null);
  const previewLayout = useWorkspacePreviewLayout({ workspaceRef });

  return {
    stage: { stageMode, setStageMode },
    chatSelection: {
      workspaceSelectedChats,
      setWorkspaceSelectedChats,
      workspaceChatOriginRef,
      openChatSelection,
      backFromChatSelection,
      completeChatSelection,
      chatLookupError,
      setChatLookupError,
    },
    schedule: {
      scheduleFocus,
      setScheduleFocus,
      followCurrentTime,
      setFollowCurrentTime,
      scheduleSelectionConfirmed,
      setScheduleSelectionConfirmed,
      repeatMode,
      setRepeatMode,
      repeatDays,
      setRepeatDays,
      repeatOccurrences,
      setRepeatOccurrences,
      scheduleClockNow,
      scheduleSubmissionPendingRef,
      scheduleSubmissionStartedRef,
    },
    drafts: { draftColor, setDraftColor },
    preview: {
      ...previewHistoryState,
      setChatWallpaper,
      chatListOpen,
      setChatListOpen,
      ...previewLayout,
    },
    publishing: {
      publishMenuOpen,
      setPublishMenuOpen,
      sendError,
      setSendError,
      pendingDraftReplacementRef,
      suppressDraftReplacementSuccessClearRef,
      completeDraftReplacementRef,
      ...publishFeedbackState,
      publishAction,
      setPublishAction,
      publishMenuRef,
      publishMenuToggleRef,
    },
    runtime: runtimeStatus,
    editorAppearance: editorAppearanceState,
    rescheduling: {
      rescheduleSource,
      setRescheduleSource,
      rescheduleSourceRef,
      plannerRestoreRef,
    },
  };
}
