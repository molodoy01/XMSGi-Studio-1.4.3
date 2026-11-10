import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const stylesDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../styles');

function readImportedStyles(directory: string, manifestFileName: string): string {
  const loadStyles = (filePath: string): string => {
    const stylesheet = readFileSync(filePath, 'utf8');
    const imports = Array.from(stylesheet.matchAll(/^@import url\(([^)]+)\);$/gm), (match) => match[1]);
    if (imports.length === 0) return stylesheet;

    return imports
      .map((fileName) => loadStyles(path.resolve(path.dirname(filePath), fileName)))
      .join('\n');
  };

  return loadStyles(path.join(directory, manifestFileName));
}

export function readGlobalStyles(): string {
  return [
    readFileSync(path.join(stylesDirectory, 'app-base.css'), 'utf8'),
    readFileSync(path.join(stylesDirectory, 'app-shell.css'), 'utf8'),
    readFileSync(path.join(stylesDirectory, 'telegram-auth.css'), 'utf8'),
    readFileSync(path.resolve(stylesDirectory, '../index.css'), 'utf8'),
    readComposerStyles(),
    readFileSync(path.join(stylesDirectory, 'chat-picker.css'), 'utf8'),
    readFileSync(path.join(stylesDirectory, 'index-tail.css'), 'utf8'),
  ].join('\n');
}

export function readSettingsStyles(): string {
  return readImportedStyles(stylesDirectory, 'settings.css');
}

export function readComposerStyles(): string {
  return readImportedStyles(stylesDirectory, 'composer.css');
}

export function readColorThemeStyles(): string {
  return readImportedStyles(stylesDirectory, 'colorThemes.css');
}

export function readHistoryStyles(): string {
  return readImportedStyles(stylesDirectory, 'history.css');
}

export function readQuickPlannerStyles(): string {
  const componentStylesDirectory = path.resolve(stylesDirectory, '../components');
  return readImportedStyles(componentStylesDirectory, 'QuickPlanner.css');
}

export function readChatPreviewStandStyles(): string {
  const componentStylesDirectory = path.resolve(stylesDirectory, '../studio/components');
  return readImportedStyles(componentStylesDirectory, 'ChatPreviewStand.css');
}

export function readWorkspacePageStyles(): string {
  const workspacePageDirectory = path.resolve(stylesDirectory, '../studio/pages');
  const loadStyles = (filePath: string): string => {
    const stylesheet = readFileSync(filePath, 'utf8');
    const imports = Array.from(stylesheet.matchAll(/^@import url\(([^)]+)\);$/gm), (match) => match[1]);
    if (imports.length === 0) return stylesheet;

    return imports
      .map((importPath) => loadStyles(path.resolve(path.dirname(filePath), importPath)))
      .join('\n');
  };

  return loadStyles(path.join(workspacePageDirectory, 'WorkspacePage.css'));
}