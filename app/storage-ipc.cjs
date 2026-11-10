const { createHistoryBackup } = require('./history-export.cjs');

function registerStorageIpcHandlers({
  ipcMain,
  assertTrustedRenderer,
  getMainWindow,
  getRendererFileUrl,
  fs,
  SCHEDULE_HISTORY_PATH,
  readJsonFile,
  writeJsonFile,
  loadScheduleHistoryScope,
  normalizeScheduleMessages,
  validateScheduleHistoryStore,
  keepConfirmedSendResults,
  draftStore,
  isPersistedSavedDraft,
  normalizeDocumentHistories,
  BrowserWindow,
  dialog,
}) {
  function assertDraftStorageRenderer(event) {
    assertTrustedRenderer(
      event,
      getMainWindow()?.webContents,
      getRendererFileUrl()
    );
  }

  const DRAFT_STORE_SCHEMA_VERSION = 3;

  function normalizeDraftStoreResult(value, { migrationVersionFallback = 0, migrated = false } = {}) {
    const response = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    const raw = response.store && typeof response.store === 'object' && !Array.isArray(response.store)
      ? response.store
      : response;
    const savedDraftSource = Array.isArray(raw.savedDrafts)
      ? raw.savedDrafts
      : Array.isArray(raw.drafts)
        ? raw.drafts
        : [];
    const savedDrafts = savedDraftSource.filter(isPersistedSavedDraft);
    const migrationVersion = Number.isInteger(raw.migrationVersion)
      ? raw.migrationVersion
      : Array.isArray(raw.savedDrafts)
        ? 1
        : migrationVersionFallback;
    const store = {
      schemaVersion: Number.isInteger(raw.schemaVersion) ? raw.schemaVersion : DRAFT_STORE_SCHEMA_VERSION,
      migrationVersion,
      savedDrafts,
      workspaceDraft: raw.workspaceDraft && typeof raw.workspaceDraft === 'object' && !Array.isArray(raw.workspaceDraft)
        ? raw.workspaceDraft
        : null,
      documentHistories: normalizeDocumentHistories(raw.documentHistories),
    };

    return {
      success: response.success !== false,
      store,
      needsMigration: response.needsMigration ?? (!migrated && migrationVersion < 1),
      migrated: response.migrated ?? migrated,
      recovered: response.recovered ?? false,
      backupIndexes: Array.isArray(response.backupIndexes)
        ? response.backupIndexes
        : Array.isArray(raw.backups)
          ? raw.backups.map((_, index) => index)
          : [],
      ...(response.cancelled === true ? { cancelled: true } : {}),
      ...(typeof response.error === 'string' ? { error: response.error } : {}),
    };
  }

  const SCHEDULE_HISTORY_SCOPES = new Set(['personal', 'workspace']);
  const SCHEDULE_HISTORY_FIELDS = new Set(['upcoming', 'sent', 'snapshot']);

  ipcMain.handle('schedule-history:load', (event, scope) => {
    assertDraftStorageRenderer(event);
    if (!SCHEDULE_HISTORY_SCOPES.has(scope)) return { success: false, error: 'Schedule history scope is invalid.' };

    const exists = fs.existsSync(SCHEDULE_HISTORY_PATH);
    const store = readJsonFile(SCHEDULE_HISTORY_PATH, null);
    if (exists && (!store || typeof store !== 'object' || Array.isArray(store))) {
      return { success: false, error: 'Schedule history could not be read.' };
    }

    try {
      return loadScheduleHistoryScope(store, scope, { recoverInterrupted: true });
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Schedule history could not be read.' };
    }
  });

  ipcMain.handle('schedule-history:save', (event, data = {}) => {
    assertDraftStorageRenderer(event);
    const { scope, field, messages } = data;
    if (!SCHEDULE_HISTORY_SCOPES.has(scope) || !SCHEDULE_HISTORY_FIELDS.has(field)) {
      return { success: false, error: 'Schedule history destination is invalid.' };
    }

    try {
      const exists = fs.existsSync(SCHEDULE_HISTORY_PATH);
      const current = readJsonFile(SCHEDULE_HISTORY_PATH, null);
      if (exists && (!current || typeof current !== 'object' || Array.isArray(current))) {
        throw new Error('Existing schedule history could not be read.');
      }
      const validatedCurrent = current ? validateScheduleHistoryStore(current) : null;
      let validatedMessages = field === 'snapshot'
        ? {
          upcoming: normalizeScheduleMessages(messages?.upcoming),
          sent: normalizeScheduleMessages(messages?.sent),
        }
        : normalizeScheduleMessages(messages);
      if (Buffer.byteLength(JSON.stringify(validatedMessages), 'utf8') > 8 * 1024 * 1024) {
        throw new Error('Schedule history exceeds the supported size.');
      }
      const scopeHistory = validatedCurrent?.[scope]
        ? validatedCurrent[scope]
        : { upcoming: [], sent: [] };
      validatedMessages = keepConfirmedSendResults(scopeHistory, field, validatedMessages);
      writeJsonFile(SCHEDULE_HISTORY_PATH, {
        schemaVersion: 1,
        ...(validatedCurrent ?? {}),
        [scope]: field === 'snapshot'
          ? validatedMessages
          : { ...scopeHistory, [field]: validatedMessages },
      });
      return { success: true };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Schedule history could not be saved.' };
    }
  });

  ipcMain.handle('draft-store:load', (event) => {
    assertDraftStorageRenderer(event);
    try {
      return normalizeDraftStoreResult(draftStore.load());
    } catch (error) {
      return {
        success: false,
        backupIndexes: [],
        error: error instanceof Error ? error.message : 'Saved drafts could not be loaded.',
      };
    }
  });

  ipcMain.handle('draft-store:migrate', (event, legacy) => {
    assertDraftStorageRenderer(event);
    try {
      const existing = draftStore.load();
      const savedDrafts = new Map();
      const existingDrafts = Array.isArray(existing.savedDrafts)
        ? existing.savedDrafts
        : Array.isArray(existing.drafts)
          ? existing.drafts
          : [];
      [...existingDrafts, ...(Array.isArray(legacy?.savedDrafts) ? legacy.savedDrafts : [])]
        .filter(isPersistedSavedDraft)
        .forEach((draft) => savedDrafts.set(draft.id, draft));
      const data = draftStore.migrate({
        ...existing,
        ...(legacy && typeof legacy === 'object' ? legacy : {}),
        schemaVersion: DRAFT_STORE_SCHEMA_VERSION,
        migrationVersion: 1,
        savedDrafts: [...savedDrafts.values()],
        workspaceDraft: legacy?.workspaceDraft ?? existing.workspaceDraft ?? null,
      });

      return normalizeDraftStoreResult(data, { migrationVersionFallback: 1, migrated: true });
    } catch (error) {
      return {
        success: false,
        backupIndexes: [],
        error: error instanceof Error ? error.message : 'Saved drafts could not be migrated.',
      };
    }
  });

  ipcMain.handle('draft-store:save', async (event, data) => {
    assertDraftStorageRenderer(event);
    try {
      const normalized = normalizeDraftStoreResult(data).store;
      return { success: true, store: await draftStore.save(normalized) };
    } catch (error) {
      return { success: false, code: 'WRITE_FAILED', error: error instanceof Error ? error.message : 'Drafts could not be saved.' };
    }
  });

  ipcMain.on('draft-store:flush', (event, data) => {
    try {
      assertDraftStorageRenderer(event);
      event.returnValue = { success: true, store: draftStore.saveSync(data) };
    } catch (error) {
      event.returnValue = { success: false, code: 'WRITE_FAILED', error: error instanceof Error ? error.message : 'Drafts could not be saved before closing.' };
    }
  });

  ipcMain.handle('draft-store:restore-backup', (event, index) => {
    assertDraftStorageRenderer(event);
    try {
      return normalizeDraftStoreResult(draftStore.restoreBackup(index));
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'The draft backup could not be restored.',
      };
    }
  });

  ipcMain.handle('draft-store:copy-attachment', (event, sourcePath) => {
    assertDraftStorageRenderer(event);
    return draftStore.copyAttachment(sourcePath);
  });

  ipcMain.handle('draft-store:read-image', (event, filePath) => {
    assertDraftStorageRenderer(event);
    return draftStore.readImageDataUrl(filePath);
  });

  ipcMain.handle('draft-store:write-attachment', (event, payload) => {
    assertDraftStorageRenderer(event);
    return draftStore.writeAttachment(payload?.name, payload?.bytes);
  });

  ipcMain.handle('draft-store:export', async (event) => {
    assertDraftStorageRenderer(event);
    const owner = BrowserWindow.fromWebContents(event.sender);
    const result = await dialog.showSaveDialog(owner, {
      title: 'Export Saved Drafts',
      defaultPath: 'xmsgi-studio-drafts-backup.json',
      filters: [{ name: 'JSON backup', extensions: ['json'] }],
    });
    if (result.canceled || !result.filePath) return { success: false, cancelled: true };
    return draftStore.exportTo(result.filePath);
  });

  ipcMain.handle('draft-store:import', async (event) => {
    assertDraftStorageRenderer(event);
    const owner = BrowserWindow.fromWebContents(event.sender);
    const selection = await dialog.showOpenDialog(owner, {
      title: 'Import Saved Drafts',
      properties: ['openFile'],
      filters: [{ name: 'JSON backup', extensions: ['json'] }],
    });
    if (selection.canceled || !selection.filePaths[0]) return { success: false, cancelled: true };

    const choice = await dialog.showMessageBox(owner, {
      type: 'question',
      title: 'Import Saved Drafts',
      message: 'Choose how to import this backup.',
      detail: 'Merge keeps existing drafts and updates matching IDs. Replace overwrites the current library.',
      buttons: ['Merge', 'Replace', 'Cancel'],
      defaultId: 0,
      cancelId: 2,
    });
    if (choice.response === 2) return { success: false, cancelled: true };
    const result = draftStore.importFrom(selection.filePaths[0], choice.response === 0 ? 'merge' : 'replace');
    return normalizeDraftStoreResult(result);
  });

  ipcMain.handle('editor-text:export', async (event, payload) => {
    assertDraftStorageRenderer(event);
    const owner = BrowserWindow.fromWebContents(event.sender);
    const isStructured = payload !== null && typeof payload === 'object';
    const text = isStructured ? payload.text : payload;
    const format = isStructured && payload.format === 'json' ? 'json' : 'txt';
    const result = await dialog.showSaveDialog(owner, {
      title: 'Export editor text',
      defaultPath: format === 'json' ? 'message.json' : 'message.txt',
      filters: format === 'json'
        ? [{ name: 'JSON document', extensions: ['json'] }]
        : [{ name: 'Text document', extensions: ['txt'] }],
    });
    if (result.canceled || !result.filePath) return { success: false, cancelled: true };
    return draftStore.exportTextTo(result.filePath, text);
  });

  ipcMain.handle('history:export-backup', async (event, payload) => {
    assertDraftStorageRenderer(event);
    const owner = BrowserWindow.fromWebContents(event.sender);
    const result = await dialog.showSaveDialog(owner, {
      title: 'Export Posts with Attachments',
      defaultPath: 'xmsgi-posts-backup.zip',
      filters: [{ name: 'ZIP backup', extensions: ['zip'] }],
    });
    if (result.canceled || !result.filePath) return { success: false, cancelled: true };
    return createHistoryBackup(result.filePath, payload);
  });

  ipcMain.handle('editor-text:import', async (event) => {
    assertDraftStorageRenderer(event);
    const owner = BrowserWindow.fromWebContents(event.sender);
    const selection = await dialog.showOpenDialog(owner, {
      title: 'Import text into editor',
      properties: ['openFile'],
      filters: [{ name: 'Text document', extensions: ['txt'] }],
    });
    if (selection.canceled || !selection.filePaths[0]) return { success: false, cancelled: true };
    return draftStore.importTextFrom(selection.filePaths[0]);
  });

}

module.exports = { registerStorageIpcHandlers };
