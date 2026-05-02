export const SHEETS_URL = 'https://opensheet.elk.sh/1-reT1K4Bbv771_JIoz12wRqhNxYOlaJXpLy7VRtH7Cs/menu1'
export const TAX_RATE   = 0.18
export const TABLE_COUNT = 16

export const USERS = [
  { username: 'admin',   password: 'admin123',   role: 'admin',   name: 'Admin',         avatar: '👑' },
  { username: 'kasiyer', password: 'kasiyer123', role: 'cashier', name: 'Kasiyer',        avatar: '💁' },
  { username: 'metbex',  password: 'metbex123',  role: 'kitchen', name: 'Mətbəx Ustası',  avatar: '👨‍🍳' },
]

export const CAN = {
  void:    ['admin'],
  delete:  ['admin'],
  reports: ['admin'],
  discount:['admin', 'cashier'],
  kitchen: ['admin', 'kitchen', 'cashier'],
  pos:     ['admin', 'cashier'],
}

export const CATS = [
  { name: 'Hamısı',        icon: '◈' },
  { name: 'Əsas Yeməklər', icon: '🍢' },
  { name: 'Şorbalar',      icon: '🍲' },
  { name: 'Salatlar',      icon: '🥗' },
  { name: 'Qəlyanaltılar', icon: '🧆' },
  { name: 'Plovlar',       icon: '🍚' },
  { name: 'İçkilər',       icon: '🫖' },
  { name: 'Dessertlər',    icon: '🍯' },
]

export const can = (user, action) => user && CAN[action]?.includes(user.role)
