import { useState, useEffect } from 'react'

export default function KitchenCard({ ticket, onUpdate, onReady }) {
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    const id = setInterval(() => setElapsed(Math.floor((Date.now() - ticket.created) / 1000)), 1000)
    return () => clearInterval(id)
  }, [ticket.created])

  const mins   = Math.floor(elapsed / 60)
  const secs   = elapsed % 60
  const isLate = elapsed > 600

  const toggleDone = (i) => {
    const items = ticket.items.map((it, ix) => ix === i ? { ...it, done: !it.done } : it)
    onUpdate(ticket.id, { ...ticket, items, status: items.every(i => i.done) ? 'ready' : 'cooking' })
  }

  return (
    <div className="kitchen-card">
      <div className="kc-header">
        <span className="kc-table">Masa {ticket.table}</span>
        <div style={{ display: 'flex', gap: 7, alignItems: 'center' }}>
          <span className="kc-time" style={{ color: isLate ? 'var(--red)' : 'var(--amber)' }}>
            ⏱ {mins}:{secs.toString().padStart(2, '0')}
          </span>
          <div className={`kc-status ${ticket.status}`}>
            <span className="kc-pulse" />
            {ticket.status === 'new' ? 'YENİ' : ticket.status === 'cooking' ? 'HAZIRLANIR' : 'HAZIR'}
          </div>
        </div>
      </div>

      <div className="kc-items">
        {ticket.items.map((it, i) => (
          <div key={i} className="kc-item">
            <span className="kc-qty">{it.qty}×</span>
            <span className="kc-name" style={{
              textDecoration: it.done ? 'line-through' : 'none',
              color: it.done ? 'var(--gray2)' : 'var(--white)',
            }}>{it.name}</span>
            <div className={`kc-done${it.done ? ' checked' : ''}`} onClick={() => toggleDone(i)}>
              {it.done ? '✓' : ''}
            </div>
          </div>
        ))}
      </div>

      <div className="kc-footer">
        <span className="kc-note">{ticket.note}</span>
        <button className="kc-ready-btn" onClick={() => onReady(ticket.id)}>✓ Hazır</button>
      </div>
    </div>
  )
}
