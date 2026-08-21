import { useState, useEffect, useRef } from 'react'
import { supabase } from '../utils/supabaseClient'
import { useApp } from '../context/AppContext'
import { printReceipt } from '../utils/printReceipt'

const STATUSES = [
  { key: 'accepted',  label: 'Qəbul edildi', icon: '✅', color: '#2C5BE0' },
  { key: 'preparing', label: 'Hazırlanır',   icon: '🟡', color: '#FF9F5A' },
  { key: 'ready',     label: 'Hazırdır',     icon: '🔔', color: '#7C4DFF' },
  { key: 'delivered', label: 'Çatdırıldı',   icon: '🚀', color: '#00E6A8' },
  { key: 'rejected',  label: 'Rədd et',      icon: '❌', color: '#FF5A5F' },
]

export default function PendingOrdersPanel() {
  const { user, toast, mergeQROrderToTable, loadLiveTables, addNotification, recordOnlineRevenue, activeBranchId } = useApp()
  const [orders, setOrders] = useState([])
  const [open, setOpen] = useState(false)
  const [activeStages, setActiveStages] = useState(['accepted','preparing','ready','delivered'])
  const pollRef = useRef(null)
  const prevPaidRef = useRef(new Set())
  // ⚠️ loadOrders() HƆM 3 saniyəlik "poll"dan, HƆM DƆ hər realtime
  // dəyişiklikdən çağırılır. Müştəri ödəyəndə bir neçə sətir demək olar
  // ki EYNİ ANDA dəyişir — bu, loadOrders()-in ÜST-ÜSTƆ (overlapping)
  // çağırılmasına səbəb olurdu, nəticədə eyni masa BİR NEÇƆ DƆFƆ paralel
  // emal olunub çek 2-3 dəfə çap olunurdu. Bu "kilid" məhz bunun
  // qarşısını alır — bir masa emal olunarkən DİGƆR overlapping çağırış
  // həmin masaya TOXUNMUR:
  const processingTablesRef = useRef(new Set())

  useEffect(() => {
    if (!user?.business_id) return
    loadOrders()
    loadSettings()

    // 3 saniyədə bir yenilə
    pollRef.current = setInterval(() => loadOrders(), 3000)

    // Realtime — yeni sifariş VƏ status/ödəniş dəyişiklikləri.
    // ⚠️ ƏVVƏLLƏR YALNIZ 'INSERT' dinlənilirdi — müştərinin ödəniş
    // etməsi bir UPDATE-dir (payment_status dəyişir), ona görə bu,
    // yalnız 3 saniyəlik "poll"la tutulurdu. İndi '*' ilə bütün
    // dəyişikliklər DƏRHAL tutulur:
    const channel = supabase
      .channel(`pending_${user.business_id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pending_orders', filter: `business_id=eq.${user.business_id}` },
        async (payload) => {
          if (payload.eventType === 'INSERT') {
            // ⚠️ Kassirin özü POS-dan əlavə etdiyi məhsul (source='staff'
            // "güzgü" sifarişi) bu panelə/bildirişə DAXİL EDİLMİR — o,
            // onsuz da nə əlavə etdiyini bilir, özünə-özünə bildiriş
            // göndərməyə ehtiyac yoxdur. Bu panel YALNIZ müştərinin
            // telefonundan gələn sifarişlər üçündür:
            if (payload.new.source === 'staff') return
            // ⚠️ VACİB: başqa filialın sifarişi bu filialın işçisinə
            // bildiriş kimi getməsin:
            const rowBranch = payload.new.branch_id || null
            const wantedBranch = activeBranchId || null
            if (rowBranch !== wantedBranch) return
            const { data: full } = await supabase.from('pending_orders').select('*, tables(number, id, display_label)').eq('id', payload.new.id).single()
            if (full) {
              setOrders(prev => [full, ...prev])
              toast(`🔔 Yeni sifariş! Masa ${full.tables?.display_label || full.tables?.number || '?'}`, 'info', 8000)
              setOpen(true)
            }
          } else {
            loadOrders() // UPDATE/DELETE — sadəcə tam siyahını yeniləyirik
          }
        })
      .subscribe()

    return () => {
      clearInterval(pollRef.current)
      supabase.removeChannel(channel)
    }
  }, [user, activeBranchId]) // eslint-disable-line

  const loadSettings = async () => {
    const { data } = await supabase.from('business_settings').select('status_stages').eq('business_id', user.business_id).maybeSingle()
    if (data?.status_stages) setActiveStages(data.status_stages)
  }

  const loadOrders = async () => {
    if (!user?.business_id) return
    let q = supabase
      .from('pending_orders').select('*, tables(number, id, display_label)')
      .eq('business_id', user.business_id)
      .in('order_status', ['pending','accepted','preparing','ready'])
      .order('created_at', { ascending: false })
    // ⚠️ VACİB: yalnız BU FİLİALIN sifarişləri — əvvəllər bu sorğu
    // filialdan asılı olmayaraq BÜTÜN biznesin sifarişlərini çəkirdi,
    // yəni bir filialın bildirişi SƏHVƆN başqa filialın işçilərinə də
    // gedirdi:
    q = activeBranchId ? q.eq('branch_id', activeBranchId) : q.is('branch_id', null)
    const { data } = await q
    if (!data) return

    // ⚠️ Panelin ÖZÜNDƏ göstərilən siyahı YALNIZ müştərinin telefonundan
    // gələn sifarişlərdir (source='staff' — kassirin "güzgü" sifarişi —
    // buraya DAXİL EDİLMİR). AMMA aşağıdaki ödəniş aşkarlama dövrəsi
    // `data`-nın TAM (filtrlənməmiş) versiyasından istifadə edir —
    // çünki müştəri "Ödə" səhifəsindən kassirin əlavə etdiyi məhsulu da
    // ödəyə bilər, bunu qaçırmamalıyıq:
    setOrders(data.filter(o => o.source !== 'staff'))

    // Ödənilmiş sifarişləri aşkar et → MASANIN BÜTÜN qonaqları ödəyəndə
    // (hər kəsin AYRI-AYRI ödəməsi YOX) masanı boşalt + BİR dəfə çek çap et.
    //
    // ⚠️ ƏVVƏLKİ VERSİYA hər sifarişin (hər qonağın) öz payını ödəməsini
    // "bütün masa ödənildi" kimi qəbul edirdi — nəticədə 2 qonaqdan biri
    // ödəyəndə masa vaxtından əvvəl "boş" olur, çek də hər qonaq üçün
    // AYRI-AYRI çap olunurdu. İndi HAMISININ ödədiyi TƏSDİQLƏNMƏDƏN
    // heç nə baş vermir.
    for (const order of data) {
      if (order.payment_status !== 'paid') continue
      if (!order.table_id) continue
      if (prevPaidRef.current.has(order.id)) continue // artıq emal olunub
      if (processingTablesRef.current.has(order.table_id)) continue // bu masa HAZIRDA overlapping çağırışda emal olunur — burax
      processingTablesRef.current.add(order.table_id)

      try {
      // Bu masanın BÜTÜN sifarişlərini yoxla (order_status-dan asılı
      // olmayaraq — "delivered" olub bu poll-un əsas sorğusundan
      // çıxmış sifarişlər də daxil olmaqla). `order_status` da seçilir —
      // bu, aşağıda "yeni ödənilən" sifarişi DAİMİ (DB) əsasında
      // müəyyən etmək üçün lazımdır:
      const { data: allTableOrders } = await supabase
        .from('pending_orders').select('id, payment_status, order_status')
        .eq('table_id', order.table_id).neq('order_status', 'rejected')

      const allPaid = (allTableOrders || []).length > 0 && allTableOrders.every(o => o.payment_status === 'paid')

      if (!allPaid) {
        // Bu qonaq ödədi, AMMA masadaki digər qonaq(lar) hələ
        // ödəməyib — gözləyirik, masa "dolu" qalır, çek çap OLUNMUR:
        prevPaidRef.current.add(order.id)
        continue
      }

      // ✅ MASANIN HAMISI ÖDƆDİ. Amma diqqət: `allTableOrders` bu masanın
      // BÜTÜN VAXTLARDAKI sifarişlərini əhatə edə bilər (fiziki masa
      // başqa gün başqa müştəri üçün yenidən istifadə olunur). Çekə
      // YALNIZ bu dəfə YENİ ödənilən sifarişlər daxil edilməlidir.
      //
      // ⚠️ KRİTİK DÜZƆLİŞ: ƏVVƆLKİ KOD bunu `prevPaidRef` (YALNIZ RAM-da
      // olan, səhifə yenilənəndə SIFIRLANAN) yaddaşla müəyyən edirdi —
      // bu, "3-cü filial masa 1-də köhnə sifarişlər yeni çekdə əks
      // olunur" bugunun SƏBƏBİ idi: keçmiş bir dövrdə artıq "delivered"
      // edilmiş (bağlanmış) köhnə sifariş, əgər səhifə bundan sonra
      // yenidən yüklənmişdisə, `prevPaidRef` bunu "yeni" kimi görüb
      // YENİDƆN çekə daxil edirdi. İndi bunun əvəzinə DB-nin ÖZÜNDƆKİ
      // (daimi) `order_status` sahəsi istifadə olunur — "delivered"
      // olan sifariş ARTIQ keçmiş bir dövrdə bağlanıb deməkdir, indi
      // YENİDƆN çekə düşə bilməz, səhifə neçə dəfə yenilənsə də:
      const newlySettledIds = allTableOrders.filter(o => o.order_status !== 'delivered').map(o => o.id)

      allTableOrders.forEach(o => prevPaidRef.current.add(o.id))

      // ⚠️ KRİTİK: `order_status`-u "delivered" edirik — bu, DB
      // SƏVİYYƏSİNDƆ bağlanmadır. Bunsuz sifariş "pending/accepted"
      // statusunda ƏBƆDİ qalırdı, əsas sorğu (aşağıda) onu HƏR DƆFƆ
      // tapırdı — səhifə yenilənəndə `prevPaidRef` (yalnız YADDAŞDA,
      // RAM-da olan) sıfırlanırdı, sistem bunu YENİDƆN "təzə ödəniş"
      // kimi görüb çapı/bildirişi TƆKRARLAYIRDI. İndi DB-nin özü
      // "bağlı" olduğunu bilir, sayfa nə qədər yenilənsə də təkrarlanma
      // OLA BİLMƆZ:
      if (allTableOrders.length) {
        await supabase.from('pending_orders')
          .update({ order_status: 'delivered', processed_at: new Date().toISOString() })
          .in('id', allTableOrders.map(o => o.id))
      }

      if (newlySettledIds.length === 0) continue // hamısı əvvəllər artıq çap olunub

      const todayStr = new Date().toISOString().slice(0,10)
      const nowTime = new Date().toTimeString().slice(0,5)
      const { data: res } = await supabase.from('reservations')
        .select('id,reserved_date,reserved_time')
        .eq('business_id', user.business_id).gte('reserved_date', todayStr)
      const hasRes = (res||[]).some(r => r.reserved_date > todayStr || !r.reserved_time || r.reserved_time >= nowTime)
      await supabase.from('tables').update({ status: hasRes ? 'rezerv' : 'boş' }).eq('id', order.table_id)

      // ⚠️ VACİB: `tables.status`-u "boş" etmək kifayət deyil —
      // `active_orders` sətri (hansı işçinin bu masanı "son
      // toxunan" kimi qeyd olunduğu) də silinməlidir. Əks halda
      // masa "boş" görünsə belə, köhnə işçinin adı ekranlarda
      // (App-ın "Masalar" tabı, POS-un masa kartı) qalmağa davam edir.
      if (order.tables?.number) {
        await supabase.from('active_orders').delete()
          .eq('business_id', user.business_id).eq('table_number', String(order.tables.number))
      }

      loadLiveTables()
      const friendlyLabel = order.tables?.display_label || order.tables?.number
      toast(`💳 Masa ${friendlyLabel} — bütün qonaqlar ödədi, çek çap olunur`, 'info')

      // ⚠️ Davamlı bildiriş (zəng paneli) — sadəcə keçib-gedən toast YOX,
      // istifadəçi özü bağlayana kimi qalır:
      addNotification(`Masa ${friendlyLabel} müştəri tərəfindən online tam ödənildi`, {
        type: 'paid', tableNum: friendlyLabel,
      })

      // ⚠️ Müştərilər (kim neçə nəfər olsa da) hamısı onlayn ödədi —
      // BÜTÜN sifarişlərin məhsulları BİRLƏŞDİRİLİB BİR çek kimi
      // avtomatik çap olunur (hər qonaq üçün ayrıca çek YOX):
      const { data: fullOrders } = await supabase
        .from('pending_orders').select('*').in('id', newlySettledIds)
      const combined = {}
      let combinedTotal = 0
      ;(fullOrders || []).forEach(o => {
        combinedTotal += Number(o.total) || 0
        ;(o.items || []).forEach(i => {
          const k = `${i.name}|${i.price}`
          if (!combined[k]) combined[k] = { name: i.name, price: i.price, qty: 0 }
          combined[k].qty += i.qty
        })
      })
      // Statistika/Hesabatda "bugünkü satış"a daxil olsun deyə:
      await recordOnlineRevenue(friendlyLabel || '?', Object.values(combined), combinedTotal, order.table_id)

      printReceipt({
        id: order.table_id.slice(0, 8),
        table: friendlyLabel || '?',
        items: Object.values(combined),
        subtotal: combinedTotal,
        discount: 0,
        tax: 0, // müştəri ödənişi artıq ƏDV daxil ümumi məbləğdir
        total: combinedTotal,
        method: 'online',
        cashGiven: 0,
        time: new Date().toLocaleString('az'),
        businessName: user?.business_name || 'DigiMenu POS',
      })
      } finally {
        processingTablesRef.current.delete(order.table_id)
      }
    }
  }

  const updateStatus = async (orderId, status) => {
    const { error } = await supabase.from('pending_orders')
      .update({ order_status: status, processed_at: new Date().toISOString() }).eq('id', orderId)

    if (error) {
      console.error('Sifariş statusu yenilənmədi:', error.message)
      toast(`❌ Status yenilənmədi: ${error.message}`, 'error', 8000)
      return // ⚠️ DB yazısı uğursuz olubsa, lokal state-i DƏYİŞMİRİK —
             // əks halda ekran "uğurlu" görünüb 3 saniyə sonra köhnə
             // vəziyyətə geri düşərdi (məhz bu bug bildirilmişdi).
    }

    const order = orders.find(o => o.id === orderId)

    if (status === 'accepted') {
      if (order?.table_id) await supabase.from('tables').update({ status: 'dolu' }).eq('id', order.table_id)
      if (order?.tables?.number && order?.items?.length) mergeQROrderToTable(order.tables.number, order.items)
      loadLiveTables()
    }

    if (status === 'delivered' || status === 'rejected') {
      setOrders(prev => prev.filter(o => o.id !== orderId))
    } else {
      setOrders(prev => prev.map(o => o.id === orderId ? { ...o, order_status: status } : o))
    }

    const st = STATUSES.find(s => s.key === status)
    toast(`${st?.icon} ${st?.label}`, 'info')
  }

  const deleteOrder = async (orderId) => {
    if (!window.confirm('Bu sifarişi silmək istəyirsiniz?')) return
    const { error } = await supabase.from('pending_orders').delete().eq('id', orderId)
    if (error) { toast(`❌ Silinmədi: ${error.message}`, 'error', 6000); return }
    setOrders(prev => prev.filter(o => o.id !== orderId))
    toast('🗑 Sifariş silindi', 'info')
  }

  const count = orders.length
  const stColor = k => STATUSES.find(s => s.key === k)?.color || '#9AA4BC'
  const stLabel = k => STATUSES.find(s => s.key === k)?.label || k

  return (
    <>
      <button onClick={() => setOpen(p => !p)} className="pending-orders-btn" style={{
        background: count>0 ? 'rgba(233,30,140,0.12)' : 'var(--bg3)',
        border: count>0 ? '1px solid rgba(233,30,140,0.4)' : '1px solid var(--border)',
        color: count>0 ? '#E91E8C' : 'var(--gray)',
        borderRadius: 8, padding: '6px 12px', cursor: 'pointer', fontSize: 12, fontWeight: 700,
        display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0,
      }}>
        📥 <span className="btn-label-text">Sifarişlər</span>
        {count>0 && <span style={{ background:'#E91E8C', color:'#FFF', borderRadius:999, padding:'1px 6px', fontSize:10, fontWeight:800 }}>{count}</span>}
      </button>

      {open && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:900 }}
          onClick={() => setOpen(false)}>
          <div className="pending-orders-modal" style={{ background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:16, padding:20, width:'min(520px, 92vw)', maxHeight:'80vh', overflowY:'auto' }}
            onClick={e => e.stopPropagation()}>

            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
              <h3 style={{ margin:0, fontSize:16, color:'var(--white)' }}>📥 Aktiv sifarişlər {count>0&&`(${count})`}</h3>
              <button onClick={loadOrders} style={{ background:'none', border:'1px solid var(--border)', borderRadius:6, padding:'4px 10px', color:'var(--gray)', cursor:'pointer', fontSize:12 }}>🔄</button>
            </div>

            {count===0 ? (
              <p style={{ color:'var(--gray2)', fontSize:13, textAlign:'center', padding:20 }}>Aktiv sifariş yoxdur.</p>
            ) : orders.map(order => {
              const cur = order.order_status || 'pending'
              const paidKeys = Array.isArray(order.paid_item_keys) ? order.paid_item_keys : []
              const nextStatuses = cur==='pending' ? ['accepted','rejected']
                : STATUSES.filter(s => activeStages.includes(s.key) && s.key!=='rejected' && s.key!==cur).map(s => s.key)

              return (
                <div key={order.id} style={{ background:'var(--bg3)', borderRadius:12, padding:14, marginBottom:10, border:'1px solid var(--border)' }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:10 }}>
                    <div>
                      <div style={{ fontWeight:700, fontSize:14, color:'var(--white)' }}>
                        Masa {order.tables?.display_label || order.tables?.number || '?'} — {order.customer_name}
                      </div>
                      <div style={{ fontSize:11, color:'var(--gray2)', marginTop:2 }}>{new Date(order.created_at).toLocaleTimeString('az')}</div>
                    </div>
                    <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                      <span style={{ padding:'3px 10px', borderRadius:999, fontSize:11, fontWeight:700, background:stColor(cur)+'22', color:stColor(cur) }}>{stLabel(cur)}</span>
                      <span style={{ fontWeight:800, fontSize:15, color:'var(--accent)' }}>₼{Number(order.total).toFixed(2)}</span>
                      <button onClick={() => deleteOrder(order.id)} style={{ background:'none', border:'none', cursor:'pointer', fontSize:16, color:'var(--gray2)', padding:2 }}>🗑</button>
                    </div>
                  </div>

                  {/* Məhsullar */}
                  <div style={{ marginBottom:10 }}>
                    {(order.items||[]).map((item, ii) => {
                      const allQtyPaid = Array.from({length: item.qty}, (_, qi) => paidKeys.includes(`${order.id}_${ii}_${qi}`))
                      const paidCount = allQtyPaid.filter(Boolean).length
                      const full = paidCount === item.qty
                      const partial = paidCount > 0 && !full
                      return (
                        <div key={ii} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', fontSize:12, marginBottom:4, padding:'4px 0', borderBottom:'1px solid rgba(255,255,255,0.04)' }}>
                          <span style={{ color: full?'#00E6A8' : partial?'#FF9F5A':'var(--gray2)' }}>
                            {full?'✅ ':partial?`⚡${paidCount}/${item.qty} `:'• '}
                            {item.name} × {item.qty}
                          </span>
                          <span style={{ color: full?'#00E6A8':partial?'#FF9F5A':'var(--gray2)', fontWeight:full?700:400 }}>
                            ₼{(item.price*item.qty).toFixed(2)}
                          </span>
                        </div>
                      )
                    })}
                    {order.payment_status==='partial' && <div style={{ color:'#FF9F5A', fontSize:11, marginTop:6, fontWeight:600 }}>⚠️ Qismən ödənilib</div>}
                    {order.payment_status==='paid' && <div style={{ color:'#00E6A8', fontSize:11, marginTop:6, fontWeight:600 }}>✅ Tam ödənilib</div>}
                  </div>

                  {order.note && (
                    <div style={{ background:'rgba(255,179,0,.08)', borderRadius:6, padding:'6px 10px', fontSize:12, color:'var(--amber)', marginBottom:10 }}>
                      📝 {order.note}
                    </div>
                  )}

                  <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                    {cur==='pending' ? (<>
                      <button onClick={() => updateStatus(order.id, 'accepted')}
                        style={{ flex:2, padding:'8px', borderRadius:8, border:'none', background:'var(--green)', color:'#001018', fontWeight:700, cursor:'pointer', fontSize:12 }}>✅ Qəbul et</button>
                      <button onClick={() => updateStatus(order.id, 'rejected')}
                        style={{ flex:1, padding:'8px', borderRadius:8, border:'none', background:'rgba(255,90,95,.15)', color:'#FF5A5F', fontWeight:700, cursor:'pointer', fontSize:12 }}>❌ Rədd et</button>
                    </>) : nextStatuses.map(s => {
                      const st = STATUSES.find(x => x.key===s)
                      return <button key={s} onClick={() => updateStatus(order.id, s)}
                        style={{ padding:'7px 12px', borderRadius:8, border:`1px solid ${st.color}44`, background:`${st.color}11`, color:st.color, fontWeight:700, cursor:'pointer', fontSize:12 }}>
                        {st.icon} {st.label}
                      </button>
                    })}
                  </div>
                </div>
              )
            })}

            <button onClick={() => setOpen(false)}
              style={{ width:'100%', marginTop:8, padding:10, borderRadius:8, border:'1px solid var(--border)', background:'transparent', color:'var(--gray2)', cursor:'pointer' }}>
              Bağla
            </button>
          </div>
        </div>
      )}
    </>
  )
}