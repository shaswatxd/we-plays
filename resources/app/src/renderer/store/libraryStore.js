import { create } from 'zustand';

export const useLibraryStore = create((set, get) => ({
  songs: [],
  favorites: [],
  recent: [],
  playlists: [],
  playlistSongs: {},
  settings: {},
  globalSearchResults: null,

  loadLibrary: async () => {
    try {
      const allSongs = await window.electronAPI?.getAllSongs();
      const favs = allSongs?.filter(s => s.is_favorite) || [];
      set({ songs: allSongs || [], favorites: favs });
    } catch (err) {
      console.error('Failed to load library:', err);
    }
  },

  loadFavorites: async () => {
    try {
      const allSongs = await window.electronAPI?.getAllSongs();
      set({ favorites: allSongs?.filter(s => s.is_favorite) || [] });
    } catch (err) {
      console.error('Failed to load favorites:', err);
    }
  },

  loadRecent: async () => {
    try {
      const history = await window.electronAPI?.getHistory();
      set({ recent: history || [] });
    } catch (err) {
      console.error('Failed to load recent history:', err);
    }
  },

  clearHistory: async () => {
    try {
      await window.electronAPI?.clearHistory();
      set({ recent: [] });
    } catch (err) {
      console.error('Failed to clear history:', err);
    }
  },

  loadPlaylists: async () => {
    try {
      const playlists = await window.electronAPI?.getPlaylists();
      set({ playlists: playlists || [] });
    } catch (err) {
      console.error('Failed to load playlists:', err);
    }
  },

  loadPlaylistSongs: async (playlistId) => {
    try {
      const songs = await window.electronAPI?.getPlaylistSongs(playlistId);
      set(state => ({
        playlistSongs: { ...state.playlistSongs, [playlistId]: songs || [] }
      }));
      return songs || [];
    } catch (err) {
      console.error('Failed to load playlist songs:', err);
      return [];
    }
  },

  loadSettings: async () => {
    try {
      const settings = await window.electronAPI?.getSettings();
      set({ settings: settings || {} });
    } catch (err) {
      console.error('Failed to load settings:', err);
    }
  },

  setSetting: async (key, value) => {
    try {
      await window.electronAPI?.setSetting(key, value);
      set(state => ({
        settings: { ...state.settings, [key]: value }
      }));
    } catch (err) {
      console.error('Failed to set setting:', err);
    }
  },

  removeSong: async (id) => {
    try {
      await window.electronAPI?.removeSong(id);
      await get().loadLibrary();
    } catch (err) {
      console.error('Failed to remove song:', err);
    }
  },

  toggleFavorite: async (id) => {
    try {
      const isFav = await window.electronAPI?.toggleFavorite(id);
      const allSongs = await window.electronAPI?.getAllSongs();
      const songs = allSongs || [];
      const favs = songs.filter(s => s.is_favorite);
      set(state => {
        const updated = {};
        for (const [plId, plSongs] of Object.entries(state.playlistSongs)) {
          updated[plId] = plSongs.map(s => s.id === id ? { ...s, is_favorite: isFav } : s);
        }
        return { songs, favorites: favs, playlistSongs: updated };
      });
      return isFav;
    } catch (err) {
      console.error('Failed to toggle favorite:', err);
    }
  },

  createPlaylist: async (name) => {
    try {
      await window.electronAPI?.createPlaylist(name);
      await get().loadPlaylists();
    } catch (err) {
      console.error('Failed to create playlist:', err);
    }
  },

  importFolder: async () => {
    try {
      const res = await window.electronAPI?.importFolder();
      if (res) {
        await get().loadPlaylists();
        return res;
      }
      return null;
    } catch (err) {
      console.error('Failed to import folder:', err);
      return null;
    }
  },

  deletePlaylist: async (id) => {
    try {
      await window.electronAPI?.deletePlaylist(id);
      await get().loadPlaylists();
    } catch (err) {
      console.error('Failed to delete playlist:', err);
    }
  },

  addToPlaylist: async (playlistId, songId) => {
    try {
      await window.electronAPI?.addToPlaylist(playlistId, songId);
      await get().loadPlaylistSongs(playlistId);
    } catch (err) {
      console.error('Failed to add to playlist:', err);
    }
  },

  removeFromPlaylist: async (playlistId, songId) => {
    try {
      await window.electronAPI?.removeFromPlaylist(playlistId, songId);
      await get().loadPlaylistSongs(playlistId);
    } catch (err) {
      console.error('Failed to remove from playlist:', err);
    }
  },

  renamePlaylist: async (id, name) => {
    try {
      await window.electronAPI?.renamePlaylist(id, name);
      await get().loadPlaylists();
    } catch (err) {
      console.error('Failed to rename playlist:', err);
    }
  },

  reorderPlaylistSongs: async (playlistId, songIds) => {
    try {
      await window.electronAPI?.reorderPlaylistSongs(playlistId, songIds);
      await get().loadPlaylistSongs(playlistId);
    } catch (err) {
      console.error('Failed to reorder playlist songs:', err);
    }
  },

  globalSearch: async (query) => {
    try {
      const results = await window.electronAPI?.searchGlobal(query);
      set({ globalSearchResults: results });
      return results;
    } catch (err) {
      console.error('Global search failed:', err);
      return null;
    }
  },

  clearGlobalSearch: () => set({ globalSearchResults: null }),

  exportLibrary: async () => {
    try {
      return await window.electronAPI?.exportLibrary();
    } catch (err) {
      console.error('Failed to export library:', err);
      return null;
    }
  },

  importLibraryData: async (data) => {
    try {
      const result = await window.electronAPI?.importLibrary(data);
      await get().loadLibrary();
      await get().loadPlaylists();
      return result;
    } catch (err) {
      console.error('Failed to import library:', err);
      return null;
    }
  },

}));
