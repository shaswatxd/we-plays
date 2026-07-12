import { create } from 'zustand';

const MAX_CONCURRENT = 3;

export const useDownloadStore = create((set, get) => ({
  downloads: [],
  queue: [],

  startDownload: async (song, config, externalId) => {
    const songId = externalId || song.id || `dl_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    
    const activeCount = get().downloads.filter(d => d.status === 'downloading').length;
    
    if (activeCount >= MAX_CONCURRENT) {
      set(state => ({
        queue: [...state.queue, { ...song, id: songId, ...config }]
      }));
      set(state => ({
        downloads: [
          ...state.downloads.filter(d => d.id !== songId),
          { ...song, id: songId, status: 'queued', progress: 0, speed: null, eta: null, ...config }
        ]
      }));
      return { id: songId, queued: true };
    }

    set(state => ({
      downloads: [
        ...state.downloads.filter(d => d.id !== songId),
        { ...song, id: songId, status: 'downloading', progress: 0, speed: null, eta: null, ...config }
      ]
    }));

    try {
      if (!window.electronAPI) {
        throw new Error('Electron API not available');
      }
      const result = await window.electronAPI.downloadSong({
        id: songId,
        url: song.url,
        title: song.title,
        artist: song.artist,
        duration: song.duration,
        thumbnail: song.thumbnail,
        format: config.format,
        quality: config.quality,
        outputPath: config.outputPath,
        embedThumbnail: config.embedThumbnail,
        addMetadata: config.addMetadata,
        addToFavorites: config.addToFavorites,
        addToPlaylistId: config.addToPlaylistId
      });
      return result;
    } catch (err) {
      set(state => ({
        downloads: state.downloads.map(d => 
          d.id === songId 
            ? { ...d, status: 'error', error: err.message || 'Download failed' } 
            : d
        )
      }));
      throw err;
    }
  },

  processQueue: async () => {
    const { queue, downloads } = get();
    const activeCount = downloads.filter(d => d.status === 'downloading').length;
    if (activeCount >= MAX_CONCURRENT || queue.length === 0) return;
    
    const next = queue[0];
    set(state => ({ queue: state.queue.slice(1) }));
    
    set(state => ({
      downloads: state.downloads.map(d => 
        d.id === next.id ? { ...d, status: 'downloading' } : d
      )
    }));
    
    try {
      await window.electronAPI?.downloadSong({
        id: next.id,
        url: next.url,
        title: next.title,
        artist: next.artist,
        duration: next.duration,
        thumbnail: next.thumbnail,
        format: next.format,
        quality: next.quality,
        outputPath: next.outputPath,
        embedThumbnail: next.embedThumbnail,
        addMetadata: next.addMetadata,
        addToFavorites: next.addToFavorites,
        addToPlaylistId: next.addToPlaylistId
      });
    } catch (err) {
      set(state => ({
        downloads: state.downloads.map(d => 
          d.id === next.id ? { ...d, status: 'error', error: err.message } : d
        )
      }));
    }
  },

  updateProgress: (id, progressData) => {
    set(state => ({
      downloads: state.downloads.map(d => 
        d.id === id ? { ...d, ...progressData } : d
      )
    }));
  },

  completeDownload: (id, info = {}) => {
    set(state => ({
      downloads: state.downloads.map(d =>
        d.id === id
          ? { ...d, status: 'completed', progress: 100, songId: info.songId ?? d.songId, filePath: info.filePath ?? d.filePath }
          : d
      )
    }));
    setTimeout(() => get().processQueue(), 500);
  },

  errorDownload: (id, errorMsg) => {
    set(state => ({
      downloads: state.downloads.map(d => 
        d.id === id ? { ...d, status: 'error', error: errorMsg } : d
      )
    }));
    setTimeout(() => get().processQueue(), 500);
  },

  cancelDownload: async (id) => {
    try {
      await window.electronAPI?.cancelDownload(id);
      set(state => ({
        downloads: state.downloads.map(d => 
          d.id === id ? { ...d, status: 'cancelled' } : d
        )
      }));
      setTimeout(() => get().processQueue(), 500);
    } catch (err) {
      console.error('Failed to cancel download:', err);
    }
  },

  removeDownload: (id) => {
    set(state => ({
      downloads: state.downloads.filter(d => d.id !== id)
    }));
  },

  clearCompleted: () => {
    set(state => ({
      downloads: state.downloads.filter(d => d.status !== 'completed' && d.status !== 'cancelled' && d.status !== 'error')
    }));
  }
}));
