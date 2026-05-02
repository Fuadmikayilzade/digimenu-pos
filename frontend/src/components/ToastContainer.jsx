import { useApp } from '../context/AppContext'

export default function ToastContainer({ toasts }) {
  const { readyNotifs, dismissReadyNotif } = useApp()

  return (
    <>
      {/* Normal toastlar — aşağı sağ */}
      <div style={{
        position: 'fixed', bottom: 20, right: 20, zIndex: 1000,
        display: 'flex', flexDirection: 'column', gap: 7,
        pointerEvents: 'none',
      }}>
        {toasts.filter(t => t.type !== 'ready').map(t => (
          <div key={t.id} className={`toast-item ${t.type}`}>
            {t.type === 'success' ? '✓' : t.type === 'error' ? '✕' : 'ℹ'} {t.msg}
          </div>
        ))}
      </div>

      {/* Mətbəx "Hazır" bildirişləri — yuxarı sağ, klikləmək olur */}
      {readyNotifs.length > 0 && (
        <div style={{
          position: 'fixed', top: 66, right: 16, zIndex: 1000,
          display: 'flex', flexDirection: 'column', gap: 8,
          pointerEvents: 'all',
        }}>
          {readyNotifs.map(n => (
            <div key={n.id} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '10px 14px',
              background: 'rgba(255,179,0,.18)',
              border: '1px solid rgba(255,179,0,.5)',
              borderRadius: 12,
              color: 'var(--amber)',
              boxShadow: '0 4px 20px rgba(255,179,0,.2)',
              animation: 'slideInRight .25s ease',
              minWidth: 240,
            }}>
              <span style={{ fontSize: '1.4rem', flexShrink: 0 }}>🍽</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 13 }}>Masa {n.tableNum} — Hazırdır!</div>
                <div style={{ fontSize: 10, opacity: .7, marginTop: 1 }}>Mətbəx · {n.time}</div>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); dismissReadyNotif(n.id) }}
                style={{
                  background: 'rgba(255,179,0,.2)', border: '1px solid rgba(255,179,0,.3)',
                  color: 'var(--amber)', cursor: 'pointer', borderRadius: 6,
                  width: 24, height: 24, fontSize: 12, fontWeight: 700,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                }}>
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
    </>
  )
}
