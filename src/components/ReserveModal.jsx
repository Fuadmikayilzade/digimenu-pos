import { useState, useEffect } from 'react'

// Rezervasiya konkret tarixə bağlıdır — bugünkü masa statusunu bloklamır.
// ⚠️ YENİ: `editData` verilibsə, modal REDAKTƆ rejimində açılır (Rezervasiya
// Siyahısı bölməsindən çağırılır) — mövcud dəyərlərlə doldurulur, "Rezerv et"
// əvəzinə "Yadda saxla" göstərilir.
export default function ReserveModal({ open, tableNumber, onClose, onConfirm, editData }) {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')
  const [note, setNote] = useState('')

  useEffect(() => {
    if (open) {
      if (editData) {
        setName(editData.reserved_name || '')
        setPhone(editData.phone || '')
        setDate(editData.reserved_date || '')
        setTime(editData.reserved_time?.slice(0, 5) || '19:00')
        setNote(editData.note || '')
      } else {
        const now = new Date()
        setName(''); setPhone(''); setNote('')
        setDate(now.toISOString().slice(0, 10))
        setTime('19:00')
      }
    }
  }, [open, editData])

  if (!open) return null

  const handleConfirm = () => {
    if (!name.trim() || !date) return
    onConfirm(name.trim(), phone.trim(), date, time, note.trim())
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
    }}>
      <div style={{
        background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 16,
        padding: 24, width: 'min(320px, 90vw)', color: 'var(--white)',
      }}>
        <h3 style={{ margin: '0 0 4px', fontSize: 16 }}>
          {editData ? `Rezervasiyanı redaktə et` : `Masa ${tableNumber} — Rezervasiya`}
        </h3>
        <p style={{ margin: '0 0 16px', fontSize: 11, color: 'var(--gray2)' }}>
          Seçdiyiniz tarixdə görünəcək, bugünkü masa istifadəsini bloklamayacaq.
        </p>

        <label style={{ fontSize: 12, color: 'var(--gray2)', display: 'block', marginBottom: 4 }}>Ad Soyad</label>
        <input
          value={name} onChange={(e) => setName(e.target.value)}
          placeholder="Rezerv edən şəxs"
          style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg3)', color: 'var(--white)', marginBottom: 12, boxSizing: 'border-box' }}
          autoFocus
        />

        <label style={{ fontSize: 12, color: 'var(--gray2)', display: 'block', marginBottom: 4 }}>Telefon</label>
        <input
          value={phone} onChange={(e) => setPhone(e.target.value)}
          placeholder="+994 50 123 45 67"
          style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg3)', color: 'var(--white)', marginBottom: 12, boxSizing: 'border-box' }}
        />

        <label style={{ fontSize: 12, color: 'var(--gray2)', display: 'block', marginBottom: 4 }}>Tarix</label>
        <input
          type="date" value={date} onChange={(e) => setDate(e.target.value)}
          min={editData ? undefined : new Date().toISOString().slice(0, 10)}
          style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg3)', color: 'var(--white)', marginBottom: 12, boxSizing: 'border-box' }}
        />

        <label style={{ fontSize: 12, color: 'var(--gray2)', display: 'block', marginBottom: 4 }}>Saat</label>
        <input
          type="time" value={time} onChange={(e) => setTime(e.target.value)}
          style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg3)', color: 'var(--white)', marginBottom: 12, boxSizing: 'border-box' }}
        />

        <label style={{ fontSize: 12, color: 'var(--gray2)', display: 'block', marginBottom: 4 }}>Qeyd (istəyə görə)</label>
        <textarea
          value={note} onChange={(e) => setNote(e.target.value)}
          placeholder="Məs. pəncərə kənarı istəyir, ad günüdür..."
          rows={2}
          style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg3)', color: 'var(--white)', marginBottom: 18, boxSizing: 'border-box', resize: 'vertical', fontFamily: 'inherit' }}
        />

        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={handleConfirm} style={{ flex: 1, padding: 10, borderRadius: 8, border: 'none', background: 'var(--accent)', color: '#001018', fontWeight: 700, cursor: 'pointer' }}>
            {editData ? 'Yadda saxla' : 'Rezerv et'}
          </button>
          <button onClick={onClose} style={{ flex: 1, padding: 10, borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--gray2)', cursor: 'pointer' }}>
            Ləğv et
          </button>
        </div>
      </div>
    </div>
  )
}