- const DEFAULT_ROOM = 'AJAX'; // auto-join fallback
+ const DEFAULT_ROOM = 'AJAX'; // set to null to force manual join

  export default function App(){
-  const [phase, setPhase] = useState('join');
+  const [phase, setPhase] = useState('join');
   const [room, setRoom] = useState(null);
   const [queue, setQueue] = useState([]);
   const [msg, setMsg] = useState('');

   const joinInfo = useRef({ code: null, user: '' });

+  const joined = !!room?.code;

  const doJoin = ({ code, user = '' }) => {
    if (!code || code.length !== 4) return;
    const payload = { code: code.toUpperCase(), user: user?.slice(0,24) || '' };
    joinInfo.current = payload;
    try {
      localStorage.setItem('lastRoomCode', payload.code);
      if (user) localStorage.setItem('lastUser', user);
    } catch {}
    socket.emit('join', payload);
+   // do NOT flip phase here; wait for server 'state' to confirm join
  };

  // initial join: ?room=CODE → saved → DEFAULT_ROOM
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const fromQuery = params.get('room');
    const saved = (() => { try { return localStorage.getItem('lastRoomCode'); } catch { return null; }})();
    const user = (() => { try { return localStorage.getItem('lastUser') || ''; } catch { return ''; }})();
-   const code =
+   const code =
      (fromQuery && fromQuery.length === 4 && fromQuery.toUpperCase()) ||
      (saved && saved.length === 4 && saved.toUpperCase()) ||
      DEFAULT_ROOM; // <- ensures newcomers are in a room
-   doJoin({ code, user });
+   if (code) doJoin({ code, user });
+   else setPhase('join');
  }, []);

  useEffect(() => {
    const onState = (payload) => { setRoom(payload); setQueue(payload.queue || []); setPhase('room'); };
    ...
  }, []);

  // onSubmit that waits for server ACK
- const add = (req, done) => {
-   socket.emit('add_request', req, (resp) => {
-     if (resp && resp.ok) {
-       done?.(true);
-     } else {
-       showMsg('Could not add request');
-       done?.(false);
-     }
-   });
- };
+ const add = (req, done) => {
+   const code = room?.code || joinInfo.current?.code;
+   if (!code) {
+     showMsg('Connecting to room… please wait');
+     done?.(false);
+     return;
+   }
+   const payload = { ...req, room: code }; // include room defensively
+   let acked = false;
+   const timer = setTimeout(() => {
+     if (!acked) {
+       showMsg('No response from server. Check connection.');
+       done?.(false);
+     }
+   }, 6000);
+   socket.emit('add_request', payload, (resp) => {
+     acked = true;
+     clearTimeout(timer);
+     if (resp && resp.ok) {
+       done?.(true);
+     } else {
+       showMsg(resp?.error || 'Could not add request');
+       done?.(false);
+     }
+   });
+ };

  const join = ({ code, user }) => doJoin({ code, user });
  const upvote = (id) => socket.emit('upvote', { id });

- if (phase === 'join') return <JoinRoom onJoin={join} />;
+ if (phase === 'join') return <JoinRoom onJoin={join} />;

  return (
    <div className="container">
      <Header room={room?.code} tipsUrl={room?.tipsUrl} />
      <div className="row" style={{ alignItems: 'flex-start' }}>
        <div style={{ flex: 3, display: 'grid', gap: 12 }}>
-         <RequestForm onSubmit={add} />
+         <RequestForm onSubmit={add} disabled={!joined} connecting={!joined} />
          <RequestList role="audience" items={queue} onUpvote={upvote} />
        </div>
        <div style={{ flex: 2, display: 'grid', gap: 12 }}>
          <DJControls queue={queue} roomMeta={room} />
          <QRJoin roomCode={room?.code} />
        </div>
      </div>
      <Toast msg={msg} />
    </div>
  );
}
