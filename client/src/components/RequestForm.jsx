-export default function RequestForm({ onSubmit }) {
+export default function RequestForm({ onSubmit, disabled=false, connecting=false }) {
  ...
  const submit = (e) => {
    e.preventDefault();
+   if (disabled) return;
    const s = song.trim();
    if (!s) return showMsg('Please enter a song.', 2000);
    if (!onSubmit) return;
    setSubmitting(true);
-   onSubmit(
+   onSubmit(
      {
        song: s,
        artist: artist.trim(),
        note: note.trim(),
        user: name.trim()
      },
      (ok) => {
        setSubmitting(false);
        if (ok) { clear(); showMsg('Request logged!'); }
        else { showMsg('Could not add request'); }
      }
    );
  };

  return (
-   <form className="card" onSubmit={submit}>
+   <form className="card" onSubmit={submit}>
      <h3>Request a Track</h3>

      <div style={{ display:'grid', gap:8 }}>
        <input
          className="input"
          placeholder="Song"
          value={song}
-         onChange={(e) => setSong(e.target.value)}
+         onChange={(e) => setSong(e.target.value)}
+         disabled={disabled || submitting}
+         autoFocus
        />
        <input
          className="input"
          placeholder="Artist (optional)"
          value={artist}
-         onChange={(e) => setArtist(e.target.value)}
+         onChange={(e) => setArtist(e.target.value)}
+         disabled={disabled || submitting}
        />
        <input
          className="input"
          placeholder="Note (dedication, shoutout — optional)"
          value={note}
-         onChange={(e) => setNote(e.target.value)}
+         onChange={(e) => setNote(e.target.value)}
+         disabled={disabled || submitting}
        />
        <input
          className="input"
          placeholder="Your name (optional)"
          value={name}
-         onChange={(e) => setName(e.target.value)}
+         onChange={(e) => setName(e.target.value)}
+         disabled={disabled || submitting}
        />
      </div>

      <div className="row" style={{ justifyContent:'flex-end', marginTop:10 }}>
-       <button className="button" type="submit" disabled={!song.trim() || submitting}>
-         {submitting ? 'Sending…' : 'Submit'}
+       <button
+         className="button"
+         type="submit"
+         disabled={disabled || !song.trim() || submitting}
+         title={disabled ? 'Connecting to room…' : ''}
+       >
+         {disabled ? (connecting ? 'Connecting…' : 'Join a room') : (submitting ? 'Sending…' : 'Submit')}
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
