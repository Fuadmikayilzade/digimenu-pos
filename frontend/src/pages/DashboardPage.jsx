import { useState, useEffect } from 'react'
import { useApp } from '../context/AppContext'
import { fmt, fmtN, toISODate } from '../utils/helpers'
import { TABLE_COUNT } from '../utils/constants'
import { api } from '../utils/api'

function NoAccess() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--gray2)', gap: 12 }}>
      <span style={{ fontSize: '3rem' }}>🔒</span>
      <p style={{ fontSize: '14px', fontWeight: 600 }}>Bu bölməyə giriş icazəniz yoxdur</p>
    </div>
  )
}

export default function DashboardPage() {
  const { user, paidOrders, todaySales, openTables, ticketCount, orders, topItems } = useApp()

  const [selectedDate, setSelectedDate] = useState(toISODate())
  const [remoteData, setRemoteData]     = useState(null)
  const [loading, setLoading]           = useState(false)
  const [useRemote, setUseRemote]       = useState(false)

  const loadRemote = async () => {
    setLoading(true)
    setUseRemote(true)
    try {
      const data = await api.reports.daily(selectedDate)
      setRemoteData(data)
    } catch {
      setUseRemote(false)
      setRemoteData(null)
    } finally {
      setLoading(false)
    }
  }

  // Auto-load for current date when backend is available
  useEffect(() => {
    if (!user) return
    api.reports.daily(toISODate())
      .then(data => { setRemoteData(data); setUseRemote(true) })
      .catch(() => {})
  }, [user])

  if (!user || !['admin'].includes(user.role)) return (
    <div className="full-col" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <NoAccess />
    </div>
  )

  // Use remote data if available, otherwise fall back to in-memory
  const summary   = useRemote && remoteData ? remoteData.summary   : null
  const topList   = useRemote && remoteData ? remoteData.topItems  : topItems
  const hourly    = useRemote && remoteData ? remoteData.hourlySales : null
  const tableAct  = useRemote && remoteData ? remoteData.tableActivity : null
  const recOrders = useRemote && remoteData ? remoteData.orders?.slice(0, 7) : orders.slice(0, 7)

  const revenue   = summary ? summary.totalRevenue : todaySales
  const txCount   = summary ? summary.paidOrders : paidOrders.length
  const avgOrder  = txCount ? (revenue / txCount) : 0

  // Hourly chart data
  const hourlyData = hourly
    ? Array.from({ length: 12 }, (_, i) => hourly[i + 9] || { hour: i + 9, total: 0 })
    : Array.from({ length: 12 }, (_, i) => {
        const h = i + 9
        const v = paidOrders.filter(o => {
          const t = o.time?.split(':')[0]
          return parseInt(t) === h
        }).reduce((s, o) => s + o.total, 0)
        return { hour: h, total: v }
      })

  const maxHourly = Math.max(...hourlyData.map(h => h.total), 1)

  return (
    <div className="full-col">
      <div className="dash">
        {/* Date picker */}
        <div className="date-toolbar" style={{ marginBottom: 16 }}>
          <span className="date-label">📅 Tarix:</span>
          <input type="date" className="date-input" value={selectedDate}
            onChange={e => setSelectedDate(e.target.value)}
            max={toISODate()} />
          <button className="date-btn active" onClick={loadRemote}>
            📊 Yüklə
          </button>
          {loading && <span style={{ fontSize: 11, color: 'var(--gray2)' }}>⏳ Yüklənir...</span>}
          {useRemote && remoteData && (
            <span style={{ fontSize: 11, color: 'var(--green)' }}>✓ {remoteData.date} — backend data</span>
          )}
        </div>

        {/* KPI Cards */}
        <div className="dash-grid">
          {[
            { label: 'GÜNLÜK SATIŞ',  val: fmt(revenue),                   sub: `${txCount} əməliyyat`,   color: 'blue',   icon: '💰' },
            { label: 'AKTİV MASALAR', val: `${openTables}/${TABLE_COUNT}`, sub: 'Hazırda dolu',           color: 'green',  icon: '🪑' },
            { label: 'MƏTBƏXDƏKİ',   val: ticketCount,                    sub: 'Hazırlanır',             color: 'amber',  icon: '🍳' },
            { label: 'ORT. HESAB',    val: fmt(avgOrder),                  sub: 'Bir sifarişə',           color: 'purple', icon: '📊' },
          ].map(k => (
            <div key={k.label} className={`kpi-card ${k.color}`}>
              <div className="kpi-icon">{k.icon}</div>
              <div className="kpi-label">{k.label}</div>
              <div className="kpi-val">{k.val}</div>
              <div className="kpi-sub">{k.sub}</div>
            </div>
          ))}
        </div>

        {/* Son sifarişlər + Top items */}
        <div className="dash-row">
          <div className="dash-card">
            <div className="dash-card-title"><span className="dot" />Son Sifarişlər</div>
            {!recOrders?.length
              ? <p style={{ color: 'var(--gray2)', fontSize: '12px' }}>Hələ sifariş yoxdur</p>
              : recOrders.map((o, i) => (
                  <div key={i} className="order-row">
                    <span className="order-id">{o.id}</span>
                    <span className="order-table">Masa {o.table || o.table_num}</span>
                    <span className="order-amt">{fmt(o.total)}</span>
                    <span className={`order-status ${o.voided ? 'status-void' : 'status-paid'}`}>
                      {o.voided ? 'LƏĞV' : 'ÖDƏNDİ'}
                    </span>
                  </div>
                ))
            }
          </div>

          <div className="dash-card">
            <div className="dash-card-title"><span className="dot" />Ən Çox Satılan</div>
            {!topList?.length
              ? <p style={{ color: 'var(--gray2)', fontSize: '12px' }}>Məlumat yoxdur</p>
              : topList.map(([name, count], i) => (
                  <div key={i} className="top-item-row">
                    <span className="top-rank">{i + 1}</span>
                    <span className="top-name">{name}</span>
                    <div className="top-bar-wrap">
                      <div className="top-bar" style={{ width: `${count / (topList[0]?.[1] || 1) * 100}%` }} />
                    </div>
                    <span className="top-count">{count}×</span>
                  </div>
                ))
            }
          </div>
        </div>

        {/* Saatlıq chart */}
        <div className="dash-card">
          <div className="dash-card-title"><span className="dot" />Saatlıq Satış (09:00–20:00)</div>
          <div className="hour-chart">
            {hourlyData.map((h, i) => (
              <div key={i} className="hour-bar-wrap">
                <div className="hour-bar"
                  style={{ height: `${Math.max(3, h.total / maxHourly * 64)}px` }}
                  title={fmt(h.total)} />
                <span className="hour-label">{h.hour}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Masa aktivliyi */}
        <div className="dash-card" style={{ marginTop: 12 }}>
          <div className="dash-card-title"><span className="dot" />Masa Aktivliyi</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8,1fr)', gap: 5 }}>
            {Array.from({ length: TABLE_COUNT }, (_, i) => {
              const n   = i + 1
              const tot = tableAct ? (tableAct[n] || 0) : paidOrders.filter(o => o.table === n).reduce((s, o) => s + o.total, 0)
              return (
                <div key={n} style={{ background: 'var(--bg4)', borderRadius: 6, padding: '7px 5px', textAlign: 'center', border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--gray)' }}>M{n}</div>
                  <div style={{ fontSize: '9.5px', fontFamily: 'var(--mono)', color: tot > 0 ? 'var(--accent)' : 'var(--gray2)', marginTop: 2 }}>
                    {tot > 0 ? fmtN(tot) : '—'}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
