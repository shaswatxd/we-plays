import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Search, AlertCircle, ChevronDown, Loader2, SlidersHorizontal, User } from 'lucide-react';
import { searchAudiobooks, searchAuthors, debounce, AUDIOBOOK_GENRES, AUDIOBOOK_LANGUAGES } from '../../services/audiobookApi';
import AudiobookCard from './AudiobookCard';
import { useAudiobookPlayerStore } from '../../store/audiobookPlayerStore';

const PAGE_SIZE = 24;

const SORT_OPTIONS = [
  { id: 'relevance', label: 'Relevance' },
  { id: 'popularity', label: 'Popularity (by chapters)' },
  { id: 'title', label: 'Title A–Z' },
  { id: 'duration_desc', label: 'Duration: Longest' },
  { id: 'duration_asc', label: 'Duration: Shortest' },
];

function applyClientFilters(books, { language, minMinutes, maxMinutes, sortBy }) {
  let result = books;
  if (language) result = result.filter(b => b.language === language);
  if (minMinutes) result = result.filter(b => (b.totalTimeSecs / 60) >= Number(minMinutes));
  if (maxMinutes) result = result.filter(b => (b.totalTimeSecs / 60) <= Number(maxMinutes));

  const sorted = [...result];
  switch (sortBy) {
    case 'popularity': sorted.sort((a, b) => b.numSections - a.numSections); break;
    case 'title': sorted.sort((a, b) => a.title.localeCompare(b.title)); break;
    case 'duration_desc': sorted.sort((a, b) => b.totalTimeSecs - a.totalTimeSecs); break;
    case 'duration_asc': sorted.sort((a, b) => a.totalTimeSecs - b.totalTimeSecs); break;
    default: break;
  }
  return sorted;
}

export default function AudiobookSearchView({ onOpenBook, initialGenre }) {
  const { playBook } = useAudiobookPlayerStore();
  const [query, setQuery] = useState('');
  const [inputValue, setInputValue] = useState('');
  const [tab, setTab] = useState('books');
  const [showFilters, setShowFilters] = useState(!!initialGenre);
  const [filters, setFilters] = useState({ genre: initialGenre || '', author: '', language: '', minMinutes: '', maxMinutes: '', sortBy: 'relevance' });
  const lastAppliedGenre = useRef(initialGenre || null);

  useEffect(() => {
    if (initialGenre && initialGenre !== lastAppliedGenre.current) {
      lastAppliedGenre.current = initialGenre;
      setFilters(f => ({ ...f, genre: initialGenre }));
      setShowFilters(true);
    }
  }, [initialGenre]);

  const [books, setBooks] = useState([]);
  const [authors, setAuthors] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);
  const scrollRef = useRef(null);

  const debouncedSetQuery = useMemo(() => debounce((v) => setQuery(v), 400), []);

  const onChangeInput = (v) => {
    setInputValue(v);
    debouncedSetQuery(v);
  };

  const runSearch = useCallback(async (reset) => {
    const nextOffset = reset ? 0 : offset;
    reset ? setLoading(true) : setLoadingMore(true);
    setError(null);
    try {
      if (tab === 'authors') {
        if (!query.trim()) { setAuthors([]); setHasMore(false); return; }
        const results = await searchAuthors(query.trim());
        setAuthors(results);
        setHasMore(false);
        return;
      }

      const { books: results, hasMore: more } = await searchAudiobooks({
        title: query.trim() || undefined,
        author: filters.author.trim() || undefined,
        genre: filters.genre || undefined,
        offset: nextOffset,
        limit: PAGE_SIZE
      });

      const filtered = applyClientFilters(results, filters);
      setBooks(prev => reset ? filtered : [...prev, ...filtered]);
      setHasMore(more);
      setOffset(nextOffset + PAGE_SIZE);
    } catch (err) {
      setError(err.message || 'Search failed');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [tab, query, filters, offset]);

  useEffect(() => {
    setOffset(0);
    runSearch(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, query, filters.genre, filters.author, filters.language, filters.minMinutes, filters.maxMinutes, filters.sortBy]);

  const loadMore = useCallback(() => {
    if (loading || loadingMore || !hasMore || tab !== 'books') return;
    runSearch(false);
  }, [loading, loadingMore, hasMore, tab, runSearch]);

  useEffect(() => {
    const el = scrollRef.current?.closest('.sp-main-scroll');
    if (!el) return;
    const onScroll = () => {
      if (el.scrollTop + el.clientHeight >= el.scrollHeight - 300) loadMore();
    };
    el.addEventListener('scroll', onScroll);
    return () => el.removeEventListener('scroll', onScroll);
  }, [loadMore]);

  const clearFilters = () => setFilters({ genre: '', author: '', language: '', minMinutes: '', maxMinutes: '', sortBy: 'relevance' });
  const activeFilterCount = ['genre', 'author', 'language', 'minMinutes', 'maxMinutes'].filter(k => filters[k]).length;

  return (
    <div ref={scrollRef} style={{ padding: 24 }}>
      <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom: 16, flexWrap:'wrap' }}>
        <div className="ab-search-box">
          <Search size={16} color="#6a6a6a" />
          <input
            className="ab-search-input"
            placeholder="Search audiobooks or authors…"
            value={inputValue}
            onChange={e => onChangeInput(e.target.value)}
          />
        </div>
        <div className="ab-tab-switch">
          <button className={`ab-tab-btn${tab === 'books' ? ' active' : ''}`} onClick={() => setTab('books')}>Books</button>
          <button className={`ab-tab-btn${tab === 'authors' ? ' active' : ''}`} onClick={() => setTab('authors')}>Authors</button>
        </div>
        <button className={`sp-ghost-btn${activeFilterCount ? ' active' : ''}`} onClick={() => setShowFilters(v => !v)}>
          <SlidersHorizontal size={14}/> Filters{activeFilterCount ? ` (${activeFilterCount})` : ''}
        </button>
      </div>

      {showFilters && tab === 'books' && (
        <div className="ab-filters-panel">
          <div className="ab-filter-field">
            <label>Genre</label>
            <select value={filters.genre} onChange={e => setFilters(f => ({ ...f, genre: e.target.value }))}>
              <option value="">All genres</option>
              {AUDIOBOOK_GENRES.map(g => <option key={g} value={g}>{g}</option>)}
            </select>
          </div>
          <div className="ab-filter-field">
            <label>Author</label>
            <input type="text" placeholder="e.g. Dickens" value={filters.author} onChange={e => setFilters(f => ({ ...f, author: e.target.value }))} />
          </div>
          <div className="ab-filter-field">
            <label>Language</label>
            <select value={filters.language} onChange={e => setFilters(f => ({ ...f, language: e.target.value }))}>
              <option value="">Any language</option>
              {AUDIOBOOK_LANGUAGES.map(l => <option key={l} value={l}>{l}</option>)}
            </select>
          </div>
          <div className="ab-filter-field">
            <label>Duration (min)</label>
            <div style={{ display:'flex', gap:6 }}>
              <input type="number" min="0" placeholder="Min" value={filters.minMinutes} onChange={e => setFilters(f => ({ ...f, minMinutes: e.target.value }))} style={{ width: 70 }} />
              <input type="number" min="0" placeholder="Max" value={filters.maxMinutes} onChange={e => setFilters(f => ({ ...f, maxMinutes: e.target.value }))} style={{ width: 70 }} />
            </div>
          </div>
          <div className="ab-filter-field">
            <label>Sort by (Popularity)</label>
            <select value={filters.sortBy} onChange={e => setFilters(f => ({ ...f, sortBy: e.target.value }))}>
              {SORT_OPTIONS.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
            </select>
          </div>
          {activeFilterCount > 0 && <button className="sp-ghost-btn" onClick={clearFilters}>Clear</button>}
        </div>
      )}

      {loading && (
        <div className="sp-album-grid">
          {[...Array(10)].map((_, i) => (
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
          <p className="sp-empty-title">Search failed</p>
          <p className="sp-empty-sub">{error}</p>
        </div>
      )}

      {!loading && !error && tab === 'books' && books.length === 0 && (
        <div className="sp-empty">
          <div className="sp-empty-icon"><Search size={28}/></div>
          <p className="sp-empty-title">{query ? `No audiobooks for "${query}"` : 'Search the LibriVox catalog'}</p>
          <p className="sp-empty-sub">Try a title, or use filters to browse by genre.</p>
        </div>
      )}

      {!loading && !error && tab === 'books' && books.length > 0 && (
        <>
          <div className="sp-album-grid">
            {books.map(book => (
              <AudiobookCard key={book.id} book={book} onOpen={onOpenBook} onPlay={(b) => playBook(b, 0, 0)} />
            ))}
          </div>
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
        </>
      )}

      {!loading && !error && tab === 'authors' && authors.length === 0 && (
        <div className="sp-empty">
          <div className="sp-empty-icon"><User size={28}/></div>
          <p className="sp-empty-title">{query ? `No authors for "${query}"` : 'Search for an author'}</p>
          <p className="sp-empty-sub">Type an author's name above.</p>
        </div>
      )}

      {!loading && !error && tab === 'authors' && authors.length > 0 && (
        <div className="ab-author-grid">
          {authors.map(a => (
            <button key={a.id} className="ab-author-card" onClick={() => { setTab('books'); setFilters(f => ({ ...f, author: a.name })); setInputValue(''); setQuery(''); }}>
              <div className="ab-author-avatar">
                {a.sampleCover ? <img src={a.sampleCover} alt="" /> : <User size={22} color="rgba(255,255,255,0.5)" />}
              </div>
              <p className="ab-author-name">{a.name}</p>
              <p className="ab-author-meta">{a.bookCount} book{a.bookCount === 1 ? '' : 's'} found</p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
