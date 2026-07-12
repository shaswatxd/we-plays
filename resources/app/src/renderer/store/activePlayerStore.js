import { create } from 'zustand';

export const useActivePlayerStore = create((set) => ({
  active: 'music',
  setActive: (active) => set({ active }),
}));
