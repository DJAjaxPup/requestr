import { useState } from 'react';
import { socket } from '../lib/socket';

export default function RequestForm({ room }) {
  const [song, setSong] = useState('');
  const [artist, setArtist] = useState('');
  const [name, setName] = useState('');
  const [msg, setMsg] = useState('');

  const showMsg = (m, ms = 3000) => {
    setMsg(m);
    if (ms) setTimeout(() => setMsg(''), ms);
  };

  const submit = (e) => {
    e.preventDefault();
    if (!song.trim() || !artist.trim() || !name.trim()) return;

    socket.emit(
      'request',
      {
        code: room,
        song: song.trim(),
        artist: artist.trim(),
        user: name.trim()
      },
      () => {
        // confirmation callback from server
        setSong('');
        setArtist('');
        setName('');
        showMsg('Request logged!');
      }
    );
  };

  return (
    <form className="card" onSubmit={submit}>
      <h3>Request a Song</h3>
      <input
        className="input"
        placeholder="Song title"
        value={song}
        onChange={(e) => setSong(e.target.value)}
      />
      <input
        className="input"
        placeholder="Artist"
        value={artist}
        onChange={(e) => setArtist(e.target.value)}
      />
      <input
        className="input"
        placeholder="Your name"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <div className="row" style={{ justifyContent: 'flex-end', marginTop: 8 }}>
        <button className="button" type="submit">
          Submit
        </button>
      </div>

      {msg ? (
        <div className="small" style={{ marginTop: 8, color: '#22c55e' }}>
          {msg}
        </div>
      ) : null}

      <div
        className="small"
        style={{
          marginTop: 10,
          color: '#9ca3af',
          fontStyle: 'italic',
          lineHeight: 1.4
        }}
      >
        Ajax will play the request if he can find a mix that matches the style
        he's playing.
      </div>
    </form>
  );
}
