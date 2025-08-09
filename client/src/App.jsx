import { useEffect, useRef, useState } from 'react';
import { socket } from './lib/socket';
import JoinRoom from './components/JoinRoom.jsx';
import RequestForm from './components/RequestForm.jsx';
import RequestList from './components/RequestList.jsx';
import DJControls from './components/DJControls.jsx';
import Toast from './components/Toast.jsx';
import Header from './components/Header.jsx';
import QRJoin from './components/QRJoin.jsx';

const DEFAULT_ROOM = 'AJAX'; // auto-join fallback

export default function App(){
  const [phase, setPhase] = useState('join');
  const [room, setRoom] = useState(null);
  const [queue, setQueue] = useState([]);
  const [msg, setMsg] = useState('');

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

  // initial join: ?room=CODE → saved → DEFAULT_ROOM
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const fromQuery = params.get('room');
    const saved = (() => { try { return localStorage.getItem('lastRoomCode'); } catch { return null; }})();
    const user = (() => { try { return localStorage.getItem('lastUser') || ''; } catch { return ''; }})();
    const code =
      (fromQuery && fromQuery.length === 4 && fromQuery.toUpperCase()) ||
      (saved && saved.length === 4 && saved.toUpperCase()) ||
      DEFAULT_ROOM; // <- ensures newcomers are in a room
    doJoin({ code, user });
  }, []);

  useEffect(() => {
    const onState = (payload) => { setRoom(payload); setQueue(payload.queue || []); setPhase('room'); };
    const onAdd  = (entry) => setQueue(q => [...q, entry]);
    const onUpd  = (entry) => setQueue(q => q.map(x => x.id === entry.id ? entry : x));
    const onDel  = ({id}) => setQueue(q => q.filter(x => x.id !== id));
    const onOrd  = (order) => setQueue(q => order.map(id => q.find(x => x.id === id)).filter(Boolean));
    const onRUpd = (meta) => setRoom(r => ({ ...r, ...meta }));
    const onErr  = (m) => showMsg(m);

    socket.on('state', onState);
    socket.on('request_added', onAdd);
    socket.on('request_updated', onUpd);
    socket.on('request_deleted', onDel);
    socket.on('order_updated', onOrd);
    socket.on('room_updated', onRUpd);
    socket.on('error_msg', onErr);

    const onConnect = () => { if (joinInfo.current?.code) socket.emit('join', joinInfo.current); };
    const onDisconnect = () => showMsg('Reconnecting…', 1200);
    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);

    const syncTimer = setInterval(() => {
      if (joinInfo.current?.code && socket.connected) socket.emit('join', joinInfo.current);
    }, 25000);
    const onVis = () => {
      if (document.visibilityState === 'visible' && joinInfo.current?.code && socket.connected) {
        socket.emit('join', joinInfo.current);
      }
    };
    document.addEventListener('visibilitychange', onVis);

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
      clearInterval(syncTimer);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, []);

  // onSubmit that waits for server ACK
  const add = (req, done) => {
    socket.emit('add_request', req, (resp) => {
      if (resp && resp.ok) {
        done?.(true);
      } else {
        showMsg('Could not add request');
        done?.(false);
      }
    });
  };

  const join = ({ code, user }) => doJoin({ code, user });
  const upvote = (id) => socket.emit('upvote', { id });

  if (phase === 'join') return <JoinRoom onJoin={join} />;

  return (
    <div className="container">
      <Header room={room?.code} tipsUrl={room?.tipsUrl} />
      <div className="row" style={{ alignItems: 'flex-start' }}>
        <div style={{ flex: 3, display: 'grid', gap: 12 }}>
          <RequestForm onSubmit={add} />
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
