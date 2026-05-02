import { useState, useEffect } from 'react'
import { useApp } from '../context/AppContext'
import { CATS } from '../utils/constants'
import { fmt, toISODate } from '../utils/helpers'
import { api } from '../utils/api'

export default function ReportsPage() {
  const { user, paidOrders, orders, todaySales, menuItems } = useApp()

  const [selectedDate, setSelectedDate] = useState(toISODate())
  const [remoteData, setRemoteData]     = useState(null)
  const [loading, setLoading]           = useState(false)

  useEffect(() => {
    if (!user) return
    api.reports.daily(toISODate())
      .then(data => setRemoteData(data))
      .catch(() => {})
  }, [user])

  const loadDate = async () => {
    setLoading(true)
    try {
      const data = await api.reports.daily(selectedDate)
      setRemoteData(data)
    } catch {
      // fallback to memory
    } finally {
      setLoading(false)
    }
  }

  if (!user || user.role !== 'admin') {
    return (
      <div className="full-col" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', color: 'var(--gray2)' }}>
          <div style={{ fontSize: '3rem', marginBottom: 12 }}>🔒</div>
          <p style={{ fontSize: '14px' }}>Bu bölməyə giriş icazəniz yoxdur</p>
        </div>
      </div>
    )
  }

  // Use remote or fall back to in-memory
  const paid   = remoteData ? remoteData.orders?.filter(o => !o.voided) : paidOrders
  const total  = remoteData ? remoteData.summary.totalRevenue : todaySales
  const catMap = remoteData ? remoteData.categoryBreakdown : null
  const pmMap  = remoteData ? remoteData.paymentMethods : null

  return (
    <div className="full-col">
      <div className="reports">

        {/* Date toolbar */}
        <div className="date-toolbar">
          <span className="date-label">📅 Hesabat Tarixi:</span>
          <input type="date" className="date-input" value={selectedDate}
            onChange={e => setSelectedDate(e.target.value)} max={toISODate()} />
          <button className="date-btn active" onClick={loadDate}>📈 Hesabat Al</button>
          {loading && <span style={{ fontSize: 11, color: 'var(--gray2)' }}>⏳ Yüklənir...</span>}
          {remoteData && (
            <span style={{ fontSize: 11, color: 'var(--green)' }}>✓ {remoteData.date}</span>
          )}
        </div>

        <div className="rep-grid">
          {/* Category breakdown */}
          <div className="rep-card">
            <div className="rep-title">Kateqoriya üzrə Satış</div>
            {CATS.filter(c => c.name !== 'Hamısı').map(c => {
              let tot = 0
              if (catMap) {
                tot = catMap[c.name] || 0
              } else {
                tot = paidOrders.flatMap(o => o.items || [])
                  .filter(i => {
                    const mi = menuItems.find(m => m.name === i.name)
                    return mi?.category === c.name
                  })
                  .reduce((s, i) => s + i.price * i.qty, 0)
              }
              return (
                <div key={c.name} className="rep-bar-row">
                  <span className="rep-bar-label">{c.icon} {c.name}</span>
                  <div className="rep-bar-bg">
                    <div className="rep-bar-fill" style={{ width: `${tot / (total || 1) * 100}%` }} />
                  </div>
                  <span className="rep-bar-val">{fmt(tot)}</span>
                </div>
              )
            })}
          </div>

          {/* Payment methods */}
          <div className="rep-card">
            <div className="rep-title">Ödəniş Üsulları</div>
            {['cash', 'card', 'qr'].map(m => {
              let cnt = 0, tot = 0
              if (pmMap) {
                cnt = pmMap[m]?.count || 0
                tot = pmMap[m]?.total || 0
              } else {
                const filtered = paidOrders.filter(o => o.method === m)
                cnt = filtered.length
                tot = filtered.reduce((s, o) => s + o.total, 0)
              }
              const icons  = { cash: '💵', card: '💳', qr: '📱' }
              const labels = { cash: 'Nağd', card: 'Kart', qr: 'QR Kod' }
              return (
                <div key={m} className="shift-row">
                  <span style={{ fontSize: '12px' }}>{icons[m]} {labels[m]}</span>
                  <span style={{ fontFamily: 'var(--mono)', fontSize: '11px', color: 'var(--gray2)' }}>{cnt} əməliyyat</span>
                  <span style={{ fontFamily: 'var(--mono)', fontSize: '12px', color: 'var(--accent)' }}>{fmt(tot)}</span>
                </div>
              )
            })}
          </div>

          {/* Daily summary */}
          <div className="rep-card">
            <div className="rep-title">Günlük Xülasə</div>
            {remoteData ? [
              ['Ümumi Sifariş',    remoteData.summary.totalOrders],
              ['Uğurlu',          remoteData.summary.paidOrders],
              ['Ləğv Edilmiş',    remoteData.summary.voidedOrders],
              ['Brüt Gəlir',      fmt(remoteData.summary.totalRevenue)],
              ['ƏDV Məbləği',     fmt(remoteData.summary.totalTax)],
              ['Endirimlər',      fmt(remoteData.summary.totalDiscount)],
              ['Ort. Hesab',      fmt(remoteData.summary.avgOrder)],
            ].map(([k, v]) => (
              <div key={k} className="shift-row">
                <span style={{ fontSize: '11.5px', color: 'var(--gray)' }}>{k}</span>
                <span style={{ fontFamily: 'var(--mono)', fontSize: '12px', color: 'var(--white)' }}>{v}</span>
              </div>
            )) : [
              ['Ümumi Sifariş',   orders.length],
              ['Uğurlu',         paidOrders.length],
              ['Ləğv Edilmiş',   orders.filter(o => o.voided).length],
              ['Brüt Gəlir',     fmt(todaySales)],
              ['ƏDV Məbləği',    fmt(paidOrders.reduce((s, o) => s + o.tax, 0))],
              ['Endirimlər',     fmt(paidOrders.reduce((s, o) => s + o.subtotal * o.discount / 100, 0))],
            ].map(([k, v]) => (
              <div key={k} className="shift-row">
                <span style={{ fontSize: '11.5px', color: 'var(--gray)' }}>{k}</span>
                <span style={{ fontFamily: 'var(--mono)', fontSize: '12px', color: 'var(--white)' }}>{v}</span>
              </div>
            ))}
          </div>

          {/* Top selling items */}
          <div className="rep-card">
            <div className="rep-title">Ən Çox Satılan Məhsullar</div>
            {(remoteData ? remoteData.topItems : (() => {
              const c = {}
              paidOrders.forEach(o => (o.items || []).forEach(it => { c[it.name] = (c[it.name] || 0) + it.qty }))
              return Object.entries(c).sort((a, b) => b[1] - a[1]).slice(0, 8)
            })()).map(([name, count], i) => (
              <div key={i} className="rep-bar-row">
                <span className="rep-bar-label">
                  <span style={{ color: 'var(--gray2)', marginRight: 6, fontFamily: 'var(--mono)', fontSize: 10 }}>{i + 1}.</span>
                  {name}
                </span>
                <div className="rep-bar-bg">
                  <div className="rep-bar-fill" style={{ width: `${count / ((remoteData?.topItems?.[0]?.[1] || 1)) * 100}%` }} />
                </div>
                <span className="rep-bar-val" style={{ color: 'var(--green)' }}>{count}×</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
