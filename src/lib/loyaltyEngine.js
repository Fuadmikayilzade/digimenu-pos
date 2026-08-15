// ============================================================
// LOYALLIQ MÜKAFAT MOTORU
//
// Bu fayl həm DigiMenu App-da (idarəetmə), həm də POS-da (canlı
// tətbiq) İSTİFADƏ OLUNUR — hər iki layihədə eyni məntiqin təkrar
// yazılması səhvlərin qarşısını alır. (Qeyd: iki ayrı repo olduğu
// üçün fayl hər ikisinə fiziki köçürülüb saxlanılır, amma məzmun
// eynidir.)
//
// DİZAYN: Bir "ziyarət" (loyalty_visits sətri) müəyyən bir proqrama
// bağlı DEYİL — bütün AKTİV proqramlar öz tarix aralığına (valid_from/
// valid_until) uyğun olaraq bu ziyarətlərdən istifadə edərək müstəqil
// qiymətləndirilir. Bu, "5 gün ardıcıl" ilə "ayda 5 dəfə" kampaniyasının
// eyni ziyarət tarixçəsindən paralel işləməsini təmin edir.
//
// ⚠️ VİZİT FORMATI: `visits` parametri artıq sadə tarix sətirləri YOX,
// `{ visit_date, order_total }` obyektləri massividir. Bu, "hər
// ziyarətdə minimum sifariş məbləği" (rules.min_order_per_visit) kimi
// kombinə olunan qaydaları dəstəkləmək üçündür — məs. "5 dəfə gəlsin,
// AMMA hər dəfə minimum ₼30 sifariş etsin".
// ============================================================

/**
 * Verilmiş proqramın hazırkı tarixdə aktiv olub-olmadığını yoxlayır
 * (valid_from/valid_until aralığı).
 */
export function isProgramActiveNow(program, now = new Date()) {
  if (!program.is_active) return false;
  const todayStr = now.toISOString().slice(0, 10);
  if (program.valid_from && todayStr < program.valid_from) return false;
  if (program.valid_until && todayStr > program.valid_until) return false;
  return true;
}

/**
 * `min_order_per_visit` qaydası varsa, yalnız bu həddi keçən
 * ziyarətləri "keçərli" sayır. Sifariş məbləği qeyd olunmayan
 * (order_total=null) köhnə ziyarətlər — məhdudiyyət yoxdursa keçərli
 * sayılır, VARSA isə qeyri-müəyyənlik üzündən keçərli SAYILMIR (təhlükəsiz tərəf).
 */
function filterQualifyingVisits(visits, rules) {
  const minPerVisit = rules?.min_order_per_visit;
  if (!minPerVisit) return visits.map(v => v.visit_date);
  return visits
    .filter(v => typeof v.order_total === 'number' && v.order_total >= minPerVisit)
    .map(v => v.visit_date);
}

/**
 * Ziyarət tarixləri massivindən (YYYY-AA-GG sətirləri) hazırkı
 * ARDICIL ziyarət silsiləsini hesablayır. Bu gün hələ gəlməyibsə,
 * dünəndən geriyə sayır (silsilə "bu gün gəlməyib" deyə sıfırlanmır,
 * yalnız TAM bir gün buraxılanda sıfırlanır).
 */
export function computeCurrentStreak(visitDateStrings, now = new Date()) {
  const daySet = new Set(visitDateStrings);
  const cursor = new Date(now);
  cursor.setHours(0, 0, 0, 0);

  const todayStr = cursor.toISOString().slice(0, 10);
  if (!daySet.has(todayStr)) {
    cursor.setDate(cursor.getDate() - 1); // bu gün yoxdursa, dünəndən başla
  }

  let streak = 0;
  // sonsuz dövrənin qarşısını almaq üçün 3 il (1095 gün) həddi:
  for (let i = 0; i < 1095; i++) {
    const dStr = cursor.toISOString().slice(0, 10);
    if (daySet.has(dStr)) {
      streak++;
      cursor.setDate(cursor.getDate() - 1);
    } else {
      break;
    }
  }
  return streak;
}

/**
 * Mükafatın mətn təsvirini qurur (ekranlarda göstərmək üçün).
 */
export function buildRewardText(program) {
  const r = program.rules || {};
  const rewardPart =
    r.reward_type === 'discount' ? `${r.reward_value}% endirim`
    : r.reward_type === 'fixed_amount' ? `₼${r.reward_value} endirim`
    : r.reward_type === 'free_item' ? (r.free_item_name || 'pulsuz məhsul')
    : 'mükafat';

  const perVisitSuffix = r.min_order_per_visit ? ` (hər dəfə min. ₼${r.min_order_per_visit} sifariş)` : '';

  if (program.type === 'visit_days') {
    return `${r.visit_days || 5} gün ardıcıl gəl${perVisitSuffix} → ${rewardPart} qazan`;
  }
  if (program.type === 'visit_count') {
    const period = r.period_days ? ` (son ${r.period_days} gündə)` : ' (kampaniya müddəti ərzində)';
    return `Eyni müştəri ${r.visit_count || 5} dəfə gəlsin${period}${perVisitSuffix} → ${rewardPart} qazan`;
  }
  if (program.type === 'order_amount') {
    return `Sifariş ₼${r.min_order_amount || 0}-dan çox olsun → ${rewardPart} qazan`;
  }
  return rewardPart;
}

/**
 * Bir üzv üçün, bir proqram üzrə, hazırkı vəziyyəti (neçə ziyarət/gün
 * qalıb, mükafat qazanılıb-qazanılmayıb) hesablayır.
 *
 * @param program - loyalty_programs sətri
 * @param visits - üzvün BÜTÜN ziyarətləri: [{ visit_date, order_total }], artan sırada
 * @param alreadyGrantedPeriodKeys - Set<string> — bu proqram üzrə artıq
 *   mükafat verilmiş dövrlərin açarları (təkrar mükafatın qarşısını almaq üçün)
 */
export function evaluateProgram(program, visits, alreadyGrantedPeriodKeys = new Set(), now = new Date()) {
  if (!isProgramActiveNow(program, now)) {
    return { eligible: false, alreadyGranted: false, progress: 0, needed: 0, periodKey: null };
  }

  const r = program.rules || {};

  // Proqramın öz tarix aralığına (kampaniya) uyğun ziyarətləri, SONRA
  // "hər ziyarətdə minimum sifariş" şərtinə uyğun olanları süzürük:
  const inRange = visits.filter(v => {
    if (program.valid_from && v.visit_date < program.valid_from) return false;
    if (program.valid_until && v.visit_date > program.valid_until) return false;
    return true;
  });
  const qualifyingDates = filterQualifyingVisits(inRange, r);

  if (program.type === 'visit_days') {
    const needed = r.visit_days || 5;
    const streak = computeCurrentStreak(qualifyingDates, now);
    const periodKey = `streak:${Math.floor(streak / needed)}`; // hər tam dövr üçün bir dəfə
    const eligible = streak >= needed;
    return { eligible, alreadyGranted: eligible && alreadyGrantedPeriodKeys.has(periodKey), progress: streak, needed, periodKey };
  }

  if (program.type === 'visit_count') {
    const needed = r.visit_count || 5;
    const periodDays = r.period_days || null;
    let relevant = qualifyingDates;
    if (periodDays) {
      const cutoff = new Date(now);
      cutoff.setDate(cutoff.getDate() - periodDays);
      const cutoffStr = cutoff.toISOString().slice(0, 10);
      relevant = qualifyingDates.filter(d => d >= cutoffStr);
    }
    const count = relevant.length;
    const periodKey = periodDays
      ? `count-window:${relevant[0] || 'none'}-${relevant.length}`
      : `count-alltime:${Math.floor(count / needed)}`;
    const eligible = count >= needed;
    return { eligible, alreadyGranted: eligible && alreadyGrantedPeriodKeys.has(periodKey), progress: count, needed, periodKey };
  }

  // 'order_amount' — bu, ziyarət tarixçəsi ilə DEYİL, cari sifarişin
  // məbləği ilə qiymətləndirilir; çağıran tərəf (POS) bunu ayrıca
  // yoxlamalıdır (bax: evaluateOrderAmountProgram aşağıda).
  return { eligible: false, alreadyGranted: false, progress: 0, needed: r.min_order_amount || 0, periodKey: null };
}

/**
 * 'order_amount' tipli proqram üçün — cari sifarişin məbləğinə görə
 * dərhal qiymətləndirmə (ziyarət tarixçəsi lazım deyil).
 */
export function evaluateOrderAmountProgram(program, currentOrderTotal, now = new Date()) {
  if (!isProgramActiveNow(program, now)) return { eligible: false };
  if (program.type !== 'order_amount') return { eligible: false };
  const needed = program.rules?.min_order_amount || 0;
  return { eligible: currentOrderTotal >= needed, needed };
}