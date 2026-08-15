import { useApp } from '../context/AppContext'
import { can } from '../utils/constants'
import { fmt } from '../utils/helpers'
import { useState } from 'react'
import MenuItemCard from '../components/MenuItemCard'
import LoyaltyPanel from '../components/LoyaltyPanel'
import ReserveModal from '../components/ReserveModal'

export default function POSPage() {
  const {
    user, activeCat, setActiveCat, search, setSearch,
    filteredMenu, catCounts, dynamicCategories, loading,
    liveTables, tables, activeTable, setActiveTable,
    cart, cartSubtotal, discountAmt, taxAmt, cartTotal,
    addItem, updateQty, setNote, setDiscount,
    sendToKitchen, voidTable, setShowPayment,
    reservations, todaysReservationByTable, createReservation, deleteReservation,
    mobileSidebarOpen, setMobileSidebarOpen, mobileCartOpen, setMobileCartOpen,
    canEditTable, getTableOwnerName, activeLoyaltyMember, getTablePaymentInfo,
    onlinePaidAmount, amountDueNow,
  } = useApp()

  const [showLoyaltyPanel, setShowLoyaltyPanel] = useState(false)
  const isTableLocked = !canEditTable(activeTable)
  const activeTableLabel = liveTables.find(t => Number(t.number) === activeTable)?.display_label || activeTable
  const { paidQtyByKey } = getTablePaymentInfo(activeTable)

  const [reserveModal, setReserveModal] = useState({ open: false, table: null })
  const [showReservations, setShowReservations] = useState(false)

  const tableSum = (n) => {
    const t = tables[n]
    return t ? t.items.reduce((s, i) => s + i.price * i.qty, 0) : 0
  }

  const statusLabel = { 'boş': 'Boş', 'dolu': 'Dolu' }

  const handleReserveClick = (e, tableNumber) => {
    e.preventDefault()
    e.stopPropagation()
    setReserveModal({ open: true, table: tableNumber })
  }

  const formatTime = (timeStr) => timeStr ? timeStr.slice(0, 5) : ''

  return (
    <>
      {/* Mobil arxa fon — sidebar və ya səbət açıq olanda görünür, klikləyəndə bağlanır */}
      {(mobileSidebarOpen || mobileCartOpen) && (
        <div className="mobile-backdrop" onClick={() => { setMobileSidebarOpen(false); setMobileCartOpen(false) }} />
      )}

      {/* SIDEBAR */}
      <div className={`sidebar${mobileSidebarOpen ? ' mobile-open' : ''}`}>
        <button className="mobile-close-btn" onClick={() => setMobileSidebarOpen(false)}>✕</button>
        <div className="sidebar-section">
          <div className="sidebar-label">Kateqoriyalar</div>
          {dynamicCategories.map(c => (
            <button key={c.name} className={`cat-btn${activeCat === c.name ? ' active' : ''}`}
              onClick={() => setActiveCat(c.name)}>
              <span className="cat-icon">{c.icon}</span>
              <span className="cat-name">{c.name}</span>
              {c.name !== 'Hamısı' && (
                <span className="cat-count">{catCounts[c.name] || 0}</span>
              )}
            </button>
          ))}
        </div>

        <div className="sidebar-section">
          <div className="sidebar-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>Masalar</span>
            <button onClick={() => setShowReservations(true)} style={{ background: 'none', border: 'none', color: 'var(--accent)', fontSize: 10, cursor: 'pointer', fontWeight: 700 }}>
              🔖 Rezervasiyalar{reservations.length ? ` (${reservations.length})` : ''}
            </button>
          </div>
          <div className="table-grid">
            {liveTables.length === 0 ? (
              <div style={{ fontSize: 12, color: 'var(--gray2)', padding: '8px 4px' }}>Masa yoxdur</div>
            ) : liveTables.map((t) => {
              const n = Number(t.number)
              const sum = tableSum(n)
              const occ = sum > 0 || t.status === 'dolu'
              const todayReservation = todaysReservationByTable[t.number]
              const ownerName = getTableOwnerName(n)
              const isLocked = occ && !canEditTable(n)
              return (
                <button key={t.id}
                  className={`table-btn${activeTable === n ? ' active' : ''}${occ ? ' occupied' : ''}${todayReservation ? ' has-reservation' : ''}${isLocked ? ' locked-by-other' : ''}`}
                  onClick={() => { setActiveTable(n); setMobileSidebarOpen(false) }}
                  onContextMenu={(e) => handleReserveClick(e, n)}
                  title={
                    isLocked ? `🔒 ${ownerName} tərəfindən idarə olunur`
                    : todayReservation ? `Bugün rezerv: ${todayReservation.reserved_name}${todayReservation.phone ? ` (${todayReservation.phone})` : ''} — ${formatTime(todayReservation.reserved_time)} — sağ klik yeni rezervasiya üçün`
                    : `${statusLabel[t.status] || t.status} — sağ klik rezervasiya üçün`
                  }>
                  <span className="table-num">M{t.display_label || t.number} {todayReservation ? '🔖' : ''} {isLocked ? '🔒' : ''}</span>
                  <span className="table-sum">
                    {sum > 0 ? `${sum.toFixed(0)}₼` : (statusLabel[t.status] || '—')}
                  </span>
                  {ownerName && occ && (
                    <span className="table-owner">{ownerName}</span>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* MENU CONTENT */}
      <div className="content">
        <div className="search-bar">
          <span className="s-icon">🔍</span>
          <input placeholder="Yemək axtar..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        {loading
          ? <div style={{ textAlign: 'center', padding: 40, color: 'var(--gray2)' }}>⏳ Menyu yüklənir...</div>
          : <div className="menu-grid">
              {filteredMenu.map((item, idx) => (
                <MenuItemCard key={item.id} item={item} idx={idx} onAdd={() => addItem(item)} />
              ))}
            </div>
        }
      </div>

      {/* CART */}
      <div className={`cart-panel${mobileCartOpen ? ' mobile-open' : ''}`}>
        <button className="mobile-close-btn" onClick={() => setMobileCartOpen(false)}>✕</button>
        <div className="cart-header">
          <span className="cart-title">🛒 Sifariş</span>
          <span className="cart-table-tag">Masa {activeTableLabel}</span>
        </div>

        {isTableLocked && (
          <div className="cart-locked-banner">
            🔒 Bu masanı <b>{getTableOwnerName(activeTable)}</b> açıb — yalnız o (və ya sahibkar) dəyişə bilər. Siz yalnız baxa bilərsiniz.
          </div>
        )}

        <div className="cart-items">
          {!cart.items.length
            ? <div className="cart-empty">
                <span className="cart-empty-icon">🛒</span>
                <p>Sifariş boşdur</p>
              </div>
            : cart.items.map(item => {
                const paidQty = Math.min(item.qty, paidQtyByKey[`${item.name}|${item.price}`] || 0)
                return (
                <div key={item.id} className="cart-item">
                  <span className="cart-item-emoji">{item.emoji}</span>
                  <div className="cart-item-info">
                    <div className="cart-item-name">
                      {item.name}
                      {paidQty > 0 && (
                        <span className="cart-item-paid-badge" title="Müştəri onlayn ödəyib">
                          ✅ {paidQty}/{item.qty} ödənilib
                        </span>
                      )}
                    </div>
                    <div className="cart-item-price">{(item.price * item.qty).toFixed(2)} ₼</div>
                  </div>
                  <div className="cart-item-controls">
                    <button className="qty-btn del" disabled={isTableLocked} onClick={() => updateQty(item.id, -1)}>−</button>
                    <span className="qty-num">{item.qty}</span>
                    <button className="qty-btn" disabled={isTableLocked} onClick={() => updateQty(item.id, 1)}>+</button>
                  </div>
                </div>
              )})
          }
        </div>

        {cart.items.length > 0 && <>
          <div className="cart-note">
            <textarea placeholder="Qeyd (allerji, xüsusi istək...)" disabled={isTableLocked}
              value={cart.note} onChange={e => setNote(e.target.value)} />
          </div>

          {can(user, 'discount') && (
            <div className="discount-row">
              <span className="discount-label">Endirim %</span>
              <input className="discount-input" type="number" min="0" max="100" disabled={isTableLocked}
                value={cart.discount} onChange={e => setDiscount(e.target.value)} />
            </div>
          )}

          <div className="cart-totals">
            <div className="total-row"><span>Ara cəm</span><span>{fmt(cartSubtotal)} ₼</span></div>
            {cart.discount > 0 && (
              <div className="total-row"><span>Endirim ({cart.discount}%)</span><span>-{fmt(discountAmt)} ₼</span></div>
            )}
            <div className="total-row"><span>ƏDV (18%)</span><span>{fmt(taxAmt)} ₼</span></div>
            {onlinePaidAmount > 0 && (
              <div className="total-row" style={{ color: 'var(--green)' }}>
                <span>✅ Onlayn ödənilib</span><span>-{fmt(onlinePaidAmount)} ₼</span>
              </div>
            )}
            <div className="total-row grand">
              <span>{onlinePaidAmount > 0 ? 'QALIQ BORC' : 'CƏMİ'}</span>
              <span>{fmt(amountDueNow)} ₼</span>
            </div>
          </div>

          <div className="cart-actions">
            <button
              onClick={() => setShowLoyaltyPanel(true)}
              style={{
                width: '100%', padding: '8px', borderRadius: 8, marginBottom: 8,
                border: activeLoyaltyMember ? '1px solid rgba(0,230,118,.35)' : '1px solid var(--border)',
                background: activeLoyaltyMember ? 'rgba(0,230,118,.08)' : 'var(--bg3)',
                color: activeLoyaltyMember ? 'var(--green)' : 'var(--gray)',
                fontSize: 12, fontWeight: 600, cursor: 'pointer',
              }}>
              {activeLoyaltyMember ? `🎁 ${activeLoyaltyMember.full_name} bağlıdır` : '🎁 Loyallıq üzvü bağla'}
            </button>
            <button className="btn-primary" disabled={isTableLocked} onClick={() => { setMobileCartOpen(false); setShowPayment(true) }}>💳 Ödəniş Al</button>
            <div className="btn-split">
              <button className="btn-secondary" disabled={isTableLocked} onClick={sendToKitchen}>🍳 Mətbəxə</button>
              {can(user, 'void') && (
                <button className="btn-secondary btn-danger" disabled={isTableLocked} onClick={voidTable}>✕ Ləğv Et</button>
              )}
            </div>
          </div>
        </>}
      </div>

      <ReserveModal
        open={reserveModal.open}
        tableNumber={reserveModal.table}
        onClose={() => setReserveModal({ open: false, table: null })}
        onConfirm={(name, phone, date, time) => {
          createReservation(reserveModal.table, name, phone, date, time)
          setReserveModal({ open: false, table: null })
        }}
      />

      {showReservations && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}
          onClick={() => setShowReservations(false)}>
          <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 16, padding: 20, width: 'min(360px, 92vw)', maxHeight: '70vh', overflowY: 'auto', color: 'var(--white)' }}
            onClick={(e) => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 14px', fontSize: 15 }}>Gələcək rezervasiyalar</h3>
            {reservations.length === 0 ? (
              <p style={{ color: 'var(--gray2)', fontSize: 13 }}>Hələ rezervasiya yoxdur.</p>
            ) : reservations.map((r) => (
              <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>Masa {r.table_number} — {r.reserved_name}</div>
                  <div style={{ fontSize: 11, color: 'var(--gray2)' }}>{r.reserved_date} {formatTime(r.reserved_time)}{r.phone ? ` · ${r.phone}` : ''}</div>
                </div>
                <button onClick={() => deleteReservation(r.id)} style={{ background: 'none', border: 'none', color: '#FF5A5F', cursor: 'pointer', fontSize: 16 }}>✕</button>
              </div>
            ))}
            <button onClick={() => setShowReservations(false)} style={{ marginTop: 16, width: '100%', padding: 10, borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--gray2)', cursor: 'pointer' }}>
              Bağla
            </button>
          </div>
        </div>
      )}

      {showLoyaltyPanel && <LoyaltyPanel onClose={() => setShowLoyaltyPanel(false)} />}
    </>
  )
}