// client/src/App.jsx
import { useEffect, useRef, useState } from 'react';
import { socket } from './lib/socket';
import Header from './components/Header.jsx';
import RequestForm from './components/RequestForm.jsx';
import RequestList from './components/RequestList.jsx';
import DJControls from './components/DJControls.jsx';
import QRJoin from './components/QRJoin.jsx';
import Toast from './components/Toast.jsx';

const DEFAULT_ROOM = 'AJAX';

export default function App(){
  const [phase, setPhase] = useState('join');   // 'join' | 'room'
  const [room, setRoom] = useState(null);       // { code, name, tipsUrl, queue: [...] }
  const [queue, setQueue] = useState([]);
  const [msg, setMsg] = useState('');
  const [connecting, setConnecting] = useState(true);

  const joinInfo = useRef({ code: null, user: '' });

  const showMsg = (m, ms = 1800) => {
    setMsg(m);
    if (ms) setTimeout(() => setMsg(''), ms);
  };

  const doJoin = ({ code, user = '' }) => {
    if (!code || code.length !== 4) return;
    const payload = { code: code.toUpperCase(), user: user?.slice(0,24) || '' };
    joinInfo.current = payload;
    try {
      localStorage.setItem('lastRoomCode', payload.code);
      if (user) localStorage.setItem('lastUser', user);
    } catch {}
    socket.emit('join', payload);
  };

  // Auto-join: ?room=CODE → saved → DEFAULT_ROOM
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const fromQuery = params.get('room');
    const saved = (() => { try { return localStorage.getItem('lastRoomCode'); } catch { return null; } })();
    const user  = (() => { try { return localStorage.getItem('lastUser') || ''; } catch { return ''; } })();

    const code =
      (fromQuery && fromQuery.length === 4 && fromQuery.toUpperCase()) ||
      (saved && saved.length === 4 && saved.toUpperCase()) ||
      DEFAULT_ROOM;

    doJoin({ code, user });
  }, []);

  // Socket wiring + resiliency
  useEffect(() => {
    const onState = (payload) => {
      setRoom(payload);
      // drop any done items that might be in the initial payload
      const fresh = (payload.queue || []).filter(e => e && e.status !== 'done');
      setQueue(fresh);
      setPhase('room');
      setConnecting(false);
    };

    const onAdd  = (entry) => {
      if (!entry || entry.status === 'done') return; // never show done
      setQueue(q => [...q, entry]);
    };

    const onUpd  = (entry) => {
      setQueue(q => {
        if (!entry) return q;
        if (entry.status === 'done') return q.filter(x => x.id !== entry.id);
        return q.map(x => x.id === entry.id ? entry : x);
      });
    };

    const onDel  = ({id}) => setQueue(q => q.filter(x => x.id !== id));

    const onOrd  = (order) => {
      // rebuild list in server order, but skip items that are done
      setQueue(q => {
        const byId = new Map(q.map(x => [x.id, x]));
        const next = order
          .map(id => byId.get(id))
          .filter(Boolean)
          .filter(x => x.status !== 'done');
        return next;
      });
    };

    const onRUpd = (meta) => setRoom(r => ({ ...r, ...meta }));
    const onErr  = (m) => showMsg(m);

    socket.on('state', onState);
    socket.on('request_added', onAdd);
    socket.on('request_updated', onUpd);
    socket.on('request_deleted', onDel);
    socket.on('order_updated', onOrd);
    socket.on('room_updated', onRUpd);
    socket.on('error_msg', onErr);

    const onConnect = () => {
      if (joinInfo.current?.code) socket.emit('join', joinInfo.current);
      setConnecting(true);
    };
    const onDisconnect = () => setConnecting(true);

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);

    // light periodic resync
    const t = setInterval(() => {
      if (joinInfo.current?.code && socket.connected) {
        socket.emit('join', joinInfo.current);
      }
    }, 25000);

    return () => {
      socket.off('state', onState);
      socket.off('request_added', onAdd);
      socket.off('request_updated', onUpd);
      socket.off('request_deleted', onDel);
      socket.off('order_updated', onOrd);
      socket.off('room_updated', onRUpd);
      socket.off('error_msg', onErr);
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      clearInterval(t);
    };
  }, []);

  // Submit handler with server ACK (includes room code fallback)
  const add = (req, done) => {
    const code = room?.code;
    socket.emit('add_request', { ...req, code }, (resp) => {
      const ok = !!(resp && resp.ok);
      done?.(ok);
      if (!ok) showMsg(resp?.error || 'Could not add request');
    });
  };

  const join = ({ code, user }) => doJoin({ code, user });
  const upvote = (id) => socket.emit('upvote', { id });

  if (phase === 'join') {
    return <div className="container"><QRJoin roomCode={DEFAULT_ROOM} /></div>;
  }

  const requestFormDisabled = !socket.connected || !room?.code;

  return (
    <div className="container">
      // ...
<Header room={room?.code} tipsUrl={room?.tipsUrl} nowPlaying={room?.nowPlaying} />
// ...


      <div className="row" style={{ alignItems: 'flex-start' }}>
        <div style={{ flex: 3, display: 'grid', gap: 12 }}>
          <RequestForm
            onSubmit={add}
            disabled={requestFormDisabled}
            connecting={connecting}
          />
          <RequestList role="audience" items={queue} onUpvote={upvote} />
        </div>

        <div style={{ flex: 2, display: 'grid', gap: 12 }}>
          <DJControls queue={queue} roomMeta={room} />
          <QRJoin roomCode={room?.code} />
        </div>
      </div>

      <Toast msg={msg} />
    </div>
  );
}

