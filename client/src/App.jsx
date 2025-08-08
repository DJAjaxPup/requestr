import { useEffect, useMemo, useState } from 'react';
import { socket } from './lib/socket';
import JoinRoom from './components/JoinRoom.jsx';
import RequestForm from './components/RequestForm.jsx';
import RequestList from './components/RequestList.jsx';
import DJControls from './components/DJControls.jsx';
import Toast from './components/Toast.jsx';
import Header from './components/Header.jsx';
import QRJoin from './components/QRJoin.jsx';


export default function App(){
  const [phase, setPhase] = useState('join');
  const [room, setRoom] = useState(null);
  const [queue, setQueue] = useState([]);
  const [msg, setMsg] = useState('');

useEffect(()=>{
  const params = new URLSearchParams(window.location.search);
  const code = params.get('room');
  if(code && code.length === 4){
    socket.emit('join', { code: code.toUpperCase(), user: '' });
  }
},[]);
  useEffect(()=>{
    const onState = (payload)=>{ setRoom(payload); setQueue(payload.queue || []); 

setPhase('room'); };
    const onAdd = (entry)=> setQueue(q=>[...q, entry]);
    const onUpd = (entry)=> setQueue(q=> q.map(x=> x.id===entry.id? entry : x));
    const onDel = ({id})=> setQueue(q=> q.filter(x=> x.id!==id));
    const onOrder = (order)=> setQueue(q=> order.map(id=> q.find(x=> x.id===id)).filter(Boolean));
    const onRoomUpd = (meta)=> setRoom(r=> ({...r, ...meta}));
    const onErr = (m)=> { setMsg(m); setTimeout(()=>setMsg(''), 2000); };

    socket.on('state', onState);
    socket.on('request_added', onAdd);
    socket.on('request_updated', onUpd);
    socket.on('request_deleted', onDel);
    socket.on('order_updated', onOrder);
    socket.on('room_updated', onRoomUpd);
    socket.on('error_msg', onErr);

    return ()=>{
      socket.off('state', onState);
      socket.off('request_added', onAdd);
      socket.off('request_updated', onUpd);
      socket.off('request_deleted', onDel);
      socket.off('order_updated', onOrder);
      socket.off('room_updated', onRoomUpd);
      socket.off('error_msg', onErr);
    };
  },[]);

  const join = ({ code, user }) => {
    socket.emit('join', { code, user });
  };

  const add = (req) => socket.emit('add_request', req);
  const upvote = (id) => socket.emit('upvote', { id });
  const act = ({ pin, action, payload }) => socket.emit('dj_action', { pin, action, payload });

  if(phase==='join') return <JoinRoom onJoin={join} />;

  const role = 'audience'; // simple for now; DJ controls available to anyone with PIN

  return (
    <div className="container">
      <Header room={room?.code} tipsUrl={room?.tipsUrl} />
      <div className="row" style={{alignItems:'flex-start'}}>
        <div style={{flex:3, display:'grid', gap:12}}>
          <RequestForm onSubmit={add} />
          <RequestList role={role} items={queue} onUpvote={upvote} />
        </div>
        <div style={{flex:2}}>
          <DJControls queue={queue} onAction={act} pinHint={room?.pinHint} roomMeta={room} />
		<QRJoin roomCode={room?.code} />

        </div>
      </div>
      <Toast msg={msg} />
    </div>
  );
}
