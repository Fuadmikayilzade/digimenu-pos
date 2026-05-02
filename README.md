# DigiMenu POS — Tam Refactor

## Layihə Strukturu

```
digimenu-pos/
├── frontend/                  ← React (Vite)
│   ├── src/
│   │   ├── App.jsx            ← Əsas giriş nöqtəsi (təmiz, yalnız routing)
│   │   ├── context/
│   │   │   └── AppContext.jsx ← Qlobal state (auth, cart, orders, kitchen)
│   │   ├── components/
│   │   │   ├── LoginScreen.jsx
│   │   │   ├── Topbar.jsx
│   │   │   ├── Clock.jsx
│   │   │   ├── MenuItemCard.jsx
│   │   │   ├── KitchenCard.jsx
│   │   │   ├── PaymentModal.jsx
│   │   │   ├── ReceiptModal.jsx
│   │   │   ├── ConfirmDialog.jsx
│   │   │   └── ToastContainer.jsx
│   │   ├── pages/
│   │   │   ├── POSPage.jsx       ← Sidebar + Menyu + Səbət
│   │   │   ├── KitchenPage.jsx   ← Mətbəx paneli
│   │   │   ├── OrdersPage.jsx    ← Çeklər (tarix seçimi ilə)
│   │   │   ├── DashboardPage.jsx ← Dashboard (tarix seçimi ilə)
│   │   │   └── ReportsPage.jsx   ← Hesabatlar (tarix seçimi ilə)
│   │   ├── utils/
│   │   │   ├── constants.js   ← USERS, CATS, CAN, can()
│   │   │   ├── helpers.js     ← fmt, genId, nowTime, ...
│   │   │   └── api.js         ← Backend API çağırışları
│   │   └── styles/
│   │       └── global.css     ← Bütün CSS (dəyişdirilməmiş dizayn)
│   ├── index.html
│   ├── package.json
│   └── vite.config.js         ← /api → localhost:3001 proxy
│
└── backend/                   ← Express + SQLite
    ├── src/
    │   ├── server.js          ← Express app
    │   ├── db.js              ← SQLite schema və connection
    │   └── routes/
    │       ├── orders.js      ← GET/POST/DELETE /api/orders
    │       └── reports.js     ← GET /api/reports/daily|dates|range
    ├── data/
    │   └── pos.db             ← SQLite database (auto-yaranır)
    └── package.json
```

## Başlatma

### Backend
```bash
cd backend
npm install
npm run dev
# → http://localhost:3001
```

### Frontend
```bash
cd frontend
npm install
npm run dev
# → http://localhost:5173
```

## Backend API Endpoints

| Method | Path                        | Açıqlama                                |
|--------|-----------------------------|-----------------------------------------|
| GET    | /api/orders?date=YYYY-MM-DD | Həmin günün sifarişləri                 |
| POST   | /api/orders                 | Yeni sifariş saxla                      |
| DELETE | /api/orders/:id             | Sifarişi sil                            |
| GET    | /api/reports/daily?date=... | Admin dashboard üçün tam analitika     |
| GET    | /api/reports/dates          | Sifarişi olan günlər (son 90 gün)      |
| GET    | /api/reports/range?from&to  | Müddətli satış trendi                   |
| GET    | /api/health                 | Server sağlamlığı                       |

## Xüsusiyyətlər

- **Offline-first**: Backend olmadan da işləyir (React state-də saxlanır)
- **Backend aktivdirsə**: Sifarişlər SQLite-a yazılır, admin istənilən günü görür
- **Tarix seçimi**: Çeklər, Dashboard, Hesabat — hamısında tarix filter var
- **Çap**: Çek çap funksiyası işləyir
- **Rol əsaslı**: admin/cashier/kitchen rolları qorunur

## Demo Hesablar
| İstifadəçi | Şifrə      | Rol     |
|------------|------------|---------|
| admin      | admin123   | Admin   |
| kasiyer    | kasiyer123 | Cashier |
| metbex     | metbex123  | Kitchen |
