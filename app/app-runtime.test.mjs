import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import appRuntime from './app-runtime.cjs';

const { resolveRuntimePaths } = appRuntime;

describe('resolveRuntimePaths', () => {
  it('uses one development profile with or without the Vite server and isolates packaged data', () => {
    const localAppData = fs.mkdtempSync(path.join(os.tmpdir(), 'xmsgi-runtime-'));

    try {
      const app = {
        getPath: () => localAppData,
        isPackaged: false
      };

      expect(resolveRuntimePaths(app, { LOCALAPPDATA: localAppData }).writableAppDataRoot)
        .toBe(path.join(localAppData, 'XMSGi-Workspace-Agent'));
      expect(resolveRuntimePaths(app, {
        LOCALAPPDATA: localAppData,
        ELECTRON_DEV_SERVER: '1',
      }).writableAppDataRoot)
        .toBe(path.join(localAppData, 'XMSGi-Workspace-Agent'));
      expect(resolveRuntimePaths({ ...app, isPackaged: true }, { LOCALAPPDATA: localAppData }).writableAppDataRoot)
        .toBe(path.join(localAppData, 'XMSGi'));
      expect(resolveRuntimePaths(app, {
        LOCALAPPDATA: localAppData,
        XMSGI_STUDIO_USER_DATA_DIR: path.join(localAppData, 'custom-profile'),
      }).writableAppDataRoot)
        .toBe(path.join(localAppData, 'custom-profile'));
    } finally {
      fs.rmSync(localAppData, { recursive: true, force: true });
    }
  });
});
