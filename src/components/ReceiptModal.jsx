import { fmt, nowDate } from '../utils/helpers'
import { printReceipt } from '../utils/printReceipt'

export default function ReceiptModal({ receipt, onClose }) {
  const doPrint = () => printReceipt(receipt)

  return (
    <div className="modal-bg">
      <div className="receipt">
        <div className="receipt-header">
          <div className="receipt-logo">DigiMenu POS</div>
          <div className="receipt-sub">Ləzzət Evi · Bakı, Azərbaycan</div>
          <div className="receipt-id">{receipt.id} · Masa {receipt.table} · {receipt.time}</div>
        </div>
        <div className="receipt-items">
          {receipt.items.map((it, i) => (
            <div key={i} className="receipt-item">
              <span>{it.qty}× {it.name}</span>
              <span>{fmt(it.price * it.qty)}</span>
            </div>
          ))}
        </div>
        <div className="receipt-totals">
          <div className="receipt-row"><span>Ara cəm</span><span>{fmt(receipt.subtotal)}</span></div>
          {receipt.discount > 0 && (
            <div className="receipt-row">
              <span>Endirim ({receipt.discount}%)</span>
              <span>-{fmt(receipt.subtotal * receipt.discount / 100)}</span>
            </div>
          )}
          <div className="receipt-row"><span>ƏDV 18%</span><span>{fmt(receipt.tax)}</span></div>
          <div className="receipt-row grand"><span>CƏMİ</span><span>{fmt(receipt.total)}</span></div>
        </div>
        <div className="receipt-pay">
          {receipt.method === 'cash' ? '💵 Nağd' : receipt.method === 'card' ? '💳 Kart' : '📱 QR'}
          {receipt.method === 'cash' && ` · Qaytarılan: ${fmt(Math.max(0, receipt.cashGiven - receipt.total))}`}
        </div>
        <div className="receipt-footer">
          Təşəkkür edirik! Nuş olsun 🍽<br />{receipt.time} · {nowDate()}
        </div>
        <div className="receipt-btns">
          <button style={{ flex: 1, height: 36, borderRadius: 8, background: '#1E2535', border: '1px solid #2A3347', cursor: 'pointer', fontWeight: 600, fontSize: 12, color: '#8892A4' }} onClick={onClose}>Bağla</button>
          <button style={{ flex: 1, height: 36, borderRadius: 8, background: 'var(--green)', color: '#000', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 12 }} onClick={doPrint}>🖨 Çap et</button>
        </div>
      </div>
    </div>
  )
}