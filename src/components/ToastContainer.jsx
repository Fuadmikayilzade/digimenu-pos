import { useState, useEffect } from 'react'
import { useApp } from '../context/AppContext'
import { can } from '../utils/constants'

const POPUP_VISIBLE_MS = 12000

export default function ToastContainer({ toasts }) {
  const { readyNotifs, dismissReadyNotif, user } = useApp()

  // ⚠️ KRİTİK DÜZƆLİŞ: ƏVVƆLKİ üsul hər bildiriş üçün AYRI `setTimeout`
  // qurub, komponent bir daha render/mount olanda bu timer-lər İTİRDİ
  // (React-in useEffect təmizləmə davranışı, yaxud parent-in yenidən
  // render etməsi) — bu, ofisiant/menecer hesablarında "pop-up əbədi
  // donub qalır" bugunun səbəbi idi. İndi HEÇ bir per-item timer YOXDUR
  // — sadəcə hər saniyə "indiki vaxt" yenilənir (`nowTick`) və görünüş
  // BİRBAŞA DATA-dan (`n.createdAtMs`) hesablanır. Komponent istənilən
  // qədər remount olsa belə, nəticə HƏMİŞƆ düzgündür, çünki vaxt
  // hesablaması heç vaxt "yaddaşda saxlanan bir timer"a bağlı deyil:
  const [nowTick, setNowTick] = useState(() => Date.now())
  useEffect(() => {
    const interval = setInterval(() => setNowTick(Date.now()), 1000)
    return () => clearInterval(interval)
  }, [])

  const visiblePopupNotifs = readyNotifs.filter(n => {
    const createdAt = n.createdAtMs || 0
    if (!createdAt) return true // köhnə (createdAtMs olmayan) bildirişlər — ehtiyatla göstər
    return (nowTick - createdAt) < POPUP_VISIBLE_MS
  })

  return (
    <>
      {/* Normal toastlar — aşağı sağ */}
      <div style={{
        position: 'fixed', bottom: 20, right: 20, zIndex: 1000,
        display: 'flex', flexDirection: 'column', gap: 7,
        pointerEvents: 'none',
      }}>
        {toasts.filter(t => t.type !== 'ready').map(t => (
          <div key={t.id} className={`toast-item ${t.type}`}>
            {t.type === 'success' ? '✓' : t.type === 'error' ? '✕' : 'ℹ'} {t.msg}
          </div>
        ))}
      </div>

      {/* Davamlı bildirişlər (yuxarı sağ) — 12 saniyə görünür, sonra
          öz-özünə gizlənir (aşağıdaki `visiblePopupNotifs` filtri).
          Zəng (🔔) panelində isə (Topbar.jsx) HAMISI davam edir: */}
      {visiblePopupNotifs.length > 0 && (
        <div style={{
          position: 'fixed', top: 66, right: 16, zIndex: 1000,
          display: 'flex', flexDirection: 'column', gap: 8,
          pointerEvents: 'all',
        }}>
          {visiblePopupNotifs.map(n => {
            const isPaid = n.type === 'paid'
            const isLoyalty = n.type === 'loyalty'
            const color = isPaid ? 'var(--green)' : isLoyalty ? '#E91E8C' : 'var(--amber)'
            const bg = isPaid ? 'rgba(0,230,118,.18)' : isLoyalty ? 'rgba(233,30,140,.18)' : 'rgba(255,179,0,.18)'
            const border = isPaid ? 'rgba(0,230,118,.5)' : isLoyalty ? 'rgba(233,30,140,.5)' : 'rgba(255,179,0,.5)'
            const shadow = isPaid ? 'rgba(0,230,118,.2)' : isLoyalty ? 'rgba(233,30,140,.2)' : 'rgba(255,179,0,.2)'
            return (
              <div key={n.id} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '10px 14px',
                background: bg,
                border: `1px solid ${border}`,
                borderRadius: 12,
                color,
                boxShadow: `0 4px 20px ${shadow}`,
                animation: 'slideInRight .25s ease',
                minWidth: 240,
              }}>
                <span style={{ fontSize: '1.4rem', flexShrink: 0 }}>{isPaid ? '💳' : isLoyalty ? '🎁' : '🍽'}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 13 }}>
                    {n.message || `Masa ${n.tableNum} — Hazırdır!`}
                  </div>
                  <div style={{ fontSize: 10, opacity: .7, marginTop: 1 }}>
                    {isPaid ? 'Ödəniş' : isLoyalty ? 'Loyallıq' : 'Mətbəx'} · {n.time}
                  </div>
                </div>
                {/* ⚠️ Bağlamaq YALNIZ menecer/sahibkar/admin üçündür: */}
                {(user?.role === 'owner') && (
                  <button
                    onClick={(e) => { e.stopPropagation(); dismissReadyNotif(n.id) }}
                    style={{
                      background: `${bg}`, border: `1px solid ${border}`,
                      color, cursor: 'pointer', borderRadius: 6,
                      width: 24, height: 24, fontSize: 12, fontWeight: 700,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      flexShrink: 0,
                    }}>
                    ✕
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}
    </>
  )
}