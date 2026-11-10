import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { preloadPlannerFonts } from './lib/plannerFonts';
import './styles/fonts.css';
import './styles/app-base.css';
import './styles/app-shell.css';
import './styles/telegram-auth.css';
import './index.css';
import './styles/composer.css';
import './styles/chat-picker.css';
import './styles/index-tail.css';
import './styles/chat-picker-final-overrides.css';
import './styles/notifications.css';
import './styles/messages-panel.css';
import './styles/chat-remove-modal.css';
import './styles/connection-spinner.css';
import './styles/history-layout-overrides.css';
import './styles/colorThemes.css';
import { LocaleProvider } from '@/lib/i18n';
import { applyColorTheme, readColorTheme } from '@/lib/colorTheme';
import { isDesktopTelegramRuntime } from '@/services/telegramAppService';

if ('scrollRestoration' in window.history) {
  window.history.scrollRestoration = 'manual';
}
document.documentElement.classList.toggle('electron-runtime', isDesktopTelegramRuntime());
document.documentElement.classList.toggle('electron-custom-window-controls', window.desktop?.hasCustomWindowControls === true);
applyColorTheme(readColorTheme());
window.scrollTo(0, 0);

const root = createRoot(document.getElementById('root')!);
const renderApp = () => root.render(
  <StrictMode>
    <LocaleProvider>
      <App />
    </LocaleProvider>
  </StrictMode>
);

void preloadPlannerFonts().then(renderApp).catch((error: unknown) => {
  console.error('Failed to preload Planner fonts; continuing with fallback fonts.', error);
  renderApp();
});
