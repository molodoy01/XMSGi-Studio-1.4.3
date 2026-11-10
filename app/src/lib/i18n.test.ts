import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { createElement, type PropsWithChildren } from 'react';
import { getMissingTranslationKeys, LocaleProvider, useLocale } from './i18n';

function wrapper({ children }: PropsWithChildren) {
  return createElement(LocaleProvider, null, children);
}

describe('i18n', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('uses English by default and translates parameters', () => {
    const { result } = renderHook(() => useLocale(), { wrapper });
    expect(result.current.locale).toBe('en');
    expect(result.current.t('studio.sendAction')).toBe('Send now');
    expect(result.current.t('studio.saveAction')).toBe('Save draft');
    expect(result.current.t('schedule.repeatRange', { count: 15 })).toBe('Choose between 1 and 15 runs.');
    expect(result.current.t('schedule.massWarningTitle')).toBe('Mass scheduling warning');
    expect(result.current.t('schedule.massWarningMessage', { count: 10 })).toBe('10 messages · FloodWait risk');
    expect(result.current.t('settings.aboutDescription')).toBe('XMSGi Studio — Create and schedule Telegram posts in one workspace.');
  });

  it('keeps English as the default regardless of browser language', () => {
    Object.defineProperty(navigator, 'language', { configurable: true, value: 'ru-RU' });
    const { result } = renderHook(() => useLocale(), { wrapper });
    expect(result.current.locale).toBe('en');
  });

  it('persists and applies an explicit Russian selection immediately', () => {
    const { result } = renderHook(() => useLocale(), { wrapper });
    act(() => result.current.setLocale('ru'));
    expect(result.current.locale).toBe('ru');
    expect(result.current.t('studio.sendAction')).toBe('Отправить');
    expect(result.current.t('studio.schedule')).toBe('Планировать');
    expect(result.current.t('studio.saveAction')).toBe('Сохранить');
    expect(result.current.t('studio.draftMenuOption')).toBe('Черновики');
    expect(result.current.t('studio.postPlaceholder')).toBe('О чём расскажем сегодня?');
    expect(result.current.t('settings.title')).toBe('Настройки');
    expect(result.current.t('schedule.massWarningTitle')).toBe('Массовое планирование');
    expect(result.current.t('schedule.massWarningMessage', { count: 10 })).toBe('10 сообщений · риск FloodWait');
    expect(result.current.t('settings.aboutDescription')).toBe('XMSGi Studio — Создавайте и планируйте публикации в Telegram в одном рабочем пространстве.');
    expect(window.localStorage.getItem('awaitmsg_locale')).toBe('ru');
  });

  it('never exposes a missing translation key to users', () => {
    const { result } = renderHook(() => useLocale(), { wrapper });
    const logError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const missingKey = 'studio.missingTranslation' as Parameters<typeof result.current.t>[0];

    expect(result.current.t(missingKey)).toBe('Translation unavailable');
    expect(logError).toHaveBeenCalledWith('[i18n] Missing en translation for "studio.missingTranslation"');

    act(() => result.current.setLocale('ru'));
    expect(result.current.t(missingKey)).toBe('Перевод недоступен');
    expect(logError).toHaveBeenLastCalledWith('[i18n] Missing ru translation for "studio.missingTranslation"');
  });

  it('uses concise, actionable Telegram auth errors in both languages', () => {
    const { result } = renderHook(() => useLocale(), { wrapper });
    const messages = [
      ['auth.noInternet', 'No internet connection. Reconnect and try again.', 'Нет подключения к интернету. Подключитесь к сети и попробуйте снова.'],
      ['auth.authorizationFailed', 'Telegram could not verify your sign-in. Try again.', 'Telegram не подтвердил вход. Попробуйте снова.'],
      ['auth.loginCodePlaceholder', 'Sent via Telegram', 'Из Telegram'],
      ['settings.telegramCredentialsHowTo', 'Create an app in API development tools, then enter its API ID and Hash.', 'Создайте приложение в API development tools и введите API ID и Hash.'],
      ['settings.apiIdActive', 'Currently active: {apiId}', 'Активен сейчас: {apiId}'],
      ['settings.restoreAppKeys', 'Restore app keys', 'Вернуть ключи приложения'],
      ['settings.restoreAppKeysTitle', 'Restore app keys?', 'Вернуть ключи приложения?'],
      ['settings.restoreAppKeysConfirm', 'Restore app keys', 'Вернуть ключи'],
      ['settings.restoreAppKeysLoginMessage', 'Your saved API ID and API Hash will be removed. XMSGi Studio will use its built-in keys.', 'Сохранённые API ID и API Hash будут удалены. Приложение вернётся к встроенным ключам.'],
      ['settings.apiIdInvalid', 'API ID must be a positive number with up to 10 digits. Copy the app ID from my.telegram.org.', 'API ID должен быть положительным числом длиной до 10 цифр. Скопируйте числовой ID приложения с my.telegram.org.'],
      ['settings.apiHashRequired', 'Enter the API Hash shown on your my.telegram.org app page.', 'Введите API Hash из карточки приложения на my.telegram.org.'],
      ['settings.apiHashTooLong', 'API Hash is too long. Copy it again without any extra text.', 'API Hash слишком длинный. Скопируйте его заново без лишнего текста.'],
      ['settings.apiHashInvalid', 'Could not read the API Hash. Copy it again without extra characters.', 'Не удалось прочитать API Hash. Скопируйте значение заново без лишних символов.'],
      ['settings.telegramCredentialsDesktopRequired', 'Open XMSGi Studio as a desktop app to save these keys.', 'Для сохранения ключей откройте XMSGi Studio как настольное приложение.'],
      ['settings.telegramCredentialsSaveFailed', 'Could not securely save the keys. Check that the app can access its data, then try again.', 'Не удалось безопасно сохранить ключи. Проверьте доступ к данным приложения и попробуйте ещё раз.'],
      ['settings.telegramCredentialsSecurityTitle', 'Keep your API Hash private', 'Храните API Hash в секрете'],
      ['settings.telegramCredentialsSecurity', 'The app stores these keys locally; they are not saved in browser storage.', 'Ключи сохраняются приложением локально и не попадают в хранилище браузера.'],
      ['auth.twoFactorPassword', 'Two-step verification password', 'Пароль двухэтапной проверки'],
      ['auth.twoFactorPasswordPlaceholder', 'Your password', 'Ваш пароль'],
      ['auth.startOver', 'Use a different phone number', 'Начать заново с другим номером'],
      ['auth.signOutStartOver', 'Sign out and start over', 'Выйти и начать заново'],
      ['auth.loginHeroTaglineSub', 'Your content. Your studio.', 'Твой контент. Твоя студия.'],
      ['auth.returnToApp', 'Continue as {name}', 'Вернуться в приложение: {name}'],
      ['auth.invalidPhone', 'Enter a valid phone number, including the country code.', 'Введите номер телефона с кодом страны.'],
      ['auth.invalidCode', 'The Telegram code is incorrect. Check your latest message and try again.', 'Неверный код Telegram. Проверьте последнее сообщение и попробуйте снова.'],
      ['auth.expiredCode', 'The code expired. Request a new one.', 'Срок действия кода истёк. Запросите новый.'],
      ['auth.invalidPassword', 'The two-step verification password is incorrect. Try again.', 'Неверный пароль двухэтапной проверки. Попробуйте снова.'],
      ['auth.tooManyAttempts', 'Too many sign-in attempts. Please try again later.', 'Слишком много попыток входа. Попробуйте позже.'],
      ['auth.networkSignInError', 'Can’t reach Telegram. Check your internet connection and try again.', 'Нет связи с Telegram. Проверьте интернет и попробуйте снова.'],
      ['auth.genericSignInError', 'Couldn’t sign in to Telegram with the current API keys. Enter your own Telegram API keys in Settings and try again.', 'Не удалось войти в Telegram с текущими API-ключами. Укажите свои API-ключи Telegram в настройках и попробуйте снова.'],
      ['auth.desktopBridgeRequired', 'Sign in to Telegram in the XMSGi desktop app.', 'Войти в Telegram можно только в приложении XMSGi для компьютера.'],
      ['auth.enterTwoFactor', 'Code accepted. Your Telegram account has two-step verification enabled. Enter your password to continue.', 'Код подтверждён. В аккаунте включена двухэтапная проверка Telegram — введите пароль, чтобы продолжить.'],
      ['auth.disconnectFailed', 'Couldn’t sign out of Telegram. Try again.', 'Не удалось выйти из Telegram. Попробуйте снова.'],
      ['auth.restoreFailed', 'Couldn’t restore your saved Telegram session. Sign in again.', 'Не удалось восстановить сессию Telegram. Войдите снова.'],
      ['auth.removeFailed', 'Couldn’t remove your Telegram account. Try again.', 'Не удалось удалить аккаунт Telegram. Попробуйте снова.'],
      ['auth.readStateFailed', 'Couldn’t check your Telegram sign-in. Restart XMSGi.', 'Не удалось проверить вход в Telegram. Перезапустите XMSGi.'],
      ['auth.connectFailed', 'Couldn’t reconnect your saved Telegram session. Sign in again.', 'Не удалось подключить сохранённую сессию Telegram. Войдите снова.'],
      ['auth.readConnectionFailed', 'Couldn’t load Telegram settings. Restart XMSGi.', 'Не удалось загрузить настройки Telegram. Перезапустите XMSGi.'],
      ['auth.sessionExpired', 'Your Telegram session expired. Sign in again.', 'Сессия Telegram истекла. Войдите снова.'],
    ] as const;

    for (const [key, english] of messages) {
      expect(result.current.t(key)).toBe(english);
    }

    act(() => result.current.setLocale('ru'));
    for (const [key, , russian] of messages) {
      expect(result.current.t(key)).toBe(russian);
    }
  });

  it('has no missing interface translations in either locale', () => {
    expect(getMissingTranslationKeys('en')).toEqual([]);
    expect(getMissingTranslationKeys('ru')).toEqual([]);
  });
});
