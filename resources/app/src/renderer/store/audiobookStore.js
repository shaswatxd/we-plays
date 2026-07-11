import { create } from 'zustand';

export const useAudiobookStore = create((set, get) => ({
  favorites: [],
  favoriteIds: new Set(),
  history: [],
  downloads: [],
  continueListening: [],

  loadFavorites: async () => {
    try {
      const favorites = await window.electronAPI?.audiobookGetFavorites();
      set({ favorites: favorites || [], favoriteIds: new Set((favorites || []).map(b => String(b.id))) });
    } catch (err) {
      console.error('Failed to load audiobook favorites:', err);
    }
  },

  toggleFavorite: async (book) => {
    try {
      const nowFav = await window.electronAPI?.audiobookToggleFavorite(book);
      await get().loadFavorites();
      return nowFav;
    } catch (err) {
      console.error('Failed to toggle audiobook favorite:', err);
      return false;
    }
  },

  isFavorite: (bookId) => get().favoriteIds.has(String(bookId)),

  loadHistory: async () => {
    try {
      const history = await window.electronAPI?.audiobookGetHistory();
      set({ history: history || [] });
    } catch (err) {
      console.error('Failed to load audiobook history:', err);
    }
  },

  clearHistory: async () => {
    try {
      await window.electronAPI?.audiobookClearHistory();
      set({ history: [] });
    } catch (err) {
      console.error('Failed to clear audiobook history:', err);
    }
  },

  loadDownloads: async () => {
    try {
      const downloads = await window.electronAPI?.audiobookGetDownloads();
      set({ downloads: downloads || [] });
    } catch (err) {
      console.error('Failed to load audiobook downloads:', err);
    }
  },

  removeDownload: async (bookId, chapterIndex) => {
    try {
      await window.electronAPI?.audiobookDeleteDownload(bookId, chapterIndex);
      await get().loadDownloads();
    } catch (err) {
      console.error('Failed to delete audiobook download:', err);
    }
  },

  updateDownloadProgress: (data) => {
    set(state => {
      const idx = state.downloads.findIndex(d => String(d.book_id) === String(data.bookId) && d.chapter_index === data.chapterIndex);
      const entry = {
        book_id: data.bookId, chapter_index: data.chapterIndex,
        downloaded_bytes: data.downloadedBytes, total_bytes: data.totalBytes, status: 'downloading'
      };
      if (idx >= 0) {
        const next = [...state.downloads];
        next[idx] = { ...next[idx], ...entry };
        return { downloads: next };
      }
      return { downloads: [...state.downloads, entry] };
    });
  },

  markDownloadStatus: (bookId, chapterIndex, status) => {
    set(state => ({
      downloads: state.downloads.map(d =>
        String(d.book_id) === String(bookId) && d.chapter_index === chapterIndex ? { ...d, status } : d
      )
    }));
  },

  loadContinueListening: async () => {
    try {
      const rows = await window.electronAPI?.audiobookGetAllProgress();
      const items = (rows || [])
        .filter(r => r.data)
        .map(r => {
          try {
            return {
              book: JSON.parse(r.data),
              chapterIndex: r.chapter_index,
              position: r.position,
              duration: r.duration,
              updatedAt: r.updated_at
            };
          } catch { return null; }
        })
        .filter(Boolean);
      set({ continueListening: items });
    } catch (err) {
      console.error('Failed to load continue listening:', err);
    }
  },
}));
