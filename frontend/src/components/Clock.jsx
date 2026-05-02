import { useState, useEffect } from 'react'
import { nowTime, nowDate } from '../utils/helpers'

export default function Clock() {
  const [t, setT] = useState(nowTime())
  useEffect(() => {
    const id = setInterval(() => setT(nowTime()), 1000)
    return () => clearInterval(id)
  }, [])
  return <span className="topbar-time">{nowDate()} · {t}</span>
}
