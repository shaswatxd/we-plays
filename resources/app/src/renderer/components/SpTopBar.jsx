import React, { useState, useRef } from 'react';
import { Search, X, ListMusic, Globe } from 'lucide-react';

export default function SpTopBar({ view, showPanel, onTogglePanel, onGlobalSearch, scrolled }) {
  const [q, setQ] = useState('');
  const [mode, setMode] = useState('youtube');
  const timer = useRef(null);

  const hideSearch = view === 'favorites' || view === 'playlist' || view === 'recent';

  const fire = (val) => {
    if (val.trim().length >= 2) {
      if (mode === 'global') {
        onGlobalSearch?.(val.trim());
      } else {
        window.dispatchEvent(new CustomEvent('sp-search', { detail: val.trim() }));
      }
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
      {!hideSearch && (
        <div className="sp-search-wrap">
          <Search className="sp-search-icon" size={16} />
          <input
            type="text"
            className="sp-search-input"
            value={q}
            onChange={onChange}
            onKeyDown={onKey}
            placeholder={mode === 'global' ? 'Search your library...' : 'What do you want to play?'}
          />
          {q && (
            <button className="sp-search-clear" onClick={clear}>
              <X size={15} />
            </button>
          )}
        </div>
      )}

      {!hideSearch && (
      <div style={{ display:'flex', gap:6, alignItems:'center' }}>
        <button
          className={`sp-mode-btn${mode==='global'?' active':''}`}
          onClick={() => setMode(v => v === 'global' ? 'youtube' : 'global')}
          title={mode === 'global' ? 'Switch to YouTube Search' : 'Switch to Library Search'}
        >
          <Globe size={14} />
          {mode === 'global' ? 'Library' : 'YouTube'}
        </button>

        <button
          className={`sp-queue-btn${showPanel ? ' active' : ''}`}
          onClick={onTogglePanel}
          title="Queue"
        >
          <ListMusic size={14} />
          Queue
        </button>
      </div>
      )}
    </div>
  );
}
