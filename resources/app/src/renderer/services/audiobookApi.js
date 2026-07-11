// Service layer for the LibriVox audiobook catalog.
// All network I/O happens in the main process (see src/main/librivox.js);
// this module is a thin, cached, retrying wrapper around window.electronAPI.

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const cache = new Map();

function cacheKey(name, params) {
  return `${name}:${JSON.stringify(params || {})}`;
}

function getCached(key) {
  const entry = cache.get(key);
  if (entry && Date.now() - entry.ts < CACHE_TTL) return entry.data;
  return undefined;
}

function setCached(key, data) {
  cache.set(key, { data, ts: Date.now() });
  if (cache.size > 200) {
    const firstKey = cache.keys().next().value;
    cache.delete(firstKey);
  }
}

function api() {
  if (!window.electronAPI) throw new Error('Electron API not available');
  return window.electronAPI;
}

async function withRetry(fn, retries = 1) {
  try {
    return await fn();
  } catch (err) {
    if (retries <= 0) throw err;
    await new Promise(r => setTimeout(r, 600));
    return withRetry(fn, retries - 1);
  }
}

export function debounce(fn, wait = 350) {
  let timer = null;
  const debounced = (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), wait);
  };
  debounced.cancel = () => clearTimeout(timer);
  return debounced;
}

export async function searchAudiobooks(params) {
  const key = cacheKey('search', params);
  const cached = getCached(key);
  if (cached) return cached;
  const result = await withRetry(() => api().audiobookSearch(params));
  setCached(key, result);
  return result;
}

export async function getAudiobookById(id) {
  const key = cacheKey('book', { id });
  const cached = getCached(key);
  if (cached) return cached;
  const result = await withRetry(() => api().audiobookGetBook(id));
  setCached(key, result);
  return result;
}

export async function searchAuthors(name) {
  const key = cacheKey('authors', { name });
  const cached = getCached(key);
  if (cached) return cached;
  const result = await withRetry(() => api().audiobookSearchAuthors(name));
  setCached(key, result);
  return result;
}

export function clearAudiobookCache() {
  cache.clear();
}

export const AUDIOBOOK_GENRES = [
  'Fiction', 'Non-fiction', 'Poetry', 'Drama', 'Short Stories',
  'Adventure', 'Mystery', 'Fantastic Fiction', "Children's Fiction",
  'Action & Adventure Fiction', 'Historical Fiction', 'Horror & Supernatural Fiction',
  'Myths, Legends & Fairy Tales', 'Philosophy', 'Religion', 'Science Fiction',
  'Biography & Autobiography', 'History', 'Essays & Short Nonfiction',
  'Nature', 'Travel & Geography', 'Romance', 'Western Fiction', 'War & Military Fiction'
];

export const AUDIOBOOK_LANGUAGES = [
  'English', 'French', 'German', 'Spanish', 'Italian', 'Portuguese',
  'Dutch', 'Russian', 'Latin', 'Japanese', 'Chinese', 'Swedish', 'Finnish'
];

export function formatDuration(totalSeconds) {
  const secs = Math.max(0, Math.floor(totalSeconds || 0));
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function formatDurationLong(totalSeconds) {
  const secs = Math.max(0, Math.floor(totalSeconds || 0));
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  if (h > 0) return `${h} hr ${m} min`;
  return `${m} min`;
}
