import { Router } from 'express'
import db from '../db.js'

const router = Router()

// ── GET /api/reports/daily?date=YYYY-MM-DD ─────────────────────────
router.get('/daily', (req, res) => {
  const date = req.query.date || new Date().toISOString().slice(0, 10)

  db.read()

  const allOrders = db.data.orders.filter(o =>
    o.created_at && o.created_at.startsWith(date)
  )

  const orders = allOrders.map(o => ({
    ...o,
    items: db.data.orderItems.filter(it => it.order_id === o.id),
  })).sort((a, b) => b.created_at.localeCompare(a.created_at))

  const paid = orders.filter(o => !o.voided)

  const totalRevenue  = paid.reduce((s, o) => s + o.total, 0)
  const totalTax      = paid.reduce((s, o) => s + o.tax, 0)
  const totalDiscount = paid.reduce((s, o) => s + (o.subtotal * o.discount / 100), 0)

  // Category breakdown
  const catMap = {}
  paid.forEach(o => o.items.forEach(it => {
    catMap[it.category] = (catMap[it.category] || 0) + it.price * it.qty
  }))

  // Top items
  const itemMap = {}
  paid.forEach(o => o.items.forEach(it => {
    itemMap[it.name] = (itemMap[it.name] || 0) + it.qty
  }))
  const topItems = Object.entries(itemMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)

  // Payment methods
  const methodMap = {
    cash: { count: 0, total: 0 },
    card: { count: 0, total: 0 },
    qr:   { count: 0, total: 0 },
  }
  paid.forEach(o => {
    if (methodMap[o.method]) {
      methodMap[o.method].count++
      methodMap[o.method].total += o.total
    }
  })

  // Hourly sales (0-23)
  const hourlySales = {}
  for (let h = 0; h < 24; h++) {
    const total = paid
      .filter(o => new Date(o.created_at).getHours() === h)
      .reduce((s, o) => s + o.total, 0)
    hourlySales[h] = { hour: h, total }
  }

  // Table activity
  const tableActivity = {}
  paid.forEach(o => {
    tableActivity[o.table_num] = (tableActivity[o.table_num] || 0) + o.total
  })

  res.json({
    date,
    summary: {
      totalOrders:    orders.length,
      paidOrders:     paid.length,
      voidedOrders:   orders.filter(o => o.voided).length,
      totalRevenue,
      totalTax,
      totalDiscount,
      avgOrder:       paid.length ? totalRevenue / paid.length : 0,
    },
    orders,
    categoryBreakdown: catMap,
    topItems,
    paymentMethods:  methodMap,
    hourlySales,
    tableActivity,
  })
})

// ── GET /api/reports/dates ─────────────────────────────────────────
router.get('/dates', (req, res) => {
  db.read()

  const dateMap = {}
  db.data.orders.forEach(o => {
    const d = o.created_at?.slice(0, 10)
    if (d) dateMap[d] = (dateMap[d] || 0) + 1
  })

  const rows = Object.entries(dateMap)
    .map(([date, order_count]) => ({ date, order_count }))
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 90)

  res.json(rows)
})

// ── GET /api/reports/range?from=&to= ──────────────────────────────
router.get('/range', (req, res) => {
  const { from, to } = req.query
  if (!from || !to) return res.status(400).json({ error: 'from and to required' })

  db.read()

  const dateMap = {}
  db.data.orders.forEach(o => {
    const d = o.created_at?.slice(0, 10)
    if (!d || d < from || d > to) return
    if (!dateMap[d]) dateMap[d] = { date: d, total_orders: 0, paid_orders: 0, revenue: 0 }
    dateMap[d].total_orders++
    if (!o.voided) {
      dateMap[d].paid_orders++
      dateMap[d].revenue += o.total
    }
  })

  const rows = Object.values(dateMap).sort((a, b) => a.date.localeCompare(b.date))
  res.json(rows)
})

export default router
