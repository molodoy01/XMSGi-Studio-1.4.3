import { createElement, useContext, useState } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { LocaleProvider } from '@/lib/i18n';
import { persistPostsReturnView, type ProductView } from '@/lib/productView';
import { AppShell, getTelegramStatusPresentation } from './AppShell';
import { QuickPlannerNavigationContext } from './QuickPlannerNavigationContext';
import { normalizeSavedPlannerDraft } from './historyModel';

const baseStatus = {
  accountId: 'telegram-session:active-account',
  status: 'normal' as const,
};
const accountAvatarCacheKey = 'xmsgi-account-avatar-cache-v1';
const appShellStyles = readFileSync(path.resolve(process.cwd(), 'src', 'styles', 'app-shell.css'), 'utf8');
const historyStyles = readFileSync(path.resolve(process.cwd(), 'src', 'styles', 'history-part-01.css'), 'utf8');

function openHistorySourceMenu() {
  fireEvent.click(document.querySelector('.history-source-select') as HTMLButtonElement);
}

function getHistorySourceOption(source: 'all' | 'workspace' | 'personal') {
  return document.querySelector(`.history-source-menu [data-history-filter="${source}"]`) as HTMLButtonElement;
}

function QuickPlannerNavigationTestButtons() {
  const { currentSection, openQuickPlan, openStudio, openPosts, openSettings } = useContext(QuickPlannerNavigationContext);
  return createElement('div', null,
    createElement('span', null, 'Current screen'),
    createElement('span', { 'data-testid': 'quickplanner-current-section' }, currentSection),
    createElement('button', { type: 'button', onClick: openStudio }, 'Studio from Quick Plan'),
    createElement('button', { type: 'button', onClick: openQuickPlan }, 'Quick Plan from Studio'),
    createElement('button', { type: 'button', onClick: openPosts }, 'Posts from Quick Plan'),
    createElement('button', { type: 'button', onClick: openSettings }, 'Settings from Quick Plan'),
  );
}

describe('Telegram status presentation', () => {
  it.each([
    ['normal', { ...baseStatus, status: 'normal' as const }, 'normal', 'telegramStatus.connected'],
    ['rate limited', { ...baseStatus, status: 'rate-limited' as const }, 'warning', 'telegramStatus.rateLimited'],
    ['slowmode', { ...baseStatus, status: 'slowmode' as const }, 'warning', 'telegramStatus.slowmode'],
    ['auth required', { ...baseStatus, status: 'auth required' as const }, 'error', 'telegramStatus.authRequired'],
    ['network retrying', { ...baseStatus, status: 'network/retrying' as const }, 'warning', 'telegramStatus.network'],
    ['permission error', { ...baseStatus, status: 'error' as const, category: 'permission' as const }, 'error', 'telegramStatus.permission'],
    ['unknown error', { ...baseStatus, status: 'error' as const, category: 'unknown' as const }, 'error', 'telegramStatus.error'],
  ])('maps %s to a visible presentation', (_name, status, tone, labelKey) => {
    expect(getTelegramStatusPresentation(status)).toMatchObject({ tone, labelKey });
  });
});

describe('product navigation', () => {
  it('hides Electron window controls while the app is in full-screen mode', async () => {
    expect(appShellStyles).toMatch(/\.electron-titlebar\s*\{[^}]*position:\s*relative;[^}]*z-index:\s*10001;/);

    let updateFullScreenState: ((isFullScreen: boolean) => void) | undefined;
    const desktop = {
      hasCustomWindowControls: true,
      minimizeWindow: vi.fn().mockResolvedValue(undefined),
      toggleMaximizeWindow: vi.fn().mockResolvedValue(false),
      closeWindow: vi.fn().mockResolvedValue(undefined),
      isWindowMaximized: vi.fn().mockResolvedValue(false),
      onWindowMaximizedChange: vi.fn().mockReturnValue(vi.fn()),
      isWindowFullScreen: vi.fn().mockResolvedValue(false),
      onWindowFullScreenChange: vi.fn((callback: (isFullScreen: boolean) => void) => {
        updateFullScreenState = callback;
        return vi.fn();
      }),
      setColorTheme: vi.fn().mockResolvedValue({ success: true }),
    };
    window.desktop = desktop;
    const view = render(createElement(LocaleProvider, null, createElement(AppShell, {
      view: 'studio',
      onViewChange: vi.fn(),
      connected: true,
      authBusy: false,
      isConfirmingLogout: false,
      setIsConfirmingLogout: vi.fn(),
      setShowAuthForm: vi.fn(),
      handleDisconnect: async () => undefined,
      handleForgetAccount: async () => undefined,
      onOpenSettings: vi.fn(),
      historyRecords: [],
      onHistoryCancel: vi.fn(),
      onHistoryReschedule: vi.fn(),
      onHistorySendNow: vi.fn(),
      onHistoryDelete: vi.fn(),
      onHistoryOpenDraft: vi.fn(),
      onHistoryClearSent: vi.fn(),
    })));

    try {
      expect(screen.getByRole('button', { name: 'Close window' })).toBeInTheDocument();
      await waitFor(() => expect(updateFullScreenState).toBeTypeOf('function'));
      updateFullScreenState?.(true);

      await waitFor(() => {
        expect(view.container.querySelector('.product-shell')).toHaveClass('is-window-full-screen');
        expect(screen.queryByRole('button', { name: 'Close window' })).not.toBeInTheDocument();
      });

      updateFullScreenState?.(false);
      await waitFor(() => expect(screen.getByRole('button', { name: 'Close window' })).toBeInTheDocument());
    } finally {
      view.unmount();
      Reflect.deleteProperty(window, 'desktop');
    }
  });

  it('switches product views on pointer press without switching again on release', () => {
    const onViewChange = vi.fn();
    render(createElement(LocaleProvider, null, createElement(AppShell, {
      view: 'studio',
      onViewChange,
      connected: true,
      authBusy: false,
      isConfirmingLogout: false,
      setIsConfirmingLogout: vi.fn(),
      setShowAuthForm: vi.fn(),
      handleDisconnect: async () => undefined,
      handleForgetAccount: async () => undefined,
      onOpenSettings: vi.fn(),
      historyRecords: [],
      onHistoryCancel: vi.fn(),
      onHistoryReschedule: vi.fn(),
      onHistorySendNow: vi.fn(),
      onHistoryDelete: vi.fn(),
      onHistoryOpenDraft: vi.fn(),
      onHistoryClearSent: vi.fn(),
    })));

    const plannerButton = screen.getByRole('button', { name: 'Planner' });
    fireEvent.pointerDown(plannerButton, { button: 0, isPrimary: true });

    expect(onViewChange).toHaveBeenCalledOnce();
    expect(onViewChange).toHaveBeenCalledWith('planner');

    fireEvent.click(plannerButton, { detail: 1 });
    expect(onViewChange).toHaveBeenCalledOnce();
  });

  it('hides the planner switch while the Posts section is open', () => {
    render(createElement(LocaleProvider, null, createElement(AppShell, {
      view: 'posts',
      onViewChange: vi.fn(),
      connected: true,
      authBusy: false,
      isConfirmingLogout: false,
      setIsConfirmingLogout: vi.fn(),
      setShowAuthForm: vi.fn(),
      handleDisconnect: async () => undefined,
      handleForgetAccount: async () => undefined,
      onOpenSettings: vi.fn(),
      historyRecords: [],
      onHistoryCancel: vi.fn(),
      onHistoryReschedule: vi.fn(),
      onHistorySendNow: vi.fn(),
      onHistoryDelete: vi.fn(),
      onHistoryOpenDraft: vi.fn(),
      onHistoryClearSent: vi.fn(),
    })));

    expect(screen.queryByRole('button', { name: 'Planner' })).not.toBeInTheDocument();
  });

  it('opens Posts and Settings on pointer press without waiting for release', () => {
    const onViewChange = vi.fn();
    const onOpenSettings = vi.fn();
    const onCloseSettings = vi.fn();
    const shellProps = {
      view: 'studio' as const,
      onViewChange,
      connected: true,
      authBusy: false,
      isConfirmingLogout: false,
      setIsConfirmingLogout: vi.fn(),
      setShowAuthForm: vi.fn(),
      handleDisconnect: async () => undefined,
      handleForgetAccount: async () => undefined,
      onOpenSettings,
      onCloseSettings,
      historyRecords: [],
      onHistoryCancel: vi.fn(),
      onHistoryReschedule: vi.fn(),
      onHistorySendNow: vi.fn(),
      onHistoryDelete: vi.fn(),
      onHistoryOpenDraft: vi.fn(),
      onHistoryClearSent: vi.fn(),
    };
    const renderShell = (settingsOpen = false) => createElement(
      LocaleProvider,
      null,
      createElement(AppShell, { ...shellProps, settingsOpen }),
    );
    const { rerender } = render(renderShell());

    const postsButton = screen.getByRole('button', { name: 'Posts' });
    fireEvent.pointerDown(postsButton, { button: 0, isPrimary: true });
    expect(onViewChange).toHaveBeenCalledOnce();
    expect(onViewChange).toHaveBeenCalledWith('posts');
    fireEvent.click(postsButton, { detail: 1 });
    expect(onViewChange).toHaveBeenCalledOnce();

    const settingsButton = screen.getByRole('button', { name: 'Settings' });
    fireEvent.pointerDown(settingsButton, { button: 0, isPrimary: true });
    expect(onOpenSettings).toHaveBeenCalledOnce();
    expect(onViewChange).toHaveBeenCalledTimes(2);
    expect(onViewChange).toHaveBeenLastCalledWith('studio');
    fireEvent.click(settingsButton, { detail: 1 });
    expect(onOpenSettings).toHaveBeenCalledOnce();

    rerender(renderShell(true));
    const doneButton = screen.getByRole('button', { name: 'Done' });
    fireEvent.pointerDown(doneButton, { button: 0, isPrimary: true });
    expect(onCloseSettings).toHaveBeenCalledOnce();
    fireEvent.click(doneButton, { detail: 1 });
    expect(onCloseSettings).toHaveBeenCalledOnce();
  });

  it('preserves Posts as the return section when opening Settings from Posts', () => {
    const onViewChange = vi.fn();
    const onOpenSettings = vi.fn();
    render(
      createElement(
        LocaleProvider,
        null,
        createElement(AppShell, {
          view: 'posts',
          onViewChange,
          connected: true,
          authBusy: false,
          isConfirmingLogout: false,
          setIsConfirmingLogout: vi.fn(),
          setShowAuthForm: vi.fn(),
          handleDisconnect: async () => undefined,
          handleForgetAccount: async () => undefined,
          onOpenSettings,
          historyRecords: [],
          onHistoryCancel: vi.fn(),
          onHistoryReschedule: vi.fn(),
          onHistorySendNow: vi.fn(),
          onHistoryDelete: vi.fn(),
          onHistoryOpenDraft: vi.fn(),
          onHistoryClearSent: vi.fn(),
        }),
      ),
    );

    fireEvent.pointerDown(screen.getByRole('button', { name: 'Settings' }), {
      button: 0,
      isPrimary: true,
    });

    expect(onOpenSettings).toHaveBeenCalledOnce();
    expect(onViewChange).not.toHaveBeenCalled();
  });

  it('shows the XMSGi brand and opens Planner from the Studio topbar', () => {
    const onViewChange = vi.fn();
    render(createElement(LocaleProvider, null, createElement(AppShell, {
      view: 'studio',
      onViewChange,
      connected: true,
      authBusy: false,
      isConfirmingLogout: false,
      setIsConfirmingLogout: vi.fn(),
      setShowAuthForm: vi.fn(),
      handleDisconnect: async () => undefined,
      handleForgetAccount: async () => undefined,
      onOpenSettings: vi.fn(),
      historyRecords: [],
      onHistoryCancel: vi.fn(),
      onHistoryReschedule: vi.fn(),
      onHistorySendNow: vi.fn(),
      onHistoryDelete: vi.fn(),
      onHistoryOpenDraft: vi.fn(),
      onHistoryClearSent: vi.fn(),
    })));

    expect(screen.getByText('XMSGi')).toBeInTheDocument();
    expect(document.querySelector('.topbar-identity .brand-mark')).toBeNull();
    expect(document.querySelector('.topbar-logout-photo-fallback')).toBeInTheDocument();
    expect(document.querySelector('.topbar-logout-photo-image')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Planner' }));

    expect(onViewChange).toHaveBeenCalledWith('planner');
  });

  it.each(['studio', 'planner'] as const)('uses a draft in Studio from Posts when opened from %s', (destination) => {
    const draft = normalizeSavedPlannerDraft({
      id: `destination-${destination}`,
      message: 'Planner draft to use',
      attachments: [],
      entities: [],
      reminderType: null,
      savedAt: '2026-10-24T12:00:00.000Z',
    });
    const onHistoryUseDraft = vi.fn();

    function AppShellHarness() {
      const [view, setView] = useState<'studio' | 'planner' | 'posts'>(destination);
      return createElement(AppShell, {
        view,
        onViewChange: setView,
        connected: true,
        authBusy: false,
        isConfirmingLogout: false,
        setIsConfirmingLogout: vi.fn(),
        setShowAuthForm: vi.fn(),
        handleDisconnect: async () => undefined,
        handleForgetAccount: async () => undefined,
        onOpenSettings: vi.fn(),
        historyRecords: [draft],
        onHistoryCancel: vi.fn(),
        onHistoryReschedule: vi.fn(),
        onHistorySendNow: vi.fn(),
        onHistoryDelete: vi.fn(),
        onHistoryOpenDraft: vi.fn(),
        onHistoryUseDraft: (record, selectedDestination) => {
          onHistoryUseDraft(record, selectedDestination);
          if (selectedDestination) setView(selectedDestination);
        },
        onHistoryClearSent: vi.fn(),
      }, createElement('div', null, 'Studio'));
    }

    const { container } = render(createElement(LocaleProvider, null, createElement(AppShellHarness)));
    fireEvent.click(screen.getByRole('button', { name: 'Posts' }));
    fireEvent.click(container.querySelector('.history-source-select') as HTMLButtonElement);
    fireEvent.click(document.querySelector('.history-source-menu [data-history-filter="all"]') as HTMLButtonElement);
    fireEvent.click(screen.getByRole('tab', { name: 'Drafts' }));
    fireEvent.click(container.querySelector('.history-record-open') as HTMLButtonElement);
    fireEvent.click(screen.getByRole('button', { name: 'Use' }));

    expect(onHistoryUseDraft).toHaveBeenCalledWith(draft, 'studio');
    expect(screen.queryByText(/Where would you like to open/)).not.toBeInTheDocument();
    expect(container.querySelector('.history-detail-draft-menu')).toBeNull();
    expect(container.querySelector('.history-draft-destination-menu')).toBeNull();
    expect(screen.queryByRole('region', { name: 'Posts' })).not.toBeInTheDocument();
    expect(container.querySelector('.product-shell')).toHaveClass('studio-shell');
  });
});

describe('Electron shell sizing', () => {
  it('does not globally compress the app content inside Electron', () => {
    document.documentElement.classList.add('electron-runtime');
    try {
      expect(getComputedStyle(document.documentElement).zoom).not.toBe('0.95');
      expect(getComputedStyle(document.documentElement).zoom).toBe('1');
    } finally {
      document.documentElement.classList.remove('electron-runtime');
    }
  });
});

describe('shared History Drawer entry point', () => {
  beforeEach(() => {
    window.localStorage.removeItem('xmsgi-history-drawer-open');
  });

  it('shows Posts notifications in the page header and keeps Settings notifications inline', () => {
    const closeNotification = vi.fn();
    const shellProps = {
      view: 'planner' as const,
      onViewChange: vi.fn(),
      browserDraftMode: false,
      notification: { message: 'Planner is ready.', title: 'Notice', type: 'info' as const, visible: true },
      closeNotification,
      connected: false,
      authBusy: false,
      isConfirmingLogout: false,
      setIsConfirmingLogout: vi.fn(),
      setShowAuthForm: vi.fn(),
      handleDisconnect: async () => undefined,
      handleForgetAccount: async () => undefined,
      onOpenSettings: vi.fn(),
      historyRecords: [],
      onHistoryCancel: vi.fn(),
      onHistoryReschedule: vi.fn(),
      onHistorySendNow: vi.fn(),
      onHistoryDelete: vi.fn(),
      onHistoryOpenDraft: vi.fn(),
      onHistoryClearSent: vi.fn(),
    };
    const { rerender } = render(createElement(LocaleProvider, null, createElement(AppShell, shellProps, createElement('div', null, 'Login'))));

    expect(screen.queryByLabelText('Current local date and time')).not.toBeInTheDocument();
    expect(screen.queryByText('Planner is ready.')).not.toBeInTheDocument();
    expect(document.querySelector('.shell-notification')).not.toBeInTheDocument();
    expect(closeNotification).toHaveBeenCalledOnce();

    rerender(createElement(LocaleProvider, null, createElement(AppShell, { ...shellProps, connected: true }, createElement('div', null, 'Planner'))));
    expect(screen.queryByLabelText('Current local date and time')).not.toBeInTheDocument();
    expect(screen.queryByText('Planner is ready.')).not.toBeInTheDocument();

    rerender(createElement(LocaleProvider, null, createElement(AppShell, { ...shellProps, browserDraftMode: true }, createElement('div', null, 'Local planner'))));
    expect(screen.queryByLabelText('Current local date and time')).not.toBeInTheDocument();

    closeNotification.mockClear();
    rerender(createElement(LocaleProvider, null, createElement(AppShell, { ...shellProps, view: 'studio' }, createElement('div', null, 'Studio'))));
    expect(document.querySelector('.shell-notification')).not.toBeInTheDocument();
    expect(closeNotification).toHaveBeenCalledOnce();

    rerender(createElement(LocaleProvider, null, createElement(AppShell, {
      ...shellProps,
      view: 'posts',
      connected: true,
    }, createElement('div', null, 'Posts'))));
    expect(document.querySelector('.shell-notification')).not.toBeInTheDocument();
    const postsNotice = document.querySelector('.history-page-action-notice');
    expect(postsNotice).toHaveClass('is-info');
    expect(postsNotice).toHaveTextContent('Notice: Planner is ready.');
    expect(postsNotice).toHaveAttribute('role', 'status');
    const postsHeader = postsNotice?.closest('.history-drawer-header');
    const postsTitle = postsHeader?.querySelector('.history-drawer-heading');
    const postsCloseButton = postsHeader?.querySelector('.history-page-close');
    expect(postsNotice).not.toBeNull();
    expect(postsTitle).not.toBeNull();
    expect(postsCloseButton).not.toBeNull();
    expect(postsTitle!.compareDocumentPosition(postsNotice!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(postsNotice!.compareDocumentPosition(postsCloseButton!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    rerender(createElement(LocaleProvider, null, createElement(AppShell, {
      ...shellProps,
      view: 'studio',
      settingsOpen: true,
      connected: true,
      notification: { ...shellProps.notification, type: 'error' },
    }, createElement('div', null, 'Studio'))));
    expect(document.querySelector('.shell-notification')).not.toBeInTheDocument();
    const settingsNotice = document.querySelector('.topbar-action-notice');
    expect(settingsNotice).toHaveClass('topbar-connection-notice', 'is-error');
    expect(settingsNotice).toHaveTextContent('Notice: Planner is ready.');
    expect(settingsNotice).toHaveAttribute('role', 'alert');
    expect(settingsNotice?.closest('.topbar')).not.toBeNull();
    expect(settingsNotice?.closest('.topbar-actions')).not.toBeNull();
    expect(appShellStyles).toMatch(
      /\.topbar-connection-notice\s*\{[^}]*position:\s*absolute;[^}]*top:\s*calc\(100% \+ 8px\);/,
    );
    expect(appShellStyles).toMatch(
      /\.topbar-connection-notice\.topbar-action-notice\s*\{[^}]*right:\s*calc\(29\.5px \+ 38px \+ 14px\);[^}]*width:\s*fit-content;[^}]*justify-content:\s*flex-end;[^}]*font-size:\s*12px;[^}]*text-align:\s*right;/,
    );
    expect(appShellStyles).toMatch(
      /\.topbar-connection-notice\.topbar-action-notice\s*\{\s*right:\s*calc\(16px \+ 38px \+ 6px\);/,
    );
    expect(appShellStyles).toMatch(
      /html\[data-theme='dark'\] \.topbar-connection-notice\.is-action-notice\s*\{[^}]*border:\s*0;[^}]*border-radius:\s*0;[^}]*padding:\s*0;[^}]*top:\s*calc\(100% \+ 17px\);/,
    );

    rerender(createElement(LocaleProvider, null, createElement(AppShell, {
      ...shellProps,
      view: 'posts',
      connected: true,
      connectionRecoveryNoticeStatus: 'offline' as const,
      notification: { ...shellProps.notification, type: 'error' },
    }, createElement('div', null, 'Posts'))));
    expect(document.querySelectorAll('.topbar-connection-notice')).toHaveLength(1);
    expect(document.querySelector('.history-page-action-notice')).toHaveClass('is-error');
    expect(document.querySelector('.topbar-action-notice')).not.toBeInTheDocument();
  });

  it('sizes the Posts action notice to its single-line content and aligns it to the right', () => {
    expect(historyStyles).toMatch(
      /\.history-page-action-notice\s*\{[^}]*flex:\s*0 1 auto;[^}]*width:\s*fit-content;[^}]*max-width:\s*min\(560px,\s*calc\(100% - 150px\)\);[^}]*justify-content:\s*flex-end;[^}]*text-align:\s*right;/,
    );
    expect(historyStyles).toMatch(
      /\.history-page-action-notice > span\s*\{[^}]*overflow:\s*hidden;[^}]*text-overflow:\s*ellipsis;[^}]*white-space:\s*nowrap;/,
    );
    expect(historyStyles).toMatch(
      /html\[data-theme='dark'\] \.history-page-action-notice\s*\{[^}]*border:\s*0;[^}]*border-radius:\s*0;[^}]*padding:\s*0;[^}]*background:\s*transparent;[^}]*box-shadow:\s*none;/,
    );
  });

  it.each(['planner', 'studio'] as const)('opens the Posts page from %s', (view) => {
    window.localStorage.removeItem('xmsgi-history-filters');
    const onOpenSettings = vi.fn();
    const onViewChange = vi.fn();
    const plannerNavigation = createElement(QuickPlannerNavigationTestButtons);

    function AppShellHarness() {
      const [currentView, setCurrentView] = useState<ProductView>(view);
      const handleViewChange = (nextView: ProductView) => {
        onViewChange(nextView);
        setCurrentView(nextView);
      };

      return createElement(AppShell, {
        view: currentView,
        onViewChange: handleViewChange,
        connected: true,
        authBusy: false,
        isConfirmingLogout: false,
        setIsConfirmingLogout: vi.fn(),
        setShowAuthForm: vi.fn(),
        handleDisconnect: async () => undefined,
        handleForgetAccount: async () => undefined,
        onOpenSettings,
        historyRecords: [],
        onHistoryCancel: vi.fn(),
        onHistoryReschedule: vi.fn(),
        onHistorySendNow: vi.fn(),
        onHistoryDelete: vi.fn(),
        onHistoryOpenDraft: vi.fn(),
        onHistoryClearSent: vi.fn(),
      }, plannerNavigation);
    }

    render(createElement(LocaleProvider, null, createElement(AppShellHarness)));

    expect(screen.getByTestId('quickplanner-current-section')).toHaveTextContent(view === 'planner' ? 'quick-plan' : 'studio');
    fireEvent.click(screen.getByRole('button', { name: 'Studio from Quick Plan' }));
    expect(onViewChange).toHaveBeenCalledWith('studio');
    fireEvent.click(screen.getByRole('button', { name: 'Quick Plan from Studio' }));
    expect(onViewChange).toHaveBeenCalledWith('planner');

    fireEvent.click(screen.getByRole('button', { name: 'Posts from Quick Plan' }));
    expect(screen.getByRole('region', { name: 'Posts' })).toBeInTheDocument();
    expect(document.querySelector('.history-drawer-backdrop')).not.toBeInTheDocument();
    expect(document.querySelector('.product-shell-content')).toHaveClass('is-posts');
    openHistorySourceMenu();
    const activeSource = getHistorySourceOption('all');
    expect(activeSource).toHaveAttribute('aria-checked', 'true');
    expect(document.querySelector('[data-history-filter="scheduled"]')).toHaveAttribute('aria-selected', 'true');
    fireEvent.click(activeSource);
    expect(screen.getByTestId('quickplanner-current-section')).toHaveTextContent('posts');
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('region', { name: 'Posts' })).not.toBeInTheDocument();
    expect(screen.getByTestId('quickplanner-current-section')).toHaveTextContent('quick-plan');

    fireEvent.click(screen.getByRole('button', { name: 'Posts' }));
    expect(screen.getByRole('region', { name: 'Posts' })).toBeInTheDocument();
    expect(screen.getByTestId('quickplanner-current-section')).toHaveTextContent('posts');
    fireEvent.click(screen.getByRole('button', { name: 'Posts' }));
    expect(screen.queryByRole('region', { name: 'Posts' })).not.toBeInTheDocument();
    expect(screen.getByTestId('quickplanner-current-section')).toHaveTextContent('quick-plan');

    fireEvent.click(screen.getByRole('button', { name: 'Posts from Quick Plan' }));
    fireEvent.click(screen.getByRole('button', { name: 'Settings from Quick Plan' }));
    expect(onOpenSettings).toHaveBeenCalledOnce();
    expect(onOpenSettings).toHaveBeenCalledWith(true);
    expect(onViewChange).toHaveBeenLastCalledWith('planner');

    expect(screen.queryByRole('region', { name: 'Posts' })).not.toBeInTheDocument();
  });

  it('closes Posts before navigating to Studio or Settings from Quick Planner', () => {
    const onOpenSettings = vi.fn();
    const onViewChange = vi.fn();
    const plannerNavigation = createElement(QuickPlannerNavigationTestButtons);

    render(createElement(LocaleProvider, null, createElement(AppShell, {
      view: 'planner',
      onViewChange,
      connected: true,
      authBusy: false,
      isConfirmingLogout: false,
      setIsConfirmingLogout: vi.fn(),
      setShowAuthForm: vi.fn(),
      handleDisconnect: async () => undefined,
      handleForgetAccount: async () => undefined,
      onOpenSettings,
      historyRecords: [],
      onHistoryCancel: vi.fn(),
      onHistoryReschedule: vi.fn(),
      onHistorySendNow: vi.fn(),
      onHistoryDelete: vi.fn(),
      onHistoryOpenDraft: vi.fn(),
      onHistoryClearSent: vi.fn(),
    }, plannerNavigation)));

    fireEvent.click(screen.getByRole('button', { name: 'Posts from Quick Plan' }));
    expect(screen.getByRole('region', { name: 'Posts' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Studio from Quick Plan' }));
    expect(screen.queryByRole('region', { name: 'Posts' })).not.toBeInTheDocument();
    expect(onViewChange).toHaveBeenCalledWith('studio');

    fireEvent.click(screen.getByRole('button', { name: 'Posts from Quick Plan' }));
    fireEvent.click(screen.getByRole('button', { name: 'Settings from Quick Plan' }));
    expect(screen.queryByRole('region', { name: 'Posts' })).not.toBeInTheDocument();
    expect(onOpenSettings).toHaveBeenCalledOnce();
  });

  it('closes Posts when Remember me changes the parent view to Planner', async () => {
    let currentView: 'planner' | 'posts' = 'planner';
    let rerenderShell: (ui: React.ReactNode) => void = () => undefined;
    const renderShell = (isConfirmingLogout = false) => createElement(LocaleProvider, null, createElement(AppShell, {
      view: currentView,
      onViewChange: (view) => {
        currentView = view === 'posts' ? 'posts' : 'planner';
        rerenderShell(renderShell());
      },
      connected: true,
      authBusy: false,
      isConfirmingLogout,
      setIsConfirmingLogout: vi.fn(),
      setShowAuthForm: vi.fn(),
      handleDisconnect: async () => {
        currentView = 'planner';
        rerenderShell(renderShell());
      },
      handleForgetAccount: async () => undefined,
      onOpenSettings: vi.fn(),
      historyRecords: [],
      onHistoryCancel: vi.fn(),
      onHistoryReschedule: vi.fn(),
      onHistorySendNow: vi.fn(),
      onHistoryDelete: vi.fn(),
      onHistoryOpenDraft: vi.fn(),
      onHistoryClearSent: vi.fn(),
    }, createElement(QuickPlannerNavigationTestButtons)));
    const view = render(renderShell());
    rerenderShell = view.rerender;

    fireEvent.click(screen.getByRole('button', { name: 'Posts from Quick Plan' }));
    expect(screen.getByRole('region', { name: 'Posts' })).toBeInTheDocument();

    rerenderShell(renderShell(true));
    fireEvent.click(screen.getByRole('button', { name: 'Remember me' }));

    await waitFor(() => {
      expect(screen.queryByRole('region', { name: 'Posts' })).not.toBeInTheDocument();
    });
  });

  it('opens Posts on All and Scheduled, then keeps the manually selected source', () => {
    window.localStorage.removeItem('xmsgi-history-filters');
    const onViewChange = vi.fn();
    const plannerNavigation = createElement(QuickPlannerNavigationTestButtons);

    render(createElement(LocaleProvider, null, createElement(AppShell, {
      view: 'planner',
      onViewChange,
      connected: true,
      authBusy: false,
      isConfirmingLogout: false,
      setIsConfirmingLogout: vi.fn(),
      setShowAuthForm: vi.fn(),
      handleDisconnect: async () => undefined,
      handleForgetAccount: async () => undefined,
      onOpenSettings: vi.fn(),
      historyRecords: [],
      onHistoryCancel: vi.fn(),
      onHistoryReschedule: vi.fn(),
      onHistorySendNow: vi.fn(),
      onHistoryDelete: vi.fn(),
      onHistoryOpenDraft: vi.fn(),
      onHistoryClearSent: vi.fn(),
    }, plannerNavigation)));

    fireEvent.click(screen.getByRole('button', { name: 'Posts from Quick Plan' }));
    openHistorySourceMenu();
    expect(getHistorySourceOption('all')).toHaveAttribute('aria-checked', 'true');
    expect(document.querySelector('[data-history-filter="scheduled"]')).toHaveAttribute('aria-selected', 'true');
    fireEvent.click(getHistorySourceOption('workspace'));
    fireEvent.keyDown(document, { key: 'Escape' });
    fireEvent.click(screen.getByRole('button', { name: 'Studio from Quick Plan' }));
    fireEvent.click(screen.getByRole('button', { name: 'Posts' }));

    openHistorySourceMenu();
    const selectedWorkspace = getHistorySourceOption('workspace');
    expect(selectedWorkspace).toHaveAttribute('aria-checked', 'true');
    fireEvent.click(selectedWorkspace);
  });

  it.each(['planner', 'studio'] as const)('restores the saved source after reloading from %s', (view) => {
    window.localStorage.setItem('xmsgi-history-filters', JSON.stringify({
      sourceFilter: 'workspace',
      sourceFilterPinned: true,
      statusFilter: 'scheduled',
    }));

    render(createElement(LocaleProvider, null, createElement(AppShell, {
      view,
      onViewChange: vi.fn(),
      connected: true,
      authBusy: false,
      isConfirmingLogout: false,
      setIsConfirmingLogout: vi.fn(),
      setShowAuthForm: vi.fn(),
      handleDisconnect: async () => undefined,
      handleForgetAccount: async () => undefined,
      onOpenSettings: vi.fn(),
      historyRecords: [],
      onHistoryCancel: vi.fn(),
      onHistoryReschedule: vi.fn(),
      onHistorySendNow: vi.fn(),
      onHistoryDelete: vi.fn(),
      onHistoryOpenDraft: vi.fn(),
      onHistoryClearSent: vi.fn(),
    })));

    fireEvent.click(screen.getByRole('button', { name: 'Posts' }));
    openHistorySourceMenu();

    expect(getHistorySourceOption('workspace')).toHaveAttribute('aria-checked', 'true');
    expect(getHistorySourceOption('all')).toHaveAttribute('aria-checked', 'false');
  });

  it('renders Posts as a standalone page and requests the previous view on Escape', () => {
    persistPostsReturnView('planner');
    const onViewChange = vi.fn();
    const { container } = render(createElement(LocaleProvider, null, createElement(AppShell, {
      view: 'posts',
      onViewChange,
      connected: true,
      authBusy: false,
      isConfirmingLogout: false,
      setIsConfirmingLogout: vi.fn(),
      setShowAuthForm: vi.fn(),
      handleDisconnect: async () => undefined,
      handleForgetAccount: async () => undefined,
      onOpenSettings: vi.fn(),
      historyRecords: [],
      onHistoryCancel: vi.fn(),
      onHistoryReschedule: vi.fn(),
      onHistorySendNow: vi.fn(),
      onHistoryDelete: vi.fn(),
      onHistoryOpenDraft: vi.fn(),
      onHistoryClearSent: vi.fn(),
    }, createElement(QuickPlannerNavigationTestButtons))));

    expect(screen.getByRole('region', { name: 'Posts' })).toBeInTheDocument();
    expect(container.querySelector('.product-shell')).toHaveClass('planner-shell');
    expect(container.querySelector('.history-drawer-backdrop')).not.toBeInTheDocument();
    expect(container.querySelector('.product-shell-content')).toHaveClass('is-posts');
    expect(container.querySelector('.history-drawer')?.parentElement).toBe(container.querySelector('.product-shell-content'));
    const postsTopbarButton = container.querySelector('.topbar .settings-action[aria-current="page"]');
    expect(postsTopbarButton).not.toBeNull();
    (postsTopbarButton as HTMLButtonElement).focus();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.getByRole('region', { name: 'Posts' })).toBeInTheDocument();
    expect(onViewChange).toHaveBeenCalledWith('planner');
    expect(document.activeElement).not.toBe(postsTopbarButton);
  });

  it('closes Posts before topbar Studio and Settings navigation', () => {
    window.localStorage.removeItem('xmsgi-history-drawer-open');
    const onOpenSettings = vi.fn();
    const onViewChange = vi.fn();
    const closeNotification = vi.fn();
    const shellProps: Parameters<typeof AppShell>[0] = {
      view: 'planner',
      onViewChange,
      connected: true,
      authBusy: false,
      isConfirmingLogout: false,
      setIsConfirmingLogout: vi.fn(),
      setShowAuthForm: vi.fn(),
      handleDisconnect: async () => undefined,
      handleForgetAccount: async () => undefined,
      closeNotification,
      onOpenSettings,
      historyRecords: [],
      onHistoryCancel: vi.fn(),
      onHistoryReschedule: vi.fn(),
      onHistorySendNow: vi.fn(),
      onHistoryDelete: vi.fn(),
      onHistoryOpenDraft: vi.fn(),
      onHistoryClearSent: vi.fn(),
    };
    const view = render(createElement(LocaleProvider, null, createElement(AppShell, shellProps, createElement('div', null, 'Quick Planner'))));

    fireEvent.click(screen.getByRole('button', { name: 'Posts' }));
    expect(screen.getByRole('region', { name: 'Posts' })).toBeInTheDocument();
    view.rerender(createElement(LocaleProvider, null, createElement(AppShell, { ...shellProps, view: 'posts' }, createElement('div', null, 'Posts'))));
    expect(screen.queryByRole('button', { name: 'Planner' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Posts' }));
    expect(onViewChange).toHaveBeenLastCalledWith('planner');
    view.rerender(createElement(LocaleProvider, null, createElement(AppShell, { ...shellProps, view: 'studio' }, createElement('div', null, 'Studio'))));
    expect(screen.queryByRole('region', { name: 'Posts' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Posts' }));
    closeNotification.mockClear();
    fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
    expect(onOpenSettings).toHaveBeenCalledOnce();
    expect(closeNotification).toHaveBeenCalledOnce();
    expect(screen.queryByRole('region', { name: 'Posts' })).not.toBeInTheDocument();
  });

  it('shows the real profile photo after refreshing it from Telegram', async () => {
    window.localStorage.removeItem(accountAvatarCacheKey);
    const previousTelegram = Object.getOwnPropertyDescriptor(window, 'telegram');
    let resolveAvatar: ((value: { success: boolean; avatarDataUrl: string }) => void) | undefined;
    const getAccountAvatar = vi.fn(() => new Promise<{ success: boolean; avatarDataUrl: string }>((resolve) => {
      resolveAvatar = resolve;
    }));
    Object.defineProperty(window, 'telegram', {
      configurable: true,
      value: { getAccountAvatar },
    });
    const onOpenSettings = vi.fn();
    const setIsConfirmingLogout = vi.fn();
    const view = render(createElement(LocaleProvider, null, createElement(AppShell, {
      view: 'studio',
      onViewChange: vi.fn(),
      connected: true,
      authBusy: false,
      isConfirmingLogout: false,
      setIsConfirmingLogout,
      setShowAuthForm: vi.fn(),
      handleDisconnect: async () => undefined,
      handleForgetAccount: async () => undefined,
      onOpenSettings,
      historyRecords: [],
      onHistoryCancel: vi.fn(),
      onHistoryReschedule: vi.fn(),
      onHistorySendNow: vi.fn(),
      onHistoryDelete: vi.fn(),
      onHistoryOpenDraft: vi.fn(),
      onHistoryClearSent: vi.fn(),
    }, createElement('div', null, 'Current screen'))));

    try {
      expect(view.container.querySelector('.topbar-logout-photo-fallback')).toBeInTheDocument();
      resolveAvatar?.({ success: true, avatarDataUrl: 'data:image/jpeg;base64,account-photo' });
      await waitFor(() => {
        expect(window.localStorage.getItem(accountAvatarCacheKey)).toBe('data:image/jpeg;base64,account-photo');
      });
      expect(getAccountAvatar).toHaveBeenCalledOnce();
      expect(view.container.querySelector('.topbar-logout-photo-image')).toHaveAttribute(
        'src',
        'data:image/jpeg;base64,account-photo',
      );
      expect(view.container.querySelector('.topbar-logout-photo-fallback')).toBeNull();

      const labels = Array.from(view.container.querySelectorAll('.topbar-actions .action-label'))
        .map((label) => label.textContent);
      expect(labels).toEqual(['Posts', 'Settings']);
      const photoTrigger = view.container.querySelector('.topbar-logout-photo');
      expect(photoTrigger).not.toBeNull();
      expect(photoTrigger?.querySelector('.topbar-logout-photo-image')).not.toBeNull();
      expect(photoTrigger?.querySelector('.topbar-logout-photo-ring')).not.toBeNull();
      expect(photoTrigger?.querySelector('.topbar-logout-photo-telegram')).toBeNull();
      expect(photoTrigger?.querySelector('.topbar-telegram-logo')).toBeNull();
      const logoutButton = screen.getByRole('button', { name: 'Log out' });
      expect(logoutButton).toHaveAttribute('aria-haspopup', 'dialog');
      expect(logoutButton).toHaveClass('topbar-logout-photo');

      fireEvent.click(logoutButton);
      expect(setIsConfirmingLogout).toHaveBeenCalledWith(true);
      expect(onOpenSettings).not.toHaveBeenCalled();

      expect(view.container.querySelector('.product-section-title-detached')).not.toBeInTheDocument();
    } finally {
      view.unmount();
      window.localStorage.removeItem(accountAvatarCacheKey);
      if (previousTelegram) Object.defineProperty(window, 'telegram', previousTelegram);
      else Reflect.deleteProperty(window, 'telegram');
    }
  });

  it.each([
    [null, ''],
    ['reconnecting', 'is-reconnecting'],
    ['offline', 'is-offline'],
  ] as const)('shows the avatar status for connection state %s', (connectionRecoveryStatus, statusClass) => {
    const view = render(createElement(LocaleProvider, null, createElement(AppShell, {
      view: 'studio',
      onViewChange: vi.fn(),
      connected: true,
      connectionRecoveryStatus,
      authBusy: false,
      isConfirmingLogout: false,
      setIsConfirmingLogout: vi.fn(),
      setShowAuthForm: vi.fn(),
      handleDisconnect: async () => undefined,
      handleForgetAccount: async () => undefined,
      onOpenSettings: vi.fn(),
      historyRecords: [],
      onHistoryCancel: vi.fn(),
      onHistoryReschedule: vi.fn(),
      onHistorySendNow: vi.fn(),
      onHistoryDelete: vi.fn(),
      onHistoryOpenDraft: vi.fn(),
      onHistoryClearSent: vi.fn(),
    }, createElement('div', null, 'Studio'))));

    const status = view.container.querySelector('.topbar-logout-photo-status');
    expect(status).not.toBeNull();
    if (statusClass) expect(status).toHaveClass(statusClass);
    else expect(status).not.toHaveClass('is-reconnecting', 'is-offline');
  });

  it.each([
    ['reconnecting', 'Retrying the Telegram connection.', 'is-warning'],
    ['offline', 'Telegram is unavailable. The app will keep trying to reconnect.', 'is-error'],
    ['restored', 'Connection restored', 'is-success'],
  ] as const)('shows the %s connection notice in Posts and settings only', (status, message, toneClass) => {
    const shellProps: Parameters<typeof AppShell>[0] = {
      view: 'studio',
      onViewChange: vi.fn(),
      connected: true,
      connectionRecoveryNoticeStatus: status,
      authBusy: false,
      isConfirmingLogout: false,
      setIsConfirmingLogout: vi.fn(),
      setShowAuthForm: vi.fn(),
      handleDisconnect: async () => undefined,
      handleForgetAccount: async () => undefined,
      onOpenSettings: vi.fn(),
      historyRecords: [],
      onHistoryCancel: vi.fn(),
      onHistoryReschedule: vi.fn(),
      onHistorySendNow: vi.fn(),
      onHistoryDelete: vi.fn(),
      onHistoryOpenDraft: vi.fn(),
      onHistoryClearSent: vi.fn(),
    };
    const view = render(createElement(
      LocaleProvider,
      null,
      createElement(AppShell, shellProps, createElement('div', null, 'Studio')),
    ));

    let notice = view.container.querySelector('.topbar-connection-notice');
    expect(notice).toBeNull();

    view.rerender(createElement(
      LocaleProvider,
      null,
      createElement(AppShell, { ...shellProps, view: 'posts' }, createElement('div', null, 'Posts')),
    ));

    notice = view.container.querySelector('.topbar-connection-notice');
    expect(notice).not.toBeNull();
    expect(notice).toHaveClass(toneClass);
    expect(notice).toHaveTextContent(message);
    expect(notice).toHaveAttribute('title', message);

    view.rerender(createElement(
      LocaleProvider,
      null,
      createElement(AppShell, { ...shellProps, settingsOpen: true }, createElement('div', null, 'Settings')),
    ));

    notice = view.container.querySelector('.topbar-connection-notice');
    expect(notice).not.toBeNull();
    expect(notice).toHaveClass(toneClass);
    expect(notice).toHaveTextContent(message);
  });

  it('keeps connection notices in one shared single-line capsule', () => {
    expect(appShellStyles).toMatch(
      /\.topbar-connection-notice\s*\{[^}]*max-width:\s*min\(560px,\s*calc\(100vw - 32px\)\);[^}]*border-radius:\s*8px;[^}]*background:\s*var\(--surface-raised\);[^}]*white-space:\s*nowrap;/,
    );
    expect(appShellStyles).toMatch(
      /html\[data-theme='dark'\] \.topbar-connection-notice\s*\{\s*border-color:\s*transparent;\s*background:\s*transparent;\s*box-shadow:\s*none;/,
    );
    expect(appShellStyles).toMatch(
      /\.topbar-connection-notice > span\s*\{[^}]*overflow:\s*hidden;[^}]*text-overflow:\s*ellipsis;[^}]*white-space:\s*nowrap;/,
    );
  });

  it('marks the avatar status red while an error notification is visible', () => {
    const shellProps: Parameters<typeof AppShell>[0] = {
      view: 'studio',
      onViewChange: vi.fn(),
      connected: true,
      notification: { message: 'Could not publish.', title: 'Publish failed', type: 'error', visible: true },
      authBusy: false,
      isConfirmingLogout: false,
      setIsConfirmingLogout: vi.fn(),
      setShowAuthForm: vi.fn(),
      handleDisconnect: async () => undefined,
      handleForgetAccount: async () => undefined,
      onOpenSettings: vi.fn(),
      historyRecords: [],
      onHistoryCancel: vi.fn(),
      onHistoryReschedule: vi.fn(),
      onHistorySendNow: vi.fn(),
      onHistoryDelete: vi.fn(),
      onHistoryOpenDraft: vi.fn(),
      onHistoryClearSent: vi.fn(),
    };

    const view = render(createElement(LocaleProvider, null, createElement(AppShell, shellProps, createElement('div', null, 'Studio'))));

    expect(view.container.querySelector('.topbar-logout-photo-status')).toHaveClass('has-error');

    view.rerender(createElement(LocaleProvider, null, createElement(AppShell, {
      ...shellProps,
      notification: { ...shellProps.notification!, visible: false },
    }, createElement('div', null, 'Studio'))));

    expect(view.container.querySelector('.topbar-logout-photo-status')).not.toHaveClass('has-error');
  });

  it('shows the cached account photo while refreshing it from Telegram', () => {
    const previousTelegram = Object.getOwnPropertyDescriptor(window, 'telegram');
    const cachedAvatar = 'data:image/jpeg;base64,cached-account-photo';
    const getAccountAvatar = vi.fn(() => new Promise<{ success: boolean; avatarDataUrl: string }>(() => undefined));
    window.localStorage.setItem(accountAvatarCacheKey, cachedAvatar);
    Object.defineProperty(window, 'telegram', {
      configurable: true,
      value: { getAccountAvatar },
    });

    const view = render(createElement(LocaleProvider, null, createElement(AppShell, {
      view: 'studio',
      onViewChange: vi.fn(),
      connected: true,
      authBusy: false,
      isConfirmingLogout: false,
      setIsConfirmingLogout: vi.fn(),
      setShowAuthForm: vi.fn(),
      handleDisconnect: async () => undefined,
      handleForgetAccount: async () => undefined,
      onOpenSettings: vi.fn(),
      historyRecords: [],
      onHistoryCancel: vi.fn(),
      onHistoryReschedule: vi.fn(),
      onHistorySendNow: vi.fn(),
      onHistoryDelete: vi.fn(),
      onHistoryOpenDraft: vi.fn(),
      onHistoryClearSent: vi.fn(),
    }, createElement('div', null, 'Current screen'))));

    try {
      expect(view.container.querySelector('.topbar-logout-photo-image')).toHaveAttribute('src', cachedAvatar);
      expect(view.container.querySelector('.topbar-logout-photo-fallback')).toBeNull();
      expect(window.localStorage.getItem(accountAvatarCacheKey)).toBe(cachedAvatar);
      expect(getAccountAvatar).toHaveBeenCalledOnce();
    } finally {
      view.unmount();
      window.localStorage.removeItem(accountAvatarCacheKey);
      if (previousTelegram) Object.defineProperty(window, 'telegram', previousTelegram);
      else Reflect.deleteProperty(window, 'telegram');
    }
  });

  it('renders the airy sign-out window with sign-out choices and no cancel button', () => {
    const onCancel = vi.fn();
    const onDisconnect = vi.fn(async () => undefined);
    const onForget = vi.fn(async () => undefined);
    const setShowAuthForm = vi.fn();
    const view = render(createElement(LocaleProvider, null, createElement(AppShell, {
      view: 'studio',
      onViewChange: vi.fn(),
      connected: true,
      authBusy: false,
      isConfirmingLogout: true,
      setIsConfirmingLogout: onCancel,
      setShowAuthForm,
      handleDisconnect: onDisconnect,
      handleForgetAccount: onForget,
      onOpenSettings: vi.fn(),
      historyRecords: [],
      onHistoryCancel: vi.fn(),
      onHistoryReschedule: vi.fn(),
      onHistorySendNow: vi.fn(),
      onHistoryDelete: vi.fn(),
      onHistoryOpenDraft: vi.fn(),
      onHistoryClearSent: vi.fn(),
    }, createElement('div', null, 'Current screen'))));

    const modal = screen.getByRole('dialog', { name: 'Sign out?' });
    expect(modal).toHaveClass('topbar-logout-modal');
    expect(modal).toHaveAttribute('aria-modal', 'true');
    expect(view.container.querySelector('.topbar-logout-modal-backdrop')).not.toBeNull();
    expect(screen.queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument();
    expect(Array.from(modal.querySelectorAll('.topbar-logout-modal-exit-choices button'))
      .map((button) => button.textContent?.trim()))
      .toEqual(['Forget me', 'Remember me']);

    const logoutPhotoButton = view.container.querySelector('.topbar-logout-photo') as HTMLButtonElement;
    logoutPhotoButton.focus();
    expect(document.activeElement).toBe(logoutPhotoButton);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onCancel).toHaveBeenCalledWith(false);
    expect(document.activeElement).not.toBe(logoutPhotoButton);

    fireEvent.click(screen.getByRole('button', { name: 'Remember me' }));
    expect(setShowAuthForm).toHaveBeenCalledWith(false);
    expect(onDisconnect).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole('button', { name: 'Forget me' }));
    expect(setShowAuthForm).toHaveBeenCalledWith(false);
    expect(onForget).toHaveBeenCalledOnce();
    view.unmount();
  });

  it('does not add a section title below the topbar on the quick planner screen', () => {
    const view = render(createElement(LocaleProvider, null, createElement(AppShell, {
      view: 'planner',
      onViewChange: vi.fn(),
      connected: true,
      authBusy: false,
      isConfirmingLogout: false,
      setIsConfirmingLogout: vi.fn(),
      setShowAuthForm: vi.fn(),
      handleDisconnect: async () => undefined,
      handleForgetAccount: async () => undefined,
      onOpenSettings: vi.fn(),
      historyRecords: [],
      onHistoryCancel: vi.fn(),
      onHistoryReschedule: vi.fn(),
      onHistorySendNow: vi.fn(),
      onHistoryDelete: vi.fn(),
      onHistoryOpenDraft: vi.fn(),
      onHistoryClearSent: vi.fn(),
    }, createElement('div', null, 'Planner canvas'))));

    expect(view.container.querySelector('.product-section-title-detached')).not.toBeInTheDocument();
    expect(screen.getByText('Planner canvas')).toBeInTheDocument();
  });

  it('hides the Planner title on the login and return screen', () => {
    const view = render(createElement(LocaleProvider, null, createElement(AppShell, {
      view: 'planner',
      browserDraftMode: false,
      onViewChange: vi.fn(),
      connected: false,
      authBusy: false,
      isConfirmingLogout: false,
      setIsConfirmingLogout: vi.fn(),
      setShowAuthForm: vi.fn(),
      handleDisconnect: async () => undefined,
      handleForgetAccount: async () => undefined,
      onOpenSettings: vi.fn(),
      historyRecords: [],
      onHistoryCancel: vi.fn(),
      onHistoryReschedule: vi.fn(),
      onHistorySendNow: vi.fn(),
      onHistoryDelete: vi.fn(),
      onHistoryOpenDraft: vi.fn(),
      onHistoryClearSent: vi.fn(),
    }, createElement('div', null, 'Login screen'))));

    expect(view.container.querySelector('.product-section-title-detached')).not.toBeInTheDocument();
  });

  it('shows only Done in the topbar while Settings is open', () => {
    const onCloseSettings = vi.fn();
    const shellProps = {
      view: 'planner' as const,
      onViewChange: vi.fn(),
      onCloseSettings,
      connected: true,
      authBusy: false,
      isConfirmingLogout: false,
      setIsConfirmingLogout: vi.fn(),
      setShowAuthForm: vi.fn(),
      handleDisconnect: async () => undefined,
      handleForgetAccount: async () => undefined,
      onOpenSettings: vi.fn(),
      historyRecords: [],
      onHistoryCancel: vi.fn(),
      onHistoryReschedule: vi.fn(),
      onHistorySendNow: vi.fn(),
      onHistoryDelete: vi.fn(),
      onHistoryOpenDraft: vi.fn(),
      onHistoryClearSent: vi.fn(),
    };
    const renderShell = (settingsOpen: boolean) => createElement(
      LocaleProvider,
      null,
      createElement(AppShell, { ...shellProps, settingsOpen }, createElement('div', null, 'Settings page')),
    );
    const view = render(renderShell(false));
    const settingsButton = screen.getByRole('button', { name: 'Settings' });
    view.rerender(renderShell(true));

    const actionButtons = Array.from(view.container.querySelectorAll('.topbar-actions button:not([aria-hidden="true"])'));
    expect(actionButtons).toHaveLength(1);
    expect(actionButtons[0]).toHaveAccessibleName('Done');
    expect(actionButtons[0]).toBe(settingsButton);
    expect(view.container.querySelector('.topbar-actions [aria-label="Posts"]')).toHaveAttribute('aria-hidden', 'true');
    expect(view.container.querySelector('.topbar-logout-photo')).toHaveAttribute('aria-hidden', 'true');
    expect(view.container.querySelector('.product-mode-switch')).not.toBeInTheDocument();
    expect(view.container.querySelector('.product-section-title')).not.toBeInTheDocument();
    expect(view.container.querySelector('.settings-view-done')).not.toBeInTheDocument();

    fireEvent.click(actionButtons[0]);
    expect(onCloseSettings).toHaveBeenCalledOnce();
    view.unmount();
  });

  it('does not restore a modal Posts drawer from a previous session', () => {
    const props = {
      view: 'studio' as const,
      onViewChange: vi.fn(),
      connected: true,
      authBusy: false,
      isConfirmingLogout: false,
      setIsConfirmingLogout: vi.fn(),
      setShowAuthForm: vi.fn(),
      handleDisconnect: async () => undefined,
      handleForgetAccount: async () => undefined,
      onOpenSettings: vi.fn(),
      historyRecords: [],
      onHistoryCancel: vi.fn(),
      onHistoryReschedule: vi.fn(),
      onHistorySendNow: vi.fn(),
      onHistoryDelete: vi.fn(),
      onHistoryOpenDraft: vi.fn(),
      onHistoryClearSent: vi.fn(),
    };
    const renderShell = () => render(createElement(
      LocaleProvider,
      null,
      createElement(AppShell, props, createElement('div', null, 'Current screen')),
    ));
    const firstView = renderShell();
    fireEvent.click(screen.getByRole('button', { name: 'Posts' }));
    expect(screen.getByRole('region', { name: 'Posts' })).toBeInTheDocument();
    firstView.unmount();

    window.localStorage.setItem('xmsgi-history-drawer-open', 'true');
    const secondView = renderShell();
    try {
      expect(screen.queryByRole('region', { name: 'Posts' })).not.toBeInTheDocument();
    } finally {
      secondView.unmount();
    }
  });

  it('reserves the topbar height while connection status is pending', () => {
    const props = {
      view: 'studio' as const,
      onViewChange: vi.fn(),
      connected: false,
      headerPending: true,
      authBusy: false,
      isConfirmingLogout: false,
      setIsConfirmingLogout: vi.fn(),
      setShowAuthForm: vi.fn(),
      handleDisconnect: async () => undefined,
      handleForgetAccount: async () => undefined,
      onOpenSettings: vi.fn(),
      historyRecords: [],
      onHistoryCancel: vi.fn(),
      onHistoryReschedule: vi.fn(),
      onHistorySendNow: vi.fn(),
      onHistoryDelete: vi.fn(),
      onHistoryOpenDraft: vi.fn(),
      onHistoryClearSent: vi.fn(),
    };
    const view = render(createElement(LocaleProvider, null, createElement(AppShell, props, createElement('div', null, 'Studio'))));

    expect(view.container.querySelector('.topbar-placeholder')).toBeInTheDocument();

    view.rerender(createElement(LocaleProvider, null, createElement(AppShell, { ...props, headerPending: false }, createElement('div', null, 'Studio'))));

    expect(view.container.querySelector('.topbar-placeholder')).not.toBeInTheDocument();

    view.rerender(createElement(LocaleProvider, null, createElement(AppShell, { ...props, connected: true, headerPending: false }, createElement('div', null, 'Studio'))));

    expect(view.container.querySelector('.topbar-placeholder')).not.toBeInTheDocument();
    expect(view.container.querySelector('.topbar')).toBeInTheDocument();
    expect(view.container.querySelector('.topbar-logout-photo-fallback')).toBeInTheDocument();
  });
});
