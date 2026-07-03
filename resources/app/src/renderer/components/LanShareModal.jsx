import React, { useState, useEffect } from 'react';
import { Share2, X, Copy, CheckCircle, Link, Users } from 'lucide-react';

export default function LanShareModal({ playlistId, playlistName, onClose }) {
  const [shareInfo, setShareInfo] = useState(null);
  const [loading, setLoading]     = useState(false);
  const [copied, setCopied]       = useState(false);
  const [joinUrl, setJoinUrl]     = useState('');
  const [joining, setJoining]     = useState(false);
  const [joinedData, setJoinedData] = useState(null);
  const [tab, setTab]             = useState('share'); // share | join

  const startSharing = async () => {
    setLoading(true);
    try {
      const info = await window.electronAPI?.startLanShare(playlistId);
      if (info?.error) throw new Error(info.error);
      setShareInfo(info);
    } catch(e) {
      window.showToast?.(`Error: ${e.message}`, 'error');
    } finally { setLoading(false); }
  };

  const stopSharing = async () => {
    await window.electronAPI?.stopLanShare();
    setShareInfo(null);
  };

  const copyUrl = () => {
    if (!shareInfo?.url) return;
    navigator.clipboard.writeText(shareInfo.url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const joinPlaylist = async () => {
    if (!joinUrl.trim()) return;
    setJoining(true);
    try {
      const res = await fetch(joinUrl.trim());
      if (!res.ok) throw new Error('Could not connect to host');
      const data = await res.json();
      setJoinedData(data);
      window.showToast?.(`Loaded "${data.name}" with ${data.songs?.length || 0} songs`, 'success');
    } catch(e) {
      window.showToast?.(`Could not connect: ${e.message}`, 'error');
    } finally { setJoining(false); }
  };

  useEffect(() => {
    return () => {
      // cleanup: stop server when modal closes
      window.electronAPI?.stopLanShare();
    };
  }, []);

  return (
    <div className="sp-modal-bg" onClick={onClose}>
      <div className="sp-modal" style={{ maxWidth:440 }} onClick={e => e.stopPropagation()}>
        <div className="sp-modal-header">
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <Users size={20} color="#1db954"/>
            <span className="sp-modal-title">LAN Playlist</span>
          </div>
          <button className="sp-modal-close" onClick={onClose}><X size={18}/></button>
        </div>

        <div style={{ display:'flex', gap:2, marginBottom:20, background:'rgba(255,255,255,0.05)', borderRadius:8, padding:4 }}>
          {['share','join'].map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{ flex:1, padding:'8px 0', borderRadius:6, border:'none', background: tab === t ? 'rgba(29,185,84,0.2)' : 'none', color: tab === t ? '#1db954' : '#b3b3b3', fontWeight:700, cursor:'pointer', fontSize:13, textTransform:'capitalize', transition:'all 0.15s' }}
            >
              {t === 'share' ? '📡 Share' : '🔗 Join'}
            </button>
          ))}
        </div>

        {tab === 'share' && (
          <div>
            <p style={{ color:'#b3b3b3', fontSize:13, marginBottom:16 }}>
              Share <strong style={{ color:'#fff' }}>{playlistName}</strong> with anyone on the same WiFi network.
            </p>

            {!shareInfo ? (
              <button
                className="btn-green"
                onClick={startSharing}
                disabled={loading}
                style={{ width:'100%', padding:'14px', fontSize:14, fontWeight:800, borderRadius:12, background:'linear-gradient(135deg,#1db954,#1ed760)', display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}
              >
                {loading ? '…' : <><Share2 size={16}/> Start Sharing</>}
              </button>
            ) : (
              <div>
                <div style={{ background:'rgba(29,185,84,0.08)', border:'1px solid rgba(29,185,84,0.25)', borderRadius:12, padding:16, marginBottom:16 }}>
                  <p style={{ fontSize:12, color:'#1db954', fontWeight:700, marginBottom:8 }}>🟢 Sharing Active</p>
                  <p style={{ fontSize:12, color:'#b3b3b3', marginBottom:6 }}>Share this URL with people on your network:</p>
                  <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                    <code style={{ flex:1, padding:'8px 12px', background:'rgba(0,0,0,0.3)', borderRadius:8, fontSize:13, color:'#fff', wordBreak:'break-all' }}>
                      {shareInfo.url}
                    </code>
                    <button
                      onClick={copyUrl}
                      style={{ padding:'8px', background: copied ? 'rgba(29,185,84,0.2)' : 'rgba(255,255,255,0.1)', border:'none', color: copied ? '#1db954' : '#b3b3b3', borderRadius:8, cursor:'pointer', display:'flex', flexShrink:0 }}
                    >
                      {copied ? <CheckCircle size={16}/> : <Copy size={16}/>}
                    </button>
                  </div>
                </div>
                <p style={{ fontSize:11, color:'#6a6a6a', marginBottom:12 }}>
                  Server is running on port {shareInfo.port}. The playlist will be accessible until you stop sharing or close this window.
                </p>
                <button
                  className="sp-ghost-btn"
                  onClick={stopSharing}
                  style={{ color:'#f15e6c', borderColor:'rgba(241,94,108,0.3)', width:'100%', justifyContent:'center' }}
                >
                  Stop Sharing
                </button>
              </div>
            )}
          </div>
        )}

        {tab === 'join' && (
          <div>
            <p style={{ color:'#b3b3b3', fontSize:13, marginBottom:16 }}>
              Enter the URL shared by your friend to view their playlist.
            </p>
            <div style={{ display:'flex', gap:8, marginBottom:16 }}>
              <input
                className="sp-input"
                placeholder="http://192.168.x.x:3847"
                value={joinUrl}
                onChange={e => setJoinUrl(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && joinPlaylist()}
                style={{ flex:1 }}
              />
              <button
                className="btn-green"
                onClick={joinPlaylist}
                disabled={joining || !joinUrl.trim()}
                style={{ padding:'0 18px', borderRadius:8, fontWeight:800, fontSize:13 }}
              >
                {joining ? '…' : <><Link size={14}/> Connect</>}
              </button>
            </div>

            {joinedData && (
              <div>
                <p style={{ fontSize:12, color:'#1db954', fontWeight:700, marginBottom:8 }}>
                  📋 "{joinedData.name}" — {joinedData.songs?.length || 0} songs
                </p>
                <div style={{ maxHeight:280, overflowY:'auto', display:'flex', flexDirection:'column', gap:4 }}>
                  {(joinedData.songs || []).map((s, i) => (
                    <div key={i} style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 10px', background:'rgba(255,255,255,0.04)', borderRadius:8 }}>
                      {s.thumbnail && <img src={s.thumbnail} alt="" style={{ width:32,height:32,borderRadius:4,objectFit:'cover',flexShrink:0 }}/>}
                      <div style={{ flex:1, minWidth:0 }}>
                        <p style={{ fontSize:13, fontWeight:600, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{s.title}</p>
                        <p style={{ fontSize:11, color:'#b3b3b3' }}>{s.artist || '—'}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
