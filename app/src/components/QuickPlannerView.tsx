import { type ChangeEvent, type CSSProperties, type DragEvent } from 'react';
import { EmojiPickerPanel } from './EmojiPickerPanel';
import { ArrowUpRight, CalendarDays, Check, ChevronDown, ChevronLeft, ChevronRight, Clock3, Eraser, FileText, Paperclip, Search, Send, Smile, Sparkles, RotateCcw, X } from 'lucide-react';
import { createPortal } from 'react-dom';
import { ChatAvatar } from '../studio/components/ChatAvatar';
import { QuickPlannerActivity } from './QuickPlannerActivity';
import { flushPlannerDraftWrite, readPlannerDraftEntities, writePlannerDraft } from '../lib/plannerDraft';
import { actionModes, getChatInitial, isFileDrag, parseScheduleTime, retainUnchangedRichTextEntities, scheduleTimeOptions, toLocalDateTime, formatDateLabel } from './quickPlanner/quickPlannerUtils';
import type * as React from 'react';
import type { Chat, RichTextEntity, ScheduledMessage } from '@/types';
import type { Locale, TranslationKey } from '@/lib/i18n';
import type { TelegramMessageEffect } from '@/lib/telegramMessageEffects';
import type { ChatPickerOption, PlannerAttachment, QuickPlannerActionFeedback } from './quickPlanner/quickPlannerUtils';

type QuickPlannerViewProps = {
  upcoming: ScheduledMessage[];
  sent: ScheduledMessage[];
  historyReady: boolean;
  historyError: boolean;
  onSelectChat: ((chat: Chat | null) => void) | undefined;
  feedbackPreview: QuickPlannerActionFeedback | null | undefined;
  connectionRecoveryNoticeStatus: "reconnecting" | "offline" | "restored" | null;
  locale: Locale;
  t: (key: TranslationKey, params?: Record<string, string | number>) => string;
  selectedMode: string;
  setSelectedMode: React.Dispatch<React.SetStateAction<string>>;
  message: string;
  setMessage: React.Dispatch<React.SetStateAction<string>>;
  messageInputFocused: boolean;
  setMessageInputFocused: React.Dispatch<React.SetStateAction<boolean>>;
  setMessageEntities: React.Dispatch<React.SetStateAction<RichTextEntity[]>>;
  upcomingMessages: ScheduledMessage[];
  selectedDate: string;
  selectedTime: string;
  activeSchedulePicker: "date" | "time" | null;
  setActiveSchedulePicker: React.Dispatch<React.SetStateAction<"date" | "time" | null>>;
  scheduleTimeDraft: string | null;
  setScheduleTimeDraft: React.Dispatch<React.SetStateAction<string | null>>;
  setCalendarCursor: React.Dispatch<React.SetStateAction<Date>>;
  schedulePickerPosition: { top: number; left: number; maxHeight: number; };
  emojiPickerOpen: boolean;
  setEmojiPickerOpen: React.Dispatch<React.SetStateAction<boolean>>;
  emojiModifierHeld: boolean;
  emojiCategoryId: string;
  setEmojiCategoryId: React.Dispatch<React.SetStateAction<string>>;
  emojiSearchQuery: string;
  setEmojiSearchQuery: React.Dispatch<React.SetStateAction<string>>;
  emojiActiveIndex: number;
  setEmojiActiveIndex: React.Dispatch<React.SetStateAction<number>>;
  emojiCommandRange: { start: number; end: number; } | null;
  setEmojiCommandRange: React.Dispatch<React.SetStateAction<{ start: number; end: number; } | null>>;
  recentEmojis: string[];
  effectPickerOpen: boolean;
  setEffectPickerOpen: React.Dispatch<React.SetStateAction<boolean>>;
  availableEffects: TelegramMessageEffect[];
  selectedEffectId: string | null;
  setSelectedEffectId: React.Dispatch<React.SetStateAction<string | null>>;
  attachments: PlannerAttachment[];
  setAttachments: React.Dispatch<React.SetStateAction<PlannerAttachment[]>>;
  isFileDragOver: boolean;
  setIsFileDragOver: React.Dispatch<React.SetStateAction<boolean>>;
  attachmentScroll: { max: number; position: number; contentWidth: number; };
  actionFeedbackInstance: number;
  actionFeedbackRetriggered: boolean;
  chatPickerOpen: boolean;
  setChatPickerOpen: React.Dispatch<React.SetStateAction<boolean>>;
  chatQuery: string;
  setChatQuery: React.Dispatch<React.SetStateAction<string>>;
  setSelectedChatId: React.Dispatch<React.SetStateAction<string>>;
  plannerAccent: string;
  plannerAccentRgb: string;
  timeZoneLabel: string;
  minimumScheduleDateValue: string;
  minimumScheduleTimeValue: string;
  calendarMonthKey: number;
  calendarMonthLabel: string;
  calendarWeekdayLabels: string[];
  calendarDayCount: number;
  calendarFirstWeekdayOffset: number;
  minimumMonthKey: number;
  todayScheduleDateValue: string;
  messageMaxLength: 1024 | 4096;
  submitLabel: string;
  chatPickerRef: React.RefObject<HTMLDivElement>;
  toolsRowRef: React.RefObject<HTMLDivElement>;
  effectsToolRef: React.RefObject<HTMLDivElement>;
  emojiToolRef: React.RefObject<HTMLDivElement>;
  emojiPickerPanelRef: React.RefObject<HTMLDivElement>;
  scheduleRowRef: React.RefObject<HTMLDivElement>;
  scheduleDateTriggerRef: React.RefObject<HTMLButtonElement>;
  scheduleTimeTriggerRef: React.RefObject<HTMLButtonElement>;
  scheduleDatePickerRef: React.RefObject<HTMLDivElement>;
  scheduleTimePickerRef: React.RefObject<HTMLDivElement>;
  chatTriggerRef: React.RefObject<HTMLButtonElement>;
  chatSearchRef: React.RefObject<HTMLInputElement>;
  workbenchRef: React.RefObject<HTMLElement>;
  messageInputRef: React.RefObject<HTMLTextAreaElement>;
  attachmentInputRef: React.RefObject<HTMLInputElement>;
  attachmentScrollbarRef: React.RefObject<HTMLDivElement>;
  attachmentListRef: React.RefObject<HTMLDivElement>;
  selectedPickerChat: ChatPickerOption;
  filteredChats: ChatPickerOption[];
  removePickerChat: (chat: ChatPickerOption) => void;
  setScheduleDateTimeWithinRange: (dateValue: string, timeValue: string) => void;
  clearActionFeedback: () => void;
  toggleEffectPicker: () => void;
  insertEmoji: (emoji: string, keepPickerOpen?: boolean, updateRecent?: boolean) => void;
  toggleEmojiPicker: () => void;
  handleEmojiPickerKeyDown: (event: { key: string; ctrlKey?: boolean; metaKey?: boolean; altKey?: boolean; preventDefault: () => void; stopPropagation: () => void; }) => void;
  applyQuickTime: (preset: "now" | "30min" | "tomorrow") => void;
  handleSubmit: () => Promise<void>;
  handleOpenInStudio: () => void;
  handleAttachmentFiles: (selectedFiles: File[]) => void;
  handleMessagePaste: (event: React.ClipboardEvent<HTMLTextAreaElement>) => void;
  handleAttachmentChange: (event: ChangeEvent<HTMLInputElement>) => void;
  visibleActionFeedback: QuickPlannerActionFeedback | null;
  calendarCursor: Date;
  getAttachmentCountTranslationKey: (locale: "en" | "ru", count: number) => "quickPlanner.attachmentOne" | "quickPlanner.attachments" | "quickPlanner.attachmentsFew";
};

export function QuickPlannerView({
  upcoming,
  sent,
  historyReady,
  historyError,
  onSelectChat,
  feedbackPreview,
  connectionRecoveryNoticeStatus,
  locale,
  t,
  selectedMode,
  setSelectedMode,
  message,
  setMessage,
  messageInputFocused,
  setMessageInputFocused,
  setMessageEntities,
  upcomingMessages,
  selectedDate,
  selectedTime,
  activeSchedulePicker,
  setActiveSchedulePicker,
  scheduleTimeDraft,
  setScheduleTimeDraft,
  setCalendarCursor,
  schedulePickerPosition,
  emojiPickerOpen,
  setEmojiPickerOpen,
  emojiModifierHeld,
  emojiCategoryId,
  setEmojiCategoryId,
  emojiSearchQuery,
  setEmojiSearchQuery,
  emojiActiveIndex,
  setEmojiActiveIndex,
  emojiCommandRange,
  setEmojiCommandRange,
  recentEmojis,
  effectPickerOpen,
  setEffectPickerOpen,
  availableEffects,
  selectedEffectId,
  setSelectedEffectId,
  attachments,
  setAttachments,
  isFileDragOver,
  setIsFileDragOver,
  attachmentScroll,
  actionFeedbackInstance,
  actionFeedbackRetriggered,
  chatPickerOpen,
  setChatPickerOpen,
  chatQuery,
  setChatQuery,
  setSelectedChatId,
  plannerAccent,
  plannerAccentRgb,
  timeZoneLabel,
  minimumScheduleDateValue,
  minimumScheduleTimeValue,
  calendarMonthKey,
  calendarMonthLabel,
  calendarWeekdayLabels,
  calendarDayCount,
  calendarFirstWeekdayOffset,
  minimumMonthKey,
  todayScheduleDateValue,
  messageMaxLength,
  submitLabel,
  chatPickerRef,
  toolsRowRef,
  effectsToolRef,
  emojiToolRef,
  emojiPickerPanelRef,
  scheduleRowRef,
  scheduleDateTriggerRef,
  scheduleTimeTriggerRef,
  scheduleDatePickerRef,
  scheduleTimePickerRef,
  chatTriggerRef,
  chatSearchRef,
  workbenchRef,
  messageInputRef,
  attachmentInputRef,
  attachmentScrollbarRef,
  attachmentListRef,
  selectedPickerChat,
  filteredChats,
  removePickerChat,
  setScheduleDateTimeWithinRange,
  clearActionFeedback,
  toggleEffectPicker,
  insertEmoji,
  toggleEmojiPicker,
  handleEmojiPickerKeyDown,
  applyQuickTime,
  handleSubmit,
  handleOpenInStudio,
  handleAttachmentFiles,
  handleMessagePaste,
  handleAttachmentChange,
  visibleActionFeedback,
  calendarCursor,
  getAttachmentCountTranslationKey,
}: QuickPlannerViewProps) {
  const isScheduleMode = selectedMode === 'Schedule';
  const isDraftMode = selectedMode === 'Draft';
  const selectedEffect = availableEffects.find((effect) => effect.id === selectedEffectId) ?? null;
  const SubmitIcon = selectedMode === 'Send now' ? Send : selectedMode === 'Draft' ? FileText : CalendarDays;
  const calendarYear = calendarCursor.getFullYear();
  const calendarMonth = calendarCursor.getMonth();
  const dateLocale = locale === 'ru' ? 'ru-RU' : 'en-US';

return (
  <main
      className="quick-planner"
      lang={locale}
      aria-labelledby="quick-planner-title"
      style={{ '--planner-accent': plannerAccent, '--planner-accent-rgb': plannerAccentRgb } as CSSProperties}
    >
      <div className="quick-planner-inner">
        <header className="quick-planner-heading">
          <div>
            <h1 id="quick-planner-title" className="quick-planner-sr-only">{t('quickPlanner.newMessage')}</h1>
          </div>
        </header>

        <div className="quick-planner-layout">
          <section ref={workbenchRef} className="quick-planner-workbench" aria-label={t('quickPlanner.sectionLabel')}>
            <div className="quick-planner-toolbar">
              <div className="quick-planner-destination" ref={chatPickerRef}>
                <span className="quick-planner-label">{t('quickPlanner.sendTo')}</span>
                <button
                  ref={chatTriggerRef}
                  className={`quick-planner-chat${chatPickerOpen ? ' is-open' : ''}`}
                  type="button"
                  aria-haspopup="listbox"
                  aria-expanded={chatPickerOpen}
                  onClick={() => setChatPickerOpen((open) => !open)}
                >
                  {selectedPickerChat?.avatarDataUrl ? (
                    <ChatAvatar name={selectedPickerChat.name} src={selectedPickerChat.avatarDataUrl} className="quick-planner-chat-avatar" />
                  ) : selectedPickerChat ? (
                    <span className="quick-planner-chat-avatar">{getChatInitial(selectedPickerChat.name)}</span>
                  ) : (
                    <span className="quick-planner-chat-avatar" aria-hidden="true">?</span>
                  )}
                  <span className="quick-planner-chat-copy">
                    <strong>{selectedPickerChat?.name ?? t('quickPlanner.chooseChat')}</strong>
                  </span>
                  <ChevronDown size={15} aria-hidden="true" />
                </button>
                {chatPickerOpen && (
                  <div className="quick-planner-chat-menu">
                    <label className="quick-planner-chat-search">
                      <Search size={15} aria-hidden="true" />
                      <input
                        ref={chatSearchRef}
                        type="search"
                        value={chatQuery}
                        onChange={(event) => setChatQuery(event.target.value)}
                        placeholder={t('quickPlanner.searchChats')}
                        aria-label={t('quickPlanner.searchChats')}
                      />
                    </label>
                    <div className="quick-planner-chat-menu-heading">{t('quickPlanner.recentChats')}</div>
                    <div className="quick-planner-chat-options" role="listbox" aria-label={t('quickPlanner.chatList')}>
                      {filteredChats.map((chat) => (
                        <div
                          key={chat.id}
                          className={`quick-planner-chat-option-row${selectedPickerChat?.id === chat.id ? ' is-selected' : ''}`}
                          role="group"
                          aria-label={chat.name}
                        >
                          <button
                            className={`quick-planner-chat-option${selectedPickerChat?.id === chat.id ? ' is-selected' : ''}`}
                            type="button"
                            role="option"
                            aria-selected={selectedPickerChat?.id === chat.id}
                            onClick={() => {
                              setSelectedChatId(chat.id);
                              onSelectChat?.(chat.sourceChat ?? null);
                              setChatPickerOpen(false);
                              setChatQuery('');
                            }}
                          >
                            {chat.avatarDataUrl ? (
                              <ChatAvatar name={chat.name} src={chat.avatarDataUrl} className="quick-planner-chat-avatar" />
                            ) : (
                              <span className="quick-planner-chat-avatar">{getChatInitial(chat.name)}</span>
                            )}
                            <span className="quick-planner-chat-copy">
                              <strong>{chat.name}</strong>
                              <small>{chat.type}</small>
                            </span>
                            {selectedPickerChat?.id === chat.id && <Check size={16} aria-hidden="true" />}
                          </button>
                          <button
                            className="quick-planner-chat-option-remove"
                            type="button"
                            aria-label={t('quickPlanner.removeChat', { chat: chat.name })}
                            title={t('quickPlanner.removeChat', { chat: chat.name })}
                            onClick={() => removePickerChat(chat)}
                          >
                            <X size={14} aria-hidden="true" />
                          </button>
                        </div>
                      ))}
                      {filteredChats.length === 0 && (
                        <div className="quick-planner-chat-empty">{t('quickPlanner.noChatsFound')}</div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className="quick-planner-action-mode">
                <span className="quick-planner-label">{t('quickPlanner.action')}</span>
                <div className="quick-planner-mode-switch" role="group" aria-label={t('quickPlanner.actionModes')}>
                  {actionModes.map(({ mode, labelKey, icon: Icon }) => {
                    const active = selectedMode === mode;

                    return (
                    <button
                      key={mode}
                      className={active ? 'is-active' : ''}
                      type="button"
                      aria-pressed={active}
                      onClick={() => {
                        setSelectedMode(mode);
                        setActiveSchedulePicker(null);
                        setScheduleTimeDraft(null);
                      }}
                    >
                      <Icon size={14} aria-hidden="true" />
                      <span>{t(labelKey)}</span>
                    </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="quick-planner-composer">
              <div className="quick-planner-composer-meta">
                <span>{t('quickPlanner.message')}</span>
                <span className="quick-planner-composer-meta-trailing">
                  {attachments.length > 0 && (
                    <span>{t(getAttachmentCountTranslationKey(locale, attachments.length), { count: attachments.length })}</span>
                  )}
                  <span className="quick-planner-counter-controls">
                    {selectedEffect && (
                      <span
                        className="quick-planner-selected-effect"
                        aria-label={`${t('quickPlanner.messageEffects')}: ${selectedEffect.emoticon}`}
                        title={`${t('quickPlanner.messageEffects')}: ${selectedEffect.emoticon}`}
                      >
                        {selectedEffect.emoticon}
                      </span>
                    )}
                    <span className="quick-planner-character-count">{String(message.length).padStart(2, '0')} <i>/</i> {messageMaxLength}</span>
                    <button
                      className={`quick-planner-clear-message${message ? '' : ' is-hidden'}`}
                      type="button"
                      aria-label={t('quickPlanner.clearReminderText')}
                      aria-hidden={!message}
                      title={t('quickPlanner.clearText')}
                      disabled={!message}
                      tabIndex={message ? 0 : -1}
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => {
                        setMessage('');
                        setMessageEntities([]);
                        clearActionFeedback();
                        messageInputRef.current?.focus();
                      }}
                    >
                      <Eraser size={20} aria-hidden="true" />
                    </button>
                  </span>
                </span>
              </div>
              <textarea
                ref={messageInputRef}
                className={`quick-planner-message${isFileDragOver ? ' is-file-drag-over' : ''}`}
                wrap="soft"
                aria-label={t('quickPlanner.reminderText')}
                aria-describedby="quick-planner-counter"
                maxLength={messageMaxLength}
                value={message}
                onFocus={() => setMessageInputFocused(true)}
                onBlur={() => setMessageInputFocused(false)}
                onClick={(event) => {
                  const textarea = event.currentTarget;
                  if (event.detail >= 4) {
                    textarea.select();
                    return;
                  }
                  if (event.detail !== 3) return;

                  const text = textarea.value;
                  const selectionStart = textarea.selectionStart;
                  const selectionEnd = textarea.selectionEnd;
                  const position = Math.floor((selectionStart + selectionEnd) / 2);
                  const lineStart = text.lastIndexOf('\n', Math.max(0, position - 1)) + 1;
                  const nextLineBreak = text.indexOf('\n', position);
                  const lineEnd = nextLineBreak === -1 ? text.length : nextLineBreak;
                  textarea.setSelectionRange(lineStart, lineEnd);
                }}
                onPaste={handleMessagePaste}
                onDragEnter={(event: DragEvent<HTMLTextAreaElement>) => {
                  if (!isFileDrag(event.dataTransfer)) return;
                  event.preventDefault();
                  setIsFileDragOver(true);
                }}
                onDragOver={(event: DragEvent<HTMLTextAreaElement>) => {
                  if (!isFileDrag(event.dataTransfer)) return;
                  event.preventDefault();
                  event.dataTransfer.dropEffect = 'copy';
                  setIsFileDragOver(true);
                }}
                onDragLeave={(event: DragEvent<HTMLTextAreaElement>) => {
                  if (!isFileDrag(event.dataTransfer)) return;
                  setIsFileDragOver(false);
                }}
                onDrop={(event: DragEvent<HTMLTextAreaElement>) => {
                  if (!isFileDrag(event.dataTransfer)) return;
                  event.preventDefault();
                  setIsFileDragOver(false);
                  handleAttachmentFiles(Array.from(event.dataTransfer.files));
                }}
                onChange={(event) => {
                  const nextMessage = event.target.value;
                  setMessageEntities((current) => retainUnchangedRichTextEntities(message, nextMessage, current));
                  setMessage(nextMessage);
                  clearActionFeedback();
                  const caret = event.currentTarget.selectionStart;
                  const commandMatch = nextMessage.slice(0, caret).match(/(?:^|\s):([\p{L}\p{N}_-]*)$/iu);
                  if (commandMatch) {
                    const commandStart = caret - commandMatch[1].length - 1;
                    setEmojiCommandRange({ start: commandStart, end: caret });
                    setEmojiSearchQuery(commandMatch[1].replace(/[_-]/g, ' '));
                    setEmojiActiveIndex(0);
                    setEmojiPickerOpen(true);
                    setEffectPickerOpen(false);
                  } else if (emojiCommandRange) {
                    setEmojiCommandRange(null);
                    setEmojiSearchQuery('');
                    setEmojiPickerOpen(false);
                  }
                }}
                onKeyDown={handleEmojiPickerKeyDown}
                placeholder={messageInputFocused ? '' : t('quickPlanner.messagePlaceholder')}
              />
              <span id="quick-planner-counter" className="quick-planner-sr-only">
                {t('quickPlanner.characterCount', { count: message.length, limit: messageMaxLength })}
              </span>
            </div>
            <div className="quick-planner-tools-row" ref={toolsRowRef}>
              <div className="quick-planner-tools" aria-label={t('quickPlanner.tools')}>
                <div className="quick-planner-tool-anchor">
                  <button type="button" aria-label={t('quickPlanner.attachFiles')} onClick={() => attachmentInputRef.current?.click()}>
                    <Paperclip size={24} aria-hidden="true" />
                  </button>
                  <input ref={attachmentInputRef} className="quick-planner-file-input" type="file" multiple onChange={handleAttachmentChange} />
                </div>
                <div className="quick-planner-tool-anchor" ref={effectsToolRef}>
                  <button
                    className={effectPickerOpen || selectedEffectId ? 'is-active' : ''}
                    type="button"
                    aria-label={t('quickPlanner.messageEffects')}
                    aria-expanded={effectPickerOpen}
                    aria-pressed={Boolean(selectedEffectId)}
                    title={selectedEffect ? `${t('quickPlanner.messageEffects')}: ${selectedEffect.emoticon}` : t('quickPlanner.messageEffects')}
                    onClick={toggleEffectPicker}
                  ><Sparkles size={24} aria-hidden="true" /></button>
                  {effectPickerOpen && (
                    <div className="quick-planner-tool-popover quick-planner-effects-picker" role="dialog" aria-label={t('quickPlanner.messageEffects')}>
                      <div className="quick-planner-effects-heading">
                        <strong>{t('quickPlanner.messageEffect')}</strong>
                      </div>
                      <div className="quick-planner-effects-grid" role="group" aria-label={t('quickPlanner.chooseMessageEffect')}>
                        {[
                          ...availableEffects.slice(0, 3),
                          { id: null, emoticon: '−', premiumRequired: false },
                          ...availableEffects.slice(3),
                        ].map((effect) => {
                          const isSelected = effect.id === null
                            ? selectedEffectId === null
                            : selectedEffectId === effect.id;
                          const effectLabel = effect.id === null
                            ? t('quickPlanner.noEffect')
                            : t('quickPlanner.effect', { emoji: effect.emoticon });
                          return (
                            <button
                              key={effect.id ?? 'no-effect'}
                              className={`quick-planner-effect-option${isSelected ? ' is-selected' : ''}`}
                              type="button"
                              aria-label={effectLabel}
                              title={effect.id === null ? effectLabel : `${effectLabel} · ${effect.id}`}
                              aria-pressed={isSelected}
                              onClick={() => {
                                setSelectedEffectId(effect.id);
                                setEffectPickerOpen(false);
                              }}
                            >
                              <span className="quick-planner-effect-icon" aria-hidden="true">{effect.emoticon}</span>
                              {effect.id === null && <span className="quick-planner-effect-label">{effectLabel}</span>}
                            </button>
                          );
                        })}
                      </div>
                      {availableEffects.length === 0 && (
                        <p className="quick-planner-effects-empty" role="status">{t('quickPlanner.noFreeEffects')}</p>
                      )}
                    </div>
                  )}
                </div>
                <div className="quick-planner-tool-anchor" ref={emojiToolRef}>
                  <button
                    className={emojiPickerOpen ? 'is-active' : ''}
                    type="button"
                    aria-label={t('quickPlanner.openEmoji')}
                    title={t('quickPlanner.openEmojiTitle')}
                    aria-expanded={emojiPickerOpen}
                    onClick={toggleEmojiPicker}
                  ><Smile size={24} aria-hidden="true" /></button>
                  {emojiPickerOpen && createPortal(
                    <EmojiPickerPanel
                      categoryId={emojiCategoryId as 'faces' | 'hands' | 'hearts' | 'nature' | 'food' | 'fun'}
                      searchQuery={emojiSearchQuery}
                      activeIndex={emojiActiveIndex}
                      recentEmojis={recentEmojis}
                      modifierHeld={emojiModifierHeld}
                      commandMode={Boolean(emojiCommandRange)}
                      className="quick-planner-emoji-picker--floating"
                      pickerRef={emojiPickerPanelRef}
                      style={{
                        '--planner-accent': plannerAccent,
                        '--planner-accent-rgb': plannerAccentRgb,
                        '--planner-ink': 'var(--text)',
                        '--planner-dim': 'var(--dim)',
                        '--planner-line': 'var(--line)',
                      } as CSSProperties}
                      onCategoryChange={setEmojiCategoryId}
                      onSearchQueryChange={setEmojiSearchQuery}
                      onActiveIndexChange={setEmojiActiveIndex}
                      onSelectEmoji={insertEmoji}
                    />,
                    document.body,
                  )}
                </div>
                {attachments.length > 0 && (
                  <div
                    className={`quick-planner-attachments${attachmentScroll.max > 0 ? ' has-overflow' : ''}`}
                    role="group"
                    aria-label={t('quickPlanner.attachments', { count: attachments.length })}
                  >
                    <div
                      className="quick-planner-attachments-scrollbar"
                      ref={attachmentScrollbarRef}
                      role="scrollbar"
                      aria-label={t('quickPlanner.scrollAttachments')}
                      aria-controls="quick-planner-attachment-list"
                      aria-orientation="horizontal"
                      aria-valuemin={0}
                      aria-valuemax={attachmentScroll.max}
                      aria-valuenow={Math.min(attachmentScroll.position, attachmentScroll.max)}
                      tabIndex={0}
                      onKeyDown={(event) => {
                        const step = event.key === 'PageDown' || event.key === 'PageUp' ? 100 : 32;
                        const direction = event.key === 'ArrowRight' || event.key === 'PageDown' ? 1
                          : event.key === 'ArrowLeft' || event.key === 'PageUp' ? -1 : 0;
                        if (event.key === 'Home') attachmentScrollbarRef.current!.scrollLeft = 0;
                        else if (event.key === 'End') attachmentScrollbarRef.current!.scrollLeft = attachmentScroll.max;
                        else if (direction) attachmentScrollbarRef.current!.scrollLeft += direction * step;
                        else return;
                        event.preventDefault();
                      }}
                    >
                      <div className="quick-planner-attachments-scrollbar-content" style={{ width: `${attachmentScroll.contentWidth}px` }} />
                    </div>
                    <div
                      className="quick-planner-attachment-list"
                      id="quick-planner-attachment-list"
                      ref={attachmentListRef}
                      tabIndex={0}
                      onKeyDown={(event) => {
                        const list = attachmentListRef.current;
                        if (!list) return;
                        const step = event.key === 'PageDown' || event.key === 'PageUp' ? 180 : 48;
                        const direction = event.key === 'ArrowRight' || event.key === 'PageDown' ? 1
                          : event.key === 'ArrowLeft' || event.key === 'PageUp' ? -1 : 0;
                        if (event.key === 'Home') list.scrollLeft = 0;
                        else if (event.key === 'End') list.scrollLeft = list.scrollWidth;
                        else if (direction) list.scrollLeft += direction * step;
                        else return;
                        event.preventDefault();
                      }}
                    >
                      {attachments.map((attachment, index) => (
                        <div className="quick-planner-attachment" key={`${attachment.path}-${index}`}>
                          <Paperclip size={14} aria-hidden="true" />
                          <span className="quick-planner-attachment-name" title={attachment.name}>{attachment.name}</span>
                          <button
                            type="button"
                            aria-label={t('composer.removeAttachment', { name: attachment.name })}
                            title={t('composer.removeAttachment', { name: attachment.name })}
                            onClick={() => {
                              const nextAttachments = attachments.filter((_, currentIndex) => currentIndex !== index);
                              setAttachments(nextAttachments);
                              writePlannerDraft(message, readPlannerDraftEntities(), nextAttachments.map(({ path }) => path));
                              flushPlannerDraftWrite();
                            }}
                          ><X size={14} aria-hidden="true" /></button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="quick-planner-schedule-row" ref={scheduleRowRef}>
              <span className="quick-planner-label quick-planner-schedule-label">
                {isDraftMode ? t('quickPlanner.draft') : selectedMode === 'Send now' ? t('quickPlanner.sendNow') : t('quickPlanner.scheduleFor')}
              </span>
              {!isDraftMode && (
                <div className="quick-planner-schedule-field">
                  <button
                    ref={scheduleDateTriggerRef}
                    className={selectedMode === 'Send now' ? 'is-readonly' : undefined}
                    type="button"
                    aria-label={t('quickPlanner.chooseDate')}
                    aria-haspopup={selectedMode === 'Send now' ? undefined : 'dialog'}
                    aria-disabled={selectedMode === 'Send now' || undefined}
                    aria-expanded={selectedMode !== 'Send now' && activeSchedulePicker === 'date'}
                    tabIndex={selectedMode === 'Send now' ? -1 : 0}
                    onClick={selectedMode === 'Send now' ? undefined : () => {
                      setScheduleTimeDraft(null);
                      if (activeSchedulePicker !== 'date') {
                        setCalendarCursor(toLocalDateTime(selectedDate, '12:00'));
                      }
                      setActiveSchedulePicker((picker) => picker === 'date' ? null : 'date');
                    }}
                  >
                    <CalendarDays size={15} aria-hidden="true" />
                    <span>{formatDateLabel(selectedDate, locale)}</span>
                    <ChevronDown size={13} aria-hidden="true" style={{ visibility: selectedMode === 'Send now' ? 'hidden' : undefined }} />
                  </button>
                  {activeSchedulePicker === 'date' && (
                    createPortal(
                      <div
                        ref={scheduleDatePickerRef}
                        className="quick-planner-schedule-popover quick-planner-date-picker"
                        role="dialog"
                        aria-label={t('quickPlanner.scheduleDatePicker')}
                        style={{
                          position: 'fixed',
                          top: schedulePickerPosition.top,
                          left: schedulePickerPosition.left,
                          maxHeight: schedulePickerPosition.maxHeight,
                          '--planner-accent': plannerAccent,
                          '--planner-accent-rgb': plannerAccentRgb,
                        } as CSSProperties}
                      >
                        <div className="quick-planner-date-picker-header">
                          <button
                            type="button"
                            aria-label={t('quickPlanner.previousMonth')}
                            disabled={calendarMonthKey <= minimumMonthKey}
                            onClick={() => setCalendarCursor((cursor) => new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}
                          >
                            <ChevronLeft size={14} aria-hidden="true" />
                          </button>
                          <span>{calendarMonthLabel}</span>
                          <button
                            type="button"
                            aria-label={t('quickPlanner.nextMonth')}
                            onClick={() => setCalendarCursor((cursor) => new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}
                          >
                            <ChevronRight size={14} aria-hidden="true" />
                          </button>
                        </div>
                        <div className="quick-planner-date-picker-weekdays" aria-hidden="true">
                          {calendarWeekdayLabels.map((label, index) => <span key={`${label}-${index}`}>{label}</span>)}
                        </div>
                        <div className="quick-planner-date-picker-grid">
                          {Array.from({ length: calendarFirstWeekdayOffset }, (_, index) => (
                            <span key={`gap-${index}`} className="quick-planner-date-picker-gap" aria-hidden="true" />
                          ))}
                          {Array.from({ length: calendarDayCount }, (_, index) => {
                            const dayNumber = index + 1;
                            const cellValue = `${calendarYear}-${String(calendarMonth + 1).padStart(2, '0')}-${String(dayNumber).padStart(2, '0')}`;
                            const isSelected = cellValue === selectedDate;
                            const isToday = cellValue === todayScheduleDateValue;
                            const isDisabled = cellValue < minimumScheduleDateValue;
                            return (
                              <button
                                key={cellValue}
                                type="button"
                                aria-label={t('quickPlanner.chooseDay', { date: new Intl.DateTimeFormat(dateLocale, { month: 'long', day: 'numeric', year: 'numeric' }).format(new Date(calendarYear, calendarMonth, dayNumber)) })}
                                aria-pressed={isSelected}
                                className={`${isSelected ? 'is-selected' : ''}${isToday ? ' is-today' : ''}`.trim()}
                                disabled={isDisabled}
                                onClick={() => {
                                  setScheduleDateTimeWithinRange(cellValue, selectedTime);
                                  setActiveSchedulePicker(null);
                                }}
                              >{dayNumber}</button>
                            );
                          })}
                        </div>
                      </div>,
                      document.body,
                    )
                  )}
                </div>
              )}
              {!isDraftMode && (
                <div className="quick-planner-time-value">
                  <div className="quick-planner-schedule-field">
                    <button
                      ref={scheduleTimeTriggerRef}
                      className={selectedMode === 'Send now' ? 'is-readonly' : undefined}
                      type="button"
                      aria-label={t('quickPlanner.chooseTime')}
                      aria-haspopup={selectedMode === 'Send now' ? undefined : 'dialog'}
                      aria-disabled={selectedMode === 'Send now' || undefined}
                      aria-expanded={selectedMode !== 'Send now' && activeSchedulePicker === 'time'}
                      tabIndex={selectedMode === 'Send now' ? -1 : 0}
                      onClick={selectedMode === 'Send now' ? undefined : () => {
                        setActiveSchedulePicker((picker) => picker === 'time' ? null : 'time');
                        setScheduleTimeDraft(null);
                      }}
                    >
                      <Clock3 size={15} aria-hidden="true" />
                      <span>{selectedTime}</span>
                      <ChevronDown size={13} aria-hidden="true" style={{ visibility: selectedMode === 'Send now' ? 'hidden' : undefined }} />
                    </button>
                    {activeSchedulePicker === 'time' && (
                        createPortal(
                          <div
                            ref={scheduleTimePickerRef}
                            className="quick-planner-schedule-popover quick-planner-time-picker"
                            role="dialog"
                            aria-label={t('quickPlanner.scheduleTimePicker')}
                            style={{
                              position: 'fixed',
                              top: schedulePickerPosition.top,
                              left: schedulePickerPosition.left,
                              maxHeight: schedulePickerPosition.maxHeight,
                                '--planner-accent': plannerAccent,
                                '--planner-accent-rgb': plannerAccentRgb,
                            } as CSSProperties}
                          >
                          <input
                            className="quick-planner-time-field"
                            aria-label={t('quickPlanner.enterScheduleTime')}
                            type="text"
                            inputMode="numeric"
                            autoComplete="off"
                            autoFocus
                            value={scheduleTimeDraft ?? selectedTime}
                            onChange={(event) => {
                              const parsed = parseScheduleTime(event.currentTarget.value);
                              if (parsed) {
                                setScheduleTimeDraft(null);
                                setScheduleDateTimeWithinRange(selectedDate, parsed);
                              } else {
                                setScheduleTimeDraft(event.currentTarget.value.slice(0, 5));
                              }
                            }}
                            onBlur={() => setScheduleTimeDraft(null)}
                            onKeyDown={(event) => {
                              if (event.key !== 'Enter') return;
                              event.preventDefault();
                              const parsed = parseScheduleTime(event.currentTarget.value);
                              if (!parsed) return;
                              setScheduleTimeDraft(null);
                              setScheduleDateTimeWithinRange(selectedDate, parsed);
                              setActiveSchedulePicker(null);
                            }}
                          />
                          <div className="quick-planner-time-list" role="listbox" aria-label={t('quickPlanner.availableTimes')}>
                            {scheduleTimeOptions.map((option) => {
                              const isSelected = option === selectedTime;
                              const isPast = selectedDate < minimumScheduleDateValue
                                || (selectedDate === minimumScheduleDateValue && option < minimumScheduleTimeValue);
                              return (
                                <button
                                  key={option}
                                  type="button"
                                  role="option"
                                  aria-selected={isSelected}
                                  disabled={isPast}
                                  onClick={() => {
                                    setScheduleTimeDraft(null);
                                    setScheduleDateTimeWithinRange(selectedDate, option);
                                    setActiveSchedulePicker(null);
                                  }}
                                >{option}</button>
                              );
                            })}
                          </div>
                          </div>,
                          document.body,
                        )
                    )}
                  </div>
                </div>
              )}
              {isScheduleMode && (
                <div className="quick-planner-presets" role="group" aria-label={t('quickPlanner.quickScheduleTimes')}>
                  <button type="button" onClick={() => applyQuickTime('now')}>{t('quickPlanner.now')}</button>
                  <button type="button" onClick={() => applyQuickTime('30min')}>{t('quickPlanner.in30Minutes')}</button>
                  <button type="button" onClick={() => applyQuickTime('tomorrow')}>{t('quickPlanner.tomorrow')}</button>
                </div>
              )}
              {!isDraftMode && (
                <div className="quick-planner-submit-group">
                  <span className={`quick-planner-timezone${isScheduleMode ? '' : ' is-no-presets'}`}>{timeZoneLabel}</span>
                  <button className="quick-planner-submit" type="button" onClick={handleSubmit}>
                    <SubmitIcon size={16} aria-hidden="true" />
                    <span>{submitLabel}</span>
                  </button>
                </div>
              )}
              {isDraftMode && (
                <div className="quick-planner-draft-actions">
                  <button className="quick-planner-open-studio" type="button" onClick={handleOpenInStudio}>
                    <ArrowUpRight size={15} aria-hidden="true" />
                    <span>{t('quickPlanner.openInStudio')}</span>
                  </button>
                  <button className="quick-planner-submit" type="button" onClick={handleSubmit}>
                    <SubmitIcon size={16} aria-hidden="true" />
                    <span>{submitLabel}</span>
                  </button>
                </div>
              )}
            </div>

            <div className="quick-planner-compose-footer">
              {visibleActionFeedback && (
                <div
                  key={feedbackPreview
                    ? `${feedbackPreview.tone}:${feedbackPreview.message}:${feedbackPreview.instance ?? 0}`
                    : actionFeedbackInstance}
                  className={`planner-inline-notification quick-planner-action-feedback is-${visibleActionFeedback.tone}${visibleActionFeedback.actions?.length ? ' has-actions' : ''}${(feedbackPreview ? (feedbackPreview.instance ?? 0) > 0 : actionFeedbackRetriggered) ? ' is-retriggered' : ''}`}
                  role={visibleActionFeedback.tone === 'error' ? 'alert' : 'status'}
                  aria-live={visibleActionFeedback.tone === 'error' ? 'assertive' : 'polite'}
                  aria-atomic="true"
                  title={visibleActionFeedback.message}
                >
                  <span className="quick-planner-action-feedback-message">{visibleActionFeedback.message}</span>
                  {visibleActionFeedback.actions?.map((action) => (
                    <button
                      key={action.id}
                      type="button"
                      className={`quick-planner-feedback-action is-${action.id}`}
                      aria-label={action.label}
                      title={action.label}
                      onClick={action.onClick}
                    >
                      {action.id === 'retry'
                        ? <RotateCcw size={14} aria-hidden="true" />
                        : <X size={14} aria-hidden="true" />}
                      {action.id === 'retry' && <span>{action.label}</span>}
                    </button>
                  ))}
                </div>
              )}
              {!visibleActionFeedback && connectionRecoveryNoticeStatus && (
                <div
                  className={`planner-inline-notification quick-planner-action-feedback is-connection-status is-${connectionRecoveryNoticeStatus === 'offline' ? 'error' : connectionRecoveryNoticeStatus === 'restored' ? 'success' : 'info'}`}
                  role="status"
                  aria-live="polite"
                  aria-atomic="true"
                >
                  {connectionRecoveryNoticeStatus === 'reconnecting' && (
                    <span className="quick-planner-connection-spinner" aria-hidden="true" />
                  )}
                  <span className="quick-planner-action-feedback-message">
                    {t(
                      connectionRecoveryNoticeStatus === 'offline'
                        ? 'telegramStatus.offlineMessage'
                        : connectionRecoveryNoticeStatus === 'restored'
                          ? 'telegramStatus.restoredMessage'
                          : 'telegramStatus.networkMessage',
                    )}
                  </span>
                </div>
              )}
            </div>

          </section>

          <aside className="quick-planner-activity" aria-label={t('quickPlanner.activityUpcoming')}>
            <QuickPlannerActivity
              sent={sent}
              upcoming={upcoming}
              historyReady={historyReady}
              historyError={historyError}
            />
            <section className="quick-planner-upcoming-section" aria-labelledby="quick-planner-upcoming-heading" hidden>
              <div className="quick-planner-activity-header">
                <h2 id="quick-planner-upcoming-heading">{t('quickPlanner.upcoming')}</h2>
              </div>
              {historyError ? (
                <p className="quick-planner-activity-state is-error">{t('quickPlanner.historyError')}</p>
              ) : !historyReady ? (
                <p className="quick-planner-activity-state">{t('quickPlanner.loadingUpcoming')}</p>
              ) : upcomingMessages.length === 0 ? (
                <p className="quick-planner-activity-state">{t('quickPlanner.emptyUpcoming')}</p>
              ) : (
                <ul className="quick-planner-upcoming-list">
                  {upcomingMessages.map((scheduledMessage) => {
                    const scheduledDate = new Date(scheduledMessage.when);
                    const preview = scheduledMessage.text.trim()
                      || (scheduledMessage.attachments?.length
                        ? t('quickPlanner.mediaMessage')
                        : t('quickPlanner.emptyTextMessage'));
                    return (
                      <li className="quick-planner-upcoming-item" key={scheduledMessage.id}>
                        <time
                          dateTime={scheduledMessage.when}
                          title={new Intl.DateTimeFormat(dateLocale, {
                            weekday: 'long',
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          }).format(scheduledDate)}
                        >
                          {new Intl.DateTimeFormat(dateLocale, {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          }).format(scheduledDate)}
                        </time>
                        <strong title={scheduledMessage.chatName}>{scheduledMessage.chatName}</strong>
                        <span title={preview}>{preview}</span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          </aside>
        </div>

      </div>
  </main>
);
}
