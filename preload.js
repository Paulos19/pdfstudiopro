const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    isDesktop: true,
    onOpenExternalPdf: (callback) => ipcRenderer.on('open-external-pdf', (_event, value) => callback(value))
});
