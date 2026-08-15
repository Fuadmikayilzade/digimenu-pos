import { useState, useMemo } from 'react'
import { useApp } from '../context/AppContext'
import { can } from '../utils/constants'
import { fmt } from '../utils/helpers'

export default function OrdersPage() {
  const { user, orders, deleteOrder, setShowReceipt } = useApp()

  const [search, setSearch]       = useState('')
  const [filter, setFilter]       = useState('all')

  // ⚠️ ƏVVƆLKİ KOD burada köhnə, artıq İSTİFADƆ OLUNMAYAN bir backend-dən
  // (`api.orders.list` — Supabase-ə keçmədən ƏVVƆLKİ Node/Express server)
  // məlumat çəkib yerli (düzgün) `orders` siyahısının ÜSTÜNDƆN YAZIRDI.
  // Həmin köhnə backend masa nömrələrini "görünən ad" sistemindən XƆBƆRSİZ
  // saxladığı üçün (məs. daxili "29" ƆVƆZİNƆ "görünən ad" olan "6"),
  // Çeklər bölməsində YANLIŞ masa nömrəsi və ödəniş metodu görünürdü.
  // İndi sistem TAM Supabase-əsaslı olduğu üçün bu köhnə çağırış tamamilə
  // silindi — göstərilən data birbaşa (və YALNIZ) düzgün doldurulmuş yerli
  // `orders` state-indən gəlir (bax: confirmPayment, recordOnlineRevenue):

  const filtered = useMemo(() => orders.filter(o => {
    const q = search.toLowerCase()
    const matchSearch = !q || o.id.toLowerCase().includes(q) || String(o.table).includes(q)
    const matchFilter = filter === 'all' || (filter === 'paid' && !o.voided) || (filter === 'void' && o.voided)
    return matchSearch && matchFilter
  }), [orders, search, filter])

  const paid = orders.filter(o => !o.voided)
  const total = paid.reduce((s, o) => s + o.total, 0)

  return (
    <div className="full-col">
      <div className="orders-page">

        {/* Bu siyahı YALNIZ hazırkı iş sessiyasında POS-dan keçən çekləri
            göstərir (səhifə yenilənəndə sıfırlanır) — köhnə tarix/filial
            seçimi artıq mövcud olmayan bir backend-ə bağlı idi, silindi: */}
        <div className="date-toolbar">
          <span style={{ fontSize: 12, color: 'var(--gray2)' }}>📋 Bu sessiyanın çekləri ({orders.length})</span>
        </div>

        {/* Summary cards */}
        <div className="orders-summary">
          <div className="summary-card">
            <div className="summary-label">Ümumi Çek</div>
            <div className="summary-val">{orders.length}</div>
          </div>
          <div className="summary-card">
            <div className="summary-label">Ödənilmiş</div>
            <div className="summary-val green">{paid.length}</div>
          </div>
          <div className="summary-card">
            <div className="summary-label">Ləğv Edilmiş</div>
            <div className="summary-val" style={{ color: 'var(--red)' }}>{orders.filter(o => o.voided).length}</div>
          </div>
          <div className="summary-card">
            <div className="summary-label">Cəmi Gəlir</div>
            <div className="summary-val blue">{total.toFixed(2)} ₼</div>
          </div>
        </div>

        {/* Toolbar */}
        <div className="orders-toolbar">
          <input className="orders-search" placeholder="🔍 Çek ID və ya masa axtar..."
            value={search} onChange={e => setSearch(e.target.value)} />
          <select className="orders-filter" value={filter} onChange={e => setFilter(e.target.value)}>
            <option value="all">Hamısı</option>
            <option value="paid">Ödənilmiş</option>
            <option value="void">Ləğv edilmiş</option>
          </select>
        </div>

        {/* Table */}
        {!filtered.length
          ? <div className="orders-empty">
              <div style={{ fontSize: '2.5rem', marginBottom: 10, opacity: .3 }}>📋</div>
              <p>Çek tapılmadı</p>
            </div>
          : <table className="orders-table">
              <thead>
                <tr>
                  <th>Çek ID</th><th>Masa</th><th>Məbləğ</th>
                  <th>Ödəniş</th><th>Kasiyer</th><th>Tarix</th><th>Status</th>
                  <th style={{ textAlign: 'right' }}>Əməliyyat</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(o => (
                  <tr key={o.id}>
                    <td className="order-id-cell">{o.id}</td>
                    <td><b>M{o.table}</b></td>
                    <td style={{ fontFamily: 'var(--mono)', color: 'var(--accent)' }}>{fmt(o.total)}</td>
                    <td>
                      {o.method === 'cash' ? '💵' : o.method === 'card' ? '💳' : o.method === 'void' ? '✕' : o.method === 'online' ? '🌐' : '📱'}{' '}
                      {o.method === 'cash' ? 'Nağd' : o.method === 'card' ? 'Kart' : o.method === 'void' ? 'Ləğv' : o.method === 'online' ? 'Onlayn (müştəri)' : 'QR'}
                    </td>
                    <td style={{ color: 'var(--gray)' }}>{o.cashier || '—'}</td>
                    <td style={{ fontSize: '11px', color: 'var(--gray2)' }}>{o.time}</td>
                    <td>
                      <span className={`order-status ${o.voided ? 'status-void' : 'status-paid'}`}>
                        {o.voided ? 'LEĞVEDİLDİ' : 'ÖDƏNİLDİ'}
                      </span>
                    </td>
                    <td>
                      <div className="order-actions">
                        <button className="action-btn view" onClick={() => setShowReceipt(o)}>👁 Bax</button>
                        <button className="action-btn print" onClick={() => setShowReceipt(o)}>🖨</button>
                        {can(user, 'delete') && (
                          <button className="action-btn del" onClick={() => deleteOrder(o.id)}>🗑</button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
        }
      </div>
    </div>
  )
}