import React, { useState, useEffect } from 'react';
import { useLibraryStore } from '../store/libraryStore';
import { useDownloadStore } from '../store/downloadStore';
import { X, Folder, Download, Loader2, CheckCircle, AlertCircle, Music } from 'lucide-react';

export default function DownloadModal({ song, onClose }) {
  const { settings, loadSettings, playlists, loadPlaylists } = useLibraryStore();
  const { startDownload, downloads } = useDownloadStore();
  const [format, setFormat] = useState('mp3');
  const [quality, setQuality] = useState(320);
  const [folder, setFolder] = useState('');
  const [embedThumb, setEmbed] = useState(true);
  const [addMeta, setAddMeta] = useState(true);
  const [addToPl, setAddToPl] = useState('');
  const [loading, setLoading] = useState(false);
  const [downloadId, setDownloadId] = useState(null);
  const [status, setStatus] = useState('idle');

  useEffect(() => { loadSettings(); loadPlaylists(); }, []);
  useEffect(() => {
    if (settings.downloadFolder) setFolder(settings.downloadFolder);
    if (settings.defaultFormat) setFormat(settings.defaultFormat);
    if (settings.defaultQuality) setQuality(Number(settings.defaultQuality));
  }, [settings]);

  const downloadData = downloads.find(d => d.id === downloadId);

  useEffect(() => {
    if (downloadData) {
      setStatus(downloadData.status);
    }
  }, [downloadData]);

  const browse = async () => {
    const f = await window.electronAPI?.selectFolder();
    if (f) setFolder(f);
  };

  const start = async () => {
    if (!folder) { window.showToast?.('Please select a download folder', 'error'); return; }
    const songId = song.id || `dl_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    setDownloadId(songId);
    setStatus('downloading');
    setLoading(true);
    try {
      await startDownload(song, {
        format, quality, outputPath: folder, embedThumbnail: embedThumb, addMetadata: addMeta,
        addToPlaylistId: addToPl ? Number(addToPl) : null
      }, songId);
    } catch (e) {
      window.showToast?.(`Failed: ${e.message}`, 'error');
      setStatus('error');
    } finally { setLoading(false); }
  };

  const fmt = (s) => {
    if (!s) return '0:00';
    return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
  };

  const fmtSpeed = (speed) => {
    if (!speed) return '';
    return speed;
  };

  const fmtEta = (eta) => {
    if (!eta) return '';
    return eta;
  };

  const progress = downloadData?.progress || 0;
  const speed = downloadData?.speed;
  const eta = downloadData?.eta;

  const renderContent = () => {
    if (status === 'downloading' || status === 'queued') {
      return (
        <div style={{ padding: '20px 0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
            {song.thumbnail && (
              <img src={song.thumbnail} alt="" style={{ width: 48, height: 48, borderRadius: 4, objectFit: 'cover', flexShrink: 0 }} />
            )}
            <div style={{ minWidth: 0, flex: 1 }}>
              <p style={{ fontSize: 14, fontWeight: 700, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{song.title}</p>
              <p style={{ fontSize: 12, color: '#b3b3b3', marginTop: 2 }}>{song.artist} • {fmt(song.duration)}</p>
            </div>
            {status === 'queued' && (
              <span style={{ fontSize: 11, color: '#f59e0b', fontWeight: 600, background: 'rgba(245,158,11,0.15)', padding: '4px 10px', borderRadius: 20 }}>Queued</span>
            )}
          </div>

          {/* Progress Bar */}
          <div style={{ marginBottom: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#1db954' }}>{Math.round(progress)}%</span>
              <div style={{ display: 'flex', gap: 12, fontSize: 11, color: '#b3b3b3' }}>
                {speed && <span>{fmtSpeed(speed)}</span>}
                {eta && eta > 0 && <span>ETA: {fmtEta(eta)}</span>}
              </div>
            </div>
            <div style={{ width: '100%', height: 6, background: 'rgba(255,255,255,0.1)', borderRadius: 3, overflow: 'hidden' }}>
              <div
                style={{
                  width: `${progress}%`,
                  height: '100%',
                  background: 'linear-gradient(90deg, #1db954, #1ed760)',
                  borderRadius: 3,
                  transition: 'width 0.3s ease'
                }}
              />
            </div>
          </div>

          <p style={{ fontSize: 11, color: '#6a6a6a', textAlign: 'center' }}>
            {status === 'queued' ? 'Waiting to start...' : 'Downloading... Don\'t close this window'}
          </p>
        </div>
      );
    }

    if (status === 'completed') {
      return (
        <div style={{ padding: '30px 0', textAlign: 'center' }}>
          <div style={{ width: 60, height: 60, borderRadius: '50%', background: 'rgba(29,185,84,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <CheckCircle size={32} color="#1db954" />
          </div>
          <p style={{ fontSize: 18, fontWeight: 800, color: '#fff', marginBottom: 8 }}>Download Complete!</p>
          <p style={{ fontSize: 13, color: '#b3b3b3' }}>{song.title}</p>
        </div>
      );
    }

    if (status === 'error') {
      return (
        <div style={{ padding: '30px 0', textAlign: 'center' }}>
          <div style={{ width: 60, height: 60, borderRadius: '50%', background: 'rgba(241,94,108,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <AlertCircle size={32} color="#f15e6c" />
          </div>
          <p style={{ fontSize: 18, fontWeight: 800, color: '#fff', marginBottom: 8 }}>Download Failed</p>
          <p style={{ fontSize: 13, color: '#b3b3b3' }}>{downloadData?.error || 'An error occurred'}</p>
        </div>
      );
    }

    return (
      <>
        {/* Song info */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '0 0 20px', borderBottom: '1px solid rgba(255,255,255,0.08)', marginBottom: 20 }}>
          {song.thumbnail && (
            <img src={song.thumbnail} alt="" style={{ width: 48, height: 48, borderRadius: 4, objectFit: 'cover', flexShrink: 0 }} />
          )}
          <div style={{ minWidth: 0 }}>
            <p style={{ fontSize: 14, fontWeight: 700, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{song.title}</p>
            <p style={{ fontSize: 12, color: '#b3b3b3', marginTop: 2 }}>{song.artist} • {fmt(song.duration)}</p>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          {/* Format */}
          <div>
            <label className="sp-label">Audio Format</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {['mp3', 'flac', 'aac', 'ogg'].map(f => (
                <button
                  key={f}
                  className={`sp-chip${format === f ? ' active' : ''}`}
                  onClick={() => { setFormat(f); if (f === 'flac') setQuality(0); else if (!quality) setQuality(320); }}
                >
                  {f.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          {/* Quality */}
          {format !== 'flac' && (
            <div>
              <label className="sp-label">Bitrate</label>
              <div style={{ display: 'flex', gap: 8 }}>
                {[320, 256, 192, 128].map(q => (
                  <button key={q} className={`sp-chip${quality === q ? ' active' : ''}`} onClick={() => setQuality(q)}>
                    {q}k
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Folder */}
          <div>
            <label className="sp-label">Save to</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                type="text"
                className="sp-input"
                style={{ flex: 1 }}
                value={folder}
                onChange={e => setFolder(e.target.value)}
                placeholder="Select a folder…"
              />
              <button
                onClick={browse}
                style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: '1px solid rgba(255,255,255,0.2)', color: '#b3b3b3', padding: '0 14px', borderRadius: 8, cursor: 'pointer', fontWeight: 700, fontSize: 13, flexShrink: 0, whiteSpace: 'nowrap' }}
              ><Folder size={14} /></button>
            </div>
          </div>

          {/* Options */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <label className="sp-toggle">
              <input type="checkbox" checked={embedThumb} onChange={e => setEmbed(e.target.checked)} />
              <span>Embed album artwork</span>
            </label>
            <label className="sp-toggle">
              <input type="checkbox" checked={addMeta} onChange={e => setAddMeta(e.target.checked)} />
              <span>Add ID3 metadata tags</span>
            </label>
          </div>

          {/* Add to Playlist */}
          {playlists && playlists.length > 0 && (
            <div>
              <label className="sp-label">Add to Playlist (Optional)</label>
              <select
                className="sp-select"
                style={{ width: '100%' }}
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
        </div>
      </>
    );
  };

  return (
    <div className="sp-modal-bg" onClick={status === 'downloading' || status === 'queued' ? undefined : onClose}>
      <div className="sp-modal" onClick={e => e.stopPropagation()}>
        <div className="sp-modal-header">
          <span className="sp-modal-title">
            {status === 'completed' ? 'Download Complete' : status === 'error' ? 'Download Failed' : status === 'downloading' || status === 'queued' ? 'Downloading...' : 'Download Song'}
          </span>
          {(status !== 'downloading' && status !== 'queued') && (
            <button className="sp-modal-close" onClick={onClose}><X size={18} /></button>
          )}
        </div>

        {renderContent()}

        <div className="sp-modal-footer">
          {(status === 'idle' || status === 'error') && (
            <>
              <button
                style={{ background: 'none', border: '1px solid rgba(255,255,255,0.2)', color: '#b3b3b3', padding: '10px 20px', borderRadius: 99, cursor: 'pointer', fontWeight: 700, fontSize: 13 }}
                onClick={onClose}
              >Cancel</button>
              <button className="btn-green" onClick={start} disabled={loading} style={{ padding: '12px 32px', fontSize: 14, fontWeight: 800, borderRadius: 99, background: 'linear-gradient(135deg,#1db954,#1ed760)', display: 'flex', alignItems: 'center', gap: 8, boxShadow: '0 4px 16px rgba(29,185,84,0.45)', transition: 'transform 0.15s, box-shadow 0.15s' }}
                onMouseEnter={e => { if (!loading) { e.currentTarget.style.transform = 'scale(1.05)'; e.currentTarget.style.boxShadow = '0 6px 22px rgba(29,185,84,0.6)'; } }}
                onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = '0 4px 16px rgba(29,185,84,0.45)'; }}
              >
                {loading
                  ? <><Loader2 size={16} style={{ animation: 'spin 0.8s linear infinite' }} /> Starting…</>
                  : <><Download size={18} strokeWidth={2.5} /> Download</>
                }
              </button>
            </>
          )}
          {status === 'completed' && (
            <button className="btn-green" onClick={onClose} style={{ padding: '12px 32px', fontSize: 14, fontWeight: 800, borderRadius: 99, background: 'linear-gradient(135deg,#1db954,#1ed760)' }}>
              Done
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
