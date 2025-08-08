import { useState } from 'react';

export default function DJControls({ queue, onAction, pinHint, roomMeta }){
  const [pin, setPin] = useState('');
  const [name, setName] = useState(roomMeta?.name || '');
  const [tipsUrl, setTipsUrl] = useState(roomMeta?.tipsUrl || '');

  const act = (action, payload) => onAction({ pin, action, payload });

  const setStatus = (id, status) => act('set_status', { id, status });
  const remove = (id) => act('delete', { id });
  const saveRoom = () => act('room_meta', { name, tipsUrl });

  return (
    <div className="card">
      <h3>DJ Dashboard</h3>
      <div className="row">
        <input className="pin" placeholder={`PIN (starts with ${pinHint})`} value={pin} onChange={e=>setPin(e.target.value.slice(0,4))}/>
        <span className="badge">Protect this PIN</span>
      </div>
      <div className="row" style={{marginTop:8}}>
        <input className="input" placeholder="Room name" value={name} onChange={e=>setName(e.target.value)} />
        <input className="input" placeholder="Tip URL (optional)" value={tipsUrl} onChange={e=>setTipsUrl(e.target.value)} />
        <button className="button" onClick={saveRoom}>Save</button>
      </div>
      <hr />
      <div className="list">
        {queue.map(req => (
          <div key={req.id} className={`item status-${req.status}`}>
            <div>
              <div style={{fontWeight:700}}>{req.song} {req.artist ? `— ${req.artist}` : ''}</div>
              {req.note && <div className="meta">“{req.note}”</div>}
              <div className="meta">by {req.user} • votes {req.votes} • {req.status}</div>
            </div>
            <div className="row">
              <button className="button" onClick={()=>setStatus(req.id, 'queued')}>Queue</button>
              <button className="button" onClick={()=>setStatus(req.id, 'playing')}>Playing</button>
              <button className="button" onClick={()=>setStatus(req.id, 'done')}>Done</button>
              <button className="button" onClick={()=>remove(req.id)}>Delete</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
