import { useState, useRef } from 'react'
import { fmt, genId } from '../utils/helpers'

export default function PaymentModal({ total, tableNum, onConfirm, onCancel }) {
  const [method, setMethod] = useState('cash')
  const [cash, setCash]     = useState('')
  const change  = method === 'cash' && cash ? Math.max(0, parseFloat(cash) - total) : 0
  const orderId = useRef(genId()).current

  return (
    <div className="modal-bg" onClick={e => e.target === e.currentTarget && onCancel()}>
      <div className="modal">
        <div className="modal-title">💳 Ödəniş — Masa {tableNum}</div>
        <div className="modal-amount">{fmt(total)}</div>

        <div className="pay-methods">
          {[
            { k: 'cash', icon: '💵', label: 'Nağd' },
            { k: 'card', icon: '💳', label: 'Kart' },
            { k: 'qr',   icon: '📱', label: 'QR'   },
          ].map(m => (
            <div key={m.k} className={`pay-method${method === m.k ? ' active' : ''}`}
              onClick={() => setMethod(m.k)}>
              <span className="pay-icon">{m.icon}</span>{m.label}
            </div>
          ))}
        </div>

        {method === 'cash' && <>
          <div className="cash-input-row">
            <label>Verilən məbləğ:</label>
            <input className="cash-input" type="number" placeholder="0.00"
              value={cash} onChange={e => setCash(e.target.value)} autoFocus />
          </div>
          {cash && parseFloat(cash) >= total && (
            <div className="change-row">
              <span className="change-label">💰 Qaytarılacaq</span>
              <span className="change-val">{fmt(change)}</span>
            </div>
          )}
        </>}

        {method === 'card' && (
          <div style={{ textAlign: 'center', padding: '14px 0', color: 'var(--gray)', fontSize: '12px' }}>
            🔄 Kart terminal aktivdir
          </div>
        )}
        {method === 'qr' && (
          <div style={{ textAlign: 'center', padding: '14px 0', color: 'var(--gray)', fontSize: '12px' }}>
            📱 QR kod göndərildi
          </div>
        )}

        <div className="modal-btns">
          <button className="btn-cancel" onClick={onCancel}>Ləğv et</button>
          <button className="btn-confirm"
            style={{ opacity: method === 'cash' && cash && parseFloat(cash) < total ? .5 : 1 }}
            onClick={() => {
              if (method === 'cash' && cash && parseFloat(cash) < total) return
              onConfirm(method, parseFloat(cash) || total, orderId)
            }}>
            ✓ Ödənişi Tamamla
          </button>
        </div>
      </div>
    </div>
  )
}
