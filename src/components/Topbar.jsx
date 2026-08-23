import { useState, useEffect } from 'react'
import { useApp } from '../context/AppContext'
import { can } from '../utils/constants'
import { fmt } from '../utils/helpers'
import { supabase } from '../utils/supabaseClient'
import PasswordInput from './PasswordInput'
import PendingOrdersPanel from './PendingOrdersPanel'

const NAV_ITEMS = [
  { k: 'pos',       label: 'POS',    icon: '🛒', role: 'pos'     },
  { k: 'kitchen',   label: 'Mətbəx', icon: '🍳', role: 'kitchen' },
  { k: 'orders',    label: 'Çeklər', icon: '📋', role: 'pos'     },
  // ⚠️ "Arxiv" bölməsi silindi — funksiyası artıq "Çeklər" bölməsinin
  // öz daxilindədir (kalendardan tarix seçmə ilə):
  { k: 'reservations', label: 'Rezervasiyalar', icon: '📅', role: 'reserve' },
  { k: 'dashboard', label: 'Statistika', icon: '📊', role: 'reports' },
  { k: 'reports',   label: 'Hesabat', icon: '📈', role: 'reports' },
]

// Mobil ekranda yuxarı naviqasiya (topbar-nav) tamamilə DOM-dan çıxarılır
// (sadəcə CSS ilə gizlədilmir) — yalnız aşağı naviqasiya paneli (bottom
// nav) qalır. Bu, "yuxarıdaki işləyir, aşağıdaki işləmir, ikisi bir yerdə
// qalır" problemi bir daha yaşanmasın deyə bilərəkdən JS-də edilir.
function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' && window.innerWidth <= 768
  )
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth <= 768)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])
  return isMobile
}

// ⚠️ QEYD: bu funksiya əvvəllər "yığcam rejim" üçün istifadə olunurdu
// (bölmə adlarını gizlədirdi) — istifadəçinin xahişi ilə bu davranış
// LƆĞV EDİLDİ, adlar həmişə görünür. Sıxlıq problemi əvəzinə aşağıdaki
// CSS-də daha çox boşluq (gap/padding) və ehtiyat üçün üfüqi sürüşmə
// ilə həll olunur.

function copyPayLink(slug, tableNum) {
  if (!slug) { alert('Biznes slug tapılmadı'); return }
  if (!tableNum) { alert('Əvvəlcə masa seçin'); return }
  const url = `https://digimenu-public.netlify.app/pay/${slug}?table=${tableNum}`
  navigator.clipboard.writeText(url).then(() => alert(`✅ Kopyalandı:\n${url}`))
}

export default function Topbar() {
  const {
    user, handleLogout, view, setView,
    todaySales, openTables, ticketCount,
    readyNotifs, dismissReadyNotif, clearReadyNotifs,
    branches, activeBranchId, setActiveBranchId, liveTables,
    mobileSidebarOpen, setMobileSidebarOpen, mobileCartOpen, setMobileCartOpen, cart,
  } = useApp()

  const [showNotif, setShowNotif] = useState(false)
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [showPasswordModal, setShowPasswordModal] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [pwSaving, setPwSaving] = useState(false)
  const [pwMsg, setPwMsg] = useState('')
  const unread = readyNotifs.length
  const cartCount = (cart?.items || []).reduce((s, i) => s + i.qty, 0)
  const isMobile = useIsMobile()
  const allowedNavItems = NAV_ITEMS.filter(n => can(user, n.role))

  return (
    <>
      <div className="topbar" style={{ position: 'relative' }}>

        {/* Mobil: sidebar (kateqoriya/masalar) aç düyməsi — yalnız POS görünüşündə */}
        {view === 'pos' && (
          <button className="mobile-only mobile-icon-btn" onClick={() => setMobileSidebarOpen(v => !v)} title="Kateqoriyalar / Masalar">
            ☰
          </button>
        )}

        {/* Logo */}
        <div className="logo">Digi<span>Menu</span></div>

        {/* Filial — YALNIZ sahibkar/admin sərbəst seçə bilər. İşçilər
            (ofisiant/menecer/mətbəx) öz təyin olunduğu filiala
            sabitlənib (bax: AppContext.jsx) — onlara dəyişdirmə imkanı
            VERİLMİR, çünki bu, əvvəllər cihazlar arası "paralel dünya"
            bugunun səbəbi olmuşdu. */}
        {(user?.role === 'owner' || user?.role === 'admin') && branches.length > 0 ? (
          <select className="branch-select" value={activeBranchId || ''} onChange={e => setActiveBranchId(e.target.value || null)}
            style={{ background:'var(--bg3)', color:'var(--text)', border:'1px solid var(--border)', borderRadius:6, padding:'4px 8px', fontSize:11, cursor:'pointer' }}>
            <option value="">Əsas filial</option>
            {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        ) : branches.length > 0 ? (
          <span className="branch-select" style={{ background:'var(--bg3)', color:'var(--gray)', border:'1px solid var(--border)', borderRadius:6, padding:'4px 8px', fontSize:11 }}>
            {branches.find(b => b.id === activeBranchId)?.name || 'Əsas filial'}
          </span>
        ) : null}

        {/* Nav — masaüstündə burada, mobildə tamamilə DOM-dan çıxarılır
            (aşağıdaki mobile-bottom-nav əvəz edir) */}
        {!isMobile && (
          <div className="topbar-nav">
            {allowedNavItems.map(n => (
              <button key={n.k} className={`nav-btn${view===n.k?' active':''}`}
                onClick={() => setView(n.k)} title={n.label}>
                {n.icon} {n.label}
                {n.k==='kitchen' && ticketCount>0 && (
                  <span style={{ marginLeft:3, background:'var(--amber)', color:'var(--bg)', borderRadius:4, padding:'0 4px', fontSize:9, fontWeight:700 }}>{ticketCount}</span>
                )}
              </button>
            ))}
          </div>
        )}

        {/* ⚠️ İstifadəçinin xahişi ilə geri qaytarıldı — statistika/saat
            həmişə görünür, yığcam rejimdə gizlədilmir: */}
        <div className="topbar-stats">
          <div className="stat-chip green"><span>₼</span><span className="val">{fmt(todaySales)}</span></div>
          <div className="stat-chip amber"><span>🪑</span><span className="val">{openTables}/{liveTables.length}</span></div>
        </div>

        {/* Sifarişlər — mobildə mətn gizlənir, sadəcə işarə/say qalır */}
        <PendingOrdersPanel />

        {/* Bildiriş */}
        <div style={{ position:'relative' }}>
          <button onClick={() => setShowNotif(p => !p)} style={{
            width:32, height:32, borderRadius:6, border:`1px solid ${unread>0?'rgba(255,179,0,.3)':'var(--border)'}`,
            background: unread>0?'rgba(255,179,0,.1)':'var(--bg3)',
            color: unread>0?'var(--amber)':'var(--gray)',
            fontSize:14, cursor:'pointer', position:'relative', flexShrink:0,
            display:'flex', alignItems:'center', justifyContent:'center',
          }}>
            🔔
            {unread>0 && (
              <span style={{ position:'absolute', top:-4, right:-4, background:'var(--red)', color:'#fff', borderRadius:'50%', width:14, height:14, fontSize:8, fontWeight:800, display:'flex', alignItems:'center', justifyContent:'center' }}>
                {unread>9?'9+':unread}
              </span>
            )}
          </button>

          {showNotif && (
            <>
              <div onClick={() => setShowNotif(false)} style={{ position:'fixed', inset:0, zIndex:200 }} />
              <div className="notif-dropdown" style={{ position:'absolute', top:38, right:0, zIndex:201, background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:12, width:260, boxShadow:'var(--shadow2)', overflow:'hidden' }}>
                <div style={{ padding:'8px 12px', borderBottom:'1px solid var(--border)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                  <span style={{ fontSize:12, fontWeight:700 }}>🔔 Bildirişlər</span>
                  {/* ⚠️ Bildirişləri silmək YALNIZ menecer/sahibkar/admin
                      üçündür — ofisiant/mətbəx işçisi silə bilməz: */}
                  {readyNotifs.length>0 && (user?.role === 'owner') && <button onClick={clearReadyNotifs} style={{ fontSize:10, color:'var(--gray)', background:'none', border:'none', cursor:'pointer' }}>Hamısını sil</button>}
                </div>
                <div style={{ maxHeight:280, overflowY:'auto' }}>
                  {!readyNotifs.length ? (
                    <div style={{ padding:'20px 0', textAlign:'center', color:'var(--gray2)', fontSize:12 }}>Bildiriş yoxdur</div>
                  ) : readyNotifs.map(n => (
                    <div key={n.id} style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 12px', borderBottom:'1px solid var(--border)' }}>
                      <span style={{ fontSize:18 }}>{n.type === 'paid' ? '💳' : n.type === 'loyalty' ? '🎁' : '🍽'}</span>
                      <div style={{ flex:1 }}>
                        <div style={{ fontSize:12, fontWeight:600, color: n.type === 'paid' ? 'var(--green)' : n.type === 'loyalty' ? '#E91E8C' : 'var(--amber)' }}>
                          {n.message || `Masa ${n.tableNum} — Hazırdır!`}
                        </div>
                        <div style={{ fontSize:10, color:'var(--gray2)' }}>{n.time}</div>
                      </div>
                      {(user?.role === 'owner') && (
                        <button onClick={() => dismissReadyNotif(n.id)} style={{ background:'none', border:'none', color:'var(--gray2)', cursor:'pointer' }}>✕</button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Mobil: səbət aç düyməsi — yalnız POS görünüşündə */}
        {view === 'pos' && (
          <button className="mobile-only mobile-icon-btn" onClick={() => setMobileCartOpen(v => !v)} title="Sifariş">
            🛒
            {cartCount > 0 && <span className="mobile-cart-badge">{cartCount}</span>}
          </button>
        )}

        {/* Kilid düyməsi — həmişə görünən, böyük. Mobildə mətn gizlənir. */}
        <button
          className="lock-btn"
          onClick={() => window.__posLock && window.__posLock()}
          title="Ekranı kilid (30s)"
          style={{
            padding: '6px 14px', borderRadius: 8,
            border: '1px solid rgba(44,91,224,0.4)',
            background: 'rgba(44,91,224,0.12)',
            color: '#2C5BE0', fontSize: 12, fontWeight: 700,
            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5,
            whiteSpace: 'nowrap', flexShrink: 0,
          }}>
          🔒 <span className="btn-label-text">Kilid</span>
        </button>

        {/* İstifadəçi + Menyu */}
        <div style={{ position:'relative', flexShrink: 0 }}>
          <button onClick={() => setShowUserMenu(p => !p)} className="user-chip">
            <span>{user?.avatar}</span>
            <span style={{ fontWeight:600, fontSize:11, maxWidth:70, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', color:'#FFFFFF' }}>{user?.name}</span>
            <span style={{ fontSize:9, color:'var(--gray2)' }}>▾</span>
          </button>

          {showUserMenu && (
            <>
              <div onClick={() => setShowUserMenu(false)} style={{ position:'fixed', inset:0, zIndex:200 }} />
              <div style={{ position:'absolute', top:40, right:0, zIndex:201, background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:10, width:190, overflow:'hidden', boxShadow:'var(--shadow2)' }}>
                <div style={{ padding:'10px 14px', borderBottom:'1px solid var(--border)' }}>
                  <div style={{ fontSize:12, fontWeight:700, color:'var(--white)' }}>{user?.name}</div>
                  <div style={{ fontSize:10, color:'var(--gray2)', marginTop:2 }}>{user?.role} · {user?.business_name}</div>
                </div>

                {[
                  { icon:'💳', label:'Ödəniş linki', action:() => { setShowUserMenu(false); copyPayLink(user?.business_slug, window.__activeTable) } },
                  { icon:'🔑', label:'Şifrəni dəyişdir', action:() => { setShowUserMenu(false); setPwMsg(''); setNewPassword(''); setConfirmPassword(''); setShowPasswordModal(true) } },
                ].map(item => (
                  <button key={item.label} onClick={item.action}
                    style={{ width:'100%', padding:'10px 14px', border:'none', background:'transparent', color:'var(--text)', fontSize:12, textAlign:'left', cursor:'pointer', display:'block' }}
                    onMouseEnter={e => e.target.style.background='var(--bg3)'}
                    onMouseLeave={e => e.target.style.background='transparent'}>
                    {item.icon} {item.label}
                  </button>
                ))}

                <button onClick={() => { setShowUserMenu(false); if(window.confirm('Çıxmaq istəyirsiniz?')) handleLogout() }}
                  style={{ width:'100%', padding:'10px 14px', border:'none', borderTop:'1px solid var(--border)', background:'transparent', color:'#FF5A5F', fontSize:12, textAlign:'left', cursor:'pointer', display:'block' }}
                  onMouseEnter={e => e.target.style.background='rgba(255,90,95,.08)'}
                  onMouseLeave={e => e.target.style.background='transparent'}>
                  ⏏ Çıxış
                </button>
              </div>
            </>
          )}
        </div>

      </div>

      {/* Şifrə dəyişdirmə modalı — hər işçi (ofisiant/menecer/mətbəx)
          öz hesabının şifrəsini özü dəyişə bilsin deyə: */}
      {showPasswordModal && (
        <div className="modal-bg" onClick={(e) => e.target === e.currentTarget && setShowPasswordModal(false)}>
          <div style={{ background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:16, padding:24, width:'min(340px, 92vw)', color:'var(--white)' }}>
            <h3 style={{ margin:'0 0 4px', fontSize:16 }}>🔑 Şifrəni dəyişdir</h3>
            <p style={{ margin:'0 0 16px', fontSize:11, color:'var(--gray2)' }}>Yeni şifrəniz ən az 6 simvol olmalıdır.</p>

            {pwMsg && (
              <div style={{ padding:'8px 10px', borderRadius:8, marginBottom:12, background: pwMsg.startsWith('✅') ? 'rgba(0,230,118,.1)' : 'rgba(255,90,95,.1)', color: pwMsg.startsWith('✅') ? 'var(--green)' : '#FF9F9C', fontSize:12 }}>
                {pwMsg}
              </div>
            )}

            <label style={{ fontSize:12, color:'var(--gray2)', display:'block', marginBottom:4 }}>Yeni şifrə</label>
            <PasswordInput value={newPassword} onChange={e => setNewPassword(e.target.value)}
              style={{ padding:'10px 12px', borderRadius:8, border:'1px solid var(--border)', background:'var(--bg3)', color:'var(--white)', fontSize:14 }}
              wrapperStyle={{ marginBottom:12 }} />

            <label style={{ fontSize:12, color:'var(--gray2)', display:'block', marginBottom:4 }}>Yeni şifrəni təkrarlayın</label>
            <PasswordInput value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
              style={{ padding:'10px 12px', borderRadius:8, border:'1px solid var(--border)', background:'var(--bg3)', color:'var(--white)', fontSize:14 }}
              wrapperStyle={{ marginBottom:16 }} />

            <div style={{ display:'flex', gap:8 }}>
              <button
                disabled={pwSaving}
                onClick={async () => {
                  if (newPassword.length < 6) { setPwMsg('❌ Şifrə ən az 6 simvol olmalıdır'); return }
                  if (newPassword !== confirmPassword) { setPwMsg('❌ Şifrələr uyğun gəlmir'); return }
                  setPwSaving(true)
                  const { error } = await supabase.auth.updateUser({ password: newPassword })
                  setPwSaving(false)
                  if (error) { setPwMsg('❌ ' + error.message); return }
                  setPwMsg('✅ Şifrə dəyişdirildi')
                  setNewPassword(''); setConfirmPassword('')
                  setTimeout(() => setShowPasswordModal(false), 1200)
                }}
                style={{ flex:1, padding:'10px', borderRadius:8, border:'none', background:'var(--accent)', color:'var(--bg)', fontWeight:700, cursor:'pointer', opacity: pwSaving ? .6 : 1 }}>
                {pwSaving ? 'Yadda saxlanılır...' : 'Yadda saxla'}
              </button>
              <button onClick={() => setShowPasswordModal(false)}
                style={{ flex:1, padding:'10px', borderRadius:8, border:'1px solid var(--border)', background:'transparent', color:'var(--gray)', fontWeight:700, cursor:'pointer' }}>
                Bağla
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MOBİL AŞAĞI NAVİQASİYA — yalnız mobil ekranda render olunur (yuxarı
          nav ilə heç vaxt eyni vaxtda mövcud olmur), eyni icazə siyahısından
          qurulur. Peşəkar POS tətbiqlərinin (Toast, Square) standart mobil
          naviqasiya nümunəsidir. */}
      {isMobile && (
        <div className="mobile-bottom-nav">
          {allowedNavItems.map(n => (
            <button key={n.k} type="button" className={`mobile-bottom-nav-btn${view===n.k?' active':''}`} onClick={() => setView(n.k)}>
              <span className="mbn-icon">{n.icon}</span>
              <span className="mbn-label">{n.label}</span>
              {n.k==='kitchen' && ticketCount>0 && <span className="mbn-badge">{ticketCount}</span>}
            </button>
          ))}
        </div>
      )}
    </>
  )
}