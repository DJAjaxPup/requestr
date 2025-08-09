// App.jsx — auto-join AJAX + show form immediately, keep syncing
import { useEffect, useRef, useState } from 'react'
import { socket } from './lib/socket'
import JoinRoom from './components/JoinRoom.jsx'
import RequestForm from './components/RequestForm.jsx'
import RequestList from './components/RequestList.jsx'
import DJControls from './components/DJControls.jsx'
import Toast from './components/Toast.jsx'
import Header from './components/Header.jsx'
import QRJoin from './components/QRJoin.jsx'

const DEFAULT_ROOM = 'AJAX' // auto-join fallback

export default function App(){
  const [phase, setPhase] = useState('join')
  const [room, setRoom] = useState(null)
  const [queue, setQueue] = useState([])
  const [msg, setMsg] = useState('')

  const joinInfo = useRef({ code: null, user: '' })

  const showMsg = (m, ms = 1800) => {
    setMsg(m)
    if (ms) setTimeout(() => setMsg(''), ms)
  }

  const persist = (k, v) => { try { localStorage.setItem(k, v) } catch {} }
  const read = (k, d='') => { try { return localStorage.getItem(k) ?? d } catch { return d } }

  const doJoin = ({ code, user = '' }) => {
    if (!code || code.length !== 4) return
    const payload = { code: code.toUpperCase(), user: user?.slice(0,24) || '' }
    joinInfo.current = payload
    persist('lastRoomCode', payload.code)
    if (user) persist('lastUser', user)

    // Optimistically show the room UI so folks can type immediately
    setRoom(r => ({ ...(r||{}), code: payload.code }))
    setPhase('room')

    socket.emit('join', payload)
  }

  // initial join: ?room=CODE → saved → DEFAULT_ROOM
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const fromQuery = params.get('room')
    const saved = read('lastRoomCode')
    const user = read('lastUser', '')
    const code =
      (fromQuery && fromQuery.length === 4 && fromQuery.toUpperCase()) ||
      (saved && saved.length === 4 && saved.toUpperCase()) ||
      DEFAULT_ROOM
    doJoin({ code, user })
  }, [])

  useEffect(() => {
    const onState = (payload) => { setRoom(payload); setQueue(payload.queue || []); setPhase('room') }
    const onAdd  = (entry) => setQueue(q => [...q, entry])
    const onUpd  = (entry) => setQueue(q => q.map(x => x.id === entry.id ? entry : x))
    const onDel  = ({id}) => setQueue(q => q.filter(x => x.id !== id))
    const onOrd  = (order) => setQueue(q => order.map(id => q.find(x => x.id === id)).filter(Boolean))
    const onRUpd = (meta) => setRoom(r => ({ ...r, ...meta }))
    const onErr  = (m) => showMsg(m)

    socket.on('state', onState)
    socket.on('request_added', onAdd)
    socket.on('request_updated', onUpd)
    socket.on('request_deleted', onDel)
    socket.on('order_updated', onOrd)
    socket.on('room_updated', onRUpd)
    socket.on('error_msg', onErr)

    const onConnect = () => { if (joinInfo.current?.code) socket.emit('join', joinInfo.current) }
    const onDisconnect = () => showMsg('Reconnecting…', 1200)
    socket.on('connect', onConnect)
    socket.on('disconnect', onDisconnect)

    const syncTimer = setInterval(() => {
      if (joinInfo.current?.code && socket.connected) socket.emit('join', joinInfo.current)
    }, 25000)
    const onVis = () => {
      if (document.visibilityState === 'visible' && joinInfo.current?.code && socket.connected) {
        socket.emit('join', joinInfo.current)
      }
    }
    document.addEventListener('visibilitychange', onVis)

    return () => {
      socket.off('state', onState)
      socket.off('request_added', onAdd)
      socket.off('request_updated', onUpd)
      socket.off('request_deleted', onDel)
      socket.off('order_updated', onOrd)
      socket.off('room_updated', onRUpd)
      socket.off('error_msg', onErr)
      socket.off('connect', onConnect)
      socket.off('disconnect', onDisconnect)
      clearInterval(syncTimer)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [])

  // onSubmit that waits for server ACK; include room code just in case server requires it
  const add = (req, done) => {
    const payload = { ...req }
    if (!payload.user) payload.user = read('lastUser','')
    if (!payload.room && joinInfo.current?.code) payload.room = joinInfo.current.code
    socket.emit('add_request', payload, (resp) => {
      if (resp && resp.ok) {
        done?.(true)
      } else {
        showMsg(resp?.error || 'Could not add request')
        done?.(false)
      }
    })
  }

  const join = ({ code, user }) => doJoin({ code, user })
  const upvote = (id) => socket.emit('upvote', { id })

  // If server hasn’t sent state yet, still render the room UI so people can type
  const showJoin = phase === 'join' && !room?.code

  if (showJoin) return <JoinRoom onJoin={join} />

  return (
    <div className="container">
      <Header room={room?.code || joinInfo.current?.code} tipsUrl={room?.tipsUrl} />
      <div className="row" style={{ alignItems: 'flex-start' }}>
        <div style={{ flex: 3, display: 'grid', gap: 12 }}>
          <RequestForm onSubmit={add} />
          <RequestList role="audience" items={queue} onUpvote={upvote} />
        </div>
        <div style={{ flex: 2, display: 'grid', gap: 12 }}>
          <DJControls queue={queue} roomMeta={room} />
          <QRJoin roomCode={room?.code || joinInfo.current?.code} />
        </div>
      </div>
      {!socket.connected ? <div className="small" style={{marginTop:8}}>Offline — requests will send once reconnected.</div> : null}
      <Toast msg={msg} />
    </div>
  )
}

// -----------------------------------------------------------
// RequestForm.jsx — UX polish + localStorage name + focus
import { useEffect, useRef, useState } from 'react'

export default function RequestForm({ onSubmit }) {
  const [song, setSong] = useState('')
  const [artist, setArtist] = useState('')
  const [note, setNote] = useState('')
  const [name, setName] = useState('')
  const [msg, setMsg] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const songRef = useRef(null)

  const read = (k, d='') => { try { return localStorage.getItem(k) ?? d } catch { return d } }
  const persist = (k, v) => { try { localStorage.setItem(k, v) } catch {} }

  useEffect(() => {
    // prefill saved name and focus song
    const saved = read('lastUser','')
    if (saved) setName(saved)
    songRef.current?.focus()
  }, [])

  const showMsg = (m, ms = 2500) => {
    setMsg(m)
    if (ms) setTimeout(() => setMsg(''), ms)
  }

  const clear = () => { setSong(''); setArtist(''); setNote('') }

  const submit = (e) => {
    e.preventDefault()
    const s = song.trim()
    if (!s) return showMsg('Please enter a song.', 2000)
    if (!onSubmit || submitting) return

    setSubmitting(true)
    if (name.trim()) persist('lastUser', name.trim())

    onSubmit(
      {
        song: s,
        artist: artist.trim(),
        note: note.trim(),
        user: name.trim()
      },
      (ok) => {
        setSubmitting(false)
        if (ok) { clear(); showMsg('Request logged!') }
        else { showMsg('Could not add request') }
      }
    )
  }

  const canSubmit = !!song.trim() && !submitting

  return (
    <form className="card" onSubmit={submit}>
      <h3>Request a Track</h3>

      <div style={{ display:'grid', gap:8 }}>
        <input
          ref={songRef}
          className="input"
          placeholder="Song"
          value={song}
          onChange={(e) => setSong(e.target.value)}
          maxLength={120}
          autoComplete="off"
          inputMode="text"
        />
        <input
          className="input"
          placeholder="Artist (optional)"
          value={artist}
          onChange={(e) => setArtist(e.target.value)}
          maxLength={120}
          autoComplete="off"
        />
        <input
          className="input"
          placeholder="Note (dedication, shoutout — optional)"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={140}
          autoComplete="off"
        />
        <input
          className="input"
          placeholder="Your name (optional)"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={24}
          autoComplete="name"
        />
      </div>

      <div className="row" style={{ justifyContent:'flex-end', marginTop:10 }}>
        <button className="button" type="submit" disabled={!canSubmit}>
          {submitting ? 'Sending…' : 'Submit'}
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
  )
}
