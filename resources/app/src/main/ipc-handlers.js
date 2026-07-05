const { ipcMain, dialog, shell, app } = require('electron');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const http = require('http');
const os = require('os');
const https = require('https');
const { searchYouTubeMusic, searchYouTubeMusicPaginated, downloadSong, cancelDownload, updateYtdlp, getYtdlpVersion, getFfmpegPath, getStreamUrl, getPlaylistInfo, getAudioFingerprint } = require('./downloader');
const library = require('./library');

let activeDownloads = new Map();
let lanServer = null;


function setupIpcHandlers(mainWindow, store, forceQuit) {
  ipcMain.handle('window-minimize', () => mainWindow.minimize());
  ipcMain.handle('window-maximize', () => {
    if (mainWindow.isMaximized()) mainWindow.unmaximize();
    else mainWindow.maximize();
  });
  ipcMain.handle('window-close', () => {
    if (mainWindow) mainWindow.hide();
  });

  mainWindow.on('maximize', () => mainWindow.webContents.send('window-maximize-change', true));
  mainWindow.on('unmaximize', () => mainWindow.webContents.send('window-maximize-change', false));
  
  ipcMain.handle('search-youtube', async (event, query) => {
    try {
      return await searchYouTubeMusic(query);
    } catch (err) {
      throw new Error(err.message);
    }
  });

  ipcMain.handle('download-song', async (event, options) => {
    const settings = library.getSettings();
    const defaultFolder = settings.downloadFolder || require('electron').app.getPath('music');
    const downloadPath = options.outputPath || defaultFolder;

    if (!fs.existsSync(downloadPath)) {
      fs.mkdirSync(downloadPath, { recursive: true });
    }

    return new Promise((resolve, reject) => {
      const downloadInfo = downloadSong(
        { ...options, outputPath: downloadPath },
        (progress) => {
          mainWindow.webContents.send('download-progress', progress);
        },
        (result) => {
          const dlInfo = activeDownloads.get(result.id);
          const wasCancelled = dlInfo?.cancelled;
          activeDownloads.delete(result.id);

          // If user cancelled, skip adding to library
          if (wasCancelled) {
            resolve({ id: result.id, cancelled: true });
            return;
          }

          const ext = options.format || 'mp3';
          // Extract YouTube video ID from URL for reliable file finding
          const urlMatch = options.url ? options.url.match(/(?:v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/) : null;
          const videoId = urlMatch ? urlMatch[1] : (options.id || result.id);

          // Find file by video ID (yt-dlp now outputs as %(id)s.%(ext)s)
          const idFilename = `${videoId}.${ext}`;
          const altExts = ext === 'mp3' ? ['webm', 'm4a', 'opus'] : [ext];
          let actualPath = path.join(downloadPath, idFilename);
          if (!fs.existsSync(actualPath)) {
            for (const ae of altExts) {
              const candidate = path.join(downloadPath, `${videoId}.${ae}`);
              if (fs.existsSync(candidate)) { actualPath = candidate; break; }
            }
          }
          if (!fs.existsSync(actualPath)) {
            const files = fs.readdirSync(downloadPath)
              .filter(f => f.startsWith(videoId) && altExts.some(ae => f.endsWith(`.${ae}`)))
              .sort((a, b) => fs.statSync(path.join(downloadPath, b)).mtimeMs - fs.statSync(path.join(downloadPath, a)).mtimeMs);
            if (files.length > 0) actualPath = path.join(downloadPath, files[0]);
          }

          // Rename file to search result title for better organization
          if (fs.existsSync(actualPath) && options.title) {
            const sanitized = options.title.replace(/[<>:"/\\|?*]/g, '_');
            const newPath = path.join(downloadPath, `${sanitized}.${ext}`);
            if (actualPath !== newPath && !fs.existsSync(newPath)) {
              try {
                fs.renameSync(actualPath, newPath);
                actualPath = newPath;
              } catch (err) {
                console.error('Failed to rename downloaded file:', err);
              }
            }
          }

          if (!fs.existsSync(actualPath)) {
            actualPath = path.join(downloadPath, `${options.title || videoId}.${ext}`);
          }

          const metadata = {
            yt_id: options.id || result.id,
            title: options.title || 'Unknown',
            artist: options.artist || 'Unknown Artist',
            album: options.album || 'Unknown Album',
            duration: options.duration || 0,
            file_path: actualPath,
            thumbnail: options.thumbnail || null,
            format: ext,
            quality: options.quality || 320
          };

          const songId = library.addSong(metadata);
          
          if (songId) {
            if (options.addToFavorites) {
              const song = library.getSongById(songId);
              if (song && !song.is_favorite) {
                library.toggleFavorite(songId);
              }
            }
            if (options.addToPlaylistId) {
              library.addToPlaylist(options.addToPlaylistId, songId);
            }
          }

          mainWindow.webContents.send('download-complete', {
            id: result.id,
            songId,
            metadata
          });
          resolve({ id: result.id, songId });
        },
        (error) => {
          const msg = error?.message || String(error);
          const id = error?.id || 'unknown';
          const dlInfo = activeDownloads.get(id);
          const wasCancelled = dlInfo?.cancelled;
          activeDownloads.delete(id);
          if (wasCancelled) {
            // Don't send error event for user-cancelled downloads
            resolve({ id, cancelled: true });
            return;
          }
          mainWindow.webContents.send('download-error', { id, error: msg });
          reject(new Error(msg));
        }
      );

      if (downloadInfo) {
        activeDownloads.set(downloadInfo.id, downloadInfo);
      }
    });
  });

  ipcMain.handle('cancel-download', (event, id) => {
    const downloadInfo = activeDownloads.get(id);
    if (downloadInfo) {
      downloadInfo.cancelled = true; // mark so error callback ignores it
      cancelDownload(downloadInfo);
      activeDownloads.delete(id);
      return true;
    }
    return false;
  });

  ipcMain.handle('get-all-songs', () => library.getAllSongs());
  ipcMain.handle('add-song', (event, song) => library.addSong(song));
  ipcMain.handle('remove-song', (event, id) => {
    const song = library.getSongById(id);
    if (song && song.file_path && fs.existsSync(song.file_path)) {
      fs.unlinkSync(song.file_path);
    }
    return library.removeSong(id);
  });
  ipcMain.handle('toggle-favorite', (event, id) => library.toggleFavorite(id));
  ipcMain.handle('update-play-count', (event, id) => library.updatePlayCount(id));
  ipcMain.handle('find-duplicates', () => {
    try {
      return library.findDuplicates();
    } catch (e) {
      console.error('find-duplicates IPC error:', e);
      return [];
    }
  });
  ipcMain.handle('remove-duplicate-songs', (event, songIds) => {
    try {
      return library.removeDuplicateSongs(songIds);
    } catch (e) {
      console.error('remove-duplicate-songs IPC error:', e);
    }
  });

  ipcMain.handle('find-orphaned-songs', () => {
    try {
      return library.findOrphanedSongs();
    } catch (e) {
      console.error('find-orphaned-songs IPC error:', e);
      return [];
    }
  });
  ipcMain.handle('remove-orphaned-songs', (event, songIds) => {
    try {
      return library.removeOrphanedSongs(songIds);
    } catch (e) {
      console.error('remove-orphaned-songs IPC error:', e);
    }
  });
  ipcMain.handle('find-duplicate-playlists', () => {
    try {
      return library.findDuplicatePlaylists();
    } catch (e) {
      console.error('find-duplicate-playlists IPC error:', e);
      return [];
    }
  });
  ipcMain.handle('remove-duplicate-playlists', (event, playlistIds) => {
    try {
      return library.removeDuplicatePlaylists(playlistIds);
    } catch (e) {
      console.error('remove-duplicate-playlists IPC error:', e);
    }
  });

  ipcMain.handle('get-playlists', () => library.getPlaylists());
  ipcMain.handle('create-playlist', (event, name) => library.createPlaylist(name));
  ipcMain.handle('delete-playlist', (event, id) => library.deletePlaylist(id));
  ipcMain.handle('add-to-playlist', (event, playlistId, songId) => library.addToPlaylist(playlistId, songId));
  ipcMain.handle('remove-from-playlist', (event, playlistId, songId) => library.removeFromPlaylist(playlistId, songId));
  ipcMain.handle('get-playlist-songs', (event, playlistId) => library.getPlaylistSongs(playlistId));

  ipcMain.handle('add-to-history', (event, songId) => library.addToHistory(songId));
  ipcMain.handle('get-history', () => library.getHistory());
  ipcMain.handle('clear-history', () => {
    library.clearHistory();
    return true;
  });
  ipcMain.handle('clear-app-cache', async () => {
    const { session } = require('electron');
    if (session && session.defaultSession) {
      await session.defaultSession.clearCache();
      await session.defaultSession.clearStorageData({
        storages: ['appcache', 'cookies', 'filesystem', 'indexdb', 'shadercache', 'websql', 'serviceworkers', 'cachestorage']
      });
    }
    return true;
  });

  ipcMain.handle('get-settings', () => library.getSettings());
  ipcMain.handle('set-setting', (event, key, value) => library.setSetting(key, value));

  ipcMain.handle('select-folder', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory'],
      title: 'Select Download Folder'
    });
    return result.canceled ? null : result.filePaths[0];
  });

  ipcMain.handle('show-file-in-explorer', (event, filePath) => {
    if (filePath && fs.existsSync(filePath)) {
      shell.showItemInFolder(filePath);
    }
  });

  ipcMain.handle('update-ytdlp', () => updateYtdlp());
  ipcMain.handle('get-ytdlp-version', () => getYtdlpVersion());
  ipcMain.handle('get-ffmpeg-path', () => getFfmpegPath());
  ipcMain.handle('get-stream-url', (event, url) => getStreamUrl(url));

  ipcMain.handle('import-folder', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory'],
      title: 'Select Music Folder'
    });
    if (result.canceled || !result.filePaths[0]) return null;

    const folderPath = result.filePaths[0];
    const audioExts = ['.mp3', '.flac', '.wav', '.ogg', '.aac', '.m4a', '.wma', '.opus', '.aiff', '.ape', '.mp4', '.webm'];

    function scanDir(dir) {
      let files = [];
      try {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            files = files.concat(scanDir(fullPath));
          } else if (audioExts.includes(path.extname(entry.name).toLowerCase())) {
            files.push(fullPath);
          }
        }
      } catch {}
      return files;
    }

    const audioFiles = scanDir(folderPath);
    const folderName = path.basename(folderPath);

    if (audioFiles.length === 0) return { playlistId: null, playlistName: folderName, songs: [] };

    const playlistId = library.createPlaylist(folderName);
    const songs = [];

    for (const filePath of audioFiles) {
      const ext = path.extname(filePath).slice(1).toLowerCase();
      const name = path.basename(filePath, path.extname(filePath));
      const localId = 'local_' + crypto.createHash('md5').update(filePath + Date.now()).digest('hex');
      const songId = library.addSong({
        yt_id: localId,
        title: name,
        artist: 'Unknown Artist',
        album: folderName,
        duration: 0,
        file_path: filePath,
        thumbnail: '',
        format: ext,
        quality: 0
      });
      if (songId) {
        library.addToPlaylist(playlistId, songId);
        songs.push({ id: songId, title: name, file_path: filePath });
      }
    }

    return { playlistId, playlistName: folderName, songs };
  });

  ipcMain.handle('import-files', (event, filePaths) => {
    const audioExts = ['.mp3', '.flac', '.wav', '.ogg', '.aac', '.m4a', '.wma', '.opus', '.aiff', '.ape', '.mp4', '.webm'];
    const songs = [];
    
    for (const filePath of filePaths) {
      if (!fs.existsSync(filePath)) continue;
      const stat = fs.statSync(filePath);
      if (stat.isDirectory()) continue;
      
      const ext = path.extname(filePath).toLowerCase();
      if (!audioExts.includes(ext)) continue;
      
      const name = path.basename(filePath, path.extname(filePath));
      const localId = 'local_' + crypto.createHash('md5').update(filePath + Date.now()).digest('hex');
      const songId = library.addSong({
        yt_id: localId,
        title: name,
        artist: 'Unknown Artist',
        album: 'Dropped Files',
        duration: 0,
        file_path: filePath,
        thumbnail: '',
        format: ext.slice(1),
        quality: 0
      });
      if (songId) {
        songs.push({ id: songId, title: name, file_path: filePath });
      }
    }
    return songs;
  });

  ipcMain.handle('rename-playlist', (event, id, name) => library.renamePlaylist(id, name));
  ipcMain.handle('reorder-playlist-songs', (event, playlistId, songIds) => library.reorderPlaylistSongs(playlistId, songIds));
  ipcMain.handle('search-global', (event, query) => library.searchAllSongs(query));
  ipcMain.handle('get-smart-playlists', () => library.getSmartPlaylists());
  ipcMain.handle('export-library', () => library.exportLibrary());
  ipcMain.handle('import-library', (event, data) => library.importLibrary(data));
  ipcMain.handle('save-bookmark', (event, songId, position, label) => library.saveBookmark(songId, position, label));
  ipcMain.handle('get-bookmarks', (event, songId) => library.getBookmarks(songId));
  ipcMain.handle('delete-bookmark', (event, id) => library.deleteBookmark(id));
  ipcMain.handle('get-all-bookmarks', () => library.getAllBookmarks());

  ipcMain.handle('search-youtube-paginated', async (event, query, page) => {
    try {
      return await searchYouTubeMusicPaginated(query, page);
    } catch (err) {
      throw new Error(err.message);
    }
  });

  ipcMain.handle('import-library-file', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      filters: [{ name: 'JSON', extensions: ['json'] }],
      properties: ['openFile']
    });
    if (result.canceled || !result.filePaths[0]) return null;
    try {
      const data = JSON.parse(fs.readFileSync(result.filePaths[0], 'utf-8'));
      return library.importLibrary(data);
    } catch (e) {
      throw new Error('Invalid backup file');
    }
  });

  ipcMain.handle('export-library-file', async () => {
    const result = await dialog.showSaveDialog(mainWindow, {
      filters: [{ name: 'JSON', extensions: ['json'] }],
      defaultPath: `music-library-backup-${Date.now()}.json`
    });
    if (result.canceled || !result.filePath) return false;
    const data = library.exportLibrary();
    fs.writeFileSync(result.filePath, JSON.stringify(data, null, 2));
    return true;
  });

  ipcMain.handle('update-song-gain', (event, id, gain) => library.updateSongGain(id, gain));
  ipcMain.handle('update-song-rating', (event, id, rating) => library.updateSongRating(id, rating));

  // Auto-Tag via MusicBrainz
  ipcMain.handle('auto-tag-song', async (event, songData) => {
    return new Promise((resolve) => {
      const q = encodeURIComponent(`recording:"${songData.title}" artist:"${songData.artist || ''}"`);
      const reqOptions = {
        hostname: 'musicbrainz.org',
        path: `/ws/2/recording/?query=${q}&fmt=json&limit=5`,
        headers: { 'User-Agent': 'OfflineMusicPlayer/1.0 (contact@example.com)' }
      };
      https.get(reqOptions, res => {
        let body = '';
        res.on('data', d => body += d);
        res.on('end', () => {
          try {
            const data = JSON.parse(body);
            const results = (data.recordings || []).slice(0, 5).map(r => ({
              title: r.title,
              artist: r['artist-credit']?.[0]?.name || songData.artist,
              album: r.releases?.[0]?.title || '',
              date: r.releases?.[0]?.date || '',
              mbid: r.id
            }));
            resolve(results);
          } catch(e) { resolve([]); }
        });
      }).on('error', () => resolve([]));
    });
  });

  // Batch Download - Playlist Info
  ipcMain.handle('get-playlist-info', async (event, url) => {
    try { return await getPlaylistInfo(url); }
    catch(e) { throw new Error(e.message); }
  });

  // M3U Export
  ipcMain.handle('export-playlist-m3u', async (event, playlistId) => {
    const songs = playlistId === 'favorites'
      ? library.getAllSongs().filter(s => s.is_favorite)
      : library.getPlaylistSongs(playlistId);
    if (!songs.length) return false;
    const result = await dialog.showSaveDialog(mainWindow, {
      filters: [{ name: 'M3U Playlist', extensions: ['m3u'] }],
      defaultPath: 'playlist.m3u'
    });
    if (result.canceled || !result.filePath) return false;
    const lines = ['#EXTM3U'];
    for (const s of songs) {
      lines.push(`#EXTINF:${Math.round(s.duration || 0)},${s.artist || 'Unknown'} - ${s.title}`);
      lines.push(s.file_path || '');
    }
    fs.writeFileSync(result.filePath, lines.join('\n'), 'utf-8');
    return true;
  });

  // Audio Fingerprinting
  ipcMain.handle('fingerprint-song', async (event, filePath) => {
    try { return await getAudioFingerprint(filePath); }
    catch(e) { throw new Error(e.message); }
  });



  // Stats
  ipcMain.handle('get-listening-stats', () => library.getListeningStats());

  // LAN Collaborative Playlists
  function getLocalIp() {
    const ifaces = os.networkInterfaces();
    for (const iface of Object.values(ifaces)) {
      for (const addr of iface) {
        if (addr.family === 'IPv4' && !addr.internal) return addr.address;
      }
    }
    return '127.0.0.1';
  }

  ipcMain.handle('get-local-ip', () => getLocalIp());

  ipcMain.handle('start-lan-share', (event, playlistId) => {
    if (lanServer) { try { lanServer.close(); } catch(_) {} lanServer = null; }
    const port = 3847;
    lanServer = http.createServer((req, res) => {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      if (req.url === '/') {
        const songs = playlistId === 'favorites'
          ? library.getAllSongs().filter(s => s.is_favorite)
          : library.getPlaylistSongs(playlistId);
        const playlists = library.getPlaylists();
        const pl = playlists.find(p => p.id === playlistId);
        res.end(JSON.stringify({ name: pl?.name || 'Shared Playlist', songs: songs.map(s => ({ title: s.title, artist: s.artist, album: s.album, duration: s.duration, thumbnail: s.thumbnail })) }));
      } else { res.statusCode = 404; res.end(JSON.stringify({ error: 'Not found' })); }
    });
    try {
      lanServer.listen(port);
      const ip = getLocalIp();
      return { url: `http://${ip}:${port}`, ip, port };
    } catch(e) {
      return { error: e.message };
    }
  });

  ipcMain.handle('stop-lan-share', () => {
    if (lanServer) { try { lanServer.close(); } catch(_) {} lanServer = null; }
    return true;
  });

  // ── AUTO-UPDATER HANDLERS ──────────────────────────────────────────────

  ipcMain.handle('get-app-version', () => app.getVersion());

  ipcMain.handle('check-app-update', async () => {
    try {
      const release = await fetchLatestRelease();
      const latestVer = release.tag_name.replace(/^v/, '');
      const currentVer = app.getVersion();
      
      const updateAvailable = isNewerVersion(currentVer, latestVer);
      const exeAsset = release.assets?.find(a => a.name.endsWith('.exe'));
      
      return {
        updateAvailable,
        version: latestVer,
        releaseNotes: release.body || '',
        downloadUrl: exeAsset ? exeAsset.browser_download_url : null,
        fileName: exeAsset ? exeAsset.name : null
      };
    } catch (err) {
      throw new Error(err.message);
    }
  });

  ipcMain.handle('install-app-update', async (event, downloadUrl) => {
    if (!downloadUrl) {
      throw new Error('No download URL provided for update');
    }
    try {
      const destPath = path.join(app.getPath('temp'), 'WePlays-Setup-Update.exe');

      // Delete old installer if it exists
      if (fs.existsSync(destPath)) {
        try { fs.unlinkSync(destPath); } catch (_) {}
      }

      await downloadFile(downloadUrl, destPath, (percent) => {
        mainWindow.webContents.send('update-progress', Math.max(0, Math.min(100, percent)));
      });

      if (!fs.existsSync(destPath)) {
        throw new Error('Update installer failed to download');
      }

      // Launch the NSIS installer and quit the app after it starts
      const { spawn } = require('child_process');
      const child = spawn(destPath, [], {
        shell: false,
        detached: true,
        windowsHide: false,
        stdio: 'ignore'
      });
      child.on('error', (err) => {
        console.error('Failed to launch installer:', err);
      });
      child.unref();

      // Give the installer time to fully detach before quitting
      await new Promise(resolve => setTimeout(resolve, 2000));
      if (forceQuit) forceQuit();
      app.quit();
      return true;
    } catch (err) {
      throw new Error(err?.message || String(err));
    }
  });
}

// ── AUTO-UPDATER HELPERS ──────────────────────────────────────────────────

function fetchLatestRelease() {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.github.com',
      path: `/repos/shaswatxd/we-plays/releases/latest?t=${Date.now()}`,
      headers: {
        'User-Agent': 'we-plays-updater',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache'
      }
    };

    https.get(options, (res) => {
      if (res.statusCode !== 200) {
        reject(new Error(`Failed to check for updates: Status Code ${res.statusCode}`));
        return;
      }

      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', (err) => {
      reject(err);
    });
  });
}

function isNewerVersion(current, latest) {
  const c = current.replace(/^v/, '').split('.').map(Number);
  const l = latest.replace(/^v/, '').split('.').map(Number);
  for (let i = 0; i < Math.max(c.length, l.length); i++) {
    const cv = c[i] || 0;
    const lv = l[i] || 0;
    if (lv > cv) return true;
    if (lv < cv) return false;
  }
  return false;
}

function downloadFile(url, destPath, progressCallback) {
  return new Promise((resolve, reject) => {
    let settled = false;
    function done(err) {
      if (settled) return;
      settled = true;
      if (err) {
        fs.unlink(destPath, () => {});
        reject(err);
      } else {
        resolve();
      }
    }

    const file = fs.createWriteStream(destPath);
    file.on('error', (err) => done(err));

    function getUrl(targetUrl, redirects) {
      if (redirects > 10) {
        done(new Error('Too many redirects while downloading update'));
        return;
      }
      const isHttps = targetUrl.startsWith('https');
      const lib = isHttps ? https : http;
      lib.get(targetUrl, { headers: { 'User-Agent': 'we-plays-updater' } }, (res) => {
        if (res.statusCode === 301 || res.statusCode === 302 || res.statusCode === 303 || res.statusCode === 307 || res.statusCode === 308) {
          // Must consume redirect response body to free the socket
          res.resume();
          const location = res.headers.location;
          if (!location) {
            done(new Error('Redirect with no Location header'));
            return;
          }
          getUrl(location, redirects + 1);
          return;
        }
        if (res.statusCode !== 200) {
          res.resume();
          done(new Error(`Failed to download update: Status Code ${res.statusCode}`));
          return;
        }

        const totalBytes = parseInt(res.headers['content-length'], 10) || 0;
        let downloadedBytes = 0;

        res.on('data', (chunk) => {
          downloadedBytes += chunk.length;
          if (totalBytes > 0) {
            const percent = Math.round((downloadedBytes / totalBytes) * 100);
            progressCallback(percent);
          }
        });

        res.pipe(file);

        file.on('finish', () => {
          file.close(() => done(null));
        });

        res.on('error', (err) => done(err));
      }).on('error', (err) => done(err));
    }

    getUrl(url, 0);
  });
}


module.exports = { setupIpcHandlers };
