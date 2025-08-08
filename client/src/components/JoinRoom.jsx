import { useState } from 'react';

export default function JoinRoom({ onJoin }){
  const [code, setCode] = useState('');
  const [user, setUser] = useState('');

  return (
    <div className="container">
      <div className="card" style={{maxWidth:520, margin:'80px auto'}}>
        <h2>Join a Room</h2>
        <p className="meta">Ask the DJ for the 4‑letter code.</p>
        <div className="row"><input className="input" placeholder="Room code (e.g., ABCD)" value={code} onChange={e=>setCode(e.target.value.toUpperCase().slice(0,4))}/></div>
        <div className="row" style={{marginTop:8}}><input className="input" placeholder="Your name (optional)" value={user} onChange={e=>setUser(e.target.value)}/></div>
        <div className="row" style={{marginTop:12}}>
          <button className="button" onClick={()=>onJoin({ code, user })}>Join</button>
        </div>
        <hr/>
        <p className="small">DJ? You can enter the PIN later in the dashboard.</p>
      </div>
    </div>
  );
}
