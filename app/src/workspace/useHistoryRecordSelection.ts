import { useEffect, useRef, type Dispatch, type SetStateAction } from 'react';
import type { HistoryItem } from './historyModel';

const HISTORY_SELECTED_RECORD_STORAGE_KEY = 'xmsgi-history-selected-record';

export function useHistoryRecordSelection({
  pageMode,
  historyDataReady,
  allHistoryRecords,
  filteredRecords,
  selectedRecord,
  setSelectedRecord,
}: {
  pageMode: boolean;
  historyDataReady: boolean;
  allHistoryRecords: HistoryItem[];
  filteredRecords: HistoryItem[];
  selectedRecord: HistoryItem | null;
  setSelectedRecord: Dispatch<SetStateAction<HistoryItem | null>>;
}) {
  const pageSelectionRestoredRef = useRef(false);

  useEffect(() => {
    if (pageMode) {
      if (!historyDataReady) return;

      if (!pageSelectionRestoredRef.current) {
        pageSelectionRestoredRef.current = true;
        try {
          const savedRecordId = window.localStorage.getItem(HISTORY_SELECTED_RECORD_STORAGE_KEY);
          const savedRecord = savedRecordId
            ? allHistoryRecords.find((record) => record.id === savedRecordId)
            : undefined;
          if (savedRecord) setSelectedRecord(savedRecord);
          else if (savedRecordId) window.localStorage.removeItem(HISTORY_SELECTED_RECORD_STORAGE_KEY);
        } catch (error) {
          console.error('Failed to restore the selected Posts record.', error);
        }
        return;
      }

      if (selectedRecord) {
        const latestRecord = allHistoryRecords.find((record) => record.id === selectedRecord.id);
        if (!latestRecord) {
          setSelectedRecord(null);
          try {
            window.localStorage.removeItem(HISTORY_SELECTED_RECORD_STORAGE_KEY);
          } catch (error) {
            console.error('Failed to clear the missing selected Posts record.', error);
          }
          return;
        }
        if (!filteredRecords.some((record) => record.id === latestRecord.id)) {
          setSelectedRecord(null);
          try {
            window.localStorage.removeItem(HISTORY_SELECTED_RECORD_STORAGE_KEY);
          } catch (error) {
            console.error('Failed to clear the filtered selected Posts record.', error);
          }
          return;
        }
        if (latestRecord !== selectedRecord) setSelectedRecord(latestRecord);
        try {
          window.localStorage.setItem(HISTORY_SELECTED_RECORD_STORAGE_KEY, selectedRecord.id);
        } catch (error) {
          console.error('Failed to save the selected Posts record.', error);
        }
      } else {
        try {
          window.localStorage.removeItem(HISTORY_SELECTED_RECORD_STORAGE_KEY);
        } catch (error) {
          console.error('Failed to clear the selected Posts record.', error);
        }
      }
      return;
    }

    if (selectedRecord && !filteredRecords.some((record) => record.id === selectedRecord.id)) {
      setSelectedRecord(null);
    }
  }, [allHistoryRecords, filteredRecords, historyDataReady, pageMode, selectedRecord, setSelectedRecord]);
}
