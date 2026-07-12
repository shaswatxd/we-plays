import React, { useState } from 'react';
import { useLibraryStore } from '../store/libraryStore';
import {
  Home, Search, Library, History, Settings,
  Plus, FolderInput, Music, Trash2, ListMusic,
  BarChart2, Play
} from 'lucide-react';
import SpotifyHeart from './SpotifyHeart';

export default function SpSidebar({ view, onViewChange, onPlaylistSelect, playlistId }) {
  const { playlists, createPlaylist, deletePlaylist, importFolder } = useLibraryStore();
  const [showInput,  setShowInput]  = useState(false);
  const [plName,     setPlName]     = useState('');
  const [delTarget,  setDelTarget]  = useState(null);

  const createPl = async () => {
    if (!plName.trim()) return;
    await createPlaylist(plName.trim());
    setPlName(''); setShowInput(false);
    window.showToast?.('Playlist created!', 'success');
  };

  const importDir = async () => {
    const res = await importFolder();
    if (res) window.showToast?.(`Imported "${res.playlistName}" — ${res.songs.length} songs`, 'success');
  };

  const doDelete = async () => {
    await deletePlaylist(delTarget.id);
    setDelTarget(null);
    window.showToast?.('Playlist deleted', 'info');
  };

  const navItems = [
    { id: 'ytsearch',    label: 'YouTube Search',   Icon: Play      },
    { id: 'recent',      label: 'Recently Played', Icon: History   },
    { id: 'stats',       label: 'Stats',           Icon: BarChart2 },
  ];

  return (
    <>
      <div className="sp-sidebar">
        {/* Library block */}
        <div className="sp-library-block">
          <div className="sp-library-header">
            <span className="sp-library-title">
              <Library size={20} /> Your Library
            </span>
            <div className="sp-library-actions">
              <button className="sp-icon-btn" title="Import Folder" onClick={importDir}>
                <FolderInput size={18} />
              </button>
              <button className="sp-icon-btn" title="Create Playlist" onClick={() => setShowInput(v => !v)}>
                <Plus size={18} />
              </button>
            </div>
          </div>

          {showInput && (
            <div className="sp-playlist-input">
              <div className="sp-playlist-input-box">
                <input
                  type="text"
                  value={plName}
                  onChange={e => setPlName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') createPl(); if (e.key === 'Escape') setShowInput(false); }}
                  placeholder="Playlist name…"
                  autoFocus
                />
                <button
                  style={{ background: '#1db954', border: 'none', color: '#000', fontWeight: 800, fontSize: 11, padding: '5px 12px', borderRadius: 99, cursor: 'pointer' }}
                  onClick={createPl}
                >
                  Create
                </button>
              </div>
            </div>
          )}

          <div className="sp-playlist-list">
            {/* All Songs */}
            <div
              className={`sp-playlist-item${view === 'allsongs' ? ' active' : ''}`}
              onClick={() => onViewChange('allsongs')}
            >
              <div className="sp-playlist-thumb" style={{ background: 'rgba(29,185,84,0.15)' }}>
                <ListMusic size={18} color="#1db954" />
              </div>
              <div className="sp-playlist-info">
                <p className="sp-playlist-name">All Songs</p>
                <p className="sp-playlist-sub">Library</p>
              </div>
            </div>

            {/* Special items */}
            <div
              className={`sp-playlist-item${view === 'favorites' ? ' active' : ''}`}
              onClick={() => onViewChange('favorites')}
            >
              <div className="sp-playlist-thumb" style={{ background: 'linear-gradient(135deg,#450af5,#c4efd9)' }}>
                <SpotifyHeart size={18} active={true} style={{ color: 'white' }} />
              </div>
              <div className="sp-playlist-info">
                <p className="sp-playlist-name">Liked Songs</p>
                <p className="sp-playlist-sub">Playlist</p>
              </div>
            </div>

            {playlists.map(pl => {
              const isActive = view === 'playlist' && playlistId === pl.id;
              return (
                <div
                  key={pl.id}
                  className={`sp-playlist-item${isActive ? ' active' : ''}`}
                  onClick={() => onPlaylistSelect(pl.id)}
                >
                  <div className="sp-playlist-thumb">
                    <Music size={18} color="#b3b3b3" />
                  </div>
                  <div className="sp-playlist-info">
                    <p className="sp-playlist-name">{pl.name}</p>
                    <p className="sp-playlist-sub">Playlist</p>
                  </div>
                  <button
                    className="sp-delete-btn"
                    title="Delete playlist"
                    onClick={e => { e.stopPropagation(); setDelTarget(pl); }}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              );
            })}

            {playlists.length === 0 && (
              <p style={{ fontSize: 12, color: '#6a6a6a', textAlign: 'center', padding: '24px 0' }}>
                No playlists yet
              </p>
            )}
          </div>

        </div>

        {/* Top nav */}
        <div className="sp-nav-block scrollable">
          {navItems.map(({ id, label, Icon }) => (
            <button
              key={id}
              className={`sp-nav-item${view === id ? ' active' : ''}`}
              onClick={() => onViewChange(id)}
            >
              <span className="sp-nav-icon"><Icon size={17} /></span>
              {label}
            </button>
          ))}
        </div>

        {/* Settings at bottom */}
        <div className="sp-nav-block" style={{ paddingTop: 0 }}>
          <button
            className={`sp-nav-item${view === 'settings' ? ' active' : ''}`}
            onClick={() => onViewChange('settings')}
          >
            <span className="sp-nav-icon"><Settings size={17} /></span>
            Settings
          </button>
        </div>
      </div>

      {/* Delete Playlist Confirm */}
      {delTarget && (
        <div className="sp-modal-bg" onClick={() => setDelTarget(null)}>
          <div className="sp-modal" onClick={e => e.stopPropagation()}>
            <div className="sp-modal-header">
              <span className="sp-modal-title">Delete Playlist</span>
            </div>
            <p style={{ color: '#b3b3b3', fontSize: 14, lineHeight: 1.6 }}>
              Are you sure you want to delete <strong style={{ color: '#fff' }}>{delTarget.name}</strong>?
              Songs will remain in your library.
            </p>
            <div className="sp-modal-footer">
              <button
                style={{ background: 'none', border: '1px solid rgba(255,255,255,0.2)', color: '#b3b3b3', padding: '10px 20px', borderRadius: 99, cursor: 'pointer', fontWeight: 700, fontSize: 13 }}
                onClick={() => setDelTarget(null)}
              >Cancel</button>
              <button
                style={{ background: '#e91429', border: 'none', color: '#fff', padding: '10px 24px', borderRadius: 99, cursor: 'pointer', fontWeight: 700, fontSize: 13 }}
                onClick={doDelete}
              >Delete</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
