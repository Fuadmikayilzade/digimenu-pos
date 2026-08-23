import { useState, useEffect, useCallback } from 'react'
import { useApp } from '../context/AppContext'
import { can } from '../utils/constants'
import { supabase } from '../utils/supabaseClient'
import ReserveModal from '../components/ReserveModal'

// ── Rezervasiya Siyahısı ─────────────────────────────────────────────
// ⚠️ YENİ SƆHİFƆ: Yalnız sahibkar/menecer görə bilər (bax: Topbar.jsx-
// dəki nav filtri, `can(user, 'reserve')`). Kontekstdəki `reservations`
// state-i YALNIZ gələcək tarixləri saxlayır (POS-un öz kiçik popup-u
// üçün optimallaşdırılıb) — bu səhifə isə TAM tarixçəni (keçmiş daxil)
// öz sorğusu ilə göstərir ki, "əvvəlki rezervasiyalara da baxmaq"
// mümkün olsun.
export default function ReservationsPage() {
  const { user, activeBranchId, updateReservation, deleteReservation } = useApp()

  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [dateFilter, setDateFilter] = useState('') // boşsa — hamısı
  const [detailRow, setDetailRow] = useState(null)
  const [editRow, setEditRow] = useState(null)

  const load = useCallback(async () => {
    if (!user?.business_id) return
    setLoading(true)
    let q = supabase.from('reservations').select('*').eq('business_id', user.business_id)
    q = activeBranchId ? q.eq('branch_id', activeBranchId) : q.is('branch_id', null)
    if (dateFilter) q = q.eq('reserved_date', dateFilter)
    const { data } = await q.order('reserved_date', { ascending: false }).order('reserved_time', { ascending: false })
    setRows(data || [])
    setLoading(false)
  }, [user, activeBranchId, dateFilter])

  useEffect(() => { load() }, [load])

  if (!can(user, 'reserve')) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
        <div style={{ textAlign: 'center', color: 'var(--gray2)' }}>
          <div style={{ fontSize: '3rem', marginBottom: 12 }}>🔒</div>
          <p style={{ fontSize: 14 }}>Bu bölməyə giriş icazəniz yoxdur</p>
        </div>
      </div>
    )
  }

  const filtered = rows.filter(r => {
    if (!search) return true
    const q = search.toLowerCase()
    return r.reserved_name?.toLowerCase().includes(q) || r.phone?.includes(q) || String(r.table_number).includes(q)
  })

  const formatTime = (t) => t ? t.slice(0, 5) : '—'
  const todayStr = new Date().toISOString().slice(0, 10)

  const handleDelete = (id) => {
    if (!window.confirm('Bu rezervasiyanı silmək istəyirsiniz?')) return
    deleteReservation(id)
    setDetailRow(null)
  }

  const handleUpdate = async (name, phone, date, time, note) => {
    await updateReservation(editRow.id, {
      tableNumber: editRow.table_number, reservedName: name, phone, reservedDate: date, reservedTime: time, note,
    })
    setEditRow(null)
    load()
  }

  return (
    <div style={{ padding: 20, height: '100%', overflowY: 'auto' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end', marginBottom: 16 }}>
        <h2 style={{ margin: 0, fontSize: 18, color: 'var(--white)' }}>📅 Rezervasiyalar</h2>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Ad, telefon, masa axtar..."
            style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg3)', color: 'var(--white)', fontSize: 12, minWidth: 180 }}
          />
          <input
            type="date" value={dateFilter} onChange={e => setDateFilter(e.target.value)}
            style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg3)', color: 'var(--white)', fontSize: 12 }}
          />
          {dateFilter && (
            <button onClick={() => setDateFilter('')} style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--gray2)', fontSize: 12, cursor: 'pointer' }}>
              Tarixi təmizlə
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <p style={{ color: 'var(--gray2)', fontSize: 13 }}>Yüklənir...</p>
      ) : filtered.length === 0 ? (
        <p style={{ color: 'var(--gray2)', fontSize: 13 }}>Rezervasiya tapılmadı.</p>
      ) : (
        <div style={{ display: 'grid', gap: 8 }}>
          {filtered.map(r => {
            const isPast = r.reserved_date < todayStr
            return (
              <div key={r.id}
                onClick={() => setDetailRow(r)}
                style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '12px 16px', borderRadius: 10, cursor: 'pointer',
                  background: 'var(--bg2)', border: '1px solid var(--border)',
                  opacity: isPast ? 0.55 : 1,
                }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--white)' }}>
                    Masa {r.table_number} — {r.reserved_name}
                    {isPast && <span style={{ marginLeft: 8, fontSize: 10, color: 'var(--gray2)', fontWeight: 400 }}>(keçmiş)</span>}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--gray2)', marginTop: 2 }}>
                    {r.reserved_date} · {formatTime(r.reserved_time)}{r.phone ? ` · ${r.phone}` : ''}
                  </div>
                  {r.note && <div style={{ fontSize: 11, color: 'var(--gray2)', marginTop: 4, fontStyle: 'italic' }}>📝 {r.note}</div>}
                </div>
                <div style={{ display: 'flex', gap: 6 }} onClick={e => e.stopPropagation()}>
                  <button onClick={() => setEditRow(r)} title="Redaktə et"
                    style={{ width: 30, height: 30, borderRadius: 7, border: '1px solid var(--border)', background: 'var(--bg3)', color: 'var(--accent)', cursor: 'pointer' }}>
                    ✎
                  </button>
                  <button onClick={() => handleDelete(r.id)} title="Sil"
                    style={{ width: 30, height: 30, borderRadius: 7, border: '1px solid var(--border)', background: 'var(--bg3)', color: '#FF5A5F', cursor: 'pointer' }}>
                    🗑
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Ətraflı baxış (klikləyəndə) */}
      {detailRow && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}
          onClick={() => setDetailRow(null)}>
          <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 16, padding: 24, width: 'min(340px, 90vw)', color: 'var(--white)' }}
            onClick={e => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 16px', fontSize: 16 }}>Masa {detailRow.table_number} — {detailRow.reserved_name}</h3>
            <div style={{ display: 'grid', gap: 10, fontSize: 13 }}>
              <div><span style={{ color: 'var(--gray2)' }}>Tarix:</span> {detailRow.reserved_date}</div>
              <div><span style={{ color: 'var(--gray2)' }}>Saat:</span> {formatTime(detailRow.reserved_time)}</div>
              <div><span style={{ color: 'var(--gray2)' }}>Telefon:</span> {detailRow.phone || '—'}</div>
              <div><span style={{ color: 'var(--gray2)' }}>Qeyd:</span> {detailRow.note || '—'}</div>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
              <button onClick={() => { setEditRow(detailRow); setDetailRow(null) }}
                style={{ flex: 1, padding: 10, borderRadius: 8, border: 'none', background: 'var(--accent)', color: '#001018', fontWeight: 700, cursor: 'pointer' }}>
                Redaktə et
              </button>
              <button onClick={() => handleDelete(detailRow.id)}
                style={{ flex: 1, padding: 10, borderRadius: 8, border: '1px solid #FF5A5F', background: 'transparent', color: '#FF5A5F', fontWeight: 700, cursor: 'pointer' }}>
                Sil
              </button>
            </div>
            <button onClick={() => setDetailRow(null)} style={{ marginTop: 10, width: '100%', padding: 10, borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--gray2)', cursor: 'pointer' }}>
              Bağla
            </button>
          </div>
        </div>
      )}

      {/* Redaktə modalı — mövcud ReserveModal-ı "editData" ilə istifadə edir */}
      <ReserveModal
        open={!!editRow}
        tableNumber={editRow?.table_number}
        editData={editRow}
        onClose={() => setEditRow(null)}
        onConfirm={handleUpdate}
      />
    </div>
  )
}