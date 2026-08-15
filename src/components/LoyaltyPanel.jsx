import { useState, useRef } from 'react'
import { useApp } from '../context/AppContext'
import { supabase } from '../utils/supabaseClient'
import { evaluateProgram, buildRewardText } from '../lib/loyaltyEngine'
import { programAppliesToBranch } from '../lib/loyaltyBranchScope'

// Ofisiant/menecer bu paneldən: (1) telefonla mövcud üzvü tapır,
// (2) tapılmasa yeni üzv əlavə edir (ad+telefon+şəkil — şəkil
// sahibkarın seçiminə görə məcburi ola bilər), (3) üzvü cari masaya
// bağlayır — ödəniş tamamlananda ziyarət avtomatik qeyd olunur.
export default function LoyaltyPanel({ onClose }) {
  const { user, activeLoyaltyMember, setActiveLoyaltyMember, photoRequired, activeBranchId } = useApp()
  const [phone, setPhone] = useState('')
  const [found, setFound] = useState(null)
  const [searched, setSearched] = useState(false)
  const [pendingRewards, setPendingRewards] = useState([])
  const [progressRows, setProgressRows] = useState([])
  const [redeeming, setRedeeming] = useState(null)
  const [fullName, setFullName] = useState('')
  const [photoFile, setPhotoFile] = useState(null)
  const [photoPreview, setPhotoPreview] = useState(null)
  const [saving, setSaving] = useState(false)
  const cameraInputRef = useRef(null)
  const galleryInputRef = useRef(null)

  const handleSearch = async () => {
    if (!phone.trim()) return
    const { data } = await supabase.from('loyalty_members')
      .select('*').eq('business_id', user.business_id).eq('phone', phone.trim()).maybeSingle()
    setFound(data || null)
    setSearched(true)

    // ⚠️ Bu müştəri artıq tapşırığı tamamlayıb, HƆLƆ İSTİFADƆ ETMƆYİBSƏ
    // (redeemed=false), bunu aşkar edib xüsusi bir bildiriş kimi göstəririk:
    if (data?.id) {
      const { data: rewards } = await supabase.from('loyalty_rewards')
        .select('*, loyalty_programs(name)').eq('member_id', data.id).eq('redeemed', false)
        .order('earned_at', { ascending: false })
      setPendingRewards(rewards || [])

      // ⚠️ Hər aktiv proqram üzrə NEÇƆ tapşırığı yerinə yetirdiyi
      // (irəliləyiş) — App-dakı eyni məntiqlə göstərilir. YALNIZ bu
      // filialın öz ziyarətləri sayılır, proqramlar isə ÇOXSAYLI
      // filiala aid ola bilər (client-tərəfdə süzülür):
      let visitQ = supabase.from('loyalty_visits').select('member_id, visit_date, order_total').eq('member_id', data.id)
      visitQ = activeBranchId ? visitQ.eq('branch_id', activeBranchId) : visitQ.is('branch_id', null)

      const [{ data: visits }, { data: allRewards }, { data: allPrograms }] = await Promise.all([
        visitQ,
        supabase.from('loyalty_rewards').select('program_id, period_key').eq('member_id', data.id),
        supabase.from('loyalty_programs').select('*').eq('business_id', user.business_id).eq('is_active', true).eq('is_template', false).neq('type', 'order_amount'),
      ])
      const programs = (allPrograms || []).filter(p => programAppliesToBranch(p, activeBranchId || null))
      const rows = []
      ;(programs || []).forEach(program => {
        const grantedKeys = new Set((allRewards || []).filter(r => r.program_id === program.id).map(r => r.period_key).filter(Boolean))
        const result = evaluateProgram(program, visits || [], grantedKeys)
        if (result.needed > 0) {
          rows.push({ programName: program.name, progress: result.progress, needed: result.needed, eligible: result.eligible && !result.alreadyGranted })
        }
      })
      setProgressRows(rows)
    } else {
      setPendingRewards([])
      setProgressRows([])
    }
  }

  // Mükafat istifadə olunanda "redeemed" kimi qeyd olunur — bu, EYNİ
  // ZAMANDA "sıfırlama" rolunu oynayır: qazanılan növbəti ziyarətlər
  // artıq YENİ bir dövr kimi sayılmağa başlayır (evaluateProgram-ın öz
  // riyaziyyatı buna görə qurulub), yəni müştəri YENİDƆN iştirak edə bilər:
  const handleRedeemReward = async (reward) => {
    setRedeeming(reward.id)
    const { error } = await supabase.from('loyalty_rewards')
      .update({ redeemed: true, redeemed_at: new Date().toISOString() })
      .eq('id', reward.id)
    setRedeeming(null)
    if (error) { alert('Xəta: ' + error.message); return }
    setPendingRewards(prev => prev.filter(r => r.id !== reward.id))
  }

  const handlePhotoPick = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setPhotoFile(file)
    setPhotoPreview(URL.createObjectURL(file))
  }

  const handleCreate = async () => {
    if (!fullName.trim() || !phone.trim()) { alert('Ad Soyad və telefon mütləqdir'); return }
    if (photoRequired && !photoFile) { alert('Bu biznesdə üzv əlavə edərkən şəkil məcburidir'); return }
    setSaving(true)

    let photoUrl = null
    if (photoFile) {
      const path = `${user.business_id}/${Date.now()}_${photoFile.name}`
      const { error: upErr } = await supabase.storage.from('loyalty-photos').upload(path, photoFile)
      if (upErr) { setSaving(false); alert('Şəkil yüklənmədi: ' + upErr.message); return }
      const { data: pub } = supabase.storage.from('loyalty-photos').getPublicUrl(path)
      photoUrl = pub.publicUrl
    }

    const { data, error } = await supabase.from('loyalty_members').insert({
      business_id: user.business_id, full_name: fullName.trim(), phone: phone.trim(),
      photo_url: photoUrl, source: 'staff',
      created_by_staff_id: user.staff_account_id || null, created_by_name: user.name || null,
      added_from_branch_id: activeBranchId,
    }).select().single()

    setSaving(false)
    if (error) { alert(error.code === '23505' ? 'Bu nömrə ilə üzv artıq var' : error.message); return }
    setActiveLoyaltyMember(data)
    onClose()
  }

  const handleSelectFound = () => {
    setActiveLoyaltyMember(found)
    onClose()
  }

  const handleClearSelection = () => {
    setActiveLoyaltyMember(null)
    onClose()
  }

  return (
    <div className="modal-bg" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 16, padding: 22, width: 'min(360px, 92vw)', color: 'var(--white)', maxHeight: '85vh', overflowY: 'auto' }}>
        <h3 style={{ margin: '0 0 4px', fontSize: 16 }}>🎁 Loyallıq Üzvü</h3>
        <p style={{ margin: '0 0 14px', fontSize: 11, color: 'var(--gray2)' }}>
          Cari masanın hesabına loyallıq üzvü bağlayın — ödəniş tamamlananda ziyarəti avtomatik qeyd olunur.
        </p>

        {activeLoyaltyMember && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 10, borderRadius: 10, background: 'rgba(0,230,118,.08)', border: '1px solid rgba(0,230,118,.25)', marginBottom: 14 }}>
            {activeLoyaltyMember.photo_url
              ? <img src={activeLoyaltyMember.photo_url} alt="" style={{ width: 36, height: 36, borderRadius: 18, objectFit: 'cover' }} />
              : <div style={{ width: 36, height: 36, borderRadius: 18, background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--bg)', fontWeight: 800 }}>{activeLoyaltyMember.full_name?.[0]?.toUpperCase()}</div>}
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 700 }}>{activeLoyaltyMember.full_name}</div>
              <div style={{ fontSize: 11, color: 'var(--gray2)' }}>{activeLoyaltyMember.phone} — bu masaya bağlıdır</div>
            </div>
            <button onClick={handleClearSelection} style={{ background: 'none', border: 'none', color: '#FF9F9C', cursor: 'pointer', fontSize: 12 }}>Çıxar</button>
          </div>
        )}

        <label style={{ fontSize: 12, color: 'var(--gray2)', display: 'block', marginBottom: 4 }}>Telefon nömrəsi</label>
        <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
          <input value={phone} onChange={e => { setPhone(e.target.value); setSearched(false) }} placeholder="+994 50 ..."
            style={{ flex: 1, padding: '9px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg3)', color: 'var(--white)', fontSize: 13, boxSizing: 'border-box' }} />
          <button onClick={handleSearch} style={{ padding: '9px 14px', borderRadius: 8, border: 'none', background: 'var(--accent)', color: 'var(--bg)', fontWeight: 700, cursor: 'pointer' }}>Axtar</button>
        </div>

        {searched && found && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 10, borderRadius: 10, background: 'var(--bg3)', marginBottom: 12 }}>
            {found.photo_url
              ? <img src={found.photo_url} alt="" style={{ width: 40, height: 40, borderRadius: 20, objectFit: 'cover' }} />
              : <div style={{ width: 40, height: 40, borderRadius: 20, background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--bg)', fontWeight: 800 }}>{found.full_name?.[0]?.toUpperCase()}</div>}
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 700 }}>{found.full_name}</div>
              <div style={{ fontSize: 11, color: 'var(--gray2)' }}>Tapıldı ✓</div>
            </div>
            <button onClick={handleSelectFound} style={{ padding: '7px 12px', borderRadius: 8, border: 'none', background: 'var(--green)', color: 'var(--bg)', fontWeight: 700, cursor: 'pointer', fontSize: 12 }}>Seç</button>
          </div>
        )}

        {/* ⚠️ Müştəri tapşırığı tamamlayıb, hələ istifadə etməyib —
            aydın, diqqət çəkən bildiriş: */}
        {searched && found && pendingRewards.length > 0 && (
          <div style={{ marginBottom: 14 }}>
            {pendingRewards.map(r => (
              <div key={r.id} style={{ padding: 12, borderRadius: 10, background: 'rgba(233,30,140,.12)', border: '1px solid rgba(233,30,140,.4)', marginBottom: 8 }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: '#E91E8C', marginBottom: 2 }}>
                  🎉 Tapşırıq tamamlandı! Kampaniyadan yararlana bilər
                </div>
                <div style={{ fontSize: 12, color: 'var(--white)', marginBottom: 8 }}>
                  {r.loyalty_programs?.name ? `${r.loyalty_programs.name}: ` : ''}{r.reward_description}
                </div>
                <button onClick={() => handleRedeemReward(r)} disabled={redeeming === r.id}
                  style={{ width: '100%', padding: '8px', borderRadius: 8, border: 'none', background: '#E91E8C', color: '#fff', fontWeight: 700, cursor: 'pointer', fontSize: 12, opacity: redeeming === r.id ? .6 : 1 }}>
                  {redeeming === r.id ? 'Tətbiq olunur...' : '✓ İstifadə et (mükafatı tətbiq et)'}
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Tapşırıqların yerinə yetirmə sayı (irəliləyiş) — hər aktiv
            proqram üzrə ödəniş tamamlandıqca avtomatik yenilənir: */}
        {searched && found && progressRows.length > 0 && (
          <div style={{ marginBottom: 14, padding: 10, borderRadius: 10, background: 'var(--bg3)' }}>
            {progressRows.map((r, i) => (
              <div key={i} style={{ marginBottom: i < progressRows.length - 1 ? 8 : 0 }}>
                <div style={{ fontSize: 12, fontWeight: r.eligible ? 800 : 600, color: r.eligible ? '#E91E8C' : 'var(--gray2)', marginBottom: 3 }}>
                  {r.eligible ? '🎉 ' : ''}{r.programName}: {r.progress}/{r.needed}
                </div>
                <div style={{ height: 5, borderRadius: 3, background: 'var(--bg)', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${Math.min(100, (r.progress / r.needed) * 100)}%`, background: r.eligible ? '#E91E8C' : 'var(--accent)', borderRadius: 3 }} />
                </div>
              </div>
            ))}
          </div>
        )}

        {searched && !found && (
          <div style={{ padding: '10px 0', borderTop: '1px solid var(--border)', marginTop: 4 }}>
            <div style={{ fontSize: 12, color: 'var(--gray2)', marginBottom: 10 }}>Bu nömrə ilə üzv tapılmadı — yeni əlavə edin:</div>

            <input type="file" accept="image/*" capture="environment" ref={cameraInputRef} onChange={handlePhotoPick} style={{ display: 'none' }} />
            <input type="file" accept="image/*" ref={galleryInputRef} onChange={handlePhotoPick} style={{ display: 'none' }} />

            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              {photoPreview
                ? <img src={photoPreview} alt="" style={{ width: 48, height: 48, borderRadius: 24, objectFit: 'cover' }} />
                : <div style={{ width: 48, height: 48, borderRadius: 24, border: '1.5px dashed var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>📷</div>}
              <button onClick={() => cameraInputRef.current?.click()} style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg3)', color: 'var(--white)', fontSize: 11, cursor: 'pointer' }}>Kameradan çək</button>
              <button onClick={() => galleryInputRef.current?.click()} style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg3)', color: 'var(--white)', fontSize: 11, cursor: 'pointer' }}>Qalereyadan seç</button>
            </div>
            {photoRequired && <div style={{ fontSize: 10, color: '#FF9F5A', marginBottom: 8 }}>⚠️ Şəkil bu biznesdə məcburidir</div>}

            <label style={{ fontSize: 12, color: 'var(--gray2)', display: 'block', marginBottom: 4 }}>Ad Soyad</label>
            <input value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Əli Məmmədov"
              style={{ width: '100%', padding: '9px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg3)', color: 'var(--white)', fontSize: 13, marginBottom: 12, boxSizing: 'border-box' }} />

            <button onClick={handleCreate} disabled={saving}
              style={{ width: '100%', padding: '10px', borderRadius: 8, border: 'none', background: 'var(--accent)', color: 'var(--bg)', fontWeight: 700, cursor: 'pointer', opacity: saving ? .6 : 1 }}>
              {saving ? 'Əlavə edilir...' : 'Əlavə et və masaya bağla'}
            </button>
          </div>
        )}

        <button onClick={onClose} style={{ width: '100%', padding: '10px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--gray)', fontWeight: 700, cursor: 'pointer', marginTop: 12 }}>
          Bağla
        </button>
      </div>
    </div>
  )
}