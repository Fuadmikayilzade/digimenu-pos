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
import './styles/global.css'

function POS() {
  const {
    user, handleLogin,
    view,
    showPayment, setShowPayment, cartTotal, activeTable, confirmPayment,
    showReceipt, setShowReceipt,
    confirmDel, setConfirmDel, doDelete,
    toasts,
  } = useApp()

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
      </div>

      {showPayment && (
        <PaymentModal
          total={cartTotal}
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
      <POS />
    </AppProvider>
  )
}
