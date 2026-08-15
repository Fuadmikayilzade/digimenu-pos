import { useState, useEffect } from 'react'

// Rezervasiya konkret tarixə bağlıdır — bugünkü masa statusunu bloklamır.
export default function ReserveModal({ open, tableNumber, onClose, onConfirm }) {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')

  useEffect(() => {
    if (open) {
      const now = new Date()
      setName(''); setPhone('')
      setDate(now.toISOString().slice(0, 10))
      setTime('19:00')
    }
  }, [open])

  if (!open) return null

  const handleConfirm = () => {
    if (!name.trim() || !date) return
    onConfirm(name.trim(), phone.trim(), date, time)
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
        <h3 style={{ margin: '0 0 4px', fontSize: 16 }}>Masa {tableNumber} — Rezervasiya</h3>
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
          min={new Date().toISOString().slice(0, 10)}
          style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg3)', color: 'var(--white)', marginBottom: 12, boxSizing: 'border-box' }}
        />

        <label style={{ fontSize: 12, color: 'var(--gray2)', display: 'block', marginBottom: 4 }}>Saat</label>
        <input
          type="time" value={time} onChange={(e) => setTime(e.target.value)}
          style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg3)', color: 'var(--white)', marginBottom: 18, boxSizing: 'border-box' }}
        />

        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={handleConfirm} style={{ flex: 1, padding: 10, borderRadius: 8, border: 'none', background: 'var(--accent)', color: '#001018', fontWeight: 700, cursor: 'pointer' }}>
            Rezerv et
          </button>
          <button onClick={onClose} style={{ flex: 1, padding: 10, borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--gray2)', cursor: 'pointer' }}>
            Ləğv et
          </button>
        </div>
      </div>
    </div>
  )
}