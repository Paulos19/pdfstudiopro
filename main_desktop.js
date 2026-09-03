const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

// Start backend server internally
let serverProcess = null;
const SERVER_PORT = process.env.PORT || 3000;

function startServer() {
    try {
        // Start server in-process or via require
        require('./src/server/app.js');
        console.log('[Desktop] Servidor interno Node.js iniciado na porta ' + SERVER_PORT);
    } catch (e) {
        console.error('[Desktop] Erro ao iniciar servidor embutido:', e);
    }
}

function createWindow() {
    const mainWindow = new BrowserWindow({
        width: 1400,
        height: 900,
        minWidth: 1024,
        minHeight: 700,
        backgroundColor: '#0B0F17',
        title: 'PDF Studio Pro',
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js')
        }
    });

    // Remove default native menu for sleek studio look (or keep keyboard shortcuts)
    mainWindow.setMenuBarVisibility(false);

    // Load web UI served locally
    mainWindow.loadURL(`http://localhost:${SERVER_PORT}`);

    mainWindow.webContents.on('did-fail-load', () => {
        setTimeout(() => {
            mainWindow.loadURL(`http://localhost:${SERVER_PORT}`);
        }, 1000);
    });

    // Check if opened with a PDF file from Windows Explorer (Open With...)
    const args = process.argv;
    if (args.length >= 2) {
        const potentialPdf = args[args.length - 1];
        if (potentialPdf && potentialPdf.endsWith('.pdf') && fs.existsSync(potentialPdf)) {
            mainWindow.webContents.once('did-finish-load', () => {
                mainWindow.webContents.send('open-external-pdf', potentialPdf);
            });
        }
    }
}

app.whenReady().then(() => {
    startServer();
    setTimeout(createWindow, 600);

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});
