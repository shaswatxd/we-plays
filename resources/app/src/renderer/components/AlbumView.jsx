import React, { useMemo, useState } from 'react';
import { useLibraryStore } from '../store/libraryStore';
import { usePlayerStore } from '../store/playerStore';
import { Disc3, Play, Shuffle, Music } from 'lucide-react';
import SpSongRow from './SpSongRow';

function hslFromStr(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  return `hsl(${Math.abs(hash) % 360}, 50%, 35%)`;
}

function AlbumCard({ album, songs, onSelect }) {
  const cover = songs[0]?.thumbnail;
  return (
    <div className="sp-album-card" onClick={() => onSelect(album)}>
      <div className="sp-album-cover">
        {cover
          ? <img src={cover} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }}/>
          : <div style={{ width:'100%', height:'100%', background: hslFromStr(album), display:'flex', alignItems:'center', justifyContent:'center' }}>
              <Disc3 size={36} color="rgba(255,255,255,0.5)"/>
            </div>
        }
        <div className="sp-album-play-overlay">
          <Play size={24} fill="black" color="black" style={{ marginLeft:3 }}/>
        </div>
      </div>
      <p className="sp-album-name">{album}</p>
      <p className="sp-album-meta">{songs[0]?.artist || 'Unknown'} • {songs.length} songs</p>
    </div>
  );
}

function AlbumDetail({ album, songs, onBack }) {
  const { playPlaylist } = usePlayerStore();
  const totalDur = songs.reduce((a, s) => a + (s.duration || 0), 0);
  const fmtDur = (s) => {
    const m = Math.floor(s / 60); const sec = Math.floor(s % 60);
    return `${m}:${String(sec).padStart(2,'0')}`;
  };
  const totalStr = (() => {
    const m = Math.floor(totalDur / 60); const h = Math.floor(m / 60);
    return h > 0 ? `${h} hr ${m % 60} min` : `${m} min`;
  })();

  return (
    <div>
      <div className="sp-album-hero" style={{ background: `linear-gradient(135deg, ${hslFromStr(album)}, #0a0a0f)` }}>
        <button className="sp-ghost-btn" onClick={onBack} style={{ marginBottom:16, width:'fit-content', background:'rgba(0,0,0,0.3)', border:'none', color:'#fff' }}>← All Albums</button>
        <div style={{ display:'flex', gap:28, alignItems:'flex-end', flexWrap:'wrap' }}>
          <div className="sp-album-hero-cover">
            {songs[0]?.thumbnail
              ? <img src={songs[0].thumbnail} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }}/>
              : <div style={{ width:'100%',height:'100%',background:hslFromStr(album),display:'flex',alignItems:'center',justifyContent:'center' }}><Disc3 size={60} color="rgba(255,255,255,0.4)"/></div>
            }
          </div>
          <div>
            <p style={{ color:'#b3b3b3', fontSize:12, textTransform:'uppercase', fontWeight:700, letterSpacing:'0.1em' }}>Album</p>
            <h1 style={{ fontSize:36, fontWeight:900, margin:'8px 0 4px' }}>{album}</h1>
            <p style={{ color:'#b3b3b3', fontSize:14 }}>{songs[0]?.artist || 'Unknown'} • {songs.length} songs • {totalStr}</p>
            <div style={{ display:'flex', gap:12, marginTop:20 }}>
              <button className="sp-play-fab" onClick={() => playPlaylist(songs, 0)}>
                <Play size={22} fill="black" color="black" style={{ marginLeft:3 }}/>
              </button>
              <button className="sp-ghost-btn" onClick={() => {
                const l = [...songs];
                for (let i = l.length-1; i>0; i--) { const j=Math.floor(Math.random()*(i+1)); [l[i],l[j]]=[l[j],l[i]]; }
                playPlaylist(l, 0);
              }}>
                <Shuffle size={14}/> Shuffle
              </button>
            </div>
          </div>
        </div>
      </div>

      <div style={{ padding: '0 24px 24px 24px' }}>
        <div className="sp-table-header" style={{ marginTop:16 }}>
          <span style={{ textAlign:'center' }}>#</span>
          <span>Title</span>
          <span>Artist</span>
          <span style={{ textAlign:'right' }}>Duration</span>
        </div>
        {songs.map((s, i) => (
          <SpSongRow
            key={s.id}
            song={s}
            index={i}
            onClick={() => playPlaylist(songs, i)}
          />
        ))}
      </div>
    </div>
  );
}

export default function AlbumView() {
  const { songs } = useLibraryStore();
  const [selectedAlbum, setSelectedAlbum] = useState(null);
  const [search, setSearch] = useState('');

  const albumMap = useMemo(() => {
    const map = {};
    for (const s of songs) {
      const album = (s.album || 'Unknown Album').trim();
      if (!map[album]) map[album] = [];
      map[album].push(s);
    }
    return map;
  }, [songs]);

  const filtered = useMemo(() => {
    return Object.entries(albumMap)
      .filter(([name]) => name.toLowerCase().includes(search.toLowerCase()))
      .sort((a, b) => a[0].localeCompare(b[0]));
  }, [albumMap, search]);

  if (selectedAlbum && albumMap[selectedAlbum]) {
    return <AlbumDetail album={selectedAlbum} songs={albumMap[selectedAlbum]} onBack={() => setSelectedAlbum(null)} />;
  }

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:24 }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <Disc3 size={22} color="#1db954"/>
          <h1 style={{ fontSize:28, fontWeight:900 }}>Albums</h1>
          <span style={{ color:'#6a6a6a', fontSize:14 }}>({filtered.length})</span>
        </div>
        <input
          className="sp-search-input"
          placeholder="Search albums…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ width:200 }}
        />
      </div>

      {filtered.length === 0 ? (
        <div className="sp-empty">
          <div className="sp-empty-icon"><Disc3 size={28}/></div>
          <p className="sp-empty-title">No albums found</p>
          <p className="sp-empty-sub">Songs with album metadata will appear here.</p>
        </div>
      ) : (
        <div className="sp-album-grid">
          {filtered.map(([name, albumSongs]) => (
            <AlbumCard key={name} album={name} songs={albumSongs} onSelect={setSelectedAlbum} />
          ))}
        </div>
      )}
    </div>
  );
}
