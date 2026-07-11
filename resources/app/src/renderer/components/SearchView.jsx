import React, { useEffect, useState, useRef, useCallback } from 'react';
import { usePlayerStore }  from '../store/playerStore';
import SpSongRow from './SpSongRow';
import { Search, AlertCircle, ChevronDown, Loader2, ListMusic, Music, History, Clock } from 'lucide-react';

const CATEGORIES = [
  { name: 'Top Hits',      bg:'linear-gradient(135deg,#e91e8c,#9c1f5e)', emoji:'🎤' },
  { name: 'Hip-Hop',       bg:'linear-gradient(135deg,#f59e0b,#b45309)', emoji:'🎧' },
  { name: 'Bollywood',     bg:'linear-gradient(135deg,#ef4444,#7f1d1d)', emoji:'🎬' },
  { name: 'Lofi Beats',    bg:'linear-gradient(135deg,#8b5cf6,#4c1d95)', emoji:'☕' },
  { name: 'Rock Classics', bg:'linear-gradient(135deg,#64748b,#1e293b)', emoji:'🎸' },
  { name: 'Workout',       bg:'linear-gradient(135deg,#f97316,#c2410c)', emoji:'💪' },
  { name: 'Arijit Singh',  bg:'linear-gradient(135deg,#6366f1,#312e81)', emoji:'🎵' },
  { name: 'Pop',           bg:'linear-gradient(135deg,#ec4899,#be185d)', emoji:'⭐' },
  { name: 'Jazz & Blues',  bg:'linear-gradient(135deg,#d97706,#78350f)', emoji:'🎷' },
  { name: 'Chill Vibes',   bg:'linear-gradient(135deg,#10b981,#065f46)', emoji:'🌿' },
  { name: 'EDM',           bg:'linear-gradient(135deg,#3b82f6,#1e3a8a)', emoji:'⚡' },
  { name: 'Devotional',    bg:'linear-gradient(135deg,#f59e0b,#92400e)', emoji:'🙏' },
];

export default function SearchView({ onDownloadTrigger }) {
  const { playPlaylist } = usePlayerStore();
  const [results, setResults] = useState([]);
  const [libraryResults, setLibraryResults] = useState(null);
  const [query,   setQuery]   = useState('');
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState(null);
  const [page,    setPage]    = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const scrollRef = useRef(null);

  useEffect(() => {
    const handler = async (e) => {
      const { query: q, mode: searchMode } = typeof e.detail === 'string' ? { query: e.detail, mode: 'youtube' } : e.detail;
      setQuery(q); setLoading(true); setError(null); setResults([]); setLibraryResults(null); setPage(1); setHasMore(true);
      try {
        const promises = [];
        if (searchMode === 'youtube' || searchMode === 'all') {
          promises.push(window.electronAPI?.searchYouTubePaginated(q, 1).then(r => ({ type: 'youtube', data: r || [] })));
        }
        if (searchMode === 'all') {
          promises.push(window.electronAPI?.searchGlobal(q).then(r => ({ type: 'library', data: r })));
        }
        const allResults = await Promise.all(promises);
        const ytResult = allResults.find(r => r.type === 'youtube');
        const libResult = allResults.find(r => r.type === 'library');
        if (ytResult) {
          setResults(ytResult.data);
          setHasMore(ytResult.data.length === 10);
        }
        if (libResult) {
          setLibraryResults(libResult.data);
        }
      } catch (err) {
        setError(err.message || 'Search failed');
      } finally { setLoading(false); }
    };
    window.addEventListener('sp-search', handler);
    return () => window.removeEventListener('sp-search', handler);
  }, []);

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

  const search = (q) => window.dispatchEvent(new CustomEvent('sp-search', { detail: { query: q, mode: 'youtube' } }));

  if (loading) return (
    <div ref={scrollRef} style={{ padding: 24 }}>
      <p style={{ fontSize:22, fontWeight:800, marginBottom:20 }}>Searching for "{query}"...</p>
      {[...Array(8)].map((_, i) => (
        <div key={i} style={{ display:'flex', alignItems:'center', gap:12, padding:'8px 0' }}>
          <div className="sp-shimmer" style={{ width:36,height:16,flexShrink:0 }} />
          <div className="sp-shimmer" style={{ width:40,height:40,borderRadius:4,flexShrink:0 }} />
          <div style={{ flex:1 }}>
            <div className="sp-shimmer" style={{ width:'40%',height:13,marginBottom:6 }} />
            <div className="sp-shimmer" style={{ width:'25%',height:11 }} />
          </div>
          <div className="sp-shimmer" style={{ width:36,height:12 }} />
        </div>
      ))}
    </div>
  );

  if (error) return (
    <div className="sp-empty" style={{ padding: 24 }}>
      <div className="sp-empty-icon" style={{ color:'#f15e6c' }}><AlertCircle size={32}/></div>
      <p className="sp-empty-title">Search failed</p>
      <p className="sp-empty-sub">{error}</p>
    </div>
  );

  const hasLibraryResults = libraryResults && (
    (libraryResults.songs?.length > 0) || (libraryResults.playlists?.length > 0) || (libraryResults.history?.length > 0)
  );

  if (query && results.length === 0 && !hasLibraryResults && !loading) return (
    <div className="sp-empty" style={{ padding: 24 }}>
      <div className="sp-empty-icon"><Search size={28}/></div>
      <p className="sp-empty-title">No results for "{query}"</p>
      <p className="sp-empty-sub">Try different keywords.</p>
    </div>
  );

  if (results.length > 0 || hasLibraryResults) return (
    <div ref={scrollRef} style={{ padding: 24 }}>
      <div style={{ marginBottom: 20 }}>
        <p style={{ fontSize: 24, fontWeight: 900, color: '#fff', letterSpacing: '-0.02em', lineHeight: 1.2 }}>
          Results for <span style={{ color: 'var(--sp-green)' }}>"{query}"</span>
        </p>
        <p style={{ fontSize: 12, color: '#6a6a6a', marginTop: 4 }}>
          {results.length > 0 && `${results.length} YouTube results`}
          {results.length > 0 && hasLibraryResults && ' • '}
          {hasLibraryResults && `${(libraryResults.songs?.length || 0) + (libraryResults.history?.length || 0)} library matches`}
        </p>
      </div>

      {/* Library Results */}
      {hasLibraryResults && (
        <div style={{ marginBottom: 28 }}>
          <div style={{ display:'flex',alignItems:'center',gap:8,marginBottom:12 }}>
            <Music size={16} color="#1db954"/>
            <p style={{ fontSize:14,fontWeight:700 }}>From Your Library</p>
          </div>

          {libraryResults.playlists?.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ display:'flex',alignItems:'center',gap:6,marginBottom:8 }}>
                <ListMusic size={14} color="#b3b3b3"/>
                <p style={{ fontSize:12,fontWeight:600,color:'#b3b3b3' }}>Playlists</p>
              </div>
              <div style={{ display:'flex',gap:8,flexWrap:'wrap' }}>
                {libraryResults.playlists.map(pl => (
                  <button
                    key={pl.id}
                    onClick={() => {
                      window.dispatchEvent(new CustomEvent('sp-open-playlist', { detail: pl.id }));
                    }}
                    style={{ display:'flex',alignItems:'center',gap:8,background:'rgba(255,255,255,0.06)',border:'1px solid rgba(255,255,255,0.08)',borderRadius:8,padding:'8px 12px',cursor:'pointer',color:'#fff',textAlign:'left' }}
                  >
                    <div style={{ width:32,height:32,borderRadius:4,background:'rgba(29,185,84,0.15)',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0 }}>
                      <Music size={14} color="#1db954"/>
                    </div>
                    <div>
                      <p style={{ fontSize:12,fontWeight:600 }}>{pl.name}</p>
                      <p style={{ fontSize:10,color:'#b3b3b3' }}>Playlist</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {libraryResults.songs?.length > 0 && (
            <div>
              <div className="sp-table-header">
                <span>#</span>
                <span>Title</span>
                <span>Album</span>
                <span>Date Added</span>
              </div>
              {libraryResults.songs.map((s, i) => (
                <SpSongRow
                  key={s.id}
                  song={s}
                  index={i}
                  isSearchItem={false}
                  onDownloadTrigger={onDownloadTrigger}
                  onClick={() => playPlaylist(libraryResults.songs, i)}
                />
              ))}
            </div>
          )}

          {libraryResults.history?.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <div style={{ display:'flex',alignItems:'center',gap:6,marginBottom:8 }}>
                <History size={14} color="#b3b3b3"/>
                <p style={{ fontSize:12,fontWeight:600,color:'#b3b3b3' }}>Recently Played</p>
              </div>
              <div className="sp-table-header">
                <span>#</span>
                <span>Title</span>
                <span>Album</span>
                <span>Last Played</span>
              </div>
              {libraryResults.history.map((s, i) => (
                <SpSongRow
                  key={`h-${s.id}`}
                  song={s}
                  index={i}
                  isSearchItem={false}
                  onDownloadTrigger={onDownloadTrigger}
                  onClick={() => playPlaylist(libraryResults.history, i)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* YouTube Results */}
      {results.length > 0 && (
        <div>
          <div style={{ display:'flex',alignItems:'center',gap:8,marginBottom:12 }}>
            <Search size={16} color="#1db954"/>
            <p style={{ fontSize:14,fontWeight:700 }}>From YouTube</p>
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
            <div style={{ display:'flex', justifyContent:'center', padding:20 }}>
              <Loader2 size={20} style={{ animation:'spin 0.8s linear infinite', color:'#1db954' }} />
            </div>
          )}
          {hasMore && !loadingMore && (
            <button className="sp-ghost-btn" style={{ margin:'16px auto', display:'flex' }} onClick={loadMore}>
              <ChevronDown size={16} /> Load More
            </button>
          )}
        </div>
      )}
    </div>
  );

  return (
    <div style={{ padding: 24 }}>
      <p style={{ fontSize:22, fontWeight:800, marginBottom:20 }}>Browse all</p>
      <div className="sp-cat-grid">
        {CATEGORIES.map(c => (
          <button
            key={c.name}
            className="sp-cat-card"
            style={{ background: c.bg }}
            onClick={() => search(c.name)}
          >
            <span className="sp-cat-name">{c.name}</span>
            <span className="sp-cat-emoji">{c.emoji}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
