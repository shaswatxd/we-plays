import { create } from 'zustand';

export const usePlayerStore = create((set, get) => ({
  currentSong: null,
  queue: [],
  queueIndex: -1,
  isPlaying: false,
  volume: 0.8,
  isMuted: false,
  progress: 0,
  duration: 0,
  isShuffled: false,
  repeatMode: 'off',
  playTrigger: 0,
  isManualTransition: false,
  howl: null,
  eq: { low: 0, mid: 0, high: 0 },
  gaplessEnabled: true,
  playHistory: [],


  setEq: (band, value) => set((state) => ({ eq: { ...state.eq, [band]: value } })),
  setHowl: (howl) => set({ howl }),

  playSong: (song) => {
    const { queue, queueIndex, playHistory, currentSong: prevSong } = get();
    if (prevSong) {
      const newHist = [prevSong, ...playHistory.filter(s => s.id !== prevSong.id)].slice(0, 100);
      set({ playHistory: newHist });
    }
    const idx = queue.findIndex(s => s.id === song.id);
    if (idx >= 0) {
      set(state => ({ queueIndex: idx, currentSong: song, isPlaying: true, progress: 0, duration: 0, isManualTransition: true, playTrigger: state.playTrigger + 1 }));
    } else {
      const newQueue = [...queue];
      newQueue.splice(queueIndex + 1, 0, song);
      set(state => ({ queue: newQueue, queueIndex: queueIndex + 1, currentSong: song, isPlaying: true, progress: 0, duration: 0, isManualTransition: true, playTrigger: state.playTrigger + 1 }));
    }
    if (window.electronAPI && song.id && !song.isFromSearch) {
      window.electronAPI.updatePlayCount(song.id);
      window.electronAPI.addToHistory(song.id);
    }
  },

  playPlaylist: (songs, startIndex = 0) => {
    if (!songs || songs.length === 0) return;
    const { currentSong: prevSong, playHistory } = get();
    if (prevSong) {
      const newHist = [prevSong, ...playHistory.filter(s => s.id !== prevSong.id)].slice(0, 100);
      set({ playHistory: newHist });
    }
    set(state => ({
      queue: songs, queueIndex: startIndex, currentSong: songs[startIndex],
      isPlaying: true, progress: 0, duration: 0, isManualTransition: true, playTrigger: state.playTrigger + 1
    }));
    const song = songs[startIndex];
    if (window.electronAPI && song.id && !song.isFromSearch) {
      window.electronAPI.updatePlayCount(song.id);
      window.electronAPI.addToHistory(song.id);
    }
  },

  togglePlay: () => {
    const { isPlaying, howl } = get();
    if (howl) {
      if (isPlaying) {
        howl.pause();
      } else {
        howl.play();
      }
    }
    set({ isPlaying: !isPlaying });
  },

  nextTrack: (isManual = false) => {
    const { queue, queueIndex, isShuffled, repeatMode, playHistory, currentSong: prevSong } = get();
    if (queue.length === 0) return;
    if (prevSong) {
      const newHist = [prevSong, ...playHistory.filter(s => s.id !== prevSong.id)].slice(0, 100);
      set({ playHistory: newHist });
    }
    let nextIdx;
    if (repeatMode === 'one' && !isManual) nextIdx = queueIndex;
    else if (isShuffled) nextIdx = Math.floor(Math.random() * queue.length);
    else { nextIdx = queueIndex + 1; if (nextIdx >= queue.length || nextIdx < 0) nextIdx = 0; }
    const nextSong = queue[nextIdx];
    if (!nextSong) return;
    set(state => ({ queueIndex: nextIdx, currentSong: nextSong, isPlaying: true, progress: 0, duration: 0, isManualTransition: isManual, playTrigger: state.playTrigger + 1 }));
    if (window.electronAPI && nextSong.id && !nextSong.isFromSearch) {
      window.electronAPI.updatePlayCount(nextSong.id);
      window.electronAPI.addToHistory(nextSong.id);
    }
  },

  previousTrack: () => {
    const { queue, queueIndex, progress } = get();
    if (queue.length === 0) return;

    if (queueIndex <= 0 || progress > 3) {
      // Restart current song
      const { howl } = get();
      if (howl) howl.seek(0);
      set({ progress: 0 });
      return;
    }

    const prevIdx = queueIndex - 1;
    const prevSong = queue[prevIdx];
    if (!prevSong) return;

    set(state => ({ queueIndex: prevIdx, currentSong: prevSong, isPlaying: true, progress: 0, duration: 0, isManualTransition: true, playTrigger: state.playTrigger + 1 }));

    if (window.electronAPI && prevSong.id && !prevSong.isFromSearch) {
      window.electronAPI.updatePlayCount(prevSong.id);
      window.electronAPI.addToHistory(prevSong.id);
    }
  },

  seekTo: (seconds) => {
    const { howl } = get();
    if (howl) {
      howl.seek(seconds);
    }
    set({ progress: seconds });
  },

  setVolume: (vol) => {
    const { howl } = get();
    if (howl) {
      howl.volume(vol);
    }
    set({ volume: vol, isMuted: vol === 0 });
  },

  toggleMute: () => {
    const { isMuted, volume, howl } = get();
    if (howl) {
      howl.mute(!isMuted);
    }
    set({ isMuted: !isMuted });
  },

  setDuration: (duration) => set({ duration }),
  setProgress: (progress) => set({ progress }),

  toggleShuffle: () => set(state => ({ isShuffled: !state.isShuffled })),

  toggleRepeat: () => set(state => {
    const modes = ['off', 'one', 'all'];
    const currentIdx = modes.indexOf(state.repeatMode);
    return { repeatMode: modes[(currentIdx + 1) % 3] };
  }),

  addToQueue: (song) => set(state => ({ queue: [...state.queue, song] })),

  removeFromQueue: (index) => set(state => {
    const newQueue = state.queue.filter((_, i) => i !== index);
    let newIndex = state.queueIndex;
    if (index < state.queueIndex) {
      newIndex--;
    } else if (index === state.queueIndex) {
      newIndex = Math.min(newQueue.length - 1, newIndex);
    }
    return {
      queue: newQueue,
      queueIndex: Math.max(-1, newIndex),
      currentSong: newQueue[newIndex] || null
    };
  }),

  clearQueue: () => set({ queue: [], queueIndex: -1, currentSong: null, isPlaying: false, progress: 0, duration: 0 }),

  toggleGapless: () => set(state => ({ gaplessEnabled: !state.gaplessEnabled })),
  clearPlayHistory: () => set({ playHistory: [] }),

  reorderQueue: (fromIndex, toIndex) => set(state => {
    const newQueue = [...state.queue];
    const [moved] = newQueue.splice(fromIndex, 1);
    newQueue.splice(toIndex, 0, moved);
    let newQueueIndex = state.queueIndex;
    if (state.queueIndex === fromIndex) {
      newQueueIndex = toIndex;
    } else if (fromIndex < state.queueIndex && toIndex >= state.queueIndex) {
      newQueueIndex--;
    } else if (fromIndex > state.queueIndex && toIndex <= state.queueIndex) {
      newQueueIndex++;
    }
    return { queue: newQueue, queueIndex: newQueueIndex };
  }),
}));
