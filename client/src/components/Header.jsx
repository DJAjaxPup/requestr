import { useEffect, useState } from 'react';
import { socket } from '../lib/socket';

export default function Header({ room, tipsUrl }) {
  const [status, setStatus] = useState('connecting'); // connecting | live | reconnecting | offline

  useEffect(() => {
    const to = setTimeout(() => setStatus(socket.connected ? 'live' : 'offline'), 300);

    const onConnect = () => setStatus('live');
    const onDisconnect = () => setStatus('offline');
    const onReconnectAttempt = () => setStatus('reconnecting');
    const onReconnect = () => setStatus('live');

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.io.on('reconnect_attempt', onReconnectAttempt);
    socket.io.on('reconnect', onReconnect);

    return () => {
      clearTimeout(to);
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.io.off('reconnect_attempt', onReconnectAttempt);
      socket.io.off('reconnect', onReconnect);
    };
  }, []);

  const Dot = ({ state }) => {
    let bg = '#888', label = 'Connecting…';
    if (state === 'live') { bg = '#22c55e'; label = 'Live'; }
    else if (state === 'reconnecting') { bg = '#f59e0b'; label = 'Reconnecting…'; }
    else if (state === 'offline') { bg = '#ef4444'; label = 'Offline'; }
    return (
      <span className="small" style={{ display: 'inline-flex', alignItems:'center', gap:6 }}>
        <span style={{
          width:10, height:10, borderRadius:999, background:bg,
          boxShadow: `0 0 8px ${bg}`
        }} />
        {label}
      </span>
    );
  };

  return (
    <div className="header">
      <div>
        <div className="logo" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <img
            src="/CF.png"
            alt="CityFest"
            className="brand-logo"
            onError={(e) => { e.currentTarget.style.display = 'none'; }}
          />
          <span>CityFest Requests</span>
        </div>
        <div className="small">
          Room <span className="kbd">{room || '—'}</span> • The Loft, San Diego • Aug 10, 2025
        </div>
      </div>

      <div style={{ display:'flex', alignItems:'center', gap:12 }}>
        <Dot state={status} />
        {tipsUrl ? (
          <a
            href={tipsUrl}
            target="_blank"
            rel="noreferrer"
            className="button"
            style={{ textDecoration: 'none' }}
            aria-label="Tip Jar"
          >
            💸 Tip Jar
          </a>
        ) : (
          <span className="small">Tip Jar unavailable</span>
        )}
      </div>
    </div>
  );
}
