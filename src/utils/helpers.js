export const fmt   = n => `${Number(n).toFixed(2)} ₼`
export const fmtN  = n => Number(n).toFixed(2)
export const genId = () => '#' + Math.random().toString(36).substr(2, 6).toUpperCase()
export const nowTime = () => new Date().toLocaleTimeString('az', { hour: '2-digit', minute: '2-digit' })
export const nowDate = () => new Date().toLocaleDateString('az', { day: '2-digit', month: '2-digit', year: 'numeric' })
export const nowFull = () => new Date().toLocaleString('az', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
export const toISODate = () => new Date().toISOString().slice(0, 10)
