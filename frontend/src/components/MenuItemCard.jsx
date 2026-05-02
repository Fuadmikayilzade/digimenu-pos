import { useState } from 'react'

export default function MenuItemCard({ item, idx, onAdd }) {
  const [imgFailed, setImgFailed] = useState(false)

  return (
    <div className="menu-item" style={{ animationDelay: `${(idx % 12) * 0.04}s` }} onClick={onAdd}>
      <div className="item-img">
        {item.image && !imgFailed
          ? <img src={item.image} alt={item.name} onError={() => setImgFailed(true)} />
          : <span>{item.emoji}</span>
        }
        {idx < 3 && <span className="item-badge badge-hot">🔥 HOT</span>}
        {item.id > 38 && <span className="item-badge badge-new">NEW</span>}
      </div>
      <div className="item-body">
        <div className="item-name">{item.name}</div>
        <div className="item-cat">{item.category}</div>
        <div className="item-footer">
          <span className="item-price">{item.price.toFixed(2)} ₼</span>
          <span className="item-add">+</span>
        </div>
      </div>
    </div>
  )
}
