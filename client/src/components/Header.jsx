import React from 'react';

export default function Header({ room, tipsUrl, nowPlaying }) {
  return (
    <header className="header">
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <img src="/CF.png" alt="" className="brand-logo" />
        <div className="logo">
          CityFest Requests
          {room ? <span className="badge" style={{ marginLeft: 8 }}>Room {room}</span> : null}
        </div>
      </div>

      <div style={{ display:'flex', alignItems:'center', gap:12 }}>
        {/* Your avatar */}
        <img
          src="/ajax.jpg"
          alt="DJ Ajax"
          className="avatar"
          onError={(e) => { e.currentTarget.style.display = 'none'; }}
        />
        {tipsUrl ? (
          <a className="button" href={tipsUrl} target="_blank" rel="noreferrer">
            Tip Jar
          </a>
        ) : null}
      </div>

      {nowPlaying ? (
        <div className="now-playing" aria-live="polite">
          <strong>Now Playing:</strong> {nowPlaying}
        </div>
      ) : null}
    </header>
  );
}
