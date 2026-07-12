import { app, BrowserWindow, shell } from 'electron';
import fs from 'fs';
import path from 'path';
import { mainDirname } from '../appPaths';

const isDev = !app.isPackaged;

function resolvePreloadPath(): string {
  const dir = path.join(mainDirname, '../preload');
  for (const file of ['preload.cjs', 'preload.mjs', 'preload.js']) {
    const candidate = path.join(dir, file);
    if (fs.existsSync(candidate)) return candidate;
  }
  return path.join(dir, 'preload.mjs');
}

export function createMainWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: 'DeskLink',
    show: false,
    icon: isDev ? undefined : path.join(mainDirname, '../../build/icon.png'),
    webPreferences: {
      preload: resolvePreloadPath(),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  win.once('ready-to-show', () => {
    win.show();
  });

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  if (isDev) {
    const devUrl = process.env.VITE_DEV_SERVER_URL ?? 'http://localhost:5173';
    win.loadURL(devUrl);
    win.webContents.openDevTools({ mode: 'detach' });
  } else {
    win.loadFile(path.join(mainDirname, '../../dist/index.html'));
  }

  return win;
}
