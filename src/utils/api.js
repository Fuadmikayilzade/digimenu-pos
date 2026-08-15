// digimenu-pos/frontend/src/utils/api.js
//
// Köhnə Express+lowdb backend-i artıq istifadə olunmur — bütün data
// birbaşa Supabase-dən gəlir. Bu fayl köhnə "api.orders.*", "api.reports.*"
// interfeysini saxlayır ki, DashboardPage/OrdersPage/ReportsPage dəyişməsin.

import { supabase } from './supabaseClient'

function getBusinessId() {
  try {
    const u = JSON.parse(localStorage.getItem('pos_user'))
    return u?.business_id || null
  } catch { return null }
}

async function fetchOrdersForRange(businessId, fromISO, toISO, branchOption) {
  let query = supabase
    .from('orders')
    .select('*, order_items(*), tables(number)')
    .eq('business_id', businessId)
    .gte('created_at', fromISO)
    .lt('created_at', toISO)

  if (branchOption !== 'all') {
    query = branchOption ? query.eq('branch_id', branchOption) : query.is('branch_id', null)
  }

  const { data, error } = await query.order('created_at', { ascending: false })

  if (error || !data) return []

  return data.map(o => ({
    id: o.id,
    table_num: o.tables?.number || '-',
    total: Number(o.total) || 0,
    subtotal: Number(o.total) || 0, // ayrıca subtotal saxlanmır, total ilə eyni qəbul edilir
    tax: 0,
    discount: 0,
    method: 'cash',
    voided: o.status === 'ləğv',
    created_at: o.created_at,
    items: (o.order_items || []).map(it => ({
      name: it.name || '', category: it.category || '',
      price: Number(it.price) || 0, qty: it.quantity || 1,
    })),
  }))
}

export const api = {
  branches: {
    list: async () => {
      const businessId = getBusinessId()
      if (!businessId) return []
      const { data } = await supabase.from('branches').select('*').eq('business_id', businessId)
      return data || []
    },
  },

  orders: {
    list: async (date, branchOption) => {
      const businessId = getBusinessId()
      if (!businessId) return []
      const day = date || new Date().toISOString().slice(0, 10)
      const from = new Date(`${day}T00:00:00`)
      const to = new Date(from); to.setDate(to.getDate() + 1)
      return fetchOrdersForRange(businessId, from.toISOString(), to.toISOString(), branchOption)
    },
    delete: async (id) => {
      await supabase.from('orders').delete().eq('id', id)
    },
  },

  reports: {
    daily: async (date, branchOption) => {
      const businessId = getBusinessId()
      const day = date || new Date().toISOString().slice(0, 10)
      const orders = businessId ? await fetchOrdersForRange(
        businessId,
        new Date(`${day}T00:00:00`).toISOString(),
        (() => { const t = new Date(`${day}T00:00:00`); t.setDate(t.getDate() + 1); return t.toISOString() })(),
        branchOption
      ) : []

      const paid = orders.filter(o => !o.voided)
      const totalRevenue  = paid.reduce((s, o) => s + o.total, 0)
      const totalTax      = paid.reduce((s, o) => s + o.tax, 0)
      const totalDiscount = paid.reduce((s, o) => s + o.discount, 0)

      const catMap = {}
      paid.forEach(o => o.items.forEach(it => { catMap[it.category] = (catMap[it.category] || 0) + it.price * it.qty }))

      const itemMap = {}
      paid.forEach(o => o.items.forEach(it => { itemMap[it.name] = (itemMap[it.name] || 0) + it.qty }))
      const topItems = Object.entries(itemMap).sort((a, b) => b[1] - a[1]).slice(0, 10)

      const methodMap = { cash: { count: 0, total: 0 }, card: { count: 0, total: 0 }, qr: { count: 0, total: 0 } }
      paid.forEach(o => { if (methodMap[o.method]) { methodMap[o.method].count++; methodMap[o.method].total += o.total } })

      const hourlySales = {}
      for (let h = 0; h < 24; h++) {
        const total = paid.filter(o => new Date(o.created_at).getHours() === h).reduce((s, o) => s + o.total, 0)
        hourlySales[h] = { hour: h, total }
      }

      const tableActivity = {}
      paid.forEach(o => { tableActivity[o.table_num] = (tableActivity[o.table_num] || 0) + o.total })

      return {
        date: day,
        summary: {
          totalOrders: orders.length, paidOrders: paid.length,
          voidedOrders: orders.filter(o => o.voided).length,
          totalRevenue, totalTax, totalDiscount,
          avgOrder: paid.length ? totalRevenue / paid.length : 0,
        },
        orders, categoryBreakdown: catMap, topItems,
        paymentMethods: methodMap, hourlySales, tableActivity,
      }
    },

    dates: async (branchOption) => {
      const businessId = getBusinessId()
      if (!businessId) return []
      let q = supabase.from('orders').select('created_at').eq('business_id', businessId)
      if (branchOption !== 'all') q = branchOption ? q.eq('branch_id', branchOption) : q.is('branch_id', null)
      const { data } = await q
      const dateMap = {}
      ;(data || []).forEach(o => {
        const d = o.created_at?.slice(0, 10)
        if (d) dateMap[d] = (dateMap[d] || 0) + 1
      })
      return Object.entries(dateMap)
        .map(([date, order_count]) => ({ date, order_count }))
        .sort((a, b) => b.date.localeCompare(a.date)).slice(0, 90)
    },

    range: async (from, to, branchOption) => {
      const businessId = getBusinessId()
      if (!businessId) return []
      let q = supabase.from('orders').select('total, status, created_at, branch_id')
        .eq('business_id', businessId)
        .gte('created_at', `${from}T00:00:00`).lte('created_at', `${to}T23:59:59`)
      if (branchOption !== 'all') q = branchOption ? q.eq('branch_id', branchOption) : q.is('branch_id', null)
      const { data } = await q
      const dateMap = {}
      ;(data || []).forEach(o => {
        const d = o.created_at?.slice(0, 10)
        if (!d) return
        if (!dateMap[d]) dateMap[d] = { date: d, total_orders: 0, paid_orders: 0, revenue: 0 }
        dateMap[d].total_orders++
        if (o.status !== 'ləğv') { dateMap[d].paid_orders++; dateMap[d].revenue += Number(o.total) || 0 }
      })
      return Object.values(dateMap).sort((a, b) => a.date.localeCompare(b.date))
    },
  },
}
