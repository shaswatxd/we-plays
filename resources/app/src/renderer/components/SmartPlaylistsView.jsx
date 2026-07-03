import React, { useEffect, useState } from 'react';
import { usePlayerStore } from '../store/playerStore';
import SpSongRow from './SpSongRow';
import { TrendingUp, Clock, Star, Disc, Play, ArrowLeft } from 'lucide-react';

const SMART_LISTS = [
  { key: 'mostPlayed',    label: 'Most Played',     icon: TrendingUp, gradient: 'linear-gradient(135deg,#f59e0b,#b45309)' },
  { key: 'recentlyAdded', label: 'Recently Added',  icon: Clock,      gradient: 'linear-gradient(135deg,#3b82f6,#1e3a8a)' },
  { key: 'longNotPlayed', label: 'Forgotten Gems',  icon: Star,       gradient: 'linear-gradient(135deg,#8b5cf6,#4c1d95)' },
  { key: 'neverPlayed',   label: 'Never Played',    icon: Disc,       gradient: 'linear-gradient(135deg,#ef4444,#7f1d1d)' },
];

export default function SmartPlaylistsView({ onDownloadTrigger, onViewChange }) {
  const { playPlaylist } = usePlayerStore();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeList, setActiveList] = useState(null);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await window.electronAPI?.getSmartPlaylists();
        setData(res);
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    };
    load();
  }, []);

  if (loading) return (
    <div style={{ display:'flex',alignItems:'center',justifyContent:'center',height:200 }}>
      <div style={{ width:24,height:24,border:'2px solid #1db954',borderTopColor:'transparent',borderRadius:'50%',animation:'spin 0.8s linear infinite' }} />
    </div>
  );

  if (activeList && data) {
    const list = SMART_LISTS.find(l => l.key === activeList);
    const songs = data[activeList] || [];
    const Icon = list.icon;
    return (
      <div>
        <div className="sp-lib-banner-wrap" style={{ background: list.gradient }}>
          <button onClick={() => setActiveList(null)} style={{ display:'flex',alignItems:'center',gap:6,background:'rgba(0,0,0,0.3)',border:'none',color:'#fff',cursor:'pointer',marginBottom:16,fontSize:12,fontWeight:700,padding:'6px 12px',borderRadius:20,transition:'background 0.2s' }} onMouseEnter={e=>e.currentTarget.style.background='rgba(0,0,0,0.5)'} onMouseLeave={e=>e.currentTarget.style.background='rgba(0,0,0,0.3)'}>
            <ArrowLeft size={14} /> Back to Smart Playlists
          </button>
          <div className="sp-lib-banner" style={{ marginTop: 8 }}>
            <div className="sp-lib-banner-art" style={{ background:'rgba(0,0,0,0.3)',display:'flex',alignItems:'center',justifyContent:'center' }}>
              <Icon size={48} color="#fff"/>
            </div>
            <div className="sp-lib-banner-info">
              <div className="sp-lib-banner-type">Smart Playlist</div>
              <div className="sp-lib-banner-title">{list.label}</div>
              <div className="sp-lib-banner-meta">{songs.length} songs</div>
            </div>
          </div>
        </div>
        <div style={{ padding: '0 24px 24px 24px' }}>
          {songs.length > 0 ? (
            <>
              <div style={{ padding:'16px 0',display:'flex',gap:12,alignItems:'center' }}>
                <button className="sp-play-fab" onClick={() => playPlaylist(songs, 0)}>
                  <Play size={22} fill="black" color="black" style={{marginLeft:2}}/>
                </button>
              </div>
              <div className="sp-table-header">
                <span style={{ textAlign:'center' }}>#</span>
                <span>Title</span>
                <span>Album</span>
                <span>Artist</span>
                <span style={{ textAlign:'right', paddingRight:12 }}>Duration</span>
              </div>
              {songs.map((s, i) => (
                <SpSongRow key={s.id||i} song={s} index={i} isSearchItem={false} onDownloadTrigger={onDownloadTrigger} onClick={() => playPlaylist(songs, i)} />
              ))}
            </>
          ) : (
            <div className="sp-empty"><p className="sp-empty-title">No songs in this list yet</p></div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: 24 }}>
      <p style={{ fontSize:22, fontWeight:800, marginBottom:8 }}>Smart Playlists</p>
      <p style={{ fontSize:13, color:'#b3b3b3', marginBottom:24 }}>Auto-generated playlists based on your listening habits.</p>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(220px, 1fr))', gap:16 }}>
        {SMART_LISTS.map(list => {
          const Icon = list.icon;
          const count = data?.[list.key]?.length || 0;
          return (
            <button
              key={list.key}
              onClick={() => setActiveList(list.key)}
              style={{ background:list.gradient,border:'none',borderRadius:12,padding:20,cursor:'pointer',textAlign:'left',color:'#fff',transition:'transform 0.2s, box-shadow 0.2s',position:'relative',overflow:'hidden',minHeight:140 }}
              onMouseEnter={e=>{e.currentTarget.style.transform='scale(1.03)';e.currentTarget.style.boxShadow='0 8px 24px rgba(0,0,0,0.4)';}}
              onMouseLeave={e=>{e.currentTarget.style.transform='scale(1)';e.currentTarget.style.boxShadow='none';}}
            >
              <Icon size={28} style={{ marginBottom:12, opacity:0.9 }} />
              <p style={{ fontSize:18,fontWeight:800,lineHeight:1.2 }}>{list.label}</p>
              <p style={{ fontSize:12,opacity:0.7,marginTop:4 }}>{count} songs</p>
            </button>
          );
        })}
      </div>
    </div>
  );
}
