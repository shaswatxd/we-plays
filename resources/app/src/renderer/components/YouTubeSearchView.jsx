import React, { useEffect, useState, useRef, useCallback } from 'react';
import { usePlayerStore } from '../store/playerStore';
import SpSongRow from './SpSongRow';
import { Search, AlertCircle, ChevronDown, Loader2, Play } from 'lucide-react';

const CATEGORIES = [
  { name: 'Top Hits', bg: 'linear-gradient(135deg,#e91e8c,#9c1f5e)', emoji: '🎤' },
  { name: 'Hip-Hop', bg: 'linear-gradient(135deg,#f59e0b,#b45309)', emoji: '🎧' },
  { name: 'Bollywood', bg: 'linear-gradient(135deg,#ef4444,#7f1d1d)', emoji: '🎬' },
  { name: 'Lofi Beats', bg: 'linear-gradient(135deg,#8b5cf6,#4c1d95)', emoji: '☕' },
  { name: 'Rock Classics', bg: 'linear-gradient(135deg,#64748b,#1e293b)', emoji: '🎸' },
  { name: 'Workout', bg: 'linear-gradient(135deg,#f97316,#c2410c)', emoji: '💪' },
  { name: 'Arijit Singh', bg: 'linear-gradient(135deg,#6366f1,#312e81)', emoji: '🎵' },
  { name: 'Pop', bg: 'linear-gradient(135deg,#ec4899,#be185d)', emoji: '⭐' },
  { name: 'Jazz & Blues', bg: 'linear-gradient(135deg,#d97706,#78350f)', emoji: '🎷' },
  { name: 'Chill Vibes', bg: 'linear-gradient(135deg,#10b981,#065f46)', emoji: '🌿' },
  { name: 'EDM', bg: 'linear-gradient(135deg,#3b82f6,#1e3a8a)', emoji: '⚡' },
  { name: 'Devotional', bg: 'linear-gradient(135deg,#f59e0b,#92400e)', emoji: '🙏' },
];

export default function YouTubeSearchView({ onDownloadTrigger }) {
  const { playPlaylist } = usePlayerStore();
  const [results, setResults] = useState([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const scrollRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const doSearch = useCallback(async (q, pageNum = 1) => {
    if (!q || q.trim().length < 2) return;
    setLoading(true); setError(null); setResults([]); setPage(1); setHasMore(true);
    try {
      const res = await window.electronAPI?.searchYouTubePaginated(q, pageNum);
      setResults(res || []);
      setHasMore((res || []).length === 10);
    } catch (err) {
      setError(err.message || 'Search failed');
    } finally { setLoading(false); }
  }, []);

  const onKey = (e) => {
    if (e.key === 'Enter') doSearch(query);
  };

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore || !query) return;
    setLoadingMore(true);
    try {
      const nextPage = page + 1;
      const res = await window.electronAPI?.searchYouTubePaginated(query, nextPage);
      if (res && res.length > 0) {
        setResults(prev => [...prev, ...res]);
        setPage(nextPage);
        setHasMore(res.length === 10);
      } else {
        setHasMore(false);
      }
    } catch (err) {
      console.error('Load more failed:', err);
    } finally { setLoadingMore(false); }
  }, [query, page, loadingMore, hasMore]);

  useEffect(() => {
    const el = scrollRef.current?.closest('.sp-main-scroll');
    if (!el) return;
    const handleScroll = () => {
      if (el.scrollTop + el.clientHeight >= el.scrollHeight - 200) {
        loadMore();
      }
    };
    el.addEventListener('scroll', handleScroll);
    return () => el.removeEventListener('scroll', handleScroll);
  }, [loadMore]);

  const searchCategory = (q) => {
    setQuery(q);
    doSearch(q);
  };

  if (loading) return (
    <div ref={scrollRef} style={{ padding: 24 }}>
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <div style={{ background: 'linear-gradient(135deg,#ff0000,#cc0000)', borderRadius: 8, padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Play size={16} fill="white" color="white" />
            <span style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>YouTube</span>
          </div>
        </div>
        <div style={{ position: 'relative' }}>
          <Search className="sp-search-icon" size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#6a6a6a' }} />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={onKey}
            placeholder="Search YouTube..."
            style={{
              width: '100%', padding: '12px 16px 12px 40px',
              background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 8, color: '#fff', fontSize: 14, outline: 'none', boxSizing: 'border-box'
            }}
          />
        </div>
      </div>
      <p style={{ fontSize: 22, fontWeight: 800, marginBottom: 20 }}>Searching for "{query}"...</p>
      {[...Array(8)].map((_, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0' }}>
          <div className="sp-shimmer" style={{ width: 36, height: 16, flexShrink: 0 }} />
          <div className="sp-shimmer" style={{ width: 40, height: 40, borderRadius: 4, flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <div className="sp-shimmer" style={{ width: '40%', height: 13, marginBottom: 6 }} />
            <div className="sp-shimmer" style={{ width: '25%', height: 11 }} />
          </div>
          <div className="sp-shimmer" style={{ width: 36, height: 12 }} />
        </div>
      ))}
    </div>
  );

  if (error) return (
    <div className="sp-empty" style={{ padding: 24 }}>
      <div className="sp-empty-icon" style={{ color: '#f15e6c' }}><AlertCircle size={32} /></div>
      <p className="sp-empty-title">Search failed</p>
      <p className="sp-empty-sub">{error}</p>
    </div>
  );

  if (results.length > 0) return (
    <div ref={scrollRef} style={{ padding: 24 }}>
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <div style={{ background: 'linear-gradient(135deg,#ff0000,#cc0000)', borderRadius: 8, padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Play size={16} fill="white" color="white" />
            <span style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>YouTube</span>
          </div>
        </div>
        <div style={{ position: 'relative', marginBottom: 20 }}>
          <Search className="sp-search-icon" size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#6a6a6a' }} />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={onKey}
            placeholder="Search YouTube..."
            style={{
              width: '100%', padding: '12px 16px 12px 40px',
              background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 8, color: '#fff', fontSize: 14, outline: 'none', boxSizing: 'border-box'
            }}
          />
        </div>
        <p style={{ fontSize: 24, fontWeight: 900, color: '#fff', letterSpacing: '-0.02em', lineHeight: 1.2 }}>
          Results for <span style={{ color: '#ff0000' }}>"{query}"</span>
        </p>
        <p style={{ fontSize: 12, color: '#6a6a6a', marginTop: 4 }}>{results.length} tracks found on YouTube</p>
      </div>
      <div className="sp-table-header">
        <span>#</span>
        <span>Title</span>
        <span>Views</span>
        <span>Upload Date</span>
        <span style={{ justifyContent: 'flex-end', paddingRight: 24 }}>Action</span>
      </div>
      {results.map((s, i) => (
        <SpSongRow
          key={s.id || i}
          song={s}
          index={i}
          isSearchItem={true}
          onDownloadTrigger={onDownloadTrigger}
          onClick={() => playPlaylist(results.map(r => ({ ...r, file_path: r.url, isFromSearch: true })), i)}
        />
      ))}
      {loadingMore && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 20 }}>
          <Loader2 size={20} style={{ animation: 'spin 0.8s linear infinite', color: '#ff0000' }} />
        </div>
      )}
      {hasMore && !loadingMore && (
        <button className="sp-ghost-btn" style={{ margin: '16px auto', display: 'flex' }} onClick={loadMore}>
          <ChevronDown size={16} /> Load More
        </button>
      )}
    </div>
  );

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <div style={{ background: 'linear-gradient(135deg,#ff0000,#cc0000)', borderRadius: 8, padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 6 }}>
          <Play size={16} fill="white" color="white" />
          <span style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>YouTube</span>
        </div>
      </div>
      <div style={{ position: 'relative', marginBottom: 24 }}>
        <Search className="sp-search-icon" size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#6a6a6a' }} />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={onKey}
          placeholder="Search YouTube..."
          style={{
            width: '100%', padding: '12px 16px 12px 40px',
            background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 8, color: '#fff', fontSize: 14, outline: 'none', boxSizing: 'border-box'
          }}
        />
      </div>
      <p style={{ fontSize: 22, fontWeight: 800, marginBottom: 20 }}>Browse categories</p>
      <div className="sp-cat-grid">
        {CATEGORIES.map(c => (
          <button
            key={c.name}
            className="sp-cat-card"
            style={{ background: c.bg }}
            onClick={() => searchCategory(c.name)}
          >
            <span className="sp-cat-name">{c.name}</span>
            <span className="sp-cat-emoji">{c.emoji}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
