import React, { useState } from 'react';
import { usePlayerStore }  from '../store/playerStore';
import { useDownloadStore } from '../store/downloadStore';
import { X, Trash2, CheckCircle, AlertCircle, Download, Play, GripVertical, History } from 'lucide-react';

const Spinner = () => (
  <div style={{ width:18,height:18,border:'2px solid #1db954',borderTopColor:'transparent',borderRadius:'50%',animation:'spin 0.8s linear infinite',flexShrink:0 }} />
);

function fmtDur(s) {
  if (!s) return '';
  return `${Math.floor(s/60)}:${String(Math.floor(s%60)).padStart(2,'0')}`;
}

export default function SpRightPanel({ onClose, initialTab = 'queue' }) {
  const [tab, setTab] = useState(initialTab);
  const { queue, queueIndex, currentSong, playSong, removeFromQueue, clearQueue, reorderQueue, playHistory, clearPlayHistory } = usePlayerStore();
  const { downloads, clearCompleted, cancelDownload, removeDownload } = useDownloadStore();
  const [dragIdx, setDragIdx] = useState(null);
  const [dragOverIdx, setDragOverIdx] = useState(null);
  const active = downloads.filter(d => d.status === 'downloading').length;

  const handleQueueDragStart = (e, idx) => { setDragIdx(idx); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', idx); };
  const handleQueueDragOver = (e, idx) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setDragOverIdx(idx); if (dragIdx !== null && dragIdx !== idx) reorderQueue(dragIdx, idx); };
  const handleQueueDragEnd = () => { setDragIdx(null); setDragOverIdx(null); };

  return (
    <div className="sp-right-panel">
      <div style={{ display:'flex', alignItems:'center', padding:'0 14px 0', borderBottom:'1px solid rgba(255,255,255,0.08)', flexShrink:0 }}>
        <div className="sp-panel-tabs" style={{ flex:1 }}>
          <button className={`sp-panel-tab${tab==='queue'?     ' active':''}`} onClick={() => setTab('queue')}>Queue</button>
          <button className={`sp-panel-tab${tab==='history'?   ' active':''}`} onClick={() => setTab('history')} style={{ position:'relative' }}>
            History
            {playHistory.length > 0 && (
              <span style={{ width:7,height:7,borderRadius:'50%',background:'#8b5cf6',position:'absolute',top:6,right:6 }} />
            )}
          </button>
          <button className={`sp-panel-tab${tab==='downloads'?' active':''}`} onClick={() => setTab('downloads')} style={{ position:'relative' }}>
            Downloads
            {active > 0 && (
              <span style={{ width:7,height:7,borderRadius:'50%',background:'#1db954',position:'absolute',top:6,right:6,animation:'pulse 1.2s ease-in-out infinite' }} />
            )}
          </button>
        </div>
        <button
          style={{ background:'none',border:'none',color:'#b3b3b3',cursor:'pointer',padding:6,borderRadius:50,display:'flex',transition:'color 0.15s' }}
          onClick={onClose}
        >
          <X size={16}/>
        </button>
      </div>

      <div className="sp-panel-body">
        {tab === 'queue' ? (
          <>
            {currentSong && (
              <>
                <p style={{ fontSize:11,fontWeight:800,textTransform:'uppercase',letterSpacing:'0.09em',color:'#b3b3b3',marginBottom:10 }}>Now Playing</p>
                <div className="sp-queue-now">
                  {currentSong.thumbnail && (
                    <img src={currentSong.thumbnail} alt="" style={{ width:40,height:40,borderRadius:4,objectFit:'cover',flexShrink:0 }} />
                  )}
                  <div style={{ minWidth:0 }}>
                    <p style={{ fontSize:13,fontWeight:700,color:'#1db954',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>{currentSong.title}</p>
                    <p style={{ fontSize:11,color:'#b3b3b3',marginTop:2 }}>{currentSong.artist || 'Unknown'}</p>
                  </div>
                </div>
              </>
            )}

            {queue.filter((_,i) => i !== queueIndex).length > 0 && (
              <>
                <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',margin:'16px 0 8px' }}>
                  <p style={{ fontSize:11,fontWeight:800,textTransform:'uppercase',letterSpacing:'0.09em',color:'#b3b3b3' }}>Next up</p>
                  <button
                    style={{ background:'none',border:'1px solid rgba(255,255,255,0.15)',color:'#b3b3b3',padding:'4px 12px',borderRadius:99,fontSize:11,fontWeight:700,cursor:'pointer' }}
                    onClick={clearQueue}
                  ><Trash2 size={10} style={{ display:'inline',marginRight:4 }}/>Clear</button>
                </div>
                {queue.map((s, i) => {
                  if (i === queueIndex) return null;
                  return (
                    <div
                      key={`${i}-${s.id}`}
                      className={`sp-queue-item${dragIdx === i ? ' dragging' : ''}${dragOverIdx === i && dragIdx !== i ? ' drag-over' : ''}`}
                      draggable
                      onDragStart={(e) => handleQueueDragStart(e, i)}
                      onDragOver={(e) => handleQueueDragOver(e, i)}
                      onDragEnd={handleQueueDragEnd}
                      onClick={() => { playSong(s); usePlayerStore.setState({ queueIndex: i }); }}
                    >
                      <GripVertical size={12} style={{ color:'#6a6a6a', cursor:'grab', flexShrink:0 }} />
                      {s.thumbnail && <img src={s.thumbnail} alt="" style={{ width:36,height:36,borderRadius:4,objectFit:'cover',flexShrink:0 }}/>}
                      <div style={{ flex:1,minWidth:0 }}>
                        <p style={{ fontSize:13,fontWeight:600,color:'#fff',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>{s.title}</p>
                        <p style={{ fontSize:11,color:'#b3b3b3',marginTop:1 }}>{s.artist}</p>
                      </div>
                      <button className="sp-queue-remove" onClick={e => { e.stopPropagation(); removeFromQueue(i); }}>
                        <X size={12}/>
                      </button>
                    </div>
                  );
                })}
              </>
            )}

            {!currentSong && queue.length === 0 && (
              <div className="sp-empty" style={{ paddingTop:32 }}>
                <div className="sp-empty-icon"><Play size={22}/></div>
                <p className="sp-empty-title">Queue is empty</p>
                <p className="sp-empty-sub">Add songs to start listening</p>
              </div>
            )}
          </>
        ) : tab === 'history' ? (
          <>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
              <p style={{ fontSize:11,fontWeight:800,textTransform:'uppercase',letterSpacing:'0.09em',color:'#b3b3b3' }}>Recently Played</p>
              {playHistory.length > 0 && (
                <button
                  style={{ background:'none',border:'1px solid rgba(255,255,255,0.15)',color:'#b3b3b3',padding:'4px 12px',borderRadius:99,fontSize:11,fontWeight:700,cursor:'pointer' }}
                  onClick={clearPlayHistory}
                ><Trash2 size={10} style={{ display:'inline',marginRight:4 }}/>Clear</button>
              )}
            </div>
            {playHistory.length === 0 ? (
              <div className="sp-empty" style={{ paddingTop:32 }}>
                <div className="sp-empty-icon"><History size={22}/></div>
                <p className="sp-empty-title">No history yet</p>
                <p className="sp-empty-sub">Songs you play will appear here</p>
              </div>
            ) : (
              playHistory.map((s, i) => (
                <div
                  key={`hist-${i}-${s.id}`}
                  className="sp-queue-item"
                  onClick={() => playSong(s)}
                >
                  {s.thumbnail && <img src={s.thumbnail} alt="" style={{ width:36,height:36,borderRadius:4,objectFit:'cover',flexShrink:0 }}/>}
                  <div style={{ flex:1,minWidth:0 }}>
                    <p style={{ fontSize:13,fontWeight:600,color:'#fff',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>{s.title}</p>
                    <p style={{ fontSize:11,color:'#b3b3b3',marginTop:1 }}>{s.artist || 'Unknown'}</p>
                  </div>
                  <span style={{ fontSize:11, color:'#6a6a6a', fontFamily:'monospace', flexShrink:0 }}>{fmtDur(s.duration)}</span>
                </div>
              ))
            )}
          </>
        ) : (
          <>
            <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:12 }}>
              <p style={{ fontSize:11,fontWeight:800,textTransform:'uppercase',letterSpacing:'0.09em',color:'#b3b3b3' }}>Downloads</p>
              {downloads.some(d => d.status !== 'downloading' && d.status !== 'queued') && (
                <button
                  style={{ background:'none',border:'1px solid rgba(255,255,255,0.15)',color:'#b3b3b3',padding:'4px 12px',borderRadius:99,fontSize:11,fontWeight:700,cursor:'pointer' }}
                  onClick={clearCompleted}
                >Clear Finished</button>
              )}
            </div>

            {downloads.length === 0 ? (
              <div className="sp-empty" style={{ paddingTop:32 }}>
                <div className="sp-empty-icon"><Download size={22}/></div>
                <p className="sp-empty-title">No downloads</p>
                <p className="sp-empty-sub">Search YouTube and download songs</p>
              </div>
            ) : (
              downloads.map(dl => (
                <div key={dl.id} className="sp-dl-item">
                  <div style={{ display:'flex',alignItems:'center',gap:10 }}>
                    {dl.status==='downloading' && <Spinner/>}
                    {dl.status==='completed'   && <CheckCircle size={18} color="#1db954"/>}
                    {dl.status==='error'       && <AlertCircle size={18} color="#f15e6c"/>}
                    {dl.status==='queued'      && <Download size={18} color="#b3b3b3"/>}
                    {dl.status==='cancelled'   && <X size={18} color="#f59e0b"/>}
                    <div style={{ flex:1,minWidth:0 }}>
                      <p style={{ fontSize:13,fontWeight:600,color:'#fff',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>{dl.title}</p>
                      <p style={{ fontSize:11,color:'#b3b3b3',marginTop:2 }}>
                        {dl.status==='downloading' ? `${Math.round(dl.progress||0)}% ${dl.speed?'| '+dl.speed:''} ${dl.eta?'| ETA '+dl.eta:''}` : dl.status==='queued' ? 'Waiting in queue...' : dl.status}
                      </p>
                    </div>
                    <button
                      style={{ background:'none',border:'none',color:'#b3b3b3',cursor:'pointer',padding:4,borderRadius:50,display:'flex',flexShrink:0 }}
                      onClick={() => dl.status==='downloading' ? cancelDownload(dl.id) : removeDownload(dl.id)}
                    ><X size={12}/></button>
                  </div>
                  {dl.status==='downloading' && (
                    <div className="sp-dl-progress" style={{ marginTop:8 }}>
                      <div className="sp-dl-bar" style={{ width:`${dl.progress||0}%` }}/>
                    </div>
                  )}
                </div>
              ))
            )}
          </>
        )}
      </div>
    </div>
  );
}
