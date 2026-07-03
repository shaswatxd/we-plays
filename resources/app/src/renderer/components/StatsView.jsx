import React, { useEffect, useRef, useState } from 'react';
import { usePlayerStore } from '../store/playerStore';
import { useLibraryStore } from '../store/libraryStore';
import {
  BarChart2, Music, List, Clock, TrendingUp,
  Headphones, Calendar, Play
} from 'lucide-react';
import SpotifyHeart from './SpotifyHeart';

function StatCard({ icon, label, value, sub, color = '#1db954' }) {
  return (
    <div className="sp-stat-card">
      <div className="sp-stat-icon" style={{ background: `${color}22`, color }}>
        {icon}
      </div>
      <div className="sp-stat-body">
        <p className="sp-stat-value">{value}</p>
        <p className="sp-stat-label">{label}</p>
        {sub && <p className="sp-stat-sub">{sub}</p>}
      </div>
    </div>
  );
}

function BarChartCanvas({ data, labelKey, valueKey, color = '#1db954' }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    try {
      const canvas = canvasRef.current;
      if (!canvas || !data.length) return;
      const ctx = canvas.getContext('2d');
      const dpr = window.devicePixelRatio || 1;
      const W = canvas.offsetWidth * dpr;
      const H = canvas.offsetHeight * dpr;
      if (W <= 0 || H <= 0) return;

      canvas.width = W;
      canvas.height = H;
      ctx.scale(dpr, dpr);

      const cW = canvas.offsetWidth;
      const cH = canvas.offsetHeight;
      if (cW <= 0 || cH <= 0) return;

      const max = Math.max(...data.map(d => d[valueKey]), 1);
      const barW = Math.max(0, (cW - 40) / data.length - 8);
      const padLeft = 20, padBottom = 30, padTop = 16;
      const chartH = Math.max(0, cH - padBottom - padTop);

      ctx.clearRect(0, 0, cW, cH);

      // Grid lines
      for (let i = 0; i <= 4; i++) {
        const y = padTop + (chartH / 4) * i;
        ctx.strokeStyle = 'rgba(255,255,255,0.04)';
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(padLeft, y); ctx.lineTo(cW - padLeft, y); ctx.stroke();
      }

      data.forEach((d, i) => {
        const x = padLeft + i * (barW + 8);
        const barH = Math.max(0, (d[valueKey] / max) * chartH);
        const y = padTop + chartH - barH;

        if (barW <= 0 || barH <= 0) return;

        const grad = ctx.createLinearGradient(x, y + barH, x, y);
        grad.addColorStop(0, color + 'cc');
        grad.addColorStop(1, color + '44');
        ctx.fillStyle = grad;
        ctx.shadowBlur = 8;
        ctx.shadowColor = color + '55';
        ctx.beginPath();
        const radius = Math.min(3, barW / 2, barH / 2);
        ctx.roundRect(x, y, barW, barH, [radius, radius, 0, 0]);
        ctx.fill();
        ctx.shadowBlur = 0;

        // Label
        ctx.fillStyle = 'rgba(255,255,255,0.4)';
        ctx.font = `10px var(--font-body, system-ui)`;
        ctx.textAlign = 'center';
        const label = String(d[labelKey]).slice(-5);
        ctx.fillText(label, x + barW / 2, cH - 8);

        // Value on top
        if (d[valueKey] > 0) {
          ctx.fillStyle = 'rgba(255,255,255,0.7)';
          ctx.font = `bold 10px var(--font-body, system-ui)`;
          ctx.fillText(d[valueKey], x + barW / 2, y - 4);
        }
      });
    } catch (err) {
      console.error('BarChartCanvas render error:', err);
    }
  }, [data, labelKey, valueKey, color]);

  return <canvas ref={canvasRef} style={{ width:'100%', height:'100%', display:'block' }}/>;
}

function fmtTime(secs) {
  if (!secs) return '0 min';
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m} min`;
}

export default function StatsView() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const data = await window.electronAPI?.getListeningStats();
      setStats(data);
    } catch(e) {
      console.error('Stats error:', e);
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:300 }}>
      <div style={{ width:28, height:28, border:'3px solid #1db954', borderTopColor:'transparent', borderRadius:'50%', animation:'spin 0.8s linear infinite' }}/>
    </div>
  );

  if (!stats) return (
    <div className="sp-empty">
      <p className="sp-empty-title">Could not load stats</p>
    </div>
  );

  const topSongsChart = (stats?.topSongs || []).map(s => ({ label: s.title?.slice(0,12) || '?', plays: s.play_count }));
  const topArtistsChart = (stats?.topArtists || []).map(a => ({ label: a.artist?.slice(0,10) || '?', plays: a.total_plays }));
  const dailyChart = (() => {
    const days = [];
    const dailyListening = stats?.dailyListening || [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const day = d.toISOString().slice(0,10);
      const found = dailyListening.find(x => x.day === day);
      days.push({ label: d.toLocaleDateString('en', { weekday:'short' }), plays: found?.plays || 0 });
    }
    return days;
  })();

  return (
    <div className="sp-stats-view" style={{ padding: 24 }}>
      <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:28 }}>
        <BarChart2 size={24} color="#1db954"/>
        <h1 style={{ fontSize:28, fontWeight:900 }}>Listening Stats</h1>
        <button
          onClick={load}
          style={{ marginLeft:'auto', background:'none', border:'1px solid rgba(255,255,255,0.15)', color:'#b3b3b3', borderRadius:99, padding:'6px 14px', cursor:'pointer', fontSize:12, fontWeight:700 }}
        >
          Refresh
        </button>
      </div>

      {/* Summary cards */}
      <div className="sp-stat-cards">
        <StatCard icon={<Music size={20}/>} label="Songs" value={(stats?.totalSongs || 0).toLocaleString()} color="#1db954"/>
        <StatCard icon={<SpotifyHeart size={20} active={true} />} label="Favorites" value={(stats?.totalFavorites || 0).toLocaleString()} color="#1db954"/>
        <StatCard icon={<List size={20}/>} label="Playlists" value={(stats?.totalPlaylists || 0).toLocaleString()} color="#3b82f6"/>
        <StatCard icon={<TrendingUp size={20}/>} label="Total Plays" value={(stats?.totalPlays || 0).toLocaleString()} color="#f59e0b"/>
        <StatCard icon={<Clock size={20}/>} label="Listening Time" value={fmtTime(stats?.totalDuration)} color="#8b5cf6"/>
        <StatCard icon={<Headphones size={20}/>} label="Played Today" value={(stats?.playedToday || 0).toLocaleString()} color="#06b6d4"/>
      </div>

      <div className="sp-stats-grid">
        {/* Daily activity */}
        <div className="sp-stats-section">
          <div className="sp-stats-section-header">
            <Calendar size={16} color="#1db954"/>
            <h3>Last 7 Days</h3>
          </div>
          <div className="sp-stats-chart">
            {dailyChart.every(d => d.plays === 0)
              ? <p style={{ color:'#6a6a6a', textAlign:'center', paddingTop:40 }}>No listening history yet</p>
              : <BarChartCanvas data={dailyChart} labelKey="label" valueKey="plays" color="#1db954"/>
            }
          </div>
        </div>

        {/* Top songs */}
        <div className="sp-stats-section">
          <div className="sp-stats-section-header">
            <TrendingUp size={16} color="#f59e0b"/>
            <h3>Top Songs</h3>
          </div>
          {(stats?.topSongs || []).length === 0
            ? <p style={{ color:'#6a6a6a', padding:'20px 0' }}>Play some songs to see your top tracks</p>
            : (stats?.topSongs || []).map((s, i) => (
                <div key={s.id} className="sp-stats-song-row">
                  <span className="sp-stats-rank" style={{ color: i === 0 ? '#f59e0b' : i === 1 ? '#9ca3af' : i === 2 ? '#b45309' : '#6a6a6a' }}>
                    {i + 1}
                  </span>
                  {s.thumbnail && <img src={s.thumbnail} alt="" style={{ width:32,height:32,borderRadius:4,objectFit:'cover',flexShrink:0 }}/>}
                  <div style={{ flex:1, minWidth:0 }}>
                    <p style={{ fontSize:13, fontWeight:600, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{s.title}</p>
                    <p style={{ fontSize:11, color:'#b3b3b3' }}>{s.artist || 'Unknown'}</p>
                  </div>
                  <div style={{ display:'flex', alignItems:'center', gap:4 }}>
                    <Play size={10} color="#1db954"/>
                    <span style={{ fontSize:12, color:'#1db954', fontWeight:700 }}>{s.play_count}</span>
                  </div>
                </div>
              ))
          }
        </div>

        {/* Top artists */}
        <div className="sp-stats-section">
          <div className="sp-stats-section-header">
            <Headphones size={16} color="#8b5cf6"/>
            <h3>Top Artists</h3>
          </div>
          {(stats?.topArtists || []).length === 0
            ? <p style={{ color:'#6a6a6a', padding:'20px 0' }}>No artist data yet</p>
            : (stats?.topArtists || []).map((a, i) => (
                <div key={a.artist} className="sp-stats-artist-row">
                  <span className="sp-stats-rank" style={{ color: i === 0 ? '#8b5cf6' : '#6a6a6a' }}>{i+1}</span>
                  <div style={{ flex:1, minWidth:0 }}>
                    <p style={{ fontSize:13, fontWeight:600, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{a.artist}</p>
                    <p style={{ fontSize:11, color:'#b3b3b3' }}>{a.song_count} songs</p>
                  </div>
                  <div className="sp-stats-bar-wrap">
                    <div className="sp-stats-bar" style={{ width:`${Math.round((a.total_plays / (stats?.topArtists?.[0]?.total_plays || 1)) * 100)}%`, background:'#8b5cf6' }}/>
                  </div>
                  <span style={{ fontSize:12, color:'#8b5cf6', fontWeight:700, minWidth:28, textAlign:'right' }}>{a.total_plays}</span>
                </div>
              ))
          }
        </div>

        {/* Recently Added */}
        <div className="sp-stats-section">
          <div className="sp-stats-section-header">
            <Music size={16} color="#06b6d4"/>
            <h3>Recently Added</h3>
          </div>
          {(stats?.recentlyAdded || []).map((s, i) => (
            <div key={s.id} className="sp-stats-song-row">
              <span style={{ color:'#6a6a6a', fontSize:12, minWidth:16 }}>{i+1}</span>
              {s.thumbnail && <img src={s.thumbnail} alt="" style={{ width:32,height:32,borderRadius:4,objectFit:'cover',flexShrink:0 }}/>}
              <div style={{ flex:1, minWidth:0 }}>
                <p style={{ fontSize:13, fontWeight:600, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{s.title}</p>
                <p style={{ fontSize:11, color:'#b3b3b3' }}>{s.artist || 'Unknown'}</p>
              </div>
              <span style={{ fontSize:11, color:'#6a6a6a', whiteSpace:'nowrap' }}>
                {s.date_added ? new Date(s.date_added).toLocaleDateString() : '—'}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
