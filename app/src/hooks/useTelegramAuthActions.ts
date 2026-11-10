import { useCallback } from 'react';
import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import type { Chat } from '@/types';
import { savePersistentChats } from '@/lib/storage';
import { useLocale, type TranslationKey } from '@/lib/i18n';
import {
  hasTelegramBridge,
  telegramForgetAccount,
  telegramGetAuthState,
  telegramLogin,
  telegramSignOutKeepSession,
  telegramWelcomeBack,
} from '../services/telegramAppService';

type AuthStep = 'phone' | 'code' | 'password';

type AuthActionsOptions = {
  authBusy: boolean;
  authStep: AuthStep;
  phoneNumber: string;
  phoneCode: string;
  twoFactorPassword: string;
  returningUserName: string;
  returningUserUsername: string;
  signedOutRef: MutableRefObject<boolean>;
  setAuthBusy: Dispatch<SetStateAction<boolean>>;
  setAuthStep: Dispatch<SetStateAction<AuthStep>>;
  setPhoneCode: Dispatch<SetStateAction<string>>;
  setTwoFactorPassword: Dispatch<SetStateAction<string>>;
  setAuthError: Dispatch<SetStateAction<string>>;
  setLocalizedAuthError: (key: TranslationKey) => void;
  setConnecting: Dispatch<SetStateAction<boolean>>;
  setConnected: Dispatch<SetStateAction<boolean>>;
  setSessionAvailable: Dispatch<SetStateAction<boolean>>;
  setSessionResolved: Dispatch<SetStateAction<boolean>>;
  setSignedOut: Dispatch<SetStateAction<boolean>>;
  setShowAuthForm: Dispatch<SetStateAction<boolean>>;
  setReturningUserName: Dispatch<SetStateAction<string>>;
  setReturningUserUsername: Dispatch<SetStateAction<string>>;
  setConnectionResolved: Dispatch<SetStateAction<boolean>>;
  setIsConfirmingLogout: Dispatch<SetStateAction<boolean>>;
  setIsSettingsOpen: Dispatch<SetStateAction<boolean>>;
  setChats: Dispatch<SetStateAction<Chat[]>>;
  setSelectedChat: Dispatch<SetStateAction<Chat | null>>;
};

function getFriendlyAuthError(error: string): TranslationKey {
  if (/desktopBridgeRequired|desktop runtime|desktop app/i.test(error)) return 'auth.desktopBridgeRequired';
  if (/PHONE_NUMBER_INVALID|phone number.{0,24}invalid/i.test(error)) return 'auth.invalidPhone';
  if (/PHONE_CODE_EXPIRED|phone code.{0,24}expired/i.test(error)) return 'auth.expiredCode';
  if (/PHONE_CODE_INVALID|phone code.{0,24}invalid/i.test(error)) return 'auth.invalidCode';
  if (/PASSWORD_HASH_INVALID|password.{0,24}invalid/i.test(error)) return 'auth.invalidPassword';
  if (/PHONE_NUMBER_FLOOD|PHONE_PASSWORD_FLOOD|FLOOD_WAIT|too many attempts|^\s*420(?:\b|$)/i.test(error)) {
    return 'auth.tooManyAttempts';
  }
  if (/NETWORK|TIME.?OUT|ECONN|CONNECTION|FAILED TO FETCH|ERR_INTERNET|ERR_NETWORK|ENOTFOUND|EAI_AGAIN|SOCKET/i.test(error)) {
    return 'auth.networkSignInError';
  }
  return 'auth.genericSignInError';
}

function isTransientConnectionError(error: string) {
  return /\b(?:EHOSTUNREACH|ENETUNREACH|ECONN(?:REFUSED|RESET|ABORTED)|ETIMEDOUT|EAI_AGAIN|ENOTFOUND|ERR_INTERNET_DISCONNECTED|ERR_NETWORK_CHANGED)\b|network|offline|no internet|connection (?:lost|failed|unavailable)/i.test(error);
}

export function useTelegramAuthActions(options: AuthActionsOptions) {
  const { t } = useLocale();
  const {
    authBusy,
    authStep,
    phoneNumber,
    phoneCode,
    twoFactorPassword,
    returningUserName,
    returningUserUsername,
    signedOutRef,
    setAuthBusy,
    setAuthStep,
    setPhoneCode,
    setTwoFactorPassword,
    setAuthError,
    setLocalizedAuthError,
    setConnecting,
    setConnected,
    setSessionAvailable,
    setSessionResolved,
    setSignedOut,
    setShowAuthForm,
    setReturningUserName,
    setReturningUserUsername,
    setConnectionResolved,
    setIsConfirmingLogout,
    setIsSettingsOpen,
    setChats,
    setSelectedChat,
  } = options;

  const handleTelegramAuth = useCallback(async (): Promise<boolean> => {
    setAuthBusy(true);
    setAuthError('');

    try {
      if (!hasTelegramBridge()) {
        setLocalizedAuthError('auth.desktopBridgeRequired');
        return false;
      }

      const result = await telegramLogin({
        phoneNumber,
        phoneCode: authStep === 'phone' ? undefined : phoneCode,
        password: authStep === 'password' ? twoFactorPassword : undefined,
      });

      if (!result.success) {
        const error = result.error || t('auth.authorizationFailed');

        if (error === 'desktopBridgeRequired') {
          setLocalizedAuthError('auth.desktopBridgeRequired');
          return false;
        }

        if (
          authStep === 'code' &&
          !/\bPHONE_CODE_(?:INVALID|EXPIRED)\b/i.test(error) &&
          /\bSESSION_PASSWORD_NEEDED\b/i.test(error)
        ) {
          setAuthStep('password');
          setLocalizedAuthError('auth.enterTwoFactor');
        } else {
          setLocalizedAuthError(getFriendlyAuthError(error));
        }

        return false;
      }

      if (result.requiresPassword || result.nextStep === 'password') {
        setAuthStep('password');
        setLocalizedAuthError('auth.enterTwoFactor');
        return false;
      }

      if (result.requiresCode || result.nextStep === 'code') {
        setAuthStep('code');
        if (authStep !== 'phone') {
          setPhoneCode('');
          setTwoFactorPassword('');
          setLocalizedAuthError('auth.codeResent');
        }
        return false;
      }

      // Resolve account details before reporting success so callers can switch views without an IPC-frame flash.
      const authResult = await telegramGetAuthState();
      if (authResult.success && authResult.authState) {
        setReturningUserName(authResult.authState.userName || '');
        setReturningUserUsername(authResult.authState.username || '');
      }

      setConnecting(false);
      setConnected(true);
      setSessionAvailable(true);
      setSessionResolved(true);
      signedOutRef.current = false;
      setSignedOut(false);
      setShowAuthForm(false);
      setAuthError('');
      return true;
    } catch (error) {
      setLocalizedAuthError(getFriendlyAuthError(error instanceof Error ? error.message : ''));
      return false;
    } finally {
      setAuthBusy(false);
    }
  }, [authStep, phoneCode, phoneNumber, setAuthBusy, setAuthError, setLocalizedAuthError, setPhoneCode, setReturningUserName, setReturningUserUsername, setSessionAvailable, setSessionResolved, setShowAuthForm, setSignedOut, setConnected, setConnecting, setAuthStep, setTwoFactorPassword, signedOutRef, twoFactorPassword, t]);

  const handleDisconnect = useCallback(async (): Promise<boolean> => {
    setAuthBusy(true);
    setAuthError('');

    try {
      const result = await telegramSignOutKeepSession();
      if (!result.success) {
        setAuthError(result.error || t('auth.disconnectFailed'));
        return false;
      }

      setConnected(false);
      setSessionAvailable(false);
      signedOutRef.current = true;
      setSignedOut(true);
      setAuthError('');
      setShowAuthForm(false);
      setReturningUserName(result.authState?.userName || returningUserName);
      setReturningUserUsername(result.authState?.username || returningUserUsername);
      setIsConfirmingLogout(false);
      setIsSettingsOpen(false);
      setChats([]);
      await savePersistentChats([]);
      setSelectedChat(null);
      setAuthStep('phone');
      setPhoneCode('');
      setTwoFactorPassword('');
      return true;
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : t('auth.disconnectFailed'));
      return false;
    } finally {
      setAuthBusy(false);
    }
  }, [returningUserName, returningUserUsername, setAuthBusy, setAuthError, setAuthStep, setChats, setConnected, setIsConfirmingLogout, setIsSettingsOpen, setPhoneCode, setSelectedChat, setSessionAvailable, setShowAuthForm, setSignedOut, setReturningUserName, setReturningUserUsername, setTwoFactorPassword, signedOutRef, t]);

  const handleWelcomeBack = useCallback(async (onRestored?: () => void): Promise<boolean> => {
    if (authBusy) return false;

    setAuthBusy(true);
    setConnecting(true);
    setAuthError('');

    const continueOffline = () => {
      onRestored?.();
      signedOutRef.current = false;
      setSignedOut(false);
      setConnected(false);
      setSessionAvailable(true);
      setSessionResolved(true);
      setShowAuthForm(false);
      setAuthError('');
      setConnectionResolved(true);
      return true;
    };

    try {
      if (!hasTelegramBridge()) {
        setAuthError(t('auth.desktopBridgeRequired'));
        return false;
      }

      const result = await telegramWelcomeBack();
      if (!result.success || !result.authState || !result.authState.connected || result.authState.signedOut) {
        const error = result.error || t('auth.restoreFailed');
        if (isTransientConnectionError(error)) {
          return continueOffline();
        }
        setAuthError(error);
        return false;
      }

      onRestored?.();
      signedOutRef.current = false;
      setSignedOut(false);
      setConnected(true);
      setSessionAvailable(true);
      setSessionResolved(true);
      setShowAuthForm(false);
      setReturningUserName(result.authState.userName || returningUserName);
      setReturningUserUsername(result.authState.username || returningUserUsername);
      setConnectionResolved(true);
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      if (isTransientConnectionError(message)) {
        return continueOffline();
      }
      setAuthError(message || t('auth.restoreFailed'));
      return false;
    } finally {
      setConnecting(false);
      setAuthBusy(false);
    }
  }, [authBusy, returningUserName, returningUserUsername, setAuthBusy, setAuthError, setConnected, setConnecting, setConnectionResolved, setReturningUserName, setReturningUserUsername, setSessionAvailable, setSessionResolved, setShowAuthForm, setSignedOut, signedOutRef, t]);

  const handleForgetAccount = useCallback(async () => {
    if (authBusy) return;

    setAuthBusy(true);
    setAuthError('');

    try {
      const result = await telegramForgetAccount();
      if (!result.success || !result.authState) {
        setAuthError(result.error || t('auth.removeFailed'));
        return;
      }

      setConnected(false);
      setSessionAvailable(false);
      signedOutRef.current = false;
      setSignedOut(false);
      setReturningUserName('');
      setReturningUserUsername('');
      setIsConfirmingLogout(false);
      setChats([]);
      await savePersistentChats([]);
      setSelectedChat(null);
      setShowAuthForm(false);
      setAuthStep('phone');
      setPhoneCode('');
      setTwoFactorPassword('');
      setConnectionResolved(true);
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : t('auth.removeFailed'));
    } finally {
      setAuthBusy(false);
    }
  }, [authBusy, setAuthBusy, setAuthError, setAuthStep, setChats, setConnected, setConnectionResolved, setIsConfirmingLogout, setPhoneCode, setReturningUserName, setReturningUserUsername, setSelectedChat, setSessionAvailable, setShowAuthForm, setSignedOut, setTwoFactorPassword, signedOutRef, t]);

  return { handleTelegramAuth, handleDisconnect, handleWelcomeBack, handleForgetAccount };
}
