const fs = require('fs');
const path = require('path');
const { resolveAppDataRoot } = require('./app-data-path.cjs');

function resolveRuntimePaths(app, env = process.env) {
  const appIconPath = process.platform === 'win32'
    ? path.join(__dirname, 'build', 'icon.ico')
    : path.join(__dirname, 'src', 'studio', 'assets', 'logo.png');

  const devServerEnabled = env.ELECTRON_DEV_SERVER === '1' || env.ELECTRON_DEV_SERVER === 'true';
  const isolatedUserDataRoot = !app.isPackaged
    ? env.XMSGI_STUDIO_USER_DATA_DIR
      || path.join(env.LOCALAPPDATA || app.getPath('appData'), 'XMSGi-Workspace-Agent')
    : null;

  const writableAppDataRoot = isolatedUserDataRoot
    ? path.resolve(isolatedUserDataRoot)
    : resolveAppDataRoot(path, env.LOCALAPPDATA || app.getPath('appData'), app.isPackaged);

  const writableCacheRoot = path.join(writableAppDataRoot, 'Cache');
  const writableTempRoot = path.join(writableAppDataRoot, 'Temp');

  fs.mkdirSync(writableAppDataRoot, { recursive: true });
  fs.mkdirSync(writableCacheRoot, { recursive: true });
  fs.mkdirSync(writableTempRoot, { recursive: true });

  return {
    appIconPath,
    devServerEnabled,
    isolatedUserDataRoot,
    writableAppDataRoot,
    writableCacheRoot,
    writableTempRoot,
  };
}

function shouldLoadProductionBuild(app, fsApi, dirName) {
  const distIndexPath = path.join(dirName, 'dist', 'index.html');
  const explicitDevMode = process.env.ELECTRON_DEV_SERVER === '1' || process.env.ELECTRON_DEV_SERVER === 'true';
  const explicitProdMode = process.env.ELECTRON_PROD_BUILD === '1' || process.env.ELECTRON_PROD_BUILD === 'true';

  if (app.isPackaged) {
    return true;
  }

  if (explicitDevMode) {
    return false;
  }

  if (explicitProdMode) {
    return true;
  }

  return fsApi.existsSync(distIndexPath);
}

function getAppUrl(app, dirName) {
  if (shouldLoadProductionBuild(app, fs, dirName)) {
    return `file://${path.join(dirName, 'dist', 'index.html')}`;
  }

  return 'http://localhost:5173';
}

module.exports = {
  resolveAppDataRoot,
  resolveRuntimePaths,
  shouldLoadProductionBuild,
  getAppUrl,
};
