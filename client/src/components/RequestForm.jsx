import { useEffect, useState } from 'react';
import { socket } from '../lib/socket';

export default function RequestForm() {
  const [song, setSong] = useState('');
  const [artist, setArtist] = useState('');
  const [note, setNote] = useState('');
  const [name, setName] = useState('');
  const [msg, setMsg] = useState('');

  // show “Request logged!” after server ack or echo back
  useEffect(() => {
    const onErr = (m) => {
      setMsg(typeof m === 'string' ? m : 'Something went wrong');
      setTimeout(() => setMsg(''), 2500);
    };
    socket.on('error_msg', onErr);
    return () => socket.off('error_msg', onErr);
  }, []);

  const showOk = () => {
    setMsg('Request logged!');
    setTimeout(() => setMsg(''), 2500);
  };

  const clear = () => {
    setSong('');
    setArtist('');
    setNote('');
  };

  const submit = (e) => {
    e.preventDefault();
    const s = song.trim();
    if (!s) {
      setMsg('Please enter a song.');
      setTimeout(() => setMsg(''), 2000);
      return;
    }

    // IMPORTANT: server expects "add_request"
    socket.emit(
      'add_request',
      {
        song: s,
        artist: artist.trim(),
        note: note.trim(),
        user: name.trim()
      },
      // ack (server will call this if available)
      (resp) => {
        if (resp && resp.ok) {
          clear();
          showOk();
        }
      }
    );

    // Fallback UX: show success quickly even if ack is delayed
    setTimeout(() => {
      if (!msg) { clear(); showOk(); }
    }, 400);
  };

  return (
    <form className="card" onSubmit={submit}>
      <h3>Request a Track</h3>

      <div style={{ display:'grid', gap:8 }}>
        <input
          className="input"
          placeholder="Song"
          value={song}
          onChange={(e) => setSong(e.target.value)}
        />
        <input
          className="input"
          placeholder="Artist (optional)"
          value={artist}
          onChange={(e) => setArtist(e.target.value)}
        />
        <input
          className="input"
          placeholder="Note (dedication, shoutout — optional)"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
        <input
          className="input"
          placeholder="Your name (optional)"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>

      <div className="row" style={{ justifyContent:'flex-end', marginTop:10 }}>
        <button className="button" type="submit" disabled={!song.trim()}>
          Submit
        </button>
      </div>

      {msg ? (
        <div className="small" style={{ marginTop: 8 }}>
          {msg}
        </div>
      ) : null}

      <div
        className="small"
        style={{ marginTop: 10, color: '#9aa3b2', lineHeight: 1.4, fontStyle:'italic' }}
      >
        Ajax will play the request if he can find a mix that matches the style he’s playing.
      </div>
    </form>
  );
}
