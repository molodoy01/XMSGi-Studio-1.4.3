import { createContext } from 'react';

export function blurFocusedTopbarAction() {
  const activeElement = document.activeElement;
  if (activeElement instanceof HTMLElement && activeElement.matches('.topbar .settings-action')) {
    activeElement.blur();
  }
}

export type QuickPlannerSection = 'quick-plan' | 'studio' | 'posts' | 'settings';
export type QuickPlannerPostsFilter = 'scheduled' | 'sent' | 'drafts';

export type QuickPlannerNavigationActions = {
  currentSection: QuickPlannerSection;
  openQuickPlan: () => void;
  openStudio: () => void;
  openPosts: (filter?: QuickPlannerPostsFilter) => void;
  openSettings: () => void;
};

export const QuickPlannerNavigationContext = createContext<QuickPlannerNavigationActions>({
  currentSection: 'quick-plan',
  openQuickPlan: () => undefined,
  openStudio: () => undefined,
  openPosts: () => undefined,
  openSettings: () => undefined,
});