import { fmt, nowDate } from '../utils/helpers'

export default function ReceiptModal({ receipt, onClose }) {
  const doPrint = () => {
    const w = window.open('', '_blank', 'width=400,height=600')
    w.document.write(`<html><head><title>Çek ${receipt.id}</title>
    <style>
      body{font-family:monospace;padding:20px;max-width:300px;margin:0 auto}
      .logo{text-align:center;font-size:16px;font-weight:800;margin-bottom:4px}
      .sub{text-align:center;font-size:11px;color:#666;margin-bottom:12px}
      .divider{border:none;border-top:1px dashed #aaa;margin:8px 0}
      .row{display:flex;justify-content:space-between;font-size:11px;padding:2px 0}
      .grand{font-size:14px;font-weight:700;padding-top:6px;border-top:1px solid #333}
      .center{text-align:center;font-size:10px;color:#888;margin-top:10px}
    </style></head><body>
    <div class="logo">DigiMenu POS</div>
    <div class="sub">Ləzzət Evi · Bakı, Azərbaycan</div>
    <div class="sub">${receipt.id} · Masa ${receipt.table} · ${receipt.time}</div>
    <hr class="divider"/>
    ${receipt.items.map(i => `<div class="row"><span>${i.qty}× ${i.name}</span><span>${(i.price * i.qty).toFixed(2)} ₼</span></div>`).join('')}
    <hr class="divider"/>
    <div class="row"><span>Ara cəm</span><span>${receipt.subtotal.toFixed(2)} ₼</span></div>
    ${receipt.discount > 0 ? `<div class="row"><span>Endirim (${receipt.discount}%)</span><span>-${(receipt.subtotal * receipt.discount / 100).toFixed(2)} ₼</span></div>` : ''}
    <div class="row"><span>ƏDV (18%)</span><span>${receipt.tax.toFixed(2)} ₼</span></div>
    <div class="row grand"><span>CƏMİ</span><span>${receipt.total.toFixed(2)} ₼</span></div>
    <hr class="divider"/>
    <div class="center">Ödəniş: ${receipt.method === 'cash' ? 'Nağd' : receipt.method === 'card' ? 'Kart' : 'QR Kod'}</div>
    ${receipt.method === 'cash' ? `<div class="center">Qaytarılan: ${(Math.max(0, receipt.cashGiven - receipt.total)).toFixed(2)} ₼</div>` : ''}
    <div class="center" style="margin-top:14px">Təşəkkür edirik! Nuş olsun 🍽</div>
    </body></html>`)
    w.document.close()
    w.print()
  }

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
