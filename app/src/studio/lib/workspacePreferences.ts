import type { ChatWallpaper } from '../components/ChatPreviewStand';
import type { PublishAction } from '../components/WorkspacePageActionRows';
import { DRAFT_COLOR_OPTIONS } from '../components/DraftColorOptions';
import type { DraftColor } from '@studio/types';

const PREVIEW_LAYOUT_KEY = 'xmsgi-preview-layout';
const LEGACY_PREVIEW_LAYOUT_KEY = 'awaitmsg-preview-layout';
const CHAT_WALLPAPER_STORAGE_KEY = 'xmsgi-chat-preview-wallpaper';
const LEGACY_CHAT_WALLPAPER_STORAGE_KEY = 'awaitmsg-chat-preview-wallpaper';
const PUBLISH_ACTION_STORAGE_KEY = 'xmsgi-workspace-publish-action';
const LEGACY_PUBLISH_ACTION_STORAGE_KEY = 'awaitmsg-workspace-publish-action';
const DRAFT_STAGE_COLOR_FILTER_KEY = 'xmsgi_studio_draft_color_filter';

export type PreviewLayout = {
  collapsed?: boolean;
  visible?: boolean;
};

export const DEFAULT_PREVIEW_LAYOUT: PreviewLayout = { visible: true };

export function isLivePreviewSurface() {
  const portMatches = ['4175', '4176'].includes(window.location.port);
  return portMatches || document.body?.dataset?.livePreview === 'true';
}

export function readPreviewLayout(): PreviewLayout | null {
  try {
    const primaryRaw = window.localStorage.getItem(PREVIEW_LAYOUT_KEY);
    const raw = primaryRaw ?? window.localStorage.getItem(LEGACY_PREVIEW_LAYOUT_KEY);
    if (!raw) return null;
    if (!primaryRaw) {
      window.localStorage.setItem(PREVIEW_LAYOUT_KEY, raw);
    }

    const parsed = JSON.parse(raw) as Partial<PreviewLayout>;
    return {
      collapsed: parsed.collapsed === true,
      visible: typeof parsed.visible === 'boolean' ? parsed.visible : true,
    };
  } catch {
    return null;
  }
}

export function writePreviewLayout(layout: PreviewLayout) {
  const serialized = JSON.stringify(layout);
  window.localStorage.setItem(PREVIEW_LAYOUT_KEY, serialized);
  window.localStorage.setItem(LEGACY_PREVIEW_LAYOUT_KEY, serialized);
}

export function readPublishAction(): PublishAction {
  if (typeof window === 'undefined') return 'send';

  try {
    const primaryRaw = window.localStorage.getItem(PUBLISH_ACTION_STORAGE_KEY);
    const raw = primaryRaw ?? window.localStorage.getItem(LEGACY_PUBLISH_ACTION_STORAGE_KEY);
    if (!raw) return 'send';
    if (!primaryRaw) {
      window.localStorage.setItem(PUBLISH_ACTION_STORAGE_KEY, raw);
    }

    const parsed = raw === 'schedule' || raw === 'draft' || raw === 'send' ? raw : 'send';
    return parsed;
  } catch {
    return 'send';
  }
}

export function writePublishAction(action: PublishAction) {
  if (typeof window === 'undefined') return;

  try {
    const serialized = action === 'schedule' || action === 'draft' || action === 'send' ? action : 'send';
    window.localStorage.setItem(PUBLISH_ACTION_STORAGE_KEY, serialized);
    window.localStorage.setItem(LEGACY_PUBLISH_ACTION_STORAGE_KEY, serialized);
  } catch {
    // Ignore storage failures; the editor can continue without persisting the action.
  }
}

export function readDraftStageColorFilter(): DraftColor | null {
  if (typeof window === 'undefined') return null;

  try {
    const storedColor = window.localStorage.getItem(DRAFT_STAGE_COLOR_FILTER_KEY);
    return DRAFT_COLOR_OPTIONS.find((option) => option.value === storedColor)?.value ?? null;
  } catch {
    return null;
  }
}

export function writeDraftStageColorFilter(color: DraftColor | null) {
  if (typeof window === 'undefined') return;

  try {
    if (color) {
      window.localStorage.setItem(DRAFT_STAGE_COLOR_FILTER_KEY, color);
    } else {
      window.localStorage.removeItem(DRAFT_STAGE_COLOR_FILTER_KEY);
    }
  } catch (error) {
    console.error('Failed to save the Studio draft color filter.', error);
  }
}

export function readChatWallpaper(): ChatWallpaper {
  try {
    const primaryRaw = window.localStorage.getItem(CHAT_WALLPAPER_STORAGE_KEY);
    const raw = primaryRaw ?? window.localStorage.getItem(LEGACY_CHAT_WALLPAPER_STORAGE_KEY);
    if (!raw) return { theme: 'telegram', image: '', accent: '' };
    if (!primaryRaw) {
      window.localStorage.setItem(CHAT_WALLPAPER_STORAGE_KEY, raw);
    }

    const parsed = JSON.parse(raw) as Partial<ChatWallpaper>;
    return {
      theme: parsed.theme === 'custom' ? 'custom' : parsed.theme === 'graphite' ? 'graphite' : 'telegram',
      image: typeof parsed.image === 'string' ? parsed.image : '',
      accent: typeof parsed.accent === 'string' ? parsed.accent : '',
    };
  } catch {
    return { theme: 'telegram', image: '', accent: '' };
  }
}
