import { createContext, useContext, useState, useCallback, useMemo, useEffect, useRef } from 'react'
import { TABLE_COUNT, TAX_RATE, can } from '../utils/constants'
import { genId, nowTime, nowFull, toISODate } from '../utils/helpers'
import { api } from '../utils/api'

const AppContext = createContext(null)
export const useApp = () => useContext(AppContext)

// ── localStorage helpers ──────────────────────────────────────────
const LS = {
  get: (key, fallback) => {
    try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback }
    catch { return fallback }
  },
  set: (key, val) => {
    try { localStorage.setItem(key, JSON.stringify(val)) } catch {}
  },
}

const initTables = () => {
  const t = {}
  for (let i = 1; i <= TABLE_COUNT; i++) t[i] = { items: [], note: '', discount: 0 }
  return t
}

export function AppProvider({ children }) {
  // ── Auth ─────────────────────────────────────────────────────────
  const [user, setUser] = useState(() => LS.get('pos_user', null))

  // ── UI ───────────────────────────────────────────────────────────
  const [view, setView] = useState(() => {
    const u = LS.get('pos_user', null)
    return u?.role === 'kitchen' ? 'kitchen' : 'pos'
  })
  const [activeCat, setActiveCat]     = useState('Hamısı')
  const [search, setSearch]           = useState('')
  const [activeTable, setActiveTable] = useState(1)

  // ── Menu ─────────────────────────────────────────────────────────
  const [menuItems, setMenuItems] = useState([])
  const [loading, setLoading]     = useState(true)

  // ── Tables — localStorage ────────────────────────────────────────
  const [tables, setTablesRaw] = useState(() => LS.get('pos_tables', null) || initTables())

  const setTables = useCallback((updater) => {
    setTablesRaw(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater
      LS.set('pos_tables', next)
      return next
    })
  }, [])

  // ── Orders — localStorage ────────────────────────────────────────
  const [orders, setOrdersRaw] = useState(() => LS.get('pos_orders', []))

  const setOrders = useCallback((updater) => {
    setOrdersRaw(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater
      LS.set('pos_orders', next)
      return next
    })
  }, [])

  // ── Kitchen Tickets — localStorage ──────────────────────────────
  const [tickets, setTicketsRaw] = useState(() => LS.get('pos_tickets', []))
  const prevTicketsRef = useRef(null)

  const setTickets = useCallback((updater) => {
    setTicketsRaw(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater
      LS.set('pos_tickets', next)
      return next
    })
  }, [])

  // ── Ready notifications ──────────────────────────────────────────
  const [readyNotifs, setReadyNotifsRaw] = useState(() => LS.get('pos_ready_notifs', []))

  const setReadyNotifs = useCallback((updater) => {
    setReadyNotifsRaw(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater
      LS.set('pos_ready_notifs', next)
      return next
    })
  }, [])

  // ── Toasts ───────────────────────────────────────────────────────
  const [toasts, setToasts] = useState([])
  const [showPayment, setShowPayment] = useState(false)
  const [showReceipt, setShowReceipt] = useState(null)
  const [confirmDel, setConfirmDel]   = useState(null)

  const toast = useCallback((msg, type = 'success', duration = 3500) => {
    const id = Date.now() + Math.random()
    setToasts(t => [...t, { id, msg, type }])
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), duration)
  }, [])

  // ── Cross-tab sinxronizasiya (storage event) ──────────────────────
  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'pos_tables' && e.newValue) {
        try { setTablesRaw(JSON.parse(e.newValue)) } catch {}
      }
      if (e.key === 'pos_orders' && e.newValue) {
        try { setOrdersRaw(JSON.parse(e.newValue)) } catch {}
      }
      if (e.key === 'pos_tickets' && e.newValue) {
        try { setTicketsRaw(JSON.parse(e.newValue)) } catch {}
      }
      if (e.key === 'pos_ready_notifs' && e.newValue) {
        try { setReadyNotifsRaw(JSON.parse(e.newValue)) } catch {}
      }
    }
    window.addEventListener('storage', handler)
    return () => window.removeEventListener('storage', handler)
  }, [toast, setReadyNotifs])

  // ── Ticket status dəyişikliyini izlə — YALNIZ BİR YERDƏ bildiriş ─
  useEffect(() => {
    const prev = prevTicketsRef.current
    if (prev === null) { prevTicketsRef.current = tickets; return }

    // Yeni "ready" olan ticketlər
    const justReady = tickets.filter(nt =>
      nt.status === 'ready' &&
      prev.some(pt => pt.id === nt.id && pt.status !== 'ready')
    )

    // Yalnız kasiyer/admin üçün, yalnız eyni tabda
    if (user && user.role !== 'kitchen' && justReady.length > 0) {
      justReady.forEach(t => {
        const notif = { id: t.id + '_ready', tableNum: t.table, ticketId: t.id, time: nowTime() }
        setReadyNotifs(rn => {
          // Eyni ticket üçün dublikat əlavə etmə
          if (rn.some(n => n.notifId === notif.id)) return rn
          return [{ ...notif, notifId: notif.id, id: Date.now() + Math.random() }, ...rn].slice(0, 20)
        })
        toast(`🍽 Masa ${t.table} hazırdır!`, 'ready', 7000)
      })
    }

    prevTicketsRef.current = tickets
  }, [tickets]) // eslint-disable-line

  // ── Auth ─────────────────────────────────────────────────────────
  const handleLogin = useCallback((u) => {
    LS.set('pos_user', u)
    setUser(u)
    setView(u.role === 'kitchen' ? 'kitchen' : 'pos')
  }, [])

  const handleLogout = useCallback(() => {
    LS.set('pos_user', null)
    setUser(null)
    setView('pos')
    // Masa və sifarişlər saxlanılır — data itmir
  }, [])

  // ── Fetch menu ───────────────────────────────────────────────────
  useEffect(() => {
    if (!user) return
    const cached = LS.get('pos_menu', null)
    if (cached?.length) { setMenuItems(cached); setLoading(false) }
    fetch('https://opensheet.elk.sh/1-reT1K4Bbv771_JIoz12wRqhNxYOlaJXpLy7VRtH7Cs/menu1')
      .then(r => r.json())
      .then(data => {
        const parsed = data
          .filter(row => row.id && row.name && row.category)
          .map(row => ({
            id: Number(row.id), name: row.name || '',
            price: parseFloat(row.price) || 0, category: row.category || '',
            emoji: row.emoji || '🍽', description: row.description || '',
            image: row.image || '',
          }))
        setMenuItems(parsed)
        LS.set('pos_menu', parsed)
      })
      .catch(() => { if (!cached?.length) toast('Menyu yüklənmədi', 'error') })
      .finally(() => setLoading(false))
  }, [user, toast])

  // ── Load today orders from backend ───────────────────────────────
  useEffect(() => {
    if (!user) return
    api.orders.list(toISODate())
      .then(data => {
        const mapped = data.map(o => ({
          id: o.id, table: o.table_num, items: o.items,
          subtotal: o.subtotal, discount: o.discount, tax: o.tax, total: o.total,
          method: o.method, cashGiven: o.cash_given, change: o.change_amt,
          cashier: o.cashier, note: o.note, voided: Boolean(o.voided),
          time: new Date(o.created_at).toLocaleString('az'),
        }))
        if (mapped.length) setOrders(mapped)
      })
      .catch(() => {})
  }, [user]) // eslint-disable-line

  // ── Cart ─────────────────────────────────────────────────────────
  const cart         = tables[activeTable]
  const cartSubtotal = useMemo(() => cart.items.reduce((s, i) => s + i.price * i.qty, 0), [cart.items])
  const discountAmt  = cartSubtotal * (cart.discount / 100)
  const taxAmt       = (cartSubtotal - discountAmt) * TAX_RATE
  const cartTotal    = cartSubtotal - discountAmt + taxAmt

  const addItem = useCallback(item => {
    setTables(prev => {
      const cur = prev[activeTable]
      const ex  = cur.items.find(i => i.id === item.id)
      return { ...prev, [activeTable]: { ...cur, items: ex
        ? cur.items.map(i => i.id === item.id ? { ...i, qty: i.qty + 1 } : i)
        : [...cur.items, { ...item, qty: 1 }] } }
    })
  }, [activeTable, setTables])

  const updateQty = useCallback((id, delta) => {
    setTables(prev => {
      const cur = prev[activeTable]
      return { ...prev, [activeTable]: { ...cur,
        items: cur.items.map(i => i.id === id ? { ...i, qty: i.qty + delta } : i).filter(i => i.qty > 0) } }
    })
  }, [activeTable, setTables])

  const setNote     = v => setTables(p => ({ ...p, [activeTable]: { ...p[activeTable], note: v } }))
  const setDiscount = v => setTables(p => ({ ...p, [activeTable]: { ...p[activeTable], discount: Math.min(100, Math.max(0, Number(v) || 0)) } }))

  // ── Kitchen ──────────────────────────────────────────────────────
  const sendToKitchen = () => {
    if (!cart.items.length) return toast('Sifariş boşdur', 'error')
    const ticket = {
      id: genId(), table: activeTable,
      items: cart.items.map(i => ({ ...i, done: false })),
      note: cart.note, time: nowTime(), status: 'new', created: Date.now(),
    }
    setTickets(p => [...p, ticket])
    toast(`Masa ${activeTable} mətbəxə göndərildi 🍳`)
  }

  // ── Payment ──────────────────────────────────────────────────────
  const confirmPayment = async (method, cashGiven, orderId) => {
    const ch = method === 'cash' ? Math.max(0, cashGiven - cartTotal) : 0
    const receipt = {
      id: orderId, table: activeTable, items: cart.items,
      subtotal: cartSubtotal, discount: cart.discount,
      tax: taxAmt, total: cartTotal, method, cashGiven, change: ch,
      time: nowFull(), cashier: user?.name || '', voided: false,
    }
    setOrders(p => [receipt, ...p])
    setTables(p => ({ ...p, [activeTable]: { items: [], note: '', discount: 0 } }))
    setTickets(p => p.filter(t => t.table !== activeTable))
    setShowPayment(false)
    setShowReceipt(receipt)
    toast(`Masa ${activeTable} ödənildi ✓`)
    try {
      await api.orders.create({
        id: receipt.id, table: receipt.table, items: receipt.items,
        subtotal: receipt.subtotal, discount: receipt.discount,
        tax: receipt.tax, total: receipt.total, method: receipt.method,
        cashGiven: receipt.cashGiven, change: receipt.change,
        cashier: receipt.cashier, note: receipt.note || '',
        voided: false, time: new Date().toISOString(),
      })
    } catch {}
  }

  const voidTable = () => {
    if (!cart.items.length) return
    if (!can(user, 'void')) return toast('Bu əməliyyat üçün icazəniz yoxdur', 'error')
    const receipt = {
      id: genId(), table: activeTable, items: cart.items,
      subtotal: cartSubtotal, discount: cart.discount,
      tax: taxAmt, total: cartTotal, method: 'void',
      cashGiven: 0, change: 0, time: nowFull(), cashier: user?.name || '', voided: true,
    }
    setOrders(p => [receipt, ...p])
    setTables(p => ({ ...p, [activeTable]: { items: [], note: '', discount: 0 } }))
    toast(`Masa ${activeTable} ləğv edildi`, 'info')
  }

  const deleteOrder = (id) => {
    if (!can(user, 'delete')) return toast('Yalnız admin silə bilər', 'error')
    setConfirmDel(id)
  }

  const doDelete = async () => {
    setOrders(p => p.filter(o => o.id !== confirmDel))
    try { await api.orders.delete(confirmDel) } catch {}
    setConfirmDel(null)
    toast('Çek silindi', 'info')
  }

  const dismissReadyNotif = (id) => setReadyNotifs(rn => rn.filter(n => n.id !== id))
  const clearReadyNotifs  = () => setReadyNotifs([])

  // ── Stats ─────────────────────────────────────────────────────────
  const paidOrders  = orders.filter(o => !o.voided)
  const todaySales  = paidOrders.reduce((s, o) => s + o.total, 0)
  const openTables  = Object.values(tables).filter(t => t.items.length > 0).length
  const ticketCount = tickets.filter(t => t.status !== 'ready').length

  const filteredMenu = useMemo(() => menuItems.filter(item => {
    const mc = activeCat === 'Hamısı' || item.category === activeCat
    const q  = search.toLowerCase()
    return mc && (!q || item.name.toLowerCase().includes(q))
  }), [menuItems, activeCat, search])

  const catCounts = useMemo(() => {
    const c = {}; menuItems.forEach(i => { c[i.category] = (c[i.category] || 0) + 1 }); return c
  }, [menuItems])

  const topItems = useMemo(() => {
    const c = {}
    paidOrders.forEach(o => (o.items || []).forEach(it => { c[it.name] = (c[it.name] || 0) + it.qty }))
    return Object.entries(c).sort((a, b) => b[1] - a[1]).slice(0, 8)
  }, [paidOrders])

  const value = {
    user, handleLogin, handleLogout,
    view, setView, activeCat, setActiveCat, search, setSearch,
    activeTable, setActiveTable,
    menuItems, filteredMenu, catCounts, loading,
    tables, cart, cartSubtotal, discountAmt, taxAmt, cartTotal,
    addItem, updateQty, setNote, setDiscount,
    tickets, setTickets, sendToKitchen, ticketCount,
    orders, setOrders, paidOrders, todaySales, openTables, topItems,
    confirmPayment, voidTable, deleteOrder, doDelete,
    showPayment, setShowPayment, showReceipt, setShowReceipt,
    confirmDel, setConfirmDel,
    toasts, toast,
    readyNotifs, dismissReadyNotif, clearReadyNotifs,
  }

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}
