import React, { useEffect, useRef, useState } from 'react';
import { usePlayerStore } from '../store/playerStore';
import { useLibraryStore } from '../store/libraryStore';
import { Play, Download, Plus, Trash2, Folder, MoreVertical, Music } from 'lucide-react';
import SpotifyHeart from './SpotifyHeart';

export default React.memo(function SpSongRow({ song, index, isSearchItem, onDownloadTrigger, onRemovePlaylistSong, onClick }) {
  const { currentSong, isPlaying, playSong, addToQueue } = usePlayerStore();
  const { toggleFavorite, removeSong, playlists, addToPlaylist } = useLibraryStore();
  const [showMenu, setShowMenu]   = useState(false);
  const [menuPos,  setMenuPos]    = useState({ x: 0, y: 0 });
  const [showDel,  setShowDel]    = useState(false);
  const menuRef = useRef(null);

  const isActive = currentSong && (
    (song.yt_id && currentSong.yt_id === song.yt_id) ||
    (song.id    && currentSong.id    === song.id)
  );

  useEffect(() => {
    if (!showMenu) return;
    const close = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setShowMenu(false);
    };
    setTimeout(() => document.addEventListener('mousedown', close), 0);
    return () => document.removeEventListener('mousedown', close);
  }, [showMenu]);

  const play = (e) => {
    e?.stopPropagation();
    if (onClick) {
      onClick();
    } else {
      playSong(isSearchItem ? { ...song, file_path: song.url, isFromSearch: true } : song);
    }
  };

  const fav = async (e) => {
    e.stopPropagation();
    if (song.id) { await toggleFavorite(song.id); }
  };

  const openMenu = (e) => {
    e.preventDefault(); e.stopPropagation();
    const vw = window.innerWidth; const vh = window.innerHeight;
    let x = e.clientX, y = e.clientY;
    if (x + 210 > vw) x = vw - 215;
    if (y + 320 > vh) y = vh - 325;
    setMenuPos({ x, y });
    setShowMenu(v => !v);
  };

  const confirmDelete = async () => {
    setShowDel(false);
    await removeSong(song.id);
    window.showToast?.('Song removed from library', 'info');
  };

  const fmt = (s) => {
    if (!s) return '0:00';
    return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
  };
  const fmtViews = (n) => {
    if (!n) return '';
    if (n >= 1e9) return `${(n/1e9).toFixed(1)}B`;
    if (n >= 1e6) return `${(n/1e6).toFixed(1)}M`;
    if (n >= 1e3) return `${(n/1e3).toFixed(1)}K`;
    return `${n}`;
  };

  return (
    <>
      <div
        className={`sp-song-row${isActive ? ' active' : ''}`}
        onClick={isSearchItem ? undefined : play}
        onContextMenu={openMenu}
      >
        {/* # */}
        <div className="sp-row-num-cell">
          {isActive && isPlaying
            ? <div className="eq-bars"><span/><span/><span/></div>
            : <span className="sp-row-num">{index + 1}</span>
          }
          {!isSearchItem && (
            <button className="sp-row-play" onClick={play}>
              <Play size={14} fill="white" color="white" />
            </button>
          )}
        </div>

        {/* Title */}
        <div style={{ display:'flex', alignItems:'center', gap:12, minWidth:0, paddingRight:12 }}>
          <div className="sp-song-thumb">
            {song.thumbnail
              ? <img src={song.thumbnail} alt="" />
              : <div className="sp-song-thumb-ph"><Music size={14}/></div>
            }
          </div>
          <div style={{ minWidth:0 }}>
            <p className="sp-song-title">{song.title}</p>
            <p className="sp-song-artist">
              {song.artist || 'Unknown'}

            </p>
          </div>
        </div>

        {/* Album / Views */}
        <div className="sp-song-meta">
          {isSearchItem ? (fmtViews(song.views) ? `${fmtViews(song.views)} views` : '—') : (song.album || '—')}
        </div>

        {/* Date */}
        <div className="sp-song-date">
          {isSearchItem
            ? (song.uploadDate || '')
            : (song.played_at
                ? new Date(song.played_at).toLocaleDateString()
                : (song.date_added
                    ? new Date(song.date_added).toLocaleDateString()
                    : 'Local'
                  )
              )
          }
        </div>

        {/* Actions + Duration */}
        <div className="sp-row-actions">
          {isSearchItem ? (
            <>
              <button className="sp-row-btn" style={{ opacity:1, width:34, height:34, borderRadius:'50%', background:'linear-gradient(135deg,#1db954,#1ed760)', display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 2px 8px rgba(29,185,84,0.4)', transition:'transform 0.15s, box-shadow 0.15s' }}
                title="Download"
                onClick={e => { e.stopPropagation(); onDownloadTrigger?.(song); }}
                onMouseEnter={e => { e.currentTarget.style.transform='scale(1.12)'; e.currentTarget.style.boxShadow='0 4px 14px rgba(29,185,84,0.6)'; }}
                onMouseLeave={e => { e.currentTarget.style.transform='scale(1)'; e.currentTarget.style.boxShadow='0 2px 8px rgba(29,185,84,0.4)'; }}
              >
                <Download size={17} color="#fff" strokeWidth={2.5} />
              </button>
            </>
          ) : (
            <>
              <button
                className={`sp-row-btn${song.is_favorite === 1 ? ' heart-active' : ''}`}
                title="Like"
                onClick={fav}
              >
                <SpotifyHeart size={15} active={song.is_favorite === 1} />
              </button>
              <span className="sp-song-dur">{fmt(song.duration)}</span>
            </>
          )}
          {!isSearchItem && (
            <button className="sp-row-btn" style={{ opacity:1 }} onClick={openMenu}>
              <MoreVertical size={15} />
            </button>
          )}
        </div>
      </div>

      {/* Context Menu */}
      {showMenu && (
        <div
          ref={menuRef}
          className="sp-ctx-menu"
          style={{ left: menuPos.x, top: menuPos.y }}
        >
          {!isSearchItem && (
            <button className="sp-ctx-item" onClick={e => { play(e); setShowMenu(false); }}>
              <Play size={14}/> Play Now
            </button>
          )}
          {!isSearchItem && (
            <button className="sp-ctx-item" onClick={() => {
              addToQueue(song);
              setShowMenu(false);
              window.showToast?.('Added to queue', 'success');
            }}>
              <Plus size={14}/> Add to Queue
            </button>
          )}

          {isSearchItem && (
            <button className="sp-ctx-item" onClick={() => { onDownloadTrigger?.(song); setShowMenu(false); }}>
              <Download size={16} color="#1db954"/> Download
            </button>
          )}

          {!isSearchItem && playlists.length > 0 && (
            <>
              <div className="sp-ctx-sep"/>
              <div className="sp-ctx-label">Add to Playlist</div>
              {playlists.map(pl => (
                <button key={pl.id} className="sp-ctx-item" style={{ paddingLeft:24 }}
                  onClick={() => { addToPlaylist(pl.id, song.id); setShowMenu(false); window.showToast?.(`Added to ${pl.name}`,'success'); }}>
                  {pl.name}
                </button>
              ))}
            </>
          )}

          {!isSearchItem && (
            <>
              <div className="sp-ctx-sep"/>
              {onRemovePlaylistSong && (
                <button className="sp-ctx-item" onClick={() => { onRemovePlaylistSong(song.id); setShowMenu(false); }}>
                  <Trash2 size={14}/> Remove from Playlist
                </button>
              )}
              {song.file_path && (
                <button className="sp-ctx-item" onClick={() => { window.electronAPI?.showFileInExplorer(song.file_path); setShowMenu(false); }}>
                  <Folder size={14}/> Show in Explorer
                </button>
              )}
              <button className="sp-ctx-item danger" onClick={() => { setShowMenu(false); setShowDel(true); }}>
                <Trash2 size={14}/> Delete from Library
              </button>
            </>
          )}
        </div>
      )}

      {/* Delete Confirm */}
      {showDel && (
        <div className="sp-modal-bg" onClick={() => setShowDel(false)}>
          <div className="sp-modal" style={{ maxWidth:380 }} onClick={e => e.stopPropagation()}>
            <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:12 }}>
              <div style={{ width:40,height:40,borderRadius:'50%',background:'rgba(233,20,41,0.12)',display:'flex',alignItems:'center',justifyContent:'center' }}>
                <Trash2 size={18} style={{ color:'#f15e6c' }}/>
              </div>
              <div>
                <p style={{ fontWeight:700, fontSize:15 }}>Delete Song</p>
                <p style={{ fontSize:12, color:'#b3b3b3', marginTop:2 }}>This cannot be undone.</p>
              </div>
            </div>
            <p style={{ fontSize:14, color:'#b3b3b3', margin:'8px 0 20px 52px' }}>"{song.title}"</p>
            <div style={{ display:'flex', justifyContent:'flex-end', gap:10 }}>
              <button
                style={{ background:'none',border:'1px solid rgba(255,255,255,0.2)',color:'#b3b3b3',padding:'10px 20px',borderRadius:99,cursor:'pointer',fontWeight:700,fontSize:13 }}
                onClick={() => setShowDel(false)}
              >Cancel</button>
              <button
                style={{ background:'#e91429',border:'none',color:'#fff',padding:'10px 24px',borderRadius:99,cursor:'pointer',fontWeight:700,fontSize:13,display:'flex',alignItems:'center',gap:8 }}
                onClick={confirmDelete}
              ><Trash2 size={14}/> Delete</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
});
