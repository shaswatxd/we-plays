import { create } from 'zustand';

// Tracks which player (music vs. audiobook) currently owns the bottom player bar.
export const useActivePlayerStore = create((set) => ({
  active: 'music', // 'music' | 'audiobook'
  setActive: (active) => set({ active }),
}));
