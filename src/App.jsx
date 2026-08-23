import { useState, useEffect } from 'react'
import { AppProvider, useApp } from './context/AppContext'
import LoginScreen from './components/LoginScreen'
import Topbar from './components/Topbar'
import ToastContainer from './components/ToastContainer'
import PaymentModal from './components/PaymentModal'
import ReceiptModal from './components/ReceiptModal'
import ConfirmDialog from './components/ConfirmDialog'
import POSPage from './pages/POSPage'
import KitchenPage from './pages/KitchenPage'
import OrdersPage from './pages/OrdersPage'
import DashboardPage from './pages/DashboardPage'
import ReportsPage from './pages/ReportsPage'
import TableMapPage from './pages/TableMapPage'
import StaffGuard from './components/StaffGuard'
import PinLock, { isLockedOnLoad, saveLockState } from './components/PinLock'
import './styles/global.css'

function POS() {
  const [locked, setLocked] = useState(() => isLockedOnLoad())
  const {
    user, handleLogin,
    view,
    showPayment, setShowPayment, cartTotal, amountDueNow, activeTable, confirmPayment,
    showReceipt, setShowReceipt,
    confirmDel, setConfirmDel, doDelete,
    toasts,
  } = useApp()

  // ⚠️ KRİTİK DÜZƆLİŞ: bu taymer ƏVVƆLLƆR `user`-dən ASILI OLMADAN
  // işə düşürdü — yəni giriş/qeydiyyat ekranında olarkən BELƆ 30
  // saniyə hərəkətsizlikdən sonra sistem "kilidlənirdi" (PIN ekranı
  // göstərilirdi), halbuki hələ heç kim giriş etməmişdi. İndi YALNIZ
  // `user` mövcuddursa (yəni giriş edilibsə) işə düşür. Üstəlik şərh
  // "5 dəqiqə" deyirdi, amma kod səhvən 30 saniyə (`30 * 1000`) yazmışdı
  // — bu da düzəldildi, indi HƆQİQİ 5 dəqiqədir:
  useEffect(() => {
    if (!user) return
    let timer
    const reset = () => {
      clearTimeout(timer)
      timer = setTimeout(() => setLocked(true), 30 * 1000)
    }
    const events = ['mousedown', 'keydown', 'touchstart']
    events.forEach(e => window.addEventListener(e, reset))
    reset()
    return () => {
      clearTimeout(timer)
      events.forEach(e => window.removeEventListener(e, reset))
    }
  }, [user])

  useEffect(() => {
    window.__posLock = () => { setLocked(true); saveLockState(true) }
    return () => { window.__posLock = null }
  }, [])

  // ⚠️ `user &&` əlavə edildi — əvvəllər localStorage-da qalan köhnə
  // "kilidli" vəziyyət (`isLockedOnLoad()`) giriş edilməzdən ƏVVƆL də
  // PIN ekranını göstərə bilirdi:
  if (locked && user) return <PinLock onUnlock={() => { setLocked(false) }} />

  if (!user) return <LoginScreen onLogin={handleLogin} />

  return (
    <>
      <div className="pos">
        <Topbar />
        {view === 'pos'       && <POSPage />}
        {view === 'kitchen'   && <KitchenPage />}
        {view === 'orders'    && <OrdersPage />}
        {view === 'dashboard' && <DashboardPage />}
        {view === 'reports'   && <ReportsPage />}
        {view === 'tablemap'  && <TableMapPage />}
      </div>

      {showPayment && (
        <PaymentModal
          total={amountDueNow}
          tableNum={activeTable}
          onConfirm={confirmPayment}
          onCancel={() => setShowPayment(false)}
        />
      )}
      {showReceipt && (
        <ReceiptModal receipt={showReceipt} onClose={() => setShowReceipt(null)} />
      )}
      {confirmDel && (
        <ConfirmDialog
          msg={`"${confirmDel}" nömrəli çek silinsin? Bu əməliyyat geri alına bilməz.`}
          onYes={doDelete}
          onNo={() => setConfirmDel(null)}
        />
      )}
      <ToastContainer toasts={toasts} />
    </>
  )
}

export default function App() {
  return (
    <AppProvider>
      <StaffGuard />
      <POS />
    </AppProvider>
  )
}