import React, { useEffect, useMemo, useState } from 'react';
import { Heart, Download, History, Trash2, PlayCircle, BookOpen } from 'lucide-react';
import { useAudiobookStore } from '../../store/audiobookStore';
import { useAudiobookPlayerStore } from '../../store/audiobookPlayerStore';
import { formatDurationLong } from '../../services/audiobookApi';
import AudiobookCard from './AudiobookCard';

const TABS = [
  { id: 'favorites', label: 'Favorites', Icon: Heart },
  { id: 'downloads', label: 'Downloads', Icon: Download },
  { id: 'recent', label: 'Recently Played', Icon: History },
];

function DownloadsTab({ onOpenBook }) {
  const { downloads, loadDownloads, removeDownload } = useAudiobookStore();
  const { playBook } = useAudiobookPlayerStore();

  useEffect(() => { loadDownloads(); }, [loadDownloads]);

  const grouped = useMemo(() => {
    const map = new Map();
    for (const d of downloads) {
      if (d.status !== 'completed') continue;
      const key = String(d.book_id);
      if (!map.has(key)) {
        let book = null;
        try { book = d.book_data ? JSON.parse(d.book_data) : null; } catch { book = null; }
        map.set(key, { bookId: key, bookTitle: d.book_title, book, chapters: [] });
      }
      map.get(key).chapters.push(d);
    }
    return Array.from(map.values());
  }, [downloads]);

  if (grouped.length === 0) {
    return (
      <div className="sp-empty">
        <div className="sp-empty-icon"><Download size={28}/></div>
        <p className="sp-empty-title">No downloads yet</p>
        <p className="sp-empty-sub">Download chapters from a book's detail page for offline listening.</p>
      </div>
    );
  }

  return (
    <div className="ab-downloads-list">
      {grouped.map(group => (
        <div key={group.bookId} className="ab-download-group">
          <div className="ab-download-group-header" onClick={() => onOpenBook(group.bookId)}>
            <BookOpen size={16} color="#1db954" />
            <p>{group.bookTitle || `Book #${group.bookId}`}</p>
            <span>{group.chapters.length} chapter{group.chapters.length === 1 ? '' : 's'} offline</span>
          </div>
          {group.chapters
            .sort((a, b) => a.chapter_index - b.chapter_index)
            .map(ch => (
              <div key={ch.id} className="ab-download-chapter-row">
                <span>{ch.title || `Chapter ${ch.chapter_index + 1}`}</span>
                <div style={{ display:'flex', gap:8 }}>
                  <button className="sp-icon-btn" title="Play offline" onClick={async () => {
                    const book = group.book || await window.electronAPI?.audiobookGetBook(group.bookId);
                    if (book) playBook(book, ch.chapter_index, 0);
                  }}><PlayCircle size={16}/></button>
                  <button className="sp-icon-btn" title="Delete download" onClick={() => removeDownload(group.bookId, ch.chapter_index)}><Trash2 size={14}/></button>
                </div>
              </div>
            ))}
        </div>
      ))}
    </div>
  );
}

function FavoritesTab({ onOpenBook }) {
  const { favorites, loadFavorites } = useAudiobookStore();
  const { playBook } = useAudiobookPlayerStore();
  useEffect(() => { loadFavorites(); }, [loadFavorites]);

  if (favorites.length === 0) {
    return (
      <div className="sp-empty">
        <div className="sp-empty-icon"><Heart size={28}/></div>
        <p className="sp-empty-title">No favorite audiobooks</p>
        <p className="sp-empty-sub">Tap the heart on any audiobook to save it here.</p>
      </div>
    );
  }

  return (
    <div className="sp-album-grid">
      {favorites.map(book => (
        <AudiobookCard key={book.id} book={book} onOpen={onOpenBook} onPlay={(b) => playBook(b, 0, 0)} />
      ))}
    </div>
  );
}

function RecentTab({ onOpenBook }) {
  const { history, loadHistory, clearHistory } = useAudiobookStore();
  const { playBook } = useAudiobookPlayerStore();
  useEffect(() => { loadHistory(); }, [loadHistory]);

  if (history.length === 0) {
    return (
      <div className="sp-empty">
        <div className="sp-empty-icon"><History size={28}/></div>
        <p className="sp-empty-title">No listening history yet</p>
        <p className="sp-empty-sub">Books you play will show up here.</p>
      </div>
    );
  }

  return (
    <>
      <div style={{ display:'flex', justifyContent:'flex-end', marginBottom: 12 }}>
        <button className="sp-ghost-btn" onClick={clearHistory}>Clear history</button>
      </div>
      <div className="sp-album-grid">
        {history.map(book => (
          <AudiobookCard
            key={book.id}
            book={book}
            onOpen={onOpenBook}
            onPlay={(b) => playBook(b, 0, 0)}
            subtitle={`${(book.authors || []).map(a => a.name).join(', ') || 'Unknown'} · ${formatDurationLong(book.totalTimeSecs)}`}
          />
        ))}
      </div>
    </>
  );
}

export default function AudiobookLibraryView({ onOpenBook }) {
  const [tab, setTab] = useState('favorites');

  return (
    <div style={{ padding: 24 }}>
      <div className="ab-tab-switch" style={{ marginBottom: 20 }}>
        {TABS.map(({ id, label, Icon }) => (
          <button key={id} className={`ab-tab-btn${tab === id ? ' active' : ''}`} onClick={() => setTab(id)}>
            <Icon size={14} style={{ marginRight: 6 }} /> {label}
          </button>
        ))}
      </div>
      {tab === 'favorites' && <FavoritesTab onOpenBook={onOpenBook} />}
      {tab === 'downloads' && <DownloadsTab onOpenBook={onOpenBook} />}
      {tab === 'recent' && <RecentTab onOpenBook={onOpenBook} />}
    </div>
  );
}
