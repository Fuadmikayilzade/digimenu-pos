const { app, BrowserWindow, Menu, dialog, ipcMain } = require('electron')
const path = require('path')
const { autoUpdater } = require('electron-updater')

// ⚠️ "Mətbəx rejimi": tətbiq --kitchen bayrağı ilə açılsa (qısayolda
// təyin edilir), avtomatik olaraq mətbəx ekranına keçir və tam ekran
// (kiosk) rejimində qalır — ayrıca bir "mətbəx ekranı" quraşdırmasına
// ehtiyac yoxdur, EYNİ .exe həm kassa, həm mətbəx üçün işlədilir:
const isKitchenMode = process.argv.includes('--kitchen')

let mainWindow

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 640,
    fullscreen: isKitchenMode, // mətbəx rejimində avtomatik tam ekran
    icon: path.join(__dirname, 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    title: isKitchenMode ? 'DigiMenu POS — Mətbəx' : 'DigiMenu POS',
  })

  // Menyu çubuğunu sadələşdiririk (real POS-da lazımsız "File/Edit" və s. olmasın):
  Menu.setApplicationMenu(null)

  const indexPath = path.join(__dirname, '..', 'dist', 'index.html')
  const url = isKitchenMode
    ? `file://${indexPath}?view=kitchen`
    : `file://${indexPath}`
  mainWindow.loadURL(url)

  // Şəbəkə kəsiləndə/xəta olanda ağ boş ekran əvəzinə aydın mesaj:
  mainWindow.webContents.on('did-fail-load', () => {
    dialog.showErrorBox(
      'Bağlantı xətası',
      'DigiMenu POS internetə qoşula bilmədi. Şəbəkə bağlantınızı yoxlayıb tətbiqi yenidən açın.'
    )
  })
}

app.whenReady().then(() => {
  createWindow()

  // ⚠️ AVTOMATİK YENİLƆNMƆ: tətbiq açılan kimi yeni versiya olub-olmadığını
  // yoxlayır. Tapılarsa arxa planda yükləyir, hazır olanda istifadəçidən
  // "indi yenidən başladım" təsdiqi alır (işin ortasında sürprizlə
  // yenidən başlamasın deyə):
  autoUpdater.checkForUpdatesAndNotify()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

// ── Avtomatik yenilənmə hadisələri ─────────────────────────────────
autoUpdater.on('update-downloaded', () => {
  dialog.showMessageBox({
    type: 'info',
    title: 'Yeni versiya hazırdır',
    message: 'DigiMenu POS-un yeni versiyası endirildi. İndi tətbiqi yenidən başladıb quraşdırmaq istəyirsiniz?',
    buttons: ['İndi yenidən başlat', 'Sonra (bağlananda quraşdırılacaq)'],
  }).then((result) => {
    if (result.response === 0) autoUpdater.quitAndInstall()
  })
})

autoUpdater.on('error', (err) => {
  console.error('Avtomatik yenilənmə xətası:', err)
})

// Renderer prosesindən (React tərəfindən) "yenilənməni yoxla" çağırışı üçün:
ipcMain.handle('check-for-updates', () => autoUpdater.checkForUpdatesAndNotify())
ipcMain.handle('get-app-version', () => app.getVersion())