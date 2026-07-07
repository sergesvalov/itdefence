// Electron main process — CommonJS (Electron не поддерживает ESM в main)
'use strict';

const { app, BrowserWindow, protocol } = require('electron');
const path = require('path');

// Безопасность: запрещаем навигацию вовне
app.on('web-contents-created', (_event, contents) => {
  contents.on('will-navigate', (event, url) => {
    if (!url.startsWith('file://')) {
      event.preventDefault();
    }
  });
});

function createWindow() {
  const win = new BrowserWindow({
    width:  1024,
    height: 700,
    title:  'Office TD – Enikey Defense',
    // Отключаем меню для игры
    autoHideMenuBar: true,
    webPreferences: {
      // Контекстная изоляция включена (безопасность)
      contextIsolation: true,
      nodeIntegration:  false,
    },
  });

  // В продакшне загружаем из dist/, в разработке — с vite-сервера
  const isDev = !app.isPackaged;
  if (isDev) {
    win.loadURL('http://localhost:5173');
    win.webContents.openDevTools();
  } else {
    win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }
}

app.whenReady().then(() => {
  // Нужен для корректной загрузки ассетов через file://
  protocol.registerFileProtocol('file', (request, callback) => {
    const filePath = request.url.replace('file://', '');
    callback({ path: decodeURIComponent(filePath) });
  });

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  // На macOS приложения живут без открытых окон
  if (process.platform !== 'darwin') app.quit();
});
