import React, { useEffect, useRef, useState } from 'react';
import { usePlayerStore } from '../store/playerStore';
import { useLibraryStore } from '../store/libraryStore';
import {
  X, Music, Play, Pause, SkipBack, SkipForward,
  Shuffle, Repeat
} from 'lucide-react';
import SpotifyHeart from './SpotifyHeart';

const MODES = ['waves', 'bars', 'circular'];

export default function Visualizer({ onClose }) {
  const canvasRef = useRef(null);
  const {
    currentSong, isPlaying, progress, duration,
    isShuffled, repeatMode, togglePlay, nextTrack,
    previousTrack, seekTo, toggleShuffle, toggleRepeat
  } = usePlayerStore();
  const { toggleFavorite } = useLibraryStore();
  const [mode, setMode] = useState('waves');

  const isFav = currentSong?.is_favorite === 1;

  const handleFav = async () => {
    if (!currentSong?.id) return;
    const v = await toggleFavorite(currentSong.id);
    usePlayerStore.setState(s => ({
      currentSong: s.currentSong ? { ...s.currentSong, is_favorite: v } : null
    }));
  };

  const fmt = (s) => {
    if (!s || isNaN(s)) return '0:00';
    return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
  };

  const pct = duration > 0 ? (progress / duration) * 100 : 0;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let animId;
    let W = canvas.width  = canvas.offsetWidth  * window.devicePixelRatio;
    let H = canvas.height = canvas.offsetHeight * window.devicePixelRatio;

    const ro = new ResizeObserver(() => {
      W = canvas.width  = canvas.offsetWidth  * window.devicePixelRatio;
      H = canvas.height = canvas.offsetHeight * window.devicePixelRatio;
    });
    ro.observe(canvas);

    const waves = Array.from({ length: 5 }, (_, i) => ({
      phase: Math.random() * 100,
      amp:   20 + Math.random() * 35,
      freq:  0.0015 + Math.random() * 0.002,
      speed: 0.02 + Math.random() * 0.03,
      color: i === 0 ? '#1db954' : `hsla(${130 + i*28},70%,55%,${0.08 + (5-i)*0.04})`,
      lw:    i === 0 ? 2.5 : 1.2
    }));

    const pts = Array.from({ length: 60 }, () => ({
      x: Math.random()*W, y: Math.random()*H,
      r: 0.7+Math.random()*2, vx: (-0.3+Math.random()*0.6),
      vy: -0.2-Math.random()*0.8, o: 0.05+Math.random()*0.3
    }));

    const fakeData = Array.from({ length: 32 }, () => Math.random());

    let time = 0;

    const drawBars = (af) => {
      ctx.clearRect(0,0,W,H);
      const barCount = 32;
      const barW = (W / barCount) * 0.7;
      const gap = (W / barCount) * 0.3;

      for (let i = 0; i < barCount; i++) {
        const val = fakeData[i] * af;
        const barH = val * H * 0.7;
        const x = i * (barW + gap) + gap/2;
        const y = H - barH;

        const gradient = ctx.createLinearGradient(x, H, x, y);
        gradient.addColorStop(0, 'rgba(29,185,84,0.8)');
        gradient.addColorStop(1, `hsla(${130 + i * 3}, 70%, 55%, 0.6)`);

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.roundRect(x, y, barW, barH, [barW/3, barW/3, 0, 0]);
        ctx.fill();

        ctx.shadowBlur = 8;
        ctx.shadowColor = 'rgba(29,185,84,0.3)';
        ctx.fill();
        ctx.shadowBlur = 0;

        fakeData[i] = 0.1 + Math.random() * 0.9 * af;
      }
    };

    const drawCircular = (af) => {
      ctx.clearRect(0,0,W,H);
      const cx = W / 2;
      const cy = H / 2;
      const baseR = Math.min(W, H) * 0.2;
      const barCount = 64;

      for (let i = 0; i < barCount; i++) {
        const angle = (i / barCount) * Math.PI * 2 - Math.PI / 2;
        const val = (0.3 + Math.random() * 0.7) * af;
        const barLen = val * baseR * 1.2;

        const x1 = cx + Math.cos(angle) * baseR;
        const y1 = cy + Math.sin(angle) * baseR;
        const x2 = cx + Math.cos(angle) * (baseR + barLen);
        const y2 = cy + Math.sin(angle) * (baseR + barLen);

        const hue = 130 + (i / barCount) * 60;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.strokeStyle = `hsla(${hue}, 70%, 55%, ${0.4 + val * 0.6})`;
        ctx.lineWidth = 2.5;
        ctx.lineCap = 'round';
        ctx.stroke();
      }

      ctx.beginPath();
      ctx.arc(cx, cy, baseR - 2, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(29,185,84,0.3)';
      ctx.lineWidth = 1;
      ctx.stroke();

      const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, baseR);
      glow.addColorStop(0, `rgba(29,185,84,${0.08 * af})`);
      glow.addColorStop(1, 'rgba(29,185,84,0)');
      ctx.fillStyle = glow;
      ctx.fill();
    };

    const draw = () => {
      const af = isPlaying ? 1 : 0.05;
      time += 0.02;

      if (mode === 'bars') {
        drawBars(af);
      } else if (mode === 'circular') {
        drawCircular(af);
      } else {
        ctx.clearRect(0,0,W,H);

        waves.forEach(w => {
          ctx.beginPath(); ctx.strokeStyle = w.color; ctx.lineWidth = w.lw;
          if (w.color === '#1db954') { ctx.shadowBlur=16; ctx.shadowColor='rgba(29,185,84,0.5)'; }
          else ctx.shadowBlur=0;
          for (let x=0; x<=W; x+=2) {
            const env = Math.sin((x/W)*Math.PI);
            const y = H/2 + Math.sin(x*w.freq + w.phase)*w.amp*af*env;
            x===0 ? ctx.moveTo(x,y) : ctx.lineTo(x,y);
          }
          ctx.stroke(); ctx.shadowBlur=0; w.phase += w.speed*(isPlaying?1:0.15);
        });

        pts.forEach(p => {
          ctx.beginPath(); ctx.arc(p.x,p.y,p.r,0,Math.PI*2);
          ctx.fillStyle = `rgba(29,185,84,${p.o*af})`; ctx.fill();
          p.x += p.vx*af; p.y += p.vy*af;
          if (p.y<0) { p.y=H; p.x=Math.random()*W; }
          if (p.x<0||p.x>W) p.x=Math.random()*W;
        });
      }

      animId = requestAnimationFrame(draw);
    };
    draw();
    return () => { cancelAnimationFrame(animId); ro.disconnect(); };
  }, [isPlaying, mode]);

  return (
    <div className="sp-visualizer" onClick={onClose}>
      <button
        onClick={e => { e.stopPropagation(); onClose(); }}
        style={{ position:'absolute',top:72,right:20,width:40,height:40,borderRadius:'50%',background:'rgba(255,255,255,0.1)',border:'1px solid rgba(255,255,255,0.15)',color:'#fff',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',transition:'background 0.2s',zIndex:2,padding:0,WebkitAppRegion:'no-drag' }}
      ><X size={20}/></button>

      <div style={{ position:'absolute',top:72,left:20,display:'flex',gap:6,zIndex:2,WebkitAppRegion:'no-drag' }} onClick={e=>e.stopPropagation()}>
        {MODES.map(m => (
          <button
            key={m}
            onClick={() => setMode(m)}
            style={{ padding:'6px 14px',borderRadius:99,border: mode===m ? '1px solid #1db954' : '1px solid rgba(255,255,255,0.15)',background: mode===m ? 'rgba(29,185,84,0.2)' : 'rgba(255,255,255,0.06)',color: mode===m ? '#1db954' : '#b3b3b3',cursor:'pointer',fontSize:11,fontWeight:700,textTransform:'capitalize',transition:'all 0.15s' }}
          >
            {m}
          </button>
        ))}
      </div>

      {currentSong ? (
        <div style={{ display:'flex',flexDirection:'column',alignItems:'center',textAlign:'center',maxWidth:520,width:'100%',padding:'0 24px',zIndex:1 }}>
          <div style={{ width:200,height:200,borderRadius:16,overflow:'hidden',border:'1px solid rgba(255,255,255,0.1)',boxShadow:'0 20px 60px rgba(0,0,0,0.7),0 0 40px rgba(29,185,84,0.15)',marginBottom:28,flexShrink:0 }}>
            {currentSong.thumbnail
              ? <img src={currentSong.thumbnail} alt="" style={{ width:'100%',height:'100%',objectFit:'cover' }}/>
              : <div style={{ width:'100%',height:'100%',background:'#242424',display:'flex',alignItems:'center',justifyContent:'center' }}><Music size={48} color="#6a6a6a"/></div>
            }
          </div>
          <h2 style={{ fontSize:22,fontWeight:800,color:'#fff',marginBottom:6 }}>{currentSong.title}</h2>
          <p style={{ fontSize:14,color:'#b3b3b3',marginBottom:20 }}>{currentSong.artist || 'Unknown Artist'}</p>
          <canvas ref={canvasRef} style={{ width:'100%',maxWidth:520,height:140,marginBottom:20 }}/>

          {/* ── Player Controls ── */}
          <div style={{ width:'100%',display:'flex',flexDirection:'column',alignItems:'center',gap:12 }} onClick={e => e.stopPropagation()}>
            {/* Control buttons */}
            <div style={{ display:'flex',alignItems:'center',gap:20 }}>
              <button
                onClick={handleFav}
                style={{ background:'none',border:'none',color: isFav ? '#1db954' : '#b3b3b3',cursor:'pointer',padding:6,borderRadius:'50%',display:'flex',alignItems:'center',transition:'all 0.15s' }}
                title={isFav ? 'Unlike' : 'Like'}
              >
                <SpotifyHeart size={20} active={isFav} />
              </button>
              <button
                onClick={toggleShuffle}
                style={{ background:'none',border:'none',color: isShuffled ? '#1db954' : '#b3b3b3',cursor:'pointer',padding:6,borderRadius:'50%',display:'flex',alignItems:'center',transition:'all 0.15s' }}
                title="Shuffle"
              >
                <Shuffle size={20} />
              </button>
              <button
                onClick={previousTrack}
                style={{ background:'none',border:'none',color:'#fff',cursor:'pointer',padding:8,borderRadius:'50%',display:'flex',alignItems:'center',transition:'transform 0.15s' }}
                title="Previous"
              >
                <SkipBack size={24} fill="currentColor" />
              </button>
              <button
                onClick={togglePlay}
                style={{ width:52,height:52,background:'#fff',border:'none',borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',color:'#000',transition:'transform 0.2s, box-shadow 0.2s',boxShadow:'0 4px 16px rgba(255,255,255,0.2)' }}
                title={isPlaying ? 'Pause' : 'Play'}
              >
                {isPlaying
                  ? <Pause size={24} fill="black" color="black" />
                  : <Play size={24} fill="black" color="black" style={{ marginLeft: 3 }} />
                }
              </button>
              <button
                onClick={() => nextTrack(true)}
                style={{ background:'none',border:'none',color:'#fff',cursor:'pointer',padding:8,borderRadius:'50%',display:'flex',alignItems:'center',transition:'transform 0.15s' }}
                title="Next"
              >
                <SkipForward size={24} fill="currentColor" />
              </button>
              <button
                onClick={toggleRepeat}
                style={{ background:'none',border:'none',color: repeatMode !== 'off' ? '#1db954' : '#b3b3b3',cursor:'pointer',padding:6,borderRadius:'50%',display:'flex',alignItems:'center',transition:'all 0.15s',position:'relative' }}
                title={`Repeat: ${repeatMode}`}
              >
                <Repeat size={20} />
                {repeatMode === 'one' && (
                  <span style={{ position:'absolute',top:-2,right:-2,width:14,height:14,borderRadius:'50%',background:'#1db954',color:'#000',fontSize:8,fontWeight:900,display:'flex',alignItems:'center',justifyContent:'center' }}>1</span>
                )}
              </button>
            </div>

            {/* Seek bar */}
            <div style={{ width:'100%',display:'flex',alignItems:'center',gap:10 }}>
              <span style={{ fontSize:11,fontFamily:'ui-monospace, Consolas, monospace',color:'#b3b3b3',minWidth:36,textAlign:'right' }}>{fmt(progress)}</span>
              <div style={{ flex:1,position:'relative',height:4,cursor:'pointer',borderRadius:99 }} className="sp-progress-wrap">
                <div style={{ position:'absolute',inset:0,background:'rgba(255,255,255,0.2)',borderRadius:99,overflow:'hidden' }}>
                  <div style={{ height:'100%',background:'#fff',borderRadius:99,width:`${pct}%`,transition:'width 0.15s linear' }} />
                </div>
                <input
                  type="range"
                  min={0} max={duration || 100} step={0.1}
                  value={progress}
                  onChange={e => seekTo(parseFloat(e.target.value))}
                  style={{ position:'absolute',inset:'-8px 0',width:'100%',opacity:0,cursor:'pointer',zIndex:2 }}
                />
              </div>
              <span style={{ fontSize:11,fontFamily:'ui-monospace, Consolas, monospace',color:'#b3b3b3',minWidth:36,textAlign:'left' }}>{fmt(duration)}</span>
            </div>
          </div>
        </div>
      ) : (
        <div style={{ display:'flex',flexDirection:'column',alignItems:'center',gap:12,color:'#6a6a6a' }}>
          <Music size={48} style={{ opacity:.3 }}/>
          <p>No track playing</p>
        </div>
      )}
    </div>
  );
}
