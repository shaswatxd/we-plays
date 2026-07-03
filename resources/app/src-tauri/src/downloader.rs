use std::path::PathBuf;

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter};
use tauri_plugin_shell::ShellExt;

use crate::db;
use crate::AppState;

#[derive(Debug, Clone, Serialize, Deserialize)]
struct YtDlpJson {
    id: Option<String>,
    title: Option<String>,
    channel: Option<String>,
    duration: Option<i64>,
    thumbnail: Option<String>,
    url: Option<String>,
    webpage_url: Option<String>,
    uploader: Option<String>,
    uploader_id: Option<String>,
    playlist_title: Option<String>,
    playlist_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct YtDlpStreamJson {
    url: Option<String>,
}

pub async fn search_youtube(
    app: &AppHandle,
    query: &str,
    page: u32,
) -> Result<Vec<db::SearchResult>, String> {
    let count = 10;
    let offset = (page - 1) * count;
    let search_term = format!("ytsearch{}:{}{}", count, query, if offset > 0 { format!("&start={}", offset) } else { String::new() });

    let sidecar = app.shell().sidecar("yt-dlp").map_err(|e| e.to_string())?;
    let (mut rx, _child) = sidecar
        .args([
            "--dump-json",
            "--flat-playlist",
            "--no-warnings",
            &search_term,
        ])
        .spawn()
        .map_err(|e| e.to_string())?;

    let mut output = String::new();
    while let Some(event) = rx.recv().await {
        match event {
            tauri_plugin_shell::process::CommandEvent::Stdout(bytes) => {
                output.push_str(&String::from_utf8_lossy(&bytes));
            }
            tauri_plugin_shell::process::CommandEvent::Stderr(bytes) => {
                let stderr = String::from_utf8_lossy(&bytes);
                if stderr.contains("ERROR") {
                    return Err(stderr.to_string());
                }
            }
            tauri_plugin_shell::process::CommandEvent::Terminated(status) => {
                if let Some(code) = status.code {
                    if code != 0 {
                        return Err(format!("yt-dlp exited with code {}", code));
                    }
                }
                break;
            }
            tauri_plugin_shell::process::CommandEvent::Error(e) => {
                return Err(format!("Process error: {}", e));
            }
            _ => {}
        }
    }

    let mut results = Vec::new();
    for line in output.lines() {
        let line = line.trim();
        if line.is_empty() {
            continue;
        }
        if let Ok(json) = serde_json::from_str::<YtDlpJson>(line) {
            let id = json.id.unwrap_or_default();
            results.push(db::SearchResult {
                id: id.clone(),
                title: json.title.unwrap_or_else(|| "Unknown".to_string()),
                channel: json
                    .channel
                    .or(json.uploader)
                    .unwrap_or_else(|| "Unknown".to_string()),
                duration: json.duration,
                thumbnail: json.thumbnail,
                url: json
                    .webpage_url
                    .unwrap_or_else(|| format!("https://www.youtube.com/watch?v={}", id)),
            });
        }
    }

    Ok(results)
}

pub async fn download_song(
    app: &AppHandle,
    url: &str,
    quality: &str,
    format: &str,
    state: &tauri::State<'_, AppState>,
) -> Result<String, String> {
    let download_dir = get_download_dir();
    std::fs::create_dir_all(&download_dir).map_err(|e| e.to_string())?;

    let output_template = download_dir
        .join("%(title)s.%(ext)s")
        .to_string_lossy()
        .to_string();

    let ffmpeg_location = std::env::current_exe()
        .ok()
        .and_then(|p| p.parent().map(|d| d.to_string_lossy().to_string()))
        .unwrap_or_default();

    let mut args = vec![
        "-x".to_string(),
        "--audio-format".to_string(),
        format.to_string(),
        "--audio-quality".to_string(),
        quality.to_string(),
        "--ffmpeg-location".to_string(),
        ffmpeg_location,
        "-o".to_string(),
        output_template,
        "--no-playlist".to_string(),
        "--newline".to_string(),
        "--progress".to_string(),
        url.to_string(),
    ];

    let sidecar = app.shell().sidecar("yt-dlp").map_err(|e| e.to_string())?;
    let (mut rx, child) = sidecar
        .args(&args)
        .spawn()
        .map_err(|e| e.to_string())?;

    let download_id = uuid::Uuid::new_v4().to_string();

    {
        let mut active = state
            .active_downloads
            .lock()
            .map_err(|e| e.to_string())?;
        active.insert(download_id.clone(), child);
    }

    let mut output_path = None;
    let mut song_title = None;
    let mut song_artist = None;

    while let Some(event) = rx.recv().await {
        match event {
            tauri_plugin_shell::process::CommandEvent::Stdout(bytes) => {
                let line = String::from_utf8_lossy(&bytes).to_string();
                if line.contains("[download]") {
                    if line.contains("Destination:") {
                        if let Some(path) = line.split("Destination:").nth(1) {
                            output_path = Some(path.trim().to_string());
                        }
                    }
                    if line.contains("100%") {
                        if let Some(_path) = &output_path {
                            app.emit("download-progress", serde_json::json!({
                                "download_id": download_id,
                                "progress": 100,
                                "status": "complete"
                            }))
                            .ok();
                        }
                    } else if let Some(pct_str) = line
                        .split_whitespace()
                        .find(|s| s.ends_with('%'))
                    {
                        if let Ok(pct) = pct_str.trim_end_matches('%').parse::<f64>() {
                            app.emit("download-progress", serde_json::json!({
                                "download_id": download_id,
                                "progress": pct,
                                "status": "downloading"
                            }))
                            .ok();
                        }
                    }
                } else if line.contains("[Merger]") || line.contains("[ExtractAudio]") {
                    if let Some(path) = line
                        .split("Merging formats into \"")
                        .nth(1)
                        .map(|s| s.trim_end_matches('"'))
                        .or_else(|| {
                            line.split("Destination:").nth(1).map(|s| s.trim())
                        })
                    {
                        output_path = Some(path.to_string());
                    }
                }
            }
            tauri_plugin_shell::process::CommandEvent::Stderr(bytes) => {
                let stderr = String::from_utf8_lossy(&bytes);
                if stderr.contains("ERROR") {
                    app.emit(
                        "download-error",
                        serde_json::json!({
                            "download_id": download_id,
                            "error": stderr.trim()
                        }),
                    )
                    .ok();
                    return Err(stderr.to_string());
                }
            }
            tauri_plugin_shell::process::CommandEvent::Terminated(status) => {
                if let Some(code) = status.code {
                    if code != 0 {
                        return Err(format!("yt-dlp exited with code {}", code));
                    }
                }
                break;
            }
            tauri_plugin_shell::process::CommandEvent::Error(e) => {
                return Err(format!("Process error: {}", e));
            }
            _ => {}
        }
    }

    {
        let mut active = state
            .active_downloads
            .lock()
            .map_err(|e| e.to_string())?;
        active.remove(&download_id);
    }

    let final_path = output_path.ok_or_else(|| "No output file path captured".to_string())?;

    let metadata = get_video_metadata(app, url).await.ok();
    if let Some(meta) = &metadata {
        song_title = meta.title.clone();
        song_artist = meta.channel.clone().or(meta.uploader.clone());
    }

    let id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Utc::now().to_rfc3339();
    let ext = std::path::Path::new(&final_path)
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or(format)
        .to_string();

    let yt_id = extract_video_id(url);

    let song = db::Song {
        id: id.clone(),
        yt_id,
        title: song_title.unwrap_or_else(|| "Unknown".to_string()),
        artist: song_artist,
        album: None,
        duration: metadata.as_ref().and_then(|m| m.duration),
        file_path: final_path,
        thumbnail: metadata.as_ref().and_then(|m| m.thumbnail.clone()),
        format: Some(ext),
        quality: Some(quality.to_string()),
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

    app.emit(
        "download-complete",
        serde_json::json!({
            "download_id": download_id,
            "song": song
        }),
    )
    .ok();

    Ok(id)
}

pub async fn cancel_download(
    download_id: &str,
    state: &tauri::State<'_, AppState>,
) -> Result<(), String> {
    let mut manager = state
        .active_downloads
        .lock()
        .map_err(|e| e.to_string())?;
    if let Some(child) = manager.remove(download_id) {
        child.kill().map_err(|e| e.to_string())?;
    }
    Ok(())
}

pub async fn update_ytdlp(app: &AppHandle) -> Result<String, String> {
    let sidecar = app.shell().sidecar("yt-dlp").map_err(|e| e.to_string())?;
    let (mut rx, _child) = sidecar
        .args(["-U"])
        .spawn()
        .map_err(|e| e.to_string())?;

    let mut output = String::new();
    while let Some(event) = rx.recv().await {
        match event {
            tauri_plugin_shell::process::CommandEvent::Stdout(bytes) => {
                output.push_str(&String::from_utf8_lossy(&bytes));
            }
            tauri_plugin_shell::process::CommandEvent::Stderr(bytes) => {
                output.push_str(&String::from_utf8_lossy(&bytes));
            }
            tauri_plugin_shell::process::CommandEvent::Terminated(_) => break,
            _ => {}
        }
    }
    Ok(output)
}

pub async fn get_version(app: &AppHandle) -> Result<String, String> {
    let sidecar = app.shell().sidecar("yt-dlp").map_err(|e| e.to_string())?;
    let (mut rx, _child) = sidecar
        .args(["--version"])
        .spawn()
        .map_err(|e| e.to_string())?;

    while let Some(event) = rx.recv().await {
        if let tauri_plugin_shell::process::CommandEvent::Stdout(bytes) = event {
            let version = String::from_utf8_lossy(&bytes).trim().to_string();
            if !version.is_empty() {
                return Ok(version);
            }
        }
    }
    Ok("unknown".to_string())
}

pub async fn get_stream_url(app: &AppHandle, url: &str) -> Result<String, String> {
    let sidecar = app.shell().sidecar("yt-dlp").map_err(|e| e.to_string())?;
    let (mut rx, _child) = sidecar
        .args(["-g", "--no-playlist", url])
        .spawn()
        .map_err(|e| e.to_string())?;

    let mut output = String::new();
    while let Some(event) = rx.recv().await {
        if let tauri_plugin_shell::process::CommandEvent::Stdout(ref bytes) = event {
            output.push_str(&String::from_utf8_lossy(bytes));
        }
        if let tauri_plugin_shell::process::CommandEvent::Terminated(_) = event {
            break;
        }
    }

    let stream_url = output.trim().lines().next().unwrap_or("").to_string();
    if stream_url.is_empty() {
        return Err("Could not get stream URL".to_string());
    }
    Ok(stream_url)
}

async fn get_video_metadata(
    app: &AppHandle,
    url: &str,
) -> Result<YtDlpJson, String> {
    let sidecar = app.shell().sidecar("yt-dlp").map_err(|e| e.to_string())?;
    let (mut rx, _child) = sidecar
        .args(["--dump-json", "--no-playlist", url])
        .spawn()
        .map_err(|e| e.to_string())?;

    let mut output = String::new();
    while let Some(event) = rx.recv().await {
        if let tauri_plugin_shell::process::CommandEvent::Stdout(ref bytes) = event {
            output.push_str(&String::from_utf8_lossy(bytes));
        }
        if let tauri_plugin_shell::process::CommandEvent::Terminated(_) = event {
            break;
        }
    }

    serde_json::from_str(&output).map_err(|e| e.to_string())
}

fn extract_video_id(url: &str) -> Option<String> {
    if url.contains("youtube.com/watch") {
        url.split("v=").nth(1).map(|s| {
            s.split('&')
                .next()
                .unwrap_or(s)
                .to_string()
        })
    } else if url.contains("youtu.be/") {
        url.split("youtu.be/").nth(1).map(|s| {
            s.split('?')
                .next()
                .unwrap_or(s)
                .to_string()
        })
    } else if url.contains("youtube.com/shorts/") {
        url.split("shorts/").nth(1).map(|s| {
            s.split('?')
                .next()
                .unwrap_or(s)
                .to_string()
        })
    } else {
        None
    }
}

fn get_download_dir() -> PathBuf {
    let base = std::env::var("LOCALAPPDATA")
        .or_else(|_| std::env::var("APPDATA"))
        .unwrap_or_else(|_| ".".to_string());
    PathBuf::from(base)
        .join("we-plays")
        .join("downloads")
}
