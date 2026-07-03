use std::sync::Arc;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpListener;
use tokio::sync::{watch, Mutex};

use crate::db;
use crate::AppState;

const DEFAULT_PORT: u16 = 3847;

pub struct LanServerState {
    pub shutdown_tx: watch::Sender<bool>,
    pub handle: Option<tokio::task::JoinHandle<()>>,
    pub port: u16,
}

pub fn get_local_ip() -> Result<String, String> {
    let ip = local_ip_address::local_ip().map_err(|e| e.to_string())?;
    Ok(ip.to_string())
}

pub async fn start_server(
    state: tauri::State<'_, AppState>,
) -> Result<String, String> {
    {
        let server_state = state.lan_server.lock().map_err(|e| e.to_string())?;
        if server_state.is_some() {
            return Err("LAN server is already running".to_string());
        }
    }

    let (shutdown_tx, mut shutdown_rx) = watch::channel(false);

    let db_arc = {
        let db = state.db.lock().map_err(|e| e.to_string())?;
        let data = db::export_library(&db).map_err(|e| e.to_string())?;
        Arc::new(Mutex::new(data))
    };

    let addr = format!("0.0.0.0:{}", DEFAULT_PORT);
    let listener = TcpListener::bind(&addr)
        .await
        .map_err(|e| format!("Failed to bind to {}: {}", addr, e))?;

    let db_clone = db_arc.clone();
    let handle = tokio::spawn(async move {
        loop {
            tokio::select! {
                result = listener.accept() => {
                    match result {
                        Ok((mut stream, _addr)) => {
                            let db = db_clone.clone();
                            tokio::spawn(async move {
                                if let Err(e) = handle_connection(&mut stream, db).await {
                                    eprintln!("Connection error: {}", e);
                                }
                            });
                        }
                        Err(e) => {
                            eprintln!("Accept error: {}", e);
                        }
                    }
                }
                _ = shutdown_rx.changed() => {
                    break;
                }
            }
        }
    });

    let local_ip = get_local_ip().unwrap_or_else(|_| "unknown".to_string());
    let url = format!("http://{}:{}", local_ip, DEFAULT_PORT);

    {
        let mut server_state = state.lan_server.lock().map_err(|e| e.to_string())?;
        *server_state = Some(LanServerState {
            shutdown_tx,
            handle: Some(handle),
            port: DEFAULT_PORT,
        });
    }

    Ok(url)
}

pub async fn stop_server(
    state: tauri::State<'_, AppState>,
) -> Result<(), String> {
    let mut server_state = state.lan_server.lock().map_err(|e| e.to_string())?;
    if let Some(mut server) = server_state.take() {
        let _ = server.shutdown_tx.send(true);
        if let Some(handle) = server.handle.take() {
            handle.abort();
        }
    }
    Ok(())
}

async fn handle_connection(
    stream: &mut tokio::net::TcpStream,
    db: Arc<Mutex<serde_json::Value>>,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let mut buffer = vec![0u8; 8192];
    let n = stream.read(&mut buffer).await?;
    if n == 0 {
        return Ok(());
    }

    let request = String::from_utf8_lossy(&buffer[..n]);
    let first_line = request.lines().next().unwrap_or("");
    let parts: Vec<&str> = first_line.split_whitespace().collect();
    if parts.len() < 2 {
        send_response(stream, 400, "Bad Request", b"Bad Request").await?;
        return Ok(());
    }

    let method = parts[0];
    let path = parts[1];

    match (method, path) {
        ("GET", "/") => {
            let body = serde_json::json!({
                "name": "We Plays LAN Share",
                "version": "1.0",
                "endpoints": [
                    "/api/playlist",
                    "/api/songs",
                    "/api/playlists",
                    "/api/health"
                ]
            });
            let json = serde_json::to_string_pretty(&body)?;
            send_response(
                stream,
                200,
                "OK",
                json.as_bytes(),
            )
            .await?;
        }
        ("GET", "/api/health") => {
            let body = serde_json::json!({
                "status": "ok",
                "timestamp": chrono::Utc::now().to_rfc3339()
            });
            let json = serde_json::to_string_pretty(&body)?;
            send_response(stream, 200, "OK", json.as_bytes()).await?;
        }
        ("GET", "/api/playlist") => {
            let data = db.lock().await;
            let json = serde_json::to_string_pretty(&*data)?;
            send_response(stream, 200, "OK", json.as_bytes()).await?;
        }
        ("GET", "/api/songs") => {
            let data = db.lock().await;
            let songs = data.get("songs").cloned().unwrap_or(serde_json::json!([]));
            let json = serde_json::to_string_pretty(&songs)?;
            send_response(stream, 200, "OK", json.as_bytes()).await?;
        }
        ("GET", "/api/playlists") => {
            let data = db.lock().await;
            let playlists = data.get("playlists").cloned().unwrap_or(serde_json::json!([]));
            let json = serde_json::to_string_pretty(&playlists)?;
            send_response(stream, 200, "OK", json.as_bytes()).await?;
        }
        ("GET", _) => {
            let body = serde_json::json!({
                "error": "Not Found",
                "message": format!("Endpoint {} not found", path)
            });
            let json = serde_json::to_string_pretty(&body)?;
            send_response(stream, 404, "Not Found", json.as_bytes()).await?;
        }
        _ => {
            send_response(stream, 405, "Method Not Allowed", b"Method Not Allowed").await?;
        }
    }

    Ok(())
}

async fn send_response(
    stream: &mut tokio::net::TcpStream,
    status: u16,
    reason: &str,
    body: &[u8],
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let content_type = if body.starts_with(b"{") || body.starts_with(b"[") {
        "application/json"
    } else {
        "text/plain"
    };

    let header = format!(
        "HTTP/1.1 {} {}\r\nContent-Type: {}; charset=utf-8\r\nContent-Length: {}\r\nAccess-Control-Allow-Origin: *\r\nAccess-Control-Allow-Methods: GET, OPTIONS\r\nConnection: close\r\n\r\n",
        status,
        reason,
        content_type,
        body.len()
    );

    stream.write_all(header.as_bytes()).await?;
    stream.write_all(body).await?;
    stream.flush().await?;

    Ok(())
}
