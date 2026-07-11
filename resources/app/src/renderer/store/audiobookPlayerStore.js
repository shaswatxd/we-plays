import { create } from 'zustand';
import { usePlayerStore } from './playerStore';
import { useActivePlayerStore } from './activePlayerStore';

const PLAYBACK_RATES = [0.5, 0.75, 1, 1.25, 1.5, 2, 3];

export const useAudiobookPlayerStore = create((set, get) => ({
  currentBook: null,
  chapterIndex: 0,
  isPlaying: false,
  progress: 0,
  duration: 0,
  volume: 0.9,
  isMuted: false,
  playbackRate: 1,
  sleepTimerEndAt: null,
  sleepTimerMinutes: null,
  playTrigger: 0,
  startAtPosition: 0,
  howl: null,

  setHowl: (howl) => set({ howl }),

  playBook: (book, chapterIndex = 0, startPosition = 0) => {
    if (!book?.chapters?.length) return;
    const clampedIndex = Math.max(0, Math.min(chapterIndex, book.chapters.length - 1));

    // Pause the music player — only one active audio source at a time.
    const musicState = usePlayerStore.getState();
    if (musicState.isPlaying) {
      musicState.howl?.pause();
      usePlayerStore.setState({ isPlaying: false });
    }
    useActivePlayerStore.getState().setActive('audiobook');

    set(state => ({
      currentBook: book,
      chapterIndex: clampedIndex,
      isPlaying: true,
      progress: startPosition,
      startAtPosition: startPosition,
      duration: 0,
      playTrigger: state.playTrigger + 1
    }));

    window.electronAPI?.audiobookAddHistory(book.id, book);
    window.electronAPI?.audiobookSaveProgress(book.id, clampedIndex, startPosition, 0, book);
  },

  togglePlay: () => {
    const { isPlaying, howl } = get();
    if (howl) isPlaying ? howl.pause() : howl.play();
    set({ isPlaying: !isPlaying });
  },

  seekTo: (seconds) => {
    const { howl } = get();
    if (howl) howl.seek(seconds);
    set({ progress: seconds });
  },

  skipBy: (seconds) => {
    const { howl, progress, duration } = get();
    const target = Math.max(0, Math.min(duration || Infinity, progress + seconds));
    if (howl) howl.seek(target);
    set({ progress: target });
  },

  nextChapter: () => {
    const { currentBook, chapterIndex } = get();
    if (!currentBook) return;
    const nextIdx = chapterIndex + 1;
    if (nextIdx >= currentBook.chapters.length) {
      set({ isPlaying: false });
      return;
    }
    set(state => ({ chapterIndex: nextIdx, progress: 0, startAtPosition: 0, duration: 0, isPlaying: true, playTrigger: state.playTrigger + 1 }));
    window.electronAPI?.audiobookSaveProgress(currentBook.id, nextIdx, 0, 0, currentBook);
  },

  previousChapter: () => {
    const { currentBook, chapterIndex, progress } = get();
    if (!currentBook) return;
    if (progress > 3 || chapterIndex === 0) {
      const { howl } = get();
      if (howl) howl.seek(0);
      set({ progress: 0 });
      return;
    }
    const prevIdx = chapterIndex - 1;
    set(state => ({ chapterIndex: prevIdx, progress: 0, startAtPosition: 0, duration: 0, isPlaying: true, playTrigger: state.playTrigger + 1 }));
    window.electronAPI?.audiobookSaveProgress(currentBook.id, prevIdx, 0, 0, currentBook);
  },

  setVolume: (vol) => {
    const { howl } = get();
    if (howl) howl.volume(vol);
    set({ volume: vol, isMuted: vol === 0 });
  },

  toggleMute: () => {
    const { isMuted, howl } = get();
    if (howl) howl.mute(!isMuted);
    set({ isMuted: !isMuted });
  },

  setPlaybackRate: (rate) => {
    const { howl } = get();
    if (howl) howl.rate(rate);
    set({ playbackRate: rate });
  },

  setSleepTimer: (minutes) => {
    if (!minutes) {
      set({ sleepTimerEndAt: null, sleepTimerMinutes: null });
      return;
    }
    set({ sleepTimerEndAt: Date.now() + minutes * 60 * 1000, sleepTimerMinutes: minutes });
  },

  clearSleepTimer: () => set({ sleepTimerEndAt: null, sleepTimerMinutes: null }),

  setProgress: (progress) => set({ progress }),
  setDuration: (duration) => set({ duration }),

  saveBookmark: async (label) => {
    const { currentBook, chapterIndex, progress } = get();
    if (!currentBook) return;
    await window.electronAPI?.audiobookSaveBookmark(currentBook.id, chapterIndex, progress || 0, label || '');
  },

  persistProgress: () => {
    const { currentBook, chapterIndex, progress, duration } = get();
    if (!currentBook) return;
    window.electronAPI?.audiobookSaveProgress(currentBook.id, chapterIndex, progress, duration, currentBook);
  },

  closePlayer: () => {
    const { howl } = get();
    try { howl?.stop(); howl?.unload(); } catch {}
    set({ currentBook: null, howl: null, isPlaying: false, progress: 0, duration: 0 });
  },
}));

export { PLAYBACK_RATES };
