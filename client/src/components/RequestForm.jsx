import { useState } from 'react';

export default function RequestForm({ onSubmit }){
  const [song, setSong] = useState('');
  const [artist, setArtist] = useState('');
  const [note, setNote] = useState('');

  const submit = () => {
    if(!song.trim()) return;
    onSubmit({ song, artist, note });
    setSong(''); setArtist(''); setNote('');
  };

  return (
    <div className="card">
      <h3>Request a Track</h3>
      <div className="row"><input className="input" placeholder="Song" value={song} onChange={e=>setSong(e.target.value)} /></div>
      <div className="row" style={{marginTop:8}}><input className="input" placeholder="Artist (optional)" value={artist} onChange={e=>setArtist(e.target.value)} /></div>
      <div className="row" style={{marginTop:8}}><input className="input" placeholder="Note (dedication, vibe, etc.)" value={note} onChange={e=>setNote(e.target.value)} /></div>
      <div className="row" style={{marginTop:8}}>
        <button className="button" onClick={submit}>Submit</button>
        <span className="meta">Please be nice. No spam.</span>
      </div>
    </div>
  );
}
