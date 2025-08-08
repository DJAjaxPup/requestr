// server/server.js
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import helmet from 'helmet';
import cors from 'cors';
import { customAlphabet } from 'nanoid';
import { RateLimiterMemory } from 'rate-limiter-flexible';

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
 *     code: 'ABCD', pin: '1234', name: 'CityFest — The Loft', tipsUrl: '',
 *     createdAt: Date,
 *     requests: Map(id -> { id, song, artist, note, user, votes, status, createdAt }),
 *     order: [id, ...]
 *   }
 * }
 */
const rooms = new Map();

// Rate limiters
const limiterByIP = new RateLimiterMemory({ points: 10, duration: 10 }); // 10 ops per 10s per IP
const limiterByUser = new RateLimiterMemory({ points: 5, duration: 10 }); // 5 ops per 10s per user

function createRoom({ name = 'New Room', pin, tipsUrl = '', code: codeOverride }) {
  // Optional: deterministic 4-char room code via env (e.g., AJAX)
  let code = codeOverride
    ? String(codeOverride).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4)
    : nanoid();

  if (!code || code.length !== 4) code = nanoid();

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

// ---- Boot a room for the event (no more "Test Room") ----
const defaultRoom = createRoom({
  name: process.env.ROOM_NAME || 'CityFest — The Loft',
  pin: process.env.ROOM_PIN || 2468,
  tipsUrl: process.env.TIPS_URL || '',
  code: process.env.ROOM_CODE // Optional: set to 'AJAX' to force ?room=AJAX
});
console.log(`[server] Room ${defaultRoom.name} => code=${defaultRoom.code}, DJ PIN=${defaultRoom.pin}`);

// REST helper (optional)
app.get('/api/rooms/:code', (req, res) => {
  const room = rooms.get(req.params.code);
  if (!room) return res.status(404).json({ error: 'Room not found' });
  res.json({ code: room.code, name: room.name, tipsUrl: room.tipsUrl });
});

// Simple health check
app.get('/health', (_req, res) => res.type('text').send('ok'));

// Socket rate-limit by IP
io.use(async (socket, next) => {
  try {
    await limiterByIP.consume(socket.handshake.address || 'unknown');
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
    socket.emit('state', serializeRoom(room));
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

  // DJ: set status / reorder / delete / room meta
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
app.use(express.static(clientDist, {
  // hashed assets can be cached; index.html will be no-store below
  maxAge: '1y',
  etag: true,
  lastModified: true,
}));

// Log what we’re serving (helps confirm new builds on Render)
try {
  const assetsDir = path.join(clientDist, 'assets');
  const files = fs.existsSync(assetsDir) ? fs.readdirSync(assetsDir).slice(0, 10) : [];
  console.log('[server] Serving client from:', clientDist);
  console.log('[server] Dist assets sample:', files);
} catch (e) {
  console.log('[server] Dist not found yet at', clientDist, e.message);
}

// SPA fallback — never cache index.html so new builds show up immediately
app.get('*', (req, res) => {
  res.set('Cache-Control', 'no-store');
  res.sendFile(path.join(clientDist, 'index.html'));
});

server.listen(PORT, () => console.log(`[server] Listening on :${PORT}`));
