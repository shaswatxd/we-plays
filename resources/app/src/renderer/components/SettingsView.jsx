import React, { useState, useEffect, useCallback } from 'react';
import { useLibraryStore } from '../store/libraryStore';
import { Settings, Folder, RefreshCw, Key, Search, Trash2, Check, Music, AlertTriangle, Loader2, Sparkles, ChevronDown, ChevronRight, X, Download } from 'lucide-react';

export default function SettingsView() {
  const { settings, setSetting, loadSettings, clearHistory } = useLibraryStore();
  const [dlFolder, setDlFolder] = useState('');
  const [format,   setFormat]   = useState('mp3');
  const [quality,  setQuality]  = useState(320);
  const [ytdlpVer, setYtdlpVer] = useState('Checking…');
  const [ffmpegP,  setFfmpegP]  = useState('Checking…');
  const [updating, setUpdating] = useState(false);

  // App Auto-Updater states
  const [appVersion, setAppVersion] = useState('Loading…');
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [updateInfo, setUpdateInfo] = useState(null);
  const [updateProgress, setUpdateProgress] = useState(null);
  const [updatingApp, setUpdatingApp] = useState(false);



  const [dupGroups, setDupGroups] = useState([]);
  const [dupScanning, setDupScanning] = useState(false);
  const [dupSelected, setDupSelected] = useState({});
  const [dupDone, setDupDone] = useState(false);
  const [dupError, setDupError] = useState('');
  const [expandedGroup, setExpandedGroup] = useState(null);
  const [scanStats, setScanStats] = useState(null);

  const [orphanSongs, setOrphanSongs] = useState([]);
  const [orphanScanning, setOrphanScanning] = useState(false);
  const [orphanSelected, setOrphanSelected] = useState({});
  const [orphanDone, setOrphanDone] = useState(false);
  const [orphanError, setOrphanError] = useState('');

  const [dupPlGroups, setDupPlGroups] = useState([]);
  const [dupPlScanning, setDupPlScanning] = useState(false);
  const [dupPlSelected, setDupPlSelected] = useState({});
  const [dupPlDone, setDupPlDone] = useState(false);
  const [dupPlError, setDupPlError] = useState('');

  useEffect(() => {
    loadSettings();
    checkBins();
    if (window.electronAPI?.getAppVersion) {
      window.electronAPI.getAppVersion().then(setAppVersion);
    }
  }, []);
  useEffect(() => {
    if (settings.downloadFolder) setDlFolder(settings.downloadFolder);
    if (settings.defaultFormat)  setFormat(settings.defaultFormat);
    if (settings.defaultQuality) setQuality(Number(settings.defaultQuality));
  }, [settings]);



  const checkBins = async () => {
    try {
      const v = await window.electronAPI?.getYtdlpVersion();
      const f = await window.electronAPI?.getFfmpegPath();
      setYtdlpVer(v || 'Not found'); setFfmpegP(f || 'Not found');
    } catch { setYtdlpVer('Error'); setFfmpegP('Error'); }
  };

  const browse = async () => {
    const f = await window.electronAPI?.selectFolder();
    if (f) { setDlFolder(f); setSetting('downloadFolder', f); }
  };

  const updateYt = async () => {
    setUpdating(true);
    try {
      const msg = await window.electronAPI?.updateYtdlp();
      window.showToast?.(msg || 'yt-dlp updated', 'success');
      await checkBins();
    } catch (e) {
      window.showToast?.(`Update failed: ${e.message}`, 'error');
    } finally { setUpdating(false); }
  };

  const checkAppUpdate = async () => {
    setCheckingUpdate(true);
    try {
      const info = await window.electronAPI?.checkAppUpdate();
      setUpdateInfo(info);
      if (info?.updateAvailable) {
        window.showToast?.(`Update available: v${info.version}`, 'info');
      } else {
        window.showToast?.('We Plays is up to date!', 'success');
      }
    } catch (e) {
      window.showToast?.(`Failed to check for updates: ${e.message}`, 'error');
    } finally {
      setCheckingUpdate(false);
    }
  };

  const installAppUpdate = async () => {
    if (!updateInfo?.downloadUrl) return;
    setUpdatingApp(true);
    setUpdateProgress(0);

    const unsubscribe = window.electronAPI?.onUpdateProgress((percent) => {
      setUpdateProgress(percent);
    });

    try {
      window.showToast?.('Downloading update...', 'info');
      await window.electronAPI?.installAppUpdate(updateInfo.downloadUrl);
    } catch (e) {
      window.showToast?.(`Failed to install update: ${e.message}`, 'error');
      setUpdatingApp(false);
      setUpdateProgress(null);
    } finally {
      if (unsubscribe) unsubscribe();
    }
  };

  const handleClearHistory = async () => {
    if (window.confirm("Are you sure you want to clear your Recently Played history?")) {
      await clearHistory();
      window.showToast?.("Recently Played history cleared", "success");
    }
  };

  const handleClearCache = async () => {
    if (window.confirm("Are you sure you want to clear the application web cache?")) {
      try {
        await window.electronAPI?.clearAppCache();
        window.showToast?.("Application cache cleared", "success");
      } catch (err) {
        console.error("Failed to clear cache:", err);
        window.showToast?.("Failed to clear application cache", "error");
      }
    }
  };

  const SHORTCUTS = [
    ['Space',       'Play / Pause'],
    ['N',           'Next Track'],
    ['P',           'Previous Track'],
    ['M',           'Mute / Unmute'],
    ['S',           'Toggle Shuffle'],
    ['R',           'Toggle Repeat'],
    ['Arrow Left',  'Rewind 10s'],
    ['Arrow Right', 'Forward 10s'],
    ['Arrow Up',    'Volume +5%'],
    ['Arrow Down',  'Volume -5%'],
    ['Ctrl + F',    'Focus Search'],
    ['Ctrl + L',    'Go to Search'],
    ['Ctrl + D',    'Download Current'],
    ['?',           'Show Shortcuts'],
    ['Esc',         'Close Modals'],
  ];

  const scanDuplicates = async () => {
    setDupScanning(true);
    setDupDone(false);
    setDupError('');
    setExpandedGroup(null);
    try {
      if (!window.electronAPI?.findDuplicates) {
        setDupError('Duplicate scanner not available. Please fully restart the app (close it completely, not just the window).');
        return;
      }
      const groups = await window.electronAPI.findDuplicates();
      const g = groups || [];
      setDupGroups(g);
      const totalSongs = g.reduce((s, gr) => s + 1 + gr.remove.length, 0);
      const totalRemovable = g.reduce((s, gr) => s + gr.remove.length, 0);
      setScanStats({ groups: g.length, totalRemovable });
      const sel = {};
      g.forEach((gr, gi) => {
        gr.remove.forEach(r => { sel[`${gi}-${r.id}`] = true; });
      });
      setDupSelected(sel);
      if (g.length > 0) setExpandedGroup(0);
      else setDupDone(true);
    } catch (err) {
      console.error('Scan failed:', err);
      setDupError(`Scan failed: ${err.message || 'Unknown error'}`);
    } finally { setDupScanning(false); }
  };

  const toggleDupSel = useCallback((key) => {
    setDupSelected(prev => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const toggleGroupSel = useCallback((gi) => {
    setDupSelected(prev => {
      const next = { ...prev };
      const allSel = dupGroups[gi].remove.every(r => prev[`${gi}-${r.id}`]);
      dupGroups[gi].remove.forEach(r => { next[`${gi}-${r.id}`] = !allSel; });
      return next;
    });
  }, [dupGroups]);

  const selectAll = () => {
    const sel = {};
    dupGroups.forEach((g, gi) => {
      g.remove.forEach(r => { sel[`${gi}-${r.id}`] = true; });
    });
    setDupSelected(sel);
  };

  const deselectAll = () => {
    const sel = {};
    dupGroups.forEach((g, gi) => {
      g.remove.forEach(r => { sel[`${gi}-${r.id}`] = false; });
    });
    setDupSelected(sel);
  };

  const deleteSelectedDuplicates = async () => {
    const toDelete = [];
    dupGroups.forEach((g, gi) => {
      g.remove.forEach(r => {
        if (dupSelected[`${gi}-${r.id}`]) toDelete.push(r.id);
      });
    });
    if (toDelete.length === 0) {
      window.showToast?.('No duplicates selected', 'info');
      return;
    }
    if (!window.confirm(`Delete ${toDelete.length} duplicate song${toDelete.length > 1 ? 's' : ''}?\n\nThis will remove them from your library and playlists. This cannot be undone.`)) return;
    try {
      await window.electronAPI?.removeDuplicateSongs(toDelete);
      window.showToast?.(`Deleted ${toDelete.length} duplicate${toDelete.length > 1 ? 's' : ''}`, 'success');
      setDupDone(true);
      setDupGroups([]);
      setDupSelected({});
      setScanStats(null);
      useLibraryStore.getState().loadLibrary();
    } catch (err) {
      console.error('Delete failed:', err);
      window.showToast?.('Failed to delete duplicates', 'error');
    }
  };

  const totalDups = dupGroups.reduce((sum, g) => sum + g.remove.length, 0);
  const selectedDups = dupGroups.reduce((sum, g, gi) => sum + g.remove.filter(r => dupSelected[`${gi}-${r.id}`]).length, 0);

  const scanOrphaned = async () => {
    setOrphanScanning(true);
    setOrphanDone(false);
    setOrphanError('');
    try {
      const songs = await window.electronAPI?.findOrphanedSongs();
      setOrphanSongs(songs || []);
      const sel = {};
      (songs || []).forEach(s => { sel[s.id] = true; });
      setOrphanSelected(sel);
      if (!songs || songs.length === 0) setOrphanDone(true);
    } catch (err) {
      setOrphanError(`Scan failed: ${err.message || 'Unknown error'}`);
    } finally { setOrphanScanning(false); }
  };

  const deleteOrphaned = async () => {
    const toDelete = orphanSongs.filter(s => orphanSelected[s.id]).map(s => s.id);
    if (toDelete.length === 0) {
      window.showToast?.('No orphaned songs selected', 'info');
      return;
    }
    if (!window.confirm(`Delete ${toDelete.length} orphaned song${toDelete.length > 1 ? 's' : ''}?\n\nThese songs point to files that no longer exist on disk. This cannot be undone.`)) return;
    try {
      await window.electronAPI?.removeOrphanedSongs(toDelete);
      window.showToast?.(`Deleted ${toDelete.length} orphaned song${toDelete.length > 1 ? 's' : ''}`, 'success');
      setOrphanDone(true);
      setOrphanSongs([]);
      setOrphanSelected({});
      useLibraryStore.getState().loadLibrary();
    } catch (err) {
      window.showToast?.('Failed to delete orphaned songs', 'error');
    }
  };

  const scanDupPlaylists = async () => {
    setDupPlScanning(true);
    setDupPlDone(false);
    setDupPlError('');
    try {
      const groups = await window.electronAPI?.findDuplicatePlaylists();
      setDupPlGroups(groups || []);
      const sel = {};
      (groups || []).forEach((g, gi) => {
        g.remove.forEach(r => { sel[`${gi}-${r.id}`] = true; });
      });
      setDupPlSelected(sel);
      if (!groups || groups.length === 0) setDupPlDone(true);
    } catch (err) {
      setDupPlError(`Scan failed: ${err.message || 'Unknown error'}`);
    } finally { setDupPlScanning(false); }
  };

  const deleteDupPlaylists = async () => {
    const toDelete = [];
    dupPlGroups.forEach((g, gi) => {
      g.remove.forEach(r => {
        if (dupPlSelected[`${gi}-${r.id}`]) toDelete.push(r.id);
      });
    });
    if (toDelete.length === 0) {
      window.showToast?.('No duplicate playlists selected', 'info');
      return;
    }
    if (!window.confirm(`Delete ${toDelete.length} duplicate playlist${toDelete.length > 1 ? 's' : ''}?\n\nThis will remove the duplicate playlists and their song associations. This cannot be undone.`)) return;
    try {
      await window.electronAPI?.removeDuplicatePlaylists(toDelete);
      window.showToast?.(`Deleted ${toDelete.length} duplicate playlist${toDelete.length > 1 ? 's' : ''}`, 'success');
      setDupPlDone(true);
      setDupPlGroups([]);
      setDupPlSelected({});
      useLibraryStore.getState().loadPlaylists();
    } catch (err) {
      window.showToast?.('Failed to delete duplicate playlists', 'error');
    }
  };

  const totalOrphanSelected = orphanSongs.filter(s => orphanSelected[s.id]).length;
  const totalDupPlSelected = dupPlGroups.reduce((sum, g, gi) => sum + g.remove.filter(r => dupPlSelected[`${gi}-${r.id}`]).length, 0);

  return (
    <div style={{ padding: '24px 24px 40px 24px' }}>
      <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:28 }}>
        <Settings size={22} color="#1db954"/>
        <h1 style={{ fontSize:28, fontWeight:900 }}>Settings</h1>
      </div>

      <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
        {/* Downloads */}
        <div className="sp-settings-section">
          <p className="sp-settings-title">Download Preferences</p>
          <div>
            <label className="sp-label">Download Folder</label>
            <div style={{ display:'flex', gap:8 }}>
              <input
                type="text"
                className="sp-input"
                style={{ flex:1 }}
                value={dlFolder}
                onChange={e => { setDlFolder(e.target.value); setSetting('downloadFolder', e.target.value); }}
                placeholder="Select destination…"
              />
              <button
                onClick={browse}
                style={{ display:'flex',alignItems:'center',gap:6,background:'none',border:'1px solid rgba(255,255,255,0.2)',color:'#b3b3b3',padding:'0 16px',borderRadius:8,cursor:'pointer',fontWeight:700,fontSize:13,flexShrink:0,whiteSpace:'nowrap' }}
              ><Folder size={14}/> Browse</button>
            </div>
          </div>

          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
            <div>
              <label className="sp-label">Format</label>
              <select
                className="sp-select"
                value={format}
                onChange={e => { setFormat(e.target.value); setSetting('defaultFormat', e.target.value); }}
                style={{ width:'100%' }}
              >
                <option value="mp3">MP3</option>
                <option value="flac">FLAC (Lossless)</option>
                <option value="aac">AAC</option>
                <option value="ogg">OGG Vorbis</option>
              </select>
            </div>
            <div>
              <label className="sp-label">Bitrate</label>
              <select
                className="sp-select"
                value={quality}
                onChange={e => { setQuality(Number(e.target.value)); setSetting('defaultQuality', e.target.value); }}
                style={{ width:'100%', opacity: format === 'flac' ? 0.5 : 1 }}
                disabled={format === 'flac'}
              >
                <option value={320}>320 kbps — Best</option>
                <option value={256}>256 kbps — Great</option>
                <option value={192}>192 kbps — Good</option>
                <option value={128}>128 kbps — Small</option>
              </select>
            </div>
          </div>
        </div>

        {/* Duplicate Cleaner */}
        <div className="sp-settings-section" style={{ border: dupGroups.length > 0 ? '1px solid rgba(29,185,84,0.2)' : undefined }}>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <Sparkles size={14} color="#1db954"/>
            <p className="sp-settings-title" style={{ margin:0 }}>Duplicate Cleaner</p>
          </div>

          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:12, flexWrap:'wrap' }}>
            <div style={{ display:'flex', flexDirection:'column', minWidth:0 }}>
              <span className="sp-settings-key" style={{ color:'#fff', fontWeight:700 }}>Scan for Duplicate Songs</span>
              <span style={{ fontSize:11, color:'#b3b3b3', marginTop:2 }}>Finds songs with the same title &amp; artist, same file path, or same song name from different sources.</span>
            </div>
            <button
              onClick={scanDuplicates}
              disabled={dupScanning}
              className="btn-green"
              style={{ display:'flex',alignItems:'center',gap:6,padding:'10px 20px',fontSize:13,flexShrink:0 }}
            >
              {dupScanning
                ? <><Loader2 size={14} style={{ animation:'spin 0.8s linear infinite' }}/> Scanning…</>
                : <><Search size={14}/> Scan Now</>
              }
            </button>
          </div>

          {dupError && (
            <div style={{
              background:'rgba(241,94,108,0.1)', border:'1px solid rgba(241,94,108,0.2)',
              borderRadius:8, padding:'12px 14px', fontSize:12, color:'#f15e6c',
              display:'flex', alignItems:'flex-start', gap:8
            }}>
              <AlertTriangle size={16} style={{ flexShrink:0, marginTop:1 }}/>
              <span>{dupError}</span>
            </div>
          )}

          {dupDone && !dupError && (
            <div style={{
              background:'rgba(29,185,84,0.1)', border:'1px solid rgba(29,185,84,0.2)',
              borderRadius:8, padding:'12px 14px', fontSize:12, color:'#1db954',
              display:'flex', alignItems:'center', gap:8
            }}>
              <Check size={16}/>
              <span>No duplicate songs found in your library!</span>
            </div>
          )}

          {!dupScanning && dupGroups.length === 0 && !dupDone && !dupError && (
            <div style={{
              background:'rgba(255,255,255,0.02)', border:'1px dashed rgba(255,255,255,0.08)',
              borderRadius:8, padding:'24px 16px', textAlign:'center'
            }}>
              <Music size={28} color="#6a6a6a" style={{ marginBottom:8 }}/>
              <p style={{ fontSize:12, color:'#6a6a6a', margin:0 }}>
                Click "Scan Now" to find duplicate songs in your library.
              </p>
            </div>
          )}

          {dupGroups.length > 0 && (
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              <div style={{
                display:'flex', alignItems:'center', justifyContent:'space-between',
                background:'rgba(255,255,255,0.03)', borderRadius:8, padding:'10px 14px'
              }}>
                <div style={{ display:'flex', alignItems:'center', gap:12, fontSize:12 }}>
                  <span style={{ color:'#1db954', fontWeight:700 }}>
                    {scanStats?.groups} group{scanStats?.groups !== 1 ? 's' : ''}
                  </span>
                  <span style={{ color:'#6a6a6a' }}>|</span>
                  <span style={{ color:'#f15e6c', fontWeight:700 }}>
                    {totalDups} duplicate{totalDups !== 1 ? 's' : ''} found
                  </span>
                </div>
                <div style={{ display:'flex', gap:6 }}>
                  <button
                    onClick={selectAll}
                    style={{ background:'none', border:'1px solid rgba(255,255,255,0.1)', color:'#b3b3b3', padding:'5px 10px', borderRadius:6, cursor:'pointer', fontSize:11, fontWeight:600 }}
                  >
                    Select All
                  </button>
                  <button
                    onClick={deselectAll}
                    style={{ background:'none', border:'1px solid rgba(255,255,255,0.1)', color:'#b3b3b3', padding:'5px 10px', borderRadius:6, cursor:'pointer', fontSize:11, fontWeight:600 }}
                  >
                    Deselect All
                  </button>
                  <button
                    onClick={deleteSelectedDuplicates}
                    disabled={selectedDups === 0}
                    style={{
                      display:'flex', alignItems:'center', gap:5,
                      background: selectedDups > 0 ? 'rgba(241,94,108,0.15)' : 'rgba(255,255,255,0.03)',
                      border:`1px solid ${selectedDups > 0 ? 'rgba(241,94,108,0.3)' : 'rgba(255,255,255,0.1)'}`,
                      color: selectedDups > 0 ? '#f15e6c' : '#666',
                      padding:'5px 12px', borderRadius:6,
                      cursor: selectedDups > 0 ? 'pointer' : 'default',
                      fontWeight:700, fontSize:11
                    }}
                  >
                    <Trash2 size={12}/>
                    Delete{selectedDups > 0 ? ` (${selectedDups})` : ''}
                  </button>
                </div>
              </div>

              {dupGroups.map((group, gi) => {
                const isExpanded = expandedGroup === gi;
                const allSel = group.remove.every(r => dupSelected[`${gi}-${r.id}`]);
                const someSel = group.remove.some(r => dupSelected[`${gi}-${r.id}`]);
                return (
                  <div key={gi} style={{
                    background:'rgba(255,255,255,0.02)',
                    border:'1px solid rgba(255,255,255,0.06)',
                    borderRadius:8, overflow:'hidden'
                  }}>
                    <div style={{
                      display:'flex', alignItems:'center', gap:10, padding:'10px 14px'
                    }}>
                      <div
                        onClick={() => toggleGroupSel(gi)}
                        style={{
                          width:18, height:18, borderRadius:4,
                          border:`2px solid ${allSel ? '#1db954' : someSel ? '#f59e0b' : 'rgba(255,255,255,0.2)'}`,
                          display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, cursor:'pointer',
                          background: allSel ? '#1db954' : someSel ? 'rgba(245,158,11,0.2)' : 'transparent'
                        }}>
                        {allSel && <Check size={11} color="#000"/>}
                        {someSel && !allSel && <div style={{ width:8, height:2, background:'#f59e0b', borderRadius:1 }}/>}
                      </div>

                      <div
                        onClick={() => setExpandedGroup(isExpanded ? null : gi)}
                        style={{ display:'flex', alignItems:'center', gap:8, flex:1, minWidth:0, cursor:'pointer' }}
                      >
                        {isExpanded ? <ChevronDown size={14} color="#b3b3b3"/> : <ChevronRight size={14} color="#b3b3b3"/>}
                        <Music size={14} color="#1db954" style={{ flexShrink:0 }}/>
                        <div style={{ minWidth:0, flex:1 }}>
                          <div style={{ fontSize:13, fontWeight:700, color:'#fff', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                            {group.keep.title}
                          </div>
                          <div style={{ fontSize:11, color:'#b3b3b3', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                            {group.keep.artist || 'Unknown'} {group.keep.album ? `· ${group.keep.album}` : ''}
                          </div>
                        </div>
                      </div>

                      <span style={{
                        fontSize:11, fontWeight:700, padding:'3px 8px', borderRadius:4, flexShrink:0,
                        background:'rgba(241,94,108,0.1)', color:'#f15e6c'
                      }}>
                        {group.remove.length} dup{group.remove.length > 1 ? 's' : ''}
                      </span>
                    </div>

                    {isExpanded && (
                      <div style={{ borderTop:'1px solid rgba(255,255,255,0.06)', padding:'4px 0' }}>
                        <div style={{
                          display:'flex', alignItems:'center', gap:8,
                          padding:'8px 14px 8px 42px', fontSize:11
                        }}>
                          <span style={{
                            width:6, height:6, borderRadius:'50%', background:'#1db954', flexShrink:0,
                            boxShadow:'0 0 6px rgba(29,185,84,0.4)'
                          }}/>
                          <span style={{ color:'#1db954', fontWeight:600, flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                            {group.keep.title} — {group.keep.artist || 'Unknown'}
                          </span>
                          <span style={{ color:'#1db954', fontSize:10, fontWeight:700, flexShrink:0, opacity:0.6 }}>KEEPING</span>
                        </div>

                        {group.remove.map((r) => {
                          const key = `${gi}-${r.id}`;
                          const isSel = dupSelected[key];
                          return (
                            <div
                              key={r.id}
                              onClick={() => toggleDupSel(key)}
                              style={{
                                display:'flex', alignItems:'center', gap:8,
                                padding:'8px 14px 8px 42px', cursor:'pointer', fontSize:11,
                                background: isSel ? 'rgba(241,94,108,0.06)' : 'transparent',
                                transition:'background 0.1s'
                              }}
                              onMouseEnter={e => { if (!isSel) e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; }}
                              onMouseLeave={e => { if (!isSel) e.currentTarget.style.background = 'transparent'; }}
                            >
                              <div style={{
                                width:16, height:16, borderRadius:3,
                                border:`2px solid ${isSel ? '#f15e6c' : 'rgba(255,255,255,0.15)'}`,
                                display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0,
                                background: isSel ? '#f15e6c' : 'transparent',
                                transition:'all 0.1s'
                              }}>
                                {isSel && <Check size={10} color="#000"/>}
                              </div>
                              <div style={{ flex:1, minWidth:0 }}>
                                <div style={{ color: isSel ? '#f15e6c' : '#b3b3b3', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', fontWeight: isSel ? 600 : 400 }}>
                                  {r.title} — {r.artist || 'Unknown'}
                                </div>
                                {r.file_path && (
                                  <div style={{ color:'#6a6a6a', fontSize:10, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', marginTop:1 }}>
                                    {r.file_path}
                                  </div>
                                )}
                              </div>
                              <span style={{ color:'#f15e6c', fontSize:10, fontWeight:700, flexShrink:0, opacity: isSel ? 1 : 0.4 }}>
                                DELETE
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Orphaned Songs Cleaner */}
        <div className="sp-settings-section" style={{ border: orphanSongs.length > 0 ? '1px solid rgba(245,158,11,0.2)' : undefined }}>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <AlertTriangle size={14} color="#f59e0b"/>
            <p className="sp-settings-title" style={{ margin:0 }}>Orphaned Songs Cleaner</p>
          </div>

          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:12, flexWrap:'wrap' }}>
            <div style={{ display:'flex', flexDirection:'column', minWidth:0 }}>
              <span className="sp-settings-key" style={{ color:'#fff', fontWeight:700 }}>Scan for Missing Files</span>
              <span style={{ fontSize:11, color:'#b3b3b3', marginTop:2 }}>Finds songs in your library whose audio files no longer exist on disk.</span>
            </div>
            <button
              onClick={scanOrphaned}
              disabled={orphanScanning}
              className="btn-green"
              style={{ display:'flex',alignItems:'center',gap:6,padding:'10px 20px',fontSize:13,flexShrink:0 }}
            >
              {orphanScanning
                ? <><Loader2 size={14} style={{ animation:'spin 0.8s linear infinite' }}/> Scanning…</>
                : <><Search size={14}/> Scan Now</>
              }
            </button>
          </div>

          {orphanError && (
            <div style={{
              background:'rgba(241,94,108,0.1)', border:'1px solid rgba(241,94,108,0.2)',
              borderRadius:8, padding:'12px 14px', fontSize:12, color:'#f15e6c',
              display:'flex', alignItems:'flex-start', gap:8
            }}>
              <AlertTriangle size={16} style={{ flexShrink:0, marginTop:1 }}/>
              <span>{orphanError}</span>
            </div>
          )}

          {orphanDone && !orphanError && (
            <div style={{
              background:'rgba(29,185,84,0.1)', border:'1px solid rgba(29,185,84,0.2)',
              borderRadius:8, padding:'12px 14px', fontSize:12, color:'#1db954',
              display:'flex', alignItems:'center', gap:8
            }}>
              <Check size={16}/>
              <span>No orphaned songs found. All files exist on disk!</span>
            </div>
          )}

          {!orphanScanning && orphanSongs.length === 0 && !orphanDone && !orphanError && (
            <div style={{
              background:'rgba(255,255,255,0.02)', border:'1px dashed rgba(255,255,255,0.08)',
              borderRadius:8, padding:'24px 16px', textAlign:'center'
            }}>
              <AlertTriangle size={28} color="#6a6a6a" style={{ marginBottom:8 }}/>
              <p style={{ fontSize:12, color:'#6a6a6a', margin:0 }}>
                Click "Scan Now" to find songs with missing files.
              </p>
            </div>
          )}

          {orphanSongs.length > 0 && (
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              <div style={{
                display:'flex', alignItems:'center', justifyContent:'space-between',
                background:'rgba(255,255,255,0.03)', borderRadius:8, padding:'10px 14px'
              }}>
                <div style={{ display:'flex', alignItems:'center', gap:12, fontSize:12 }}>
                  <span style={{ color:'#f59e0b', fontWeight:700 }}>
                    {orphanSongs.length} orphaned song{orphanSongs.length !== 1 ? 's' : ''}
                  </span>
                </div>
                <div style={{ display:'flex', gap:6 }}>
                  <button
                    onClick={() => { const sel = {}; orphanSongs.forEach(s => { sel[s.id] = true; }); setOrphanSelected(sel); }}
                    style={{ background:'none', border:'1px solid rgba(255,255,255,0.1)', color:'#b3b3b3', padding:'5px 10px', borderRadius:6, cursor:'pointer', fontSize:11, fontWeight:600 }}
                  >
                    Select All
                  </button>
                  <button
                    onClick={() => { const sel = {}; orphanSongs.forEach(s => { sel[s.id] = false; }); setOrphanSelected(sel); }}
                    style={{ background:'none', border:'1px solid rgba(255,255,255,0.1)', color:'#b3b3b3', padding:'5px 10px', borderRadius:6, cursor:'pointer', fontSize:11, fontWeight:600 }}
                  >
                    Deselect All
                  </button>
                  <button
                    onClick={deleteOrphaned}
                    disabled={totalOrphanSelected === 0}
                    style={{
                      display:'flex', alignItems:'center', gap:5,
                      background: totalOrphanSelected > 0 ? 'rgba(241,94,108,0.15)' : 'rgba(255,255,255,0.03)',
                      border:`1px solid ${totalOrphanSelected > 0 ? 'rgba(241,94,108,0.3)' : 'rgba(255,255,255,0.1)'}`,
                      color: totalOrphanSelected > 0 ? '#f15e6c' : '#666',
                      padding:'5px 12px', borderRadius:6,
                      cursor: totalOrphanSelected > 0 ? 'pointer' : 'default',
                      fontWeight:700, fontSize:11
                    }}
                  >
                    <Trash2 size={12}/>
                    Delete{totalOrphanSelected > 0 ? ` (${totalOrphanSelected})` : ''}
                  </button>
                </div>
              </div>

              <div style={{ maxHeight:200, overflowY:'auto', display:'flex', flexDirection:'column', gap:2 }}>
                {orphanSongs.map(song => {
                  const isSel = orphanSelected[song.id];
                  return (
                    <div
                      key={song.id}
                      onClick={() => setOrphanSelected(prev => ({ ...prev, [song.id]: !prev[song.id] }))}
                      style={{
                        display:'flex', alignItems:'center', gap:8,
                        padding:'8px 14px', cursor:'pointer', fontSize:11,
                        background: isSel ? 'rgba(241,94,108,0.06)' : 'transparent',
                        borderRadius:6, transition:'background 0.1s'
                      }}
                      onMouseEnter={e => { if (!isSel) e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; }}
                      onMouseLeave={e => { if (!isSel) e.currentTarget.style.background = 'transparent'; }}
                    >
                      <div style={{
                        width:16, height:16, borderRadius:3,
                        border:`2px solid ${isSel ? '#f15e6c' : 'rgba(255,255,255,0.15)'}`,
                        display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0,
                        background: isSel ? '#f15e6c' : 'transparent',
                        transition:'all 0.1s'
                      }}>
                        {isSel && <Check size={10} color="#000"/>}
                      </div>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ color: isSel ? '#f15e6c' : '#b3b3b3', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', fontWeight: isSel ? 600 : 400 }}>
                          {song.title} — {song.artist || 'Unknown'}
                        </div>
                        {song.file_path && (
                          <div style={{ color:'#6a6a6a', fontSize:10, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', marginTop:1 }}>
                            {song.file_path}
                          </div>
                        )}
                      </div>
                      <span style={{ color:'#f59e0b', fontSize:10, fontWeight:700, flexShrink:0, opacity: isSel ? 1 : 0.4 }}>
                        MISSING
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Duplicate Playlists Cleaner */}
        <div className="sp-settings-section" style={{ border: dupPlGroups.length > 0 ? '1px solid rgba(29,185,84,0.2)' : undefined }}>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <Music size={14} color="#1db954"/>
            <p className="sp-settings-title" style={{ margin:0 }}>Duplicate Playlists Cleaner</p>
          </div>

          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:12, flexWrap:'wrap' }}>
            <div style={{ display:'flex', flexDirection:'column', minWidth:0 }}>
              <span className="sp-settings-key" style={{ color:'#fff', fontWeight:700 }}>Scan for Duplicate Playlists</span>
              <span style={{ fontSize:11, color:'#b3b3b3', marginTop:2 }}>Finds playlists with the same name. Keeps the oldest one.</span>
            </div>
            <button
              onClick={scanDupPlaylists}
              disabled={dupPlScanning}
              className="btn-green"
              style={{ display:'flex',alignItems:'center',gap:6,padding:'10px 20px',fontSize:13,flexShrink:0 }}
            >
              {dupPlScanning
                ? <><Loader2 size={14} style={{ animation:'spin 0.8s linear infinite' }}/> Scanning…</>
                : <><Search size={14}/> Scan Now</>
              }
            </button>
          </div>

          {dupPlError && (
            <div style={{
              background:'rgba(241,94,108,0.1)', border:'1px solid rgba(241,94,108,0.2)',
              borderRadius:8, padding:'12px 14px', fontSize:12, color:'#f15e6c',
              display:'flex', alignItems:'flex-start', gap:8
            }}>
              <AlertTriangle size={16} style={{ flexShrink:0, marginTop:1 }}/>
              <span>{dupPlError}</span>
            </div>
          )}

          {dupPlDone && !dupPlError && (
            <div style={{
              background:'rgba(29,185,84,0.1)', border:'1px solid rgba(29,185,84,0.2)',
              borderRadius:8, padding:'12px 14px', fontSize:12, color:'#1db954',
              display:'flex', alignItems:'center', gap:8
            }}>
              <Check size={16}/>
              <span>No duplicate playlists found!</span>
            </div>
          )}

          {!dupPlScanning && dupPlGroups.length === 0 && !dupPlDone && !dupPlError && (
            <div style={{
              background:'rgba(255,255,255,0.02)', border:'1px dashed rgba(255,255,255,0.08)',
              borderRadius:8, padding:'24px 16px', textAlign:'center'
            }}>
              <Music size={28} color="#6a6a6a" style={{ marginBottom:8 }}/>
              <p style={{ fontSize:12, color:'#6a6a6a', margin:0 }}>
                Click "Scan Now" to find duplicate playlists.
              </p>
            </div>
          )}

          {dupPlGroups.length > 0 && (
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              <div style={{
                display:'flex', alignItems:'center', justifyContent:'space-between',
                background:'rgba(255,255,255,0.03)', borderRadius:8, padding:'10px 14px'
              }}>
                <div style={{ display:'flex', alignItems:'center', gap:12, fontSize:12 }}>
                  <span style={{ color:'#1db954', fontWeight:700 }}>
                    {dupPlGroups.length} group{dupPlGroups.length !== 1 ? 's' : ''}
                  </span>
                  <span style={{ color:'#6a6a6a' }}>|</span>
                  <span style={{ color:'#f15e6c', fontWeight:700 }}>
                    {totalDupPlSelected} duplicate{totalDupPlSelected !== 1 ? 's' : ''} selected
                  </span>
                </div>
                <div style={{ display:'flex', gap:6 }}>
                  <button
                    onClick={() => { const sel = {}; dupPlGroups.forEach((g, gi) => { g.remove.forEach(r => { sel[`${gi}-${r.id}`] = true; }); }); setDupPlSelected(sel); }}
                    style={{ background:'none', border:'1px solid rgba(255,255,255,0.1)', color:'#b3b3b3', padding:'5px 10px', borderRadius:6, cursor:'pointer', fontSize:11, fontWeight:600 }}
                  >
                    Select All
                  </button>
                  <button
                    onClick={() => { const sel = {}; dupPlGroups.forEach((g, gi) => { g.remove.forEach(r => { sel[`${gi}-${r.id}`] = false; }); }); setDupPlSelected(sel); }}
                    style={{ background:'none', border:'1px solid rgba(255,255,255,0.1)', color:'#b3b3b3', padding:'5px 10px', borderRadius:6, cursor:'pointer', fontSize:11, fontWeight:600 }}
                  >
                    Deselect All
                  </button>
                  <button
                    onClick={deleteDupPlaylists}
                    disabled={totalDupPlSelected === 0}
                    style={{
                      display:'flex', alignItems:'center', gap:5,
                      background: totalDupPlSelected > 0 ? 'rgba(241,94,108,0.15)' : 'rgba(255,255,255,0.03)',
                      border:`1px solid ${totalDupPlSelected > 0 ? 'rgba(241,94,108,0.3)' : 'rgba(255,255,255,0.1)'}`,
                      color: totalDupPlSelected > 0 ? '#f15e6c' : '#666',
                      padding:'5px 12px', borderRadius:6,
                      cursor: totalDupPlSelected > 0 ? 'pointer' : 'default',
                      fontWeight:700, fontSize:11
                    }}
                  >
                    <Trash2 size={12}/>
                    Delete{totalDupPlSelected > 0 ? ` (${totalDupPlSelected})` : ''}
                  </button>
                </div>
              </div>

              {dupPlGroups.map((group, gi) => (
                <div key={gi} style={{
                  background:'rgba(255,255,255,0.02)',
                  border:'1px solid rgba(255,255,255,0.06)',
                  borderRadius:8, padding:'10px 14px'
                }}>
                  <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6 }}>
                    <Music size={14} color="#1db954" style={{ flexShrink:0 }}/>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:13, fontWeight:700, color:'#1db954', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                        {group.keep.name}
                      </div>
                      <div style={{ fontSize:10, color:'#6a6a6a', marginTop:2 }}>
                        Keeping · Created {group.keep.created_at ? new Date(group.keep.created_at).toLocaleDateString() : 'Unknown'}
                      </div>
                    </div>
                  </div>
                  {group.remove.map(r => {
                    const key = `${gi}-${r.id}`;
                    const isSel = dupPlSelected[key];
                    return (
                      <div
                        key={r.id}
                        onClick={() => setDupPlSelected(prev => ({ ...prev, [key]: !prev[key] }))}
                        style={{
                          display:'flex', alignItems:'center', gap:8,
                          padding:'6px 14px 6px 28px', cursor:'pointer', fontSize:11,
                          background: isSel ? 'rgba(241,94,108,0.06)' : 'transparent',
                          borderRadius:6, transition:'background 0.1s'
                        }}
                        onMouseEnter={e => { if (!isSel) e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; }}
                        onMouseLeave={e => { if (!isSel) e.currentTarget.style.background = 'transparent'; }}
                      >
                        <div style={{
                          width:16, height:16, borderRadius:3,
                          border:`2px solid ${isSel ? '#f15e6c' : 'rgba(255,255,255,0.15)'}`,
                          display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0,
                          background: isSel ? '#f15e6c' : 'transparent',
                          transition:'all 0.1s'
                        }}>
                          {isSel && <Check size={10} color="#000"/>}
                        </div>
                        <div style={{ flex:1, minWidth:0 }}>
                          <div style={{ color: isSel ? '#f15e6c' : '#b3b3b3', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                            {r.name}
                          </div>
                          <div style={{ color:'#6a6a6a', fontSize:10, marginTop:1 }}>
                            Created {r.created_at ? new Date(r.created_at).toLocaleDateString() : 'Unknown'}
                          </div>
                        </div>
                        <span style={{ color:'#f15e6c', fontSize:10, fontWeight:700, flexShrink:0, opacity: isSel ? 1 : 0.4 }}>
                          DELETE
                        </span>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Cache & History */}
        <div className="sp-settings-section">
          <p className="sp-settings-title">Cache & History</p>
          <div className="sp-settings-row">
            <div style={{ display:'flex', flexDirection:'column' }}>
              <span className="sp-settings-key" style={{ color:'#fff', fontWeight:700 }}>Recently Played History</span>
              <span style={{ fontSize:11, color:'#b3b3b3', marginTop:2 }}>Clear your recently played songs history cache.</span>
            </div>
            <button
              onClick={handleClearHistory}
              style={{ display:'flex',alignItems:'center',gap:6,background:'none',border:'1px solid rgba(241,94,108,0.2)',color:'#f15e6c',padding:'8px 16px',borderRadius:8,cursor:'pointer',fontWeight:700,fontSize:12 }}
            >
              Clear History
            </button>
          </div>
          <div className="sp-settings-row" style={{ borderBottom:'none' }}>
            <div style={{ display:'flex', flexDirection:'column' }}>
              <span className="sp-settings-key" style={{ color:'#fff', fontWeight:700 }}>Application Web Cache</span>
              <span style={{ fontSize:11, color:'#b3b3b3', marginTop:2 }}>Clear images, network audio streams, and web view temp data.</span>
            </div>
            <button
              onClick={handleClearCache}
              style={{ display:'flex',alignItems:'center',gap:6,background:'none',border:'1px solid rgba(255,255,255,0.2)',color:'#b3b3b3',padding:'8px 16px',borderRadius:8,cursor:'pointer',fontWeight:700,fontSize:12 }}
            >
              Clear Cache
            </button>
          </div>
        </div>

        {/* Export/Import Library */}
        <div className="sp-settings-section">
          <p className="sp-settings-title">Backup & Restore</p>
          <div className="sp-settings-row">
            <div style={{ display:'flex', flexDirection:'column' }}>
              <span className="sp-settings-key" style={{ color:'#fff', fontWeight:700 }}>Export Library</span>
              <span style={{ fontSize:11, color:'#b3b3b3', marginTop:2 }}>Save your entire library, playlists, and history as a JSON backup file.</span>
            </div>
            <button
              onClick={async () => {
                try {
                  const data = await window.electronAPI?.exportLibrary();
                  if (data) {
                    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `music-library-backup-${new Date().toISOString().slice(0,10)}.json`;
                    a.click();
                    URL.revokeObjectURL(url);
                    window.showToast?.('Library exported successfully', 'success');
                  }
                } catch (e) {
                  window.showToast?.(`Export failed: ${e.message}`, 'error');
                }
              }}
              style={{ display:'flex',alignItems:'center',gap:6,background:'none',border:'1px solid rgba(29,185,84,0.3)',color:'#1db954',padding:'8px 16px',borderRadius:8,cursor:'pointer',fontWeight:700,fontSize:12 }}
            >
              <Download size={14}/> Export
            </button>
          </div>
          <div className="sp-settings-row" style={{ borderBottom:'none' }}>
            <div style={{ display:'flex', flexDirection:'column' }}>
              <span className="sp-settings-key" style={{ color:'#fff', fontWeight:700 }}>Import Library</span>
              <span style={{ fontSize:11, color:'#b3b3b3', marginTop:2 }}>Restore from a previously exported JSON backup file. Existing songs will not be duplicated.</span>
            </div>
            <button
              onClick={async () => {
                try {
                  const input = document.createElement('input');
                  input.type = 'file';
                  input.accept = '.json';
                  input.onchange = async (e) => {
                    const file = e.target.files[0];
                    if (!file) return;
                    const text = await file.text();
                    const data = JSON.parse(text);
                    const result = await window.electronAPI?.importLibrary(data);
                    if (result) {
                      window.showToast?.(`Imported ${result.imported} new songs`, 'success');
                      useLibraryStore.getState().loadLibrary();
                      useLibraryStore.getState().loadPlaylists();
                    }
                  };
                  input.click();
                } catch (e) {
                  window.showToast?.(`Import failed: ${e.message}`, 'error');
                }
              }}
              style={{ display:'flex',alignItems:'center',gap:6,background:'none',border:'1px solid rgba(255,255,255,0.2)',color:'#b3b3b3',padding:'8px 16px',borderRadius:8,cursor:'pointer',fontWeight:700,fontSize:12 }}
            >
              <Folder size={14}/> Import
            </button>
          </div>
        </div>

        {/* Binaries */}
        <div className="sp-settings-section">
          <p className="sp-settings-title">System Binaries</p>
          <div className="sp-settings-row">
            <span className="sp-settings-key">yt-dlp version</span>
            <span className="sp-mono">{ytdlpVer}</span>
          </div>
          <div className="sp-settings-row">
            <span className="sp-settings-key">ffmpeg path</span>
            <span className="sp-mono">{ffmpegP}</span>
          </div>
          <div className="sp-settings-row" style={{ borderBottom:'none' }}>
            <span className="sp-settings-key">Update yt-dlp</span>
            <button
              onClick={updateYt}
              disabled={updating}
              style={{ display:'flex',alignItems:'center',gap:6,background:'none',border:'1px solid rgba(255,255,255,0.2)',color:'#b3b3b3',padding:'8px 16px',borderRadius:8,cursor:'pointer',fontWeight:700,fontSize:12 }}
            >
              <RefreshCw size={13} style={updating ? { animation:'spin 0.9s linear infinite' } : {}} />
              {updating ? 'Updating…' : 'Update Now'}
            </button>
          </div>
        </div>

        {/* Application Updates */}
        <div className="sp-settings-section">
          <p className="sp-settings-title">Application Updates</p>
          <div className="sp-settings-row">
            <span className="sp-settings-key">App version</span>
            <span className="sp-mono">{appVersion ? `v${appVersion}` : 'Loading…'}</span>
          </div>
          
          {updateInfo && updateInfo.updateAvailable && (
            <div style={{ background: 'rgba(29, 185, 84, 0.1)', border: '1px solid rgba(29, 185, 84, 0.3)', padding: 12, borderRadius: 8, marginTop: 10, marginBottom: 10 }}>
              <p style={{ margin: 0, fontWeight: 700, color: '#1db954', fontSize: 13 }}>New Update Available: v{updateInfo.version}</p>
              {updateInfo.releaseNotes && (
                <pre style={{ margin: '8px 0', fontSize: 11, color: '#b3b3b3', whiteSpace: 'pre-wrap', maxHeight: 80, overflowY: 'auto', background: 'rgba(0,0,0,0.2)', padding: 8, borderRadius: 4, fontFamily: 'monospace' }}>
                  {updateInfo.releaseNotes}
                </pre>
              )}
              {updatingApp ? (
                <div style={{ marginTop: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#b3b3b3', marginBottom: 4 }}>
                    <span>Downloading update...</span>
                    <span>{updateProgress}%</span>
                  </div>
                  <div style={{ width: '100%', height: 6, background: 'rgba(255,255,255,0.1)', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{ width: `${updateProgress}%`, height: '100%', background: '#1db954', transition: 'width 0.2s ease' }}></div>
                  </div>
                </div>
              ) : (
                <button
                  onClick={installAppUpdate}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#1db954', border: 'none', color: '#fff', padding: '8px 16px', borderRadius: 8, cursor: 'pointer', fontWeight: 700, fontSize: 12, marginTop: 8 }}
                >
                  <Download size={13} /> Download & Install Update
                </button>
              )}
            </div>
          )}

          <div className="sp-settings-row" style={{ borderBottom: 'none' }}>
            <span className="sp-settings-key">Check for updates</span>
            <button
              onClick={checkAppUpdate}
              disabled={checkingUpdate || updatingApp}
              style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: '1px solid rgba(255,255,255,0.2)', color: '#b3b3b3', padding: '8px 16px', borderRadius: 8, cursor: 'pointer', fontWeight: 700, fontSize: 12 }}
            >
              <RefreshCw size={13} style={checkingUpdate ? { animation: 'spin 0.9s linear infinite' } : {}} />
              {checkingUpdate ? 'Checking…' : 'Check Now'}
            </button>
          </div>
        </div>

        {/* Keyboard shortcuts */}
        <div className="sp-settings-section">
          <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4 }}>
            <Key size={14} color="#1db954"/>
            <p className="sp-settings-title" style={{ margin:0 }}>Keyboard Shortcuts</p>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'8px 16px' }}>
            {SHORTCUTS.map(([key, desc]) => (
              <div key={key} className="sp-settings-row" style={{ borderBottom:'none', padding:'4px 0' }}>
                <span className="sp-settings-key">{desc}</span>
                <kbd>{key}</kbd>
              </div>
            ))}
          </div>
        </div>


      </div>
    </div>
  );
}
