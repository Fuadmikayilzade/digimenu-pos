import { useState } from 'react'
import { useApp } from '../context/AppContext'
import { can, TABLE_COUNT } from '../utils/constants'
import { fmt } from '../utils/helpers'
import Clock from './Clock'

const NAV_ITEMS = [
  { k: 'pos',       label: '🛒 POS',       role: 'pos'     },
  { k: 'kitchen',   label: '🍳 Mətbəx',    role: 'kitchen' },
  { k: 'orders',    label: '📋 Çeklər',    role: 'pos'     },
  { k: 'dashboard', label: '📊 Dashboard', role: 'reports' },
  { k: 'reports',   label: '📈 Hesabat',   role: 'reports' },
]

export default function Topbar() {
  const {
    user, handleLogout, view, setView,
    todaySales, openTables, ticketCount,
    readyNotifs, dismissReadyNotif, clearReadyNotifs,
  } = useApp()

  const [showNotifPanel, setShowNotifPanel] = useState(false)
  const unreadCount = readyNotifs.length

  return (
    <div className="topbar" style={{ position: 'relative' }}>
      <div className="logo">Digi<span>Menu</span> POS</div>

      <div className="topbar-nav">
        {NAV_ITEMS.map(n => (
          <button key={n.k}
            className={`nav-btn${view === n.k ? ' active' : ''}`}
            onClick={() => setView(n.k)}
            disabled={!can(user, n.role)}>
            {n.label}
            {n.k === 'kitchen' && ticketCount > 0 && (
              <span style={{
                marginLeft: 4, background: 'var(--amber)', color: 'var(--bg)',
                borderRadius: 4, padding: '0 5px', fontSize: '10px', fontWeight: 700
              }}>{ticketCount}</span>
            )}
          </button>
        ))}
      </div>

      <div className="topbar-stats">
        <div className="stat-chip green">
          <span>Satış:</span>
          <span className="val">{fmt(todaySales)}</span>
        </div>
        <div className="stat-chip amber">
          <span>Masa:</span>
          <span className="val">{openTables}/{TABLE_COUNT}</span>
        </div>
      </div>

      <Clock />

      {/* Bildiriş zəngi — yalnız kasiyer/admin üçün */}
      {user && user.role !== 'kitchen' && (
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setShowNotifPanel(p => !p)}
            style={{
              position: 'relative', width: 34, height: 34, borderRadius: 8,
              background: unreadCount > 0 ? 'rgba(255,179,0,.12)' : 'var(--bg3)',
              border: unreadCount > 0 ? '1px solid rgba(255,179,0,.3)' : '1px solid var(--border)',
              color: unreadCount > 0 ? 'var(--amber)' : 'var(--gray)',
              fontSize: 16, cursor: 'pointer', transition: '.15s',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
            🔔
            {unreadCount > 0 && (
              <span style={{
                position: 'absolute', top: -4, right: -4,
                background: 'var(--red)', color: '#fff',
                borderRadius: '50%', width: 16, height: 16,
                fontSize: 9, fontWeight: 800,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>{unreadCount > 9 ? '9+' : unreadCount}</span>
            )}
          </button>

          {/* Bildiriş paneli */}
          {showNotifPanel && (
            <>
              <div
                onClick={() => setShowNotifPanel(false)}
                style={{ position: 'fixed', inset: 0, zIndex: 200 }}
              />
              <div style={{
                position: 'absolute', top: 42, right: 0, zIndex: 201,
                background: 'var(--bg2)', border: '1px solid var(--border2)',
                borderRadius: 12, width: 280, boxShadow: 'var(--shadow2)',
                overflow: 'hidden',
              }}>
                <div style={{
                  padding: '10px 14px', borderBottom: '1px solid var(--border)',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                }}>
                  <span style={{ fontSize: 12, fontWeight: 700 }}>🔔 Bildirişlər</span>
                  {readyNotifs.length > 0 && (
                    <button onClick={clearReadyNotifs} style={{
                      fontSize: 10, color: 'var(--gray)', background: 'none',
                      border: 'none', cursor: 'pointer',
                    }}>Hamısını sil</button>
                  )}
                </div>

                <div style={{ maxHeight: 320, overflowY: 'auto' }}>
                  {!readyNotifs.length
                    ? (
                      <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--gray2)', fontSize: 12 }}>
                        Bildiriş yoxdur
                      </div>
                    )
                    : readyNotifs.map(n => (
                        <div key={n.id} style={{
                          display: 'flex', alignItems: 'center', gap: 10,
                          padding: '10px 14px', borderBottom: '1px solid var(--border)',
                          transition: '.15s',
                        }}>
                          <span style={{ fontSize: '1.4rem' }}>🍽</span>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--amber)' }}>
                              Masa {n.tableNum} — Hazırdır!
                            </div>
                            <div style={{ fontSize: 10, color: 'var(--gray2)', marginTop: 2 }}>
                              {n.time}
                            </div>
                          </div>
                          <button onClick={() => dismissReadyNotif(n.id)} style={{
                            background: 'none', border: 'none', color: 'var(--gray2)',
                            cursor: 'pointer', fontSize: 14,
                          }}>✕</button>
                        </div>
                      ))
                  }
                </div>
              </div>
            </>
          )}
        </div>
      )}

      <div className="user-chip">
        <span>{user.avatar}</span>
        <span style={{ fontWeight: 600, fontSize: 12 }}>{user.name}</span>
        <span className="user-role">{user.role}</span>
      </div>

      <button className="logout-btn" onClick={handleLogout}>⏏ Çıxış</button>
    </div>
  )
}
