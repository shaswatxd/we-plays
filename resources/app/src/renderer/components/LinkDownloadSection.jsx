import React, { useState, useEffect, useMemo } from 'react';
import { useLibraryStore } from '../store/libraryStore';
import { useDownloadStore } from '../store/downloadStore';
import { Link2, Folder, Download, Loader2, Music, CheckCircle, AlertCircle, X, ListMusic } from 'lucide-react';

function fmtDur(s) {
  if (!s) return '';
  return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
}

// Memoized so progress ticks only re-render rows whose status/progress changed.
const ItemRow = React.memo(function ItemRow({ title, artist, duration, status, progress }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:8, padding:'6px 12px', fontSize:12, borderRadius:6 }}>
      {status === 'downloading' && <Loader2 size={13} color="#1db954" style={{ animation:'spin 0.8s linear infinite', flexShrink:0 }}/>}
      {status === 'completed'   && <CheckCircle size={13} color="#1db954" style={{ flexShrink:0 }}/>}
      {status === 'error'       && <AlertCircle size={13} color="#f15e6c" style={{ flexShrink:0 }}/>}
      {status === 'cancelled'   && <X size={13} color="#f59e0b" style={{ flexShrink:0 }}/>}
      {(!status || status === 'queued') && <Music size={13} color="#6a6a6a" style={{ flexShrink:0 }}/>}
      <span style={{ flex:1, minWidth:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', color: status === 'completed' ? '#1db954' : '#b3b3b3' }}>
        {title}{artist ? ` — ${artist}` : ''}
      </span>
      {status === 'downloading' && (
        <span style={{ color:'#1db954', fontWeight:700, flexShrink:0, fontFamily:'monospace', fontSize:11 }}>{progress}%</span>
      )}
      {status === 'queued' && <span style={{ color:'#6a6a6a', flexShrink:0, fontSize:10, fontWeight:600 }}>QUEUED</span>}
      {status === 'error'  && <span style={{ color:'#f15e6c', flexShrink:0, fontSize:10, fontWeight:600 }}>FAILED</span>}
      {!status && duration > 0 && (
        <span style={{ color:'#6a6a6a', flexShrink:0, fontSize:11, fontFamily:'monospace' }}>{fmtDur(duration)}</span>
      )}
    </div>
  );
});

export default function LinkDownloadSection() {
  const { settings, playlists, loadPlaylists } = useLibraryStore();
  const startDownload = useDownloadStore(s => s.startDownload);
  const downloads = useDownloadStore(s => s.downloads);

  const [url, setUrl] = useState('');
  const [fetching, setFetching] = useState(false);
  const [items, setItems] = useState([]);
  const [format, setFormat] = useState('mp3');
  const [quality, setQuality] = useState(320);
  const [folder, setFolder] = useState('');
  const [addToPl, setAddToPl] = useState('');
  const [batchIds, setBatchIds] = useState(null); // Set of download ids once batch started

  useEffect(() => { loadPlaylists(); }, []);

  useEffect(() => {
    if (settings.downloadFolder && !folder) setFolder(settings.downloadFolder);
    if (settings.defaultFormat) setFormat(settings.defaultFormat);
    if (settings.defaultQuality) setQuality(Number(settings.defaultQuality));
  }, [settings]);

  const browse = async () => {
    const f = await window.electronAPI?.selectFolder();
    if (f) setFolder(f);
  };

  const fetchInfo = async () => {
    const u = url.trim();
    if (!/^https?:\/\/(www\.|music\.|m\.)?(youtube\.com|youtu\.be)\//.test(u)) {
      window.showToast?.('Enter a valid YouTube song or playlist link', 'error');
      return;
    }
    setFetching(true);
    setItems([]);
    setBatchIds(null);
    try {
      const res = await window.electronAPI?.getPlaylistInfo(u);
      if (!res || res.length === 0) {
        window.showToast?.('No songs found at this link', 'error');
        return;
      }
      // Playlists can repeat the same video; download ids are keyed by video id.
      const seen = new Set();
      const unique = res.filter(it => seen.has(it.id) ? false : (seen.add(it.id), true));
      setItems(unique);
      window.showToast?.(`Found ${unique.length} song${unique.length > 1 ? 's' : ''}`, 'success');
    } catch (e) {
      window.showToast?.(`Failed to fetch link: ${e.message}`, 'error');
    } finally {
      setFetching(false);
    }
  };

  const startBatch = () => {
    if (!folder) { window.showToast?.('Please select a download folder', 'error'); return; }
    if (items.length === 0) return;
    const ids = new Set();
    const config = {
      format, quality, outputPath: folder, embedThumbnail: true, addMetadata: true,
      addToPlaylistId: addToPl ? Number(addToPl) : null
    };
    items.forEach(it => {
      const id = it.id || `link_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      ids.add(id);
      // Store caps concurrency at 3; the rest wait in queue. Errors are
      // reflected in the store, so a rejected promise here is already handled.
      startDownload(it, config, id).catch(() => {});
    });
    setBatchIds(ids);
    window.showToast?.(`Downloading ${items.length} song${items.length > 1 ? 's' : ''}…`, 'success');
  };

  const reset = () => { setUrl(''); setItems([]); setBatchIds(null); };

  // Merge live download state into the fetched item list.
  const batch = useMemo(() => {
    if (!batchIds) return null;
    const map = {};
    let completed = 0, failed = 0, progressSum = 0;
    for (const d of downloads) {
      if (!batchIds.has(d.id)) continue;
      map[d.id] = d;
      if (d.status === 'completed') { completed++; progressSum += 100; }
      else if (d.status === 'error' || d.status === 'cancelled') failed++;
      else progressSum += d.progress || 0;
    }
    const total = batchIds.size;
    return {
      map, completed, failed, total,
      percent: total ? Math.round(progressSum / total) : 0,
      done: completed + failed >= total
    };
  }, [downloads, batchIds]);

  return (
    <div className="sp-settings-section">
      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
        <Link2 size={14} color="#1db954"/>
        <p className="sp-settings-title" style={{ margin:0 }}>Download from Link</p>
      </div>
      <p style={{ fontSize:11, color:'#b3b3b3', margin:'2px 0 0' }}>
        Paste a YouTube song or playlist link to download it directly.
      </p>

      {/* URL input */}
      <div style={{ display:'flex', gap:8 }}>
        <input
          type="text"
          className="sp-input"
          style={{ flex:1 }}
          value={url}
          onChange={e => setUrl(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !fetching) fetchInfo(); }}
          placeholder="https://www.youtube.com/watch?v=… or playlist link"
          disabled={fetching}
        />
        <button
          onClick={fetchInfo}
          disabled={fetching || !url.trim()}
          className="btn-green"
          style={{ display:'flex', alignItems:'center', gap:6, padding:'0 18px', fontSize:13, flexShrink:0 }}
        >
          {fetching
            ? <><Loader2 size={14} style={{ animation:'spin 0.8s linear infinite' }}/> Fetching…</>
            : <><ListMusic size={14}/> Fetch</>
          }
        </button>
      </div>

      {items.length > 0 && (
        <div className="sp-reveal" style={{ display:'flex', flexDirection:'column', gap:14 }}>
          {/* Count summary */}
          <div style={{
            display:'flex', alignItems:'center', gap:10,
            background:'rgba(29,185,84,0.08)', border:'1px solid rgba(29,185,84,0.2)',
            borderRadius:8, padding:'10px 14px'
          }}>
            <ListMusic size={16} color="#1db954" style={{ flexShrink:0 }}/>
            <span style={{ fontSize:13, fontWeight:700, color:'#fff' }}>
              {items.length} song{items.length > 1 ? 's' : ''} will be downloaded
            </span>
          </div>

          {/* Quality + folder — locked once batch starts */}
          {!batchIds && (
            <>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
                <div>
                  <label className="sp-label">Format</label>
                  <select className="sp-select" style={{ width:'100%' }} value={format}
                    onChange={e => { setFormat(e.target.value); if (e.target.value === 'flac') setQuality(0); else if (!quality) setQuality(320); }}>
                    <option value="mp3">MP3</option>
                    <option value="flac">FLAC (Lossless)</option>
                    <option value="aac">AAC</option>
                    <option value="ogg">OGG Vorbis</option>
                  </select>
                </div>
                <div>
                  <label className="sp-label">Bitrate</label>
                  <select className="sp-select" style={{ width:'100%', opacity: format === 'flac' ? 0.5 : 1 }}
                    value={quality} disabled={format === 'flac'}
                    onChange={e => setQuality(Number(e.target.value))}>
                    <option value={320}>320 kbps — Best</option>
                    <option value={256}>256 kbps — Great</option>
                    <option value={192}>192 kbps — Good</option>
                    <option value={128}>128 kbps — Small</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="sp-label">Save to</label>
                <div style={{ display:'flex', gap:8 }}>
                  <input
                    type="text"
                    className="sp-input"
                    style={{ flex:1 }}
                    value={folder}
                    onChange={e => setFolder(e.target.value)}
                    placeholder="Select a folder…"
                  />
                  <button
                    onClick={browse}
                    style={{ display:'flex', alignItems:'center', gap:6, background:'none', border:'1px solid rgba(255,255,255,0.2)', color:'#b3b3b3', padding:'0 16px', borderRadius:8, cursor:'pointer', fontWeight:700, fontSize:13, flexShrink:0, whiteSpace:'nowrap' }}
                  ><Folder size={14}/> Browse</button>
                </div>
              </div>

              {playlists && playlists.length > 0 && (
                <div>
                  <label className="sp-label">Add to Playlist (Optional)</label>
                  <select
                    className="sp-select"
                    style={{ width:'100%' }}
                    value={addToPl}
                    onChange={e => setAddToPl(e.target.value)}
                  >
                    <option value="">-- None --</option>
                    {playlists.map(pl => (
                      <option key={pl.id} value={pl.id}>{pl.name}</option>
                    ))}
                  </select>
                </div>
              )}
            </>
          )}

          {/* Overall progress once started */}
          {batch && (
            <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
              <div style={{ display:'flex', justifyContent:'space-between', fontSize:12 }}>
                <span style={{ color: batch.done ? '#1db954' : '#b3b3b3', fontWeight:700 }}>
                  {batch.done
                    ? `Done — ${batch.completed} downloaded${batch.failed ? `, ${batch.failed} failed` : ''}`
                    : `Downloading… ${batch.completed} / ${batch.total} done${batch.failed ? ` (${batch.failed} failed)` : ''}`
                  }
                </span>
                <span style={{ color:'#1db954', fontWeight:700, fontFamily:'monospace' }}>{batch.percent}%</span>
              </div>
              <div style={{ width:'100%', height:6, background:'rgba(255,255,255,0.1)', borderRadius:3, overflow:'hidden' }}>
                <div style={{ width:`${batch.percent}%`, height:'100%', background:'#1db954', transition:'width 0.25s ease' }}/>
              </div>
            </div>
          )}

          {/* Song list with live per-song status */}
          <div style={{
            maxHeight:220, overflowY:'auto',
            background:'rgba(255,255,255,0.02)', border:'1px solid rgba(255,255,255,0.06)',
            borderRadius:8, padding:'4px 0'
          }}>
            {items.map(it => {
              const d = batch?.map[it.id];
              return (
                <ItemRow
                  key={it.id}
                  title={it.title}
                  artist={it.artist}
                  duration={it.duration}
                  status={d?.status || (batchIds ? 'queued' : null)}
                  progress={Math.round(d?.progress || 0)}
                />
              );
            })}
          </div>

          {/* Actions */}
          <div style={{ display:'flex', gap:10, justifyContent:'flex-end' }}>
            {!batchIds ? (
              <button
                className="btn-green"
                onClick={startBatch}
                style={{ display:'flex', alignItems:'center', gap:8, padding:'10px 24px', fontSize:13, fontWeight:800 }}
              >
                <Download size={15}/> Download {items.length > 1 ? `All (${items.length})` : ''}
              </button>
            ) : batch?.done && (
              <button
                onClick={reset}
                style={{ background:'none', border:'1px solid rgba(255,255,255,0.2)', color:'#b3b3b3', padding:'10px 20px', borderRadius:99, cursor:'pointer', fontWeight:700, fontSize:13 }}
              >Download Another Link</button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
