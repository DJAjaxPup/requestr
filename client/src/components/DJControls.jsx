import { useEffect, useState } from 'react';
import { socket } from '../lib/socket';

export default function DJControls({ queue, roomMeta }) {
  const [pin, setPin] = useState('');
  const [authed, setAuthed] = useState(false);
  const [nowPlaying, setNowPlaying] = useState(roomMeta?.nowPlaying || '');

  useEffect(() => {
    const onOk = ({ room }) => {
      setAuthed(true);
      if (room?.nowPlaying != null) setNowPlaying(room.nowPlaying);
    };
    const onErr = (m) => alert(m || 'DJ auth error');
    socket.on('dj_auth_ok', onOk);
    socket.on('dj_auth_err', onErr);
    return () => {
      socket.off('dj_auth_ok', onOk);
      socket.off('dj_auth_err', onErr);
    };
  }, []);

  useEffect(() => {
    if (roomMeta?.nowPlaying != null) setNowPlaying(roomMeta.nowPlaying);
  }, [roomMeta?.nowPlaying]);

  const auth = () => {
    const code = roomMeta?.code;
    socket.emit('dj_auth', { code, pin });
  };

  const setStatus = (id, status) => {
    socket.emit('dj_action', { action: 'set_status', payload: { id, status } });
  };

  const saveNowPlaying = () => {
    socket.emit('dj_action', { action: 'room_meta', payload: { nowPlaying: nowPlaying.trim() } });
  };
  const clearNowPlaying = () => {
    setNowPlaying('');
    socket.emit('dj_action', { action: 'room_meta', payload: { nowPlaying: '' } });
  };

  if (!authed) {
    return (
      <div className="card">
        <h3>DJ Dashboard</h3>
        <div className="small" style={{ marginBottom: 8 }}>
          Enter DJ PIN (hint: {roomMeta?.pinHint || '****'})
        </div>
        <input className="pin" placeholder="DJ PIN" value={pin} onChange={(e)=>setPin(e.target.value)} />
        <div className="row" style={{ justifyContent:'flex-end', marginTop: 10 }}>
          <button className="button" onClick={auth}>Enter</button>
        </div>
      </div>
    );
  }

  return (
    <div className="card" style={{ display:'grid', gap:12 }}>
      <h3>DJ Dashboard</h3>

      {/* Now Playing editor */}
      <div>
        <label className="small" style={{ display:'block', marginBottom:6 }}>Now Playing</label>
        <input
          className="input"
          placeholder="Artist – Track (Remix)"
          value={nowPlaying}
          onChange={(e)=>setNowPlaying(e.target.value)}
          maxLength={120}
        />
        <div className="row" style={{ justifyContent:'flex-end', marginTop:8, gap:8 }}>
          <button className="button" onClick={saveNowPlaying}>Set</button>
          <button className="button" onClick={clearNowPlaying}>Clear</button>
        </div>
      </div>

      <hr />

      {/* Simple queue controls */}
      <div className="small" style={{ marginBottom: 6 }}>Queue Controls</div>
      <div className="list">
        {queue.map(item => (
          <div key={item.id} className={`item ${item.status === 'playing' ? 'status-playing' : ''}`}>
            <div>
              <div><strong>{item.song}</strong> {item.artist ? `— ${item.artist}` : ''}</div>
              <div className="meta">By {item.user || 'Guest'} • Votes {item.votes}</div>
            </div>
            <div className="row" style={{ gap:6 }}>
              <button className="button" onClick={()=>setStatus(item.id,'queued')}>Queue</button>
              <button className="button" onClick={()=>setStatus(item.id,'playing')}>Playing</button>
              <button className="button" onClick={()=>setStatus(item.id,'done')}>Done</button>
            </div>
          </div>
        ))}
        {!queue.length ? <div className="small">No requests yet.</div> : null}
      </div>
    </div>
  );
}
