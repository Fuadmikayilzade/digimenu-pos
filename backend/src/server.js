import express from 'express'
import cors from 'cors'
import ordersRouter from './routes/orders.js'
import reportsRouter from './routes/reports.js'

const app = express()
const PORT = process.env.PORT || 3001

// CORS — bütün originlərə icazə (Vercel URL məlum olmadığı üçün)
app.use(cors())
app.use(express.json({ limit: '1mb' }))

app.use('/api/orders', ordersRouter)
app.use('/api/reports', reportsRouter)
app.get('/api/health', (_, res) => res.json({ ok: true, ts: new Date().toISOString() }))

app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅  DigiMenu POS Backend  →  port ${PORT}`)
})
