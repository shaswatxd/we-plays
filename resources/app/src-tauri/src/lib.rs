mod commands;
mod db;
mod downloader;
mod lan_share;

use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Mutex;

use rusqlite::Connection;
use tauri::Manager;

pub struct AppState {
    pub db: Mutex<Connection>,
    pub lan_server: Mutex<Option<lan_share::LanServerState>>,
    pub active_downloads: Mutex<HashMap<String, tauri_plugin_shell::process::CommandChild>>,
}

fn get_app_data_dir() -> PathBuf {
    #[cfg(target_os = "windows")]
    {
        if let Ok(appdata) = std::env::var("APPDATA") {
            PathBuf::from(appdata).join("we-plays")
        } else {
            PathBuf::from("we-plays")
        }
    }
    #[cfg(target_os = "macos")]
    {
        if let Ok(home) = std::env::var("HOME") {
            PathBuf::from(home).join("Library/Application Support/we-plays")
        } else {
            PathBuf::from("we-plays")
        }
    }
    #[cfg(all(not(target_os = "windows"), not(target_os = "macos")))]
    {
        if let Ok(home) = std::env::var("HOME") {
            PathBuf::from(home).join(".local/share/we-plays")
        } else {
            PathBuf::from("we-plays")
        }
    }
}

fn get_download_dir() -> PathBuf {
    let dir = get_app_data_dir().join("downloads");
    std::fs::create_dir_all(&dir).ok();
    dir
}

pub fn run() {
    let app_data_dir = get_app_data_dir();
    std::fs::create_dir_all(&app_data_dir).expect("Failed to create app data directory");

    let db_path = app_data_dir.join("music.db");
    let conn = Connection::open(&db_path).expect("Failed to open database");

    let state = AppState {
        db: Mutex::new(conn),
        lan_server: Mutex::new(None),
        active_downloads: Mutex::new(HashMap::new()),
    };

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(state)
        .invoke_handler(tauri::generate_handler![
            commands::window_minimize,
            commands::window_maximize,
            commands::window_close,
            commands::search_youtube,
            commands::search_youtube_paginated,
            commands::download_song,
            commands::cancel_download,
            commands::get_all_songs,
            commands::add_song,
            commands::remove_song,
            commands::toggle_favorite,
            commands::update_play_count,
            commands::get_playlists,
            commands::create_playlist,
            commands::delete_playlist,
            commands::add_to_playlist,
            commands::remove_from_playlist,
            commands::get_playlist_songs,
            commands::rename_playlist,
            commands::reorder_playlist_songs,
            commands::add_to_history,
            commands::get_history,
            commands::clear_history,
            commands::get_settings,
            commands::set_setting,
            commands::select_folder,
            commands::import_folder,
            commands::import_files,
            commands::show_file_in_explorer,
            commands::export_library,
            commands::import_library,
            commands::update_ytdlp,
            commands::get_ytdlp_version,
            commands::get_ffmpeg_path,
            commands::get_stream_url,
            commands::search_global,
            commands::get_smart_playlists,
            commands::save_bookmark,
            commands::get_bookmarks,
            commands::delete_bookmark,
            commands::get_all_bookmarks,
            commands::update_song_gain,
            commands::update_song_rating,
            commands::auto_tag_song,
            commands::get_listening_stats,
            commands::get_local_ip,
            commands::start_lan_share,
            commands::stop_lan_share,
            commands::find_duplicates,
            commands::remove_duplicate_songs,
            commands::find_orphaned_songs,
            commands::remove_orphaned_songs,
            commands::find_duplicate_playlists,
            commands::remove_duplicate_playlists,
        ])
        .setup(|app| {
            let state = app.state::<AppState>();
            let mut db = state.db.lock().unwrap();
            db::init_database(&mut db).expect("Failed to initialize database");

            let handle = app.handle().clone();
            let data_dir = app
                .path()
                .app_data_dir()
                .unwrap_or_else(|_| get_app_data_dir());
            std::fs::create_dir_all(&data_dir).ok();

            if let Some(window) = app.get_webview_window("main") {
                window.on_window_event(move |event| {
                    if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                        api.prevent_close();
                    }
                });
            }

            let _ = handle;
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
