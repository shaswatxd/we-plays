import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';

export const tauriAPI = {
  // Window controls
  minimize: () => invoke('window_minimize'),
  maximize: () => invoke('window_maximize'),
  close: () => invoke('window_close'),
  onMaximizeChange: (callback) => {
    const unlisten = listen('window-maximize-change', (e) => callback(e.payload));
    return unlisten;
  },

  // Search
  searchYouTube: (query) => invoke('search_youtube', { query }),
  searchYouTubePaginated: (query, page) => invoke('search_youtube_paginated', { query, page: parseInt(page) || 1 }),

  // Downloads
  downloadSong: (options) => invoke('download_song', {
    url: options.url || '',
    quality: options.quality || 'best',
    format: options.format || 'mp3',
  }),
  cancelDownload: (id) => invoke('cancel_download', { downloadId: id }),
  onDownloadProgress: (callback) => {
    const unlisten = listen('download-progress', (e) => callback(e.payload));
    return unlisten;
  },
  onDownloadComplete: (callback) => {
    const unlisten = listen('download-complete', (e) => callback(e.payload));
    return unlisten;
  },
  onDownloadError: (callback) => {
    const unlisten = listen('download-error', (e) => callback(e.payload));
    return unlisten;
  },

  // Library
  getAllSongs: () => invoke('get_all_songs'),
  addSong: (song) => invoke('add_song', { data: song }),
  removeSong: (id) => invoke('remove_song', { songId: id }),
  toggleFavorite: (id) => invoke('toggle_favorite', { songId: id }),
  updatePlayCount: (id) => invoke('update_play_count', { songId: id }),
  findDuplicates: () => invoke('find_duplicates'),
  removeDuplicateSongs: (ids) => invoke('remove_duplicate_songs', { duplicateGroups: ids.map(i => [i]), keepFirst: true }),
  findOrphanedSongs: () => invoke('find_orphaned_songs'),
  removeOrphanedSongs: (ids) => invoke('remove_orphaned_songs'),
  findDuplicatePlaylists: () => invoke('find_duplicate_playlists'),
  removeDuplicatePlaylists: (ids) => invoke('remove_duplicate_playlists', { duplicateGroups: ids.map(i => [i]), keepFirst: true }),

  // Playlists
  getPlaylists: () => invoke('get_playlists'),
  createPlaylist: (name) => invoke('create_playlist', { name, description: null }),
  deletePlaylist: (id) => invoke('delete_playlist', { playlistId: id }),
  addToPlaylist: (playlistId, songId) => invoke('add_to_playlist', { playlistId, songId }),
  removeFromPlaylist: (playlistId, songId) => invoke('remove_from_playlist', { playlistId, songId }),
  getPlaylistSongs: (playlistId) => invoke('get_playlist_songs', { playlistId }),
  renamePlaylist: (id, name) => invoke('rename_playlist', { playlistId: id, name }),
  reorderPlaylistSongs: (playlistId, songIds) => invoke('reorder_playlist_songs', { playlistId, songIds }),

  // History
  addToHistory: (songId) => invoke('add_to_history', { songId, durationPlayed: null }),
  getHistory: () => invoke('get_history', { limit: null }),
  clearHistory: () => invoke('clear_history'),

  // Settings
  getSettings: () => invoke('get_settings'),
  setSetting: (key, value) => invoke('set_setting', { key, value: String(value) }),

  // File Operations
  selectFolder: () => invoke('select_folder', { startPath: null }),
  importFolder: (path) => invoke('import_folder', { path }),
  importFiles: (paths) => invoke('import_files', { paths }),
  showFileInExplorer: (path) => invoke('show_file_in_explorer', { path }),

  // Export/Import
  exportLibrary: () => invoke('get_all_songs'),
  importLibrary: (data) => invoke('import_library', { path: '' }),
  exportLibraryFile: () => invoke('get_all_songs'),
  importLibraryFile: () => invoke('import_library', { path: '' }),
  exportPlaylistM3u: (playlistId) => invoke('export_playlist_m3u', { playlistId }),

  // System
  updateYtdlp: () => invoke('update_ytdlp'),
  getYtdlpVersion: () => invoke('get_ytdlp_version'),
  getFfmpegPath: () => invoke('get_ffmpeg_path'),
  getStreamUrl: (url) => invoke('get_stream_url', { url }),
  clearAppCache: () => Promise.resolve(),

  // Search Global
  searchGlobal: (query) => invoke('search_global', { query }),

  // Smart Playlists
  getSmartPlaylists: () => invoke('get_smart_playlists'),

  // Bookmarks
  saveBookmark: (songId, position, label) => invoke('save_bookmark', { songId, position, label }),
  getBookmarks: (songId) => invoke('get_bookmarks', { songId }),
  deleteBookmark: (id) => invoke('delete_bookmark', { bookmarkId: id }),
  getAllBookmarks: () => invoke('get_all_bookmarks'),

  // Metadata
  updateSongGain: (id, gain) => invoke('update_song_gain', { songId: id, gain }),
  updateSongRating: (id, rating) => invoke('update_song_rating', { songId: id, rating }),
  autoTagSong: (data) => invoke('auto_tag_song', { songId: data.songId || data.id || '' }),
  getPlaylistInfo: (url) => invoke('get_stream_url', { url }),
  fingerprintSong: (filePath) => invoke('get_stream_url', { url: filePath }),

  // Stats
  getListeningStats: () => invoke('get_listening_stats'),

  // LAN
  getLocalIp: () => invoke('get_local_ip'),
  startLanShare: (playlistId) => invoke('start_lan_share', { playlistId }),
  stopLanShare: () => invoke('stop_lan_share'),

  // Events (media key support)
  onPlayerTogglePlay: (callback) => {
    const unlisten = listen('player-toggle-play', () => callback());
    return unlisten;
  },
  onPlayerNext: (callback) => {
    const unlisten = listen('player-next', () => callback());
    return unlisten;
  },
  onPlayerPrevious: (callback) => {
    const unlisten = listen('player-previous', () => callback());
    return unlisten;
  },
};

window.electronAPI = tauriAPI;
