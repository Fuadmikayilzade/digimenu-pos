const BASE = typeof window !== 'undefined' && window.location.hostname !== 'localhost'
  ? 'https://digimenu-pos-production.up.railway.app/api'
  : '/api'

async function request(path, opts = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...opts,
  })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

export const api = {
  orders: {
    list: (date) =>
      request(`/orders${date ? `?date=${date}` : ''}`),
    create: (order) =>
      request('/orders', { method: 'POST', body: JSON.stringify(order) }),
    delete: (id) =>
      request(`/orders/${id}`, { method: 'DELETE' }),
  },
  reports: {
    daily: (date) =>
      request(`/reports/daily${date ? `?date=${date}` : ''}`),
    dates: () =>
      request('/reports/dates'),
    range: (from, to) =>
      request(`/reports/range?from=${from}&to=${to}`),
  },
  health: () => request('/health'),
}