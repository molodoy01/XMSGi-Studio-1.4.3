import { useLayoutEffect, useState } from 'react';
import { formatHistoryDayLabel, getHistoryTimestamp, type HistoryTranslate } from './historyPresentation';
import type { HistoryItem } from './historyModel';

export function useHistoryStickyDateLabel({
  pageMode,
  records,
  locale,
  t,
  listRef,
}: {
  pageMode: boolean;
  records: HistoryItem[];
  locale: 'ru' | 'en';
  t: HistoryTranslate;
  listRef: { current: HTMLDivElement | null };
}) {
  const [stickyDateLabel, setStickyDateLabel] = useState('');

  useLayoutEffect(() => {
    const firstRecord = records[0];
    setStickyDateLabel(firstRecord
      ? formatHistoryDayLabel(getHistoryTimestamp(firstRecord), locale, t)
      : '');
  }, [locale, records, t]);

  const updateStickyDateLabel = () => {
    if (!pageMode) return;
    const list = listRef.current;
    if (!list) return;

    const listBounds = list.getBoundingClientRect();
    const visibleTop = listBounds.top + list.clientTop;
    const visibleRecord = Array.from(list.querySelectorAll<HTMLElement>('.history-record'))
      .find((record) => record.getBoundingClientRect().bottom > visibleTop);
    const dayLabel = visibleRecord?.dataset.historyDayLabel;

    if (dayLabel) setStickyDateLabel(dayLabel);
  };

  return { stickyDateLabel, updateStickyDateLabel };
}
