// ============================================================
// Ortaq çek çapı funksiyası — həm ReceiptModal-ın "Çap et" düyməsi,
// həm də onlayn ödənişdə "hamısı ödənildi" aşkarlanan kimi AVTOMATİK
// çap (PendingOrdersPanel.jsx) bunu istifadə edir.
// ============================================================

export function printReceipt(receipt) {
  const w = window.open('', '_blank', 'width=400,height=600')
  if (!w) return // pop-up bloklanıbsa sakitcə çıx (ekranda əlavə xəbərdarlıq lazım deyil)

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
  <div class="sub">${receipt.businessName || ''}</div>
  <div class="sub">${receipt.id} · Masa ${receipt.table} · ${receipt.time}</div>
  <hr class="divider"/>
  ${receipt.items.map(i => `<div class="row"><span>${i.qty}× ${i.name}</span><span>${(i.price * i.qty).toFixed(2)} ₼</span></div>`).join('')}
  <hr class="divider"/>
  <div class="row"><span>Ara cəm</span><span>${receipt.subtotal.toFixed(2)} ₼</span></div>
  ${receipt.discount > 0 ? `<div class="row"><span>Endirim (${receipt.discount}%)</span><span>-${(receipt.subtotal * receipt.discount / 100).toFixed(2)} ₼</span></div>` : ''}
  <div class="row"><span>ƏDV (18%)</span><span>${receipt.tax.toFixed(2)} ₼</span></div>
  <div class="row grand"><span>CƏMİ</span><span>${receipt.total.toFixed(2)} ₼</span></div>
  <hr class="divider"/>
  <div class="center">Ödəniş: ${receipt.method === 'cash' ? 'Nağd' : receipt.method === 'card' ? 'Kart' : receipt.method === 'online' ? 'Onlayn (müştəri özü)' : 'QR Kod'}</div>
  ${receipt.method === 'cash' ? `<div class="center">Qaytarılan: ${(Math.max(0, receipt.cashGiven - receipt.total)).toFixed(2)} ₼</div>` : ''}
  <div class="center" style="margin-top:14px">Təşəkkür edirik! Nuş olsun 🍽</div>
  </body></html>`)
  w.document.close()
  w.print()
}