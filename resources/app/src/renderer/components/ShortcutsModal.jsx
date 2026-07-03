import React from 'react';
import { X, Keyboard } from 'lucide-react';

const SHORTCUTS = [
  { category: 'Playback', items: [
    ['Space', 'Play / Pause'],
    ['N', 'Next Track'],
    ['P', 'Previous Track'],
    ['M', 'Mute / Unmute'],
    ['S', 'Toggle Shuffle'],
    ['R', 'Toggle Repeat'],
  ]},
  { category: 'Navigation', items: [
    ['Ctrl + F', 'Focus Search Bar'],
    ['Ctrl + L', 'Go to Search'],
    ['Ctrl + D', 'Download Current Song'],
    ['?', 'Toggle This Help'],
    ['Esc', 'Close Modals'],
  ]},
  { category: 'Seek & Volume', items: [
    ['←', 'Rewind 10s'],
    ['→', 'Forward 10s'],
    ['↑', 'Volume +5%'],
    ['↓', 'Volume -5%'],
  ]},
];

export default function ShortcutsModal({ onClose }) {
  return (
    <div className="sp-modal-bg" onClick={onClose}>
      <div className="sp-modal" style={{ maxWidth:520 }} onClick={e => e.stopPropagation()}>
        <div className="sp-modal-header">
          <div style={{ display:'flex',alignItems:'center',gap:10 }}>
            <Keyboard size={20} color="#1db954"/>
            <span className="sp-modal-title">Keyboard Shortcuts</span>
          </div>
          <button className="sp-modal-close" onClick={onClose}><X size={18}/></button>
        </div>

        <div style={{ display:'flex',flexDirection:'column',gap:20 }}>
          {SHORTCUTS.map(section => (
            <div key={section.category}>
              <p style={{ fontSize:11,fontWeight:800,textTransform:'uppercase',letterSpacing:'0.09em',color:'#1db954',marginBottom:8 }}>{section.category}</p>
              <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:'6px 16px' }}>
                {section.items.map(([key, desc]) => (
                  <div key={key} style={{ display:'flex',alignItems:'center',justifyContent:'space-between',padding:'4px 0' }}>
                    <span style={{ fontSize:13,color:'#b3b3b3' }}>{desc}</span>
                    <kbd style={{ padding:'4px 10px',background:'rgba(255,255,255,0.06)',border:'1px solid rgba(255,255,255,0.1)',borderRadius:6,fontFamily:'var(--font-mono)',fontSize:11,color:'#fff',whiteSpace:'nowrap' }}>{key}</kbd>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="sp-modal-footer">
          <button className="btn-green" onClick={onClose} style={{ padding:'10px 24px',fontSize:13 }}>
            Got it!
          </button>
        </div>
      </div>
    </div>
  );
}
