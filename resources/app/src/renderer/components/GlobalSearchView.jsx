import React, { useEffect, useState } from 'react';
import { usePlayerStore } from '../store/playerStore';
import SpSongRow from './SpSongRow';
import { Search, Music, ListMusic, History, Play, Clock } from 'lucide-react';

export default function GlobalSearchView({ query, onDownloadTrigger, onViewChange, onPlaylistSelect }) {
  const { playSong, playPlaylist } = usePlayerStore();
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!query || query.length < 2) return;
    setLoading(true);
    const search = async () => {
      try {
        const res = await window.electronAPI?.searchGlobal(query);
        setResults(res);
      } catch (e) {
        console.error('Global search error:', e);
      } finally { setLoading(false); }
    };
    search();
  }, [query]);

  if (loading) return (
    <div style={{ padding: 24 }}>
      <p style={{ fontSize:22, fontWeight:800, marginBottom:20 }}>Searching library for "{query}"...</p>
      {[...Array(4)].map((_, i) => (
        <div key={i} style={{ display:'flex', alignItems:'center', gap:12, padding:'8px 0' }}>
          <div className="sp-shimmer" style={{ width:40,height:40,borderRadius:4,flexShrink:0 }} />
          <div style={{ flex:1 }}>
            <div className="sp-shimmer" style={{ width:'40%',height:13,marginBottom:6 }} />
            <div className="sp-shimmer" style={{ width:'25%',height:11 }} />
          </div>
        </div>
      ))}
    </div>
  );

  if (!results) return null;

  const hasResults = (results.songs?.length > 0) || (results.playlists?.length > 0) || (results.history?.length > 0);

  if (!hasResults) return (
    <div className="sp-empty" style={{ padding: 24 }}>
      <div className="sp-empty-icon"><Search size={28}/></div>
      <p className="sp-empty-title">No results for "{query}"</p>
      <p className="sp-empty-sub">Try different keywords in your library.</p>
    </div>
  );

  return (
    <div style={{ padding: 24 }}>
      <div style={{ marginBottom: 24 }}>
        <p style={{ fontSize: 24, fontWeight: 900, color: '#fff', letterSpacing: '-0.02em', lineHeight: 1.2 }}>
          Library results for <span style={{ color: 'var(--sp-green)' }}>"{query}"</span>
        </p>
        <p style={{ fontSize: 12, color: '#6a6a6a', marginTop: 4 }}>
          {(results.songs?.length || 0) + (results.history?.length || 0)} matches
        </p>
      </div>

      {results.playlists?.length > 0 && (
        <div style={{ marginBottom:28 }}>
          <div style={{ display:'flex',alignItems:'center',gap:8,marginBottom:12 }}>
            <ListMusic size={16} color="#1db954"/>
            <p style={{ fontSize:14,fontWeight:700 }}>Playlists</p>
          </div>
          <div style={{ display:'flex',gap:10,flexWrap:'wrap' }}>
            {results.playlists.map(pl => (
              <button
                key={pl.id}
                onClick={() => onPlaylistSelect(pl.id)}
                style={{ display:'flex',alignItems:'center',gap:10,background:'rgba(255,255,255,0.06)',border:'1px solid rgba(255,255,255,0.08)',borderRadius:8,padding:'10px 14px',cursor:'pointer',transition:'all 0.15s',color:'#fff',textAlign:'left',minWidth:180 }}
                onMouseEnter={e=>{e.currentTarget.style.background='rgba(255,255,255,0.1)';e.currentTarget.style.transform='translateY(-1px)';}}
                onMouseLeave={e=>{e.currentTarget.style.background='rgba(255,255,255,0.06)';e.currentTarget.style.transform='translateY(0)';}}
              >
                <div style={{ width:40,height:40,borderRadius:4,background:'rgba(29,185,84,0.15)',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0 }}>
                  <Music size={16} color="#1db954"/>
                </div>
                <div>
                  <p style={{ fontSize:13,fontWeight:600 }}>{pl.name}</p>
                  <p style={{ fontSize:11,color:'#b3b3b3' }}>Playlist</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {results.songs?.length > 0 && (
        <div style={{ marginBottom:28 }}>
          <div style={{ display:'flex',alignItems:'center',gap:8,marginBottom:12 }}>
            <Music size={16} color="#1db954"/>
            <p style={{ fontSize:14,fontWeight:700 }}>Songs</p>
          </div>
          <div className="sp-table-header">
            <span>#</span>
            <span>Title</span>
            <span>Album</span>
            <span>Date Added</span>
            <span style={{ justifyContent: 'flex-end', paddingRight: 24 }}><Clock size={12} /></span>
          </div>
          {results.songs.map((s, i) => (
            <SpSongRow
              key={s.id}
              song={s}
              index={i}
              isSearchItem={false}
              onDownloadTrigger={onDownloadTrigger}
              onClick={() => playPlaylist(results.songs, i)}
            />
          ))}
        </div>
      )}

      {results.history?.length > 0 && (
        <div>
          <div style={{ display:'flex',alignItems:'center',gap:8,marginBottom:12 }}>
            <History size={16} color="#1db954"/>
            <p style={{ fontSize:14,fontWeight:700 }}>From History</p>
          </div>
          <div className="sp-table-header">
            <span>#</span>
            <span>Title</span>
            <span>Album</span>
            <span>Last Played</span>
            <span style={{ justifyContent: 'flex-end', paddingRight: 24 }}><Clock size={12} /></span>
          </div>
          {results.history.map((s, i) => (
            <SpSongRow
              key={`h-${s.id}`}
              song={s}
              index={i}
              isSearchItem={false}
              onDownloadTrigger={onDownloadTrigger}
              onClick={() => playPlaylist(results.history, i)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
