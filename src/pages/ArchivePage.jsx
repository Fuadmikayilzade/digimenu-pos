import { useState } from 'react'
import { useApp } from '../context/AppContext'
import { supabase } from '../utils/supabaseClient'
import { fmt } from '../utils/helpers'

// ── Çeklər Arxivi ─────────────────────────────────────────────────
// ⚠️ "Çeklər" (OrdersPage) səhifəsi YALNIZ hazırkı sessiyanın (bu gün
// açılan tətbiqin) çeklərini göstərir. Bu səhifə isə birbaşa Supabase-
// dəki TAM tarixçəni, seçilən tarix aralığına görə axtarır — POS bağlanıb
// açılsa belə, keçmiş çekləri həmişə tapmaq mümkündür.
export default function ArchivePage() {
  const { user, activeBranchId, getTableLabel, setShowReceipt } = useApp()

  const todayStr = new Date().toISOString().slice(0, 10)
  const [fromDate, setFromDate] = useState(todayStr)
  const [toDate, setToDate] = useState(todayStr)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState([])
  const [hasSearched, setHasSearched] = useState(false)

  const runSearch = async () => {
    if (!user?.business_id) return
    setLoading(true)

    const fromISO = new Date(fromDate + 'T00:00:00').toISOString()
    const toISO = new Date(toDate + 'T23:59:59').toISOString()

    let q = supabase
      .from('orders')
      .select('*, order_items(*), tables(number)')
      .eq('business_id', user.business_id)
      .gte('created_at', fromISO)
      .lte('created_at', toISO)
      .order('created_at', { ascending: false })
      .limit(500)
    q = activeBranchId ? q.eq('branch_id', activeBranchId) : q.is('branch_id', null)

    const { data, error } = await q
    setLoading(false)
    setHasSearched(true)

    if (error) {
      console.error('Arxiv axtarışı uğursuz oldu:', error.message)
      setResults([])
      return
    }

    setResults((data || []).map(o => ({
      id: o.id,
      table: o.tables?.number || '-',
      items: (o.order_items || []).map(it => ({ name: it.name || '', price: Number(it.price), qty: it.quantity, category: it.category })),
      subtotal: Number(o.total), discount: 0, tax: 0, total: Number(o.total),
      method: o.method || 'cash', cashGiven: 0, change: 0,
      cashier: o.staff_name || '', note: '', voided: o.status === 'ləğv',
      time: new Date(o.created_at).toLocaleString('az'),
      supabaseId: o.id,
    })))
  }

  const filtered = search
    ? results.filter(o => o.id.toLowerCase().includes(search.toLowerCase()) || String(o.table).includes(search))
    : results

  const totalSum = filtered.filter(o => !o.voided).reduce((s, o) => s + o.total, 0)

  const methodLabel = (m) =>
    m === 'cash' ? '💵 Nağd' : m === 'card' ? '💳 Kart' : m === 'online' ? '🌐 Onlayn' : m === 'void' ? '✕ Ləğv' : m

  return (
    <div className="full-col">
      <div className="orders-page">

        <div style={{ padding: '16px 20px', display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end', borderBottom: '1px solid var(--border)' }}>
          <div>
            <div style={{ fontSize: 11, color: 'var(--gray2)', marginBottom: 4 }}>Başlanğıc tarix</div>
            <input type="date" className="date-input" value={fromDate} onChange={e => setFromDate(e.target.value)} />
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--gray2)', marginBottom: 4 }}>Son tarix</div>
            <input type="date" className="date-input" value={toDate} onChange={e => setToDate(e.target.value)} />
          </div>
          <div style={{ flex: 1, minWidth: 160 }}>
            <div style={{ fontSize: 11, color: 'var(--gray2)', marginBottom: 4 }}>Çek ID / Masa</div>
            <input
              value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Axtar..."
              style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', boxSizing: 'border-box' }}
            />
          </div>
          <button onClick={runSearch} disabled={loading} className="btn-primary" style={{ padding: '8px 20px' }}>
            {loading ? 'Axtarılır...' : '🔍 Axtar'}
          </button>
        </div>

        {!hasSearched ? (
          <div style={{ textAlign: 'center', color: 'var(--gray2)', padding: 60 }}>
            Tarix aralığını seçib "Axtar" düyməsinə basın
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', color: 'var(--gray2)', padding: 60 }}>
            Bu tarix aralığında çek tapılmadı
          </div>
        ) : (
          <>
            <div style={{ padding: '12px 20px', display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--gray2)' }}>
              <span>{filtered.length} çek tapıldı</span>
              <span>Cəmi: <b style={{ color: 'var(--text)' }}>{fmt(totalSum)}</b></span>
            </div>

            <div className="orders-list">
              {filtered.map(o => (
                <div key={o.id} className="order-card" onClick={() => setShowReceipt(o)} style={{ cursor: 'pointer' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontWeight: 700 }}>Masa {o.table}</div>
                      <div style={{ fontSize: 12, color: 'var(--gray2)' }}>{o.time} · {methodLabel(o.method)}</div>
                      {o.cashier && <div style={{ fontSize: 11, color: 'var(--gray2)' }}>👤 {o.cashier}</div>}
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontWeight: 800, fontSize: 15, opacity: o.voided ? 0.5 : 1, textDecoration: o.voided ? 'line-through' : 'none' }}>
                        {fmt(o.total)}
                      </div>
                      {o.voided && <div style={{ fontSize: 11, color: '#E5484D' }}>Ləğv edilib</div>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}