import React, { useEffect, useRef, useState } from 'react';
import { usePlayerStore } from '../store/playerStore';
import { Music2, RefreshCw, ExternalLink } from 'lucide-react';

function parseLRC(lrc) {
  return lrc
    .split('\n')
    .map(line => {
      const m = line.match(/^\[(\d+):(\d+(?:\.\d+)?)\](.*)/);
      if (!m) return null;
      const time = parseInt(m[1]) * 60 + parseFloat(m[2]);
      return { time, text: m[3].trim() };
    })
    .filter(Boolean)
    .filter(l => l.text.length > 0);
}

export default function LyricsView({ onClose }) {
  const { currentSong, progress } = usePlayerStore();
  const [lyrics, setLyrics]       = useState(null);  // null=loading, []=[]=not found, [{time,text}]=synced, string=plain
  const [error, setError]         = useState('');
  const [loading, setLoading]     = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const activeRef = useRef(null);
  const containerRef = useRef(null);
  const lastSongRef = useRef('');

  const fetchLyrics = async (song) => {
    if (!song) return;
    setLoading(true); setError(''); setLyrics(null);
    try {
      const params = new URLSearchParams({
        track_name: song.title || '',
        artist_name: song.artist || '',
        ...(song.duration ? { duration: Math.round(song.duration) } : {})
      });
      const res = await fetch(`https://lrclib.net/api/get?${params}`);
      if (!res.ok) { setLyrics([]); return; }
      const data = await res.json();
      if (data.syncedLyrics) {
        setLyrics(parseLRC(data.syncedLyrics));
      } else if (data.plainLyrics) {
        setLyrics(data.plainLyrics);
      } else {
        setLyrics([]);
      }
    } catch(e) {
      setError('Failed to fetch lyrics. Check your internet connection.');
      setLyrics([]);
    } finally { setLoading(false); }
  };

  useEffect(() => {
    if (!currentSong) return;
    const key = `${currentSong.title}|${currentSong.artist}`;
    if (key === lastSongRef.current) return;
    lastSongRef.current = key;
    fetchLyrics(currentSong);
  }, [currentSong]);

  const isSynced = Array.isArray(lyrics) && lyrics.length > 0 && lyrics[0]?.time !== undefined;

  useEffect(() => {
    if (!isSynced) return;
    let idx = 0;
    for (let i = 0; i < lyrics.length; i++) {
      if (lyrics[i].time <= progress + 0.3) idx = i;
    }
    setActiveIdx(idx);
  }, [progress, lyrics, isSynced]);

  useEffect(() => {
    if (activeRef.current && containerRef.current) {
      activeRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [activeIdx]);

  return (
    <div className="sp-lyrics-overlay" onClick={onClose}>
      <div className="sp-lyrics-panel" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="sp-lyrics-header">
          <div className="sp-lyrics-song-info">
            {currentSong?.thumbnail
              ? <img src={currentSong.thumbnail} alt="" className="sp-lyrics-thumb" />
              : <div className="sp-lyrics-thumb sp-lyrics-thumb-ph"><Music2 size={20}/></div>
            }
            <div>
              <p className="sp-lyrics-title">{currentSong?.title || 'No song playing'}</p>
              <p className="sp-lyrics-artist">{currentSong?.artist || '—'}</p>
            </div>
          </div>
          <div style={{ display:'flex', gap:8 }}>
            <button
              className="sp-lyrics-action-btn"
              title="Refresh lyrics"
              onClick={() => { lastSongRef.current = ''; fetchLyrics(currentSong); }}
            >
              <RefreshCw size={15}/>
            </button>
            <a
              href={`https://lrclib.net`}
              target="_blank"
              rel="noreferrer"
              className="sp-lyrics-action-btn"
              title="LRCLIB — lyrics source"
              style={{ display:'flex', alignItems:'center', textDecoration:'none', color:'inherit' }}
            >
              <ExternalLink size={15}/>
            </a>
          </div>
        </div>

        {/* Body */}
        <div className="sp-lyrics-body" ref={containerRef}>
          {loading && (
            <div className="sp-lyrics-state">
              <div className="sp-lyrics-spinner"/>
              <p>Fetching lyrics…</p>
            </div>
          )}
          {!loading && error && (
            <div className="sp-lyrics-state">
              <p style={{ color:'#f15e6c' }}>{error}</p>
            </div>
          )}
          {!loading && !error && Array.isArray(lyrics) && lyrics.length === 0 && (
            <div className="sp-lyrics-state">
              <Music2 size={36} style={{ opacity:0.3, marginBottom:12 }}/>
              <p style={{ color:'#b3b3b3' }}>No lyrics found</p>
              <p style={{ color:'#6a6a6a', fontSize:11, marginTop:6 }}>Try searching on Genius or AZLyrics</p>
            </div>
          )}
          {!loading && isSynced && (
            <div className="sp-lyrics-lines">
              {lyrics.map((line, i) => (
                <p
                  key={i}
                  ref={i === activeIdx ? activeRef : null}
                  className={`sp-lyrics-line${i === activeIdx ? ' active' : i < activeIdx ? ' past' : ' future'}`}
                >
                  {line.text}
                </p>
              ))}
            </div>
          )}
          {!loading && !isSynced && typeof lyrics === 'string' && (
            <div className="sp-lyrics-plain">
              {lyrics.split('\n').map((line, i) => (
                <p key={i} className={line.trim() === '' ? 'sp-lyrics-gap' : 'sp-lyrics-plain-line'}>
                  {line || '\u00a0'}
                </p>
              ))}
            </div>
          )}
        </div>

        <div className="sp-lyrics-footer">
          <span>Powered by LRCLIB • Free & No Ads</span>
          {isSynced && <span style={{ color:'#1db954' }}>● Synced</span>}
          {!isSynced && typeof lyrics === 'string' && <span style={{ color:'#b3b3b3' }}>Plain text</span>}
        </div>
      </div>
    </div>
  );
}
