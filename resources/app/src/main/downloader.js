const { execSync, exec, spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const https = require('https');

// In-memory search cache (key = query, value = { results, ts })
const searchCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

function getYtdlpPath() {
  const bundled = path.join(__dirname, '../../assets/binaries/yt-dlp.exe');
  if (fs.existsSync(bundled)) return bundled;
  const asarUnpacked = path.join(__dirname, '../../../app.asar.unpacked/assets/binaries/yt-dlp.exe');
  if (fs.existsSync(asarUnpacked)) return asarUnpacked;
  const extraResource = path.join(process.resourcesPath || '', 'binaries/yt-dlp.exe');
  if (fs.existsSync(extraResource)) return extraResource;
  const bundledUnix = path.join(__dirname, '../../assets/binaries/yt-dlp');
  if (fs.existsSync(bundledUnix)) return bundledUnix;
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
    const ytdlp = getYtdlpPath();
    if (!ytdlp) {
      reject(new Error('yt-dlp not found'));
      return;
    }
    exec(`"${ytdlp}" -U`, { windowsHide: true }, (error, stdout) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(stdout.includes('up-to-date') ? 'yt-dlp is up to date' : 'yt-dlp updated successfully');
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

function getFpcalcPath() {
  const locations = [
    path.join(__dirname, '../../assets/binaries/fpcalc.exe'),
    path.join(__dirname, '../../assets/binaries/fpcalc'),
  ];
  for (const loc of locations) {
    if (fs.existsSync(loc)) return loc;
  }
  try {
    execSync('fpcalc -version', { stdio: 'ignore', windowsHide: true });
    return 'fpcalc';
  } catch { return null; }
}

function getAudioFingerprint(filePath) {
  return new Promise((resolve, reject) => {
    const fpcalc = getFpcalcPath();
    if (!fpcalc) {
      reject(new Error('fpcalc not found. Download Chromaprint from acoustid.org/chromaprint and place fpcalc.exe in assets/binaries/'));
      return;
    }
    const { execFile } = require('child_process');
    execFile(fpcalc, ['-json', filePath], { windowsHide: true, maxBuffer: 10 * 1024 * 1024 }, (err, stdout) => {
      if (err) return reject(new Error(`fpcalc error: ${err.message}`));
      try {
        const data = JSON.parse(stdout);
        resolve({ fingerprint: data.fingerprint, duration: data.duration });
      } catch(e) {
        reject(new Error('Failed to parse fpcalc output'));
      }
    });
  });
}

module.exports = { searchYouTubeMusic, searchYouTubeMusicPaginated, downloadSong, cancelDownload, updateYtdlp, getYtdlpVersion, getYtdlpPath, getFfmpegPath, getStreamUrl, getPlaylistInfo, getAudioFingerprint };
