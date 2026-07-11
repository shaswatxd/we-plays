const https = require('https');

// In-memory response cache (key = request path, value = { data, ts })
const apiCache = new Map();
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes

const HOST = 'librivox.org';

function httpGetJson(pathAndQuery) {
  const cached = apiCache.get(pathAndQuery);
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return Promise.resolve(cached.data);
  }

  return new Promise((resolve, reject) => {
    const options = {
      hostname: HOST,
      path: pathAndQuery,
      headers: { 'User-Agent': 'WePlays-App/2.0 (Audiobooks)' }
    };

    const req = https.get(options, (res) => {
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume();
        const loc = res.headers.location;
        const url = loc.startsWith('http') ? new URL(loc) : null;
        httpGetJson(url ? url.pathname + url.search : loc).then(resolve).catch(reject);
        return;
      }
      if (res.statusCode !== 200) {
        res.resume();
        reject(new Error(`LibriVox API returned status ${res.statusCode}`));
        return;
      }
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        try {
          const data = JSON.parse(body);
          apiCache.set(pathAndQuery, { data, ts: Date.now() });
          if (apiCache.size > 100) {
            const firstKey = apiCache.keys().next().value;
            apiCache.delete(firstKey);
          }
          resolve(data);
        } catch (e) {
          reject(new Error('Failed to parse LibriVox response'));
        }
      });
    });

    req.setTimeout(15000, () => {
      req.destroy(new Error('LibriVox request timed out'));
    });
    req.on('error', (err) => reject(new Error(`LibriVox request failed: ${err.message}`)));
  });
}

function normalizeBook(raw) {
  if (!raw) return null;
  const sections = Array.isArray(raw.sections) ? raw.sections : [];
  return {
    id: String(raw.id),
    title: raw.title || 'Untitled',
    description: (raw.description || '').replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '').trim(),
    language: raw.language || 'English',
    copyrightYear: raw.copyright_year || '',
    totalTime: raw.totaltime || '',
    totalTimeSecs: parseInt(raw.totaltimesecs, 10) || 0,
    numSections: parseInt(raw.num_sections, 10) || sections.length,
    urlLibrivox: raw.url_librivox || '',
    urlIarchive: raw.url_iarchive || '',
    urlRss: raw.url_rss || '',
    coverArt: raw.coverart_jpg || raw.coverart_thumbnail || '',
    coverArtThumbnail: raw.coverart_thumbnail || raw.coverart_jpg || '',
    authors: (raw.authors || []).map(a => ({
      id: String(a.id),
      name: [a.first_name, a.last_name].filter(Boolean).join(' ').trim() || 'Unknown Author'
    })),
    genres: (raw.genres || []).map(g => ({ id: String(g.id), name: g.name })),
    chapters: sections
      .map(s => ({
        id: String(s.id),
        index: parseInt(s.section_number, 10) - 1,
        title: s.title || `Chapter ${s.section_number}`,
        listenUrl: s.listen_url || '',
        playtimeSecs: parseInt(s.playtime, 10) || 0,
        readers: (s.readers || []).map(r => r.display_name).filter(Boolean)
      }))
      .sort((a, b) => a.index - b.index)
  };
}

function buildQuery(params) {
  const parts = [];
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    parts.push(`${key}=${encodeURIComponent(value)}`);
  }
  return parts.join('&');
}

async function searchAudiobooks({ title, author, genre, offset = 0, limit = 24 } = {}) {
  const query = buildQuery({
    title: title ? `^${title}` : undefined,
    author: author ? `^${author}` : undefined,
    genre: genre ? `^${genre}` : undefined,
    offset,
    limit,
    extended: 1,
    coverart: 1,
    format: 'json'
  });
  const data = await httpGetJson(`/api/feed/audiobooks/?${query}`);
  const books = (data.books || []).map(normalizeBook).filter(Boolean);
  return { books, hasMore: books.length === limit };
}

async function getAudiobookById(id) {
  const query = buildQuery({ id, extended: 1, coverart: 1, format: 'json' });
  const data = await httpGetJson(`/api/feed/audiobooks/?${query}`);
  const raw = (data.books || [])[0];
  if (!raw) throw new Error('Audiobook not found');
  return normalizeBook(raw);
}

async function searchAuthors(name, limit = 40) {
  const query = buildQuery({ author: `^${name}`, extended: 1, limit: 60, format: 'json' });
  const data = await httpGetJson(`/api/feed/audiobooks/?${query}`);
  const books = (data.books || []).map(normalizeBook).filter(Boolean);
  const seen = new Map();
  for (const book of books) {
    for (const a of book.authors) {
      if (!seen.has(a.id)) seen.set(a.id, { ...a, bookCount: 0, sampleBookId: book.id, sampleCover: book.coverArtThumbnail });
      seen.get(a.id).bookCount++;
    }
  }
  return Array.from(seen.values())
    .filter(a => a.name.toLowerCase().includes(name.toLowerCase()))
    .slice(0, limit);
}

module.exports = { searchAudiobooks, getAudiobookById, searchAuthors };
