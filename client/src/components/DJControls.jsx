import { useEffect, useState } from 'react';
import { socket } from '../lib/socket';

export default function DJControls({ queue = [], roomMeta }) {
  const [authed, setAuthed] = useState(false);
  const [pin, setPin] = useState('');
  const [msg, setMsg] = useState('');

  // settings fields
  const [name, setName] = useState(roomMeta?.name || '');
  const [tipsUrl, setTipsUrl] = useState(roomMeta?.tipsUrl || '');

  useEffect(() => {
    const onOK = ({ room }) => {
      setAuthed(true);
      if (room?.name) setName(room.name);
      if (room?.tipsUrl) setTipsUrl(room.tipsUrl);
      setMsg('DJ unlocked');
      setTimeout(() => setMsg(''), 1500);
    };
    const onErr = (m) => {
      setAuthed(false);
      setMsg(typeof m === 'string' ? m : 'Invalid PIN');
      setTimeout(() => setMsg(''), 2000);
    };
    socket.on('dj_auth_ok', onOK);
    socket.on('dj_auth_err', onErr);
    return () => {
      socket.off('dj_auth_ok', onOK);
      socket.off('dj_auth_err', onErr);
    };
  }, []);

  useEffect(() => {
    // keep local fields in sync if server pushes updates
    if (roomMeta?.name != null) setName(roomMeta.name);
    if (roomMeta?.tipsUrl != null) setTipsUrl(roomMeta.tipsUrl);
  }, [roomMeta?.name, roomMeta?.tipsUrl]);

  const auth = () => {
    if (!roomMeta?.code) return setMsg('Join a room first');
    socket.emit('dj_auth', { code: roomMeta.code, pin });
  };

  const setStatus = (id, status) =>
    socket.emit('dj_action', { action: 'set_status', payload: { id, status } });

  const remove = (id) =>
    socket.emit('dj_action', { action: 'delete', payload: { id } });

  const saveMeta = () => {
    socket.emit('dj_action', { action: 'room_meta', payload: { name, tipsUrl } });
    setMsg('Saved event settings');
    setTimeout(() => setMsg(''), 1500);
  };

  const top = queue?.[0];

  if (!authed) {
    return (
      <div className="card">
        <h3>DJ Panel</h3>
        <div className="small" style={{ marginBottom: 8 }}>
          Enter DJ PIN to unlock controls.
        </div>
        <input
          className="pin"
          type="password"
          placeholder="DJ PIN"
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          inputMode="numeric"
        />
        <div className="row" style={{ marginTop: 8 }}>
          <button className="button" onClick={auth}>Unlock</button>
        </div>
        {msg ? <div className="small" style={{ marginTop: 8 }}>{msg}</div> : null}
      </div>
    );
  }

  return (
    <div className="card">
      <h3>DJ Panel</h3>
      <div className="small" style={{ marginBottom: 8 }}>
        Room {roomMeta?.name || roomMeta?.code}
      </div>

      {/* Event Settings */}
      <div className="card" style={{ background: '#0e1525', marginBottom: 12 }}>
        <h3 style={{ marginBottom: 8 }}>Event Settings</h3>
        <div style={{ display: 'grid', gap: 8 }}>
          <input
            className="input"
            placeholder="Event name (shown to audience)"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <input
            className="input"
            placeholder="Tip Jar URL (https://…)"
            value={tipsUrl}
            onChange={(e) => setTipsUrl(e.target.value)}
          />
          <div className="row" style={{ justifyContent: 'flex-end' }}>
            <button className="button" onClick={saveMeta}>Save</button>
          </div>
        </div>
      </div>

      {/* Now Playing */}
      {top ? (
        <div className="item status-playing" style={{ marginBottom: 8 }}>
          <div>
            <div style={{ fontWeight: 700 }}>{top.song} — {top.artist}</div>
            <div className="meta">By {top.user} • {top.votes} votes</div>
          </div>
          <div className="row">
            <button className="button" onClick={() => setStatus(top.id, 'done')}>Done</button>
          </div>
        </div>
      ) : (
        <div className="small" style={{ marginBottom: 8 }}>No items queued yet.</div>
      )}

      {/* Queue */}
      <div className="list" style={{ maxHeight: 320, overflow: 'auto' }}>
        {queue.slice(1).map((r) => (
          <div className="item" key={r.id}>
            <div>
              <div style={{ fontWeight: 600 }}>{r.song} — {r.artist}</div>
              <div className="meta">By {r.user} • {r.votes} votes • {r.status}</div>
            </div>
            <div className="row">
              <button className="button" onClick={() => setStatus(r.id, 'playing')}>Play</button>
              <button className="button" onClick={() => setStatus(r.id, 'done')}>Done</button>
              <button className="button" onClick={() => remove(r.id)}>Delete</button>
            </div>
          </div>
        ))}
      </div>

      {msg ? <div className="small" style={{ marginTop: 8 }}>{msg}</div> : null}
    </div>
  );
}
