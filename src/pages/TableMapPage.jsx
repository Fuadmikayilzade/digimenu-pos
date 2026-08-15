import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '../utils/supabaseClient'
import { useApp } from '../context/AppContext'

const GRID_W = 800
const GRID_H = 500
const SNAP = 20

function snap(v) { return Math.round(v / SNAP) * SNAP }

export default function TableMapPage() {
  const { user, liveTables, loadLiveTables } = useApp()
  const [tables, setTables] = useState([])
  const [selected, setSelected] = useState(null)
  const [dragging, setDragging] = useState(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const boardRef = useRef(null)

  useEffect(() => {
    if (!user?.business_id) return
    loadTablePositions()
  }, [user])

  const loadTablePositions = async () => {
    let q = supabase.from('tables').select('*').eq('business_id', user.business_id)
    if (user.branch_id) q = q.eq('branch_id', user.branch_id)
    else q = q.is('branch_id', null)
    const { data } = await q.order('number')
    setTables((data || []).map(t => ({
      ...t,
      x: t.pos_x || 40,
      y: t.pos_y || 40 + (Number(t.number) - 1) * 100,
      w: t.width || 80,
      h: t.height || 60,
    })))
  }

  const onMouseDown = (e, id) => {
    e.preventDefault()
    const rect = boardRef.current.getBoundingClientRect()
    const t = tables.find(t => t.id === id)
    setSelected(id)
    setDragging({ id, startX: e.clientX - rect.left - t.x, startY: e.clientY - rect.top - t.y })
  }

  const onMouseMove = useCallback((e) => {
    if (!dragging) return
    const rect = boardRef.current.getBoundingClientRect()
    const nx = snap(Math.max(0, Math.min(GRID_W - 80, e.clientX - rect.left - dragging.startX)))
    const ny = snap(Math.max(0, Math.min(GRID_H - 60, e.clientY - rect.top - dragging.startY)))
    setTables(prev => prev.map(t => t.id === dragging.id ? { ...t, x: nx, y: ny } : t))
  }, [dragging])

  const onMouseUp = () => setDragging(null)

  const savePositions = async () => {
    setSaving(true)
    for (const t of tables) {
      await supabase.from('tables').update({ pos_x: t.x, pos_y: t.y, width: t.w, height: t.h }).eq('id', t.id)
    }
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const toggleShape = (id) => {
    setTables(prev => prev.map(t => t.id === id ? { ...t, shape: t.shape === 'circle' ? 'rect' : 'circle' } : t))
  }

  const statusColor = (status) => {
    if (status === 'dolu') return '#00E6A8'
    if (status === 'rezerv') return '#FF9F5A'
    return 'rgba(255,255,255,0.15)'
  }

  return (
    <div style={{ padding: 24, fontFamily: 'system-ui', height: '100%', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ color: 'var(--white)', fontSize: 18, fontWeight: 800 }}>🗺️ Masa Planı</div>
          <div style={{ color: 'var(--gray2)', fontSize: 12, marginTop: 2 }}>Masaları sürükləyərək yerləşdirin. Sağ-klik — formanı dəyiş.</div>
        </div>
        <button onClick={savePositions} disabled={saving}
          style={{ padding: '10px 20px', borderRadius: 10, border: 'none', background: saved ? 'var(--green)' : 'var(--accent)', color: '#001018', fontWeight: 700, cursor: 'pointer', fontSize: 13 }}>
          {saving ? 'Saxlanılır...' : saved ? '✅ Saxlanıldı' : '💾 Yadda saxla'}
        </button>
      </div>

      {/* Legenda */}
      <div style={{ display: 'flex', gap: 16, fontSize: 12, color: 'var(--gray2)' }}>
        {[['rgba(255,255,255,0.15)', 'Boş'], ['#00E6A8', 'Dolu'], ['#FF9F5A', 'Rezerv']].map(([c, l]) => (
          <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 10, height: 10, borderRadius: 3, background: c }} />{l}
          </div>
        ))}
        <div style={{ color: 'var(--gray2)', marginLeft: 'auto' }}>💡 Sağ-klik → masa formasını dəyiş</div>
      </div>

      {/* Planın özü */}
      <div
        ref={boardRef}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
        style={{
          position: 'relative', width: GRID_W, height: GRID_H,
          background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 16,
          overflow: 'hidden', cursor: dragging ? 'grabbing' : 'default',
          backgroundImage: `linear-gradient(var(--border) 1px, transparent 1px), linear-gradient(90deg, var(--border) 1px, transparent 1px)`,
          backgroundSize: `${SNAP}px ${SNAP}px`,
        }}>

        {/* Giriş etiketi */}
        <div style={{ position: 'absolute', bottom: 12, left: '50%', transform: 'translateX(-50%)', color: 'var(--gray2)', fontSize: 11, pointerEvents: 'none' }}>
          ↑ Giriş
        </div>

        {tables.map(t => {
          const isCircle = t.shape === 'circle'
          const isSelected = selected === t.id
          const sc = statusColor(t.status)

          return (
            <div
              key={t.id}
              onMouseDown={e => onMouseDown(e, t.id)}
              onContextMenu={e => { e.preventDefault(); toggleShape(t.id) }}
              style={{
                position: 'absolute', left: t.x, top: t.y,
                width: isCircle ? 70 : t.w, height: isCircle ? 70 : t.h,
                borderRadius: isCircle ? '50%' : 12,
                background: sc,
                border: `2px solid ${isSelected ? 'var(--white)' : sc === 'rgba(255,255,255,0.15)' ? 'rgba(255,255,255,0.2)' : sc}`,
                cursor: 'grab', userSelect: 'none',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                transition: dragging?.id === t.id ? 'none' : 'box-shadow .15s',
                boxShadow: isSelected ? `0 0 0 3px rgba(255,255,255,0.3)` : 'none',
              }}>
              <span style={{ fontSize: 13, fontWeight: 800, color: sc === 'rgba(255,255,255,0.15)' ? 'var(--gray)' : '#001018' }}>M{t.number}</span>
              <span style={{ fontSize: 10, color: sc === 'rgba(255,255,255,0.15)' ? 'var(--gray2)' : '#00151080' }}>
                {t.status === 'rezerv' && t.reserved_name ? t.reserved_name.split(' ')[0] : t.status}
              </span>
            </div>
          )
        })}
      </div>

      <div style={{ color: 'var(--gray2)', fontSize: 11 }}>
        Cəmi {tables.length} masa · Yadda saxlamadan sonra növbəti seans üçün mövqe saxlanılır.
      </div>
    </div>
  )
}
