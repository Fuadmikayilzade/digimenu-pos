import { useApp } from '../context/AppContext'
import { CATS, can, TABLE_COUNT } from '../utils/constants'
import { fmt } from '../utils/helpers'
import MenuItemCard from '../components/MenuItemCard'

export default function POSPage() {
  const {
    user, activeCat, setActiveCat, search, setSearch,
    filteredMenu, catCounts, loading,
    tables, activeTable, setActiveTable,
    cart, cartSubtotal, discountAmt, taxAmt, cartTotal,
    addItem, updateQty, setNote, setDiscount,
    sendToKitchen, voidTable, setShowPayment,
  } = useApp()

  const tableSum = (n) => {
    const t = tables[n]
    return t.items.reduce((s, i) => s + i.price * i.qty, 0)
  }

  return (
    <>
      {/* SIDEBAR */}
      <div className="sidebar">
        <div className="sidebar-section">
          <div className="sidebar-label">Kateqoriyalar</div>
          {CATS.map(c => (
            <button key={c.name} className={`cat-btn${activeCat === c.name ? ' active' : ''}`}
              onClick={() => setActiveCat(c.name)}>
              <span className="cat-icon">{c.icon}</span>
              {c.name}
              {c.name !== 'Hamısı' && (
                <span className="cat-count">{catCounts[c.name] || 0}</span>
              )}
            </button>
          ))}
        </div>

        <div className="sidebar-section">
          <div className="sidebar-label">Masalar</div>
          <div className="table-grid">
            {Array.from({ length: TABLE_COUNT }, (_, i) => {
              const n   = i + 1
              const sum = tableSum(n)
              const occ = sum > 0
              return (
                <button key={n}
                  className={`table-btn${activeTable === n ? ' active' : ''}${occ ? ' occupied' : ''}`}
                  onClick={() => setActiveTable(n)}>
                  <span className="table-num">M{n}</span>
                  <span className="table-sum">{occ ? `${sum.toFixed(0)}₼` : '—'}</span>
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
      <div className="cart-panel">
        <div className="cart-header">
          <span className="cart-title">🛒 Sifariş</span>
          <span className="cart-table-tag">Masa {activeTable}</span>
        </div>

        <div className="cart-items">
          {!cart.items.length
            ? <div className="cart-empty">
                <span className="cart-empty-icon">🛒</span>
                <p>Sifariş boşdur</p>
              </div>
            : cart.items.map(item => (
                <div key={item.id} className="cart-item">
                  <span className="cart-item-emoji">{item.emoji}</span>
                  <div className="cart-item-info">
                    <div className="cart-item-name">{item.name}</div>
                    <div className="cart-item-price">{(item.price * item.qty).toFixed(2)} ₼</div>
                  </div>
                  <div className="cart-item-controls">
                    <button className="qty-btn del" onClick={() => updateQty(item.id, -1)}>−</button>
                    <span className="qty-num">{item.qty}</span>
                    <button className="qty-btn" onClick={() => updateQty(item.id, 1)}>+</button>
                  </div>
                </div>
              ))
          }
        </div>

        {cart.items.length > 0 && <>
          <div className="cart-note">
            <textarea placeholder="Qeyd (allerji, xüsusi istək...)"
              value={cart.note} onChange={e => setNote(e.target.value)} />
          </div>

          {can(user, 'discount') && (
            <div className="discount-row">
              <span className="discount-label">Endirim %</span>
              <input className="discount-input" type="number" min="0" max="100"
                value={cart.discount} onChange={e => setDiscount(e.target.value)} />
            </div>
          )}

          <div className="cart-totals">
            <div className="total-row"><span>Ara cəm</span><span>{fmt(cartSubtotal)} ₼</span></div>
            {cart.discount > 0 && (
              <div className="total-row"><span>Endirim ({cart.discount}%)</span><span>-{fmt(discountAmt)} ₼</span></div>
            )}
            <div className="total-row"><span>ƏDV (18%)</span><span>{fmt(taxAmt)} ₼</span></div>
            <div className="total-row grand"><span>CƏMİ</span><span>{fmt(cartTotal)} ₼</span></div>
          </div>

          <div className="cart-actions">
            <button className="btn-primary" onClick={() => setShowPayment(true)}>💳 Ödəniş Al</button>
            <div className="btn-split">
              <button className="btn-secondary" onClick={sendToKitchen}>🍳 Mətbəxə</button>
              {can(user, 'void') && (
                <button className="btn-secondary btn-danger" onClick={voidTable}>✕ Ləğv Et</button>
              )}
            </div>
          </div>
        </>}
      </div>
    </>
  )
}
