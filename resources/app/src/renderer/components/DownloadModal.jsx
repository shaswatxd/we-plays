import React, { useState, useEffect } from 'react';
import { useLibraryStore } from '../store/libraryStore';
import { useDownloadStore } from '../store/downloadStore';
import { X, Folder, Download, Loader2 } from 'lucide-react';

export default function DownloadModal({ song, onClose }) {
  const { settings, loadSettings, playlists, loadPlaylists } = useLibraryStore();
  const { startDownload }          = useDownloadStore();
  const [format,   setFormat]   = useState('mp3');
  const [quality,  setQuality]  = useState(320);
  const [folder,   setFolder]   = useState('');
  const [embedThumb, setEmbed]  = useState(true);
  const [addMeta,  setAddMeta]  = useState(true);
  const [addToPl,  setAddToPl]  = useState('');
  const [loading,  setLoading]  = useState(false);

  useEffect(() => { loadSettings(); loadPlaylists(); }, []);
  useEffect(() => {
    if (settings.downloadFolder) setFolder(settings.downloadFolder);
    if (settings.defaultFormat)  setFormat(settings.defaultFormat);
    if (settings.defaultQuality) setQuality(Number(settings.defaultQuality));
  }, [settings]);

  const browse = async () => {
    const f = await window.electronAPI?.selectFolder();
    if (f) setFolder(f);
  };

  const start = async () => {
    if (!folder) { window.showToast?.('Please select a download folder', 'error'); return; }
    setLoading(true);
    try {
      await startDownload(song, { 
        format, quality, outputPath: folder, embedThumbnail: embedThumb, addMetadata: addMeta,
        addToPlaylistId: addToPl ? Number(addToPl) : null
      });
      window.showToast?.('Download started!', 'success');
      onClose();
    } catch (e) {
      window.showToast?.(`Failed: ${e.message}`, 'error');
    } finally { setLoading(false); }
  };

  const fmt = (s) => {
    if (!s) return '0:00';
    return `${Math.floor(s/60)}:${String(Math.floor(s%60)).padStart(2,'0')}`;
  };

  return (
    <div className="sp-modal-bg" onClick={onClose}>
      <div className="sp-modal" onClick={e => e.stopPropagation()}>
        <div className="sp-modal-header">
          <span className="sp-modal-title">Download Song</span>
          <button className="sp-modal-close" onClick={onClose}><X size={18}/></button>
        </div>

        {/* Song info */}
        <div style={{ display:'flex', alignItems:'center', gap:12, padding:'0 0 20px', borderBottom:'1px solid rgba(255,255,255,0.08)', marginBottom:20 }}>
          {song.thumbnail && (
            <img src={song.thumbnail} alt="" style={{ width:48,height:48,borderRadius:4,objectFit:'cover',flexShrink:0 }} />
          )}
          <div style={{ minWidth:0 }}>
            <p style={{ fontSize:14,fontWeight:700,color:'#fff',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>{song.title}</p>
            <p style={{ fontSize:12,color:'#b3b3b3',marginTop:2 }}>{song.artist} • {fmt(song.duration)}</p>
          </div>
        </div>

        <div style={{ display:'flex', flexDirection:'column', gap:18 }}>
          {/* Format */}
          <div>
            <label className="sp-label">Audio Format</label>
            <div style={{ display:'flex', gap:8 }}>
              {['mp3','flac','aac','ogg'].map(f => (
                <button
                  key={f}
                  className={`sp-chip${format===f?' active':''}`}
                  onClick={() => { setFormat(f); if (f==='flac') setQuality(0); else if (!quality) setQuality(320); }}
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
              <div style={{ display:'flex', gap:8 }}>
                {[320,256,192,128].map(q => (
                  <button key={q} className={`sp-chip${quality===q?' active':''}`} onClick={() => setQuality(q)}>
                    {q}k
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Folder */}
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
                style={{ display:'flex',alignItems:'center',gap:6,background:'none',border:'1px solid rgba(255,255,255,0.2)',color:'#b3b3b3',padding:'0 14px',borderRadius:8,cursor:'pointer',fontWeight:700,fontSize:13,flexShrink:0,whiteSpace:'nowrap' }}
              ><Folder size={14}/></button>
            </div>
          </div>

          {/* Options */}
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
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

        <div className="sp-modal-footer">
          <button
            style={{ background:'none',border:'1px solid rgba(255,255,255,0.2)',color:'#b3b3b3',padding:'10px 20px',borderRadius:99,cursor:'pointer',fontWeight:700,fontSize:13 }}
            onClick={onClose}
          >Cancel</button>
          <button className="btn-green" onClick={start} disabled={loading} style={{ padding:'12px 32px',fontSize:14,fontWeight:800,borderRadius:99,background:'linear-gradient(135deg,#1db954,#1ed760)',display:'flex',alignItems:'center',gap:8,boxShadow:'0 4px 16px rgba(29,185,84,0.45)',transition:'transform 0.15s, box-shadow 0.15s' }}
            onMouseEnter={e => { if(!loading){ e.currentTarget.style.transform='scale(1.05)'; e.currentTarget.style.boxShadow='0 6px 22px rgba(29,185,84,0.6)'; }}}
            onMouseLeave={e => { e.currentTarget.style.transform='scale(1)'; e.currentTarget.style.boxShadow='0 4px 16px rgba(29,185,84,0.45)'; }}
          >
            {loading
              ? <><Loader2 size={16} style={{ animation:'spin 0.8s linear infinite' }}/> Starting…</>
              : <><Download size={18} strokeWidth={2.5}/> Download</>
            }
          </button>
        </div>
      </div>
    </div>
  );
}
