function registerAppIpcHandlers({
  ipcMain,
  assertTrustedRenderer,
  getMainWindow,
  getRendererFileUrl,
  nativeTheme,
  readChats,
  writeChats,
  CHAT_STORAGE_PATH,
}) {
  function getTrustedWindowControlTarget(event) {
    const mainWindow = getMainWindow();
    assertTrustedRenderer(event, mainWindow?.webContents, getRendererFileUrl());
    if (!mainWindow || mainWindow.isDestroyed()) {
      throw new Error('The application window is not available.');
    }
    return mainWindow;
  }

  ipcMain.handle('app:set-color-theme', (event, theme) => {
    assertTrustedRenderer(
      event,
      getMainWindow()?.webContents,
      getRendererFileUrl()
    );
    if (theme !== 'light' && theme !== 'dark') {
      throw new TypeError('Color theme must be light or dark.');
    }

    nativeTheme.themeSource = theme;
    const mainWindow = getMainWindow();
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.setBackgroundColor(theme === 'dark' ? '#0e1317' : '#f7f8fa');
    }
    return { success: true };
  });



  ipcMain.handle('app:window-minimize', (event) => {
    getTrustedWindowControlTarget(event).minimize();
  });

  ipcMain.handle('app:window-toggle-maximize', (event) => {
    const window = getTrustedWindowControlTarget(event);
    if (window.isMaximized()) {
      window.unmaximize();
    } else {
      window.maximize();
    }
    return window.isMaximized();
  });

  ipcMain.handle('app:window-close', (event) => {
    getTrustedWindowControlTarget(event).close();
  });

  ipcMain.handle('app:window-is-maximized', (event) => (
    getTrustedWindowControlTarget(event).isMaximized()
  ));

  ipcMain.handle('app:window-is-full-screen', (event) => (
    getTrustedWindowControlTarget(event).isFullScreen()
  ));

  ipcMain.handle('chat-storage-load', async (event) => {
    assertTrustedRenderer(
      event,
      getMainWindow()?.webContents,
      getRendererFileUrl()
    );
    return readChats(CHAT_STORAGE_PATH);
  });

  ipcMain.handle('chat-storage-save', async (event, chats) => {
    assertTrustedRenderer(
      event,
      getMainWindow()?.webContents,
      getRendererFileUrl()
    );
    try {
      writeChats(CHAT_STORAGE_PATH, chats);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Saved chats could not be written.',
      };
    }
  });

}

module.exports = { registerAppIpcHandlers };
