import React, { useState, useEffect, useCallback } from 'react';
import { useLibraryStore } from './store/libraryStore';
import { useDownloadStore } from './store/downloadStore';
import { usePlayerStore } from './store/playerStore';

import SpSidebar    from './components/SpSidebar';
import SpPlayerBar  from './components/SpPlayerBar';
import SpTopBar     from './components/SpTopBar';
import SpRightPanel from './components/SpRightPanel';
import SpWindowControls from './components/SpWindowControls';

import SearchView   from './components/SearchView';
import PlaylistView from './components/PlaylistView';
import SettingsView from './components/SettingsView';
import DownloadModal from './components/DownloadModal';
import Visualizer   from './components/Visualizer';
import GlobalSearchView from './components/GlobalSearchView';
import SmartPlaylistsView from './components/SmartPlaylistsView';
import BookmarksView from './components/BookmarksView';
import ShortcutsModal from './components/ShortcutsModal';
import ArtistView   from './components/ArtistView';
import AlbumView    from './components/AlbumView';
import StatsView    from './components/StatsView';
import LyricsView   from './components/LyricsView';

export default function App() {
  const [view,       setView]       = useState('search');
  const [playlistId, setPlaylistId] = useState(null);
  const [showPanel,  setShowPanel]  = useState(false);
  const [showVis,    setShowVis]    = useState(false);
  const [showLyrics, setShowLyrics] = useState(false);
  const [dlSong,     setDlSong]     = useState(null);
  const [toast,      setToast]      = useState(null);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [globalSearchQuery, setGlobalSearchQuery] = useState('');
  const toastRef = React.useRef(null);

  const { loadLibrary, loadPlaylists, loadSettings } = useLibraryStore();

  useEffect(() => {
    loadLibrary();
    loadPlaylists();
    loadSettings();
  }, []);

  useEffect(() => {
    const scrollEl = document.querySelector('.sp-main-scroll');
    if (scrollEl) {
      scrollEl.scrollTop = 0;
    }
  }, [view]);

  useEffect(() => {
    if (!window.electronAPI) return;
    const cleanProgress = window.electronAPI.onDownloadProgress(d => {
      useDownloadStore.getState().updateProgress(d.id, d);
    });
    const cleanComplete = window.electronAPI.onDownloadComplete(d => {
      useDownloadStore.getState().completeDownload(d.id);
      useLibraryStore.getState().loadLibrary();
      window.showToast?.('Download complete!', 'success');
    });
    const cleanError = window.electronAPI.onDownloadError(d => {
      useDownloadStore.getState().errorDownload(d.id, d.error);
      window.showToast?.(`Download failed: ${d.error}`, 'error');
    });
    return () => { cleanProgress?.(); cleanComplete?.(); cleanError?.(); };
  }, []);

  useEffect(() => {
    window.showToast = (msg, type = 'info') => {
      clearTimeout(toastRef.current);
      setToast({ msg, type });
      toastRef.current = setTimeout(() => setToast(null), 3000);
    };
    return () => { window.showToast = null; clearTimeout(toastRef.current); };
  }, []);

  const openPlaylist = React.useCallback((id) => { setPlaylistId(id); setView('playlist'); }, []);

  useEffect(() => {
    const handler = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      const key = e.key;
      const ctrl = e.ctrlKey || e.metaKey;

      if (key === ' ' && !ctrl) { e.preventDefault(); usePlayerStore.getState().togglePlay(); }
      if (key === 'n' || key === 'N') { e.preventDefault(); usePlayerStore.getState().nextTrack(true); }
      if (key === 'p' || key === 'P') { e.preventDefault(); usePlayerStore.getState().previousTrack(); }
      if (key === 'm' || key === 'M') { e.preventDefault(); usePlayerStore.getState().toggleMute(); }
      if (key === 's' || key === 'S') { e.preventDefault(); usePlayerStore.getState().toggleShuffle(); }
      if (key === 'r' || key === 'R') { e.preventDefault(); usePlayerStore.getState().toggleRepeat(); }
      if (ctrl && key === 'f') { e.preventDefault(); document.querySelector('.sp-search-input')?.focus(); }
      if (ctrl && key === 'l') { e.preventDefault(); setView('search'); }
      if (ctrl && key === 'd') { e.preventDefault(); setDlSong(usePlayerStore.getState().currentSong); }
      if (key === '?' || (key === '/' && e.shiftKey)) { e.preventDefault(); setShowShortcuts(v => !v); }
      if (key === 'Escape') { setShowShortcuts(false); setShowVis(false); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);



  const handleDragOver = React.useCallback((e) => { e.preventDefault(); }, []);

  const handleDrop = React.useCallback(async (e) => {
    e.preventDefault();
    if (!window.electronAPI) return;
    const files = Array.from(e.dataTransfer.files).map(f => f.path).filter(Boolean);
    if (files.length === 0) return;
    window.showToast?.('Importing files...', 'info');
    const imported = await window.electronAPI.importFiles(files);
    if (imported && imported.length > 0) {
      window.showToast?.(`Imported ${imported.length} files`, 'success');
      useLibraryStore.getState().loadLibrary();
    } else {
      window.showToast?.('No valid audio files found', 'error');
    }
  }, []);

  const handleGlobalSearch = React.useCallback((query) => {
    setGlobalSearchQuery(query);
    setView('globalsearch');
  }, []);

  const renderView = React.useCallback(() => {
    switch (view) {
      case 'search':      return <SearchView   onDownloadTrigger={setDlSong} />;
      case 'favorites':   return <PlaylistView playlistId="favorites" onDownloadTrigger={setDlSong} onViewChange={setView} />;
      case 'recent':      return <PlaylistView playlistId="recent"    onDownloadTrigger={setDlSong} onViewChange={setView} />;
      case 'playlist':    return <PlaylistView playlistId={playlistId} onDownloadTrigger={setDlSong} onViewChange={setView} />;
      case 'settings':    return <SettingsView />;
      case 'globalsearch':return <GlobalSearchView query={globalSearchQuery} onDownloadTrigger={setDlSong} onViewChange={setView} onPlaylistSelect={openPlaylist} />;
      case 'smart':       return <SmartPlaylistsView onDownloadTrigger={setDlSong} onViewChange={setView} onPlaylistSelect={openPlaylist} />;
      case 'bookmarks':   return <BookmarksView onDownloadTrigger={setDlSong} />;
      case 'artists':     return <ArtistView />;
      case 'albums':      return <AlbumView />;
      case 'stats':       return <StatsView />;
      default:            return <SearchView   onDownloadTrigger={setDlSong} />;
    }
  }, [view, playlistId, globalSearchQuery, openPlaylist]);

  const toastColor = { success: '#1db954', error: '#f15e6c', info: 'rgba(255,255,255,0.4)', warning: '#f59e0b' };

  return (
    <div className="app-shell" onDragOver={handleDragOver} onDrop={handleDrop}>
      <div className="app-header-row">
        <SpTopBar
          view={view}
          showPanel={showPanel}
          onTogglePanel={() => setShowPanel(v => !v)}
          onGlobalSearch={handleGlobalSearch}
          scrolled={false}
        />
        <SpWindowControls />
      </div>
      <div className="app-body">
        <SpSidebar
          view={view}
          onViewChange={setView}
          onPlaylistSelect={openPlaylist}
          playlistId={playlistId}
        />
        <div className="sp-main sp-dynamic-theme">
          <div className="sp-main-scroll">
            {renderView()}
          </div>
        </div>
        {showPanel && <SpRightPanel onClose={() => setShowPanel(false)} />}
      </div>
      <SpPlayerBar
        onToggleVis={() => setShowVis(!showVis)}
        onToggleLyrics={() => setShowLyrics(l => !l)}
      />
      {showVis && <Visualizer onClose={() => setShowVis(false)} />}
      {showLyrics && <LyricsView onClose={() => setShowLyrics(false)} />}
      {dlSong && (
        <DownloadModal song={dlSong} onClose={() => setDlSong(null)} />
      )}
      {showShortcuts && <ShortcutsModal onClose={() => setShowShortcuts(false)} />}
      {toast && (
        <div
          className="sp-toast"
          style={{ borderLeft: `3px solid ${toastColor[toast.type] || toastColor.info}` }}
        >
          {toast.msg}
        </div>
      )}
    </div>
  );
}
