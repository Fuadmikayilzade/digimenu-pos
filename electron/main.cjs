const { app, BrowserWindow, Menu, dialog, ipcMain } = require('electron')
const path = require('path')
const fs = require('fs')
const { autoUpdater } = require('electron-updater')

// ⚠️ MÜVƆQQƆTİ DİAQNOSTİKA: pəncərələr bəzən görünməyə bilir (erkən
// xəta, sinxron istisna və s.) — bunun əvəzinə hər addımı bir LOG
// FAYLINA yazırıq. Bu fayl həmişə yazılır, dialoq göstərmə uğursuz
// olsa belə:
const logFilePath = path.join(app.getPath('userData'), 'update-log.txt')
function logToFile(msg) {
  try {
    const line = `[${new Date().toISOString()}] ${msg}\n`
    fs.appendFileSync(logFilePath, line)
  } catch (e) {
    // log yazıla bilmirsə belə tətbiqi çökdürmə
  }
}
logToFile('=== Tətbiq başladı ===')
logToFile('app.isPackaged: ' + app.isPackaged)
logToFile('app.getVersion(): ' + app.getVersion())

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
      // ⚠️ DÜZƆLİŞ: bura əvvəllər "preload.js" yazılmışdı, amma fayl
      // artıq "preload.cjs" adlanır (ES module/CommonJS münaqişəsi
      // düzəldilərkən adı dəyişdirilmişdi) — bu uyğunsuzluq preload
      // skriptinin SƆSSİZCƆ heç yüklənməməsinə səbəb olurdu:
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    title: isKitchenMode ? 'DigiMenu POS — Mətbəx' : 'DigiMenu POS',
  })

  // Menyu çubuğunu sadələşdiririk (real POS-da lazımsız "File/Edit" və s. olmasın):
  // ⚠️ MÜVƆQQƆTİ: tam boş menyu əvəzinə, log qovluğunu açan bir
  // düymə qoyuruq ki, diaqnostika faylını tapmaq asan olsun:
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    {
      label: 'Kömək',
      submenu: [
        {
          label: 'Diaqnostika faylını aç',
          click: () => {
            require('electron').shell.showItemInFolder(logFilePath)
          },
        },
      ],
    },
  ]))

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
  logToFile('Pəncərə yaradıldı, yenilənmə yoxlanılır...')

  // ⚠️ AVTOMATİK YENİLƆNMƆ: tətbiq açılan kimi yeni versiya olub-olmadığını
  // yoxlayır. Tapılarsa arxa planda yükləyir, hazır olanda istifadəçidən
  // "indi yenidən başladım" təsdiqi alır (işin ortasında sürprizlə
  // yenidən başlamasın deyə):
  //
  // ⚠️ try/catch ƏLAVƆ OLUNDU: heç bir hadisənin (nə "yoxlanılır", nə
  // "xəta") baş vermədiyi halda, bu, çox güman ki, SİNXRON bir istisnadır
  // — belə bir xəta `autoUpdater.on('error', ...)` handler-inə HEÇ
  // ÇATMIR, çünki o, yalnız ASİNXRON (promise-daxili) xətaları tutur:
  try {
    autoUpdater.checkForUpdatesAndNotify()
      .then((result) => {
        logToFile('checkForUpdatesAndNotify NƆTİCƆ: ' + JSON.stringify(result?.updateInfo?.version || 'nəticə yoxdur'))
      })
      .catch((err) => {
        logToFile('checkForUpdatesAndNotify PROMISE XƆTASI: ' + (err?.stack || err?.message || String(err)))
      })
  } catch (syncErr) {
    logToFile('checkForUpdatesAndNotify SİNXRON İSTİSNA: ' + (syncErr?.stack || syncErr?.message || String(syncErr)))
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

// ── Avtomatik yenilənmə hadisələri ─────────────────────────────────
// ⚠️ MÜVƆQQƆTİ DİAQNOSTİKA: hər addımı görünən etdik ki, "niyə sual
// gəlmədi" sualının cavabını tapaq. Hər şey düzgün işlədikdən sonra
// bu bildirişləri sadələşdirə bilərik (istifadəçini narahat etməsin
// deyə):
autoUpdater.on('checking-for-update', () => {
  console.log('🔄 Yenilənmə yoxlanılır...')
  logToFile('HADİSƆ: checking-for-update')
})

autoUpdater.on('update-available', (info) => {
  console.log('✅ Yeni versiya tapıldı:', info.version)
  logToFile('HADİSƆ: update-available, versiya=' + info.version)
})

autoUpdater.on('update-not-available', (info) => {
  console.log('ℹ️ Yenilənmə yoxdur, cari versiya:', info.version)
  logToFile('HADİSƆ: update-not-available, versiya=' + info.version)
  dialog.showMessageBox({
    type: 'info',
    title: 'Diaqnostika',
    message: `Yenilənmə yoxlanıldı. Cari versiya: ${app.getVersion()}. GitHub-dakı son versiya bundan yeni deyil (və ya tapılmadı).`,
  })
})

autoUpdater.on('download-progress', (progress) => {
  console.log(`⬇️ Yüklənir: ${Math.round(progress.percent)}%`)
  logToFile('HADİSƆ: download-progress ' + Math.round(progress.percent) + '%')
})

autoUpdater.on('update-downloaded', () => {
  logToFile('HADİSƆ: update-downloaded')
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
  logToFile('HADİSƆ: error — ' + (err?.stack || err?.message || String(err)))
  // ⚠️ ƏVVƆLLƆR yalnız console.error idi — paketlənmiş tətbiqdə konsol
  // görünmədiyi üçün istifadəçi (və biz) heç vaxt bu xətanı görə
  // bilmirdik. İndi görünən bir pəncərədə göstərilir:
  dialog.showMessageBox({
    type: 'error',
    title: 'Yenilənmə xətası',
    message: 'Yenilənməni yoxlayarkən xəta baş verdi:\n' + (err?.message || String(err)),
  })
})

// Renderer prosesindən (React tərəfindən) "yenilənməni yoxla" çağırışı üçün:
ipcMain.handle('check-for-updates', () => autoUpdater.checkForUpdatesAndNotify())
ipcMain.handle('get-app-version', () => app.getVersion())

// ⚠️ KRİTİK DÜZƆLİŞ: "This app does not support print preview" xətası
// brauzerdəki adi `window.open()+window.print()` üsulunun Electron-da
// düzgün işləməməsindən qaynaqlanır — Electron "uşaq" pəncərələrdə
// (window.open ilə açılanlarda) çapı tam dəstəkləmir. Bunun əvəzinə
// Electron-un ÖZ NATIVE çap API-sini (`webContents.print()`) istifadə
// edirik: gizli bir pəncərədə çekin HTML-ini yükləyib, ordan çap edirik:
ipcMain.handle('print-receipt', async (event, htmlContent) => {
  return new Promise((resolve) => {
    const printWin = new BrowserWindow({
      show: false,
      webPreferences: { contextIsolation: true, nodeIntegration: false },
    })

    printWin.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(htmlContent))

    printWin.webContents.on('did-finish-load', () => {
      printWin.webContents.print(
        { silent: false, printBackground: true, margins: { marginType: 'none' } },
        (success, errorType) => {
          if (!success && errorType !== 'cancelled') {
            console.error('Çap xətası:', errorType)
          }
          printWin.close()
          resolve({ success, errorType: errorType || null })
        }
      )
    })

    printWin.webContents.on('did-fail-load', () => {
      printWin.close()
      resolve({ success: false, errorType: 'load-failed' })
    })
  })
})