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
const io = new Server(server, { cors: { origin: true, methods: ['GET', 'POST'] } });

const PORT = process.env.PORT || 4000;

/**
 * In-memory store
 * rooms = Map(code -> {
 *   code, pin, name, tipsUrl, createdAt,
 *   requests: Map(id -> { id, song, artist, note, user, votes, status, createdAt }),
 *   order: [id, ...]
 * })
 */
const rooms = new Map();

// Rate limiters
const limiterByIP = new RateLimiterMemory({ points: 10, duration: 10 }); // 10 ops/10s per IP
const limiterByUser = new RateLimiterMemory({ points: 5, duration: 10 }); // 5 ops/10s per user

function createRoom({ name = 'New Room', pin, tipsUrl = '', code: codeOverride }) {
  let code = codeOverride
    ? String(codeOverride).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4)
    : nanoid();
  if (!code || code.length !== 4) code = nanoid();

  const room = {
    code,
    pin: String(pin || Math.floor(1000 + Math.random() * 9000)), // **DJ PIN** (secret)
    name,
    tipsUrl,
    createdAt: Date.now(),
    requests: new Map(),
    order: []
  };
  rooms.set(code, room);
  return room;
}

// Boot room (no more "Test Room"); force pretty code if provided
const defaultRoom = createRoom({
  name: process.env.ROOM_NAME || 'CityFest — The Loft',
  pin: process.env.ROOM_PIN || 2468,         // <- DJ PIN (keep private)
  tipsUrl: process.env.TIPS_URL || '',
  code: process.env.ROOM_CODE || 'AJAX'      // <- 4-char public room code for QR/join
});
console.log(`[server] Room ${defaultRoom.name} => code=${defaultRoom.code}, DJ PIN=${defaultRoom.pin}`);

app.get('/api/rooms/:code', (req, res) => {
  const room = rooms.get(req.params.code);
  if (!room) return res.status(404).json({ error: 'Room not found' });
  res.json({ code: room.code, name: room.name, tipsUrl: room.tipsUrl });
});

app.get('/health', (_req, res) => res.type('text').send('ok'));

io.use(async (socket, next) => {
  try {
    await limiterByIP.consume(socket.handshake.address || 'unknown');
    next();
  } catch {
    next(new Error('Rate limit exceeded'));
  }
});

io.on('connection', (socket) => {
  socket.data = { roomCode: null, user: 'Guest', isDJ: false };

  // Join room (audience or DJ both join the same room channel)
  socket.on('join', ({ code, user }) => {
    const room = rooms.get(code);
    if (!room) return socket.emit('error_msg', 'Room not found');
    socket.join(code);
    socket.data.roomCode = code;
    if (user) socket.data.user = String(user).slice(0, 24);
    socket.emit('state', serializeRoom(room, /*forDJ*/ false));
  });

  // DJ authentication — separate from audience
  socket.on('dj_auth', ({ code, pin }) => {
    const room = rooms.get(code || socket.data.roomCode);
    if (!room) return socket.emit('dj_auth_err', 'Room not found');
    if (String(pin) !== String(room.pin)) return socket.emit('dj_auth_err', 'Invalid PIN');
    socket.data.isDJ = true;
    socket.data.roomCode = room.code;
    socket.join(room.code); // ensure joined
    socket.emit('dj_auth_ok', { room: serializeRoom(room, /*forDJ*/ true) });
  });

  socket.on('dj_logout', () => {
    socket.data.isDJ = false;
    socket.emit('dj_auth_ok', { room: null });
  });

  // Audience: add request
  socket.on('add_request', async (req) => {
    try { await limiterByUser.consume(socket.data.user || socket.id); } catch { return; }
    const room = rooms.get(socket.data.roomCode);
    if (!room) return;

    const id = `req_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const entry = {
      id,
      song: (req?.song || '').slice(0, 80),
      artist: (req?.artist || '').slice(0, 80),
      note: (req?.note || '').slice(0, 160),
      user: (req?.user || socket.data.user || 'Guest').slice(0, 24),
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

  // DJ-only actions (now session-based; no PIN in payload)
  socket.on('dj_action', ({ action, payload }) => {
    const room = rooms.get(socket.data.roomCode);
    if (!room) return;
    if (!socket.data.isDJ) return socket.emit('error_msg', 'DJ auth required');

    if (action === 'set_status') {
      const { id, status } = payload || {};
      const entry = room.requests.get(id);
      if (!entry) return;
      entry.status = status; // 'queued' | 'playing' | 'done'
      io.to(room.code).emit('request_updated', entry);
    }

    if (action === 'reorder') {
      const { order } = payload || {};
      if (!Array.isArray(order)) return;
      const existing = new Set(room.order);
      room.order = order.filter((id) => existing.has(id));
      io.to(room.code).emit('order_updated', room.order);
    }

    if (action === 'delete') {
      const { id } = payload || {};
      room.requests.delete(id);
      room.order = room.order.filter((x) => x !== id);
      io.to(room.code).emit('request_deleted', { id });
    }

    if (action === 'room_meta') {
      const { name, tipsUrl } = payload || {};
      if (typeof name === 'string') room.name = name.slice(0, 64);
      if (typeof tipsUrl === 'string') room.tipsUrl = tipsUrl.slice(0, 256);
      io.to(room.code).emit('room_updated', { name: room.name, tipsUrl: room.tipsUrl });
    }
  });

  socket.on('disconnect', () => {});
});

function serializeRoom(room, forDJ = false) {
  return {
    code: room.code,
    name: room.name,
    tipsUrl: room.tipsUrl,
    // No pinHint to audience anymore; only DJ sees meta after auth
    pinHint: forDJ ? `${String(room.pin)[0]}***` : undefined,
    queue: room.order.map((id) => room.requests.get(id))
  };
}

// ---- serve built client (same-origin SPA) ----
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const clientDist = path.join(__dirname, '../client/dist');

app.use(express.static(clientDist, { maxAge: '1y', etag: true, lastModified: true }));

try {
  const assetsDir = path.join(clientDist, 'assets');
  const files = fs.existsSync(assetsDir) ? fs.readdirSync(assetsDir).slice(0, 10) : [];
  console.log('[server] Serving client from:', clientDist);
  console.log('[server] Dist assets sample:', files);
} catch (e) {
  console.log('[server] Dist not found yet at', clientDist, e.message);
}

// Never cache index.html so updates show up immediately
app.get('*', (req, res) => {
  res.set('Cache-Control', 'no-store');
  res.sendFile(path.join(clientDist, 'index.html'));
});

server.listen(PORT, () => console.log(`[server] Listening on :${PORT}`));
