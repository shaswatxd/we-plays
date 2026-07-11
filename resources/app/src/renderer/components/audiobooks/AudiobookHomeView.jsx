import React, { useEffect, useState } from 'react';
import { BookOpen, AlertCircle, RotateCcw } from 'lucide-react';
import { searchAudiobooks, AUDIOBOOK_GENRES, formatDuration } from '../../services/audiobookApi';
import { useAudiobookStore } from '../../store/audiobookStore';
import { useAudiobookPlayerStore } from '../../store/audiobookPlayerStore';
import AudiobookCard from './AudiobookCard';

const FEATURED_GENRES = ['Fiction', 'Adventure', 'Mystery', 'Science Fiction', 'History', "Children's Fiction"];

function ContinueListeningStrip({ items, onOpenBook }) {
  const { playBook } = useAudiobookPlayerStore();
  if (items.length === 0) return null;
  return (
    <div style={{ marginBottom: 32 }}>
      <p style={{ fontSize: 20, fontWeight: 800, marginBottom: 14 }}>Continue Listening</p>
      <div className="ab-continue-row">
        {items.map(item => {
          const pct = item.duration > 0 ? Math.min(100, (item.position / item.duration) * 100) : 0;
          return (
            <div key={item.book.id} className="ab-continue-card" onClick={() => onOpenBook(item.book.id)}>
              <div className="ab-continue-cover">
                {item.book.coverArtThumbnail
                  ? <img src={item.book.coverArtThumbnail} alt="" />
                  : <div style={{ width:'100%',height:'100%',display:'flex',alignItems:'center',justifyContent:'center' }}><BookOpen size={24} color="rgba(255,255,255,0.4)"/></div>}
                <button className="ab-continue-play" onClick={e => { e.stopPropagation(); playBook(item.book, item.chapterIndex, item.position); }}>▶</button>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p className="ab-continue-title">{item.book.title}</p>
                <p className="ab-continue-sub">Chapter {item.chapterIndex + 1} · {formatDuration(item.position)} left</p>
                <div className="ab-continue-progress"><div className="ab-continue-progress-fill" style={{ width: `${pct}%` }} /></div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function AudiobookHomeView({ onOpenBook, onBrowseGenre }) {
  const { continueListening, loadContinueListening } = useAudiobookStore();
  const { playBook } = useAudiobookPlayerStore();
  const [featured, setFeatured] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = async () => {
    setLoading(true); setError(null);
    try {
      const { books } = await searchAudiobooks({ offset: 0, limit: 18 });
      setFeatured(books);
    } catch (err) {
      setError(err.message || 'Failed to load audiobooks');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); loadContinueListening(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom: 24 }}>
        <BookOpen size={24} color="#1db954" />
        <h1 style={{ fontSize: 28, fontWeight: 900 }}>Audiobooks</h1>
        <span style={{ color:'#6a6a6a', fontSize: 13 }}>Free classics from LibriVox</span>
      </div>

      <ContinueListeningStrip items={continueListening} onOpenBook={onOpenBook} />

      <div style={{ marginBottom: 28 }}>
        <p style={{ fontSize: 20, fontWeight: 800, marginBottom: 14 }}>Browse by Genre</p>
        <div className="ab-genre-grid">
          {FEATURED_GENRES.map((g, i) => (
            <button key={g} className="sp-cat-card" style={{ background: `linear-gradient(135deg, hsl(${(i * 63) % 360},55%,42%), hsl(${(i * 63 + 40) % 360},55%,20%))` }} onClick={() => onBrowseGenre(g)}>
              <span className="sp-cat-name">{g}</span>
              <span className="sp-cat-emoji"><BookOpen size={18} /></span>
            </button>
          ))}
        </div>
      </div>

      <div>
        <p style={{ fontSize: 20, fontWeight: 800, marginBottom: 14 }}>Discover Audiobooks</p>
        {loading && (
          <div className="sp-album-grid">
            {[...Array(12)].map((_, i) => (
              <div key={i}>
                <div className="sp-shimmer" style={{ width:'100%', aspectRatio:'1', borderRadius:8, marginBottom:8 }} />
                <div className="sp-shimmer" style={{ width:'80%', height:13, marginBottom:6 }} />
                <div className="sp-shimmer" style={{ width:'50%', height:11 }} />
              </div>
            ))}
          </div>
        )}
        {!loading && error && (
          <div className="sp-empty">
            <div className="sp-empty-icon" style={{ color:'#f15e6c' }}><AlertCircle size={32}/></div>
            <p className="sp-empty-title">Couldn't load catalog</p>
            <p className="sp-empty-sub">{error}</p>
            <button className="sp-ghost-btn" style={{ marginTop:16 }} onClick={load}><RotateCcw size={14}/> Retry</button>
          </div>
        )}
        {!loading && !error && (
          <div className="sp-album-grid">
            {featured.map(book => (
              <AudiobookCard key={book.id} book={book} onOpen={onOpenBook} onPlay={(b) => playBook(b, 0, 0)} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
