export const SHEETS_URL = 'https://opensheet.elk.sh/1-reT1K4Bbv771_JIoz12wRqhNxYOlaJXpLy7VRtH7Cs/menu1'
export const TAX_RATE   = 0 // ƏDV ləğv edilib
export const TABLE_COUNT = 16

export const USERS = [
  { username: 'admin',   password: 'admin123',   role: 'admin',   name: 'Admin',         avatar: '👑' },
  { username: 'kasiyer', password: 'kasiyer123', role: 'cashier', name: 'Kasiyer',        avatar: '💁' },
  { username: 'metbex',  password: 'metbex123',  role: 'kitchen', name: 'Mətbəx Ustası',  avatar: '👨‍🍳' },
]

// QEYD: CAN xəritəsi real Supabase staff_accounts.role dəyərləri ilə
// uyğunlaşdırılıb: 'waiter' | 'manager' | 'kitchen' (+ 'owner' | 'admin').
// Əvvəllər burada yalnız test üçün olan 'cashier'/'admin' kimi mock
// rollar var idi — real ofisiant/menecer hesabları heç bir icazəyə
// uyğun gəlmirdi.
export const CAN = {
  void:    ['owner', 'admin', 'manager'],
  delete:  ['owner', 'admin'],
  // Statistika/Hesabat YALNIZ sahibkar və admin üçündür — heç bir işçi
  // (ofisiant, menecer, mətbəx) bu bölmələri görməməlidir:
  reports: ['owner', 'admin'],
  discount:['owner', 'admin', 'manager'],
  kitchen: ['owner', 'admin', 'manager', 'waiter', 'kitchen'],
  pos:     ['owner', 'admin', 'manager', 'waiter'],
  // Bildiriş panelindəki mesajları silmək YALNIZ sahibkar/admin/menecer
  // üçündür — ofisiant/mətbəx işçisi görə bilər, silə bilməz:
  notifications: ['owner', 'admin', 'manager'],
}

export const CATS = [
  { name: 'Hamısı', icon: '◈' },
  { name: 'pizza', icon: '🍕', label: 'Pizzalar' },
  { name: 'burger', icon: '🍔', label: 'Burgerlər' },
  { name: 'hot', icon: '🍢', label: 'İsti yeməklər' },
  { name: 'hookah', icon: '💨', label: 'Qəlyan' },
  { name: 'drink', icon: '🫖', label: 'İçkilər' },
]

export const can = (user, action) => {
  if (!user) return false
  if (user.role === 'owner' || user.role === 'admin') return true
  return CAN[action]?.includes(user.role)
}