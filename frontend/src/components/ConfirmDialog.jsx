export default function ConfirmDialog({ msg, onYes, onNo }) {
  return (
    <div className="modal-bg" onClick={e => e.target === e.currentTarget && onNo()}>
      <div className="confirm-modal">
        <div className="confirm-icon">⚠️</div>
        <div className="confirm-title">Əminsinizmi?</div>
        <div className="confirm-msg">{msg}</div>
        <div className="confirm-btns">
          <button style={{ flex: 1, height: 38, borderRadius: 8, background: 'var(--bg4)', color: 'var(--gray)', border: '1px solid var(--border)', cursor: 'pointer', fontWeight: 600 }} onClick={onNo}>Xeyr</button>
          <button style={{ flex: 1, height: 38, borderRadius: 8, background: 'var(--red)', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 700 }} onClick={onYes}>Bəli, sil</button>
        </div>
      </div>
    </div>
  )
}
