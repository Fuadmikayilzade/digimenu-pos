const { contextBridge, ipcRenderer } = require('electron')

// React tərəfindəki kod bu obyektə `window.electronAPI` kimi müraciət edə bilər —
// birbaşa Node.js/Electron API-larına çıxışı olmadan, təhlükəsiz şəkildə:
contextBridge.exposeInMainWorld('electronAPI', {
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  printReceipt: (htmlContent) => ipcRenderer.invoke('print-receipt', htmlContent),
  isElectron: true,
})