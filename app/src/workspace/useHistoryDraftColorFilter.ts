import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { DRAFT_COLOR_OPTIONS } from '@studio/components/DraftColorOptions';
import type { DraftColor } from '@studio/types';
import type { HistoryItem } from './historyModel';

const SAVED_DRAFT_COLOR_FILTER_KEY = 'xmsgi_saved_draft_color_filter';
const DISMISSED_DRAFT_COLOR_AUTO_FILTER_KEY = 'xmsgi_dismissed_draft_color_auto_filter';

function loadSavedDraftColorFilter(): DraftColor | null {
  try {
    const storedColor = window.localStorage.getItem(SAVED_DRAFT_COLOR_FILTER_KEY);
    return DRAFT_COLOR_OPTIONS.find((option) => option.value === storedColor)?.value ?? null;
  } catch {
    return null;
  }
}

function loadDismissedAutoFilterSignature(): string | null {
  try {
    return window.localStorage.getItem(DISMISSED_DRAFT_COLOR_AUTO_FILTER_KEY);
  } catch {
    return null;
  }
}

export function useHistoryDraftColorFilter({
  enabled,
  ready,
  query,
  records,
}: {
  enabled: boolean;
  ready: boolean;
  query: string;
  records: HistoryItem[];
}) {
  const [selectedDraftColor, setSelectedDraftColor] = useState<DraftColor | null>(loadSavedDraftColorFilter);
  const [dismissedAutoFilterSignature, setDismissedAutoFilterSignature] = useState<string | null>(loadDismissedAutoFilterSignature);

  const draftColorCounts = useMemo(() => {
    const counts = new Map<DraftColor, number>();
    for (const record of records) {
      if (record.status !== 'draft' || !record.draftColor) continue;
      const color = record.draftColor;
      counts.set(color, (counts.get(color) ?? 0) + 1);
    }
    return counts;
  }, [records]);

  const availableColors = useMemo(
    () => DRAFT_COLOR_OPTIONS
      .filter(({ value }) => (draftColorCounts.get(value) ?? 0) > 0)
      .map(({ value }) => value),
    [draftColorCounts],
  );
  const availableColorSignature = availableColors.join(',');

  useLayoutEffect(() => {
    if (!enabled || !ready || query.trim()) return;

    if (availableColors.length > 0 && dismissedAutoFilterSignature !== null
      && dismissedAutoFilterSignature !== availableColorSignature) {
      setDismissedAutoFilterSignature(null);
    }

    if (
      availableColors.length === 1
      && dismissedAutoFilterSignature !== availableColorSignature
      && selectedDraftColor !== availableColors[0]
    ) {
      setSelectedDraftColor(availableColors[0]);
    }
  }, [availableColorSignature, availableColors, dismissedAutoFilterSignature, enabled, query, ready, selectedDraftColor]);

  useEffect(() => {
    try {
      if (selectedDraftColor) {
        window.localStorage.setItem(SAVED_DRAFT_COLOR_FILTER_KEY, selectedDraftColor);
      } else {
        window.localStorage.removeItem(SAVED_DRAFT_COLOR_FILTER_KEY);
      }
    } catch (error) {
      console.error('Failed to save the Posts draft color filter.', error);
    }
  }, [selectedDraftColor]);

  useEffect(() => {
    try {
      if (dismissedAutoFilterSignature) {
        window.localStorage.setItem(DISMISSED_DRAFT_COLOR_AUTO_FILTER_KEY, dismissedAutoFilterSignature);
      } else {
        window.localStorage.removeItem(DISMISSED_DRAFT_COLOR_AUTO_FILTER_KEY);
      }
    } catch (error) {
      console.error('Failed to save the dismissed Posts draft color filter.', error);
    }
  }, [dismissedAutoFilterSignature]);

  const toggleDraftColor = useCallback((color: DraftColor) => {
    if (selectedDraftColor === color) {
      setSelectedDraftColor(null);
      if (availableColors.length === 1) {
        setDismissedAutoFilterSignature(availableColorSignature);
      }
      return;
    }

    setDismissedAutoFilterSignature(null);
    setSelectedDraftColor(color);
  }, [availableColorSignature, availableColors.length, selectedDraftColor]);

  const clearDraftColorFilter = useCallback(() => {
    setSelectedDraftColor(null);
    if (availableColors.length === 1) {
      setDismissedAutoFilterSignature(availableColorSignature);
    }
  }, [availableColorSignature, availableColors.length]);

  const filteredRecords = useMemo(
    () => enabled && !query.trim() && selectedDraftColor
      ? records.filter((record) => record.status !== 'draft' || !record.draftColor || record.draftColor === selectedDraftColor)
      : records,
    [enabled, query, records, selectedDraftColor],
  );
  const activeDraftColor = enabled ? selectedDraftColor : null;

  return {
    selectedDraftColor: activeDraftColor,
    draftColorCounts,
    filteredRecords,
    toggleDraftColor,
    clearDraftColorFilter,
  };
}
