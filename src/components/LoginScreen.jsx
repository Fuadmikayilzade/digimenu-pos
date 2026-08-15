import { useState } from 'react'
import { supabase } from '../utils/supabaseClient'
import PasswordInput from './PasswordInput'

export default function LoginScreen({ onLogin }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleLogin = async () => {
    if (!email || !password) { setError('E-poçt və şifrəni daxil edin'); return }
    setLoading(true); setError('')

    const { data, error: authErr } = await supabase.auth.signInWithPassword({ email, password })
    if (authErr) { setError(authErr.message); setLoading(false); return }

    const userId = data.user.id

    // Admin yoxla
    const { data: admin } = await supabase
      .from('admin_users').select('id, full_name').eq('user_id', userId).maybeSingle()

    // Sahibkar yoxla
    const { data: biz } = await supabase
      .from('businesses').select('id, name, slug, subscription_status').eq('owner_id', userId).maybeSingle()

    if (biz) {
      // "əgər ödəniş uğurlu keçməsə app və pos sistemi deaktive edilsin"
      if (biz.subscription_status === 'suspended') {
        setError('Abunəlik ödənişi uğursuz olduğu üçün POS sistemi deaktiv edilib. Zəhmət olmasa DigiMenu App-dan ödənişi yeniləyin.')
        await supabase.auth.signOut()
        setLoading(false); return
      }
      onLogin({
        id: userId, email, name: data.user.user_metadata?.full_name || email,
        business_id: biz.id, business_name: biz.name, business_slug: biz.slug,
        role: admin ? 'admin' : 'owner',
      })
      setLoading(false); return
    }

    // Ofisiant yoxla
    const { data: staff } = await supabase
      .from('staff_accounts')
      .select('id, full_name, role, is_active, business_id, branch_id')
      .eq('user_id', userId)
      .maybeSingle()

    if (staff) {
      if (!staff.is_active) {
        setError('Hesabınız deaktiv edilib. Sahibkarla əlaqə saxlayın.')
        await supabase.auth.signOut()
        setLoading(false); return
      }

      // Ofisiantın biznesini əldə et
      const { data: staffBiz } = await supabase
        .from('businesses').select('id, name, subscription_status').eq('id', staff.business_id).maybeSingle()

      if (staffBiz?.subscription_status === 'suspended') {
        setError('Bu biznesin abunəlik ödənişi uğursuz olub. POS sistemi deaktiv edilib — sahibkarla əlaqə saxlayın.')
        await supabase.auth.signOut()
        setLoading(false); return
      }

      onLogin({
        id: userId, email, name: staff.full_name,
        business_id: staff.business_id,
        business_name: staffBiz?.name || '',
        staff_account_id: staff.id,
        branch_id: staff.branch_id,
        role: staff.role || 'waiter', // waiter | manager
      })
      setLoading(false); return
    }

    setError('Bu hesab POS sisteminə giriş üçün təyin edilməyib.')
    await supabase.auth.signOut()
    setLoading(false)
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(135deg, #0B1020 0%, #1E2A8A 100%)',
      fontFamily: 'system-ui, sans-serif', padding: 20,
    }}>
      <div style={{
        background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)',
        borderRadius: 20, padding: 36, width: '100%', maxWidth: 400,
      }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>🍽</div>
          <div style={{ color: '#fff', fontSize: 22, fontWeight: 800 }}>DigiMenu POS</div>
          <div style={{ color: '#9AA4BC', fontSize: 13, marginTop: 4 }}>Sahibkar və ya ofisiant girişi</div>
        </div>

        {error && (
          <div style={{ background: 'rgba(255,90,95,0.12)', border: '1px solid rgba(255,90,95,0.3)', borderRadius: 10, padding: '10px 14px', color: '#FF5A5F', fontSize: 13, marginBottom: 16 }}>
            {error}
          </div>
        )}

        <label style={{ color: '#9AA4BC', fontSize: 12, display: 'block', marginBottom: 6 }}>E-poçt</label>
        <input value={email} onChange={e => setEmail(e.target.value)}
          type="email" placeholder="email@example.com"
          onKeyDown={e => e.key === 'Enter' && handleLogin()}
          style={{ width: '100%', padding: 12, borderRadius: 10, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.06)', color: '#fff', fontSize: 14, marginBottom: 14, boxSizing: 'border-box' }} />

        <label style={{ color: '#9AA4BC', fontSize: 12, display: 'block', marginBottom: 6 }}>Şifrə</label>
        <PasswordInput value={password} onChange={e => setPassword(e.target.value)}
          placeholder="••••••••"
          onKeyDown={e => e.key === 'Enter' && handleLogin()}
          style={{ padding: 12, borderRadius: 10, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.06)', color: '#fff', fontSize: 14 }}
          wrapperStyle={{ marginBottom: 20 }} />

        <button onClick={handleLogin} disabled={loading}
          style={{ width: '100%', padding: 14, borderRadius: 10, border: 'none', background: loading ? '#1E2A8A' : 'linear-gradient(135deg,#2C5BE0,#00E6A8)', color: '#fff', fontWeight: 700, fontSize: 15, cursor: loading ? 'not-allowed' : 'pointer' }}>
          {loading ? 'Giriş edilir...' : 'Daxil ol'}
        </button>

        <div style={{ color: '#6b7488', fontSize: 11, textAlign: 'center', marginTop: 20, lineHeight: 1.6 }}>
          Sahibkar öz e-poçtu ilə daxil olur.<br/>
          Ofisiant sahibkara yaradılmış hesabla daxil olur.
        </div>
      </div>
    </div>
  )
}