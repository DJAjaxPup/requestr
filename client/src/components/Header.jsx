import React from 'react';

export default function Header({ room, tipsUrl, nowPlaying }) {
  return (
    <header className="header">
      <div className="logo">
        <img src="/CF.png" alt="" className="brand-logo" />
        CityFest Requests
        {room ? <span className="badge" style={{ marginLeft: 8 }}>Room {room}</span> : null}
      </div>

      <div style={{ display:'flex', gap:8, alignItems:'center' }}>
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
