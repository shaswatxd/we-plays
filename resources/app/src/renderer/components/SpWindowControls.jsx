import React, { useState, useEffect } from 'react';

const WinMinus = () => (
  <svg width="10" height="10" viewBox="0 0 10 10">
    <path d="M 0,5 h 10" stroke="currentColor" strokeWidth="1"/>
  </svg>
);

const WinMaximize = () => (
  <svg width="10" height="10" viewBox="0 0 10 10">
    <path d="M 1,1 h 8 v 8 h -8 z" fill="none" stroke="currentColor" strokeWidth="1"/>
  </svg>
);

const WinRestore = () => (
  <svg width="10" height="10" viewBox="0 0 10 10">
    <path d="M 2,3.5 h 5.5 v 5.5 h -5.5 z" fill="none" stroke="currentColor" strokeWidth="1"/>
    <path d="M 3.5,1.5 h 5.5 v 5.5" fill="none" stroke="currentColor" strokeWidth="1"/>
  </svg>
);

const WinX = () => (
  <svg width="10" height="10" viewBox="0 0 10 10">
    <path d="M 0,0 L 10,10 M 10,0 L 0,10" stroke="currentColor" strokeWidth="1"/>
  </svg>
);

export default function SpWindowControls() {
  const [isMaximized, setIsMaximized] = useState(false);

  useEffect(() => {
    const clean = window.electronAPI?.onMaximizeChange?.((maximized) => {
      setIsMaximized(maximized);
    });
    return () => clean?.();
  }, []);

  return (
    <div className="app-titlebar">
      <div className="titlebar-controls">
        <button className="titlebar-btn" onClick={() => window.electronAPI?.minimize()} title="Minimize">
          <WinMinus />
        </button>
        <button className="titlebar-btn" onClick={() => window.electronAPI?.maximize()} title={isMaximized ? 'Restore' : 'Maximize'}>
          {isMaximized ? <WinRestore /> : <WinMaximize />}
        </button>
        <button className="titlebar-btn close" onClick={() => window.electronAPI?.close()} title="Close">
          <WinX />
        </button>
      </div>
    </div>
  );
}
