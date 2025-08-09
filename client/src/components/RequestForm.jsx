import { useEffect, useRef, useState } from 'react';

export default function RequestForm({ onSubmit, disabled = false, connecting = false }) {
  const [song, setSong] = useState('');
  const [artist, setArtist] = useState('');
  const [note, setNote] = useState('');
  const [name, setName] = useState('');
  const [msg, setMsg] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const songRef = useRef(null);

  // Helpers for remembering last user name
  const read = (k, d = '') => { try { return localStorage.getItem(k) ?? d; } catch { return d; } };
  const persist = (k, v) => { try { localStorage.setItem(k, v); } catch {} };

  useEffect(() => {
    const saved = read('lastUser', '');
    if (saved) setName(saved);
    songRef.current?.focus();
  }, []);

  const showMsg = (m, ms = 2500) => {
    setMsg(m);
    if (ms) setTimeout(() => setMsg(''), ms);
  };

  const clear = () => {
    setSong('');
    setArtist('');
    setNote('');
  };

  const submit = (e) => {
    e.preventDefault();
    if (disabled || submitting) return;

    const s = song.trim();
    if (!s) return showMsg('Please enter a song.', 2000);
    if (!onSubmit) return;

    setSubmitting(true);
    if (name.trim()) persist('lastUser', name.trim());

    let doneAlready = false;
    const finish = (ok) => {
      if (doneAlready) return;
      doneAlready = true;
      setSubmitting(false);
      if (ok) { clear(); showMsg('Request logged!'); }
      else { showMsg('Could not add request'); }
    };

    // call parent -> socket emit with ACK
    onSubmit(
      {
        song: s,
        artist: artist.trim(),
        note: note.trim(),
        user: name.trim()
      },
      (ok) => finish(!!ok)
    );

    // Fallback: if no ACK within 1.8s, assume success (UI shouldn’t get stuck)
    setTimeout(() => {
      finish(true);
      // if this triggers often, server isn’t ACK’ing; check logs
    }, 1800);
  };

  const canSubmit = !!song.trim() && !submitting && !disabled;

  return (
    <form className="card" onSubmit={submit}>
      <h3>Request a Track</h3>

      <div style={{ display: 'grid', gap: 8 }}>
        <input
          ref={songRef}
          className="input"
          placeholder="Song"
          value={song}
          onChange={(e) => setSong(e.target.value)}
          maxLength={120}
          autoComplete="off"
          inputMode="text"
          disabled={disabled || submitting}
        />
        <input
          className="input"
          placeholder="Artist (optional)"
          value={artist}
          onChange={(e) => setArtist(e.target.value)}
          maxLength={120}
          autoComplete="off"
          disabled={disabled || submitting}
        />
        <input
          className="input"
          placeholder="Note (dedication, shoutout — optional)"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={140}
          autoComplete="off"
          disabled={disabled || submitting}
        />
        <input
          className="input"
          placeholder="Your name (optional)"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={24}
          autoComplete="name"
          disabled={disabled || submitting}
        />
      </div>

      <div className="row" style={{ justifyContent: 'flex-end', marginTop: 10 }}>
        <button
          className="button"
          type="submit"
          disabled={!canSubmit}
          title={disabled ? 'Connecting to room…' : ''}
        >
          {disabled ? (connecting ? 'Connecting…' : 'Join a room') : (submitting ? 'Sending…' : 'Submit')}
        </button>
      </div>

      {msg ? (
        <div className="small" style={{ marginTop: 8 }}>
          {msg}
        </div>
      ) : null}

      <div
        className="small"
        style={{
          marginTop: 10,
          color: '#9aa3b2',
          lineHeight: 1.4,
          fontStyle: 'italic'
        }}
      >
        Ajax will play the request if he can find a mix that matches the style he’s playing.
      </div>
    </form>
  );
}
