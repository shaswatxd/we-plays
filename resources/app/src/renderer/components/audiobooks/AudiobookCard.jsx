import React from 'react';
import { BookOpen, Play } from 'lucide-react';
import { formatDurationLong } from '../../services/audiobookApi';

function hslFromStr(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  return `hsl(${Math.abs(hash) % 360}, 45%, 32%)`;
}

export default function AudiobookCard({ book, onOpen, onPlay, subtitle }) {
  const authorNames = (book.authors || []).map(a => a.name).join(', ') || 'Unknown Author';
  return (
    <div className="sp-album-card ab-card" onClick={() => onOpen?.(book.id)}>
      <div className="sp-album-cover ab-cover">
        {book.coverArtThumbnail
          ? <img src={book.coverArtThumbnail} alt="" loading="lazy" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
          : <div style={{ width:'100%', height:'100%', background: hslFromStr(book.title || book.id), display:'flex', alignItems:'center', justifyContent:'center' }}>
              <BookOpen size={32} color="rgba(255,255,255,0.5)" />
            </div>}
        <div className="sp-album-play-overlay" onClick={e => { e.stopPropagation(); onPlay?.(book); }}>
          <Play size={22} fill="black" color="black" style={{ marginLeft:3 }} />
        </div>
      </div>
      <p className="sp-album-name" title={book.title}>{book.title}</p>
      <p className="sp-album-meta" title={authorNames}>{subtitle || `${authorNames} · ${formatDurationLong(book.totalTimeSecs)}`}</p>
    </div>
  );
}
