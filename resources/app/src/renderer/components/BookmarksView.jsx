import React, { useEffect, useState } from 'react';
import { usePlayerStore } from '../store/playerStore';
import { Bookmark, Play, Trash2, Clock, Music } from 'lucide-react';

export default function BookmarksView({ onDownloadTrigger }) {
  const { playSong } = usePlayerStore();
  const [bookmarks, setBookmarks] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadBookmarks = async () => {
    try {
      const data = await window.electronAPI?.getAllBookmarks();
      setBookmarks(data || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { loadBookmarks(); }, []);

  const fmt = (s) => {
    if (!s) return '0:00';
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = Math.floor(s % 60);
    return h > 0 ? `${h}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}` : `${m}:${String(sec).padStart(2,'0')}`;
  };

  const deleteBookmark = async (id) => {
    await window.electronAPI?.deleteBookmark(id);
    setBookmarks(prev => prev.filter(b => b.id !== id));
    window.showToast?.('Bookmark removed', 'info');
  };

  const playBookmark = async (bm) => {
    try {
      const songs = await window.electronAPI?.getAllSongs();
      const song = songs?.find(s => s.id === bm.song_id);
      if (song) {
        playSong(song);
        setTimeout(() => {
          const { howl } = usePlayerStore.getState();
          if (howl) howl.seek(bm.position);
          usePlayerStore.setState({ progress: bm.position });
        }, 500);
      }
    } catch (e) { console.error(e); }
  };

  if (loading) return (
    <div style={{ display:'flex',alignItems:'center',justifyContent:'center',height:200 }}>
      <div style={{ width:24,height:24,border:'2px solid #1db954',borderTopColor:'transparent',borderRadius:'50%',animation:'spin 0.8s linear infinite' }} />
    </div>
  );

  return (
    <div style={{ padding: 24 }}>
      <p style={{ fontSize:22, fontWeight:800, marginBottom:8 }}>Bookmarks</p>
      <p style={{ fontSize:13, color:'#b3b3b3', marginBottom:24 }}>Resume listening from where you left off.</p>

      {bookmarks.length === 0 ? (
        <div className="sp-empty">
          <div className="sp-empty-icon"><Bookmark size={28}/></div>
          <p className="sp-empty-title">No bookmarks yet</p>
          <p className="sp-empty-sub">Right-click a playing song and save a bookmark to resume later.</p>
        </div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          {bookmarks.map(bm => (
            <div
              key={bm.id}
              style={{ display:'flex',alignItems:'center',gap:12,background:'rgba(255,255,255,0.04)',border:'1px solid rgba(255,255,255,0.06)',borderRadius:8,padding:'12px 14px',transition:'background 0.15s',cursor:'pointer' }}
              onClick={() => playBookmark(bm)}
              onMouseEnter={e=>e.currentTarget.style.background='rgba(255,255,255,0.08)'}
              onMouseLeave={e=>e.currentTarget.style.background='rgba(255,255,255,0.04)'}
            >
              <button style={{ width:36,height:36,borderRadius:'50%',background:'#1db954',border:'none',color:'#000',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',flexShrink:0 }}>
                <Play size={14} fill="#000" color="#000" style={{marginLeft:2}}/>
              </button>
              <div style={{ flex:1,minWidth:0 }}>
                <p style={{ fontSize:13,fontWeight:600,color:'#fff',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>{bm.song_title}</p>
                <p style={{ fontSize:11,color:'#b3b3b3',marginTop:2 }}>
                  {bm.song_artist || 'Unknown'} {bm.label ? `· ${bm.label}` : ''}
                </p>
              </div>
              <div style={{ display:'flex',alignItems:'center',gap:8,flexShrink:0 }}>
                <div style={{ display:'flex',alignItems:'center',gap:4,background:'rgba(29,185,84,0.1)',borderRadius:4,padding:'4px 8px' }}>
                  <Clock size={11} color="#1db954"/>
                  <span style={{ fontSize:11,fontFamily:'var(--font-mono)',color:'#1db954',fontWeight:600 }}>{fmt(bm.position)}</span>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); deleteBookmark(bm.id); }}
                  style={{ background:'none',border:'none',color:'#b3b3b3',cursor:'pointer',padding:4,borderRadius:4,display:'flex',transition:'color 0.15s' }}
                  onMouseEnter={e=>e.currentTarget.style.color='#f15e6c'}
                  onMouseLeave={e=>e.currentTarget.style.color='#b3b3b3'}
                >
                  <Trash2 size={14}/>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
