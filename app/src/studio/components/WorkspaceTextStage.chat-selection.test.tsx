import { act } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { chatA, chatB, renderStage } from './WorkspaceTextStage.testUtils';

describe("WorkspaceTextStage chat selection", () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    window.localStorage.clear();
  });

  it('keeps template and chat stages navigable with stable list and footer regions', () => {
      const onModeChange = vi.fn();
      const { unmount: unmountTemplate } = renderStage({ mode: 'template', onModeChange });
  
      const templateStage = document.querySelector('.workspace-page-rich-text-template-stage.is-active') as HTMLElement;
      expect(templateStage).toBeTruthy();
      expect(templateStage.querySelector('.workspace-page-template-stage-list')).toBeTruthy();
      expect(templateStage.querySelectorAll('.workspace-page-template-stage-footer button')).toHaveLength(2);
      expect(templateStage.querySelector('.workspace-page-template-stage-item button')).toBeTruthy();
  
      act(() => {
        (templateStage.querySelector('.workspace-page-stage-secondary') as HTMLButtonElement).click();
      });
      expect(onModeChange).toHaveBeenCalledWith('editor');
      unmountTemplate();
  
      const onChatSelectionBack = vi.fn();
      const { unmount: unmountChat } = renderStage({ mode: 'chat', onChatSelectionBack, selectedChats: [] });
      const chatStage = document.querySelector('.workspace-page-rich-text-chat-stage.is-active') as HTMLElement;
  
      expect(chatStage).toBeTruthy();
      expect(chatStage.querySelector('[role="listbox"]')).toBeTruthy();
      expect(chatStage.querySelectorAll('[role="option"]')).toHaveLength(2);
      expect(chatStage.querySelector('.workspace-page-chat-stage-footer')).toBeTruthy();
      expect(chatStage.querySelectorAll('.workspace-page-chat-stage-footer button').length).toBeGreaterThanOrEqual(4);
  
      act(() => {
        (chatStage.querySelector('.workspace-page-stage-secondary') as HTMLButtonElement).click();
      });
      expect(onChatSelectionBack).toHaveBeenCalledTimes(1);
      unmountChat();
    })
  it('does not render static demo chats in the real chat picker', () => {
      const onChatSelectionChange = vi.fn();
      const onChatSelectionDone = vi.fn();
      const { rootElement, unmount } = renderStage({
        mode: 'chat',
        selectedChats: [],
        onChatSelectionChange,
        onChatSelectionDone,
      });
  
      expect(rootElement.querySelector('.workspace-page-chat-stage-demo')).toBeNull();
      expect(rootElement.querySelectorAll('.workspace-page-chat-stage-list [role="option"]')).toHaveLength(2);
  
      act(() => {
        const firstOption = rootElement.querySelector('.workspace-page-chat-stage-list [role="option"]');
        firstOption?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      });
  
      expect(onChatSelectionChange).toHaveBeenCalledWith([chatA]);
      expect(onChatSelectionDone).toHaveBeenCalledWith(chatA);
      unmount();
    })
  it('selects and confirms a chat from the chat picker with one click', () => {
      const onChatSelectionChange = vi.fn();
      const onChatSelectionDone = vi.fn();
  
      const { unmount } = renderStage({
        mode: 'chat',
        selectedChats: [],
        onChatSelectionChange,
        onChatSelectionDone,
      });
  
      const chatOption = Array.from(document.querySelectorAll('[role="option"]')).find((node) =>
        node.textContent?.includes('Alpha Team')
      );
  
      expect(chatOption).toBeTruthy();
  
      act(() => {
        chatOption!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      });
  
      expect(onChatSelectionChange).toHaveBeenCalledWith([chatA]);
      expect(onChatSelectionDone).toHaveBeenCalledWith(chatA);
      unmount();
    })
  it('confirms an already selected chat when its option is activated', () => {
      const onChatSelectionChange = vi.fn();
      const onChatSelectionDone = vi.fn();
      const { unmount } = renderStage({
        mode: 'chat',
        selectedChats: [chatA],
        onChatSelectionChange,
        onChatSelectionDone,
      });
      const chatOption = Array.from(document.querySelectorAll('[role="option"]')).find((node) =>
        node.textContent?.includes('Alpha Team')
      );
  
      act(() => {
        chatOption!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      });
      expect(onChatSelectionChange).not.toHaveBeenCalled();
      expect(onChatSelectionDone).toHaveBeenCalledWith(chatA);
      unmount();
    })
  it('keeps the Done button as a fallback for the selected chat', () => {
      const onChatSelectionDone = vi.fn();
      const { unmount } = renderStage({ mode: 'chat', selectedChats: [chatA], onChatSelectionDone });
      const doneButton = document.querySelector('.workspace-page-chat-stage-footer .workspace-page-stage-primary') as HTMLButtonElement;
  
      act(() => doneButton.click());
  
      expect(onChatSelectionDone).toHaveBeenCalledTimes(1);
      unmount();
    })
  it('shows a Telegram-blue initial when a contact photo fails to load', () => {
      const chatWithBrokenPhoto = { ...chatA, avatarDataUrl: 'broken-avatar-url' };
      const { unmount } = renderStage({ mode: 'chat', chats: [chatWithBrokenPhoto], selectedChats: [] });
      const avatar = document.querySelector('.workspace-page-chat-stage-avatar') as HTMLElement;
      const image = avatar.querySelector('img') as HTMLImageElement;
  
      expect(image).toBeTruthy();
      act(() => image.dispatchEvent(new Event('error')));
  
      expect(avatar.querySelector('img')).toBeNull();
      expect(avatar.textContent).toBe('A');
      expect(avatar.classList.contains('is-broken')).toBe(true);
      unmount();
    })
  it('marks chats as favorites and filters the chat list', () => {
      const { unmount } = renderStage({ mode: 'chat', chats: [chatB, chatA], selectedChats: [] });
      const favoriteButton = document.querySelector('[aria-label="Add Alpha Team to favorites"]') as HTMLButtonElement;
      const favoritesFilter = Array.from(document.querySelectorAll('button')).find((button) => button.textContent?.includes('Favorites')) as HTMLButtonElement;
  
      expect(favoriteButton).toBeTruthy();
      expect(favoritesFilter).toBeTruthy();
  
      act(() => {
        favoriteButton.click();
      });
  
      expect(favoriteButton.getAttribute('aria-pressed')).toBe('true');
      expect(window.localStorage.getItem('awaitmsg_favorite_chats')).toBe('["chat-1"]');
      expect(Array.from(document.querySelectorAll('.workspace-page-chat-stage-copy strong')).map((chat) => chat.textContent)).toEqual(['Alpha Team', 'Beta Channel']);
  
      act(() => {
        favoritesFilter.click();
      });
  
      expect(document.querySelector('[aria-label="Remove Alpha Team from favorites"]')).toBeTruthy();
      expect(document.body.textContent).not.toContain('Beta Channel');
      unmount();
    })
});
