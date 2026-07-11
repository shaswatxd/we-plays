const { execSync, exec, spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const https = require('https');

// In-memory search cache (key = query, value = { results, ts })
const searchCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

function getYtdlpLocalDir() {
  const localAppData = process.env.LOCALAPPDATA || path.join(require('os').homedir(), 'AppData', 'Local');
  return path.join(localAppData, 'We Plays', 'binaries');
}

function getYtdlpPath() {
  const isAsar = __dirname.includes('app.asar');

  // 1. User-writable updated copy (from previous updates)
  const localDir = getYtdlpLocalDir();
  const localBin = process.platform === 'win32'
    ? path.join(localDir, 'yt-dlp.exe')
    : path.join(localDir, 'yt-dlp');
  if (fs.existsSync(localBin)) return localBin;

  // 2. Packaged extraResources
  if (process.resourcesPath) {
    const extraResource = path.join(process.resourcesPath, 'binaries/yt-dlp.exe');
    if (fs.existsSync(extraResource)) return extraResource;
    const extraResourceUnix = path.join(process.resourcesPath, 'binaries/yt-dlp');
    if (fs.existsSync(extraResourceUnix)) return extraResourceUnix;
  }

  // 3. asar.unpacked
  const asarUnpacked = path.join(__dirname, '../../../app.asar.unpacked/assets/binaries/yt-dlp.exe');
  if (fs.existsSync(asarUnpacked)) return asarUnpacked;
  const asarUnpackedUnix = path.join(__dirname, '../../../app.asar.unpacked/assets/binaries/yt-dlp');
  if (fs.existsSync(asarUnpackedUnix)) return asarUnpackedUnix;

  // 4. Dev mode
  if (!isAsar) {
    const bundled = path.join(__dirname, '../../assets/binaries/yt-dlp.exe');
    if (fs.existsSync(bundled)) return bundled;
    const bundledUnix = path.join(__dirname, '../../assets/binaries/yt-dlp');
    if (fs.existsSync(bundledUnix)) return bundledUnix;
  }

  // 5. System PATH
  try {
    execSync('yt-dlp --version', { stdio: 'ignore', windowsHide: true });
    return 'yt-dlp';
  } catch {
    return null;
  }
}

function getFfmpegPath() {
  try {
    const ffmpegPath = require('ffmpeg-static');
    if (ffmpegPath) {
      if (ffmpegPath.includes('app.asar')) {
        const unpacked = ffmpegPath.replace('app.asar', 'app.asar.unpacked');
        if (fs.existsSync(unpacked)) return unpacked;
      }
      if (fs.existsSync(ffmpegPath)) return ffmpegPath;
    }
  } catch {}
  try {
    execSync('ffmpeg -version', { stdio: 'ignore', windowsHide: true });
    return 'ffmpeg';
  } catch {
    return null;
  }
}

function getFfmpegLocalDir() {
  const localAppData = process.env.LOCALAPPDATA || path.join(require('os').homedir(), 'AppData', 'Local');
  return path.join(localAppData, 'We Plays', 'binaries');
}

function getFfmpegVersion() {
  return new Promise((resolve) => {
    const ffmpegPath = getFfmpegPath();
    if (!ffmpegPath) {
      resolve('Not installed');
      return;
    }
    try {
      const output = execSync(`"${ffmpegPath}" -version`, { windowsHide: true }).toString();
      const match = output.match(/ffmpeg version (\S+)/);
      resolve(match ? match[1] : 'Unknown');
    } catch {
      resolve('Unknown');
    }
  });
}

function updateFfmpeg() {
  return new Promise((resolve, reject) => {
    const isWin = process.platform === 'win32';
    if (!isWin) {
      reject(new Error('Auto-update of ffmpeg is only supported on Windows'));
      return;
    }

    const localDir = getFfmpegLocalDir();
    const targetPath = path.join(localDir, 'ffmpeg.exe');

    if (!fs.existsSync(localDir)) fs.mkdirSync(localDir, { recursive: true });

    // Get current version
    let currentVer = '';
    try {
      if (fs.existsSync(targetPath)) {
        const output = execSync(`"${targetPath}" -version`, { windowsHide: true }).toString();
        const match = output.match(/ffmpeg version (\S+)/);
        currentVer = match ? match[1] : '';
      }
    } catch {}

    // Fetch latest release from BtbN/FFmpeg-Builds
    const options = {
      hostname: 'api.github.com',
      path: '/repos/BtbN/FFmpeg-Builds/releases/latest',
      headers: { 'User-Agent': 'WePlays-App' }
    };

    https.get(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const release = JSON.parse(data);
          const latestVer = release.tag_name || '';

          if (currentVer && latestVer && currentVer === latestVer) {
            resolve('ffmpeg is up to date');
            return;
          }

          // Find the Windows 64-bit GPL zip asset
          const asset = release.assets.find(a =>
            a.name.includes('win64-gpl') && a.name.endsWith('.zip')
          );
          if (!asset) {
            reject(new Error('Windows ffmpeg build not found in release'));
            return;
          }

          function followRedirects(url, callback) {
            const parsedUrl = new URL(url);
            const opts = {
              hostname: parsedUrl.hostname,
              path: parsedUrl.pathname + parsedUrl.search,
              headers: { 'User-Agent': 'WePlays-App' }
            };
            https.get(opts, (resp) => {
              if (resp.statusCode >= 300 && resp.statusCode < 400 && resp.headers.location) {
                followRedirects(resp.headers.location, callback);
              } else {
                callback(resp);
              }
            }).on('error', reject);
          }

          // Download zip
          followRedirects(asset.browser_download_url, (resp) => {
            if (resp.statusCode !== 200) {
              reject(new Error(`Download failed with status ${resp.statusCode}`));
              return;
            }

            const zipPath = path.join(localDir, 'ffmpeg-update.zip');
            const file = fs.createWriteStream(zipPath);
            resp.pipe(file);
            file.on('finish', () => {
              file.close(() => {
                // Write a temp .ps1 script to avoid quoting issues with spaces in paths
                const extractDir = path.join(localDir, 'ffmpeg-extract');
                const ffprobePath = path.join(localDir, 'ffprobe.exe');
                const ps1Content = [
                  `Expand-Archive -Path '${zipPath}' -DestinationPath '${extractDir}' -Force`,
                  `$f = Get-ChildItem -Path '${extractDir}' -Recurse -Filter 'ffmpeg.exe' | Select-Object -First 1`,
                  `if ($f) { Copy-Item -Path $f.FullName -Destination '${targetPath}' -Force }`,
                  `$p = Get-ChildItem -Path '${extractDir}' -Recurse -Filter 'ffprobe.exe' | Select-Object -First 1`,
                  `if ($p) { Copy-Item -Path $p.FullName -Destination '${ffprobePath}' -Force }`,
                  `Remove-Item -Path '${extractDir}' -Recurse -Force -ErrorAction SilentlyContinue`,
                  `Remove-Item -Path '${zipPath}' -Force -ErrorAction SilentlyContinue`
                ].join('\n');

                const ps1Path = path.join(localDir, 'ffmpeg-extract.ps1');
                fs.writeFileSync(ps1Path, ps1Content, 'utf-8');

                exec(`powershell -NoProfile -ExecutionPolicy Bypass -File "${ps1Path}"`, { windowsHide: true }, (err) => {
                  try { fs.unlinkSync(ps1Path); } catch {}
                  if (err) {
                    try { fs.unlinkSync(zipPath); } catch {}
                    reject(new Error('Failed to extract ffmpeg: ' + err.message));
                    return;
                  }
                  resolve(`ffmpeg updated to ${latestVer}`);
                });
              });
            });
            file.on('error', (err) => {
              try { fs.unlinkSync(zipPath); } catch {}
              reject(err);
            });
          });
        } catch (e) {
          reject(new Error('Failed to check for ffmpeg updates: ' + e.message));
        }
      });
    }).on('error', (err) => {
      reject(new Error('Network error: ' + err.message));
    });
  });
}

function searchYouTubeMusic(query) {
  // Return cached results if fresh
  const cacheKey = query.toLowerCase().trim();
  const cached = searchCache.get(cacheKey);
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return Promise.resolve(cached.results);
  }

  return new Promise((resolve, reject) => {
    const ytdlp = getYtdlpPath();
    if (!ytdlp) {
      reject(new Error('yt-dlp not found. Place yt-dlp.exe in assets/binaries/'));
      return;
    }

    // Use --print to get only needed fields (much faster than --dump-json)
    // Fetch 10 results with flat extraction (no extra network calls per video)
    const args = [
      `ytsearch10:${query}`,
      '--no-playlist',
      '--flat-playlist',
      '--print', 'id,title,uploader,duration,view_count,upload_date',
      '--no-warnings',
      '--quiet'
    ];

    const proc = spawn(ytdlp, args, { windowsHide: true });
    let stdout = '';
    let stderr = '';
    let timedOut = false;

    // 15 second timeout
    const timeout = setTimeout(() => {
      timedOut = true;
      proc.kill();
      reject(new Error('Search timed out. Check your internet connection.'));
    }, 15000);

    proc.stdout.on('data', (d) => { stdout += d.toString(); });
    proc.stderr.on('data', (d) => { stderr += d.toString(); });

    proc.on('close', (code) => {
      clearTimeout(timeout);
      if (timedOut) return;

      if (code !== 0 && !stdout.trim()) {
        reject(new Error(stderr.trim() || 'yt-dlp search failed'));
        return;
      }

      // --print outputs each field on its own line, 6 lines per video
      const lines = stdout.trim().split('\n').map(l => l.trim()).filter(Boolean);
      const results = [];

      for (let i = 0; i + 5 < lines.length; i += 6) {
        const id          = lines[i];
        const title       = lines[i + 1] || 'Unknown';
        const uploader    = lines[i + 2] || 'Unknown Artist';
        const durationRaw = lines[i + 3];
        const viewsRaw    = lines[i + 4];
        const uploadDate  = lines[i + 5] || '';

        const duration = durationRaw && durationRaw !== 'NA' ? parseFloat(durationRaw) : 0;
        const views    = viewsRaw    && viewsRaw    !== 'NA' ? parseInt(viewsRaw)      : 0;

        if (!id || id === 'NA') continue;

        results.push({
          id,
          title,
          artist: uploader,
          duration,
          thumbnail: `https://i.ytimg.com/vi/${id}/mqdefault.jpg`,
          url: `https://www.youtube.com/watch?v=${id}`,
          views,
          uploadDate,
          album: ''
        });
      }

      // Cache results
      searchCache.set(cacheKey, { results, ts: Date.now() });
      // Limit cache size
      if (searchCache.size > 50) {
        const firstKey = searchCache.keys().next().value;
        searchCache.delete(firstKey);
      }

      resolve(results);
    });

    proc.on('error', (err) => {
      clearTimeout(timeout);
      reject(new Error(`Failed to run yt-dlp: ${err.message}`));
    });
  });
}

function downloadSong(options, onProgress, onComplete, onError) {
  const { id, url, format = 'mp3', quality = 320, outputPath, embedThumbnail = true, addMetadata = true, title, artist } = options;
  const ytdlp = getYtdlpPath();
  const ffmpegPath = getFfmpegPath();

  if (!ytdlp) {
    onError(new Error('yt-dlp not found. Please install yt-dlp or place it in assets/binaries/'));
    return null;
  }

  const audioQuality = format === 'flac' ? '0'
    : quality >= 320 ? '0'
    : quality >= 256 ? '1'
    : quality >= 192 ? '2'
    : '3';

  const args = [
    '--extract-audio',
    '--audio-format', format,
    '--audio-quality', audioQuality,
    '--output', path.join(outputPath, '%(id)s.%(ext)s'),
    '--no-playlist',
    '--no-overwrites',
    '--no-warnings'
  ];

  if (ffmpegPath) {
    const ffDir = fs.statSync(ffmpegPath).isFile() ? path.dirname(ffmpegPath) : ffmpegPath;
    args.push('--ffmpeg-location', ffDir);
  }

  if (embedThumbnail) args.push('--embed-thumbnail');
  if (addMetadata) {
    args.push('--add-metadata');
  }

  args.push(url);

  const proc = spawn(ytdlp, args, { windowsHide: true });
  const downloadId = id || Date.now().toString();
  let stderrOutput = '';

  proc.stdout.on('data', (data) => {
    const output = data.toString();
    const progressMatch = output.match(/\[download\]\s+([\d.]+)%/);
    const speedMatch = output.match(/at\s+([\d.]+\s*\w+\/s)/);
    const etaMatch = output.match(/ETA\s+(\S+)/);
    const sizeMatch = output.match(/of\s+~?([\d.]+\s*\w+)/);

    if (progressMatch) {
      onProgress({
        id: downloadId,
        progress: parseFloat(progressMatch[1]),
        speed: speedMatch ? speedMatch[1] : null,
        eta: etaMatch ? etaMatch[1] : null,
        totalSize: sizeMatch ? sizeMatch[1] : null
      });
    }
  });

  proc.stderr.on('data', (data) => {
    const output = data.toString();
    stderrOutput += output;
    const progressMatch = output.match(/\[download\]\s+([\d.]+)%/);
    if (progressMatch) {
      onProgress({
        id: downloadId,
        progress: parseFloat(progressMatch[1]),
        speed: null,
        eta: null,
        totalSize: null
      });
    }
  });

  proc.on('close', (code) => {
    if (code === 0) {
      onComplete({ id: downloadId, outputPath });
    } else {
      const detail = stderrOutput.trim() || 'No error details available';
      onError({ id: downloadId, message: `yt-dlp exited with code ${code}: ${detail}` });
    }
  });

  proc.on('error', (err) => {
    onError({ id: downloadId, message: err.message });
  });

  return { id: downloadId, process: proc };
}

function cancelDownload(downloadInfo) {
  if (downloadInfo && downloadInfo.process) {
    try {
      downloadInfo.process.kill('SIGTERM');
    } catch {}
    return true;
  }
  return false;
}

function updateYtdlp() {
  return new Promise((resolve, reject) => {
    const https = require('https');
    const { execSync } = require('child_process');
    const localDir = getYtdlpLocalDir();
    const isWin = process.platform === 'win32';
    const fileName = isWin ? 'yt-dlp.exe' : 'yt-dlp';
    const targetPath = path.join(localDir, fileName);

    // Ensure directory exists
    if (!fs.existsSync(localDir)) fs.mkdirSync(localDir, { recursive: true });

    // Detect current version
    const currentBin = getYtdlpPath();
    let currentVer = '';
    try { currentVer = execSync(`"${currentBin}" --version`, { windowsHide: true }).toString().trim(); } catch {}

    // Get latest version from GitHub API
    const options = {
      hostname: 'api.github.com',
      path: '/repos/yt-dlp/yt-dlp/releases/latest',
      headers: { 'User-Agent': 'WePlays-App' }
    };

    https.get(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const release = JSON.parse(data);
          const latestVer = release.tag_name;

          if (currentVer && currentVer === latestVer) {
            resolve('yt-dlp is up to date');
            return;
          }

          // Find the correct asset
          const assetName = isWin ? 'yt-dlp.exe' : 'yt-dlp';
          const asset = release.assets.find(a => a.name === assetName);
          if (!asset) {
            reject(new Error('Asset not found in release'));
            return;
          }

          // Download the asset
          const downloadOpts = {
            hostname: 'github.com',
            path: asset.browser_download_url.replace('https://github.com', ''),
            headers: { 'User-Agent': 'WePlays-App' }
          };

          // Use redirect-following download
          function followRedirects(url, callback) {
            const parsedUrl = new URL(url);
            const opts = {
              hostname: parsedUrl.hostname,
              path: parsedUrl.pathname + parsedUrl.search,
              headers: { 'User-Agent': 'WePlays-App' }
            };
            https.get(opts, (resp) => {
              if (resp.statusCode >= 300 && resp.statusCode < 400 && resp.headers.location) {
                followRedirects(resp.headers.location, callback);
              } else {
                callback(resp);
              }
            }).on('error', reject);
          }

          followRedirects(asset.browser_download_url, (resp) => {
            if (resp.statusCode !== 200) {
              reject(new Error(`Download failed with status ${resp.statusCode}`));
              return;
            }
            const file = fs.createWriteStream(targetPath);
            resp.pipe(file);
            file.on('finish', () => {
              file.close();
              // Make executable on unix
              if (!isWin) {
                try { fs.chmodSync(targetPath, 0o755); } catch {}
              }
              resolve(`yt-dlp updated to ${latestVer}`);
            });
            file.on('error', (err) => {
              fs.unlink(targetPath, () => {});
              reject(err);
            });
          });
        } catch (e) {
          reject(new Error('Failed to check for updates: ' + e.message));
        }
      });
    }).on('error', (err) => {
      reject(new Error('Network error: ' + err.message));
    });
  });
}

function getYtdlpVersion() {
  return new Promise((resolve) => {
    const ytdlp = getYtdlpPath();
    if (!ytdlp) {
      resolve('Not installed');
      return;
    }
    exec(`"${ytdlp}" --version`, { windowsHide: true }, (error, stdout) => {
      resolve(error ? 'Unknown' : stdout.trim());
    });
  });
}

function getStreamUrl(url) {
  return new Promise((resolve, reject) => {
    const ytdlp = getYtdlpPath();
    if (!ytdlp) return reject(new Error('yt-dlp not found'));
    
    const { execFile } = require('child_process');
    const ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
    execFile(ytdlp, ['-g', '-f', 'bestaudio', '--user-agent', ua, url], { windowsHide: true }, (error, stdout) => {
      if (error) return reject(error);
      const streamUrl = stdout.trim().split('\n')[0];
      if (!streamUrl) return reject(new Error('No stream URL returned'));
      resolve(streamUrl);
    });
  });
}

function searchYouTubeMusicPaginated(query, page = 1) {
  const cacheKey = `${query.toLowerCase().trim()}_page${page}`;
  const cached = searchCache.get(cacheKey);
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return Promise.resolve(cached.results);
  }

  return new Promise((resolve, reject) => {
    const ytdlp = getYtdlpPath();
    if (!ytdlp) {
      reject(new Error('yt-dlp not found. Place yt-dlp.exe in assets/binaries/'));
      return;
    }

    const offset = (page - 1) * 10;
    const args = [
      `ytsearch${offset + 10}:${query}`,
      '--no-playlist',
      '--flat-playlist',
      '--playlist-items', `${offset + 1}-${offset + 10}`,
      '--print', 'id,title,uploader,duration,view_count,upload_date',
      '--no-warnings',
      '--quiet'
    ];

    const proc = spawn(ytdlp, args, { windowsHide: true });
    let stdout = '';
    let stderr = '';
    let timedOut = false;

    const timeout = setTimeout(() => {
      timedOut = true;
      proc.kill();
      reject(new Error('Search timed out. Check your internet connection.'));
    }, 15000);

    proc.stdout.on('data', (d) => { stdout += d.toString(); });
    proc.stderr.on('data', (d) => { stderr += d.toString(); });

    proc.on('close', (code) => {
      clearTimeout(timeout);
      if (timedOut) return;

      if (code !== 0 && !stdout.trim()) {
        reject(new Error(stderr.trim() || 'yt-dlp search failed'));
        return;
      }

      const lines = stdout.trim().split('\n').map(l => l.trim()).filter(Boolean);
      const results = [];

      for (let i = 0; i + 5 < lines.length; i += 6) {
        const id          = lines[i];
        const title       = lines[i + 1] || 'Unknown';
        const uploader    = lines[i + 2] || 'Unknown Artist';
        const durationRaw = lines[i + 3];
        const viewsRaw    = lines[i + 4];
        const uploadDate  = lines[i + 5] || '';

        const duration = durationRaw && durationRaw !== 'NA' ? parseFloat(durationRaw) : 0;
        const views    = viewsRaw    && viewsRaw    !== 'NA' ? parseInt(viewsRaw)      : 0;

        if (!id || id === 'NA') continue;

        results.push({
          id,
          title,
          artist: uploader,
          duration,
          thumbnail: `https://i.ytimg.com/vi/${id}/mqdefault.jpg`,
          url: `https://www.youtube.com/watch?v=${id}`,
          views,
          uploadDate,
          album: ''
        });
      }

      searchCache.set(cacheKey, { results, ts: Date.now() });
      if (searchCache.size > 50) {
        const firstKey = searchCache.keys().next().value;
        searchCache.delete(firstKey);
      }

      resolve(results);
    });

    proc.on('error', (err) => {
      clearTimeout(timeout);
      reject(new Error(`Failed to run yt-dlp: ${err.message}`));
    });
  });
}

function getPlaylistInfo(url) {
  return new Promise((resolve, reject) => {
    const ytdlp = getYtdlpPath();
    if (!ytdlp) return reject(new Error('yt-dlp not found'));

    const args = [
      url,
      '--flat-playlist',
      '--no-playlist-at-end',
      '--print', 'id,title,uploader,duration',
      '--no-warnings',
      '--quiet'
    ];

    const proc = spawn(ytdlp, args, { windowsHide: true });
    let stdout = '';
    let timedOut = false;

    const timeout = setTimeout(() => {
      timedOut = true;
      proc.kill();
      reject(new Error('Playlist fetch timed out.'));
    }, 30000);

    proc.stdout.on('data', d => { stdout += d.toString(); });
    proc.on('close', code => {
      clearTimeout(timeout);
      if (timedOut) return;
      if (code !== 0 && !stdout.trim()) {
        reject(new Error('Failed to fetch playlist info'));
        return;
      }
      const lines = stdout.trim().split('\n').map(l => l.trim()).filter(Boolean);
      const items = [];
      for (let i = 0; i + 3 < lines.length; i += 4) {
        const id = lines[i];
        const title = lines[i + 1] || 'Unknown';
        const uploader = lines[i + 2] || 'Unknown Artist';
        const durationRaw = lines[i + 3];
        const duration = durationRaw && durationRaw !== 'NA' ? parseFloat(durationRaw) : 0;
        if (!id || id === 'NA') continue;
        items.push({
          id, title, artist: uploader, duration,
          thumbnail: `https://i.ytimg.com/vi/${id}/mqdefault.jpg`,
          url: `https://www.youtube.com/watch?v=${id}`
        });
      }
      resolve(items);
    });
    proc.on('error', err => { clearTimeout(timeout); reject(new Error(`yt-dlp error: ${err.message}`)); });
  });
}

module.exports = { searchYouTubeMusic, searchYouTubeMusicPaginated, downloadSong, cancelDownload, updateYtdlp, getYtdlpVersion, getYtdlpPath, getFfmpegPath, getFfmpegVersion, updateFfmpeg, getStreamUrl, getPlaylistInfo };
