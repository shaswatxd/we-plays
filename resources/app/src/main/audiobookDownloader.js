const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { app } = require('electron');

// key -> { request, filePath, cancelled, paused }
const activeDownloads = new Map();

function keyOf(bookId, chapterIndex) {
  return `${bookId}_${chapterIndex}`;
}

function getAudiobooksDir() {
  const dir = path.join(app.getPath('userData'), 'audiobooks');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function getChapterPath(bookId, chapterIndex) {
  const bookDir = path.join(getAudiobooksDir(), String(bookId));
  if (!fs.existsSync(bookDir)) fs.mkdirSync(bookDir, { recursive: true });
  return path.join(bookDir, `${chapterIndex}.mp3`);
}

function downloadChapter(options, onProgress, onComplete, onError) {
  const { bookId, chapterIndex, url, title, bookTitle } = options;
  const key = keyOf(bookId, chapterIndex);
  const filePath = getChapterPath(bookId, chapterIndex);

  let startByte = 0;
  if (fs.existsSync(filePath)) {
    try { startByte = fs.statSync(filePath).size; } catch { startByte = 0; }
  }

  const entry = { filePath, cancelled: false, paused: false, request: null };
  activeDownloads.set(key, entry);

  function get(targetUrl, redirects = 0) {
    if (redirects > 10) {
      onError({ bookId, chapterIndex, message: 'Too many redirects' });
      activeDownloads.delete(key);
      return;
    }
    const isHttps = targetUrl.startsWith('https');
    const lib = isHttps ? https : http;
    const headers = { 'User-Agent': 'WePlays-App/2.0 (Audiobooks)' };
    if (startByte > 0) headers.Range = `bytes=${startByte}-`;

    const req = lib.get(targetUrl, { headers }, (res) => {
      if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
        res.resume();
        get(res.headers.location, redirects + 1);
        return;
      }
      if (res.statusCode !== 200 && res.statusCode !== 206) {
        res.resume();
        activeDownloads.delete(key);
        onError({ bookId, chapterIndex, message: `Download failed with status ${res.statusCode}` });
        return;
      }

      const contentLength = parseInt(res.headers['content-length'], 10) || 0;
      const totalBytes = res.statusCode === 206 ? startByte + contentLength : contentLength;
      let downloadedBytes = startByte;

      const fileStream = fs.createWriteStream(filePath, { flags: res.statusCode === 206 ? 'a' : 'w' });

      res.on('data', (chunk) => {
        downloadedBytes += chunk.length;
        onProgress({
          bookId, chapterIndex,
          downloadedBytes, totalBytes,
          progress: totalBytes > 0 ? Math.min(100, (downloadedBytes / totalBytes) * 100) : 0
        });
      });

      res.pipe(fileStream);

      fileStream.on('finish', () => {
        fileStream.close(() => {
          const stillActive = activeDownloads.get(key);
          activeDownloads.delete(key);
          if (stillActive?.cancelled) return;
          onComplete({ bookId, chapterIndex, filePath, title, bookTitle, totalBytes: totalBytes || downloadedBytes });
        });
      });

      fileStream.on('error', (err) => {
        activeDownloads.delete(key);
        onError({ bookId, chapterIndex, message: err.message });
      });

      entry.response = res;
    });

    entry.request = req;

    req.on('error', (err) => {
      const stillActive = activeDownloads.get(key);
      if (stillActive?.paused || stillActive?.cancelled) return;
      activeDownloads.delete(key);
      onError({ bookId, chapterIndex, message: err.message });
    });
  }

  get(url);
  return { key, filePath };
}

function pauseDownload(bookId, chapterIndex) {
  const key = keyOf(bookId, chapterIndex);
  const entry = activeDownloads.get(key);
  if (!entry) return false;
  entry.paused = true;
  try { entry.request?.destroy(); } catch {}
  activeDownloads.delete(key);
  return true;
}

function cancelDownload(bookId, chapterIndex) {
  const key = keyOf(bookId, chapterIndex);
  const entry = activeDownloads.get(key);
  if (entry) {
    entry.cancelled = true;
    try { entry.request?.destroy(); } catch {}
    activeDownloads.delete(key);
  }
  const filePath = getChapterPath(bookId, chapterIndex);
  try { if (fs.existsSync(filePath)) fs.unlinkSync(filePath); } catch {}
  return true;
}

function deleteDownload(bookId, chapterIndex) {
  cancelDownload(bookId, chapterIndex);
  const bookDir = path.join(getAudiobooksDir(), String(bookId));
  try {
    if (fs.existsSync(bookDir) && fs.readdirSync(bookDir).length === 0) {
      fs.rmdirSync(bookDir);
    }
  } catch {}
  return true;
}

function isDownloaded(bookId, chapterIndex) {
  const filePath = getChapterPath(bookId, chapterIndex);
  return fs.existsSync(filePath);
}

module.exports = {
  downloadChapter, pauseDownload, cancelDownload, deleteDownload,
  getChapterPath, isDownloaded, getAudiobooksDir
};
