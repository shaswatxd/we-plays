const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Window controls
  minimize: () => ipcRenderer.invoke('window-minimize'),
  maximize: () => ipcRenderer.invoke('window-maximize'),
  close: () => ipcRenderer.invoke('window-close'),
  onMaximizeChange: (callback) => {
    const fn = (event, isMaximized) => callback(isMaximized);
    ipcRenderer.on('window-maximize-change', fn);
    return () => ipcRenderer.removeListener('window-maximize-change', fn);
  },

  // Search
  searchYouTube: (query) => ipcRenderer.invoke('search-youtube', query),

  // Downloads
  downloadSong: (options) => ipcRenderer.invoke('download-song', options),
  cancelDownload: (id) => ipcRenderer.invoke('cancel-download', id),

  // Library
  getAllSongs: () => ipcRenderer.invoke('get-all-songs'),
  addSong: (song) => ipcRenderer.invoke('add-song', song),
  removeSong: (id) => ipcRenderer.invoke('remove-song', id),
  toggleFavorite: (id) => ipcRenderer.invoke('toggle-favorite', id),
  updatePlayCount: (id) => ipcRenderer.invoke('update-play-count', id),
  findDuplicates: () => ipcRenderer.invoke('find-duplicates'),
  removeDuplicateSongs: (ids) => ipcRenderer.invoke('remove-duplicate-songs', ids),
  findOrphanedSongs: () => ipcRenderer.invoke('find-orphaned-songs'),
  removeOrphanedSongs: (ids) => ipcRenderer.invoke('remove-orphaned-songs', ids),
  findDuplicatePlaylists: () => ipcRenderer.invoke('find-duplicate-playlists'),
  removeDuplicatePlaylists: (ids) => ipcRenderer.invoke('remove-duplicate-playlists', ids),

  // Playlists
  getPlaylists: () => ipcRenderer.invoke('get-playlists'),
  createPlaylist: (name) => ipcRenderer.invoke('create-playlist', name),
  deletePlaylist: (id) => ipcRenderer.invoke('delete-playlist', id),
  addToPlaylist: (playlistId, songId) => ipcRenderer.invoke('add-to-playlist', playlistId, songId),
  removeFromPlaylist: (playlistId, songId) => ipcRenderer.invoke('remove-from-playlist', playlistId, songId),
  getPlaylistSongs: (playlistId) => ipcRenderer.invoke('get-playlist-songs', playlistId),

  // History
  addToHistory: (songId) => ipcRenderer.invoke('add-to-history', songId),
  getHistory: () => ipcRenderer.invoke('get-history'),
  clearHistory: () => ipcRenderer.invoke('clear-history'),
  clearAppCache: () => ipcRenderer.invoke('clear-app-cache'),
  getSettings: () => ipcRenderer.invoke('get-settings'),
  setSetting: (key, value) => ipcRenderer.invoke('set-setting', key, value),

  // File dialogs
  selectFolder: () => ipcRenderer.invoke('select-folder'),
  importFolder: () => ipcRenderer.invoke('import-folder'),
  importFiles: (paths) => ipcRenderer.invoke('import-files', paths),
  showFileInExplorer: (filePath) => ipcRenderer.invoke('show-file-in-explorer', filePath),

  // System
  updateYtdlp: () => ipcRenderer.invoke('update-ytdlp'),
  getYtdlpVersion: () => ipcRenderer.invoke('get-ytdlp-version'),
  getFfmpegPath: () => ipcRenderer.invoke('get-ffmpeg-path'),
  getFfmpegVersion: () => ipcRenderer.invoke('get-ffmpeg-version'),
  updateFfmpeg: () => ipcRenderer.invoke('update-ffmpeg'),
  getStreamUrl: (url) => ipcRenderer.invoke('get-stream-url', url),

  // Playlists extended
  renamePlaylist: (id, name) => ipcRenderer.invoke('rename-playlist', id, name),
  reorderPlaylistSongs: (playlistId, songIds) => ipcRenderer.invoke('reorder-playlist-songs', playlistId, songIds),

  // Global search
  searchGlobal: (query) => ipcRenderer.invoke('search-global', query),

  // Smart playlists
  getSmartPlaylists: () => ipcRenderer.invoke('get-smart-playlists'),

  // Bookmarks
  saveBookmark: (songId, position, label) => ipcRenderer.invoke('save-bookmark', songId, position, label),
  getBookmarks: (songId) => ipcRenderer.invoke('get-bookmarks', songId),
  deleteBookmark: (id) => ipcRenderer.invoke('delete-bookmark', id),
  getAllBookmarks: () => ipcRenderer.invoke('get-all-bookmarks'),

  // Export/Import
  exportLibrary: () => ipcRenderer.invoke('export-library'),
  importLibrary: (data) => ipcRenderer.invoke('import-library', data),
  importLibraryFile: () => ipcRenderer.invoke('import-library-file'),
  exportLibraryFile: () => ipcRenderer.invoke('export-library-file'),

  // Paginated search
  searchYouTubePaginated: (query, page) => ipcRenderer.invoke('search-youtube-paginated', query, page),

  // ── NEW FEATURES ──────────────────────────────────────────────────────

  updateSongGain: (id, gain) => ipcRenderer.invoke('update-song-gain', id, gain),
  updateSongRating: (id, rating) => ipcRenderer.invoke('update-song-rating', id, rating),
  updateSongMetadata: (id, meta) => ipcRenderer.invoke('update-song-metadata', id, meta),

  // Auto-Tag
  autoTagSong: (data) => ipcRenderer.invoke('auto-tag-song', data),

  // Batch Download
  getPlaylistInfo: (url) => ipcRenderer.invoke('get-playlist-info', url),

  // M3U Export
  exportPlaylistM3u: (playlistId) => ipcRenderer.invoke('export-playlist-m3u', playlistId),

  // Audio Fingerprinting
  fingerprintSong: (filePath) => ipcRenderer.invoke('fingerprint-song', filePath),


  // Stats
  getListeningStats: () => ipcRenderer.invoke('get-listening-stats'),

  // LAN Collaborative Playlists
  getLocalIp: () => ipcRenderer.invoke('get-local-ip'),
  startLanShare: (playlistId) => ipcRenderer.invoke('start-lan-share', playlistId),
  stopLanShare: () => ipcRenderer.invoke('stop-lan-share'),

  // Tray play state sync
  updateTrayPlayState: (isPlaying, songInfo) => ipcRenderer.send('update-tray-play-state', { isPlaying, songInfo }),




  // Events
  onDownloadProgress: (callback) => {
    const fn = (event, data) => callback(data);
    ipcRenderer.on('download-progress', fn);
    return () => ipcRenderer.removeListener('download-progress', fn);
  },
  onDownloadComplete: (callback) => {
    const fn = (event, data) => callback(data);
    ipcRenderer.on('download-complete', fn);
    return () => ipcRenderer.removeListener('download-complete', fn);
  },
  onDownloadError: (callback) => {
    const fn = (event, data) => callback(data);
    ipcRenderer.on('download-error', fn);
    return () => ipcRenderer.removeListener('download-error', fn);
  },
  onPlayerTogglePlay: (callback) => {
    const fn = () => callback();
    ipcRenderer.on('player-toggle-play', fn);
    return () => ipcRenderer.removeListener('player-toggle-play', fn);
  },
  onPlayerNext: (callback) => {
    const fn = () => callback();
    ipcRenderer.on('player-next', fn);
    return () => ipcRenderer.removeListener('player-next', fn);
  },
  onPlayerPrevious: (callback) => {
    const fn = () => callback();
    ipcRenderer.on('player-previous', fn);
    return () => ipcRenderer.removeListener('player-previous', fn);
  },

  // Auto-Updater
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  checkAppUpdate: () => ipcRenderer.invoke('check-app-update'),
  installAppUpdate: (downloadUrl) => ipcRenderer.invoke('install-app-update', downloadUrl),
  onUpdateProgress: (callback) => {
    const fn = (event, percent) => callback(percent);
    ipcRenderer.on('update-progress', fn);
    return () => ipcRenderer.removeListener('update-progress', fn);
  }
});
