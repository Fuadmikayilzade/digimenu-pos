import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../utils/supabaseClient'

const DEFAULT_PIN = '1234'
const LOCK_KEY = 'pos_is_locked'

// Lock state-i localStorage-da saxla
export function saveLockState(locked) {
  localStorage.setItem(LOCK_KEY, locked ? '1' : '0')
}

export function isLockedOnLoad() {
  return localStorage.getItem(LOCK_KEY) === '1'
}

async function fetchPin() {
  const bizId = localStorage.getItem('pos_business_id')
  if (!bizId) return DEFAULT_PIN
  try {
    // QEYD: .maybeSingle() ƏVƏZİNƏ .limit(1) istifadə olunur — əgər
    // (keçmiş bug ucbatından) eyni biznes üçün bir neçə sətir qalıbsa,
    // .maybeSingle() xəta verib avtomatik DEFAULT_PIN-ə düşürdü. İndi
    // ən son yenilənən sətir götürülür, xəta yaranmır.
    const { data, error } = await supabase
      .from('business_settings')
      .select('pos_pin_code')
      .eq('business_id', bizId)
      .order('updated_at', { ascending: false })
      .limit(1)
    if (error || !data?.length) return DEFAULT_PIN
    return data[0]?.pos_pin_code || DEFAULT_PIN
  } catch {
    return DEFAULT_PIN
  }
}

export default function PinLock({ onUnlock }) {
  const [input, setInput] = useState('')
  const [shake, setShake] = useState(false)
  const [dots, setDots] = useState([false, false, false, false])
  const [pin, setPin] = useState(DEFAULT_PIN)
  const [loadingPin, setLoadingPin] = useState(true)

  // Hər dəfə lock ekranı açılanda ən son PIN-i yüklə
  useEffect(() => {
    setLoadingPin(true)
    fetchPin().then(p => {
      setPin(p)
      setLoadingPin(false)
    })
    // Lock state-i saxla
    saveLockState(true)
  }, [])

  useEffect(() => {
    setDots([false, false, false, false].map((_, i) => i < input.length))
  }, [input])

  useEffect(() => {
    if (input.length === 4 && !loadingPin) {
      if (input === pin) {
        saveLockState(false)
        onUnlock()
      } else {
        setShake(true)
        setTimeout(() => { setShake(false); setInput('') }, 600)
      }
    }
  }, [input, pin, loadingPin])

  const press = useCallback((n) => {
    if (input.length >= 4 || loadingPin) return
    setInput(p => p + String(n))
  }, [input, loadingPin])

  const del = useCallback(() => setInput(p => p.slice(0, -1)), [])

  useEffect(() => {
    const handler = (e) => {
      if (e.key >= '0' && e.key <= '9') press(parseInt(e.key))
      if (e.key === 'Backspace') del()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [press, del])

  const KEYS = [[1,2,3],[4,5,6],[7,8,9],[null,0,'del']]

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'linear-gradient(135deg, #060C18 0%, #0D1830 50%, #0B1020 100%)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      fontFamily: 'system-ui, sans-serif',
    }}>
      <div style={{ marginBottom: 48, textAlign: 'center' }}>
        <div style={{ fontSize: 40, marginBottom: 10 }}>🍽</div>
        <div style={{ color: '#FFFFFF', fontSize: 22, fontWeight: 800, letterSpacing: 2 }}>DigiMenu POS</div>
        <div style={{ color: '#5A6A8A', fontSize: 14, marginTop: 6 }}>
          {loadingPin ? 'PIN yüklənir...' : 'PIN kodunuzu daxil edin'}
        </div>
      </div>

      <div style={{
        display: 'flex', gap: 20, marginBottom: 52,
        animation: shake ? 'shake 0.5s ease' : 'none',
      }}>
        {dots.map((filled, i) => (
          <div key={i} style={{
            width: 18, height: 18, borderRadius: '50%',
            background: filled ? 'linear-gradient(135deg, #00E6A8, #2C5BE0)' : 'transparent',
            border: filled ? 'none' : '2px solid #2C3A5A',
            transition: 'all 0.15s ease',
            boxShadow: filled ? '0 0 12px rgba(0,230,168,0.4)' : 'none',
          }} />
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, opacity: loadingPin ? 0.4 : 1 }}>
        {KEYS.flat().map((k, i) => {
          if (k === null) return <div key={i} />
          const isDel = k === 'del'
          return (
            <button key={i}
              onClick={() => isDel ? del() : press(k)}
              style={{
                width: 90, height: 90, borderRadius: '50%',
                border: isDel ? '1px solid #2C3A5A' : '1px solid #1E2A45',
                background: isDel ? 'transparent' : 'rgba(255,255,255,0.04)',
                color: isDel ? '#5A6A8A' : '#FFFFFF',
                fontSize: isDel ? 22 : 34, fontWeight: 700,
                cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all 0.12s ease',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = isDel ? 'rgba(255,90,95,0.1)' : 'rgba(255,255,255,0.10)'
                e.currentTarget.style.transform = 'scale(1.05)'
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = isDel ? 'transparent' : 'rgba(255,255,255,0.04)'
                e.currentTarget.style.transform = 'scale(1)'
              }}
            >
              {isDel ? '⌫' : k}
            </button>
          )
        })}
      </div>

      <style>{`
        @keyframes shake {
          0%,100%{transform:translateX(0)}
          20%{transform:translateX(-12px)}
          40%{transform:translateX(12px)}
          60%{transform:translateX(-8px)}
          80%{transform:translateX(8px)}
        }
      `}</style>
    </div>
  )
}