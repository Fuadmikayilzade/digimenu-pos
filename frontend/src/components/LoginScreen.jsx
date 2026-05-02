import { useState } from 'react'
import { USERS } from '../utils/constants'

export default function LoginScreen({ onLogin }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState('')
  const [showHint, setShowHint] = useState(false)

  const submit = () => {
    const user = USERS.find(u => u.username === username.trim() && u.password === password)
    if (user) {
      onLogin(user)
    } else {
      setError('İstifadəçi adı və ya şifrə yanlışdır')
      setPassword('')
    }
  }

  return (
    <div className="login-bg">
      <div className="login-card">
        <div className="login-logo">
          <h1>Digi<span>Menu</span> POS</h1>
          <p>Ləzzət Evi · Restoran İdarəetmə Sistemi</p>
        </div>

        {error && <div className="login-error">🔒 {error}</div>}

        <div>
          <div className="login-field">
            <label>İstifadəçi Adı</label>
            <input className="login-input" type="text" placeholder="username"
              value={username} onChange={e => setUsername(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && submit()} />
          </div>
          <div className="login-field">
            <label>Şifrə</label>
            <input className="login-input" type="password" placeholder="••••••••"
              value={password} onChange={e => setPassword(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && submit()} />
          </div>
          <button className="login-btn" onClick={submit}>🔓 Sistemə Daxil Ol</button>
        </div>

        <div className="login-hint">
          <p style={{ cursor: 'pointer', color: 'var(--gray)', userSelect: 'none' }}
            onClick={() => setShowHint(!showHint)}>
            {showHint ? '▲' : '▼'} Demo hesablar
          </p>
          {showHint && USERS.map(u => (
            <div key={u.username} className="hint-row">
              <span>{u.avatar} {u.username} / {u.password}</span>
              <span className="role">{u.role}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
