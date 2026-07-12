import React, { useState, useEffect, Suspense, lazy } from 'react';
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
import GlobalSearchView from './components/GlobalSearchView';
import ShortcutsModal from './components/ShortcutsModal';
import StatsView    from './components/StatsView';
import LyricsView   from './components/LyricsView';
import YouTubeSearchView from './components/YouTubeSearchView';
import UpdateBanner from './components/UpdateBanner';

// Audiobooks are code-split: none of their JS loads (and no LibriVox
// requests fire) until the user actually opens the Audiobooks view.
const AudiobooksView = lazy(() => import('./components/audiobooks/AudiobooksView'));
const AudiobookPlayerBar = lazy(() => import('./components/audiobooks/AudiobookPlayerBar'));
import { useActivePlayerStore } from './store/activePlayerStore';
import { useAudiobookPlayerStore } from './store/audiobookPlayerStore';

export default function App() {
  const [view,       setView]       = useState('search');
  const [playlistId, setPlaylistId] = useState(null);
  const [showPanel,  setShowPanel]  = useState(false);
  const [rightPanelTab, setRightPanelTab] = useState('queue');
  const [showLyrics, setShowLyrics] = useState(false);
  const [dlSong,     setDlSong]     = useState(null);
  const [toast,      setToast]      = useState(null);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [globalSearchQuery, setGlobalSearchQuery] = useState('');
  const [missingBins, setMissingBins] = useState(null); // { ytdlp: bool, ffmpeg: bool }
  const [dragging, setDragging] = useState(false);
  const dragCounter = React.useRef(0);
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

  // Backend backfills missing durations for local imports in the background
  // on startup; refresh the library once that's done.
  useEffect(() => {
    return window.electronAPI?.onLibraryChanged?.(() => {
      useLibraryStore.getState().loadLibrary();
    });
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
      useDownloadStore.getState().completeDownload(d.id, { songId: d.songId, filePath: d.metadata?.file_path });
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

  const handleDragEnter = React.useCallback((e) => {
    e.preventDefault();
    if (!e.dataTransfer?.types?.includes('Files')) return;
    dragCounter.current++;
    setDragging(true);
  }, []);

  const handleDragLeave = React.useCallback((e) => {
    e.preventDefault();
    dragCounter.current = Math.max(0, dragCounter.current - 1);
    if (dragCounter.current === 0) setDragging(false);
  }, []);

  const handleDrop = React.useCallback(async (e) => {
    e.preventDefault();
    dragCounter.current = 0;
    setDragging(false);
    if (!window.electronAPI) return;
    // File.path no longer exists in the renderer; resolve real disk paths
    // via the preload webUtils bridge (with a fallback for older builds).
    const files = Array.from(e.dataTransfer.files)
      .map(f => {
        try { return window.electronAPI.getPathForFile?.(f) || f.path; }
        catch { return f.path; }
      })
      .filter(Boolean);
    if (files.length === 0) {
      window.showToast?.('Could not read the dropped files', 'error');
      return;
    }

    // Import into the library first (files already there resolve to their
    // existing song ids, so re-drops don't create duplicates).
    const imported = await window.electronAPI.importFiles(files);
    if (!imported || imported.length === 0) {
      window.showToast?.('No valid audio files found — drop song files, not folders', 'error');
      return;
    }

    // Where the drop landed decides what happens next.
    if (view === 'favorites') {
      const before = await window.electronAPI.getAllSongs();
      const favIds = new Set((before || []).filter(s => s.is_favorite).map(s => s.id));
      let added = 0;
      for (const s of imported) {
        if (favIds.has(s.id)) continue;
        await window.electronAPI.toggleFavorite(s.id);
        added++;
      }
      const dup = imported.length - added;
      await useLibraryStore.getState().loadLibrary();
      if (added === 0) {
        window.showToast?.(imported.length === 1
          ? `"${imported[0].title}" is already in Liked Songs`
          : 'All dropped songs are already in Liked Songs', 'info');
      } else {
        window.showToast?.(`Added ${added} song${added > 1 ? 's' : ''} to Liked Songs${dup ? ` (${dup} already there)` : ''}`, 'success');
      }
    } else if (view === 'playlist' && playlistId && playlistId !== 'favorites' && playlistId !== 'recent') {
      const beforeSongs = await window.electronAPI.getPlaylistSongs(playlistId) || [];
      for (const s of imported) {
        await window.electronAPI.addToPlaylist(playlistId, s.id);
      }
      // Backend silently skips songs already in the playlist (by id or same
      // title+artist), so measure what actually changed for honest feedback.
      const afterSongs = await window.electronAPI.getPlaylistSongs(playlistId) || [];
      const added = afterSongs.length - beforeSongs.length;
      const dup = imported.length - added;
      const plName = useLibraryStore.getState().playlists.find(p => p.id === playlistId)?.name || 'playlist';
      await useLibraryStore.getState().loadPlaylistSongs(playlistId);
      useLibraryStore.getState().loadLibrary();
      if (added === 0) {
        window.showToast?.(imported.length === 1
          ? `"${imported[0].title}" is already in ${plName}`
          : `All dropped songs are already in ${plName}`, 'info');
      } else {
        window.showToast?.(`Added ${added} song${added > 1 ? 's' : ''} to ${plName}${dup ? ` (${dup} already there)` : ''}`, 'success');
      }
    } else {
      useLibraryStore.getState().loadLibrary();
      window.showToast?.(`Imported ${imported.length} song${imported.length > 1 ? 's' : ''} into your library`, 'success');
    }
  }, [view, playlistId]);

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
      case 'stats':       return <StatsView />;
      case 'audiobooks':  return <AudiobooksView />;
      case 'ytsearch':    return <YouTubeSearchView onDownloadTrigger={setDlSong} />;
      default:            return <SearchView   onDownloadTrigger={setDlSong} />;
    }
  }, [view, playlistId, globalSearchQuery, openPlaylist]);

  const toastColor = { success: '#1db954', error: '#f15e6c', info: 'rgba(255,255,255,0.4)', warning: '#f59e0b' };

  return (
    <div className="app-shell" onDragOver={handleDragOver} onDrop={handleDrop} onDragEnter={handleDragEnter} onDragLeave={handleDragLeave}>
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
            <Suspense fallback={null}>
              {renderView()}
            </Suspense>
          </div>
        </div>
        {showPanel && <SpRightPanel onClose={() => setShowPanel(false)} initialTab={rightPanelTab} />}
      </div>
      {/* The music player bar stays mounted at all times so its Howl/audio
          logic keeps running regardless of visibility. The audiobook bar only
          mounts once a book has been opened (audiobookCurrentBook is never
          cleared back to null, so its Howl instance survives player switches);
          before that it would just idle and tick timers for nothing. */}
      {audiobookCurrentBook && (
        <div style={{ display: activePlayer === 'audiobook' ? 'block' : 'none' }}>
          <Suspense fallback={null}>
            <AudiobookPlayerBar onOpenBook={() => setView('audiobooks')} />
          </Suspense>
        </div>
      )}
      <div style={{ display: activePlayer === 'audiobook' && audiobookCurrentBook ? 'none' : 'block' }}>
        <SpPlayerBar
          onToggleLyrics={() => setShowLyrics(l => !l)}
        />
      </div>
      {showLyrics && <LyricsView onClose={() => setShowLyrics(false)} />}
      {dlSong && (
        <DownloadModal song={dlSong} onClose={() => setDlSong(null)} onStarted={() => { setRightPanelTab('downloads'); setShowPanel(true); }} />
      )}
      {showShortcuts && <ShortcutsModal onClose={() => setShowShortcuts(false)} />}

      {/* Drag & drop import overlay */}
      {dragging && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 9998, pointerEvents: 'none',
          background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <div style={{
            border: '2px dashed #1db954', borderRadius: 20,
            padding: '48px 64px', textAlign: 'center',
            background: 'rgba(29,185,84,0.06)', maxWidth: 420
          }}>
            <div style={{ fontSize: 44, marginBottom: 12 }}>🎵</div>
            <p style={{ fontSize: 18, fontWeight: 800, color: '#fff', margin: 0 }}>Drop your song here</p>
            <p style={{ fontSize: 13, color: '#b3b3b3', marginTop: 8 }}>
              {view === 'favorites'
                ? 'It will be added to Liked Songs'
                : view === 'playlist' && playlistId && playlistId !== 'favorites' && playlistId !== 'recent'
                  ? `It will be added to "${useLibraryStore.getState().playlists.find(p => p.id === playlistId)?.name || 'this playlist'}"`
                  : 'It will be imported into your library'}
              <br/>MP3 · FLAC · WAV · M4A · OGG &amp; more
            </p>
          </div>
        </div>
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

