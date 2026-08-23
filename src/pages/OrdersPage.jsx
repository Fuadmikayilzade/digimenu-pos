import { useState, useMemo, useEffect, useCallback } from 'react'
import { useApp } from '../context/AppContext'
import { can } from '../utils/constants'
import { fmt } from '../utils/helpers'
import { supabase } from '../utils/supabaseClient'

// ⚠️ BİRLƆŞDİRMƆ: əvvəllər ayrıca "Arxiv" adlı bir bölmə var idi —
// istifadəçinin xahişi ilə bu, Çeklər bölməsinin İÇİNƆ (bura) daşındı.
// Tarix seçilməyibsə (dateFilter boşdur) — CARİ SESSİYANIN çekləri
// göstərilir (əvvəlki davranış, yerli `orders` state-i). Tarix
// seçiləndə — həmin tarixin BÜTÜN çekləri birbaşa Supabase-dən
// gətirilir (keçmiş günlər daxil):
export default function OrdersPage() {
  const { user, orders, deleteOrder, setShowReceipt, activeBranchId } = useApp()

  const [search, setSearch]       = useState('')
  const [filter, setFilter]       = useState('all')
  const [dateFilter, setDateFilter] = useState('') // boşdursa — cari sessiya
  const [remoteOrders, setRemoteOrders] = useState([])
  const [loadingRemote, setLoadingRemote] = useState(false)

  const loadByDate = useCallback(async (date) => {
    if (!user?.business_id || !date) return
    setLoadingRemote(true)
    const fromISO = new Date(date + 'T00:00:00').toISOString()
    const toISO = new Date(date + 'T23:59:59').toISOString()
    let q = supabase
      .from('orders')
      .select('*, order_items(*), tables(number)')
      .eq('business_id', user.business_id)
      .gte('created_at', fromISO)
      .lte('created_at', toISO)
      .order('created_at', { ascending: false })
    q = activeBranchId ? q.eq('branch_id', activeBranchId) : q.is('branch_id', null)
    const { data, error } = await q
    setLoadingRemote(false)
    if (error) { console.error('Arxiv sorğusu uğursuz oldu:', error.message); setRemoteOrders([]); return }
    setRemoteOrders((data || []).map(o => ({
      id: o.id, table: o.tables?.number || '-',
      items: (o.order_items || []).map(it => ({ name: it.name || '', price: Number(it.price), qty: it.quantity, category: it.category })),
      subtotal: Number(o.total), discount: 0, tax: 0, total: Number(o.total),
      method: o.method || 'cash', cashGiven: 0, change: 0,
      cashier: o.staff_name || '', note: '', voided: o.status === 'ləğv',
      time: new Date(o.created_at).toLocaleString('az'),
      supabaseId: o.id,
    })))
  }, [user, activeBranchId])

  useEffect(() => {
    if (dateFilter) loadByDate(dateFilter)
  }, [dateFilter, loadByDate])

  // Hansı data mənbəyinin göstəriləcəyi — tarix seçilibsə uzaqdan,
  // deyilsə cari sessiyadan:
  const sourceOrders = dateFilter ? remoteOrders : orders

  const filtered = useMemo(() => sourceOrders.filter(o => {
    const q = search.toLowerCase()
    const matchSearch = !q || o.id.toLowerCase().includes(q) || String(o.table).includes(q)
    const matchFilter = filter === 'all' || (filter === 'paid' && !o.voided) || (filter === 'void' && o.voided)
    return matchSearch && matchFilter
  }), [sourceOrders, search, filter])

  const paid = sourceOrders.filter(o => !o.voided)
  const total = paid.reduce((s, o) => s + o.total, 0)

  return (
    <div className="full-col">
      <div className="orders-page">

        {/* ⚠️ YENİ: kalendardan tarix seçib, o günün BÜTÜN çeklərinə
            baxmaq (əvvəlki "Arxiv" bölməsinin funksiyası): */}
        <div className="date-toolbar" style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
          <span style={{ fontSize: 12, color: 'var(--gray2)' }}>
            {dateFilter ? `📅 ${dateFilter} tarixinin çekləri` : `📋 Bu sessiyanın çekləri`} ({sourceOrders.length})
          </span>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              type="date" value={dateFilter} onChange={e => setDateFilter(e.target.value)}
              style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg3)', color: 'var(--white)', fontSize: 12 }}
            />
            {dateFilter && (
              <button onClick={() => setDateFilter('')}
                style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--gray2)', fontSize: 12, cursor: 'pointer' }}>
                Cari sessiyaya qayıt
              </button>
            )}
          </div>
        </div>

        {/* Summary cards */}
        <div className="orders-summary">
          <div className="summary-card">
            <div className="summary-label">Ümumi Çek</div>
            <div className="summary-val">{sourceOrders.length}</div>
          </div>
          <div className="summary-card">
            <div className="summary-label">Ödənilmiş</div>
            <div className="summary-val green">{paid.length}</div>
          </div>
          <div className="summary-card">
            <div className="summary-label">Ləğv Edilmiş</div>
            <div className="summary-val" style={{ color: 'var(--red)' }}>{sourceOrders.filter(o => o.voided).length}</div>
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
        {loadingRemote
          ? <div className="orders-empty"><p>Yüklənir...</p></div>
          : !filtered.length
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
                        {can(user, 'delete') && !dateFilter && (
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