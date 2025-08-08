import 'dotenv/config';
import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import helmet from 'helmet';
import cors from 'cors';
import { customAlphabet } from 'nanoid';
import { RateLimiterMemory } from 'rate-limiter-flexible';
import path from 'path';
import { fileURLToPath } from 'url';


const nanoid = customAlphabet('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 4);

const app = express();
app.use(helmet());
app.use(cors({ origin: true }));
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: true, methods: ['GET', 'POST'] }
});

const PORT = process.env.PORT || 4000;

/**
 * In-memory store (swap for SQLite if you want persistence across restarts)
 * rooms = {
 *   ROOM: {
 *     code: 'ABCD', pin: '1234', name: 'Pawchella Day 3', tipsUrl: '',
 *     createdAt: Date,
 *     requests: {
 *       id: { id, song, artist, note, user, votes, status: 'queued'|'playing'|'done', createdAt }
 *     },
 *     order: [id, ...]
 *   }
 * }
 */
const rooms = new Map();

// Rate limiters
const limiterByIP = new RateLimiterMemory({ points: 10, duration: 10 }); // 10 ops per 10s
const limiterByUser = new RateLimiterMemory({ points: 5, duration: 10 }); // 5 ops per 10s

function createRoom({ name = 'New Room', pin, tipsUrl = '' }) {
  const code = nanoid();
  const room = {
    code,
    pin: String(pin || Math.floor(1000 + Math.random() * 9000)),
    name,
    tipsUrl,
    createdAt: Date.now(),
    requests: new Map(),
    order: []
  };
  rooms.set(code, room);
  return room;
}

// Create a quick room on boot for testing
const defaultRoom = createRoom({ name: 'Test Room', pin: 2468, tipsUrl: '' });
console.log(`[server] Room ${defaultRoom.name} => code=${defaultRoom.code}, DJ PIN=${defaultRoom.pin}`);

// REST helper (optional)
app.get('/api/rooms/:code', (req, res) => {
  const room = rooms.get(req.params.code);
  if (!room) return res.status(404).json({ error: 'Room not found' });
  res.json({ code: room.code, name: room.name, tipsUrl: room.tipsUrl });
});

io.use(async (socket, next) => {
  try {
    await limiterByIP.consume(socket.handshake.address);
    next();
  } catch {
    next(new Error('Rate limit exceeded'));
  }
});

io.on('connection', (socket) => {
  // Join room
  socket.on('join', async ({ code, user }) => {
    const room = rooms.get(code);
    if (!room) return socket.emit('error_msg', 'Room not found');
    socket.join(code);
    socket.data.roomCode = code;
    socket.data.user = user?.slice(0, 24) || 'Guest';

    // Send initial state
    const payload = serializeRoom(room);
    socket.emit('state', payload);
  });

  // Audience: add request
  socket.on('add_request', async (req) => {
    try { await limiterByUser.consume(socket.data.user || socket.id); } catch { return; }

    const room = rooms.get(socket.data.roomCode);
    if (!room) return;
    const id = `req_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const entry = {
      id,
      song: (req.song || '').slice(0, 80),
      artist: (req.artist || '').slice(0, 80),
      note: (req.note || '').slice(0, 160),
      user: (req.user || socket.data.user || 'Guest').slice(0, 24),
      votes: 1,
      status: 'queued',
      createdAt: Date.now()
    };
    room.requests.set(id, entry);
    room.order.push(id);
    io.to(room.code).emit('request_added', entry);
  });

  // Audience: upvote
  socket.on('upvote', async ({ id }) => {
    try { await limiterByUser.consume(`${socket.data.user}:${id}`); } catch { return; }
    const room = rooms.get(socket.data.roomCode);
    if (!room) return;
    const entry = room.requests.get(id);
    if (!entry) return;
    entry.votes += 1;
    io.to(room.code).emit('request_updated', entry);
  });

  // DJ auth check
  function isDJ(room, pin) {
    return String(pin) === String(room.pin);
  }

  // DJ: set status / reorder / delete
  socket.on('dj_action', ({ pin, action, payload }) => {
    const room = rooms.get(socket.data.roomCode);
    if (!room) return;
    if (!isDJ(room, pin)) return socket.emit('error_msg', 'Invalid PIN');

    if (action === 'set_status') {
      const { id, status } = payload;
      const entry = room.requests.get(id);
      if (!entry) return;
      entry.status = status; // 'queued' | 'playing' | 'done'
      io.to(room.code).emit('request_updated', entry);
    }

    if (action === 'reorder') {
      const { order } = payload; // array of ids
      // keep only known ids, preserve uniqueness
      const existing = new Set(room.order);
      const newOrder = order.filter((id) => existing.has(id));
      room.order = newOrder;
      io.to(room.code).emit('order_updated', room.order);
    }

    if (action === 'delete') {
      const { id } = payload;
      room.requests.delete(id);
      room.order = room.order.filter((x) => x !== id);
      io.to(room.code).emit('request_deleted', { id });
    }

    if (action === 'room_meta') {
      const { name, tipsUrl } = payload;
      if (typeof name === 'string') room.name = name.slice(0, 64);
      if (typeof tipsUrl === 'string') room.tipsUrl = tipsUrl.slice(0, 256);
      io.to(room.code).emit('room_updated', { name: room.name, tipsUrl: room.tipsUrl });
    }
  });

  socket.on('disconnect', () => {});
});

function serializeRoom(room) {
  return {
    code: room.code,
    name: room.name,
    tipsUrl: room.tipsUrl,
    pinHint: `${String(room.pin)[0]}***`, // hint the first digit only
    queue: room.order.map((id) => room.requests.get(id))
  };
}
// ---- serve built client (same-origin) ----
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const clientDist = path.join(__dirname, '../client/dist');
app.use(express.static(clientDist));

// Let the client handle routes (after API/socket paths)
app.get('*', (req, res) => {
  res.sendFile(path.join(clientDist, 'index.html'));
});


server.listen(PORT, () => console.log(`[server] Listening on :${PORT}`));
