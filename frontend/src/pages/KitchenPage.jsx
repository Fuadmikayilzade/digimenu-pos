import { useApp } from '../context/AppContext'
import KitchenCard from '../components/KitchenCard'

export default function KitchenPage() {
  const { tickets, setTickets, toast } = useApp()

  const handleUpdate = (id, updated) => {
    setTickets(p => p.map(t => t.id === id ? updated : t))
  }

  const handleReady = (id) => {
    setTickets(p => p.map(t => {
      if (t.id !== id) return t
      return { ...t, status: 'ready', readyAt: Date.now() }
    }))
    const ticket = tickets.find(t => t.id === id)
    if (ticket) toast(`Masa ${ticket.table} hazır işarələndi ✓`, 'success')
  }

  const active = tickets.filter(t => t.status !== 'ready')
  const ready  = tickets.filter(t => t.status === 'ready')

  return (
    <div className="kitchen-view full-col">
      <div style={{
        padding: '12px 16px', borderBottom: '1px solid var(--border)',
        background: 'var(--bg2)', display: 'flex', alignItems: 'center', justifyContent: 'space-between'
      }}>
        <span style={{ fontWeight: 700, fontSize: 14 }}>🍳 Mətbəx Paneli</span>
        <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
          <span style={{ fontSize: 12, color: 'var(--gray2)' }}>
            Aktiv: <b style={{ color: 'var(--amber)' }}>{active.length}</b>
            &nbsp;·&nbsp;
            Hazır: <b style={{ color: 'var(--green)' }}>{ready.length}</b>
          </span>
          {ready.length > 0 && (
            <button
              onClick={() => setTickets(p => p.filter(t => t.status !== 'ready'))}
              style={{
                padding: '3px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600,
                background: 'rgba(0,230,118,.1)', color: 'var(--green)',
                border: '1px solid rgba(0,230,118,.25)', cursor: 'pointer'
              }}>
              ✓ Hazırları təmizlə
            </button>
          )}
        </div>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: 16 }}>
        {!tickets.length
          ? (
            <div className="kitchen-empty">
              <span style={{ fontSize: '3rem' }}>👨‍🍳</span>
              <p style={{ fontSize: '14px' }}>Hazırda mətbəxdə sifariş yoxdur</p>
            </div>
          ) : (
            <div className="kitchen-grid">
              {active.map(t => (
                <KitchenCard key={t.id} ticket={t} onUpdate={handleUpdate} onReady={handleReady} />
              ))}
              {ready.map(t => (
                <div key={t.id} style={{ opacity: .45, pointerEvents: 'none' }}>
                  <KitchenCard ticket={t} onUpdate={handleUpdate} onReady={handleReady} />
                </div>
              ))}
            </div>
          )
        }
      </div>
    </div>
  )
}
