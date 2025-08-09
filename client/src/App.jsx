import { useEffect, useRef, useState } from 'react';
import { socket } from './lib/socket';
import JoinRoom from './components/JoinRoom.jsx';
import RequestForm from './components/RequestForm.jsx';
import RequestList from './components/RequestList.jsx';
import DJControls from './components/DJControls.jsx';
import Toast from './components/Toast.jsx';
import Header from './components/Header.jsx';
import QRJoin from './components/QRJoin.jsx';

const DEFAULT_ROOM = 'AJAX'; // set to null to force manual join

export default function App(){
  const [phase, setPhase] = useState('join');
  const [room, setRoom] = useState(null);
  const [queue, setQueue] = useState([]);
  const [msg, setMsg] = useState('');

  const joinInfo = useRef({ code: null, user: '' });
  const joined = !!room?.code;

  const showMsg = (m, ms = 1800) => {
    setMsg(m);
    if (ms) setTimeout(() => setMsg(''), ms);
  };

  const persist = (k, v) => { try { localStorage.setItem(k, v); } catch {} };
  const read = (k, d='') => { try { return localStorage.getItem(k) ?? d; } catch { return d; } };

  const doJoin = ({ code, user = '' }) => {
    if (!code || code.length !== 4) return;
    const payload = { code: code.toUpperCase(), user: user?.slice(0,24) || '' };
    joinInfo.current = payload;
    persist('lastRoomCode', payload.code);
    if (user) persist('lastUser', user);
    // wait for server 'state' before enabling the form
    socket.emit('join', payload);
  };

  // initial join: ?room=CODE → saved → DEFAULT_ROOM
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const fromQuery = params.get('room');
    const saved = read('lastRoomCode');
    const user = read('lastUser', '');
    const code =
      (fromQuery && fromQuery.length === 4 && fromQuery.toUpperCase()) ||
      (saved && saved.length === 4 && saved.toUpperCase()) ||
      DEFAULT_ROOM;
    if (code) doJoin({ code, user });
    else setPhase('join');
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

    const onConnect = () => { if (joinInfo.current?.code) socket.emit('join', joinInfo.cu
