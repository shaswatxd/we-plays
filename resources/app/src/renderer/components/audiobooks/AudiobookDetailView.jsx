import React, { useEffect, useState, useCallback } from 'react';
import {
  BookOpen, Play, Pause, AlertCircle, RotateCcw,
  Download, Trash2, PauseCircle, PlayCircle, CheckCircle2
} from 'lucide-react';
import { getAudiobookById, formatDuration, formatDurationLong } from '../../services/audiobookApi';
import { useAudiobookPlayerStore } from '../../store/audiobookPlayerStore';
import { useAudiobookStore } from '../../store/audiobookStore';
import SpotifyHeart from '../SpotifyHeart';

function hslFromStr(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  return `hsl(${Math.abs(hash) % 360}, 45%, 30%)`;
}

function ChapterRow({ book, chapter, index, isCurrent, isPlaying, download, onPlay, onDownload, onPause, onResume, onDelete }) {
  const status = download?.status;
  const pct = download && download.total_bytes ? Math.min(100, (download.downloaded_bytes / download.total_bytes) * 100) : 0;

  return (
    <div className={`ab-chapter-row${isCurrent ? ' active' : ''}`} onClick={() => onPlay(index)}>
      <div className="ab-chapter-num">
        {isCurrent && isPlaying
          ? <Pause size={14} />
          : isCurrent
            ? <Play size={14} />
            : <span>{index + 1}</span>}
      </div>
      <div className="ab-chapter-info">
        <p className="ab-chapter-title">{chapter.title}</p>
        {chapter.readers.length > 0 && <p className="ab-chapter-reader">Read by {chapter.readers.join(', ')}</p>}
      </div>
      <div className="ab-chapter-duration">{formatDuration(chapter.playtimeSecs)}</div>
      <div className="ab-chapter-actions" onClick={e => e.stopPropagation()}>
        {status === 'completed' ? (
          <>
            <span className="ab-dl-badge"><CheckCircle2 size={13}/> Downloaded</span>
            <button className="sp-icon-btn" title="Delete download" onClick={() => onDelete(index)}><Trash2 size={14}/></button>
          </>
        ) : status === 'downloading' ? (
          <>
            <div className="ab-dl-progress"><div className="ab-dl-progress-fill" style={{ width: `${pct}%` }} /></div>
            <span className="ab-dl-pct">{Math.round(pct)}%</span>
            <button className="sp-icon-btn" title="Pause download" onClick={() => onPause(index)}><PauseCircle size={16}/></button>
          </>
        ) : status === 'paused' ? (
          <>
            <span className="ab-dl-pct">{Math.round(pct)}%</span>
            <button className="sp-icon-btn" title="Resume download" onClick={() => onResume(index)}><PlayCircle size={16}/></button>
            <button className="sp-icon-btn" title="Cancel download" onClick={() => onDelete(index)}><Trash2 size={14}/></button>
          </>
        ) : (
          <button className="sp-icon-btn" title="Download chapter" onClick={() => onDownload(index)}><Download size={16}/></button>
        )}
      </div>
    </div>
  );
}

export default function AudiobookDetailView({ bookId, onBack }) {
  const [book, setBook] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [descExpanded, setDescExpanded] = useState(false);
  const [savedProgress, setSavedProgress] = useState(null);

  const { downloads, loadDownloads, toggleFavorite, isFavorite, loadFavorites } = useAudiobookStore();
  const { currentBook, chapterIndex, isPlaying, playBook, togglePlay } = useAudiobookPlayerStore();

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [b, progress] = await Promise.all([
        getAudiobookById(bookId),
        window.electronAPI?.audiobookGetProgress(bookId)
      ]);
      setBook(b);
      setSavedProgress(progress || null);
    } catch (err) {
      setError(err.message || 'Failed to load audiobook');
    } finally {
      setLoading(false);
    }
  }, [bookId]);

  useEffect(() => { load(); loadDownloads(); loadFavorites(); }, [load, loadDownloads, loadFavorites]);

  if (loading) return (
    <div style={{ padding: 24 }}>
      <div className="sp-shimmer" style={{ width:'100%', height:260, borderRadius:16, marginBottom:24 }} />
      {[...Array(6)].map((_, i) => (
        <div key={i} className="sp-shimmer" style={{ width:'100%', height:48, borderRadius:8, marginBottom:8 }} />
      ))}
    </div>
  );

  if (error) return (
    <div className="sp-empty" style={{ padding: 24 }}>
      <div className="sp-empty-icon" style={{ color:'#f15e6c' }}><AlertCircle size={32}/></div>
      <p className="sp-empty-title">Couldn't load audiobook</p>
      <p className="sp-empty-sub">{error}</p>
      <button className="sp-ghost-btn" style={{ marginTop:16 }} onClick={load}><RotateCcw size={14}/> Retry</button>
    </div>
  );

  if (!book) return null;

  const isCurrent = currentBook?.id === book.id;
  const fav = isFavorite(book.id);
  const totalStr = formatDurationLong(book.totalTimeSecs);
  const authorNames = book.authors.map(a => a.name).join(', ') || 'Unknown Author';

  const handlePlay = (idx = 0) => {
    if (isCurrent) { togglePlay(); return; }
    const startPos = savedProgress && savedProgress.chapter_index === idx ? savedProgress.position : 0;
    playBook(book, idx, startPos || 0);
  };

  const handleResumeOrStart = () => {
    if (isCurrent) { togglePlay(); return; }
    if (savedProgress) {
      playBook(book, savedProgress.chapter_index, savedProgress.position || 0);
    } else {
      playBook(book, 0, 0);
    }
  };

  const downloadFor = (idx) => downloads.find(d => String(d.book_id) === String(book.id) && d.chapter_index === idx);

  const startDownload = async (idx) => {
    const chapter = book.chapters[idx];
    window.electronAPI?.audiobookDownloadChapter({
      bookId: book.id, chapterIndex: idx, url: chapter.listenUrl,
      title: chapter.title, bookTitle: book.title, book
    });
  };

  const pauseDl = async (idx) => { await window.electronAPI?.audiobookPauseDownload(book.id, idx); loadDownloads(); };
  const resumeDl = async (idx) => startDownload(idx);
  const deleteDl = async (idx) => { await window.electronAPI?.audiobookDeleteDownload(book.id, idx); loadDownloads(); };

  const hasResumable = savedProgress && savedProgress.position > 3;

  return (
    <div>
      <div className="ab-hero" style={{ background: `linear-gradient(160deg, ${hslFromStr(book.title)}, #0a0a0f 85%)` }}>
        <button className="sp-ghost-btn" onClick={onBack} style={{ marginBottom:16, width:'fit-content', background:'rgba(0,0,0,0.3)', border:'none', color:'#fff' }}>← Back</button>
        <div style={{ display:'flex', gap:28, alignItems:'flex-end', flexWrap:'wrap' }}>
          <div className="ab-hero-cover">
            {book.coverArt
              ? <img src={book.coverArt} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }}/>
              : <div style={{ width:'100%',height:'100%',background:hslFromStr(book.title),display:'flex',alignItems:'center',justifyContent:'center' }}><BookOpen size={56} color="rgba(255,255,255,0.4)"/></div>}
          </div>
          <div style={{ flex: 1, minWidth: 240 }}>
            <p style={{ color:'#b3b3b3', fontSize:12, textTransform:'uppercase', fontWeight:700, letterSpacing:'0.1em' }}>Audiobook</p>
            <h1 style={{ fontSize:32, fontWeight:900, margin:'8px 0 6px', lineHeight:1.15 }}>{book.title}</h1>
            <p style={{ color:'#b3b3b3', fontSize:14 }}>{authorNames} · {book.language} · {book.chapters.length} chapters · {totalStr}</p>
            {book.genres.length > 0 && (
              <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginTop:12 }}>
                {book.genres.map(g => <span key={g.id} className="ab-genre-chip">{g.name}</span>)}
              </div>
            )}
            <div style={{ display:'flex', gap:12, marginTop:20, alignItems:'center' }}>
              <button className="sp-play-fab" onClick={handleResumeOrStart}>
                {isCurrent && isPlaying
                  ? <Pause size={22} fill="black" color="black"/>
                  : <Play size={22} fill="black" color="black" style={{ marginLeft:3 }}/>}
              </button>
              <button className={`sp-heart-btn${fav ? ' active' : ''}`} onClick={() => toggleFavorite(book)} title={fav ? 'Unfavorite' : 'Favorite'}>
                <SpotifyHeart size={20} active={fav} />
              </button>
              {hasResumable && (
                <span style={{ fontSize:12, color:'#b3b3b3' }}>
                  Resume Chapter {savedProgress.chapter_index + 1} at {formatDuration(savedProgress.position)}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      <div style={{ padding: '20px 24px 24px' }}>
        {book.description && (
          <div className="ab-description" style={{ marginBottom: 24 }}>
            <p className={descExpanded ? '' : 'ab-description-clamp'}>{book.description}</p>
            {book.description.length > 260 && (
              <button className="ab-desc-toggle" onClick={() => setDescExpanded(v => !v)}>
                {descExpanded ? 'Show less' : 'Show more'}
              </button>
            )}
          </div>
        )}

        <p style={{ fontSize: 15, fontWeight: 800, marginBottom: 12 }}>Chapters</p>
        <div className="ab-chapters-list">
          {book.chapters.map((chapter, idx) => (
            <ChapterRow
              key={chapter.id}
              book={book}
              chapter={chapter}
              index={idx}
              isCurrent={isCurrent && chapterIndex === idx}
              isPlaying={isPlaying}
              download={downloadFor(idx)}
              onPlay={handlePlay}
              onDownload={startDownload}
              onPause={pauseDl}
              onResume={resumeDl}
              onDelete={deleteDl}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
