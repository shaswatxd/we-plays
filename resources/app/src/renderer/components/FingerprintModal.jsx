import React, { useState } from 'react';
import { Fingerprint, Search, XCircle, Loader2, AlertCircle, Tag } from 'lucide-react';

const ACOUSTID_CLIENT = '8XaBELgH'; // public demo key

export default function FingerprintModal({ song, onClose, onApplyTags }) {
  const [step, setStep]         = useState('idle'); // idle | loading | results | error
  const [results, setResults]   = useState([]);
  const [error, setError]       = useState('');
  const [applying, setApplying] = useState(null);

  const identify = async () => {
    if (!song?.file_path) {
      setError('This song has no local file to fingerprint.'); setStep('error'); return;
    }
    setStep('loading'); setError('');
    try {
      const fp = await window.electronAPI?.fingerprintSong(song.file_path);
      if (!fp) throw new Error('Could not compute fingerprint');

      const params = new URLSearchParams({
        client: ACOUSTID_CLIENT,
        duration: Math.round(fp.duration),
        fingerprint: fp.fingerprint,
        meta: 'recordings+releasegroups+compress',
        format: 'json'
      });

      const res = await fetch(`https://api.acoustid.org/v2/lookup?${params}`);
      const data = await res.json();

      if (data.status !== 'ok') throw new Error(data.error?.message || 'AcoustID lookup failed');

      const candidates = [];
      for (const result of (data.results || [])) {
        for (const rec of (result.recordings || [])) {
          if (!rec.title) continue;
          candidates.push({
            title: rec.title,
            artist: rec.artists?.[0]?.name || '',
            album: rec.releasegroups?.[0]?.title || '',
            score: Math.round((result.score || 0) * 100),
            mbid: rec.id
          });
        }
      }

      candidates.sort((a, b) => b.score - a.score);
      setResults(candidates.slice(0, 6));
      setStep('results');
    } catch(e) {
      setError(e.message);
      setStep('error');
    }
  };

  const applyTags = async (candidate) => {
    setApplying(candidate.mbid);
    try {
      await onApplyTags?.({
        title: candidate.title,
        artist: candidate.artist,
        album: candidate.album,
      });
      window.showToast?.('Tags updated!', 'success');
      onClose();
    } catch(e) {
      window.showToast?.(`Failed: ${e.message}`, 'error');
    } finally { setApplying(null); }
  };

  return (
    <div className="sp-modal-bg" onClick={onClose}>
      <div className="sp-modal" style={{ maxWidth:520 }} onClick={e => e.stopPropagation()}>
        <div className="sp-modal-header">
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <Fingerprint size={20} color="#1db954"/>
            <span className="sp-modal-title">Identify Song</span>
          </div>
          <button className="sp-modal-close" onClick={onClose}><XCircle size={18}/></button>
        </div>

        {/* Song info */}
        <div style={{ display:'flex', alignItems:'center', gap:12, padding:'0 0 20px', borderBottom:'1px solid rgba(255,255,255,0.08)', marginBottom:20 }}>
          {song?.thumbnail && <img src={song.thumbnail} alt="" style={{ width:48,height:48,borderRadius:6,objectFit:'cover' }}/>}
          <div>
            <p style={{ fontSize:14, fontWeight:700 }}>{song?.title || 'Unknown Song'}</p>
            <p style={{ fontSize:12, color:'#b3b3b3', marginTop:2 }}>{song?.artist || 'Unknown Artist'}</p>
          </div>
        </div>

        {step === 'idle' && (
          <div style={{ textAlign:'center', padding:'16px 0 8px' }}>
            <Fingerprint size={40} style={{ color:'#1db954', opacity:0.7, marginBottom:12 }}/>
            <p style={{ color:'#b3b3b3', marginBottom:8, fontSize:13 }}>
              Analyze this song's audio fingerprint and look up its metadata via AcoustID + MusicBrainz.
            </p>
            <p style={{ color:'#6a6a6a', fontSize:11, marginBottom:20 }}>
              Requires the song to be a local file. Analysis may take a few seconds.
            </p>
            <button
              className="btn-green"
              onClick={identify}
              style={{ padding:'12px 32px', fontSize:14, fontWeight:800, borderRadius:99, background:'linear-gradient(135deg,#1db954,#1ed760)', display:'inline-flex', alignItems:'center', gap:8 }}
            >
              <Search size={16}/> Identify
            </button>
          </div>
        )}

        {step === 'loading' && (
          <div style={{ textAlign:'center', padding:'32px 0' }}>
            <Loader2 size={36} style={{ color:'#1db954', animation:'spin 0.8s linear infinite', marginBottom:12 }}/>
            <p style={{ color:'#b3b3b3' }}>Computing fingerprint & looking up…</p>
          </div>
        )}

        {step === 'error' && (
          <div style={{ textAlign:'center', padding:'24px 0' }}>
            <AlertCircle size={36} style={{ color:'#f15e6c', marginBottom:12 }}/>
            <p style={{ color:'#f15e6c', marginBottom:12 }}>{error}</p>
            {error.includes('fpcalc') && (
              <p style={{ color:'#6a6a6a', fontSize:11, maxWidth:360, margin:'0 auto 16px' }}>
                Download Chromaprint from <a href="https://acoustid.org/chromaprint" target="_blank" rel="noreferrer" style={{ color:'#1db954' }}>acoustid.org/chromaprint</a> and place <code>fpcalc.exe</code> in <code>assets/binaries/</code>
              </p>
            )}
            <button className="sp-ghost-btn" onClick={() => setStep('idle')}>Try Again</button>
          </div>
        )}

        {step === 'results' && (
          <div>
            {results.length === 0 ? (
              <div style={{ textAlign:'center', padding:'24px 0' }}>
                <p style={{ color:'#b3b3b3' }}>No matches found in AcoustID database.</p>
              </div>
            ) : (
              <>
                <p style={{ fontSize:12, color:'#b3b3b3', marginBottom:12 }}>Found {results.length} match{results.length !== 1 ? 'es' : ''}. Select one to apply tags:</p>
                <div style={{ display:'flex', flexDirection:'column', gap:8, maxHeight:320, overflowY:'auto' }}>
                  {results.map((r, i) => (
                    <div
                      key={`${r.mbid}-${i}`}
                      style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 14px', background:'rgba(255,255,255,0.04)', borderRadius:10, border:'1px solid rgba(255,255,255,0.07)', cursor:'pointer', transition:'all 0.15s' }}
                      onMouseEnter={e => e.currentTarget.style.background = 'rgba(29,185,84,0.08)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.04)'}
                    >
                      <div style={{ flex:1, minWidth:0 }}>
                        <p style={{ fontSize:14, fontWeight:700, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{r.title}</p>
                        <p style={{ fontSize:12, color:'#b3b3b3', marginTop:2 }}>
                          {r.artist}{r.album ? ` • ${r.album}` : ''}
                        </p>
                      </div>
                      <div style={{ display:'flex', alignItems:'center', gap:8, flexShrink:0 }}>
                        <span style={{ fontSize:11, fontWeight:700, color: r.score >= 90 ? '#1db954' : r.score >= 70 ? '#f59e0b' : '#b3b3b3', background: r.score >= 90 ? 'rgba(29,185,84,0.12)' : 'rgba(255,255,255,0.06)', padding:'2px 8px', borderRadius:99 }}>
                          {r.score}%
                        </span>
                        <button
                          onClick={() => applyTags(r)}
                          disabled={!!applying}
                          style={{ display:'flex', alignItems:'center', gap:6, background:'linear-gradient(135deg,#1db954,#1ed760)', border:'none', color:'#000', padding:'7px 14px', borderRadius:99, cursor:'pointer', fontWeight:800, fontSize:12, flexShrink:0 }}
                        >
                          {applying === r.mbid
                            ? <Loader2 size={13} style={{ animation:'spin 0.8s linear infinite' }}/>
                            : <><Tag size={13}/> Apply</>
                          }
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
            <div style={{ marginTop:16, textAlign:'right' }}>
              <button className="sp-ghost-btn" onClick={() => setStep('idle')}>Re-identify</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
