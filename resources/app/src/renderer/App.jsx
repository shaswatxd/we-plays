import React, { useState, useEffect, useCallback } from 'react';
import { useLibraryStore } from './store/libraryStore';
import { useDownloadStore } from './store/downloadStore';
import { usePlayerStore } from './store/playerStore';
import { useAudiobookStore } from './store/audiobookStore';

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
import FingerprintModal from './components/FingerprintModal';
import AudiobooksView from './components/audiobooks/AudiobooksView';
import YouTubeSearchView from './components/YouTubeSearchView';
import UpdateBanner from './components/UpdateBanner';
import AudiobookPlayerBar from './components/audiobooks/AudiobookPlayerBar';
import { useActivePlayerStore } from './store/activePlayerStore';
import { useAudiobookPlayerStore } from './store/audiobookPlayerStore';

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
  const [missingBins, setMissingBins] = useState(null); // { ytdlp: bool, ffmpeg: bool }
  const [fpSong, setFpSong] = useState(null);
  const toastRef = React.useRef(null);

  const { loadLibrary, loadPlaylists, loadSettings } = useLibraryStore();
  const activePlayer = useActivePlayerStore(s => s.active);
  const audiobookCurrentBook = useAudiobookPlayerStore(s => s.currentBook);

  useEffect(() => {
    loadLibrary();
    loadPlaylists();
    loadSettings();
    // Check if yt-dlp / ffmpeg are available
    if (window.electronAPI?.getYtdlpVersion && window.electronAPI?.getFfmpegPath) {
      Promise.all([
        window.electronAPI.getYtdlpVersion().catch(() => null),
        window.electronAPI.getFfmpegPath().catch(() => null)
      ]).then(([ytdlp, ffmpeg]) => {
        const missingYt = !ytdlp || ytdlp === 'Not installed' || ytdlp === 'Unknown';
        const missingFf = !ffmpeg || ffmpeg === 'Not found';
        if (missingYt || missingFf) {
          setMissingBins({ ytdlp: missingYt, ffmpeg: missingFf });
        }
      });
    }
  }, []);

  // Sync player state → tray (animated icon + dynamic Play/Pause label)
  useEffect(() => {
    if (!window.electronAPI?.updateTrayPlayState) return;
    let prevPlaying = null;
    let prevSongId = null;
    const unsub = usePlayerStore.subscribe((state) => {
      const { isPlaying, currentSong } = state;
      if (isPlaying !== prevPlaying || currentSong?.id !== prevSongId) {
        prevPlaying = isPlaying;
        prevSongId = currentSong?.id;
        window.electronAPI.updateTrayPlayState(isPlaying, currentSong ? {
          title: currentSong.title,
          artist: currentSong.artist
        } : null);
      }
    });
    // Fire immediately with current state
    const { isPlaying, currentSong } = usePlayerStore.getState();
    prevPlaying = isPlaying;
    prevSongId = currentSong?.id;
    window.electronAPI.updateTrayPlayState(isPlaying, currentSong ? {
      title: currentSong.title,
      artist: currentSong.artist
    } : null);
    return unsub;
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
    if (!window.electronAPI) return;
    const cleanProgress = window.electronAPI.onAudiobookDownloadProgress(d => {
      useAudiobookStore.getState().updateDownloadProgress(d);
    });
    const cleanComplete = window.electronAPI.onAudiobookDownloadComplete(d => {
      useAudiobookStore.getState().markDownloadStatus(d.bookId, d.chapterIndex, 'completed');
      window.showToast?.(`Downloaded: ${d.title || 'Chapter'}`, 'success');
    });
    const cleanError = window.electronAPI.onAudiobookDownloadError(d => {
      useAudiobookStore.getState().markDownloadStatus(d.bookId, d.chapterIndex, 'error');
      window.showToast?.(`Audiobook download failed: ${d.message}`, 'error');
    });
    return () => { cleanProgress?.(); cleanComplete?.(); cleanError?.(); };
  }, []);

  useEffect(() => {
    window.showToast = (msg, type = 'info') => {
      clearTimeout(toastRef.current);
      setToast({ msg, type });
      toastRef.current = setTimeout(() => setToast(null), 3000);
    };
    window.showFingerprintModal = (song) => setFpSong(song);
    return () => { window.showToast = null; window.showFingerprintModal = null; clearTimeout(toastRef.current); };
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
      case 'audiobooks':  return <AudiobooksView />;
      case 'ytsearch':    return <YouTubeSearchView onDownloadTrigger={setDlSong} />;
      default:            return <SearchView   onDownloadTrigger={setDlSong} />;
    }
  }, [view, playlistId, globalSearchQuery, openPlaylist]);

  const toastColor = { success: '#1db954', error: '#f15e6c', info: 'rgba(255,255,255,0.4)', warning: '#f59e0b' };

  return (
    <div className="app-shell" onDragOver={handleDragOver} onDrop={handleDrop}>
      <UpdateBanner />
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
      {/* Both player bars stay mounted at all times so their Howl/audio logic
          keeps running regardless of which one is visible — only one is
          ever playing at once (mutual exclusion is handled in the stores),
          but unmounting the inactive bar would kill its ability to react
          to a new play command. */}
      <div style={{ display: activePlayer === 'audiobook' && audiobookCurrentBook ? 'block' : 'none' }}>
        <AudiobookPlayerBar onOpenBook={() => setView('audiobooks')} />
      </div>
      <div style={{ display: activePlayer === 'audiobook' && audiobookCurrentBook ? 'none' : 'block' }}>
        <SpPlayerBar
          onToggleVis={() => setShowVis(!showVis)}
          onToggleLyrics={() => setShowLyrics(l => !l)}
        />
      </div>
      {showVis && <Visualizer onClose={() => setShowVis(false)} />}
      {showLyrics && <LyricsView onClose={() => setShowLyrics(false)} />}
      {dlSong && (
        <DownloadModal song={dlSong} onClose={() => setDlSong(null)} />
      )}
      {showShortcuts && <ShortcutsModal onClose={() => setShowShortcuts(false)} />}
      {fpSong && (
        <FingerprintModal
          song={fpSong}
          onClose={() => setFpSong(null)}
          onApplyTags={async (tags) => {
            if (fpSong?.id && tags) {
              await window.electronAPI?.updateSongMetadata?.(fpSong.id, tags);
              useLibraryStore.getState().loadLibrary();
              window.showToast?.('Tags updated!', 'success');
            }
            setFpSong(null);
          }}
        />
      )}
      {toast && (
        <div
          className="sp-toast"
          style={{ borderLeft: `3px solid ${toastColor[toast.type] || toastColor.info}` }}
        >
          {toast.msg}
        </div>
      )}

      {/* Missing Dependencies Modal */}
      {missingBins && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 9999,
          background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <div style={{
            background: '#161616', border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: 16, padding: '32px 36px', maxWidth: 480, width: '90%',
            boxShadow: '0 24px 80px rgba(0,0,0,0.6)', position: 'relative'
          }}>
            <button
              onClick={() => setMissingBins(null)}
              style={{ position: 'absolute', top: 16, right: 16, background: 'none', border: 'none', color: '#666', cursor: 'pointer', fontSize: 20, lineHeight: 1 }}
            >✕</button>

            <div style={{ fontSize: 32, marginBottom: 12 }}>⚠️</div>
            <h2 style={{ margin: '0 0 8px', fontSize: 17, color: '#fff', fontWeight: 700 }}>
              Missing Dependencies
            </h2>
            <p style={{ margin: '0 0 16px', fontSize: 13, color: '#999', lineHeight: 1.6 }}>
              The downloader won't work because the following tools are missing:
            </p>

            <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
              {missingBins.ytdlp && (
                <span style={{ background: 'rgba(241,94,108,0.15)', border: '1px solid rgba(241,94,108,0.4)', color: '#f15e6c', padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600 }}>
                  ✕ yt-dlp not found
                </span>
              )}
              {missingBins.ffmpeg && (
                <span style={{ background: 'rgba(241,94,108,0.15)', border: '1px solid rgba(241,94,108,0.4)', color: '#f15e6c', padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600 }}>
                  ✕ FFmpeg not found
                </span>
              )}
            </div>

            <p style={{ margin: '0 0 20px', fontSize: 13, color: '#aaa', lineHeight: 1.6 }}>
              Download and run <strong style={{ color: '#fff' }}>install-deps.bat</strong> from our website. It will automatically install yt-dlp &amp; FFmpeg and add them to your system PATH.
            </p>

            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <a
                href="https://website-nine-tau-67.vercel.app/#dependencies"
                target="_blank"
                rel="noreferrer"
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 7,
                  background: '#1db954', color: '#000', fontWeight: 700,
                  fontSize: 13, padding: '10px 20px', borderRadius: 10,
                  textDecoration: 'none', cursor: 'pointer'
                }}
              >
                ↗ Go to Website & Download
              </a>
              <button
                onClick={() => setMissingBins(null)}
                style={{
                  background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)',
                  color: '#aaa', fontWeight: 600, fontSize: 13,
                  padding: '10px 20px', borderRadius: 10, cursor: 'pointer'
                }}
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

