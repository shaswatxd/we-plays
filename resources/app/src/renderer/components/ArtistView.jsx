import React, { useMemo, useState } from 'react';
import { useLibraryStore } from '../store/libraryStore';
import { usePlayerStore } from '../store/playerStore';
import { Music, Play, Shuffle, Users } from 'lucide-react';

function hslFromStr(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  return `hsl(${Math.abs(hash) % 360}, 55%, 40%)`;
}

function ArtistCard({ name, songs, onSelect }) {
  const topAlbum = songs[0]?.thumbnail;
  const color = hslFromStr(name);
  return (
    <div className="sp-artist-card" onClick={() => onSelect(name)}>
      <div className="sp-artist-avatar" style={{ background: topAlbum ? 'transparent' : color }}>
        {topAlbum
          ? <img src={topAlbum} alt="" style={{ width:'100%', height:'100%', objectFit:'cover', borderRadius:'50%' }}/>
          : <span>{name.charAt(0).toUpperCase()}</span>
        }
      </div>
      <p className="sp-artist-name">{name}</p>
      <p className="sp-artist-meta">{songs.length} song{songs.length !== 1 ? 's' : ''}</p>
    </div>
  );
}

function ArtistDetail({ name, songs, onBack }) {
  const { playPlaylist } = usePlayerStore();
  const albums = useMemo(() => {
    const map = {};
    for (const s of songs) {
      const album = s.album || 'Singles';
      if (!map[album]) map[album] = [];
      map[album].push(s);
    }
    return map;
  }, [songs]);

  return (
    <div>
      {/* Artist hero */}
      <div className="sp-artist-hero" style={{ background: `linear-gradient(135deg, ${hslFromStr(name)}, #0a0a0f)` }}>
        <button className="sp-ghost-btn" onClick={onBack} style={{ marginBottom:16, width:'fit-content', background:'rgba(0,0,0,0.3)', border:'none', color:'#fff' }}>
          ← All Artists
        </button>
        <div className="sp-artist-hero-avatar">
          {songs[0]?.thumbnail
            ? <img src={songs[0].thumbnail} alt="" style={{ width:'100%',height:'100%',objectFit:'cover',borderRadius:'50%' }}/>
            : <span style={{ fontSize:56 }}>{name.charAt(0).toUpperCase()}</span>
          }
        </div>
        <h1 style={{ fontSize:40, fontWeight:900, margin:'16px 0 4px' }}>{name}</h1>
        <p style={{ color:'#b3b3b3', fontSize:14 }}>{songs.length} songs</p>
        <div style={{ display:'flex', gap:12, marginTop:20 }}>
          <button className="sp-play-fab" onClick={() => playPlaylist(songs, 0)}>
            <Play size={22} fill="black" color="black" style={{ marginLeft:3 }}/>
          </button>
          <button className="sp-ghost-btn" onClick={() => {
            const l = [...songs];
            for (let i = l.length-1; i > 0; i--) { const j = Math.floor(Math.random()*(i+1)); [l[i],l[j]]=[l[j],l[i]]; }
            playPlaylist(l, 0);
          }}>
            <Shuffle size={14}/> Shuffle
          </button>
        </div>
      </div>

      {/* Albums */}
      <div style={{ padding: '0 24px 24px 24px' }}>
        {Object.entries(albums).map(([album, albumSongs]) => (
          <div key={album} style={{ marginBottom:32 }}>
            <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:12 }}>
              <div style={{ width:40, height:40, borderRadius:4, overflow:'hidden', flexShrink:0 }}>
                {albumSongs[0]?.thumbnail
                  ? <img src={albumSongs[0].thumbnail} alt="" style={{ width:'100%',height:'100%',objectFit:'cover' }}/>
                  : <div style={{ width:'100%',height:'100%',background:hslFromStr(album),display:'flex',alignItems:'center',justifyContent:'center' }}><Music size={16}/></div>
                }
              </div>
              <div>
                <p style={{ fontWeight:700, fontSize:15 }}>{album}</p>
                <p style={{ color:'#b3b3b3', fontSize:11 }}>{albumSongs.length} songs</p>
              </div>
              <button className="sp-ghost-btn" style={{ marginLeft:'auto' }} onClick={() => playPlaylist(albumSongs, 0)}>
                <Play size={12} fill="currentColor"/> Play album
              </button>
            </div>
            <div className="sp-table-header">
              <span style={{ textAlign:'center' }}>#</span>
              <span>Title</span>
              <span>Duration</span>
            </div>
            {albumSongs.map((s, i) => {
              const { currentSong, isPlaying } = usePlayerStore.getState();
              const isActive = currentSong?.id === s.id;
              return (
                <div
                  key={s.id}
                  className={`sp-song-row${isActive ? ' active' : ''}`}
                  style={{ padding:'8px 16px', cursor:'pointer' }}
                  onClick={() => playPlaylist(albumSongs, i)}
                >
                  <div className="sp-row-num-cell">
                    {isActive && isPlaying
                      ? <div className="eq-bars"><span/><span/><span/></div>
                      : <span className="sp-row-num">{i+1}</span>
                    }
                  </div>
                  <div style={{ display:'flex', alignItems:'center', gap:10, flex:1, minWidth:0 }}>
                    {s.thumbnail && <img src={s.thumbnail} alt="" style={{ width:32,height:32,borderRadius:4,objectFit:'cover',flexShrink:0 }}/>}
                    <div style={{ minWidth:0 }}>
                      <p className="sp-song-title">{s.title}</p>
                    </div>
                  </div>
                  <span style={{ color:'#b3b3b3', fontSize:13, fontFamily:'monospace' }}>
                    {s.duration ? `${Math.floor(s.duration/60)}:${String(Math.floor(s.duration%60)).padStart(2,'0')}` : '—'}
                  </span>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function ArtistView() {
  const { songs } = useLibraryStore();
  const [selectedArtist, setSelectedArtist] = useState(null);
  const [search, setSearch] = useState('');

  const artistMap = useMemo(() => {
    const map = {};
    for (const s of songs) {
      const artist = (s.artist || 'Unknown Artist').trim();
      if (!map[artist]) map[artist] = [];
      map[artist].push(s);
    }
    return map;
  }, [songs]);

  const filtered = useMemo(() => {
    return Object.entries(artistMap)
      .filter(([name]) => name.toLowerCase().includes(search.toLowerCase()))
      .sort((a, b) => a[0].localeCompare(b[0]));
  }, [artistMap, search]);

  if (selectedArtist && artistMap[selectedArtist]) {
    return <ArtistDetail name={selectedArtist} songs={artistMap[selectedArtist]} onBack={() => setSelectedArtist(null)} />;
  }

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:24 }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <Users size={22} color="#1db954"/>
          <h1 style={{ fontSize:28, fontWeight:900 }}>Artists</h1>
          <span style={{ color:'#6a6a6a', fontSize:14 }}>({filtered.length})</span>
        </div>
        <input
          className="sp-search-input"
          placeholder="Search artists…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ width:200 }}
        />
      </div>

      {filtered.length === 0 ? (
        <div className="sp-empty">
          <div className="sp-empty-icon"><Users size={28}/></div>
          <p className="sp-empty-title">No artists found</p>
          <p className="sp-empty-sub">Import music or download songs to see artists here.</p>
        </div>
      ) : (
        <div className="sp-artist-grid">
          {filtered.map(([name, artistSongs]) => (
            <ArtistCard key={name} name={name} songs={artistSongs} onSelect={setSelectedArtist} />
          ))}
        </div>
      )}
    </div>
  );
}
