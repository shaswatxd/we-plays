const initSqlJs = require('sql.js');
const path = require('path');
const fs = require('fs');
const { app } = require('electron');

let db = null;

function getDbPath() {
  const userDataPath = app.getPath('userData');
  return path.join(userDataPath, 'music.db');
}

async function initDatabase() {
  const SQL = await initSqlJs();
  const dbPath = getDbPath();

  try {
    if (fs.existsSync(dbPath)) {
      const fileBuffer = fs.readFileSync(dbPath);
      db = new SQL.Database(fileBuffer);
    } else {
      db = new SQL.Database();
    }
  } catch {
    db = new SQL.Database();
  }

  db.run(`
    CREATE TABLE IF NOT EXISTS songs (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      yt_id       TEXT UNIQUE,
      title       TEXT NOT NULL,
      artist      TEXT,
      album       TEXT,
      duration    INTEGER,
      file_path   TEXT NOT NULL,
      thumbnail   TEXT,
      format      TEXT DEFAULT 'mp3',
      quality     INTEGER DEFAULT 320,
      play_count  INTEGER DEFAULT 0,
      is_favorite INTEGER DEFAULT 0,
      date_added  TEXT DEFAULT (datetime('now')),
      last_played TEXT
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS playlists (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      name        TEXT NOT NULL,
      cover_path  TEXT,
      created_at  TEXT DEFAULT (datetime('now'))
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS playlist_songs (
      playlist_id INTEGER REFERENCES playlists(id) ON DELETE CASCADE,
      song_id     INTEGER REFERENCES songs(id) ON DELETE CASCADE,
      position    INTEGER,
      added_at    TEXT DEFAULT (datetime('now')),
      PRIMARY KEY (playlist_id, song_id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS play_history (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      song_id     INTEGER REFERENCES songs(id) ON DELETE CASCADE,
      played_at   TEXT DEFAULT (datetime('now'))
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS settings (
      key   TEXT PRIMARY KEY,
      value TEXT
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS bookmarks (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      song_id     INTEGER REFERENCES songs(id) ON DELETE CASCADE,
      position    REAL NOT NULL,
      label       TEXT DEFAULT '',
      created_at  TEXT DEFAULT (datetime('now'))
    )
  `);

  // Schema migrations for existing databases
  const migrations = [
    "ALTER TABLE songs ADD COLUMN replay_gain REAL DEFAULT 0",
    "ALTER TABLE songs ADD COLUMN rating INTEGER DEFAULT 0",
  ];
  for (const m of migrations) {
    try { db.run(m); } catch(_) { /* column already exists */ }
  }

  saveDb();
  return db;
}

function saveDb() {
  if (!db) return;
  const dbPath = getDbPath();
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(dbPath, buffer);
}

function getDb() {
  return db;
}

function queryAll(sql, params = []) {
  const stmt = db.prepare(sql);
  if (params.length) stmt.bind(params);
  const results = [];
  while (stmt.step()) {
    results.push(stmt.getAsObject());
  }
  stmt.free();
  return results;
}

function queryGet(sql, params = []) {
  const stmt = db.prepare(sql);
  if (params.length) stmt.bind(params);
  let result = null;
  if (stmt.step()) {
    result = stmt.getAsObject();
  }
  stmt.free();
  return result;
}

function runSql(sql, params = []) {
  db.run(sql, params);
  const lastId = db.exec("SELECT last_insert_rowid() as id");
  const idVal = lastId.length > 0 ? lastId[0].values[0][0] : null;
  saveDb();
  return idVal;
}

function getAllSongs() {
  return queryAll('SELECT * FROM songs ORDER BY date_added DESC');
}

function getSongById(id) {
  return queryGet('SELECT * FROM songs WHERE id = ?', [id]);
}

function addSong(song) {
  try {
    let existing = null;
    if (song.yt_id) {
      existing = queryGet('SELECT * FROM songs WHERE yt_id = ?', [song.yt_id]);
    }
    if (!existing && song.file_path) {
      existing = queryGet('SELECT * FROM songs WHERE file_path = ?', [song.file_path]);
    }
    if (!existing && song.title) {
      const cleanTitle = song.title.trim().toLowerCase();
      const cleanArtist = (song.artist || '').trim().toLowerCase();
      existing = queryGet('SELECT * FROM songs WHERE LOWER(TRIM(title)) = ? AND LOWER(TRIM(artist)) = ?', [cleanTitle, cleanArtist]);
    }

    if (existing) {
      if (existing.file_path && existing.file_path !== song.file_path && fs.existsSync(existing.file_path)) {
        try {
          fs.unlinkSync(existing.file_path);
        } catch (err) {
          console.error('Failed to delete duplicate physical file:', err);
        }
      }

      runSql(
        `UPDATE songs SET 
          yt_id = ?, 
          title = ?, 
          artist = ?, 
          album = ?, 
          duration = ?, 
          file_path = ?, 
          thumbnail = ?, 
          format = ?, 
          quality = ?,
          date_added = datetime('now')
         WHERE id = ?`,
        [
          song.yt_id || existing.yt_id,
          song.title || existing.title,
          song.artist || existing.artist,
          song.album || existing.album,
          song.duration || existing.duration,
          song.file_path || existing.file_path,
          song.thumbnail || existing.thumbnail,
          song.format || existing.format,
          song.quality || existing.quality,
          existing.id
        ]
      );
      return existing.id;
    }

    const id = runSql(
      'INSERT OR IGNORE INTO songs (yt_id, title, artist, album, duration, file_path, thumbnail, format, quality) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [song.yt_id, song.title, song.artist, song.album, song.duration, song.file_path, song.thumbnail, song.format, song.quality]
    );
    if (!id && song.yt_id) {
      const row = queryGet('SELECT id FROM songs WHERE yt_id = ?', [song.yt_id]);
      return row ? row.id : null;
    }
    return id;
  } catch (e) {
    console.error('Error in addSong:', e);
    return null;
  }
}

function addLocalSong(song) {
  try {
    const localId = 'local_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
    const id = runSql(
      'INSERT INTO songs (yt_id, title, artist, album, duration, file_path, thumbnail, format, quality) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [localId, song.title, song.artist, song.album, song.duration, song.file_path, '', song.format, song.quality]
    );
    return id;
  } catch (e) {
    console.error("addLocalSong error:", e.message || e);
    return null;
  }
}

function removeSong(id) {
  runSql('DELETE FROM songs WHERE id = ?', [id]);
}

function toggleFavorite(id) {
  const song = getSongById(id);
  if (!song) return null;
  const newVal = song.is_favorite ? 0 : 1;
  runSql('UPDATE songs SET is_favorite = ? WHERE id = ?', [newVal, id]);
  return newVal;
}

function updatePlayCount(id) {
  runSql('UPDATE songs SET play_count = play_count + 1, last_played = datetime("now") WHERE id = ?', [id]);
}

function updateSongMetadata(id, meta) {
  const fields = [];
  const values = [];
  if (meta.title !== undefined) { fields.push('title = ?'); values.push(meta.title); }
  if (meta.artist !== undefined) { fields.push('artist = ?'); values.push(meta.artist); }
  if (meta.album !== undefined) { fields.push('album = ?'); values.push(meta.album); }
  if (meta.duration !== undefined) { fields.push('duration = ?'); values.push(meta.duration); }
  if (meta.thumbnail !== undefined) { fields.push('thumbnail = ?'); values.push(meta.thumbnail); }
  if (fields.length === 0) return;
  values.push(id);
  runSql(`UPDATE songs SET ${fields.join(', ')} WHERE id = ?`, values);
}

function getFavorites() {
  return queryAll('SELECT * FROM songs WHERE is_favorite = 1 ORDER BY date_added DESC');
}

function addToHistory(songId) {
  runSql('INSERT INTO play_history (song_id) VALUES (?)', [songId]);
}

function getHistory() {
  return queryAll(`
    SELECT s.*, MAX(h.played_at) as played_at FROM songs s
    JOIN play_history h ON s.id = h.song_id
    GROUP BY s.id
    ORDER BY MAX(h.played_at) DESC
  `);
}

function getPlaylists() {
  return queryAll('SELECT * FROM playlists ORDER BY created_at DESC');
}

function createPlaylist(name, coverPath = null) {
  return runSql('INSERT INTO playlists (name, cover_path) VALUES (?, ?)', [name, coverPath]);
}

function deletePlaylist(id) {
  runSql('DELETE FROM playlist_songs WHERE playlist_id = ?', [id]);
  runSql('DELETE FROM playlists WHERE id = ?', [id]);
}

function addToPlaylist(playlistId, songId) {
  const existing = queryGet('SELECT 1 FROM playlist_songs WHERE playlist_id = ? AND song_id = ?', [playlistId, songId]);
  if (existing) return;
  const song = getSongById(songId);
  if (song) {
    const dup = queryGet(
      `SELECT ps.song_id FROM playlist_songs ps
       JOIN songs s ON s.id = ps.song_id
       WHERE ps.playlist_id = ? AND LOWER(TRIM(s.title)) = LOWER(TRIM(?)) AND LOWER(TRIM(s.artist)) = LOWER(TRIM(?))`,
      [playlistId, song.title, song.artist || '']
    );
    if (dup) return;
  }
  const maxPos = queryGet('SELECT MAX(position) as max FROM playlist_songs WHERE playlist_id = ?', [playlistId]);
  const position = (maxPos?.max ?? -1) + 1;
  runSql('INSERT OR IGNORE INTO playlist_songs (playlist_id, song_id, position) VALUES (?, ?, ?)', [playlistId, songId, position]);
}

function removeFromPlaylist(playlistId, songId) {
  runSql('DELETE FROM playlist_songs WHERE playlist_id = ? AND song_id = ?', [playlistId, songId]);
}

function getPlaylistSongs(playlistId) {
  return queryAll(`
    SELECT s.*, ps.position, ps.added_at FROM songs s
    JOIN playlist_songs ps ON s.id = ps.song_id
    WHERE ps.playlist_id = ?
    ORDER BY ps.position
  `, [playlistId]);
}

function getSettings() {
  const rows = queryAll('SELECT * FROM settings');
  const settings = {};
  rows.forEach(r => { settings[r.key] = r.value; });
  return settings;
}

function setSetting(key, value) {
  runSql('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', [key, value]);
}

function clearHistory() {
  runSql('DELETE FROM play_history');
}

function extractSongName(title) {
  if (!title) return '';
  let t = title.trim().toLowerCase();
  t = t.replace(/^\d+\s*[-–.]\s*/, '');
  t = t.replace(/\(.*?\)/g, '');
  t = t.replace(/\[.*?\]/g, '');
  t = t.replace(/\bwith lyrics?\b/gi, '');
  t = t.replace(/\bofficial\b/gi, '');
  t = t.replace(/\bvideo\b/gi, '');
  t = t.replace(/\baudio\b/gi, '');
  t = t.replace(/\blyrics?\b/gi, '');
  t = t.replace(/\bhd\b/gi, '');
  t = t.replace(/\b4k\b/gi, '');
  t = t.replace(/\bfull song\b/gi, '');
  t = t.replace(/\bfrom\b/gi, '');
  const pipes = t.split('|').map(p => p.trim()).filter(Boolean);
  if (pipes.length >= 1) t = pipes[0];
  t = t.replace(/[-–—]+$/g, '');
  t = t.replace(/\s+/g, ' ').trim();
  return t;
}

function findDuplicates() {
  try {
    const allSongs = queryAll('SELECT * FROM songs ORDER BY date_added DESC');
    if (!allSongs || allSongs.length === 0) return [];

    const groups = {};
    allSongs.forEach(song => {
      const titleKey = (song.title || '').trim().toLowerCase();
      const artistKey = (song.artist || '').trim().toLowerCase();
      if (!titleKey) return;
      const key = `${titleKey}|||${artistKey}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(song);
    });

    const duplicates = [];
    for (const group of Object.values(groups)) {
      if (group.length <= 1) continue;
      group.sort((a, b) => {
        if (a.is_favorite !== b.is_favorite) return b.is_favorite - a.is_favorite;
        let aExists = 0, bExists = 0;
        try { aExists = a.file_path && fs.existsSync(a.file_path) ? 1 : 0; } catch {}
        try { bExists = b.file_path && fs.existsSync(b.file_path) ? 1 : 0; } catch {}
        if (aExists !== bExists) return bExists - aExists;
        return new Date(b.date_added || 0) - new Date(a.date_added || 0);
      });
      duplicates.push({ keep: group[0], remove: group.slice(1) });
    }

    const fpGroups = {};
    allSongs.forEach(song => {
      if (!song.file_path) return;
      if (!fpGroups[song.file_path]) fpGroups[song.file_path] = [];
      fpGroups[song.file_path].push(song);
    });

    for (const group of Object.values(fpGroups)) {
      if (group.length <= 1) continue;
      group.sort((a, b) => {
        if (a.is_favorite !== b.is_favorite) return b.is_favorite - a.is_favorite;
        return new Date(b.date_added || 0) - new Date(a.date_added || 0);
      });
      const alreadyFound = duplicates.some(d => d.keep.id === group[0].id);
      if (!alreadyFound) {
        duplicates.push({ keep: group[0], remove: group.slice(1) });
      } else {
        const existing = duplicates.find(d => d.keep.id === group[0].id);
        for (const extra of group.slice(1)) {
          if (!existing.remove.some(r => r.id === extra.id)) {
            existing.remove.push(extra);
          }
        }
      }
    }

    const nameGroups = {};
    allSongs.forEach(song => {
      const name = extractSongName(song.title);
      if (!name || name.length < 3) return;
      if (!nameGroups[name]) nameGroups[name] = [];
      nameGroups[name].push(song);
    });

    for (const group of Object.values(nameGroups)) {
      if (group.length <= 1) continue;
      group.sort((a, b) => {
        if (a.is_favorite !== b.is_favorite) return b.is_favorite - a.is_favorite;
        let aExists = 0, bExists = 0;
        try { aExists = a.file_path && fs.existsSync(a.file_path) ? 1 : 0; } catch {}
        try { bExists = b.file_path && fs.existsSync(b.file_path) ? 1 : 0; } catch {}
        if (aExists !== bExists) return bExists - aExists;
        return new Date(b.date_added || 0) - new Date(a.date_added || 0);
      });

      const filtered = group.filter((song, idx) => {
        if (idx === 0) return true;
        const keepSong = group[0];
        const durA = keepSong.duration || 0;
        const durB = song.duration || 0;
        if (durA > 0 && durB > 0 && Math.abs(durA - durB) > 30) return false;
        return true;
      });

      if (filtered.length <= 1) continue;

      const alreadyFound = duplicates.some(d => d.keep.id === filtered[0].id);
      if (!alreadyFound) {
        duplicates.push({ keep: filtered[0], remove: filtered.slice(1) });
      } else {
        const existing = duplicates.find(d => d.keep.id === filtered[0].id);
        for (const extra of filtered.slice(1)) {
          if (!existing.remove.some(r => r.id === extra.id)) {
            existing.remove.push(extra);
          }
        }
      }
    }

    return duplicates;
  } catch (e) {
    console.error('findDuplicates error:', e);
    return [];
  }
}

function removeDuplicateSongs(songIds) {
  for (const id of songIds) {
    try {
      const playlistsWithDup = queryAll('SELECT playlist_id FROM playlist_songs WHERE song_id = ?', [id]);
      for (const p of playlistsWithDup) {
        runSql('DELETE FROM playlist_songs WHERE playlist_id = ? AND song_id = ?', [p.playlist_id, id]);
      }
      runSql('DELETE FROM play_history WHERE song_id = ?', [id]);
      runSql('DELETE FROM songs WHERE id = ?', [id]);
    } catch (err) {
      console.error('Failed to remove duplicate song:', id, err);
    }
  }
  saveDb();
}

function renamePlaylist(id, newName) {
  runSql('UPDATE playlists SET name = ? WHERE id = ?', [newName, id]);
}

function reorderPlaylistSongs(playlistId, songIds) {
  for (let i = 0; i < songIds.length; i++) {
    runSql('UPDATE playlist_songs SET position = ? WHERE playlist_id = ? AND song_id = ?', [i, playlistId, songIds[i]]);
  }
}

function searchAllSongs(query) {
  const songs = queryAll('SELECT * FROM songs WHERE title LIKE ? OR artist LIKE ? OR album LIKE ?', [`%${query}%`, `%${query}%`, `%${query}%`]);
  const playlists = queryAll('SELECT * FROM playlists WHERE name LIKE ?', [`%${query}%`]);
  const history = queryAll(`
    SELECT s.*, MAX(h.played_at) as played_at FROM songs s
    JOIN play_history h ON s.id = h.song_id
    WHERE s.title LIKE ? OR s.artist LIKE ?
    GROUP BY s.id ORDER BY MAX(h.played_at) DESC LIMIT 20
  `, [`%${query}%`, `%${query}%`]);
  return { songs, playlists, history };
}

function exportLibrary() {
  const songs = queryAll('SELECT * FROM songs ORDER BY date_added DESC');
  const playlists = queryAll('SELECT * FROM playlists ORDER BY created_at DESC');
  const playlistSongs = queryAll('SELECT * FROM playlist_songs ORDER BY playlist_id, position');
  return { songs, playlists, playlistSongs, exportedAt: new Date().toISOString(), version: 1 };
}

function importLibrary(data) {
  let imported = 0;
  if (data.songs) {
    for (const song of data.songs) {
      try {
        const existing = queryGet('SELECT id FROM songs WHERE file_path = ?', [song.file_path]);
        if (!existing) {
          runSql(
            'INSERT INTO songs (yt_id, title, artist, album, duration, file_path, thumbnail, format, quality, play_count, is_favorite, date_added, last_played) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [song.yt_id, song.title, song.artist, song.album, song.duration, song.file_path, song.thumbnail, song.format, song.quality, song.play_count || 0, song.is_favorite || 0, song.date_added, song.last_played]
          );
          imported++;
        }
      } catch (e) { /* skip duplicates */ }
    }
  }
  saveDb();
  return { imported };
}

function findOrphanedSongs() {
  try {
    const allSongs = queryAll('SELECT * FROM songs ORDER BY date_added DESC');
    return allSongs.filter(song => {
      if (!song.file_path) return true;
      try {
        return !fs.existsSync(song.file_path);
      } catch {
        return true;
      }
    });
  } catch (e) {
    console.error('findOrphanedSongs error:', e);
    return [];
  }
}

function removeOrphanedSongs(songIds) {
  for (const id of songIds) {
    try {
      runSql('DELETE FROM playlist_songs WHERE song_id = ?', [id]);
      runSql('DELETE FROM play_history WHERE song_id = ?', [id]);
      runSql('DELETE FROM bookmarks WHERE song_id = ?', [id]);
      runSql('DELETE FROM songs WHERE id = ?', [id]);
    } catch (err) {
      console.error('Failed to remove orphaned song:', id, err);
    }
  }
  saveDb();
}

function findDuplicatePlaylists() {
  try {
    const allPlaylists = queryAll('SELECT * FROM playlists ORDER BY created_at DESC');
    const groups = {};
    allPlaylists.forEach(pl => {
      const key = (pl.name || '').trim().toLowerCase();
      if (!key) return;
      if (!groups[key]) groups[key] = [];
      groups[key].push(pl);
    });
    const duplicates = [];
    for (const group of Object.values(groups)) {
      if (group.length <= 1) continue;
      group.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
      duplicates.push({ keep: group[0], remove: group.slice(1) });
    }
    return duplicates;
  } catch (e) {
    console.error('findDuplicatePlaylists error:', e);
    return [];
  }
}

function removeDuplicatePlaylists(playlistIds) {
  for (const id of playlistIds) {
    try {
      runSql('DELETE FROM playlist_songs WHERE playlist_id = ?', [id]);
      runSql('DELETE FROM playlists WHERE id = ?', [id]);
    } catch (err) {
      console.error('Failed to remove duplicate playlist:', id, err);
    }
  }
  saveDb();
}

function updateSongGain(id, gain) {
  runSql('UPDATE songs SET replay_gain = ? WHERE id = ?', [gain, id]);
}

function updateSongRating(id, rating) {
  runSql('UPDATE songs SET rating = ? WHERE id = ?', [rating, id]);
}

function getListeningStats() {
  try {
    const totalSongs = queryGet('SELECT COUNT(*) as c FROM songs')?.c || 0;
    const totalPlaylists = queryGet('SELECT COUNT(*) as c FROM playlists')?.c || 0;
    const totalFavorites = queryGet('SELECT COUNT(*) as c FROM songs WHERE is_favorite = 1')?.c || 0;
    const totalPlays = queryGet('SELECT SUM(play_count) as c FROM songs')?.c || 0;
    const totalDuration = queryGet('SELECT SUM(duration * play_count) as c FROM songs')?.c || 0;

    const topSongs = queryAll(`
      SELECT id, title, artist, thumbnail, play_count, duration
      FROM songs WHERE play_count > 0
      ORDER BY play_count DESC LIMIT 10
    `);

    // Top artists by total play_count
    const topArtists = queryAll(`
      SELECT artist, SUM(play_count) as total_plays, COUNT(*) as song_count
      FROM songs WHERE play_count > 0 AND artist IS NOT NULL AND artist != ''
      GROUP BY LOWER(TRIM(artist))
      ORDER BY total_plays DESC LIMIT 8
    `);

    // Daily listening for last 7 days (play events count)
    const dailyListening = queryAll(`
      SELECT DATE(played_at) as day, COUNT(*) as plays
      FROM play_history
      WHERE played_at >= datetime('now', '-7 days')
      GROUP BY DATE(played_at)
      ORDER BY day ASC
    `);

    // Recently added songs
    const recentlyAdded = queryAll(`
      SELECT id, title, artist, thumbnail, date_added
      FROM songs ORDER BY date_added DESC LIMIT 5
    `);

    // Most played today
    const playedToday = queryGet(`
      SELECT COUNT(*) as c FROM play_history
      WHERE DATE(played_at) = DATE('now')
    `)?.c || 0;

    return {
      totalSongs, totalPlaylists, totalFavorites, totalPlays, totalDuration,
      topSongs, topArtists, dailyListening, recentlyAdded, playedToday
    };
  } catch(e) {
    console.error('getListeningStats error:', e);
    return { totalSongs:0, totalPlaylists:0, totalFavorites:0, totalPlays:0, totalDuration:0, topSongs:[], topArtists:[], dailyListening:[], recentlyAdded:[], playedToday:0 };
  }
}


module.exports = {
  initDatabase, getAllSongs, getSongById, addSong, addLocalSong, removeSong,
  toggleFavorite, updatePlayCount, updateSongMetadata, updateSongGain, updateSongRating, getFavorites,
  addToHistory, getHistory, clearHistory, findDuplicates, removeDuplicateSongs,
  getPlaylists, createPlaylist, deletePlaylist, addToPlaylist,
  removeFromPlaylist, getPlaylistSongs,
  getSettings, setSetting, saveDb,
  renamePlaylist, reorderPlaylistSongs, searchAllSongs,
  exportLibrary, importLibrary,
  findOrphanedSongs, removeOrphanedSongs, findDuplicatePlaylists, removeDuplicatePlaylists,
  getListeningStats,
};
