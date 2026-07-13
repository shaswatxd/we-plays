const { app, BrowserWindow, ipcMain, globalShortcut, dialog, protocol, nativeImage, Menu, MenuItem } = require('electron');
const path = require('path');
const Store = require('electron-store');
const { initDatabase } = require('./library');
const { setupIpcHandlers, backfillMissingDurations } = require('./ipc-handlers');
const { createTray, destroyTray, updatePlayState } = require('./tray-manager');

protocol.registerSchemesAsPrivileged([
  { scheme: 'local-media', privileges: { standard: true, secure: true, supportFetchAPI: true, bypassCSP: true, corsEnabled: true } }
]);

let mainWindow;
let isQuitting = false;
const store = new Store();

const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    frame: false,
    titleBarStyle: 'hidden',
    backgroundColor: '#0A0A0F',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    },
    icon: path.join(__dirname, '../../assets/icons/icon.png'),
    show: false
  });

  const isDev = process.env.NODE_ENV === 'development';

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../../dist/index.html'));
  }

  mainWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
    console.log(`[Renderer] ${message}`);
  });

  // Context menu handler for input fields and text selection
  mainWindow.webContents.on('context-menu', (event, params) => {
    const menu = new Menu();

    if (params.isEditable) {
      menu.append(new MenuItem({ label: 'Cut', role: 'cut' }));
      menu.append(new MenuItem({ label: 'Copy', role: 'copy' }));
      menu.append(new MenuItem({ label: 'Paste', role: 'paste' }));
      menu.append(new MenuItem({ type: 'separator' }));
      menu.append(new MenuItem({ label: 'Select All', role: 'selectall' }));
      menu.popup(mainWindow);
    } else if (params.selectionText && params.selectionText.trim() !== '') {
      menu.append(new MenuItem({ label: 'Copy', role: 'copy' }));
      menu.popup(mainWindow);
    }
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.on('close', (e) => {
    if (!isQuitting) {
      e.preventDefault();
      mainWindow.hide();
    }
  });

  registerGlobalShortcuts();

  // Create the system tray with animated circular icon
  createTray(mainWindow, () => { isQuitting = true; });

  // IPC handler for renderer to sync play state with tray
  ipcMain.on('update-tray-play-state', (event, data) => {
    updatePlayState(data.isPlaying, data.songInfo);
  });
}

function registerGlobalShortcuts() {
  globalShortcut.register('MediaPlayPause', () => {
    mainWindow.webContents.send('player-toggle-play');
  });
  globalShortcut.register('MediaNextTrack', () => {
    mainWindow.webContents.send('player-next');
  });
  globalShortcut.register('MediaPreviousTrack', () => {
    mainWindow.webContents.send('player-previous');
  });
}

app.whenReady().then(async () => {
  protocol.registerFileProtocol('local-media', (request, callback) => {
    try {
      let filePath = decodeURIComponent(request.url.replace(/^local-media:\/\/local-file\//, ''));
      // Remove leading slash from Windows drive-letter paths (e.g. /C:/...)
      if (process.platform === 'win32' && /^\/[a-zA-Z]:\//.test(filePath)) {
        filePath = filePath.substring(1);
      }
      filePath = path.normalize(filePath);
      callback({ path: filePath });
    } catch (error) {
      console.error('Local media protocol error:', error);
      callback({ error: -6 });
    }
  });

  app.userAgentFallback = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
  await initDatabase();
  createWindow();
  setupIpcHandlers(mainWindow, store, () => { isQuitting = true; });

  backfillMissingDurations().then(() => {
    mainWindow?.webContents.send('library-changed');
  }).catch(() => {});

  // Auto-clear the HTTP web cache so it never piles up. Only clearCache() —
  // never clearStorageData(), which would wipe localStorage app state.
  const clearWebCache = () => {
    const { session } = require('electron');
    session.defaultSession?.clearCache().catch(() => {});
  };
  setTimeout(clearWebCache, 60 * 1000);            // once after startup settles
  setInterval(clearWebCache, 6 * 60 * 60 * 1000);  // then every 6 hours

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  // Don't quit — tray keeps the app alive
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
  destroyTray();
});

module.exports = { mainWindow };
