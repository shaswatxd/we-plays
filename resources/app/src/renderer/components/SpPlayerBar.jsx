import React, { useEffect, useRef, useState } from 'react';
import { usePlayerStore } from '../store/playerStore';
import { useLibraryStore } from '../store/libraryStore';
import {
  Play, Pause, SkipBack, SkipForward,
  Shuffle, Repeat, Volume2, VolumeX,
  Maximize2, Music, Mic2, Bookmark
} from 'lucide-react';
import { Howl } from 'howler';
import SpotifyHeart from './SpotifyHeart';

export default function SpPlayerBar({ onToggleVis, onToggleLyrics }) {
  const {
    currentSong, isPlaying, volume, isMuted,
    progress, duration, isShuffled, repeatMode, gaplessEnabled,
    setHowl, togglePlay, nextTrack, previousTrack,
    seekTo, setVolume, toggleMute, toggleShuffle,
    toggleRepeat, setProgress, setDuration, toggleGapless,
    playTrigger, isManualTransition
  } = usePlayerStore();

  const { toggleFavorite, settings } = useLibraryStore();
  const howlRef = useRef(null);
  const fadingHowlsRef = useRef([]);
  const prevTriggerRef = useRef(0);
  const crossfadingRef = useRef(false);
  const CROSSFADE_MS = 3000;
  const CROSSFADE_SEC = 3;
  const eqFiltersRef = useRef({ low: null, mid: null, high: null });
  const [showBookmarkModal, setShowBookmarkModal] = useState(false);
  const [bookmarkLabel, setBookmarkLabel] = useState('');
  const [showEq, setShowEq] = useState(false);

  /* ── Playback ── */
  const playSong = async (song, isManual = false) => {
    const currentTrigger = usePlayerStore.getState().playTrigger;

    // Clear all previously fading howls on manual song changes
    if (isManual) {
      fadingHowlsRef.current.forEach(h => {
        try {
          h.stop();
          h.unload();
        } catch (e) {
          console.error('Error unloading fading Howl:', e);
        }
      });
      fadingHowlsRef.current = [];
    }

    if (howlRef.current) {
      const oldHowl = howlRef.current;
      oldHowl.off('end');
      if (isManual) {
        oldHowl.stop();
        oldHowl.unload();
      } else {
        oldHowl.fade(isMuted ? 0 : volume, 0, CROSSFADE_MS);
        fadingHowlsRef.current.push(oldHowl);
        setTimeout(() => {
          try {
            oldHowl.unload();
          } catch (e) {
            console.error('Error unloading old Howl:', e);
          }
          fadingHowlsRef.current = fadingHowlsRef.current.filter(h => h !== oldHowl);
        }, CROSSFADE_MS);
      }
      howlRef.current = null;
      setHowl(null);
    }
    
    crossfadingRef.current = false;
    let src = song.file_path;
    
    if (song.isFromSearch) {
      usePlayerStore.setState({ isPlaying: false });
      window.showToast?.('Loading stream...', 'info');
      try {
        src = await window.electronAPI?.getStreamUrl(song.url);
      } catch (e) {
        window.showToast?.('Failed to load stream', 'error');
        return;
      }
    } else {
      if (src && !src.startsWith('local-media://')) {
        const normalized = src.replace(/\\/g, '/');
        src = `local-media://local-file/${encodeURI(normalized)}`;
      }
    }
    
    if (!src) return;

    // Check if another song was requested while we were waiting for the stream
    if (currentTrigger !== usePlayerStore.getState().playTrigger) return;

    const h = new Howl({
      src: [src],
      format: song.format ? [song.format] : (song.isFromSearch ? ['webm', 'm4a', 'mp3'] : undefined),
      html5: true,
      volume: isMuted ? 0 : volume,
      onplay:  () => { setDuration(h.duration()); usePlayerStore.setState({ isPlaying: true }); },
      onpause: () => usePlayerStore.setState({ isPlaying: false }),
      onend:   () => nextTrack(),
      onload:  () => setDuration(h.duration()),
      onloaderror: (_, e) => { console.error('Load error', e); window.showToast?.('Failed to load audio', 'error'); },
    });

    howlRef.current = h;
    setHowl(h);

    // Connect to EQ filters via Web Audio API
    try {
      if (h._sounds && h._sounds[0] && h._sounds[0]._node) {
        const audioNode = h._sounds[0]._node;
        const audioCtx = audioNode.context || h._sounds[0]._parent?._ctx;
        if (audioCtx && audioNode.connect) {
          // Disconnect existing connections
          try { audioNode.disconnect(); } catch(_) {}
          
          const low = audioCtx.createBiquadFilter();
          low.type = 'lowshelf';
          low.frequency.value = 320;
          const { eq } = usePlayerStore.getState();
          low.gain.value = eq.low || 0;
          
          const mid = audioCtx.createBiquadFilter();
          mid.type = 'peaking';
          mid.frequency.value = 1000;
          mid.Q.value = 0.7;
          mid.gain.value = eq.mid || 0;
          
          const high = audioCtx.createBiquadFilter();
          high.type = 'highshelf';
          high.frequency.value = 3200;
          high.gain.value = eq.high || 0;
          
          audioNode.connect(low);
          low.connect(mid);
          mid.connect(high);
          high.connect(audioCtx.destination);
          
          eqFiltersRef.current = { low, mid, high };
        }
      }
    } catch (e) {
      console.error('EQ connection error:', e);
    }
    
    // Play/fade-in based on manual trigger, only if play state is active
    const isCurrentlyPlaying = usePlayerStore.getState().isPlaying;
    const { gaplessEnabled } = usePlayerStore.getState();
    if (isCurrentlyPlaying) {
      if (isManual || gaplessEnabled) {
        h.play();
      } else {
        h.volume(0);
        h.play();
        h.fade(0, isMuted ? 0 : volume, CROSSFADE_MS);
      }
    } else {
      h.volume(isMuted ? 0 : volume);
    }
  };

  useEffect(() => {
    if (currentSong && playTrigger !== prevTriggerRef.current) {
      prevTriggerRef.current = playTrigger;
      playSong(currentSong, isManualTransition);
    }
  }, [playTrigger, currentSong, isManualTransition]);

  useEffect(() => {
    if (isPlaying) {
      if (howlRef.current && !howlRef.current.playing()) {
        howlRef.current.play();
      }
    } else {
      if (howlRef.current) {
        howlRef.current.pause();
      }
      // Silencing fading Howls immediately when player is paused
      fadingHowlsRef.current.forEach(h => {
        try {
          h.stop();
          h.unload();
        } catch (e) {
          console.error('Error stopping fading Howl:', e);
        }
      });
      fadingHowlsRef.current = [];
    }
  }, [isPlaying]);

  useEffect(() => {
    if (howlRef.current) howlRef.current.volume(isMuted ? 0 : volume);
  }, [volume, isMuted]);

  // Progress ticker
  useEffect(() => {
    const id = setInterval(() => {
      if (howlRef.current?.playing()) {
        const cur = howlRef.current.seek();
        setProgress(cur);

        const { gaplessEnabled } = usePlayerStore.getState();
        // Auto crossfade trigger (only when gapless is disabled and duration is meaningful)
        if (!gaplessEnabled && duration > CROSSFADE_SEC && (duration - cur) <= CROSSFADE_SEC && !crossfadingRef.current) {
          crossfadingRef.current = true;
          nextTrack();
        }
      }
    }, 150);
    return () => clearInterval(id);
  }, [setProgress, duration, nextTrack]);

  // Keyboard shortcuts
  useEffect(() => {
    const h = (e) => {
      if (e.target.tagName === 'INPUT') return;
      const { volume: vol, duration: dur } = usePlayerStore.getState();
      if (e.code === 'Space')      { e.preventDefault(); togglePlay(); }
      if (e.code === 'ArrowRight') seekTo(Math.min(dur, (howlRef.current?.seek() || 0) + 10));
      if (e.code === 'ArrowLeft')  seekTo(Math.max(0, (howlRef.current?.seek() || 0) - 10));
      if (e.code === 'ArrowUp')    { e.preventDefault(); setVolume(Math.min(1, vol + 0.05)); }
      if (e.code === 'ArrowDown')  { e.preventDefault(); setVolume(Math.max(0, vol - 0.05)); }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [togglePlay, seekTo, setVolume]);

  // Electron media keys
  useEffect(() => {
    if (!window.electronAPI) return;
    const cleanToggle = window.electronAPI.onPlayerTogglePlay?.(() => togglePlay());
    const cleanNext = window.electronAPI.onPlayerNext?.(() => nextTrack(true));
    const cleanPrev = window.electronAPI.onPlayerPrevious?.(() => previousTrack());
    return () => {
      cleanToggle?.();
      cleanNext?.();
      cleanPrev?.();
    };
  }, []);

  // Dynamic Theme Effect based on current playing song's thumbnail/art
  useEffect(() => {
    if (!currentSong) {
      document.documentElement.style.setProperty('--dynamic-theme-rgb', '29, 185, 84'); // Spotify green
      return;
    }

    const hslToRgb = (h, s, l) => {
      s /= 100;
      l /= 100;
      const k = n => (n + h / 30) % 12;
      const a = s * Math.min(l, 1 - l);
      const f = n => l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1));
      return {
        r: Math.round(255 * f(0)),
        g: Math.round(255 * f(8)),
        b: Math.round(255 * f(4))
      };
    };

    const hashStr = (str) => {
      let hash = 0;
      for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
      return Math.abs(hash);
    };

    const getFallbackColor = () => {
      const name = currentSong.artist || currentSong.title || 'We Plays';
      const h = hashStr(name) % 360;
      return hslToRgb(h, 55, 35);
    };

    const imgUrl = currentSong.thumbnail;
    if (!imgUrl) {
      const { r, g, b } = getFallbackColor();
      document.documentElement.style.setProperty('--dynamic-theme-rgb', `${r}, ${g}, ${b}`);
      return;
    }

    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = 1;
        canvas.height = 1;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, 1, 1);
        const data = ctx.getImageData(0, 0, 1, 1).data;
        // Verify we got a valid color
        if (data[3] > 0) {
          document.documentElement.style.setProperty('--dynamic-theme-rgb', `${data[0]}, ${data[1]}, ${data[2]}`);
        } else {
          const { r, g, b } = getFallbackColor();
          document.documentElement.style.setProperty('--dynamic-theme-rgb', `${r}, ${g}, ${b}`);
        }
      } catch (e) {
        const { r, g, b } = getFallbackColor();
        document.documentElement.style.setProperty('--dynamic-theme-rgb', `${r}, ${g}, ${b}`);
      }
    };
    img.onerror = () => {
      const { r, g, b } = getFallbackColor();
      document.documentElement.style.setProperty('--dynamic-theme-rgb', `${r}, ${g}, ${b}`);
    };
    img.src = imgUrl;
  }, [currentSong]);

  const fmt = (s) => {
    if (!s || isNaN(s)) return '0:00';
    return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
  };

  const pct    = duration > 0 ? (progress / duration) * 100 : 0;
  const volPct = (isMuted ? 0 : volume) * 100;
  const isFav  = currentSong?.is_favorite === 1;

  const handleFav = async () => {
    if (!currentSong?.id) return;
    const v = await toggleFavorite(currentSong.id);
    usePlayerStore.setState(s => ({
      currentSong: s.currentSong ? { ...s.currentSong, is_favorite: v } : null
    }));
  };

  const saveBookmark = async () => {
    if (!currentSong?.id) return;
    await window.electronAPI?.saveBookmark(currentSong.id, progress || 0, bookmarkLabel.trim() || null);
    window.showToast?.('Bookmark saved!', 'success');
    setShowBookmarkModal(false);
    setBookmarkLabel('');
  };

  return (
    <div className="sp-player">
      {/* ── Left: Now playing ── */}
      <div className="sp-player-left">
        {currentSong ? (
          <>
            <div className="sp-now-thumb" onClick={onToggleVis}>
              {currentSong.thumbnail
                ? <img src={currentSong.thumbnail} alt="" />
                : <div style={{ width:'100%',height:'100%',display:'flex',alignItems:'center',justifyContent:'center',color:'#6a6a6a' }}><Music size={20}/></div>
              }
            </div>
            <div className="sp-now-meta">
              <div className="sp-now-title" onClick={onToggleVis}>{currentSong.title}</div>
              <div className="sp-now-artist">{currentSong.artist || 'Unknown Artist'}</div>
            </div>
            <button
              className={`sp-heart-btn${isFav ? ' active' : ''}`}
              onClick={handleFav}
              title={isFav ? 'Unlike' : 'Like'}
              style={{ marginLeft: 12 }}
            >
              <SpotifyHeart size={16} active={isFav} />
            </button>
            {currentSong?.id && (
              <button
                className="sp-ctrl-btn"
                onClick={() => setShowBookmarkModal(true)}
                title="Save Bookmark"
                style={{ marginLeft: 4 }}
              >
                <Bookmark size={15} />
              </button>
            )}
          </>
        ) : (
          <div style={{ display:'flex', alignItems:'center', gap: 12 }}>
            <div style={{ width:56,height:56,borderRadius:4,background:'#2a2a2a',display:'flex',alignItems:'center',justifyContent:'center' }}>
              <Music size={20} color="#6a6a6a" />
            </div>
          </div>
        )}
      </div>

      {/* ── Center: Controls + Seek ── */}
      <div className="sp-player-center">
        <div className="sp-controls">
          <button
            className={`sp-ctrl-btn${isShuffled ? ' active' : ''}`}
            onClick={toggleShuffle}
            title="Shuffle"
          >
            <Shuffle size={16} />
          </button>
          <button className="sp-ctrl-btn" onClick={previousTrack} title="Previous">
            <SkipBack size={18} />
          </button>
          <button className="sp-play-btn" onClick={togglePlay}>
            {isPlaying
              ? <Pause size={16} fill="black" color="black" />
              : <Play  size={16} fill="black" color="black" style={{ marginLeft: 2 }} />
            }
          </button>
          <button className="sp-ctrl-btn" onClick={() => nextTrack(true)} title="Next">
            <SkipForward size={18} />
          </button>
          <button
            className={`sp-ctrl-btn${repeatMode !== 'off' ? ' active' : ''}`}
            onClick={toggleRepeat}
            title={`Repeat: ${repeatMode}`}
            style={{ position: 'relative' }}
          >
            <Repeat size={16} />
            {repeatMode === 'one' && (
              <span style={{
                position:'absolute', top:-2, right:-2,
                width:12, height:12, borderRadius:'50%',
                background:'#1db954', color:'#000',
                fontSize:7, fontWeight:900,
                display:'flex', alignItems:'center', justifyContent:'center'
              }}>1</span>
            )}
          </button>
        </div>

        {/* Progress */}
        <div className="sp-progress-row">
          <span className="sp-time">{fmt(progress)}</span>
          <div className="sp-progress-wrap">
            <div className="sp-progress-bg">
              <div className="sp-progress-fill" style={{ width: `${pct}%` }} />
            </div>
            <div className="sp-progress-thumb" style={{ left: `calc(${pct}% - 6px)` }} />
            <input
              className="sp-progress-input"
              type="range"
              min={0} max={duration || 100} step={0.1}
              value={progress}
              onChange={e => seekTo(parseFloat(e.target.value))}
            />
          </div>
          <span className="sp-time">{fmt(duration)}</span>
        </div>
      </div>

      {/* ── Right: Volume ── */}
      <div className="sp-player-right">
        <button
          className={`sp-ctrl-btn${gaplessEnabled ? ' active' : ''}`}
          onClick={toggleGapless}
          title={gaplessEnabled ? 'Gapless: ON' : 'Gapless: OFF (Crossfade)'}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M2 12h4l3-9 4 18 3-9h4"/>
          </svg>
        </button>
        <button
          className="sp-ctrl-btn"
          onClick={onToggleVis}
          title="Visualizer"
        >
          <Maximize2 size={16} />
        </button>
        <button className="sp-ctrl-btn" onClick={toggleMute}>
          {isMuted || volume === 0 ? <VolumeX size={18} /> : <Volume2 size={18} />}
        </button>
        <div className="sp-volume-wrap">
          <div className="sp-volume-track">
            <div className="sp-volume-bg">
              <div className="sp-volume-fill" style={{ width: `${volPct}%` }} />
            </div>
            <input
              className="sp-volume-input"
              type="range" min={0} max={1} step={0.01}
              value={isMuted ? 0 : volume}
              onChange={e => setVolume(parseFloat(e.target.value))}
            />
          </div>
        </div>
      </div>

      {/* Bookmark Modal */}
      {showBookmarkModal && currentSong && (
        <div className="sp-modal-bg" onClick={() => setShowBookmarkModal(false)}>
          <div className="sp-modal" style={{ maxWidth:380 }} onClick={e => e.stopPropagation()}>
            <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:16 }}>
              <div style={{ width:40,height:40,borderRadius:'50%',background:'rgba(29,185,84,0.12)',display:'flex',alignItems:'center',justifyContent:'center' }}>
                <Bookmark size={18} style={{ color:'#1db954' }}/>
              </div>
              <div>
                <p style={{ fontWeight:700, fontSize:15 }}>Save Bookmark</p>
                <p style={{ fontSize:12, color:'#b3b3b3', marginTop:2 }}>{currentSong.title}</p>
              </div>
            </div>
            <p style={{ fontSize:12, color:'#6a6a6a', marginBottom:8 }}>Position: {fmt(progress)}</p>
            <input
              type="text"
              placeholder="Label (optional)"
              value={bookmarkLabel}
              onChange={e => setBookmarkLabel(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') saveBookmark(); }}
              autoFocus
              style={{ width:'100%',background:'rgba(255,255,255,0.06)',border:'1px solid rgba(255,255,255,0.12)',color:'#fff',padding:'10px 14px',borderRadius:8,fontSize:13,outline:'none',marginBottom:16,boxSizing:'border-box' }}
            />
            <div style={{ display:'flex', justifyContent:'flex-end', gap:10 }}>
              <button
                style={{ background:'none',border:'1px solid rgba(255,255,255,0.2)',color:'#b3b3b3',padding:'10px 20px',borderRadius:99,cursor:'pointer',fontWeight:700,fontSize:13 }}
                onClick={() => { setShowBookmarkModal(false); setBookmarkLabel(''); }}
              >Cancel</button>
              <button
                style={{ background:'#1db954',border:'none',color:'#000',padding:'10px 24px',borderRadius:99,cursor:'pointer',fontWeight:700,fontSize:13,display:'flex',alignItems:'center',gap:8 }}
                onClick={saveBookmark}
              ><Bookmark size={14}/> Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
