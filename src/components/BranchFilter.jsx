import { useEffect, useState } from 'react'
import { api } from '../utils/api'

// Hesabat səhifələri üçün: "Bütün filiallar" / "Əsas filial" / konkret filial seçimi.
// value: 'all' | null (əsas) | branchId
export default function BranchFilter({ value, onChange }) {
  const [branches, setBranches] = useState([])

  useEffect(() => {
    api.branches.list().then(setBranches)
  }, [])

  if (branches.length === 0) return null

  return (
    <select
      value={value === null ? '__main__' : value}
      onChange={(e) => {
        const v = e.target.value
        onChange(v === '__main__' ? null : v)
      }}
      className="date-input"
      style={{ cursor: 'pointer' }}
    >
      <option value="all">🏢 Bütün filiallar</option>
      <option value="__main__">Əsas filial</option>
      {branches.map((b) => (
        <option key={b.id} value={b.id}>{b.name}</option>
      ))}
    </select>
  )
}
