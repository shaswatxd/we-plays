import React, { useEffect, useRef, useState } from 'react';
import { Howl } from 'howler';
import { useAudiobookPlayerStore, PLAYBACK_RATES } from '../../store/audiobookPlayerStore';
import { useAudiobookStore } from '../../store/audiobookStore';
import { formatDuration } from '../../services/audiobookApi';
import {
  Play, Pause, SkipBack, SkipForward, RotateCcw, RotateCw,
  Volume2, VolumeX, Gauge, Moon, Bookmark, BookOpen
} from 'lucide-react';
import SpotifyHeart from '../SpotifyHeart';

export default function AudiobookPlayerBar({ onOpenBook }) {
  const {
    currentBook, chapterIndex, isPlaying, progress, duration,
    volume, isMuted, playbackRate, sleepTimerEndAt, sleepTimerMinutes,
    startAtPosition, playTrigger, howl,
    setHowl, togglePlay, seekTo, skipBy, nextChapter, previousChapter,
    setVolume, toggleMute, setPlaybackRate, setSleepTimer,
    setProgress, setDuration, saveBookmark, persistProgress
  } = useAudiobookPlayerStore();

  const { toggleFavorite, isFavorite } = useAudiobookStore();

  const howlRef = useRef(null);
  const prevTriggerRef = useRef(0);
  const saveIntervalRef = useRef(null);
  const [showRateMenu, setShowRateMenu] = useState(false);
  const [showSleepMenu, setShowSleepMenu] = useState(false);
  const [showBookmarkModal, setShowBookmarkModal] = useState(false);
  const [bookmarkLabel, setBookmarkLabel] = useState('');

  const chapter = currentBook?.chapters?.[chapterIndex];

  useEffect(() => {
    if (!currentBook || !chapter || playTrigger === prevTriggerRef.current) return;
    prevTriggerRef.current = playTrigger;

    (async () => {
      if (howlRef.current) {
        howlRef.current.off('end');
        howlRef.current.stop();
        howlRef.current.unload();
        howlRef.current = null;
      }

      let src = chapter.listenUrl;
      try {
        const downloaded = await window.electronAPI?.audiobookIsDownloaded(currentBook.id, chapterIndex);
        if (downloaded) {
          const filePath = await window.electronAPI?.audiobookGetChapterPath(currentBook.id, chapterIndex);
          if (filePath) src = `local-media://local-file/${encodeURI(filePath.replace(/\\/g, '/'))}`;
        }
      } catch { /* fall back to remote URL */ }

      if (!src) return;
      if (playTrigger !== useAudiobookPlayerStore.getState().playTrigger) return;

      const h = new Howl({
        src: [src],
        html5: true,
        volume: isMuted ? 0 : volume,
        rate: playbackRate,
        onplay: () => {
          setDuration(h.duration());
          if (startAtPosition > 0) h.seek(startAtPosition);
          useAudiobookPlayerStore.setState({ isPlaying: true });
        },
        onpause: () => useAudiobookPlayerStore.setState({ isPlaying: false }),
        onend: () => nextChapter(),
        onload: () => setDuration(h.duration()),
        onloaderror: () => window.showToast?.('Failed to load audiobook audio', 'error'),
      });

      howlRef.current = h;
      setHowl(h);
      h.play();
    })();
  }, [playTrigger, currentBook, chapter, chapterIndex]);

  useEffect(() => {
    if (!howlRef.current) return;
    if (isPlaying && !howlRef.current.playing()) howlRef.current.play();
    if (!isPlaying && howlRef.current.playing()) howlRef.current.pause();
  }, [isPlaying]);

  useEffect(() => {
    if (howlRef.current) howlRef.current.volume(isMuted ? 0 : volume);
  }, [volume, isMuted]);

  useEffect(() => {
    if (howlRef.current) howlRef.current.rate(playbackRate);
  }, [playbackRate]);

  // Progress ticker
  useEffect(() => {
    const id = setInterval(() => {
      if (howlRef.current?.playing()) {
        setProgress(howlRef.current.seek());
      }
    }, 200);
    return () => clearInterval(id);
  }, [setProgress]);

  // Periodic position persistence (every 5s) + on unmount
  useEffect(() => {
    saveIntervalRef.current = setInterval(() => persistProgress(), 5000);
    return () => {
      clearInterval(saveIntervalRef.current);
      persistProgress();
    };
  }, [currentBook?.id, chapterIndex, persistProgress]);

  // Sleep timer countdown
  useEffect(() => {
    if (!sleepTimerEndAt) return;
    const id = setInterval(() => {
      if (Date.now() >= sleepTimerEndAt) {
        howlRef.current?.pause();
        useAudiobookPlayerStore.setState({ isPlaying: false });
        setSleepTimer(null);
        window.showToast?.('Sleep timer ended — playback paused', 'info');
      }
    }, 1000);
    return () => clearInterval(id);
  }, [sleepTimerEndAt, setSleepTimer]);

  if (!currentBook || !chapter) return null;

  const pct = duration > 0 ? (progress / duration) * 100 : 0;
  const volPct = (isMuted ? 0 : volume) * 100;
  const isFav = isFavorite(currentBook.id);

  const handleFav = async () => {
    await toggleFavorite(currentBook);
  };

  const doSaveBookmark = async () => {
    await saveBookmark(bookmarkLabel.trim());
    window.showToast?.('Bookmark saved!', 'success');
    setShowBookmarkModal(false);
    setBookmarkLabel('');
  };

  const applySleep = (minutes) => {
    setSleepTimer(minutes);
    setShowSleepMenu(false);
    window.showToast?.(minutes ? `Sleep timer set: ${minutes} min` : 'Sleep timer cancelled', 'info');
  };

  const sleepRemaining = sleepTimerEndAt ? Math.max(0, Math.ceil((sleepTimerEndAt - Date.now()) / 60000)) : null;

  return (
    <div className="sp-player ab-player">
      {/* ── Left: Now playing book ── */}
      <div className="sp-player-left">
        <div className="sp-now-thumb ab-now-thumb" onClick={() => onOpenBook?.(currentBook.id)}>
          {currentBook.coverArtThumbnail
            ? <img src={currentBook.coverArtThumbnail} alt="" />
            : <div style={{ width:'100%',height:'100%',display:'flex',alignItems:'center',justifyContent:'center',color:'#6a6a6a' }}><BookOpen size={20}/></div>
          }
        </div>
        <div className="sp-now-meta">
          <div className="sp-now-title" onClick={() => onOpenBook?.(currentBook.id)}>{currentBook.title}</div>
          <div className="sp-now-artist">{chapter.title}{sleepRemaining !== null && <span className="ab-sleep-badge"> · <Moon size={10}/> {sleepRemaining}m</span>}</div>
        </div>
        <button className={`sp-heart-btn${isFav ? ' active' : ''}`} onClick={handleFav} title={isFav ? 'Unfavorite' : 'Favorite'} style={{ marginLeft: 12 }}>
          <SpotifyHeart size={16} active={isFav} />
        </button>
        <button className="sp-ctrl-btn" onClick={() => setShowBookmarkModal(true)} title="Bookmark position" style={{ marginLeft: 4 }}>
          <Bookmark size={15} />
        </button>
      </div>

      {/* ── Center: Controls + Seek ── */}
      <div className="sp-player-center">
        <div className="sp-controls">
          <button className="sp-ctrl-btn" onClick={previousChapter} title="Previous chapter">
            <SkipBack size={17} />
          </button>
          <button className="sp-ctrl-btn" onClick={() => skipBy(-15)} title="Back 15s">
            <RotateCcw size={16} />
          </button>
          <button className="sp-play-btn" onClick={togglePlay}>
            {isPlaying
              ? <Pause size={16} fill="black" color="black" />
              : <Play size={16} fill="black" color="black" style={{ marginLeft: 2 }} />}
          </button>
          <button className="sp-ctrl-btn" onClick={() => skipBy(30)} title="Forward 30s">
            <RotateCw size={16} />
          </button>
          <button className="sp-ctrl-btn" onClick={nextChapter} title="Next chapter">
            <SkipForward size={17} />
          </button>
        </div>

        <div className="sp-progress-row">
          <span className="sp-time">{formatDuration(progress)}</span>
          <div className="sp-progress-wrap">
            <div className="sp-progress-bg"><div className="sp-progress-fill" style={{ width: `${pct}%` }} /></div>
            <div className="sp-progress-thumb" style={{ left: `calc(${pct}% - 6px)` }} />
            <input
              className="sp-progress-input"
              type="range" min={0} max={duration || 100} step={0.1}
              value={progress}
              onChange={e => seekTo(parseFloat(e.target.value))}
            />
          </div>
          <span className="sp-time">{formatDuration(duration)}</span>
        </div>
        <div className="ab-chapter-label">Chapter {chapterIndex + 1} of {currentBook.chapters.length}</div>
      </div>

      {/* ── Right: Speed / Sleep timer / Volume ── */}
      <div className="sp-player-right">
        <div className="ab-popover-wrap">
          <button className={`sp-ctrl-btn${playbackRate !== 1 ? ' active' : ''}`} onClick={() => { setShowRateMenu(v => !v); setShowSleepMenu(false); }} title="Playback speed">
            <Gauge size={16} /><span className="ab-rate-label">{playbackRate}x</span>
          </button>
          {showRateMenu && (
            <div className="ab-popover">
              {PLAYBACK_RATES.map(r => (
                <button key={r} className={`ab-popover-item${r === playbackRate ? ' active' : ''}`} onClick={() => { setPlaybackRate(r); setShowRateMenu(false); }}>
                  {r}x
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="ab-popover-wrap">
          <button className={`sp-ctrl-btn${sleepTimerEndAt ? ' active' : ''}`} onClick={() => { setShowSleepMenu(v => !v); setShowRateMenu(false); }} title="Sleep timer">
            <Moon size={16} />
          </button>
          {showSleepMenu && (
            <div className="ab-popover">
              {[5, 15, 30, 45, 60].map(m => (
                <button key={m} className={`ab-popover-item${sleepTimerMinutes === m ? ' active' : ''}`} onClick={() => applySleep(m)}>{m} min</button>
              ))}
              <button className="ab-popover-item" onClick={() => applySleep(null)}>Off</button>
            </div>
          )}
        </div>

        <button className="sp-ctrl-btn" onClick={toggleMute}>
          {isMuted || volume === 0 ? <VolumeX size={18} /> : <Volume2 size={18} />}
        </button>
        <div className="sp-volume-wrap">
          <div className="sp-volume-track">
            <div className="sp-volume-bg"><div className="sp-volume-fill" style={{ width: `${volPct}%` }} /></div>
            <input className="sp-volume-input" type="range" min={0} max={1} step={0.01} value={isMuted ? 0 : volume} onChange={e => setVolume(parseFloat(e.target.value))} />
          </div>
        </div>
      </div>

      {showBookmarkModal && (
        <div className="sp-modal-bg" onClick={() => setShowBookmarkModal(false)}>
          <div className="sp-modal" style={{ maxWidth: 380 }} onClick={e => e.stopPropagation()}>
            <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:16 }}>
              <div style={{ width:40,height:40,borderRadius:'50%',background:'rgba(29,185,84,0.12)',display:'flex',alignItems:'center',justifyContent:'center' }}>
                <Bookmark size={18} style={{ color:'#1db954' }}/>
              </div>
              <div>
                <p style={{ fontWeight:700, fontSize:15 }}>Save Bookmark</p>
                <p style={{ fontSize:12, color:'#b3b3b3', marginTop:2 }}>{currentBook.title} — {chapter.title}</p>
              </div>
            </div>
            <p style={{ fontSize:12, color:'#6a6a6a', marginBottom:8 }}>Position: {formatDuration(progress)}</p>
            <input
              type="text" placeholder="Label (optional)" value={bookmarkLabel}
              onChange={e => setBookmarkLabel(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') doSaveBookmark(); }}
              autoFocus
              style={{ width:'100%',background:'rgba(255,255,255,0.06)',border:'1px solid rgba(255,255,255,0.12)',color:'#fff',padding:'10px 14px',borderRadius:8,fontSize:13,outline:'none',marginBottom:16,boxSizing:'border-box' }}
            />
            <div style={{ display:'flex', justifyContent:'flex-end', gap:10 }}>
              <button style={{ background:'none',border:'1px solid rgba(255,255,255,0.2)',color:'#b3b3b3',padding:'10px 20px',borderRadius:99,cursor:'pointer',fontWeight:700,fontSize:13 }} onClick={() => { setShowBookmarkModal(false); setBookmarkLabel(''); }}>Cancel</button>
              <button style={{ background:'#1db954',border:'none',color:'#000',padding:'10px 24px',borderRadius:99,cursor:'pointer',fontWeight:700,fontSize:13,display:'flex',alignItems:'center',gap:8 }} onClick={doSaveBookmark}><Bookmark size={14}/> Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
