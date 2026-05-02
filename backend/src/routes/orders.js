import { Router } from 'express'
import db from '../db.js'

const router = Router()

// ── GET /api/orders?date=YYYY-MM-DD ───────────────────────────────
router.get('/', (req, res) => {
  const { date } = req.query
  db.read()

  let orders = db.data.orders

  if (date) {
    orders = orders.filter(o => o.created_at && o.created_at.startsWith(date))
  }

  // Sort newest first
  orders = [...orders].sort((a, b) => b.created_at?.localeCompare(a.created_at))

  // Attach items
  const result = orders.map(o => ({
    ...o,
    items: db.data.orderItems.filter(it => it.order_id === o.id),
  }))

  res.json(result)
})

// ── POST /api/orders ──────────────────────────────────────────────
router.post('/', (req, res) => {
  const {
    id, table, items = [], subtotal, discount, tax, total,
    method, cashGiven = 0, change = 0, cashier = '', note = '',
    voided = false, time,
  } = req.body

  if (!id || !table || total === undefined) {
    return res.status(400).json({ error: 'id, table, total required' })
  }

  db.read()

  // Check duplicate
  if (db.data.orders.find(o => o.id === id)) {
    return res.status(409).json({ error: 'Order already exists' })
  }

  const createdAt = time || new Date().toISOString()

  const order = {
    id, table_num: table, subtotal: subtotal ?? 0, discount: discount ?? 0,
    tax: tax ?? 0, total, method: method || 'cash',
    cash_given: cashGiven, change_amt: change,
    cashier, note, voided: Boolean(voided), created_at: createdAt,
  }

  db.data.orders.push(order)

  items.forEach(it => {
    db.data.orderItems.push({
      order_id: id, item_id: it.id || 0, name: it.name,
      price: it.price, qty: it.qty,
      emoji: it.emoji || '🍽', category: it.category || '',
    })
  })

  db.write()
  res.status(201).json({ ok: true, id })
})

// ── DELETE /api/orders/:id ────────────────────────────────────────
router.delete('/:id', (req, res) => {
  const { id } = req.params
  db.read()

  const before = db.data.orders.length
  db.data.orders     = db.data.orders.filter(o => o.id !== id)
  db.data.orderItems = db.data.orderItems.filter(it => it.order_id !== id)

  if (db.data.orders.length === before) {
    return res.status(404).json({ error: 'Not found' })
  }

  db.write()
  res.json({ ok: true })
})

export default router
