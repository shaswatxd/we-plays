import React, { useState } from 'react';
import { Home, Search, Library } from 'lucide-react';
import AudiobookHomeView from './AudiobookHomeView';
import AudiobookSearchView from './AudiobookSearchView';
import AudiobookLibraryView from './AudiobookLibraryView';
import AudiobookDetailView from './AudiobookDetailView';

const TABS = [
  { id: 'home', label: 'Home', Icon: Home },
  { id: 'search', label: 'Search', Icon: Search },
  { id: 'library', label: 'Your Library', Icon: Library },
];

export default function AudiobooksView() {
  const [tab, setTab] = useState('home');
  const [selectedBookId, setSelectedBookId] = useState(null);
  const [genreFilter, setGenreFilter] = useState(null);

  const openBook = (id) => setSelectedBookId(id);
  const closeBook = () => setSelectedBookId(null);
  const browseGenre = (genre) => { setGenreFilter(genre); setTab('search'); };

  if (selectedBookId) {
    return <AudiobookDetailView bookId={selectedBookId} onBack={closeBook} />;
  }

  return (
    <div>
      <div className="ab-top-tabs">
        {TABS.map(({ id, label, Icon }) => (
          <button key={id} className={`ab-top-tab${tab === id ? ' active' : ''}`} onClick={() => setTab(id)}>
            <Icon size={15} /> {label}
          </button>
        ))}
      </div>
      {tab === 'home' && <AudiobookHomeView onOpenBook={openBook} onBrowseGenre={browseGenre} />}
      {tab === 'search' && <AudiobookSearchView onOpenBook={openBook} initialGenre={genreFilter} />}
      {tab === 'library' && <AudiobookLibraryView onOpenBook={openBook} />}
    </div>
  );
}
