import { useState, useEffect } from 'react';
import QRJoin from './components/QRJoin';
import RequestForm from './components/RequestForm';
import RequestList from './components/RequestList';
import DJTools from './components/DJTools';
import { joinRoom, sendRequest, upvoteRequest, markDone, fetchRequests } from './lib/api';

export default function App() {
  const [room, setRoom] = useState('');
  const [requests, setRequests] = useState([]);
  const [djMode, setDjMode] = useState(false);
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [userVotes, setUserVotes] = useState({}); // Track votes by request ID

  // Auto-refresh requests every 10 seconds
  useEffect(() => {
    if (!room) return;
    const load = async () => {
      try {
        const list = await fetchRequests(room);
        setRequests(list);
      } catch (err) {
        console.error('Error fetching requests', err);
      }
    };
    load();
    const t = setInterval(load, 10000);
    return () => clearInterval(t);
  }, [room]);

  const handleJoin = async (roomCode, djCode) => {
    setConnecting(true);
    try {
      const ok = await joinRoom(roomCode, djCode);
      if (ok) {
        setRoom(roomCode);
        setDjMode(!!djCode);
        setConnected(true);
      } else {
        alert('Could not join room');
      }
    } finally {
      setConnecting(false);
    }
  };

  const handleRequest = async (req, cb) => {
    try {
      const ok = await sendRequest(room, req);
      if (ok) {
        const list = await fetchRequests(room);
        setRequests(list);
      }
      cb(ok);
    } catch (err) {
      console.error(err);
      cb(false);
    }
  };

  const handleUpvote = async (id) => {
    // Prevent multiple votes for the same song
    if (userVotes[id]) return;
    try {
      const ok = await upvoteRequest(room, id);
      if (ok) {
        setUserVotes(prev => ({ ...prev, [id]: true }));
        const list = await fetchRequests(room);
        setRequests(list);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleMarkDone = async (id) => {
    try {
      const ok = await markDone(room, id);
      if (ok) {
        const list = await fetchRequests(room);
        setRequests(list);
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="app">
      {!connected ? (
        <QRJoin onJoin={handleJoin} connecting={connecting} />
      ) : (
        <>
          {!djMode && (
            <RequestForm
              onSubmit={handleRequest}
              disabled={!connected}
              connecting={connecting}
            />
          )}
          <RequestList
            requests={requests}
            onUpvote={handleUpvote}
            userVotes={userVotes}
            djMode={djMode}
          />
          {djMode && (
            <DJTools
              requests={requests}
              onMarkDone={handleMarkDone}
            />
          )}
        </>
      )}
    </div>
  );
}
