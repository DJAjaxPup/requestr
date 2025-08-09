import { useEffect, useRef, useState } from 'react';
import { socket } from '../lib/socket';

export default function DJControls({ queue = [], roomMeta }) {
  const [authed, setAuthed] = useState(false);
  const [pin, setPin] = useState('');
  const [remember, setRemember] = useState(true); // new: default on
  const [msg, setMsg] = useState('');

  // settings fields
  const [name, setName] = useState(roomMeta?.name || '');
  const [tipsUrl, setTipsUrl] = useState(roomMeta?.tipsUrl || '');

  // last successful auth (in-memory)
  const lastAuth = useRef({ code: null, pin: '' });

  const showMsg = (m, ms = 1800) => {
    setMsg(m);
    if (ms) setTimeout(() => setMsg(''), ms);
  };

  // sync incoming room meta
  useEffect(() => {
    if (roomMeta?.name != null) setName(roomMeta.name);
    if (roomMeta?.tipsUrl != null) setTipsUrl(roomMeta.tipsUrl);
  }, [roomMeta?.name, roomMeta?.tipsUrl]);

  // bootstrap: try reading saved auth from sessionStorage on mount & when room code changes
  useEffect(() => {
    const tryStoredAuth = () => {
      try {
        const raw = sessionStorage.getItem('djAuth');
        if (!raw) return;
        const saved = JSON.parse(raw);
        if (!saved?.code || !saved?.pin) return;
        // if we have a current room, make sure codes match; else just use saved
        const code = roomMeta?.code || saved.code;
        lastAuth.current = { code, pin: saved.pin };
        // fire auth; server will respond with ok/err
        socket.emit('dj_auth', { code, pin: saved.pin });
      } catch {}
    };

    tryStoredAuth();
  }, [roomMeta?.code]);

  // wire up socket listeners + reconnect re-auth
  useEffect(() => {
    const onOK = ({ room }) => {
      setAuthed(true);
      if (room?.name) setName(room.name);
      if (room?.tipsUrl) setTipsUrl(room.tipsUrl);
      showMsg('DJ unlocked');
      // persist to sessionStorage if remember is enabled
      if (remember && lastAuth.current?.code && lastAuth.current?.pin) {
        try {
          sessionStorage.setItem(
            'djAuth',
            JSON.stringify({ code: lastAuth.current.code, pin: lastAuth.current.pin })
          );
        } catch {}
      }
    };

    const onErr = (m) => {
      setAuthed(false);
      showMsg(typeof m === 'string' ? m : 'Invalid PIN');
      // if stored creds failed, clear them
      try { sessionStorage.removeItem('djAuth'); } catch {}
    };

    const onConnect = () => {
      // if we were authed before, re-auth; otherwise try sessionStorage if any
      const stored = (() => {
        try { return JSON.parse(sessionStorage.getItem('djAuth') || 'null'); } catch { return null; }
      })();
      const authPayload =
        lastAuth.current?.code && lastAuth.current?.pin
          ? lastAuth.current
          : (stored?.code && stored?.pin ? stored : null);

      if (authPayload) {
        socket.emit('dj_auth', { code: authPayload.code, pin: authPayload.pin });
      }
    };

    socket.on('dj_auth_ok', onOK);
    socket.on('dj_auth_err', onErr);
    socket.on('connect', onConnect);

    return () => {
      socket.off('dj_auth_ok', onOK);
      socket.off('dj_auth_err', onErr);
      socket.off('connect', onConnect);
    };
  }, [remember]);

  const auth = () => {
    const code = roomMeta?.code;
    if (!code) return showMsg('Join a room first');
    if (!pin) return showMsg('Enter DJ PIN');
    lastAuth.current = { code, pin };
    socket.emit('dj_auth', { code, pin });
  };

  // DJ-only actions — server enforces auth
  const setStatus = (id, status) =>
    socket.emit('dj_action', { action: 'set_status', payload: { id, status } });

  const remove = (id) =>
    socket.emit('dj_action', { action: 'delete', payload: { id } });

  const saveMeta = () => {
    socket.emit('dj_action', { action: 'room_meta', payload: { name, tipsUrl } });
    showMsg('Saved event settings');
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
          inputMode="text"
          autoComplete="one-time-code"
        />
        <label className="small" style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6 }}>
          <input
            type="checkbox"
            checked={remember}
            onChange={(e) => setRemember(e.target.checked)}
            style={{ transform: 'scale(1.1)' }}
          />
          Remember this session
        </label>
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
