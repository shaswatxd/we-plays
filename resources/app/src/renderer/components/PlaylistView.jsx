import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useLibraryStore } from '../store/libraryStore';
import { usePlayerStore }  from '../store/playerStore';
import SpSongRow from './SpSongRow';
import { Play, Shuffle, Music, Clock, Trash2, Search, X, ArrowUpDown, GripVertical, Pencil, CheckSquare, Square, Plus } from 'lucide-react';

export default function PlaylistView({ playlistId, onDownloadTrigger, onViewChange }) {
  const {
    playlists, playlistSongs, loadPlaylistSongs, removeFromPlaylist, deletePlaylist, renamePlaylist,
    favorites, recent, loadFavorites, loadRecent, reorderPlaylistSongs,
    songs: librarySongs, addToPlaylist, toggleFavorite, loadLibrary
  } = useLibraryStore();
  const { playPlaylist } = usePlayerStore();
  const [loading, setLoading] = useState(true);
  const [filterQuery, setFilterQuery] = useState('');
  const [sortBy, setSortBy] = useState('default');
  const [sortDir, setSortDir] = useState('asc');
  const [renaming, setRenaming] = useState(false);
  const [renameVal, setRenameVal] = useState('');
  const [dragIdx, setDragIdx] = useState(null);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [showAdd, setShowAdd] = useState(false);
  const [addQuery, setAddQuery] = useState('');
  const renameRef = useRef(null);
  const selectionMode = selectedIds.size > 0;

  const isSpecial = playlistId === 'favorites' || playlistId === 'recent';
  const playlist = playlistId === 'favorites'
    ? { name: 'Liked Songs', isSpecial: true, gradient: 'linear-gradient(135deg,#450af5,#c4efd9)', art: '💚' }
    : playlistId === 'recent'
      ? { name: 'Recently Played', isSpecial: true, gradient: 'linear-gradient(135deg,#4b5563,#1f2937)', art: '🕐' }
      : playlists.find(p => p.id === playlistId);

  const songs = playlistId === 'favorites'
    ? favorites
    : playlistId === 'recent'
      ? recent
      : (playlistSongs[playlistId] || []);

  const filteredSongs = songs.filter(s => 
    (s.title || '').toLowerCase().includes(filterQuery.toLowerCase()) ||
    (s.artist || '').toLowerCase().includes(filterQuery.toLowerCase()) ||
    (s.album || '').toLowerCase().includes(filterQuery.toLowerCase())
  );

  const sortedSongs = [...filteredSongs].sort((a, b) => {
    let cmp = 0;
    switch (sortBy) {
      case 'title':    cmp = (a.title || '').localeCompare(b.title || ''); break;
      case 'artist':   cmp = (a.artist || '').localeCompare(b.artist || ''); break;
      case 'album':    cmp = (a.album || '').localeCompare(b.album || ''); break;
      case 'duration': cmp = (a.duration || 0) - (b.duration || 0); break;
      case 'date':     cmp = new Date(b.date_added || 0) - new Date(a.date_added || 0); break;
      case 'playcount': cmp = (b.play_count || 0) - (a.play_count || 0); break;
      default:         cmp = 0;
    }
    return sortDir === 'asc' ? cmp : -cmp;
  });

  const handleSort = (field) => {
    if (sortBy === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortBy(field); setSortDir('asc'); }
  };

  const startRename = () => {
    if (isSpecial || !playlist) return;
    setRenameVal(playlist.name);
    setRenaming(true);
    setTimeout(() => renameRef.current?.focus(), 50);
  };

  const doRename = async () => {
    if (renameVal.trim() && playlistId) {
      await renamePlaylist(playlistId, renameVal.trim());
      window.showToast?.('Playlist renamed', 'success');
    }
    setRenaming(false);
  };

  const handleDragStart = (e, idx) => { setDragIdx(idx); e.dataTransfer.effectAllowed = 'move'; };
  const handleDragOver = (e, idx) => {
    e.preventDefault();
    if (dragIdx !== null && dragIdx !== idx) {
      const songIds = sortedSongs.map(s => s.id);
      const [moved] = songIds.splice(dragIdx, 1);
      songIds.splice(idx, 0, moved);
      reorderPlaylistSongs(playlistId, songIds);
      setDragIdx(idx);
    }
  };
  const handleDragEnd = () => { setDragIdx(null); };

  useEffect(() => {
    if (!playlistId) return;
    setFilterQuery('');
    setSortBy('default');
    setLoading(true);
    if (playlistId === 'favorites') {
      loadFavorites().finally(() => setLoading(false));
    } else if (playlistId === 'recent') {
      loadRecent().finally(() => setLoading(false));
    } else {
      loadPlaylistSongs(playlistId).finally(() => setLoading(false));
    }
  }, [playlistId]);

  const playAll = () => { if (sortedSongs.length) playPlaylist(sortedSongs, 0); };
  const shuffle = () => {
    if (!sortedSongs.length) return;
    const l = [...sortedSongs];
    for (let i = l.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [l[i], l[j]] = [l[j], l[i]];
    }
    playPlaylist(l, 0);
    usePlayerStore.setState({ isShuffled: true });
  };

  const removeSong = (id) => {
    removeFromPlaylist(playlistId, id);
    window.showToast?.('Removed from playlist', 'info');
  };

  const toggleSelect = (id, e) => {
    if (e) e.stopPropagation();
    setSelectedIds(prev => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  };
  const selectAll = () => setSelectedIds(new Set(sortedSongs.map(s => s.id)));
  const clearSelection = () => setSelectedIds(new Set());
  const bulkAddToQueue = () => {
    const { addToQueue } = usePlayerStore.getState();
    sortedSongs.filter(s => selectedIds.has(s.id)).forEach(s => addToQueue(s));
    window.showToast?.(`Added ${selectedIds.size} songs to queue`, 'success');
    clearSelection();
  };
  const bulkDelete = async () => {
    if (!window.confirm(`Remove ${selectedIds.size} songs from this playlist?`)) return;
    for (const id of selectedIds) await removeFromPlaylist(playlistId, id);
    window.showToast?.(`Removed ${selectedIds.size} songs`, 'info');
    clearSelection();
  };

  // "Add Songs" picker — works for regular playlists and Liked Songs
  // (adding to Liked Songs = marking the song as favorite).
  const canAddSongs = playlistId !== 'recent';
  const openAdd = () => { setAddQuery(''); setShowAdd(true); loadLibrary(); };

  const existingIds = new Set(songs.map(s => s.id));
  const addCandidates = showAdd
    ? librarySongs.filter(s =>
        !existingIds.has(s.id) &&
        ((s.title || '').toLowerCase().includes(addQuery.toLowerCase()) ||
         (s.artist || '').toLowerCase().includes(addQuery.toLowerCase()) ||
         (s.album || '').toLowerCase().includes(addQuery.toLowerCase())))
    : [];

  const addSongTo = async (s) => {
    if (playlistId === 'favorites') await toggleFavorite(s.id);
    else await addToPlaylist(playlistId, s.id);
    window.showToast?.(`Added "${s.title}"`, 'success');
  };

  const handleDeletePlaylist = async () => {
    if (!playlist || playlist.isSpecial) return;
    if (window.confirm(`Are you sure you want to permanently delete the playlist "${playlist.name}"?\nSongs will remain in your library.`)) {
      await deletePlaylist(playlistId);
      onViewChange?.('search');
      window.showToast?.('Playlist deleted', 'info');
    }
  };

  const totalDur = () => {
    const s = songs.reduce((a, s) => a + (s.duration || 0), 0);
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
    return h > 0 ? `${h} hr ${m} min` : `${m} min`;
  };

  if (loading) return (
    <div style={{ display:'flex',alignItems:'center',justifyContent:'center',height:200 }}>
      <div style={{ width:24,height:24,border:'2px solid #1db954',borderTopColor:'transparent',borderRadius:'50%',animation:'spin 0.8s linear infinite' }} />
    </div>
  );

  if (!playlist) return (
    <div className="sp-empty">
      <div className="sp-empty-icon"><Music size={28}/></div>
      <p className="sp-empty-title">Playlist not found</p>
    </div>
  );

  const bgGradient = playlist.gradient || 'linear-gradient(135deg,#5b21b6,#1e1b4b)';
  const bannerArt = playlist.art || '🎵';
  const SortIcon = ({ field }) => (
    <ArrowUpDown size={10} style={{ opacity: sortBy === field ? 1 : 0.3, transform: sortBy === field && sortDir === 'desc' ? 'rotate(180deg)' : 'none', transition:'all 0.15s' }} />
  );

  return (
    <div>
      <div className="sp-lib-banner-wrap" style={{ background: bgGradient }}>
        <div className="sp-lib-banner">
          <div className="sp-lib-banner-art" style={{ background:'rgba(0,0,0,0.3)', fontSize: 60 }}>{bannerArt}</div>
          <div className="sp-lib-banner-info">
            <div className="sp-lib-banner-type">{playlist.isSpecial ? 'Library' : 'Playlist'}</div>
            {renaming ? (
              <input
                ref={renameRef}
                type="text"
                value={renameVal}
                onChange={e => setRenameVal(e.target.value)}
                onBlur={doRename}
                onKeyDown={e => { if (e.key === 'Enter') doRename(); if (e.key === 'Escape') setRenaming(false); }}
                style={{ fontSize:48,fontWeight:900,color:'#fff',background:'rgba(0,0,0,0.3)',border:'2px solid #1db954',borderRadius:4,padding:'2px 8px',outline:'none',width:'100%',fontFamily:'var(--font-head)' }}
              />
            ) : (
              <div className="sp-lib-banner-title" style={{ display:'flex',alignItems:'center',gap:12 }}>
                {playlist.name}
                {!playlist.isSpecial && (
                  <button onClick={startRename} style={{ background:'none',border:'none',color:'#b3b3b3',cursor:'pointer',padding:4,borderRadius:4,display:'flex',opacity:0.5,transition:'opacity 0.15s' }} onMouseEnter={e=>e.currentTarget.style.opacity=1} onMouseLeave={e=>e.currentTarget.style.opacity=0.5}>
                    <Pencil size={16}/>
                  </button>
                )}
              </div>
            )}
            <div className="sp-lib-banner-meta">{songs.length} songs • {totalDur()}</div>
          </div>
        </div>
      </div>

      <div style={{ padding: '0 24px 24px 24px' }}>
        {songs.length === 0 ? (
          <div className="sp-empty">
            <div className="sp-empty-icon"><Music size={28}/></div>
            <p className="sp-empty-title">{playlist.name} is empty</p>
            <p className="sp-empty-sub">
              {playlistId === 'favorites' ? 'Like songs in the library or search view to see them here.' :
               playlistId === 'recent' ? 'Start listening to build your recently played list.' :
               'Right-click songs in your library to add them here.'}
            </p>
            {canAddSongs && (
              <button className="sp-ghost-btn" onClick={openAdd} style={{ marginTop:16 }}>
                <Plus size={14}/> Add Songs
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="sp-lib-actions" style={{ display: 'flex', gap: 12, alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                <button className="sp-play-fab" onClick={playAll}>
                  <Play size={22} fill="black" color="black" style={{ marginLeft:2 }}/>
                </button>
                <button className="sp-ghost-btn" onClick={shuffle}>
                  <Shuffle size={14}/> Shuffle
                </button>
                {canAddSongs && (
                  <button className="sp-ghost-btn" onClick={openAdd}>
                    <Plus size={14}/> Add Songs
                  </button>
                )}
                {!playlist.isSpecial && (
                  <button className="sp-ghost-btn" onClick={handleDeletePlaylist} title="Delete Playlist" style={{ color: '#f15e6c', borderColor: 'rgba(241,94,108,0.3)' }}>
                    <Trash2 size={14}/> Delete
                  </button>
                )}
              </div>

              <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                <div style={{ display:'flex', gap:2, alignItems:'center', background:'rgba(255,255,255,0.06)', borderRadius:6, padding:'4px 8px', border:'1px solid rgba(255,255,255,0.1)' }}>
                  {['title','artist','date','duration','playcount'].map(f => (
                    <button key={f} onClick={() => handleSort(f)} style={{ background: sortBy === f ? 'rgba(29,185,84,0.2)' : 'none', border:'none', color: sortBy === f ? '#1db954' : '#6a6a6a', padding:'4px 6px', borderRadius:4, cursor:'pointer', fontSize:10, fontWeight:700, textTransform:'uppercase', display:'flex', alignItems:'center', gap:2, transition:'all 0.15s' }}>
                      {f === 'playcount' ? 'Plays' : f} <SortIcon field={f} />
                    </button>
                  ))}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(255,255,255,0.06)', borderRadius: 6, padding: '6px 10px', width: 200, border: '1px solid rgba(255,255,255,0.1)' }}>
                  <Search size={14} color="#b3b3b3" style={{ marginRight: 6 }} />
                  <input
                    type="text"
                    placeholder="Filter..."
                    value={filterQuery}
                    onChange={e => setFilterQuery(e.target.value)}
                    style={{ background: 'none', border: 'none', color: '#fff', fontSize: 12, width: '100%', outline: 'none', WebkitUserSelect: 'text', userSelect: 'text' }}
                  />
                  {filterQuery && (
                    <button onClick={() => setFilterQuery('')} style={{ background: 'none', border: 'none', color: '#b3b3b3', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: 0 }}>
                      <X size={14} />
                    </button>
                  )}
                </div>
              </div>
            </div>

            {sortedSongs.length === 0 ? (
              <div className="sp-empty" style={{ padding: '60px 0' }}>
                <p className="sp-empty-title" style={{ fontSize: 16, fontWeight: 600 }}>No matches found</p>
                <p className="sp-empty-sub" style={{ fontSize: 12, marginTop: 4 }}>Double-check your spelling or try another query.</p>
              </div>
            ) : (
              <>
                {selectionMode && (
                  <div className="sp-bulk-bar">
                    <span style={{ fontSize:13, fontWeight:700 }}>{selectedIds.size} selected</span>
                    <button className="sp-ghost-btn" onClick={bulkAddToQueue}><Play size={13}/> Add to Queue</button>
                    {!playlist.isSpecial && <button className="sp-ghost-btn" style={{ color:'#f15e6c', borderColor:'rgba(241,94,108,0.3)' }} onClick={bulkDelete}><Trash2 size={13}/> Remove</button>}
                    <button className="sp-ghost-btn" style={{ marginLeft:'auto' }} onClick={clearSelection}><X size={13}/> Deselect</button>
                  </div>
                )}
                <div className="sp-table-header">
                  <span style={{ textAlign:'center' }}>
                    <button onClick={selectAll} style={{ background:'none',border:'none',color:'#6a6a6a',cursor:'pointer',padding:0,display:'flex' }} title="Select all">
                      {selectedIds.size === sortedSongs.length && sortedSongs.length > 0 ? <CheckSquare size={14} color="#1db954"/> : <Square size={14}/>}
                    </button>
                  </span>
                  <span>Title</span>
                  <span onClick={() => handleSort('album')} style={{ cursor:'pointer' }}>Album <SortIcon field="album" /></span>
                  <span onClick={() => handleSort('date')} style={{ cursor:'center' }}>Date <SortIcon field="date" /></span>
                  <span style={{ textAlign:'right', paddingRight:12 }}><Clock size={12} style={{ display:'inline' }}/></span>
                </div>

                {sortedSongs.map((s, i) => (
                  <div
                    key={`${playlistId}-${s.id || i}`}
                    draggable={!playlist.isSpecial && !selectionMode}
                    onDragStart={(e) => handleDragStart(e, i)}
                    onDragOver={(e) => handleDragOver(e, i)}
                    onDragEnd={handleDragEnd}
                    style={{ display:'flex', alignItems:'center', position:'relative' }}
                  >
                    {/* Checkbox */}
                    <button
                      onClick={e => toggleSelect(s.id, e)}
                      style={{ background:'none',border:'none',color: selectedIds.has(s.id) ? '#1db954' : '#6a6a6a',cursor:'pointer',padding:'0 4px',flexShrink:0,display:'flex',alignItems:'center' }}
                    >
                      {selectedIds.has(s.id) ? <CheckSquare size={14}/> : <Square size={14}/>}
                    </button>
                    {!playlist.isSpecial && !selectionMode && (
                      <GripVertical size={12} style={{ color:'#6a6a6a', cursor:'grab', margin:'0 4px', flexShrink:0, opacity: dragIdx === i ? 1 : 0.3, transition:'opacity 0.15s' }} />
                    )}
                    <div style={{ flex:1 }}>
                      <SpSongRow
                        song={s}
                        index={i}
                        isSearchItem={false}
                        onDownloadTrigger={onDownloadTrigger}
                        onRemovePlaylistSong={playlist.isSpecial ? undefined : removeSong}
                        onClick={() => playPlaylist(sortedSongs, i)}
                      />
                    </div>
                  </div>
                ))}
              </>
            )}
          </>
        )}
      </div>

      {/* Add Songs picker */}
      {showAdd && (
        <div className="sp-modal-bg" onClick={() => setShowAdd(false)}>
          <div className="sp-modal" onClick={e => e.stopPropagation()} style={{ maxWidth:520 }}>
            <div className="sp-modal-header">
              <span className="sp-modal-title">Add Songs to {playlist.name}</span>
              <button className="sp-modal-close" onClick={() => setShowAdd(false)}><X size={18}/></button>
            </div>

            <div style={{ display:'flex', alignItems:'center', background:'rgba(255,255,255,0.06)', borderRadius:8, padding:'8px 12px', border:'1px solid rgba(255,255,255,0.1)', marginBottom:14 }}>
              <Search size={14} color="#b3b3b3" style={{ marginRight:8, flexShrink:0 }}/>
              <input
                type="text"
                autoFocus
                placeholder="Search your library…"
                value={addQuery}
                onChange={e => setAddQuery(e.target.value)}
                style={{ background:'none', border:'none', color:'#fff', fontSize:13, width:'100%', outline:'none', WebkitUserSelect:'text', userSelect:'text' }}
              />
              {addQuery && (
                <button onClick={() => setAddQuery('')} style={{ background:'none', border:'none', color:'#b3b3b3', cursor:'pointer', display:'flex', padding:0 }}>
                  <X size={14}/>
                </button>
              )}
            </div>

            <div style={{ maxHeight:340, overflowY:'auto', display:'flex', flexDirection:'column', gap:2 }}>
              {addCandidates.length === 0 ? (
                <div className="sp-empty" style={{ padding:'40px 0' }}>
                  <p className="sp-empty-title" style={{ fontSize:14 }}>
                    {librarySongs.length === 0 ? 'Your library is empty'
                      : addQuery ? 'No matches found'
                      : 'All library songs are already here'}
                  </p>
                </div>
              ) : (
                addCandidates.map(s => (
                  <div
                    key={`add-${s.id}`}
                    style={{ display:'flex', alignItems:'center', gap:10, padding:'7px 10px', borderRadius:6, cursor:'pointer' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    onClick={() => addSongTo(s)}
                  >
                    {s.thumbnail
                      ? <img src={s.thumbnail} alt="" style={{ width:34, height:34, borderRadius:4, objectFit:'cover', flexShrink:0 }}/>
                      : <div style={{ width:34, height:34, borderRadius:4, background:'rgba(255,255,255,0.06)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}><Music size={14} color="#6a6a6a"/></div>
                    }
                    <div style={{ flex:1, minWidth:0 }}>
                      <p style={{ fontSize:13, fontWeight:600, color:'#fff', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{s.title}</p>
                      <p style={{ fontSize:11, color:'#b3b3b3', marginTop:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{s.artist || 'Unknown'}</p>
                    </div>
                    <button
                      onClick={e => { e.stopPropagation(); addSongTo(s); }}
                      title="Add"
                      style={{ display:'flex', alignItems:'center', gap:5, background:'none', border:'1px solid rgba(29,185,84,0.5)', color:'#1db954', padding:'5px 12px', borderRadius:99, cursor:'pointer', fontWeight:700, fontSize:11, flexShrink:0 }}
                    ><Plus size={12}/> Add</button>
                  </div>
                ))
              )}
            </div>

            <div className="sp-modal-footer">
              <button
                className="btn-green"
                onClick={() => setShowAdd(false)}
                style={{ padding:'10px 28px', fontSize:13, fontWeight:800, borderRadius:99 }}
              >Done</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
