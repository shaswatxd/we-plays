import React, { useState, useRef, useEffect } from 'react';
import { Search, X, ListMusic } from 'lucide-react';

export default function SpTopBar({ view, showPanel, onTogglePanel, onGlobalSearch, scrolled }) {
  const [q, setQ] = useState('');
  const timer = useRef(null);

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  const fire = (val) => {
    if (val.trim().length >= 2) {
      onGlobalSearch?.(val.trim());
    }
  };

  const onChange = (e) => {
    const val = e.target.value;
    setQ(val);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => fire(val), 600);
  };

  const onKey = (e) => {
    if (e.key === 'Enter') { clearTimeout(timer.current); fire(q); }
  };

  const clear = () => { setQ(''); clearTimeout(timer.current); };

  return (
    <div className={`sp-topbar${scrolled ? ' scrolled' : ''}`}>
      <div className="sp-search-wrap">
        <Search className="sp-search-icon" size={16} />
        <input
          type="text"
          className="sp-search-input"
          value={q}
          onChange={onChange}
          onKeyDown={onKey}
          placeholder="Search your library..."
        />
        {q && (
          <button className="sp-search-clear" onClick={clear}>
            <X size={15} />
          </button>
        )}
      </div>

      <div style={{ display:'flex', gap:6, alignItems:'center' }}>
        <button
          className={`sp-queue-btn${showPanel ? ' active' : ''}`}
          onClick={onTogglePanel}
          title="Queue"
        >
          <ListMusic size={14} />
          Queue
        </button>
      </div>
    </div>
  );
}
