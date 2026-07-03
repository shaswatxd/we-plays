use rusqlite::{params, Connection, Result as SqlResult};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Song {
    pub id: String,
    pub yt_id: Option<String>,
    pub title: String,
    pub artist: Option<String>,
    pub album: Option<String>,
    pub duration: Option<i64>,
    pub file_path: String,
    pub thumbnail: Option<String>,
    pub format: Option<String>,
    pub quality: Option<String>,
    pub play_count: i32,
    pub is_favorite: bool,
    pub date_added: Option<String>,
    pub last_played: Option<String>,
    pub replay_gain: f64,
    pub rating: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Playlist {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    pub created_at: Option<String>,
    pub updated_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlaylistSong {
    pub id: String,
    pub playlist_id: String,
    pub song_id: String,
    pub position: i32,
    pub added_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlayHistoryEntry {
    pub id: String,
    pub song_id: String,
    pub played_at: Option<String>,
    pub duration_played: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Bookmark {
    pub id: String,
    pub song_id: String,
    pub position: f64,
    pub label: Option<String>,
    pub created_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BookmarkWithSong {
    pub id: String,
    pub song_id: String,
    pub position: f64,
    pub label: Option<String>,
    pub created_at: Option<String>,
    pub song_title: String,
    pub song_artist: Option<String>,
    pub song_file_path: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchResult {
    pub id: String,
    pub title: String,
    pub channel: String,
    pub duration: Option<i64>,
    pub thumbnail: Option<String>,
    pub url: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchResultPage {
    pub results: Vec<SearchResult>,
    pub has_more: bool,
    pub page: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GlobalSearchResult {
    pub songs: Vec<Song>,
    pub playlists: Vec<Playlist>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SmartPlaylist {
    pub id: String,
    pub name: String,
    pub description: String,
    pub song_count: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ListeningStats {
    pub total_songs: i32,
    pub total_playlists: i32,
    pub total_plays: i32,
    pub total_listening_time: i64,
    pub favorite_count: i32,
    pub average_rating: f64,
    pub top_artists: Vec<ArtistStat>,
    pub top_songs: Vec<Song>,
    pub recent_activity: Vec<PlayHistoryEntry>,
    pub plays_by_day: Vec<DayPlays>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ArtistStat {
    pub artist: String,
    pub play_count: i32,
    pub song_count: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DayPlays {
    pub date: String,
    pub count: i32,
}

pub fn init_database(conn: &Connection) -> SqlResult<()> {
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS songs (
            id TEXT PRIMARY KEY,
            yt_id TEXT,
            title TEXT NOT NULL,
            artist TEXT,
            album TEXT,
            duration INTEGER,
            file_path TEXT NOT NULL,
            thumbnail TEXT,
            format TEXT,
            quality TEXT,
            play_count INTEGER DEFAULT 0,
            is_favorite INTEGER DEFAULT 0,
            date_added TEXT,
            last_played TEXT,
            replay_gain REAL DEFAULT 0,
            rating INTEGER DEFAULT 0
        );

        CREATE TABLE IF NOT EXISTS playlists (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            description TEXT,
            created_at TEXT,
            updated_at TEXT
        );

        CREATE TABLE IF NOT EXISTS playlist_songs (
            id TEXT PRIMARY KEY,
            playlist_id TEXT NOT NULL,
            song_id TEXT NOT NULL,
            position INTEGER NOT NULL,
            added_at TEXT,
            FOREIGN KEY (playlist_id) REFERENCES playlists(id) ON DELETE CASCADE,
            FOREIGN KEY (song_id) REFERENCES songs(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS play_history (
            id TEXT PRIMARY KEY,
            song_id TEXT NOT NULL,
            played_at TEXT,
            duration_played INTEGER,
            FOREIGN KEY (song_id) REFERENCES songs(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS bookmarks (
            id TEXT PRIMARY KEY,
            song_id TEXT NOT NULL,
            position REAL NOT NULL,
            label TEXT,
            created_at TEXT,
            FOREIGN KEY (song_id) REFERENCES songs(id) ON DELETE CASCADE
        );

        CREATE INDEX IF NOT EXISTS idx_songs_title ON songs(title);
        CREATE INDEX IF NOT EXISTS idx_songs_artist ON songs(artist);
        CREATE INDEX IF NOT EXISTS idx_songs_play_count ON songs(play_count DESC);
        CREATE INDEX IF NOT EXISTS idx_songs_rating ON songs(rating DESC);
        CREATE INDEX IF NOT EXISTS idx_songs_is_favorite ON songs(is_favorite);
        CREATE INDEX IF NOT EXISTS idx_songs_date_added ON songs(date_added DESC);
        CREATE INDEX IF NOT EXISTS idx_songs_last_played ON songs(last_played DESC);
        CREATE INDEX IF NOT EXISTS idx_songs_file_path ON songs(file_path);
        CREATE INDEX IF NOT EXISTS idx_songs_yt_id ON songs(yt_id);
        CREATE INDEX IF NOT EXISTS idx_playlist_songs_playlist_id ON playlist_songs(playlist_id);
        CREATE INDEX IF NOT EXISTS idx_playlist_songs_position ON playlist_songs(playlist_id, position);
        CREATE INDEX IF NOT EXISTS idx_play_history_song_id ON play_history(song_id);
        CREATE INDEX IF NOT EXISTS idx_play_history_played_at ON play_history(played_at DESC);
        CREATE INDEX IF NOT EXISTS idx_bookmarks_song_id ON bookmarks(song_id);",
    )?;
    Ok(())
}

fn row_to_song(row: &rusqlite::Row) -> rusqlite::Result<Song> {
    Ok(Song {
        id: row.get(0)?,
        yt_id: row.get(1)?,
        title: row.get(2)?,
        artist: row.get(3)?,
        album: row.get(4)?,
        duration: row.get(5)?,
        file_path: row.get(6)?,
        thumbnail: row.get(7)?,
        format: row.get(8)?,
        quality: row.get(9)?,
        play_count: row.get::<_, i32>(10).unwrap_or(0),
        is_favorite: row.get::<_, i32>(11).unwrap_or(0) != 0,
        date_added: row.get(12)?,
        last_played: row.get(13)?,
        replay_gain: row.get::<_, f64>(14).unwrap_or(0.0),
        rating: row.get::<_, i32>(15).unwrap_or(0),
    })
}

pub fn get_all_songs(conn: &Connection) -> SqlResult<Vec<Song>> {
    let mut stmt = conn.prepare(
        "SELECT id, yt_id, title, artist, album, duration, file_path, thumbnail, format, quality, play_count, is_favorite, date_added, last_played, replay_gain, rating FROM songs ORDER BY title ASC"
    )?;
    let songs = stmt.query_map([], row_to_song)?.collect::<SqlResult<Vec<_>>>()?;
    Ok(songs)
}

pub fn get_song_by_id(conn: &Connection, id: &str) -> SqlResult<Option<Song>> {
    let mut stmt = conn.prepare(
        "SELECT id, yt_id, title, artist, album, duration, file_path, thumbnail, format, quality, play_count, is_favorite, date_added, last_played, replay_gain, rating FROM songs WHERE id = ?1"
    )?;
    let mut songs = stmt.query_map(params![id], row_to_song)?;
    Ok(songs.next().transpose()?)
}

pub fn add_song(conn: &Connection, song: &Song) -> SqlResult<()> {
    conn.execute(
        "INSERT OR REPLACE INTO songs (id, yt_id, title, artist, album, duration, file_path, thumbnail, format, quality, play_count, is_favorite, date_added, last_played, replay_gain, rating) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16)",
        params![
            song.id,
            song.yt_id,
            song.title,
            song.artist,
            song.album,
            song.duration,
            song.file_path,
            song.thumbnail,
            song.format,
            song.quality,
            song.play_count,
            song.is_favorite as i32,
            song.date_added,
            song.last_played,
            song.replay_gain,
            song.rating,
        ],
    )?;
    Ok(())
}

pub fn remove_song(conn: &Connection, id: &str) -> SqlResult<()> {
    conn.execute("DELETE FROM songs WHERE id = ?1", params![id])?;
    Ok(())
}

pub fn toggle_favorite(conn: &Connection, id: &str) -> SqlResult<bool> {
    let current: i32 =
        conn.query_row("SELECT is_favorite FROM songs WHERE id = ?1", params![id], |r| {
            r.get(0)
        })?;
    let new_val = if current == 0 { 1 } else { 0 };
    conn.execute(
        "UPDATE songs SET is_favorite = ?1 WHERE id = ?2",
        params![new_val, id],
    )?;
    Ok(new_val == 1)
}

pub fn update_play_count(conn: &Connection, id: &str) -> SqlResult<i32> {
    conn.execute(
        "UPDATE songs SET play_count = play_count + 1, last_played = datetime('now') WHERE id = ?1",
        params![id],
    )?;
    conn.query_row(
        "SELECT play_count FROM songs WHERE id = ?1",
        params![id],
        |r| r.get::<_, i32>(0),
    )
}

pub fn update_song_gain(conn: &Connection, id: &str, gain: f64) -> SqlResult<()> {
    conn.execute(
        "UPDATE songs SET replay_gain = ?1 WHERE id = ?2",
        params![gain, id],
    )?;
    Ok(())
}

pub fn update_song_rating(conn: &Connection, id: &str, rating: i32) -> SqlResult<()> {
    conn.execute(
        "UPDATE songs SET rating = ?1 WHERE id = ?2",
        params![rating, id],
    )?;
    Ok(())
}

pub fn update_song_metadata(
    conn: &Connection,
    id: &str,
    title: Option<&str>,
    artist: Option<&str>,
    album: Option<&str>,
) -> SqlResult<()> {
    if let Some(t) = title {
        conn.execute("UPDATE songs SET title = ?1 WHERE id = ?2", params![t, id])?;
    }
    if let Some(a) = artist {
        conn.execute(
            "UPDATE songs SET artist = ?1 WHERE id = ?2",
            params![a, id],
        )?;
    }
    if let Some(a) = album {
        conn.execute(
            "UPDATE songs SET album = ?1 WHERE id = ?2",
            params![a, id],
        )?;
    }
    Ok(())
}

pub fn search_songs(conn: &Connection, query: &str) -> SqlResult<Vec<Song>> {
    let pattern = format!("%{}%", query);
    let mut stmt = conn.prepare(
        "SELECT id, yt_id, title, artist, album, duration, file_path, thumbnail, format, quality, play_count, is_favorite, date_added, last_played, replay_gain, rating FROM songs WHERE title LIKE ?1 OR artist LIKE ?1 OR album LIKE ?1 ORDER BY play_count DESC, title ASC"
    )?;
    let songs = stmt
        .query_map(params![pattern], row_to_song)?
        .collect::<SqlResult<Vec<_>>>()?;
    Ok(songs)
}

pub fn search_songs_fuzzy(conn: &Connection, query: &str) -> SqlResult<Vec<Song>> {
    let words: Vec<&str> = query.split_whitespace().collect();
    let mut conditions = Vec::new();
    let mut param_values: Vec<String> = Vec::new();

    for word in &words {
        let pattern = format!("%{}%", word);
        param_values.push(pattern);
        conditions.push(format!(
            "(title LIKE ?{} OR artist LIKE ?{} OR album LIKE ?{})",
            param_values.len(),
            param_values.len(),
            param_values.len()
        ));
    }

    let where_clause = conditions.join(" AND ");
    let sql = format!(
        "SELECT id, yt_id, title, artist, album, duration, file_path, thumbnail, format, quality, play_count, is_favorite, date_added, last_played, replay_gain, rating FROM songs WHERE {} ORDER BY play_count DESC, title ASC LIMIT 100",
        where_clause
    );

    let mut stmt = conn.prepare(&sql)?;
    let param_refs: Vec<&dyn rusqlite::types::ToSql> = param_values
        .iter()
        .map(|p| p as &dyn rusqlite::types::ToSql)
        .collect();
    let songs = stmt
        .query_map(param_refs.as_slice(), row_to_song)?
        .collect::<SqlResult<Vec<_>>>()?;
    Ok(songs)
}

pub fn get_songs_by_favorite(conn: &Connection) -> SqlResult<Vec<Song>> {
    let mut stmt = conn.prepare(
        "SELECT id, yt_id, title, artist, album, duration, file_path, thumbnail, format, quality, play_count, is_favorite, date_added, last_played, replay_gain, rating FROM songs WHERE is_favorite = 1 ORDER BY title ASC"
    )?;
    let songs = stmt.query_map([], row_to_song)?.collect::<SqlResult<Vec<_>>>()?;
    Ok(songs)
}

pub fn get_songs_by_play_count(conn: &Connection, limit: i32) -> SqlResult<Vec<Song>> {
    let mut stmt = conn.prepare(
        "SELECT id, yt_id, title, artist, album, duration, file_path, thumbnail, format, quality, play_count, is_favorite, date_added, last_played, replay_gain, rating FROM songs WHERE play_count > 0 ORDER BY play_count DESC LIMIT ?1"
    )?;
    let songs = stmt
        .query_map(params![limit], row_to_song)?
        .collect::<SqlResult<Vec<_>>>()?;
    Ok(songs)
}

pub fn get_songs_by_rating(conn: &Connection, min_rating: i32) -> SqlResult<Vec<Song>> {
    let mut stmt = conn.prepare(
        "SELECT id, yt_id, title, artist, album, duration, file_path, thumbnail, format, quality, play_count, is_favorite, date_added, last_played, replay_gain, rating FROM songs WHERE rating >= ?1 ORDER BY rating DESC, title ASC"
    )?;
    let songs = stmt
        .query_map(params![min_rating], row_to_song)?
        .collect::<SqlResult<Vec<_>>>()?;
    Ok(songs)
}

pub fn get_recently_added(conn: &Connection, limit: i32) -> SqlResult<Vec<Song>> {
    let mut stmt = conn.prepare(
        "SELECT id, yt_id, title, artist, album, duration, file_path, thumbnail, format, quality, play_count, is_favorite, date_added, last_played, replay_gain, rating FROM songs ORDER BY date_added DESC LIMIT ?1"
    )?;
    let songs = stmt
        .query_map(params![limit], row_to_song)?
        .collect::<SqlResult<Vec<_>>>()?;
    Ok(songs)
}

pub fn get_recently_played(conn: &Connection, limit: i32) -> SqlResult<Vec<Song>> {
    let mut stmt = conn.prepare(
        "SELECT id, yt_id, title, artist, album, duration, file_path, thumbnail, format, quality, play_count, is_favorite, date_added, last_played, replay_gain, rating FROM songs WHERE last_played IS NOT NULL ORDER BY last_played DESC LIMIT ?1"
    )?;
    let songs = stmt
        .query_map(params![limit], row_to_song)?
        .collect::<SqlResult<Vec<_>>>()?;
    Ok(songs)
}

pub fn get_long_songs(conn: &Connection, min_seconds: i64) -> SqlResult<Vec<Song>> {
    let mut stmt = conn.prepare(
        "SELECT id, yt_id, title, artist, album, duration, file_path, thumbnail, format, quality, play_count, is_favorite, date_added, last_played, replay_gain, rating FROM songs WHERE duration >= ?1 ORDER BY duration DESC"
    )?;
    let songs = stmt
        .query_map(params![min_seconds], row_to_song)?
        .collect::<SqlResult<Vec<_>>>()?;
    Ok(songs)
}

pub fn get_short_songs(conn: &Connection, max_seconds: i64) -> SqlResult<Vec<Song>> {
    let mut stmt = conn.prepare(
        "SELECT id, yt_id, title, artist, album, duration, file_path, thumbnail, format, quality, play_count, is_favorite, date_added, last_played, replay_gain, rating FROM songs WHERE duration <= ?1 AND duration IS NOT NULL ORDER BY duration ASC"
    )?;
    let songs = stmt
        .query_map(params![max_seconds], row_to_song)?
        .collect::<SqlResult<Vec<_>>>()?;
    Ok(songs)
}

pub fn get_playlists(conn: &Connection) -> SqlResult<Vec<Playlist>> {
    let mut stmt = conn.prepare(
        "SELECT p.id, p.name, p.description, p.created_at, p.updated_at FROM playlists p ORDER BY p.name ASC",
    )?;
    let playlists = stmt
        .query_map([], |row| {
            Ok(Playlist {
                id: row.get(0)?,
                name: row.get(1)?,
                description: row.get(2)?,
                created_at: row.get(3)?,
                updated_at: row.get(4)?,
            })
        })?
        .collect::<SqlResult<Vec<_>>>()?;
    Ok(playlists)
}

pub fn create_playlist(conn: &Connection, playlist: &Playlist) -> SqlResult<()> {
    conn.execute(
        "INSERT INTO playlists (id, name, description, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5)",
        params![
            playlist.id,
            playlist.name,
            playlist.description,
            playlist.created_at,
            playlist.updated_at,
        ],
    )?;
    Ok(())
}

pub fn delete_playlist(conn: &Connection, id: &str) -> SqlResult<()> {
    conn.execute("DELETE FROM playlists WHERE id = ?1", params![id])?;
    Ok(())
}

pub fn rename_playlist(conn: &Connection, id: &str, name: &str) -> SqlResult<()> {
    conn.execute(
        "UPDATE playlists SET name = ?1, updated_at = datetime('now') WHERE id = ?2",
        params![name, id],
    )?;
    Ok(())
}

pub fn add_to_playlist(conn: &Connection, playlist_id: &str, song_id: &str) -> SqlResult<()> {
    let max_pos: i32 = conn
        .query_row(
            "SELECT COALESCE(MAX(position), -1) FROM playlist_songs WHERE playlist_id = ?1",
            params![playlist_id],
            |r| r.get(0),
        )
        .unwrap_or(-1);
    let new_pos = max_pos + 1;
    let id = uuid::Uuid::new_v4().to_string();
    conn.execute(
        "INSERT INTO playlist_songs (id, playlist_id, song_id, position, added_at) VALUES (?1, ?2, ?3, ?4, datetime('now'))",
        params![id, playlist_id, song_id, new_pos],
    )?;
    Ok(())
}

pub fn remove_from_playlist(conn: &Connection, playlist_id: &str, song_id: &str) -> SqlResult<()> {
    conn.execute(
        "DELETE FROM playlist_songs WHERE playlist_id = ?1 AND song_id = ?2",
        params![playlist_id, song_id],
    )?;
    let remaining: Vec<(String, i32)> = {
        let mut stmt = conn.prepare(
            "SELECT id, position FROM playlist_songs WHERE playlist_id = ?1 ORDER BY position ASC",
        )?;
        let result: Vec<_> = stmt
            .query_map(params![playlist_id], |row| {
                Ok((row.get(0)?, row.get(1)?))
            })?
            .filter_map(|r| r.ok())
            .collect();
        result
    };
    for (i, (id, _)) in remaining.iter().enumerate() {
        conn.execute(
            "UPDATE playlist_songs SET position = ?1 WHERE id = ?2",
            params![i as i32, id],
        )?;
    }
    Ok(())
}

pub fn get_playlist_songs(conn: &Connection, playlist_id: &str) -> SqlResult<Vec<Song>> {
    let mut stmt = conn.prepare(
        "SELECT s.id, s.yt_id, s.title, s.artist, s.album, s.duration, s.file_path, s.thumbnail, s.format, s.quality, s.play_count, s.is_favorite, s.date_added, s.last_played, s.replay_gain, s.rating
         FROM songs s
         INNER JOIN playlist_songs ps ON s.id = ps.song_id
         WHERE ps.playlist_id = ?1
         ORDER BY ps.position ASC"
    )?;
    let songs = stmt
        .query_map(params![playlist_id], row_to_song)?
        .collect::<SqlResult<Vec<_>>>()?;
    Ok(songs)
}

pub fn reorder_playlist_songs(
    conn: &Connection,
    playlist_id: &str,
    song_ids: &[String],
) -> SqlResult<()> {
    for (i, song_id) in song_ids.iter().enumerate() {
        conn.execute(
            "UPDATE playlist_songs SET position = ?1 WHERE playlist_id = ?2 AND song_id = ?3",
            params![i as i32, playlist_id, song_id],
        )?;
    }
    Ok(())
}

pub fn add_to_history(
    conn: &Connection,
    song_id: &str,
    duration_played: Option<i64>,
) -> SqlResult<()> {
    let id = uuid::Uuid::new_v4().to_string();
    conn.execute(
        "INSERT INTO play_history (id, song_id, played_at, duration_played) VALUES (?1, ?2, datetime('now'), ?3)",
        params![id, song_id, duration_played],
    )?;
    Ok(())
}

pub fn get_history(conn: &Connection, limit: i32) -> SqlResult<Vec<PlayHistoryEntry>> {
    let mut stmt = conn.prepare(
        "SELECT h.id, h.song_id, h.played_at, h.duration_played FROM play_history h ORDER BY h.played_at DESC LIMIT ?1",
    )?;
    let entries = stmt
        .query_map(params![limit], |row| {
            Ok(PlayHistoryEntry {
                id: row.get(0)?,
                song_id: row.get(1)?,
                played_at: row.get(2)?,
                duration_played: row.get(3)?,
            })
        })?
        .collect::<SqlResult<Vec<_>>>()?;
    Ok(entries)
}

pub fn clear_history(conn: &Connection) -> SqlResult<()> {
    conn.execute("DELETE FROM play_history", [])?;
    Ok(())
}

pub fn get_history_for_song(
    conn: &Connection,
    song_id: &str,
    limit: i32,
) -> SqlResult<Vec<PlayHistoryEntry>> {
    let mut stmt = conn.prepare(
        "SELECT id, song_id, played_at, duration_played FROM play_history WHERE song_id = ?1 ORDER BY played_at DESC LIMIT ?2",
    )?;
    let entries = stmt
        .query_map(params![song_id, limit], |row| {
            Ok(PlayHistoryEntry {
                id: row.get(0)?,
                song_id: row.get(1)?,
                played_at: row.get(2)?,
                duration_played: row.get(3)?,
            })
        })?
        .collect::<SqlResult<Vec<_>>>()?;
    Ok(entries)
}

pub fn get_setting(conn: &Connection, key: &str) -> SqlResult<Option<String>> {
    let result = conn.query_row(
        "SELECT value FROM settings WHERE key = ?1",
        params![key],
        |r| r.get::<_, String>(0),
    );
    match result {
        Ok(val) => Ok(Some(val)),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(e) => Err(e),
    }
}

pub fn set_setting(conn: &Connection, key: &str, value: &str) -> SqlResult<()> {
    conn.execute(
        "INSERT OR REPLACE INTO settings (key, value) VALUES (?1, ?2)",
        params![key, value],
    )?;
    Ok(())
}

pub fn get_all_settings(conn: &Connection) -> SqlResult<std::collections::HashMap<String, String>> {
    let mut stmt = conn.prepare("SELECT key, value FROM settings")?;
    let mut map = std::collections::HashMap::new();
    let rows = stmt.query_map([], |row| {
        Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
    })?;
    for row in rows {
        if let Ok((k, v)) = row {
            map.insert(k, v);
        }
    }
    Ok(map)
}

pub fn save_bookmark(conn: &Connection, bookmark: &Bookmark) -> SqlResult<()> {
    conn.execute(
        "INSERT OR REPLACE INTO bookmarks (id, song_id, position, label, created_at) VALUES (?1, ?2, ?3, ?4, ?5)",
        params![
            bookmark.id,
            bookmark.song_id,
            bookmark.position,
            bookmark.label,
            bookmark.created_at,
        ],
    )?;
    Ok(())
}

pub fn get_bookmarks(conn: &Connection, song_id: &str) -> SqlResult<Vec<Bookmark>> {
    let mut stmt = conn.prepare(
        "SELECT id, song_id, position, label, created_at FROM bookmarks WHERE song_id = ?1 ORDER BY position ASC",
    )?;
    let bookmarks = stmt
        .query_map(params![song_id], |row| {
            Ok(Bookmark {
                id: row.get(0)?,
                song_id: row.get(1)?,
                position: row.get(2)?,
                label: row.get(3)?,
                created_at: row.get(4)?,
            })
        })?
        .collect::<SqlResult<Vec<_>>>()?;
    Ok(bookmarks)
}

pub fn get_all_bookmarks(conn: &Connection) -> SqlResult<Vec<BookmarkWithSong>> {
    let mut stmt = conn.prepare(
        "SELECT b.id, b.song_id, b.position, b.label, b.created_at, s.title, s.artist, s.file_path
         FROM bookmarks b
         INNER JOIN songs s ON b.song_id = s.id
         ORDER BY b.created_at DESC",
    )?;
    let bookmarks = stmt
        .query_map([], |row| {
            Ok(BookmarkWithSong {
                id: row.get(0)?,
                song_id: row.get(1)?,
                position: row.get(2)?,
                label: row.get(3)?,
                created_at: row.get(4)?,
                song_title: row.get(5)?,
                song_artist: row.get(6)?,
                song_file_path: row.get(7)?,
            })
        })?
        .collect::<SqlResult<Vec<_>>>()?;
    Ok(bookmarks)
}

pub fn delete_bookmark(conn: &Connection, id: &str) -> SqlResult<()> {
    conn.execute("DELETE FROM bookmarks WHERE id = ?1", params![id])?;
    Ok(())
}

pub fn find_duplicates(conn: &Connection) -> SqlResult<Vec<Vec<Song>>> {
    let mut stmt = conn.prepare(
        "SELECT id, yt_id, title, artist, album, duration, file_path, thumbnail, format, quality, play_count, is_favorite, date_added, last_played, replay_gain, rating
         FROM songs WHERE yt_id IS NOT NULL AND yt_id != ''
         ORDER BY yt_id, title"
    )?;
    let all_songs = stmt.query_map([], row_to_song)?.collect::<SqlResult<Vec<_>>>()?;

    let mut groups: std::collections::HashMap<String, Vec<Song>> = std::collections::HashMap::new();
    for song in all_songs {
        if let Some(ref yt_id) = song.yt_id {
            groups.entry(yt_id.clone()).or_default().push(song);
        }
    }

    Ok(groups
        .into_values()
        .filter(|g| g.len() > 1)
        .collect())
}

pub fn remove_duplicate_songs(
    conn: &Connection,
    duplicate_groups: &[Vec<String>],
    keep_first: bool,
) -> SqlResult<u32> {
    let mut removed = 0;
    for group in duplicate_groups {
        if group.len() <= 1 {
            continue;
        }
        let ids_to_remove = if keep_first {
            &group[1..]
        } else {
            &group[..group.len() - 1]
        };
        for id in ids_to_remove {
            conn.execute("DELETE FROM songs WHERE id = ?1", params![id])?;
            removed += 1;
        }
    }
    Ok(removed)
}

pub fn find_orphaned_songs(conn: &Connection) -> SqlResult<Vec<Song>> {
    let mut stmt = conn.prepare(
        "SELECT id, yt_id, title, artist, album, duration, file_path, thumbnail, format, quality, play_count, is_favorite, date_added, last_played, replay_gain, rating
         FROM songs WHERE file_path != '' AND file_path IS NOT NULL"
    )?;
    let all_songs = stmt.query_map([], row_to_song)?.collect::<SqlResult<Vec<_>>>()?;

    let orphaned: Vec<Song> = all_songs
        .into_iter()
        .filter(|s| !std::path::Path::new(&s.file_path).exists())
        .collect();
    Ok(orphaned)
}

pub fn remove_orphaned_songs(conn: &Connection) -> SqlResult<u32> {
    let orphaned = find_orphaned_songs(conn)?;
    let count = orphaned.len() as u32;
    for song in orphaned {
        conn.execute("DELETE FROM songs WHERE id = ?1", params![song.id])?;
    }
    Ok(count)
}

pub fn find_duplicate_playlists(conn: &Connection) -> SqlResult<Vec<Vec<Playlist>>> {
    let mut stmt = conn.prepare(
        "SELECT id, name, description, created_at, updated_at FROM playlists ORDER BY name"
    )?;
    let all = stmt
        .query_map([], |row| {
            Ok(Playlist {
                id: row.get(0)?,
                name: row.get(1)?,
                description: row.get(2)?,
                created_at: row.get(3)?,
                updated_at: row.get(4)?,
            })
        })?
        .collect::<SqlResult<Vec<_>>>()?;

    let mut groups: std::collections::HashMap<String, Vec<Playlist>> =
        std::collections::HashMap::new();
    for p in all {
        let key = p.name.to_lowercase();
        groups.entry(key).or_default().push(p);
    }

    Ok(groups
        .into_values()
        .filter(|g| g.len() > 1)
        .collect())
}

pub fn remove_duplicate_playlists(
    conn: &Connection,
    duplicate_groups: &[Vec<String>],
    keep_first: bool,
) -> SqlResult<u32> {
    let mut removed = 0;
    for group in duplicate_groups {
        if group.len() <= 1 {
            continue;
        }
        let ids_to_remove = if keep_first {
            &group[1..]
        } else {
            &group[..group.len() - 1]
        };
        for id in ids_to_remove {
            conn.execute("DELETE FROM playlists WHERE id = ?1", params![id])?;
            removed += 1;
        }
    }
    Ok(removed)
}

pub fn get_listening_stats(conn: &Connection) -> SqlResult<ListeningStats> {
    let total_songs: i32 = conn.query_row("SELECT COUNT(*) FROM songs", [], |r| r.get(0))?;
    let total_playlists: i32 =
        conn.query_row("SELECT COUNT(*) FROM playlists", [], |r| r.get(0))?;
    let total_plays: i32 = conn.query_row("SELECT SUM(play_count) FROM songs", [], |r| {
        r.get(0)
    })?;
    let total_listening_time: i64 =
        conn.query_row("SELECT COALESCE(SUM(duration_played), 0) FROM play_history", [], |r| {
            r.get(0)
        })?;
    let favorite_count: i32 =
        conn.query_row("SELECT COUNT(*) FROM songs WHERE is_favorite = 1", [], |r| {
            r.get(0)
        })?;
    let average_rating: f64 = conn
        .query_row(
            "SELECT COALESCE(AVG(rating), 0) FROM songs WHERE rating > 0",
            [],
            |r| r.get(0),
        )
        .unwrap_or(0.0);

    let top_artists = {
        let mut stmt = conn.prepare(
            "SELECT COALESCE(artist, 'Unknown Artist') as a, SUM(play_count) as pc, COUNT(*) as sc
             FROM songs WHERE play_count > 0 AND artist IS NOT NULL AND artist != ''
             GROUP BY artist ORDER BY pc DESC LIMIT 10"
        )?;
        let result: Vec<ArtistStat> = stmt
            .query_map([], |row| {
                Ok(ArtistStat {
                    artist: row.get(0)?,
                    play_count: row.get(1)?,
                    song_count: row.get(2)?,
                })
            })?
            .filter_map(|r| r.ok())
            .collect();
        result
    };

    let top_songs = get_songs_by_play_count(conn, 10)?;

    let recent_activity = get_history(conn, 20)?;

    let plays_by_day = {
        let mut stmt = conn.prepare(
            "SELECT DATE(played_at) as d, COUNT(*) as c
             FROM play_history
             WHERE played_at IS NOT NULL
             GROUP BY DATE(played_at)
             ORDER BY d DESC LIMIT 30"
        )?;
        let result: Vec<DayPlays> = stmt
            .query_map([], |row| {
                Ok(DayPlays {
                    date: row.get(0)?,
                    count: row.get(1)?,
                })
            })?
            .filter_map(|r| r.ok())
            .collect();
        result
    };

    Ok(ListeningStats {
        total_songs,
        total_playlists,
        total_plays,
        total_listening_time,
        favorite_count,
        average_rating,
        top_artists,
        top_songs,
        recent_activity,
        plays_by_day,
    })
}

pub fn get_smart_playlists(conn: &Connection) -> SqlResult<Vec<SmartPlaylist>> {
    let most_played_count: i32 = conn.query_row(
        "SELECT COUNT(*) FROM songs WHERE play_count > 0",
        [],
        |r| r.get(0),
    )?;
    let recently_added_count: i32 = conn.query_row(
        "SELECT COUNT(*) FROM songs WHERE date_added >= datetime('now', '-7 days')",
        [],
        |r| r.get(0),
    )?;
    let top_rated_count: i32 = conn.query_row(
        "SELECT COUNT(*) FROM songs WHERE rating >= 4",
        [],
        |r| r.get(0),
    )?;
    let favorites_count: i32 = conn.query_row(
        "SELECT COUNT(*) FROM songs WHERE is_favorite = 1",
        [],
        |r| r.get(0),
    )?;
    let recently_played_count: i32 = conn.query_row(
        "SELECT COUNT(*) FROM songs WHERE last_played IS NOT NULL AND last_played >= datetime('now', '-7 days')",
        [],
        |r| r.get(0),
    )?;
    let long_songs_count: i32 = conn.query_row(
        "SELECT COUNT(*) FROM songs WHERE duration >= 300",
        [],
        |r| r.get(0),
    )?;
    let short_songs_count: i32 = conn.query_row(
        "SELECT COUNT(*) FROM songs WHERE duration <= 120 AND duration IS NOT NULL AND duration > 0",
        [],
        |r| r.get(0),
    )?;
    let unrated_count: i32 = conn.query_row(
        "SELECT COUNT(*) FROM songs WHERE rating = 0",
        [],
        |r| r.get(0),
    )?;

    Ok(vec![
        SmartPlaylist {
            id: "smart::most_played".to_string(),
            name: "Most Played".to_string(),
            description: "Songs sorted by play count".to_string(),
            song_count: most_played_count,
        },
        SmartPlaylist {
            id: "smart::recently_added".to_string(),
            name: "Recently Added".to_string(),
            description: "Songs added in the last 7 days".to_string(),
            song_count: recently_added_count,
        },
        SmartPlaylist {
            id: "smart::top_rated".to_string(),
            name: "Top Rated".to_string(),
            description: "Songs rated 4 or higher".to_string(),
            song_count: top_rated_count,
        },
        SmartPlaylist {
            id: "smart::favorites".to_string(),
            name: "Favorites".to_string(),
            description: "All favorited songs".to_string(),
            song_count: favorites_count,
        },
        SmartPlaylist {
            id: "smart::recently_played".to_string(),
            name: "Recently Played".to_string(),
            description: "Songs played in the last 7 days".to_string(),
            song_count: recently_played_count,
        },
        SmartPlaylist {
            id: "smart::long_songs".to_string(),
            name: "Long Songs".to_string(),
            description: "Songs longer than 5 minutes".to_string(),
            song_count: long_songs_count,
        },
        SmartPlaylist {
            id: "smart::short_songs".to_string(),
            name: "Short Songs".to_string(),
            description: "Songs shorter than 2 minutes".to_string(),
            song_count: short_songs_count,
        },
        SmartPlaylist {
            id: "smart::unrated".to_string(),
            name: "Unrated".to_string(),
            description: "Songs that haven't been rated".to_string(),
            song_count: unrated_count,
        },
    ])
}

pub fn get_smart_playlist_songs(
    conn: &Connection,
    playlist_id: &str,
) -> SqlResult<Vec<Song>> {
    match playlist_id {
        "smart::most_played" => get_songs_by_play_count(conn, 100),
        "smart::recently_added" => get_recently_added(conn, 100),
        "smart::top_rated" => get_songs_by_rating(conn, 4),
        "smart::favorites" => get_songs_by_favorite(conn),
        "smart::recently_played" => get_recently_played(conn, 100),
        "smart::long_songs" => get_long_songs(conn, 300),
        "smart::short_songs" => get_short_songs(conn, 120),
        "smart::unrated" => {
            let mut stmt = conn.prepare(
                "SELECT id, yt_id, title, artist, album, duration, file_path, thumbnail, format, quality, play_count, is_favorite, date_added, last_played, replay_gain, rating FROM songs WHERE rating = 0 ORDER BY title ASC"
            )?;
            let songs = stmt.query_map([], row_to_song)?.collect::<SqlResult<Vec<_>>>()?;
            Ok(songs)
        }
        _ => Ok(vec![]),
    }
}

pub fn export_library(conn: &Connection) -> SqlResult<serde_json::Value> {
    let songs = get_all_songs(conn)?;
    let playlists = get_playlists(conn)?;

    let mut playlists_with_songs = Vec::new();
    for p in &playlists {
        let songs = get_playlist_songs(conn, &p.id)?;
        playlists_with_songs.push(serde_json::json!({
            "playlist": p,
            "songs": songs,
        }));
    }

    Ok(serde_json::json!({
        "version": 1,
        "songs": songs,
        "playlists": playlists_with_songs,
    }))
}

pub fn import_library(conn: &Connection, data: &serde_json::Value) -> SqlResult<()> {
    if let Some(songs) = data.get("songs").and_then(|s| s.as_array()) {
        for song_val in songs {
            if let Ok(song) = serde_json::from_value::<Song>(song_val.clone()) {
                add_song(conn, &song)?;
            }
        }
    }
    if let Some(playlists) = data.get("playlists").and_then(|s| s.as_array()) {
        for pl_val in playlists {
            if let Some(pl) = pl_val.get("playlist") {
                if let Ok(playlist) = serde_json::from_value::<Playlist>(pl.clone()) {
                    create_playlist(conn, &playlist)?;
                    if let Some(songs) = pl_val.get("songs").and_then(|s| s.as_array()) {
                        for song_val in songs {
                            if let Ok(song) = serde_json::from_value::<Song>(song_val.clone()) {
                                add_to_playlist(conn, &playlist.id, &song.id)?;
                            }
                        }
                    }
                }
            }
        }
    }
    Ok(())
}
