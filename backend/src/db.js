import { LowSync } from 'lowdb'
import { JSONFileSync } from 'lowdb/node'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { mkdirSync } from 'fs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DATA_DIR  = join(__dirname, '..', 'data')
const DB_PATH   = join(DATA_DIR, 'pos.json')

mkdirSync(DATA_DIR, { recursive: true })

const adapter  = new JSONFileSync(DB_PATH)
const db       = new LowSync(adapter, { orders: [], orderItems: [] })

db.read()
if (!db.data.orders)     db.data.orders     = []
if (!db.data.orderItems) db.data.orderItems = []
db.write()

export default db
