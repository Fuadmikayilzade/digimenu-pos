import { useState, useMemo } from 'react'
import { useApp } from '../context/AppContext'
import { can } from '../utils/constants'
import { fmt, toISODate } from '../utils/helpers'
import { api } from '../utils/api'

export default function OrdersPage() {
  const { user, orders, setOrders, deleteOrder, doDelete, confirmDel, setConfirmDel, setShowReceipt, toast } = useApp()

  const [search, setSearch]       = useState('')
  const [filter, setFilter]       = useState('all')
  const [dateFilter, setDateFilter] = useState('today')  // 'today' | 'all' | 'custom'
  const [customDate, setCustomDate] = useState(toISODate())
  const [loading, setLoading]     = useState(false)

  // Load orders for selected date from backend
  const loadDate = async (date) => {
    setLoading(true)
    try {
      const data = await api.orders.list(date)
      const mapped = data.map(o => ({
        id: o.id, table: o.table_num, items: o.items,
        subtotal: o.subtotal, discount: o.discount, tax: o.tax, total: o.total,
        method: o.method, cashGiven: o.cash_given, change: o.change_amt,
        cashier: o.cashier, note: o.note, voided: Boolean(o.voided),
        time: new Date(o.created_at).toLocaleString('az'),
      }))
      setOrders(mapped)
      toast(`${date} tarixinə aid ${mapped.length} çek yükləndi`)
    } catch {
      toast('Məlumat yüklənmədi — yaddaşdakı data göstərilir', 'info')
    } finally {
      setLoading(false)
    }
  }

  const handleDateFilter = (type) => {
    setDateFilter(type)
    if (type === 'today') loadDate(toISODate())
  }

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

        {/* Date toolbar */}
        <div className="date-toolbar">
          <span className="date-label">📅 Tarix:</span>
          <button className={`date-btn${dateFilter === 'today' ? ' active' : ''}`}
            onClick={() => handleDateFilter('today')}>Bugün</button>
          <button className={`date-btn${dateFilter === 'custom' ? ' active' : ''}`}
            onClick={() => setDateFilter('custom')}>
            Tarix seç
          </button>
          {dateFilter === 'custom' && <>
            <input type="date" className="date-input" value={customDate}
              onChange={e => setCustomDate(e.target.value)}
              max={toISODate()} />
            <button className="date-btn active" onClick={() => loadDate(customDate)}>
              Yüklə
            </button>
          </>}
          {loading && <span style={{ fontSize: 11, color: 'var(--gray2)' }}>⏳ Yüklənir...</span>}
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
                      {o.method === 'cash' ? '💵' : o.method === 'card' ? '💳' : o.method === 'void' ? '✕' : '📱'}{' '}
                      {o.method === 'cash' ? 'Nağd' : o.method === 'card' ? 'Kart' : o.method === 'void' ? 'Ləğv' : 'QR'}
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
