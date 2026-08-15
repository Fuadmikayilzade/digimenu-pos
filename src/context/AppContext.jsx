import { createContext, useContext, useState, useCallback, useMemo, useEffect, useRef } from 'react'
import { TAX_RATE, can } from '../utils/constants'
import { genId, nowTime, nowFull } from '../utils/helpers'
import { supabase } from '../utils/supabaseClient'
import { evaluateProgram, buildRewardText } from '../lib/loyaltyEngine'
import { programAppliesToBranch } from '../lib/loyaltyBranchScope'

const AppContext = createContext(null)
export const useApp = () => useContext(AppContext)

const LS = {
  get: (key, fallback) => {
    try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback }
    catch { return fallback }
  },
  set: (key, val) => {
    try { localStorage.setItem(key, JSON.stringify(val)) } catch {}
  },
}

const TABLE_COUNT_DEFAULT = 16
const initTables = (count = TABLE_COUNT_DEFAULT) => {
  const t = {}
  for (let i = 1; i <= count; i++) t[i] = { items: [], note: '', discount: 0 }
  return t
}

export function AppProvider({ children }) {
  // ── Auth ─────────────────────────────────────────────────────────
  const [user, setUser] = useState(() => LS.get('pos_user', null))
  const [branches, setBranches] = useState([])
  // ⚠️ KRİTİK DÜZƏLİŞ: `activeBranchId` əvvəllər HƏR CİHAZIN öz
  // localStorage-ında sərbəst saxlanılırdı (dropdown vasitəsilə seçilə
  // bilirdi). Bu, "Menecer Əlinin sifarişini görmür, öz adı yazılır"
  // bugunun ƏSL SƏBƏBİ idi — əgər bir cihazda (məs. köhnə testdən qalma)
  // fərqli filial seçilibsə, o cihaz BÜTÜN sorğularda (masalar,
  // sifarişlər, mətbəx) TAMAM FƏRQLİ "paralel dünyada" işləyirdi, halbuki
  // hər iki işçi eyni fiziki filialda idi.
  //
  // HƏLL: İŞÇİLƏR (ofisiant/menecer/mətbəx) üçün filial artıq sərbəst
  // seçim DEYİL — onların öz hesabına (staff_accounts.branch_id) təyin
  // olunmuş filiala AVTOMATİK VƏ DƏYİŞDİRİLMƏZ şəkildə sabitlənir.
  // Yalnız SAHİBKAR/ADMİN filiallar arasında sərbəst keçə bilər (onlar
  // bir neçə filiala nəzarət etdiyi üçün bu, lazımdır).
  const [activeBranchId, setActiveBranchIdRaw] = useState(() => LS.get('pos_active_branch', null))
  const setActiveBranchId = useCallback((id) => {
    LS.set('pos_active_branch', id)
    setActiveBranchIdRaw(id)
  }, [])

  useEffect(() => {
    if (!user) return
    const isOwnerOrAdminUser = user.role === 'owner' || user.role === 'admin'
    if (isOwnerOrAdminUser) return // sahibkar/admin sərbəst seçə bilər, toxunmuruq
    // İşçini MƏHZ öz təyin olunduğu filiala sabitləyirik (branch_id
    // yoxdursa — yəni əsas/tək filialdadırsa — null, bu da düzgündür):
    const pinnedBranch = user.branch_id || null
    if (activeBranchId !== pinnedBranch) {
      LS.set('pos_active_branch', pinnedBranch)
      setActiveBranchIdRaw(pinnedBranch)
    }
  }, [user]) // eslint-disable-line

  // ⚠️ KÖHNƏ SESSİYALAR ÜÇÜN GERİYƏ UYĞUNLUQ: səhifə yenilənəndə (F5)
  // istifadəçi `pos_user`-dən bərpa olunur, amma `pos_business_id` yalnız
  // YENİ girişdə (handleLogin-də) yazılır. Bu, artıq daxil olmuş
  // istifadəçilərdə həmin açarın olmamasına səbəb olurdu — PinLock
  // Supabase-ə sorğu belə göndərmədən DEFAULT PIN-ə düşürdü. Bu effekt
  // hər yükləmədə açarı sinxronlaşdırır:
  useEffect(() => {
    if (user?.business_id) localStorage.setItem('pos_business_id', user.business_id)
  }, [user?.business_id])

  const [view, setView] = useState(() => {
    // ⚠️ Elektron "mətbəx rejimi" (--kitchen bayrağı ilə açılan qısayol)
    // ?view=kitchen parametrini ötürür — bu, hər hansı istifadəçi rolu
    // ilə giriş edilsə belə, ekranı məcburi mətbəx görünüşünə keçirir:
    const urlParams = new URLSearchParams(window.location.search)
    if (urlParams.get('view') === 'kitchen') return 'kitchen'
    const u = LS.get('pos_user', null)
    return u?.role === 'kitchen' ? 'kitchen' : 'pos'
  })
  const [activeCat, setActiveCat]     = useState('Hamısı')
  const [search, setSearch]           = useState('')
  const [activeTable, setActiveTableRaw] = useState(1)
  const setActiveTable = (t) => { setActiveTableRaw(t); window.__activeTable = t }

  // ── Menu (Supabase: categories + products) ────────────────────────
  const [menuItems, setMenuItems] = useState([])
  const [loading, setLoading]     = useState(true)

  // ── Tables — masa "səbəti" (ödənənə qədər) ─────────────────────────
  // ⚠️ Bu state indi YALNIZ lokal keş rolunu oynayır — "həqiqət mənbəyi"
  // Supabase-dəki `active_orders` cədvəlidir (aşağıda). Hər dəyişiklik
  // dərhal Supabase-ə yazılır və Realtime ilə DİGƏR CİHAZLARA (ofisiantın
  // telefonu, menecerin telefonu, sahibin planşeti) ötürülür.
  const [tables, setTablesRaw] = useState(() => LS.get('pos_tables', null) || initTables())
  const setTables = useCallback((updater) => {
    setTablesRaw(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater
      LS.set('pos_tables', next)
      return next
    })
  }, [])

  // ── Sahiblənmə (Ownership) — "ofisiant/menecer yalnız öz açdığı
  // masaya toxuna bilər" qaydasının UI tərəfi. Əsl sərhəd RLS-dədir
  // (bax: 2026-08j_fix_active_orders_null_dup_and_manager_override.sql),
  // bu isə istifadəçiyə aydın mesaj göstərmək üçündür.
  const isOwnerOrAdmin = user?.role === 'owner' || user?.role === 'admin'
  const isManager = user?.role === 'manager'

  const canEditTable = useCallback((tableNumber) => {
    // Sahibkar/admin/menecer İSTƏNİLƏN masaya toxuna bilər (menecer
    // ofisiantların üzərində nəzarətçidir). Ofisiant/mətbəx isə YALNIZ
    // masanı İLK AÇAN özüdürsə (və ya hələ heç kimin açmadığı boş
    // masadırsa) toxuna bilər.
    //
    // ⚠️ QƏSDƏN `openedByUserId` yoxlanılır, `staffUserId` (son toxunan)
    // YOX — əks halda menecer bir dəfə toxunanda ofisiant öz açdığı
    // masanı "itirərdi" (növbəti dəfə giriş rədd edilərdi).
    if (isOwnerOrAdmin || isManager) return true
    const t = tables[tableNumber]
    if (!t || !t.openedByUserId) return true // hələ heç kim açmayıb — sərbəstdir
    return t.openedByUserId === user?.id
  }, [tables, isOwnerOrAdmin, isManager, user])

  const getTableOwnerName = useCallback((tableNumber) => {
    return tables[tableNumber]?.staffName || null
  }, [tables])

  const denyEdit = (tableNumber) => {
    const ownerName = getTableOwnerName(tableNumber)
    toast(`🔒 Bu masanı ${ownerName || 'başqa işçi'} açıb — yalnız o, menecer və ya sahibkar dəyişə bilər`, 'error', 5000)
  }

  const syncTimers = useRef({})

  // Bu, HƏQİQİ yazı məntiqidir (debounce OLMADAN) — həm adi debounce-lu
  // `syncActiveOrder`, həm də dərhal yazan `flushActiveOrderSync`
  // (mətbəxə göndərmədən əvvəl) bunu çağırır:
  const performActiveOrderSync = async (tableNumber, data) => {
    if (!user?.business_id) return
    if (!data.items.length) return // boşdursa yazma, ayrıca silinir

    let findQ = supabase.from('active_orders').select('id')
      .eq('business_id', user.business_id).eq('table_number', String(tableNumber))
    findQ = activeBranchId ? findQ.eq('branch_id', activeBranchId) : findQ.is('branch_id', null)
    const { data: existingRows, error: findErr } = await findQ.limit(1)

    if (findErr) {
      console.error('Sifariş axtarılmadı:', findErr.message)
      toast(`Masa ${getTableLabel(tableNumber)}: sinxronizasiya xətası — ${findErr.message}`, 'error', 6000)
      return
    }

    const payload = {
      items: data.items,
      note: data.note || '',
      discount: data.discount || 0,
      // Son əməliyyatı APARAN kimi qeyd olunur (görüntü üçün — hər
      // dəfə yenilənir):
      staff_user_id: user.id,
      staff_id: user.staff_account_id || null,
      staff_name: user.name || null,
    }

    const existing = existingRows?.[0]
    const { error } = existing
      // ⚠️ UPDATE-də `opened_by_user_id` YAZILMIR — bu sahə YALNIZ
      // masa ilk dəfə açılanda təyin olunur və bir daha dəyişmir.
      // Əks halda menecer bir dəfə toxunanda ofisiant öz açdığı
      // masaya bir daha yaza bilməzdi.
      ? await supabase.from('active_orders').update(payload).eq('id', existing.id)
      : await supabase.from('active_orders').insert({
          business_id: user.business_id, branch_id: activeBranchId,
          table_number: String(tableNumber),
          opened_by_user_id: user.id, opened_by_name: user.name || null,
          ...payload,
        })

    if (error) {
      console.error('Sifariş sinxronlaşmadı:', error.message)
      toast(`Masa ${getTableLabel(tableNumber)}: sinxronizasiya xətası — ${error.message}`, 'error', 6000)
      return
    }

    // ⚠️ "GÜZGÜ" YAZISI: Müştərinin öz QR-ından açdığı "Ödə/Sifarişlərim"
    // səhifəsi YALNIZ `pending_orders`-i oxuyur — kassirin özü POS-dan
    // əlavə etdiyi məhsullar (yuxarıdaki `active_orders`) heç vaxt ora
    // yazılmırdı, ona görə müştəri kassirin əlavə etdiyini görə/ödəyə
    // bilmirdi. Bu sətir eyni səbəti `pending_orders`-də də saxlayır
    // (source='staff' ilə), ki müştəri onu öz telefonundan görüb
    // onlayn ödəyə bilsin:
    await syncStaffOrderMirror(tableNumber, data)
  }

  // Supabase-ə debounce ilə yazır (hər toxunuşda deyil, 500ms sükutdan
  // sonra) — sürətli +/- klikləri şəbəkəni doldurmasın deyə.
  //
  // ⚠️ QƏSDƏN upsert(onConflict:...) İSTİFADƏ OLUNMUR. Səbəb: PostgreSQL-də
  // iki NULL dəyər HEÇ VAXT bir-birinə bərabər sayılmır, ona görə
  // "unique(business_id, branch_id, table_number)" məhdudiyyəti
  // branch_id NULL olan (tək filiallı) bizneslərdə İŞLƏMİR — hər upsert
  // konflikt tapmayıb TƏZƏ, TƏKRARLANAN sətir yaradırdı (bu, "Fuad
  // Əlinin sifarişini görə bilmirdi" bugunun məhz səbəbi idi). Bunun
  // əvəzinə əvvəlcə mövcud sətri ƏL İLƏ axtarırıq (bu fayldakı digər
  // funksiyalar — məs. getOrCreateSupabaseTable — artıq elə bu üsulu
  // istifadə edir), tapılarsa UPDATE, tapılmazsa INSERT edirik.
  //
  // Hər uğurlu yazıda staff_user_id/staff_name CARİ istifadəçiyə
  // yenilənir — "kim sonuncu əməliyyat aparıbsa, adı qeyd olsun" tələbi:
  const syncActiveOrder = useCallback((tableNumber, data) => {
    clearTimeout(syncTimers.current[tableNumber])
    syncTimers.current[tableNumber] = setTimeout(() => {
      performActiveOrderSync(tableNumber, data)
    }, 500)
  }, [user, activeBranchId]) // eslint-disable-line

  // ⚠️ KRİTİK DÜZƏLİŞ: "sifariş mətbəxə göndərildi, amma active_orders-ə
  // HEÇ VAXT yazılmadı" bugunun səbəbi bu idi — mətbəxə göndərmə DƏRHAL
  // baş verir, səbətin özünün Supabase-ə yazılması isə 500ms GECİKMƏ
  // ilə (debounce). Əgər işçi göndərdikdən DƏRHAL sonra (500ms bitmədən)
  // hesabdan çıxsa/səhifəni bağlasa, səbət HEÇ VAXT yadda saxlanmırdı —
  // yalnız mətbəx ticket-i qalırdı, müştəri "Sifarişlərim"də heç nə
  // görmürdü. Bu funksiya gözləmə vaxtını LƏĞV EDİB DƏRHAL yazır:
  const flushActiveOrderSync = async (tableNumber, data) => {
    clearTimeout(syncTimers.current[tableNumber])
    await performActiveOrderSync(tableNumber, data)
  }

  // Kassirin aktiv səbətini `pending_orders`-də "güzgüləyir" (bir masa
  // üçün YALNIZ BİR belə sətir saxlanılır, hər dəyişiklikdə YENİLƆNİR —
  // müştərinin özünün ayrıca göndərdiyi sifarişlərə TOXUNMUR):
  const syncStaffOrderMirror = async (tableNumber, cartData) => {
    if (!user?.business_id) return
    const tableId = await getOrCreateSupabaseTable(tableNumber)
    if (!tableId) return

    // ⚠️ KRİTİK: "delivered + paid" olan (yəni artıq bağlanmış, KEÇMİŞ
    // bir sessiyaya aid) "staff" güzgü sətirləri BURAYA UYĞUN SAYILMIR —
    // əks halda köhnə (bağlanmış) sifariş "hazırkı" kimi qəbul edilib
    // onun ÜSTÜNƆ yazıla, YA DA (daha pisi) bir yerdə köhnə sətr TOXUNULMAZ
    // qalıb yeni sətrlə YANAŞI qala bilərdi — bu, "kassir kabab yazıb,
    // müştəri hamburger görür" bugunun məhz səbəbi idi (iki fərqli sətir
    // eyni masa üçün paralel mövcud olub, müştəri köhnəsini görürdü).
    const { data: openMirrors, error: lookupErr } = await supabase.from('pending_orders')
      .select('id, created_at').eq('table_id', tableId).eq('source', 'staff')
      .neq('order_status', 'rejected')
      // "delivered + paid" = bağlanmış sətri İSTİSNA et. De Morgan qanunu
      // ilə: NOT(A VƆ B) = (A DEYİL) VƆ YA (B DEYİL):
      .or('order_status.neq.delivered,payment_status.neq.paid')
      .order('created_at', { ascending: false })

    if (lookupErr) {
      console.error('Güzgü sifarişi axtarılmadı:', lookupErr.message)
      toast(`⚠️ Müştəriyə göstərilə bilmədi: ${lookupErr.message}`, 'error', 8000)
      return
    }

    const itemsTotal = cartData.items.reduce((s, i) => s + Number(i.price) * i.qty, 0)
    const discountAmount = itemsTotal * ((cartData.discount || 0) / 100)
    const total = Math.max(0, itemsTotal - discountAmount) * (1 + (user?.tax_rate ?? TAX_RATE))

    const payload = {
      business_id: user.business_id, branch_id: activeBranchId, table_id: tableId,
      items: cartData.items.map(i => ({ name: i.name, price: i.price, qty: i.qty, category: i.category || '' })),
      total, order_status: 'accepted', payment_status: 'unpaid',
      source: 'staff', customer_name: 'Ofisiant/Menecer (POS)',
    }

    if (openMirrors && openMirrors.length > 0) {
      // Ən son yaranan (CARİ) sətri YENİLƆ, id-sini SAXLA (əks halda
      // müştərinin artıq ödədiyi məhsulların qeydi — paid_item_keys —
      // itə bilərdi). Əgər səhvən bir neçə "açıq" sətir yaranıbsa,
      // ARTIQLARINI TƆMİZLƆ:
      const [keep, ...extras] = openMirrors
      const { error: updErr } = await supabase.from('pending_orders').update(payload).eq('id', keep.id)
      if (updErr) {
        console.error('Güzgü sifarişi yenilənmədi:', updErr.message)
        toast(`⚠️ Müştəriyə göstərilə bilmədi: ${updErr.message}`, 'error', 8000)
      }
      if (extras.length) {
        await supabase.from('pending_orders').delete().in('id', extras.map(e => e.id))
      }
    } else {
      // Açıq (hələ bağlanmamış) heç bir güzgü yoxdur — bu, HƆQİQƆTƆN
      // yeni bir sessiyadır, təzə sətir yaradılır:
      const { error: insErr } = await supabase.from('pending_orders').insert(payload)
      if (insErr) {
        console.error('Güzgü sifarişi yaradılmadı:', insErr.message)
        toast(`⚠️ Müştəriyə göstərilə bilmədi: ${insErr.message}`, 'error', 8000)
      }
    }
  }

  const clearActiveOrder = useCallback(async (tableNumber) => {
    if (!user?.business_id) return
    clearTimeout(syncTimers.current[tableNumber])
    let q = supabase.from('active_orders').delete()
      .eq('business_id', user.business_id).eq('table_number', String(tableNumber))
    q = activeBranchId ? q.eq('branch_id', activeBranchId) : q.is('branch_id', null)
    const { error } = await q
    if (error) console.error('active_orders silinmədi:', error.message)

    // ⚠️ KRİTİK: masa BAĞLANANDA (ödəniş olmadan — ləğv və ya səbət
    // boşaldılanda) bu masanın QALAN bütün `pending_orders` sətirləri
    // (HƆM kassirin "güzgü" sifarişi, HƆM DƆ müştərinin ÖZ QR-dan
    // göndərdiyi sifarişlər) "rejected" kimi bağlanmalıdır. ƆVVƆLKİ
    // KOD yalnız kassirin güzgüsünü silirdi — müştərinin ÖZ göndərdiyi
    // sifariş (məs. "2 fri") isə "unpaid/accepted" olaraq QALIRDI və
    // eyni masa YENİDƆN istifadə olunanda YENİ sessiyanın sifarişi ilə
    // QARIŞIRDI ("2 fri + 1 hamburger" kimi görünmə bugu buradan idi).
    const tableId = await getOrCreateSupabaseTable(tableNumber)
    if (tableId) {
      await supabase.from('pending_orders').delete()
        .eq('table_id', tableId).eq('source', 'staff').eq('payment_status', 'unpaid')

      await supabase.from('pending_orders')
        .update({ order_status: 'rejected', processed_at: new Date().toISOString() })
        .eq('table_id', tableId)
        .neq('order_status', 'rejected')
        .neq('payment_status', 'paid') // artıq ödənilmişlərə (tarixçə) toxunmuruq
    }
  }, [user, activeBranchId])

  // ── active_orders yüklənməsi + Realtime abunəlik ──────────────────
  // Hər cihaz eyni biznesin bütün masalarını görür (kim nəyi açıb daxil),
  // amma yalnız öz açdığına toxuna bilir (RLS + canEditTable yuxarıda).
  useEffect(() => {
    if (!user?.business_id) return

    const loadActiveOrders = () => {
      let q = supabase.from('active_orders').select('*').eq('business_id', user.business_id)
      q = activeBranchId ? q.eq('branch_id', activeBranchId) : q.is('branch_id', null)
      q.then(({ data }) => {
        setTables(prev => {
          // ⚠️ ƏVVƆLKİ KOD burada "naməlum" açarları (initTables()-in
          // əhatə etmədiyi masa nömrələrini, məs. digər filialın 9-20
          // aralığındaki masalarını) köhnə `prev`-dən SAXLAYIRDI. Filial
          // dəyişəndə bu, ƏVVƆLKİ filialın "dolu" statuslu masa
          // məlumatının YENİ filiala SIZMASINA səbəb olurdu — filial B-yə
          // keçəndə B-nin əslində boş olan masaları A-dan qalma köhnə
          // cart data ucbatından "dolu" görünürdü. İndi filial dəyişəndə
          // (bu effekt YALNIZ activeBranchId dəyişəndə işə düşür) state
          // TAM sıfırlanır — yalnız TƏZƏ yüklənən active_orders məlumatı
          // etibar ediləndir:
          const next = { ...initTables() }
          ;(data || []).forEach(row => {
            next[row.table_number] = {
              items: row.items || [], note: row.note || '', discount: Number(row.discount) || 0,
              staffUserId: row.staff_user_id, staffId: row.staff_id, staffName: row.staff_name,
              openedByUserId: row.opened_by_user_id, openedByName: row.opened_by_name,
            }
          })
          return next
        })
      })
    }

    loadActiveOrders()
    // ⚠️ Ehtiyat tədbiri: realtime bir səbəbdən (şəbəkə kəsilməsi,
    // REPLICA IDENTITY problemi və s.) hadisəni buraxsa belə, ekran
    // uzun müddət köhnə qalmasın deyə hər 15 saniyədə bir tam yenilənir:
    const pollInterval = setInterval(loadActiveOrders, 15000)

    const ch = supabase.channel(`active_orders_rt_${user.business_id}_${activeBranchId || 'main'}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'active_orders', filter: `business_id=eq.${user.business_id}` }, (payload) => {
        setTables(prev => {
          if (payload.eventType === 'DELETE') {
            const tblNum = payload.old?.table_number
            // ⚠️ EHTİYAT TƆDBİRİ: əgər `table_number` DELETE paketində
            // yoxdursa (REPLICA IDENTITY FULL hələ tətbiq olunmayıbsa),
            // heç nəyə TOXUNMURUQ (undefined açara yazmırıq) — yuxarıdaki
            // 15 saniyəlik poll bunu düzəldəcək:
            if (!tblNum) return prev
            return { ...prev, [tblNum]: { items: [], note: '', discount: 0 } }
          }
          const row = payload.new
          const rowBranch = row.branch_id || null
          const wantedBranch = activeBranchId || null
          if (rowBranch !== wantedBranch) return prev // başqa filialın masasıdır, bura aid deyil
          return {
            ...prev,
            [row.table_number]: {
              items: row.items || [], note: row.note || '', discount: Number(row.discount) || 0,
              staffUserId: row.staff_user_id, staffId: row.staff_id, staffName: row.staff_name,
            openedByUserId: row.opened_by_user_id, openedByName: row.opened_by_name,
            },
          }
        })
      })
      .subscribe()

    return () => { supabase.removeChannel(ch); clearInterval(pollInterval) }
  }, [user?.business_id, activeBranchId]) // eslint-disable-line

  // Filial dəyişəndə yerli "səbət" (cart) sıfırlanır — köhnə filialın
  // masa məlumatları yeni filialda görünməsin (kontaminasiya bağı).
  const prevBranchRef = useRef(undefined)
  useEffect(() => {
    if (prevBranchRef.current === undefined) {
      prevBranchRef.current = activeBranchId
      return
    }
    if (prevBranchRef.current !== activeBranchId) {
      const fresh = initTables()
      setTablesRaw(fresh)
      LS.set('pos_tables', fresh)
      prevBranchRef.current = activeBranchId
    }
  }, [activeBranchId])

  // ── Orders (Supabase) ──────────────────────────────────────────────
  const [orders, setOrdersRaw] = useState(() => LS.get('pos_orders', []))
  const setOrders = useCallback((updater) => {
    setOrdersRaw(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater
      LS.set('pos_orders', next)
      return next
    })
  }, [])

  // ── Kitchen Tickets — Supabase-də saxlanılır + Realtime ilə bütün
  // cihazlara (ofisiantın telefonu, mətbəxin planşeti və s.) yayımlanır.
  // ƏVVƏLKİ VERSİYADA localStorage-da idi, ona görə mətbəx "hazırdır"
  // dedikdə digər cihazlar (məs. ofisiantın telefonu) bunu heç vaxt görmürdü.
  const [tickets, setTicketsRaw] = useState([])
  const prevTicketsRef = useRef(null)

  // ⚠️ Bildiriş qutusu HƏR 24 SAATDAN BİR (Azərbaycan saatı ilə —
  // UTC+4, yay/qış saatı fərqi yoxdur) AVTOMATİK sıfırlanır. Bu, "x"
  // ilə silinməyən (yalnız sahibkar silə bilər) bildirişlərin əbədi
  // yığılmasının qarşısını alır:
  const getBakuDateString = () => {
    // UTC+4 saata çevirib təqvim tarixini çıxarırıq (DST yoxdur, sabit ofset):
    const bakuMs = Date.now() + 4 * 60 * 60 * 1000
    return new Date(bakuMs).toISOString().slice(0, 10)
  }

  const [readyNotifs, setReadyNotifsRaw] = useState(() => {
    const storedDate = LS.get('pos_ready_notifs_reset_date', null)
    const todayBaku = new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString().slice(0, 10)
    if (storedDate !== todayBaku) {
      // 24 saat keçib (fərqli Bakı təqvim günü) — sıfırla:
      LS.set('pos_ready_notifs', [])
      LS.set('pos_ready_notifs_reset_date', todayBaku)
      return []
    }
    return LS.get('pos_ready_notifs', [])
  })
  const setReadyNotifs = useCallback((updater) => {
    setReadyNotifsRaw(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater
      LS.set('pos_ready_notifs', next)
      return next
    })
  }, [])

  // Səhifə açıq qalarsa (heç yenilənmədən) belə, gecəyarını keçəndə
  // qutu sıfırlansın deyə hər dəqiqə yoxlanılır:
  useEffect(() => {
    const check = () => {
      const storedDate = LS.get('pos_ready_notifs_reset_date', null)
      const todayBaku = getBakuDateString()
      if (storedDate !== todayBaku) {
        LS.set('pos_ready_notifs_reset_date', todayBaku)
        setReadyNotifsRaw([])
        LS.set('pos_ready_notifs', [])
      }
    }
    const interval = setInterval(check, 60 * 1000)
    return () => clearInterval(interval)
  }, [])

  const [toasts, setToasts] = useState([])
  const [showPayment, setShowPayment] = useState(false)

  // ── Mobil UI — kiçik ekranlarda sidebar (kateqoriya/masalar) və
  // səbət ayrıca "çəkmə" (drawer) kimi açılır/bağlanır. Masaüstündə
  // bu state-in effekti yoxdur (CSS-də yalnız mobil breakpoint-də işə düşür).
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)
  const [mobileCartOpen, setMobileCartOpen] = useState(false)

  // ── Loyallıq — masa üzrə seçilmiş üzv (ödəniş tamamlananda ziyarət
  // avtomatik qeyd olunur, mükafat yoxlanılır) ────────────────────────
  const [photoRequired, setPhotoRequired] = useState(false)
  const [loyaltySelections, setLoyaltySelections] = useState({}) // { [tableNumber]: memberRow }

  useEffect(() => {
    if (!user?.business_id) return
    supabase.from('business_settings').select('loyalty_photo_required')
      .eq('business_id', user.business_id).order('updated_at', { ascending: false }).limit(1)
      .then(({ data }) => setPhotoRequired(!!data?.[0]?.loyalty_photo_required))
  }, [user?.business_id])

  const setActiveLoyaltyMember = useCallback((member) => {
    setLoyaltySelections(prev => ({ ...prev, [activeTable]: member }))
  }, [activeTable])

  // ── Onlayn / "öz payını ödə" statusu — müştərilər masanın hesabını
  // özləri (tam və ya qismən) ödəyə bilər. Bu, POS-un aktiv səbətində
  // hər məhsulun yanında yaşıl "✓ ödənilib" işarəsi və qalıq borcu
  // göstərmək üçün istifadə olunur.
  const [pendingOrdersRaw, setPendingOrdersRaw] = useState([])

  useEffect(() => {
    if (!user?.business_id) return
    const load = async () => {
      const { data } = await supabase.from('pending_orders')
        .select('id, table_id, items, paid_item_keys, payment_status, order_status, tables(number)')
        .eq('business_id', user.business_id).neq('order_status', 'rejected')
      // ⚠️ VACİB: "çatdırılıb + tam ödənilib" olan sifarişlər ARTIQ
      // KEÇMİŞ bir ziyarətin bağlanmış hesabıdır. Eyni masa fiziki
      // olaraq başqa gün/başqa müştəri üçün yenidən istifadə olunur —
      // əgər bunları çıxarmasaq, köhnə (aylar əvvəl ödənilmiş) hesab
      // HƆMİŞƆLİK "bu masanın ödənilmiş məbləği"nə sayılmağa davam edərdi:
      const activeOnly = (data || []).filter(o => !(o.order_status === 'delivered' && o.payment_status === 'paid'))
      setPendingOrdersRaw(activeOnly)
    }
    load()
    const interval = setInterval(load, 4000)
    const ch = supabase.channel(`pos_pending_pay_${user.business_id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pending_orders', filter: `business_id=eq.${user.business_id}` }, load)
      .subscribe()
    return () => { clearInterval(interval); supabase.removeChannel(ch) }
  }, [user?.business_id])

  // Bir masa üçün: onlayn ödənilmiş ümumi məbləğ + hər (ad,qiymət)
  // kombinasiyası üzrə neçə ədədinin ödənildiyi (approksimativ uyğunluq —
  // eyni ad+qiymətli məhsullar bir qrup kimi sayılır):
  const getTablePaymentInfo = useCallback((tableNumber) => {
    const relevant = pendingOrdersRaw.filter(o => String(o.tables?.number) === String(tableNumber))
    let paidAmount = 0
    const paidQtyByKey = {}
    relevant.forEach(o => {
      const paidKeys = Array.isArray(o.paid_item_keys) ? o.paid_item_keys : []
      ;(o.items || []).forEach((item, ii) => {
        for (let qi = 0; qi < item.qty; qi++) {
          if (paidKeys.includes(`${o.id}_${ii}_${qi}`)) {
            paidAmount += Number(item.price) || 0
            const k = `${item.name}|${item.price}`
            paidQtyByKey[k] = (paidQtyByKey[k] || 0) + 1
          }
        }
      })
    })
    return { paidAmount, paidQtyByKey }
  }, [pendingOrdersRaw])

  // Ödəniş tamamlananda çağırılır: ziyarəti (sifariş məbləği daxil)
  // qeyd edir, aktiv proqramları yoxlayır, yeni qazanılan mükafatları
  // qaytarır (POSPage bunu toast ilə göstərir).
  //
  // ⚠️ orderTotal ötürülür — çünki bəzi proqramlarda "hər ziyarətdə
  // minimum sifariş" şərti ola bilər (rules.min_order_per_visit).
  const recordVisitAndCheckRewards = async (member, orderTotal) => {
    if (!member?.id || !user?.business_id) return []
    const todayStr = new Date().toISOString().slice(0, 10)

    await supabase.from('loyalty_visits').insert({
      business_id: user.business_id, member_id: member.id, visit_date: todayStr,
      order_total: orderTotal ?? null, branch_id: activeBranchId,
      staff_id: user.staff_account_id || null, staff_name: user.name || null,
    }) // unique(member_id, visit_date) — eyni gün ikinci dəfə xəta verər, bu normaldır, məhdudlaşdırmır

    // ⚠️ VACİB: yalnız BU FİLİALDA edilmiş ziyarətlər sayılır — başqa
    // filialda edilmiş ziyarət bu filialın proqramına aid deyil:
    let visitQ = supabase.from('loyalty_visits')
      .select('visit_date, order_total').eq('member_id', member.id).order('visit_date')
    visitQ = activeBranchId ? visitQ.eq('branch_id', activeBranchId) : visitQ.is('branch_id', null)
    const { data: visitRows } = await visitQ
    const visits = visitRows || []

    // ⚠️ Proqramlar indi ÇOXSAYLI filiala aid ola bilər (bir, bir neçə,
    // ya da hamısı) — bunu sadə "branch_id = X" sorğusu ilə süzmək
    // olmur, ona görə hamısını çəkib client-tərəfdə süzürük:
    const { data: allPrograms } = await supabase.from('loyalty_programs')
      .select('*').eq('business_id', user.business_id).eq('is_active', true).eq('is_template', false)
    const programs = (allPrograms || []).filter(p => programAppliesToBranch(p, activeBranchId || null))

    const earned = []
    for (const program of programs || []) {
      if (program.type === 'order_amount') continue // sifariş məbləği ilə ayrıca yoxlanılır (aşağıda)
      const { data: grantedRows } = await supabase.from('loyalty_rewards')
        .select('period_key').eq('member_id', member.id).eq('program_id', program.id)
      const grantedKeys = new Set((grantedRows || []).map(r => r.period_key).filter(Boolean))
      const result = evaluateProgram(program, visits, grantedKeys)
      if (result.eligible && !result.alreadyGranted) {
        const { data } = await supabase.from('loyalty_rewards').insert({
          business_id: user.business_id, member_id: member.id, program_id: program.id,
          reward_description: buildRewardText(program), period_key: result.periodKey,
          branch_id: activeBranchId,
        }).select().single()
        if (data) earned.push({ program, reward: data })
      }
    }
    return earned
  }

  // 'order_amount' tipli proqramlar üçün — cari sifarişin məbləğinə görə
  // dərhal yoxlanılır (ziyarət tarixçəsi lazım deyil):
  const checkOrderAmountRewards = async (member, orderTotal) => {
    if (!member?.id || !user?.business_id) return []
    const { data: allPrograms } = await supabase.from('loyalty_programs')
      .select('*').eq('business_id', user.business_id).eq('is_active', true)
      .eq('is_template', false).eq('type', 'order_amount')
    const programs = (allPrograms || []).filter(p => programAppliesToBranch(p, activeBranchId || null))

    const earned = []
    for (const program of programs || []) {
      const needed = program.rules?.min_order_amount || 0
      if (orderTotal < needed) continue
      const periodKey = `order:${new Date().toISOString().slice(0, 10)}:${program.id}`
      const { data: existing } = await supabase.from('loyalty_rewards')
        .select('id').eq('member_id', member.id).eq('program_id', program.id).eq('period_key', periodKey).maybeSingle()
      if (existing) continue
      const { data } = await supabase.from('loyalty_rewards').insert({
        business_id: user.business_id, member_id: member.id, program_id: program.id,
        reward_description: buildRewardText(program), period_key: periodKey,
        branch_id: activeBranchId,
      }).select().single()
      if (data) earned.push({ program, reward: data })
    }
    return earned
  }
  const [showReceipt, setShowReceipt] = useState(null)
  const [confirmDel, setConfirmDel]   = useState(null)

  const toast = useCallback((msg, type = 'success', duration = 3500) => {
    const id = Date.now() + Math.random()
    setToasts(t => [...t, { id, msg, type }])
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), duration)
  }, [])

  // ── Eyni stansiyada tablar arası sinxronizasiya (masalar/çeklər hələ
  // lokaldır). Ticket-lər artıq Supabase Realtime ilə sinxronlaşır
  // (aşağıda), ona görə burada saxlanmır.
  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'pos_tables' && e.newValue) { try { setTablesRaw(JSON.parse(e.newValue)) } catch {} }
      if (e.key === 'pos_orders' && e.newValue) { try { setOrdersRaw(JSON.parse(e.newValue)) } catch {} }
    }
    window.addEventListener('storage', handler)
    return () => window.removeEventListener('storage', handler)
  }, [])

  useEffect(() => {
    const prev = prevTicketsRef.current
    if (prev === null) { prevTicketsRef.current = tickets; return }
    const justReady = tickets.filter(nt =>
      nt.status === 'ready' && prev.some(pt => pt.id === nt.id && pt.status !== 'ready')
    )
    if (user && user.role !== 'kitchen' && justReady.length > 0) {
      justReady.forEach(t => {
        // ⚠️ ƏVVƆLKİ KOD burada AYRICA (həm `setReadyNotifs`, həm də
        // `toast(..., 7000)`) iki paralel bildiriş yaradırdı — toast
        // 7 saniyəyə özü-özünə yox olurdu (səs/titrəyiş də yox idi),
        // digəri isə "x" silənə qədər qalırdı. İndi vahid, ortaq
        // `addNotification()` istifadə olunur — səs+titrəyiş avtomatik
        // gəlir, YALNIZ "x" ilə (menecer/sahibkar) silinənə qədər qalır:
        const label = getTableLabel(t.table)
        addNotification(`🍽 Masa ${label} hazırdır!`, { type: 'ready', tableNum: label })
      })
    }
    prevTicketsRef.current = tickets
  }, [tickets]) // eslint-disable-line

  // ── Kitchen Tickets — Supabase yüklənməsi + Realtime abunəlik ────
  // Hər cihaz (ofisiantın telefonu, mətbəxin planşeti, sahibin
  // kompüteri) eyni biznesin ticket-lərinə abunə olur. Kim harada
  // "hazır" desə, hamısı DƏRHAL görür.
  const mapTicketRow = (row) => ({
    id: row.id,
    table: row.table_number,
    items: row.items || [],
    note: row.note || '',
    time: new Date(row.created_at).toLocaleTimeString('az', { hour: '2-digit', minute: '2-digit' }),
    status: row.status,
    created: new Date(row.created_at).getTime(),
    staffName: row.staff_name || '',
  })

  useEffect(() => {
    if (!user?.business_id) { setTicketsRaw([]); return }

    let q = supabase.from('kitchen_tickets').select('*').eq('business_id', user.business_id).neq('status', 'served')
    q = activeBranchId ? q.eq('branch_id', activeBranchId) : q.is('branch_id', null)
    q.order('created_at').then(({ data }) => {
      setTicketsRaw((data || []).map(mapTicketRow))
    })

    const ch = supabase.channel(`kitchen_tickets_rt_${user.business_id}_${activeBranchId || 'main'}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'kitchen_tickets',
        filter: `business_id=eq.${user.business_id}`,
      }, (payload) => {
        setTicketsRaw((prev) => {
          if (payload.eventType === 'DELETE') {
            return prev.filter((t) => t.id !== payload.old.id)
          }
          const row = payload.new
          // Filialı fərqli olan ticket-ləri (əgər filial filtri aktivdirsə) nəzərə alma:
          const rowBranch = row.branch_id || null
          const wantedBranch = activeBranchId || null
          if (rowBranch !== wantedBranch) {
            return prev.filter((t) => t.id !== row.id) // başqa filiala keçibsə buradan sil
          }
          if (row.status === 'served') return prev.filter((t) => t.id !== row.id)
          const mapped = mapTicketRow(row)
          const exists = prev.some((t) => t.id === mapped.id)
          return exists ? prev.map((t) => (t.id === mapped.id ? mapped : t)) : [...prev, mapped]
        })
      })
      .subscribe()

    return () => { supabase.removeChannel(ch) }
  }, [user?.business_id, activeBranchId])

  // ── Auth ─────────────────────────────────────────────────────────
  const handleLogin = useCallback((u) => {
    LS.set('pos_user', u)
    // ⚠️ KRİTİK: PinLock.jsx bu açarı BİRBAŞA (raw) localStorage-dan
    // oxuyur (`localStorage.getItem('pos_business_id')`). Bu sətir
    // olmadan həmin açar HEÇ VAXT yazılmırdı — nəticədə PinLock
    // Supabase-ə sorğu belə göndərmədən avtomatik DEFAULT PIN-ə
    // (1234) düşürdü, sahibkarın dəyişdiyi yeni PIN heç yoxlanmırdı.
    if (u?.business_id) localStorage.setItem('pos_business_id', u.business_id)
    setUser(u)
    setView(u.role === 'kitchen' ? 'kitchen' : 'pos')
  }, [])

  // Sahibkar adını mobil tətbiqdə yeniləyibsə, POS-da da güncəl görünsün
  useEffect(() => {
    if (!user?.business_id) return
    supabase.auth.getUser().then(({ data }) => {
      const freshName = data?.user?.user_metadata?.full_name
      if (freshName && freshName !== user.name) {
        const updated = { ...user, name: freshName }
        LS.set('pos_user', updated)
        setUser(updated)
      }
    })
  }, [user?.business_id]) // eslint-disable-line

  const handleLogout = useCallback(async () => {
    await supabase.auth.signOut()
    LS.set('pos_user', null)
    localStorage.removeItem('pos_business_id')
    setUser(null)
    setView('pos')
  }, [])

  // ── Filiallar siyahısı ──────────────────────────────────────────
  useEffect(() => {
    if (!user?.business_id) return
    supabase.from('branches').select('*').eq('business_id', user.business_id).then(({ data }) => {
      setBranches(data || [])
    })
  }, [user])

  // ── Real masalar (Supabase) — sabit TABLE_COUNT əvəzinə canlı siyahı ──
  const [liveTables, setLiveTables] = useState([])

  const loadLiveTables = useCallback(async () => {
    if (!user?.business_id) return
    let q = supabase.from('tables').select('*').eq('business_id', user.business_id)
    q = activeBranchId ? q.eq('branch_id', activeBranchId) : q.is('branch_id', null)
    const { data } = await q
    const sorted = (data || []).slice().sort((a, b) => Number(a.number) - Number(b.number))
    setLiveTables(sorted)
  }, [user, activeBranchId])

  // ⚠️ KRİTİK DÜZƏLİŞ: `activeTable` filial dəyişəndə HEÇ VAXT
  // sıfırlanmırdı. Sahibkar bir filialda (məs. daxili nömrəsi "34"
  // olan) masaya baxıb sonra BAŞQA filiala keçəndə, bu köhnə "34" dəyəri
  // yaddaşda qalırdı. Arxa planda hər hansı sinxronizasiya (getOrCreate-
  // SupabaseTable) bu nömrəni YENİ filialda axtaranda tapmır və
  // SƏSSİZCƆ YENİ, "xəyal" bir masa YARADIRDI — məhz "masa 34 heç kim
  // yaratmayıb" bugunun səbəbi budur. İndi masalar siyahısı yenilənəndə,
  // əgər hazırkı seçim bu filialda MÖVCUD deyilsə, avtomatik olaraq
  // filialın İLK masasına keçirilir:
  useEffect(() => {
    if (!liveTables.length) return
    const stillValid = liveTables.some(t => Number(t.number) === Number(activeTable))
    if (!stillValid) {
      setActiveTable(Number(liveTables[0].number))
    }
  }, [liveTables]) // eslint-disable-line

  useEffect(() => {
    loadLiveTables()
    const interval = setInterval(loadLiveTables, 8000)

    // Realtime — ödəniş olduqda dərhal yenilə
    if (!user?.business_id) return () => clearInterval(interval)
    const ch = supabase.channel(`tables_rt_${user.business_id}`)
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'tables',
        filter: `business_id=eq.${user.business_id}`,
      }, () => loadLiveTables())
      .subscribe()

    return () => { clearInterval(interval); supabase.removeChannel(ch) }
  }, [loadLiveTables])

  // ⚠️ ORTAQ KÖMƆKÇİ: hər yerdə (toast, bildiriş, çek, çap) masa
  // nömrəsi göstərəndə bunu işlədirik — DAXİLİ unikal nömrə (məs. 29)
  // ƏVƆZİNƆ sahibkarın öz təyin etdiyi "görünən ad"ı (məs. 6) qaytarır.
  // Data/routing tərəfi (QR, RLS, sahiblənmə) daxili nömrəyə əsaslanmağa
  // DAVAM EDİR — YALNIZ GÖRÜNTÜ dəyişir:
  const getTableLabel = useCallback((num) => {
    if (num == null) return num
    const t = liveTables.find(t => String(t.number) === String(num))
    return t?.display_label || num
  }, [liveTables])

  // ── Menyu — birbaşa Supabase-dən (categories + products) ──────────
  useEffect(() => {
    if (!user?.business_id) return
    setLoading(true)

    let query = supabase
      .from('categories')
      .select('*, products(*)')
      .eq('business_id', user.business_id)
    query = activeBranchId ? query.eq('branch_id', activeBranchId) : query.is('branch_id', null)

    query.order('sort_order').then(({ data, error }) => {
        if (error || !data) { toast('Menyu yüklənmədi', 'error'); setLoading(false); return }

        const flat = []
        data.forEach(cat => {
          (cat.products || []).filter(p => p.is_active).forEach(p => {
            flat.push({
              id: p.id, name: p.name, price: Number(p.price) || 0,
              category: cat.name, emoji: '🍽',
              description: p.description || '', image: p.image_url || '',
            })
          })
        })
        setMenuItems(flat)
        setLoading(false)
      })
  }, [user, activeBranchId, toast])

  // ── Bugünkü sifarişləri Supabase-dən yüklə ────────────────────────
  useEffect(() => {
    if (!user?.business_id) return
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0)

    let oq = supabase
      .from('orders')
      .select('*, order_items(*), tables(number)')
      .eq('business_id', user.business_id)
      .gte('created_at', todayStart.toISOString())
    oq = activeBranchId ? oq.eq('branch_id', activeBranchId) : oq.is('branch_id', null)

    oq.order('created_at', { ascending: false }).then(({ data, error }) => {
        if (error || !data) return
        const mapped = data.map(o => ({
          id: o.id, table: o.tables?.number || '-',
          items: (o.order_items || []).map(it => ({ name: it.name || '', price: Number(it.price), qty: it.quantity, category: it.category })),
          subtotal: 0, discount: 0, tax: 0, total: Number(o.total),
          method: 'cash', cashGiven: 0, change: 0,
          cashier: '', note: '', voided: o.status === 'ləğv',
          time: new Date(o.created_at).toLocaleString('az'),
          supabaseId: o.id,
        }))
        if (mapped.length) setOrders(mapped)
      })
  }, [user, activeBranchId]) // eslint-disable-line

  // ── Cart ─────────────────────────────────────────────────────────
  const cart         = tables[activeTable] || { items: [], note: '', discount: 0 }
  const cartSubtotal = useMemo(() => cart.items.reduce((s, i) => s + i.price * i.qty, 0), [cart.items])
  const discountAmt  = cartSubtotal * (cart.discount / 100)
  const taxAmt       = (cartSubtotal - discountAmt) * (user?.tax_rate ?? TAX_RATE)
  const cartTotal    = cartSubtotal - discountAmt + taxAmt
  // Müştəri onlayn artıq nə qədər ödəyibsə, POS bunu YENİDƏN tələb
  // etməməlidir — kassirin görəcəyi/tələb edəcəyi məbləğ YALNIZ qalıqdır:
  const onlinePaidAmount = getTablePaymentInfo(activeTable).paidAmount
  const amountDueNow = Math.max(0, cartTotal - onlinePaidAmount)

  const addItem = useCallback(item => {
    if (!canEditTable(activeTable)) { denyEdit(activeTable); return }
    setTables(prev => {
      const cur = prev[activeTable] || { items: [], note: '', discount: 0 }
      const ex  = cur.items.find(i => i.id === item.id)
      const wasEmpty = cur.items.length === 0
      if (wasEmpty) markTableLive(activeTable, 'dolu')
      const nextItems = ex
        ? cur.items.map(i => i.id === item.id ? { ...i, qty: i.qty + 1 } : i)
        : [...cur.items, { ...item, qty: 1 }]
      // Son toxunan kimi CARİ istifadəçi qeyd olunur (lokal dərhal görünsün
      // deyə; Supabase-ə eyni məntiq syncActiveOrder daxilində yazılır):
      const nextTable = { ...cur, items: nextItems, staffUserId: user?.id, staffId: user?.staff_account_id, staffName: user?.name }
      syncActiveOrder(activeTable, nextTable)
      return { ...prev, [activeTable]: nextTable }
    })
  }, [activeTable, setTables, canEditTable, user, syncActiveOrder]) // eslint-disable-line

  const updateQty = useCallback((id, delta) => {
    if (!canEditTable(activeTable)) { denyEdit(activeTable); return }
    setTables(prev => {
      const cur = prev[activeTable] || { items: [], note: '', discount: 0 }
      const nextItems = cur.items.map(i => i.id === id ? { ...i, qty: i.qty + delta } : i).filter(i => i.qty > 0)
      if (cur.items.length > 0 && nextItems.length === 0) {
        markTableLive(activeTable, 'boş')
        clearActiveOrder(activeTable)
        return { ...prev, [activeTable]: { items: [], note: '', discount: 0 } }
      }
      const nextTable = { ...cur, items: nextItems, staffUserId: user?.id, staffId: user?.staff_account_id, staffName: user?.name }
      syncActiveOrder(activeTable, nextTable)
      return { ...prev, [activeTable]: nextTable }
    })
  }, [activeTable, setTables, canEditTable, user, syncActiveOrder, clearActiveOrder]) // eslint-disable-line

  // Masanın canlı (Supabase) statusunu dərhal yeniləyir — app/POS arasında real-time görünsün
  async function markTableLive(tableNumber, status) {
    if (!user?.business_id) return
    try {
      let tq = supabase.from('tables').select('id').eq('business_id', user.business_id).eq('number', String(tableNumber))
      tq = activeBranchId ? tq.eq('branch_id', activeBranchId) : tq.is('branch_id', null)
      const { data: existingRows } = await tq.limit(1)
      const existing = existingRows?.[0]

      let finalStatus = status

      if (status === 'boş') {
        // Bugün + gələcəkdə bu masa üçün hər hansı rezerv var mı?
        const todayStr = new Date().toISOString().slice(0, 10)
        const nowTime = new Date().toTimeString().slice(0, 5)

        let rq = supabase.from('reservations')
          .select('id, reserved_date, reserved_time')
          .eq('business_id', user.business_id)
          .eq('table_number', String(tableNumber))
          .gte('reserved_date', todayStr) // bugün və gələcək
        if (activeBranchId) rq = rq.eq('branch_id', activeBranchId)
        else rq = rq.is('branch_id', null)
        const { data: futureReservations } = await rq

        const hasActiveReservation = (futureReservations || []).some(r => {
          if (r.reserved_date > todayStr) return true // sabah və ya sonrası
          // bugün üçün: vaxtı hələ keçməyib
          if (!r.reserved_time) return true
          return r.reserved_time >= nowTime
        })

        if (hasActiveReservation) finalStatus = 'rezerv'
      }

      if (existing) {
        const { error } = await supabase.from('tables').update({ status: finalStatus }).eq('id', existing.id)
        if (error) { console.error('Masa statusu yenilənmədi:', error.message); toast(`Masa ${getTableLabel(tableNumber)}: ${error.message}`, 'error', 6000) }
      } else if (finalStatus === 'dolu') {
        const { error } = await supabase.from('tables').insert({ business_id: user.business_id, branch_id: activeBranchId, number: String(tableNumber), status: finalStatus })
        if (error) { console.error('Masa yaradılmadı:', error.message); toast(`Masa ${getTableLabel(tableNumber)}: ${error.message}`, 'error', 6000) }
      }
      loadLiveTables()
    } catch (e) {
      console.error('Masa statusu yenilənmədi:', e.message)
    }
  }

  // ── Rezervasiyalar (ayrıca cədvəl, tarixə bağlı, statusu bloklamır) ──
  const [reservations, setReservations] = useState([])

  const loadReservations = useCallback(async () => {
    if (!user?.business_id) return
    let q = supabase.from('reservations').select('*').eq('business_id', user.business_id)
    q = activeBranchId ? q.eq('branch_id', activeBranchId) : q.is('branch_id', null)
    const { data } = await q.gte('reserved_date', new Date().toISOString().slice(0, 10)).order('reserved_date').order('reserved_time')
    setReservations(data || [])
  }, [user, activeBranchId])

  useEffect(() => { loadReservations() }, [loadReservations])

  async function createReservation(tableNumber, reservedName, phone, reservedDate, reservedTime) {
    if (!user?.business_id) return
    const { error } = await supabase.from('reservations').insert({
      business_id: user.business_id, branch_id: activeBranchId,
      table_number: String(tableNumber), reserved_name: reservedName, phone: phone || null,
      reserved_date: reservedDate, reserved_time: reservedTime || null,
    })
    if (error) {
      console.error('Rezervasiya yazılmadı:', error.message)
      toast('Rezervasiya yazılmadı', 'error')
      return
    }
    loadReservations()
    toast(`Masa ${getTableLabel(tableNumber)} — ${reservedDate} tarixinə rezerv edildi (${reservedName})`)
  }

  async function deleteReservation(id) {
    await supabase.from('reservations').delete().eq('id', id)
    loadReservations()
  }

  // Bugünkü tarix üçün masa nömrəsinə görə rezervasiya axtarır (yalnız məlumat üçün, bloklamır)
  const todayStr = new Date().toISOString().slice(0, 10)
  const todaysReservationByTable = useMemo(() => {
    const map = {}
    reservations.filter(r => r.reserved_date === todayStr).forEach(r => { map[r.table_number] = r })
    return map
  }, [reservations, todayStr])

  const setNote = v => {
    if (!canEditTable(activeTable)) { denyEdit(activeTable); return }
    setTables(p => {
      const nextTable = { ...p[activeTable], note: v, staffUserId: user?.id, staffId: user?.staff_account_id, staffName: user?.name }
      syncActiveOrder(activeTable, nextTable)
      return { ...p, [activeTable]: nextTable }
    })
  }
  const setDiscount = v => {
    if (!canEditTable(activeTable)) { denyEdit(activeTable); return }
    setTables(p => {
      const nextTable = { ...p[activeTable], discount: Math.min(100, Math.max(0, Number(v) || 0)), staffUserId: user?.id, staffId: user?.staff_account_id, staffName: user?.name }
      syncActiveOrder(activeTable, nextTable)
      return { ...p, [activeTable]: nextTable }
    })
  }

  const sendToKitchen = async () => {
    if (!cart.items.length) return toast('Sifariş boşdur', 'error')
    if (!user?.business_id) return
    if (!canEditTable(activeTable)) { denyEdit(activeTable); return }

    // ⚠️ VACİB: mətbəxə göndərmədən ƏVVƆL səbəti DƆRHAL (gecikmə
    // olmadan) Supabase-ə yazırıq. Əks halda: işçi göndərib DƏRHAL
    // sonra hesabdan çıxsa, adi 500ms-lik debounce hələ işə düşməmiş
    // qalır və `active_orders` HEÇ VAXT yazılmır — müştəri "Sifarişlərim"
    // bölməsində heç nə görmür (yalnız mətbəx ticket-i mövcud olur):
    await flushActiveOrderSync(activeTable, cart)

    const { error } = await supabase.from('kitchen_tickets').insert({
      business_id: user.business_id,
      branch_id: activeBranchId,
      table_number: String(activeTable),
      items: cart.items.map(i => ({ ...i, done: false })),
      note: cart.note,
      status: 'new',
      // "ofisiant/menecer öz hesabında sifariş aldısa, ticket üzərində
      // onun adı yazılsın" — mətbəx kimin göndərdiyini görsün:
      staff_id: user.staff_account_id || null,
      staff_name: user.name || null,
    })

    if (error) {
      toast('Mətbəxə göndərilmədi: ' + error.message, 'error')
      return
    }
    toast(`Masa ${getTableLabel(activeTable)} mətbəxə göndərildi 🍳`)
    setMobileCartOpen(false)
    // QEYD: local `tickets` state-ə əl ilə əlavə etmirik — Supabase
    // Realtime abunəliyi bunu bir neçə millisaniyə içində bütün
    // cihazlara (bu daxil) avtomatik çatdıracaq.
  }

  // Mətbəxdə məhsul üzərinə "hazırdır" işarəsi qoyulanda (KitchenCard):
  const updateTicketItems = async (id, updatedTicket) => {
    const { error } = await supabase.from('kitchen_tickets')
      .update({ items: updatedTicket.items, status: updatedTicket.status })
      .eq('id', id)
    if (error) toast('Yenilənmədi: ' + error.message, 'error')
  }

  // Bütün ticket "Hazır" işarələnəndə (mətbəx düyməsi) — bütün
  // cihazlara (ofisiantın telefonuna daxil) dərhal bildiriş gedir:
  const markTicketReady = async (id) => {
    const ticket = tickets.find(t => t.id === id)
    const { error } = await supabase.from('kitchen_tickets')
      .update({ status: 'ready', ready_at: new Date().toISOString() })
      .eq('id', id)
    if (error) { toast('Yenilənmədi: ' + error.message, 'error'); return }
    if (ticket) toast(`Masa ${getTableLabel(ticket.table)} hazır işarələndi ✓`, 'success')
  }

  // "Hazırları təmizlə" — ofisiant müştəriyə təhvil verdikdən sonra
  // ticket-i sistemdən silir (bütün cihazlarda yox olur):
  const clearReadyTickets = async () => {
    if (!user?.business_id) return
    const readyIds = tickets.filter(t => t.status === 'ready').map(t => t.id)
    if (!readyIds.length) return
    await supabase.from('kitchen_tickets').update({ status: 'served', served_at: new Date().toISOString() }).in('id', readyIds)
  }

  // ── Tables (Supabase) köməkçisi: masa nömrəsinə görə tapır/yaradır
  async function getOrCreateSupabaseTable(tableNumber) {
    let tq = supabase.from('tables').select('id').eq('business_id', user.business_id).eq('number', String(tableNumber))
    tq = activeBranchId ? tq.eq('branch_id', activeBranchId) : tq.is('branch_id', null)
    const { data: existingRows } = await tq.limit(1)
    if (existingRows?.[0]) return existingRows[0].id

    const { data: created } = await supabase
      .from('tables').insert({ business_id: user.business_id, branch_id: activeBranchId, number: String(tableNumber), status: 'boş' })
      .select('id').single()
    return created?.id
  }

  // ── Payment — birbaşa Supabase-ə yazır ────────────────────────────
  const confirmPayment = async (method, cashGiven, orderId) => {
    if (!canEditTable(activeTable)) { denyEdit(activeTable); return }
    const ch = method === 'cash' ? Math.max(0, cashGiven - amountDueNow) : 0
    const receipt = {
      id: orderId, table: getTableLabel(activeTable), items: cart.items,
      subtotal: cartSubtotal, discount: cart.discount,
      tax: taxAmt, total: cartTotal, method, cashGiven, change: ch,
      time: nowFull(), cashier: user?.name || '', voided: false,
    }
    setOrders(p => [receipt, ...p])
    setTables(p => ({ ...p, [activeTable]: { items: [], note: '', discount: 0 } }))
    clearActiveOrder(activeTable)
    // Bu masanın ticket-lərini "served" et — Realtime ilə bütün
    // cihazlardan (mətbəx, digər ofisiantlar) dərhal yox olur:
    const tableTicketIds = tickets.filter(t => t.table === String(activeTable) || t.table === activeTable).map(t => t.id)
    if (tableTicketIds.length) {
      supabase.from('kitchen_tickets').update({ status: 'served', served_at: new Date().toISOString() }).in('id', tableTicketIds)
    }
    setShowPayment(false)
    setShowReceipt(receipt)
    toast(`Masa ${getTableLabel(activeTable)} ödənildi ✓`)
    setMobileCartOpen(false)

    // ── Loyallıq — bu masaya üzv bağlanıbsa, ziyarəti qeyd et və
    // aktiv proqramları yoxla, yeni qazanılan mükafatları göstər:
    const loyaltyMember = loyaltySelections[activeTable]
    if (loyaltyMember) {
      const paidTable = activeTable
      Promise.all([
        recordVisitAndCheckRewards(loyaltyMember, cartTotal),
        checkOrderAmountRewards(loyaltyMember, cartTotal),
      ]).then(([earned1, earned2]) => {
        const allEarned = [...earned1, ...earned2]
        allEarned.forEach(({ program }) => {
          // ⚠️ Sadəcə keçib-gedən toast YOX — davamlı, səs+titrəyişli
          // bildiriş (istifadəçi özü bağlayana kimi qalır):
          addNotification(`🎁 ${loyaltyMember.full_name} tapşırığı tamamladı: ${buildRewardText(program)}`, {
            type: 'loyalty',
          })
        })
      }).catch(e => console.error('Loyallıq yoxlanışı uğursuz oldu:', e.message))
      setLoyaltySelections(prev => { const next = { ...prev }; delete next[paidTable]; return next })
    }

    try {
      const tableId = await getOrCreateSupabaseTable(activeTable)

      // ⚠️ VACİB: Kassir (ofisiant/menecer/sahibkar) POS-dan ödənişi
      // ALANDA, bu masaya aid BÜTÜN müştəri sifarişləri (pending_orders)
      // "ödənilib" kimi qeyd olunur — ofisiant "hazırlanır"/"çatdırıldı"
      // düymələrini basmağı unutsa BELƏ. Əks halda müştərinin
      // "Sifarişlərim" bölməsi ödəniş artıq alınsa belə əbədi
      // "gözləyir/hazırlanır" göstərməyə davam edərdi.
      if (tableId) {
        await supabase.from('pending_orders')
          .update({ payment_status: 'paid', order_status: 'delivered', processed_at: new Date().toISOString() })
          .eq('table_id', tableId)
          .neq('order_status', 'rejected')
          .neq('payment_status', 'paid') // artıq ödənilmişlərə təkrar toxunma
      }

      const { data: orderRow, error: orderErr } = await supabase
        .from('orders')
        .insert({
          business_id: user.business_id, branch_id: activeBranchId, table_id: tableId,
          total: cartTotal, status: 'tamamlandı',
          // "ofisiant/menecer öz hesabında sifariş aldısa, sifariş üzrə
          // onun adı yazılsın":
          staff_id: user.staff_account_id || null,
          staff_name: user.name || null,
        })
        .select('id').single()

      if (orderErr) {
        console.error('Sifariş yadda saxlanmadı:', orderErr.message)
        toast('Diqqət: sifariş serverə yazılmadı — ' + orderErr.message, 'error', 8000)
      }

      if (orderRow) {
        const todayStr = new Date().toISOString().slice(0, 10)
        const nowTime = new Date().toTimeString().slice(0, 5)
        let rq = supabase.from('reservations')
          .select('id, reserved_date, reserved_time')
          .eq('business_id', user.business_id)
          .eq('table_number', String(activeTable))
          .gte('reserved_date', todayStr)
        if (activeBranchId) rq = rq.eq('branch_id', activeBranchId)
        else rq = rq.is('branch_id', null)
        const { data: futureRes } = await rq
        const hasRes = (futureRes || []).some(r => {
          if (r.reserved_date > todayStr) return true
          if (!r.reserved_time) return true
          return r.reserved_time >= nowTime
        })
        const nextStatus = hasRes ? 'rezerv' : 'boş'
        const { error: tableErr } = await supabase.from('tables').update({ status: nextStatus }).eq('id', tableId)
        if (tableErr) {
          console.error('Masa statusu yenilənmədi:', tableErr.message)
          toast(`Diqqət: Masa ${getTableLabel(activeTable)} statusu yenilənmədi — ${tableErr.message}`, 'error', 8000)
        }
        loadLiveTables()
        const itemRows = receipt.items.map(it => ({
          order_id: orderRow.id, quantity: it.qty, price: it.price,
          name: it.name, category: it.category,
        }))
        if (itemRows.length) await supabase.from('order_items').insert(itemRows)
      }
      loadLiveTables()
    } catch (e) {
      console.error('Sifariş Supabase-ə yazılmadı:', e.message)
      toast('Diqqət: sifariş serverə yazılmadı — ' + e.message, 'error', 8000)
    }
  }

  // Müştəri ONLİNE tam ödədikdə, bu məbləğ POS-un öz "orders"
  // tarixçəsinə (Statistika/Hesabat üçün) də əlavə olunur — əks halda
  // onlayn ödənilən gəlir "bugünkü satış"a HEÇ VAXT daxil olmurdu:
  // ⚠️ KRİTİK DÜZƏLİŞ: əvvəllər bu funksiya YALNIZ POS-un yerli (RAM)
  // yaddaşına yazırdı — Supabase-dəki HƏQİQİ `orders` cədvəlinə HEÇ
  // VAXT yazılmırdı. App-ın Ana Səhifə/Analitika ekranları isə birbaşa
  // bu cədvələ baxır — ona görə onlayn ödənilmiş gəlir App-da HEÇ VAXT
  // görünmürdü. İndi `confirmPayment`-in etdiyi kimi, Supabase-ə də
  // düzgün sətir yazılır:
  const recordOnlineRevenue = async (tableNumber, items, total, tableId) => {
    const receipt = {
      id: genId(), table: getTableLabel(tableNumber), items,
      subtotal: total, discount: 0, tax: 0, total,
      method: 'online', cashGiven: 0, change: 0,
      time: nowFull(), cashier: 'Onlayn (müştəri)', voided: false,
    }
    setOrders(p => [receipt, ...p])

    if (user?.business_id) {
      const { error } = await supabase.from('orders').insert({
        business_id: user.business_id, branch_id: activeBranchId, table_id: tableId || null,
        total, status: 'tamamlandı',
        staff_id: null, staff_name: 'Onlayn (müştəri)',
      })
      if (error) console.error('Onlayn gəlir Supabase-ə yazılmadı:', error.message)
    }
  }

  const voidTable = () => {
    if (!cart.items.length) return
    if (!can(user, 'void')) return toast('Bu əməliyyat üçün icazəniz yoxdur', 'error')
    if (!canEditTable(activeTable)) return denyEdit(activeTable)
    const receipt = {
      id: genId(), table: getTableLabel(activeTable), items: cart.items,
      subtotal: cartSubtotal, discount: cart.discount,
      tax: taxAmt, total: cartTotal, method: 'void',
      cashGiven: 0, change: 0, time: nowFull(), cashier: user?.name || '', voided: true,
    }
    setOrders(p => [receipt, ...p])
    setTables(p => ({ ...p, [activeTable]: { items: [], note: '', discount: 0 } }))
    markTableLive(activeTable, 'boş')
    clearActiveOrder(activeTable)
    toast(`Masa ${getTableLabel(activeTable)} ləğv edildi`, 'info')
  }

  const deleteOrder = (id) => {
    if (!can(user, 'delete')) return toast('Yalnız admin silə bilər', 'error')
    setConfirmDel(id)
  }

  const doDelete = async () => {
    const target = orders.find(o => o.id === confirmDel)
    setOrders(p => p.filter(o => o.id !== confirmDel))
    try {
      if (target?.supabaseId) await supabase.from('orders').delete().eq('id', target.supabaseId)
    } catch {}
    setConfirmDel(null)
    toast('Çek silindi', 'info')
  }

  const dismissReadyNotif = (id) => setReadyNotifs(rn => rn.filter(n => n.id !== id))
  const clearReadyNotifs  = () => setReadyNotifs([])

  // Sadə, xoş "cha-ching" səsi — xarici fayl lazım deyil, Web Audio
  // API ilə proqramatik yaradılır. Kassirin diqqətini cəlb etmək üçün
  // ödəniş bildirişlərində istifadə olunur:
  const playNotifSound = () => {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)()
      const playTone = (freq, start, duration) => {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.connect(gain); gain.connect(ctx.destination)
        osc.frequency.value = freq
        osc.type = 'sine'
        gain.gain.setValueAtTime(0.35, ctx.currentTime + start)
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + duration)
        osc.start(ctx.currentTime + start)
        osc.stop(ctx.currentTime + start + duration)
      }
      playTone(880, 0, 0.15)
      playTone(1175, 0.16, 0.22)
    } catch (e) { /* audio icazəsi yoxdursa sakitcə keç */ }
  }

  // Ümumi (istənilən mətnli) bildiriş — zəng (🔔) panelinə əlavə olunur,
  // toast-dan fərqli olaraq İSTİFADƏÇİ ÖZÜ bağlayana kimi qalır. Məs.
  // "Masa X onlayn ödənildi" bildirişi bunu istifadə edir. Səs + güclü
  // titrəyişlə müşayiət olunur ki, kassir mütləq diqqət etsin:
  const addNotification = useCallback((message, opts = {}) => {
    // ⚠️ `createdAtMs` — bu, pop-up-un "12 saniyə sonra öz-özünə
    // gizlənməsi" hesablamasının ETİBARLI mənbəyidir. Əvvəlki
    // per-bildiriş `setTimeout` üsulu komponentin YENİDƆN
    // render/mount olması ilə itə bilirdi (ofisiant/menecer
    // hesablarında müşahidə olunan "pop-up donub qalır" bugu buradan
    // idi). İndi ToastContainer bunu SADƆCƆ hazırkı vaxtla müqayisə
    // edərək hesablayır — remount olsa belə DATA-nın özündən dəqiq
    // nəticə çıxarılır:
    const notif = { id: Date.now() + Math.random(), message, time: nowTime(), createdAtMs: Date.now(), type: opts.type || 'info', tableNum: opts.tableNum }
    setReadyNotifs(rn => [notif, ...rn].slice(0, 20))
    playNotifSound()
    if (navigator.vibrate) navigator.vibrate([400, 120, 400, 120, 400]) // güclü, təkrarlanan titrəyiş
  }, []) // eslint-disable-line

  const paidOrders  = orders.filter(o => !o.voided)
  const todaySales  = paidOrders.reduce((s, o) => s + o.total, 0)
  const openTables  = Object.values(tables).filter(t => t.items.length > 0).length
  const ticketCount = tickets.filter(t => t.status !== 'ready').length

  const filteredMenu = useMemo(() => menuItems.filter(item => {
    const mc = activeCat === 'Hamısı' || item.category === activeCat
    const q  = search.toLowerCase()
    return mc && (!q || item.name.toLowerCase().includes(q))
  }), [menuItems, activeCat, search])

  const catCounts = useMemo(() => {
    const c = {}; menuItems.forEach(i => { c[i.category] = (c[i.category] || 0) + 1 }); return c
  }, [menuItems])

  // Sidebar üçün real kateqoriya siyahısı (statik Sheet-əsaslı siyahı əvəzinə)
  const CAT_ICONS = {
    'Pizzalar': '🍕', 'Burgerlər': '🍔', 'İsti yeməklər': '🍢', 'Şorbalar': '🍲',
    'Salatlar': '🥗', 'Qəlyanaltılar': '🧆', 'Qəlyan': '💨', 'İçkilər': '🫖',
    'Dessertlər': '🍯', 'Plovlar': '🍚',
  }
  const dynamicCategories = useMemo(() => {
    const names = Object.keys(catCounts).sort()
    return [{ name: 'Hamısı', icon: '◈' }, ...names.map(n => ({ name: n, icon: CAT_ICONS[n] || '🍽' }))]
  }, [catCounts])

  const topItems = useMemo(() => {
    const c = {}
    paidOrders.forEach(o => (o.items || []).forEach(it => { c[it.name] = (c[it.name] || 0) + it.qty }))
    return Object.entries(c).sort((a, b) => b[1] - a[1]).slice(0, 8)
  }, [paidOrders])

  // QR sifarişini masanın cart-ına əlavə et. Eyni sahiblənmə qaydası
  // tətbiq olunur (RLS-in özü belədir) — başqasının masasına QR
  // sifarişi də "sızdırıla" bilməz, əks halda Supabase-ə yazı sakitcə
  // rədd olunardı və iki tərəf fərqli mənzərə görərdi.
  const mergeQROrderToTable = useCallback((tableNumber, items) => {
    const tNum = Number(tableNumber)
    if (!canEditTable(tNum)) {
      denyEdit(tNum)
      return
    }
    setTables(prev => {
      const cur = prev[tNum] || { items: [], note: '', discount: 0 }
      let updated = [...cur.items]
      for (const item of items) {
        const ex = updated.find(i => i.name === item.name && i.price === item.price)
        if (ex) {
          updated = updated.map(i => i.name === item.name && i.price === item.price
            ? { ...i, qty: i.qty + item.qty } : i)
        } else {
          updated.push({ name: item.name, price: Number(item.price), qty: item.qty, category: item.category || '' })
        }
      }
      const nextTable = { ...cur, items: updated, staffUserId: user?.id, staffId: user?.staff_account_id, staffName: user?.name }
      syncActiveOrder(tNum, nextTable)
      return { ...prev, [tNum]: nextTable }
    })
    markTableLive(tableNumber, 'dolu')
  }, [setTables, user, syncActiveOrder, canEditTable]) // eslint-disable-line

  const value = {
    user, handleLogin, handleLogout, business: user?.business_name ? { slug: user?.business_slug, name: user?.business_name } : null,
    branches, activeBranchId, setActiveBranchId, liveTables, loadLiveTables, getTableLabel,
    reservations, todaysReservationByTable, createReservation, deleteReservation,
    view, setView, activeCat, setActiveCat, search, setSearch,
    activeTable, setActiveTable,
    menuItems, filteredMenu, catCounts, dynamicCategories, loading,
    tables, cart, cartSubtotal, discountAmt, taxAmt, cartTotal, onlinePaidAmount, amountDueNow,
    addItem, updateQty, setNote, setDiscount,
    tickets, sendToKitchen, updateTicketItems, markTicketReady, clearReadyTickets, ticketCount,
    mobileSidebarOpen, setMobileSidebarOpen, mobileCartOpen, setMobileCartOpen,
    canEditTable, getTableOwnerName,
    photoRequired, activeLoyaltyMember: loyaltySelections[activeTable] || null, setActiveLoyaltyMember,
    getTablePaymentInfo,
    orders, setOrders, paidOrders, todaySales, openTables, topItems,
    confirmPayment, voidTable, deleteOrder, doDelete,
    mergeQROrderToTable,
    showPayment, setShowPayment, showReceipt, setShowReceipt,
    confirmDel, setConfirmDel,
    toasts, toast,
    readyNotifs, dismissReadyNotif, clearReadyNotifs, addNotification, recordOnlineRevenue,
  }

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}