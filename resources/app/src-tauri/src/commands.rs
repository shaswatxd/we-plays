use std::collections::HashMap;
use std::path::PathBuf;

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, Window};

use tauri_plugin_shell::ShellExt;

use crate::db;
use crate::downloader;
use crate::lan_share;
use crate::AppState;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AddSongData {
    pub title: String,
    pub artist: Option<String>,
    pub album: Option<String>,
    pub duration: Option<i64>,
    pub file_path: String,
    pub yt_id: Option<String>,
    pub thumbnail: Option<String>,
    pub format: Option<String>,
    pub quality: Option<String>,
}

#[tauri::command]
pub fn window_minimize(window: Window) -> Result<(), String> {
    window.minimize().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn window_maximize(window: Window) -> Result<(), String> {
    if window.is_maximized().unwrap_or(false) {
        window.unmaximize().map_err(|e| e.to_string())
    } else {
        window.maximize().map_err(|e| e.to_string())
    }
}

#[tauri::command]
pub fn window_close(window: Window) -> Result<(), String> {
    window.close().map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn search_youtube(query: String, app: AppHandle) -> Result<Vec<db::SearchResult>, String> {
    downloader::search_youtube(&app, &query, 1).await
}

#[tauri::command]
pub async fn search_youtube_paginated(
    query: String,
    page: u32,
    app: AppHandle,
) -> Result<db::SearchResultPage, String> {
    let results = downloader::search_youtube(&app, &query, page).await?;
    let has_more = results.len() >= 10;
    Ok(db::SearchResultPage {
        results,
        has_more,
        page,
    })
}

#[tauri::command]
pub async fn download_song(
    url: String,
    quality: String,
    format: String,
    app: AppHandle,
    state: tauri::State<'_, AppState>,
) -> Result<String, String> {
    downloader::download_song(&app, &url, &quality, &format, &state).await
}

#[tauri::command]
pub async fn cancel_download(
    download_id: String,
    state: tauri::State<'_, AppState>,
) -> Result<(), String> {
    downloader::cancel_download(&download_id, &state).await
}

#[tauri::command]
pub fn get_all_songs(state: tauri::State<'_, AppState>) -> Result<Vec<db::Song>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db::get_all_songs(&db).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn add_song(
    data: AddSongData,
    state: tauri::State<'_, AppState>,
) -> Result<db::Song, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Utc::now().to_rfc3339();
    let song = db::Song {
        id: id.clone(),
        yt_id: data.yt_id,
        title: data.title,
        artist: data.artist,
        album: data.album,
        duration: data.duration,
        file_path: data.file_path,
        thumbnail: data.thumbnail,
        format: data.format,
        quality: data.quality,
        play_count: 0,
        is_favorite: false,
        date_added: Some(now),
        last_played: None,
        replay_gain: 0.0,
        rating: 0,
    };
    db::add_song(&db, &song).map_err(|e| e.to_string())?;
    let added = db::get_song_by_id(&db, &id)
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "Song not found after insert".to_string())?;
    Ok(added)
}

#[tauri::command]
pub fn remove_song(song_id: String, state: tauri::State<'_, AppState>) -> Result<(), String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let song = db::get_song_by_id(&db, &song_id)
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "Song not found".to_string())?;
    if let Ok(path) = std::path::Path::new(&song.file_path).canonicalize() {
        if path.exists() {
            std::fs::remove_file(&path).ok();
        }
    }
    db::remove_song(&db, &song_id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn toggle_favorite(
    song_id: String,
    state: tauri::State<'_, AppState>,
) -> Result<bool, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db::toggle_favorite(&db, &song_id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn update_play_count(
    song_id: String,
    state: tauri::State<'_, AppState>,
) -> Result<i32, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db::update_play_count(&db, &song_id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_playlists(state: tauri::State<'_, AppState>) -> Result<Vec<db::Playlist>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db::get_playlists(&db).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn create_playlist(
    name: String,
    description: Option<String>,
    state: tauri::State<'_, AppState>,
) -> Result<db::Playlist, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Utc::now().to_rfc3339();
    let playlist = db::Playlist {
        id: id.clone(),
        name,
        description,
        created_at: Some(now.clone()),
        updated_at: Some(now),
    };
    db::create_playlist(&db, &playlist).map_err(|e| e.to_string())?;
    Ok(playlist)
}

#[tauri::command]
pub fn delete_playlist(
    playlist_id: String,
    state: tauri::State<'_, AppState>,
) -> Result<(), String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db::delete_playlist(&db, &playlist_id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn add_to_playlist(
    playlist_id: String,
    song_id: String,
    state: tauri::State<'_, AppState>,
) -> Result<(), String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db::add_to_playlist(&db, &playlist_id, &song_id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn remove_from_playlist(
    playlist_id: String,
    song_id: String,
    state: tauri::State<'_, AppState>,
) -> Result<(), String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db::remove_from_playlist(&db, &playlist_id, &song_id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_playlist_songs(
    playlist_id: String,
    state: tauri::State<'_, AppState>,
) -> Result<Vec<db::Song>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    if playlist_id.starts_with("smart::") {
        return db::get_smart_playlist_songs(&db, &playlist_id).map_err(|e| e.to_string());
    }
    db::get_playlist_songs(&db, &playlist_id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn rename_playlist(
    playlist_id: String,
    name: String,
    state: tauri::State<'_, AppState>,
) -> Result<(), String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db::rename_playlist(&db, &playlist_id, &name).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn reorder_playlist_songs(
    playlist_id: String,
    song_ids: Vec<String>,
    state: tauri::State<'_, AppState>,
) -> Result<(), String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db::reorder_playlist_songs(&db, &playlist_id, &song_ids).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn add_to_history(
    song_id: String,
    duration_played: Option<i64>,
    state: tauri::State<'_, AppState>,
) -> Result<(), String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db::add_to_history(&db, &song_id, duration_played).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_history(
    limit: Option<u32>,
    state: tauri::State<'_, AppState>,
) -> Result<Vec<db::PlayHistoryEntry>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let lim = limit.unwrap_or(100) as i32;
    db::get_history(&db, lim).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn clear_history(state: tauri::State<'_, AppState>) -> Result<(), String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db::clear_history(&db).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_settings(
    state: tauri::State<'_, AppState>,
) -> Result<HashMap<String, String>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db::get_all_settings(&db).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn set_setting(
    key: String,
    value: String,
    state: tauri::State<'_, AppState>,
) -> Result<(), String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db::set_setting(&db, &key, &value).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn select_folder(
    start_path: Option<String>,
) -> Result<Vec<FolderItem>, String> {
    let path = start_path.unwrap_or_else(|| {
        let home = std::env::var("USERPROFILE")
            .or_else(|_| std::env::var("HOME"))
            .unwrap_or_else(|_| ".".to_string());
        PathBuf::from(home)
            .join("Music")
            .to_string_lossy()
            .to_string()
    });

    let dir = std::path::Path::new(&path);
    if !dir.exists() || !dir.is_dir() {
        return Err(format!("Directory not found: {}", path));
    }

    let mut items = Vec::new();
    if let Ok(entries) = std::fs::read_dir(dir) {
        for entry in entries.flatten() {
            let metadata = entry.metadata().ok();
            if let Some(meta) = metadata {
                if meta.is_dir() {
                    items.push(FolderItem {
                        name: entry.file_name().to_string_lossy().to_string(),
                        path: entry.path().to_string_lossy().to_string(),
                        is_dir: true,
                    });
                }
            }
        }
    }
    items.sort_by(|a, b| a.name.cmp(&b.name));
    Ok(items)
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FolderItem {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
}

#[tauri::command]
pub async fn import_folder(
    path: String,
    app: AppHandle,
    state: tauri::State<'_, AppState>,
) -> Result<Vec<db::Song>, String> {
    let audio_extensions = [
        "mp3", "flac", "wav", "ogg", "aac", "m4a", "wma", "opus", "aiff", "alac",
    ];

    let mut imported = Vec::new();
    let dir = std::path::Path::new(&path);
    if !dir.exists() || !dir.is_dir() {
        return Err(format!("Directory not found: {}", path));
    }

    for entry in walkdir::WalkDir::new(dir)
        .into_iter()
        .filter_map(|e| e.ok())
    {
        if !entry.file_type().is_file() {
            continue;
        }
        let ext = entry
            .path()
            .extension()
            .and_then(|e| e.to_str())
            .unwrap_or("")
            .to_lowercase();

        if !audio_extensions.contains(&ext.as_str()) {
            continue;
        }

        let file_path = entry.path().to_string_lossy().to_string();
        let title = entry
            .path()
            .file_stem()
            .and_then(|s| s.to_str())
            .unwrap_or("Unknown")
            .to_string();

        let id = uuid::Uuid::new_v4().to_string();
        let now = chrono::Utc::now().to_rfc3339();

        let song = db::Song {
            id,
            yt_id: None,
            title,
            artist: None,
            album: None,
            duration: None,
            file_path,
            thumbnail: None,
            format: Some(ext),
            quality: None,
            play_count: 0,
            is_favorite: false,
            date_added: Some(now),
            last_played: None,
            replay_gain: 0.0,
            rating: 0,
        };

        {
            let db = state.db.lock().map_err(|e| e.to_string())?;
            db::add_song(&db, &song).map_err(|e| e.to_string())?;
        }

        imported.push(song);
    }

    let _ = app.emit("import-complete", imported.len());
    Ok(imported)
}

#[tauri::command]
pub async fn import_files(
    paths: Vec<String>,
    state: tauri::State<'_, AppState>,
) -> Result<Vec<db::Song>, String> {
    let audio_extensions = [
        "mp3", "flac", "wav", "ogg", "aac", "m4a", "wma", "opus", "aiff", "alac",
    ];

    let mut imported = Vec::new();

    for file_path in paths {
        let path = std::path::Path::new(&file_path);
        if !path.exists() || !path.is_file() {
            continue;
        }

        let ext = path
            .extension()
            .and_then(|e| e.to_str())
            .unwrap_or("")
            .to_lowercase();

        if !audio_extensions.contains(&ext.as_str()) {
            continue;
        }

        let title = path
            .file_stem()
            .and_then(|s| s.to_str())
            .unwrap_or("Unknown")
            .to_string();

        let id = uuid::Uuid::new_v4().to_string();
        let now = chrono::Utc::now().to_rfc3339();

        let song = db::Song {
            id,
            yt_id: None,
            title,
            artist: None,
            album: None,
            duration: None,
            file_path: file_path.clone(),
            thumbnail: None,
            format: Some(ext),
            quality: None,
            play_count: 0,
            is_favorite: false,
            date_added: Some(now),
            last_played: None,
            replay_gain: 0.0,
            rating: 0,
        };

        {
            let db = state.db.lock().map_err(|e| e.to_string())?;
            db::add_song(&db, &song).map_err(|e| e.to_string())?;
        }

        imported.push(song);
    }

    Ok(imported)
}

#[tauri::command]
pub async fn show_file_in_explorer(path: String, _app: AppHandle) -> Result<(), String> {
    let p = std::path::Path::new(&path);
    if p.is_file() {
        #[cfg(target_os = "windows")]
        {
            std::process::Command::new("explorer")
                .arg(format!("/select,{}", path))
                .spawn()
                .map_err(|e| e.to_string())?;
        }
        #[cfg(target_os = "macos")]
        {
            std::process::Command::new("open")
                .arg("-R")
                .arg(&path)
                .spawn()
                .map_err(|e| e.to_string())?;
        }
        #[cfg(target_os = "linux")]
        {
            if let Some(parent) = p.parent() {
                std::process::Command::new("xdg-open")
                    .arg(parent.to_string_lossy().to_string())
                    .spawn()
                    .map_err(|e| e.to_string())?;
            }
        }
    } else if p.is_dir() {
        #[cfg(target_os = "windows")]
        {
            std::process::Command::new("explorer")
                .arg(&path)
                .spawn()
                .map_err(|e| e.to_string())?;
        }
        #[cfg(target_os = "macos")]
        {
            std::process::Command::new("open")
                .arg(&path)
                .spawn()
                .map_err(|e| e.to_string())?;
        }
        #[cfg(target_os = "linux")]
        {
            std::process::Command::new("xdg-open")
                .arg(&path)
                .spawn()
                .map_err(|e| e.to_string())?;
        }
    } else {
        return Err(format!("Path not found: {}", path));
    }

    Ok(())
}

#[tauri::command]
pub async fn export_library(path: String, state: tauri::State<'_, AppState>) -> Result<(), String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let data = db::export_library(&db).map_err(|e| e.to_string())?;
    let json = serde_json::to_string_pretty(&data).map_err(|e| e.to_string())?;
    std::fs::write(&path, json).map_err(|e| format!("Failed to write file: {}", e))
}

#[tauri::command]
pub async fn import_library(path: String, state: tauri::State<'_, AppState>) -> Result<(), String> {
    let content = std::fs::read_to_string(&path).map_err(|e| format!("Failed to read file: {}", e))?;
    let data: serde_json::Value =
        serde_json::from_str(&content).map_err(|e| format!("Invalid JSON: {}", e))?;
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db::import_library(&db, &data).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn update_ytdlp(app: AppHandle) -> Result<String, String> {
    downloader::update_ytdlp(&app).await
}

#[tauri::command]
pub async fn get_ytdlp_version(app: AppHandle) -> Result<String, String> {
    downloader::get_version(&app).await
}

#[tauri::command]
pub async fn get_ffmpeg_path(app: AppHandle) -> Result<String, String> {
    let sidecar = app.shell().sidecar("ffmpeg").map_err(|e| e.to_string())?;
    let (mut rx, _child) = sidecar
        .args(["-version"])
        .spawn()
        .map_err(|e| e.to_string())?;
    while let Some(event) = rx.recv().await {
        if let tauri_plugin_shell::process::CommandEvent::Stdout(bytes) = event {
            let output = String::from_utf8_lossy(&bytes);
            if let Some(first_line) = output.lines().next() {
                return Ok(first_line.to_string());
            }
        }
    }
    Ok("ffmpeg not found".to_string())
}

#[tauri::command]
pub async fn get_stream_url(url: String, app: AppHandle) -> Result<String, String> {
    downloader::get_stream_url(&app, &url).await
}

#[tauri::command]
pub fn search_global(
    query: String,
    state: tauri::State<'_, AppState>,
) -> Result<db::GlobalSearchResult, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let songs = db::search_songs(&db, &query).map_err(|e| e.to_string())?;
    let pattern = format!("%{}%", query);
    let mut stmt = db
        .prepare(
            "SELECT id, name, description, created_at, updated_at FROM playlists WHERE name LIKE ?1",
        )
        .map_err(|e| e.to_string())?;
    let playlists = stmt
        .query_map(rusqlite::params![pattern], |row| {
            Ok(db::Playlist {
                id: row.get(0)?,
                name: row.get(1)?,
                description: row.get(2)?,
                created_at: row.get(3)?,
                updated_at: row.get(4)?,
            })
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();
    Ok(db::GlobalSearchResult { songs, playlists })
}

#[tauri::command]
pub fn get_smart_playlists(
    state: tauri::State<'_, AppState>,
) -> Result<Vec<db::SmartPlaylist>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db::get_smart_playlists(&db).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn save_bookmark(
    song_id: String,
    position: f64,
    label: Option<String>,
    state: tauri::State<'_, AppState>,
) -> Result<db::Bookmark, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Utc::now().to_rfc3339();
    let bookmark = db::Bookmark {
        id,
        song_id,
        position,
        label,
        created_at: Some(now),
    };
    db::save_bookmark(&db, &bookmark).map_err(|e| e.to_string())?;
    Ok(bookmark)
}

#[tauri::command]
pub fn get_bookmarks(
    song_id: String,
    state: tauri::State<'_, AppState>,
) -> Result<Vec<db::Bookmark>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db::get_bookmarks(&db, &song_id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_bookmark(
    bookmark_id: String,
    state: tauri::State<'_, AppState>,
) -> Result<(), String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db::delete_bookmark(&db, &bookmark_id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_all_bookmarks(
    state: tauri::State<'_, AppState>,
) -> Result<Vec<db::BookmarkWithSong>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db::get_all_bookmarks(&db).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn update_song_gain(
    song_id: String,
    gain: f64,
    state: tauri::State<'_, AppState>,
) -> Result<(), String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db::update_song_gain(&db, &song_id, gain).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn update_song_rating(
    song_id: String,
    rating: i32,
    state: tauri::State<'_, AppState>,
) -> Result<(), String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db::update_song_rating(&db, &song_id, rating.clamp(0, 5)).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn auto_tag_song(
    song_id: String,
    app: AppHandle,
    state: tauri::State<'_, AppState>,
) -> Result<db::Song, String> {
    let song = {
        let db = state.db.lock().map_err(|e| e.to_string())?;
        db::get_song_by_id(&db, &song_id)
            .map_err(|e| e.to_string())?
            .ok_or_else(|| "Song not found".to_string())?
    };

    let search_query = match (&song.artist, &song.title) {
        (Some(artist), title) => format!("{} {}", artist, title),
        (None, title) => title.clone(),
    };

    let results = downloader::search_youtube(&app, &search_query, 1).await?;
    if let Some(result) = results.first() {
        let new_artist = Some(result.channel.clone());
        let new_title = Some(result.title.clone());
        let new_thumbnail = result.thumbnail.clone();

        {
            let db = state.db.lock().map_err(|e| e.to_string())?;
            db::update_song_metadata(
                &db,
                &song_id,
                new_title.as_deref(),
                new_artist.as_deref(),
                None,
            )
            .map_err(|e| e.to_string())?;

            if let Some(thumb) = &new_thumbnail {
                db.execute(
                    "UPDATE songs SET thumbnail = ?1 WHERE id = ?2",
                    rusqlite::params![thumb, song_id],
                )
                .map_err(|e| e.to_string())?;
            }
        }
    }

    let db = state.db.lock().map_err(|e| e.to_string())?;
    db::get_song_by_id(&db, &song_id)
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "Song not found after update".to_string())
}

#[tauri::command]
pub fn get_listening_stats(
    state: tauri::State<'_, AppState>,
) -> Result<db::ListeningStats, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db::get_listening_stats(&db).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_local_ip() -> Result<String, String> {
    lan_share::get_local_ip().map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn start_lan_share(
    state: tauri::State<'_, AppState>,
) -> Result<String, String> {
    lan_share::start_server(state).await
}

#[tauri::command]
pub async fn stop_lan_share(
    state: tauri::State<'_, AppState>,
) -> Result<(), String> {
    lan_share::stop_server(state).await
}

#[tauri::command]
pub fn find_duplicates(
    state: tauri::State<'_, AppState>,
) -> Result<Vec<Vec<db::Song>>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db::find_duplicates(&db).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn remove_duplicate_songs(
    duplicate_groups: Vec<Vec<String>>,
    keep_first: bool,
    state: tauri::State<'_, AppState>,
) -> Result<u32, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db::remove_duplicate_songs(&db, &duplicate_groups, keep_first).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn find_orphaned_songs(
    state: tauri::State<'_, AppState>,
) -> Result<Vec<db::Song>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db::find_orphaned_songs(&db).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn remove_orphaned_songs(
    state: tauri::State<'_, AppState>,
) -> Result<u32, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db::remove_orphaned_songs(&db).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn find_duplicate_playlists(
    state: tauri::State<'_, AppState>,
) -> Result<Vec<Vec<db::Playlist>>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db::find_duplicate_playlists(&db).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn remove_duplicate_playlists(
    duplicate_groups: Vec<Vec<String>>,
    keep_first: bool,
    state: tauri::State<'_, AppState>,
) -> Result<u32, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db::remove_duplicate_playlists(&db, &duplicate_groups, keep_first).map_err(|e| e.to_string())
}
