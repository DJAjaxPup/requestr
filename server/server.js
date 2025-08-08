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
const io = new Server(server, { cors: { origin: true, methods: ['GET', 'POST'] } });

const PORT = process.env.PORT || 4000;

/**
 * Room shape (in-memory):
 * {
 *   code, pin, name, tipsUrl, createdAt,
 *   requests: Map<id, { id, song, artist, note, user, votes, status, createdAt, voters:Set<string> }>,
 *   order: string[]
 * }
 */
const rooms = new Map();

// Rate limiting
const limiterByIP = new RateLimiterMemory({ points: 10, duration: 10 }); // 10 ops / 10s per IP
const limiterByUser = new RateLimiterMemory({ points: 5, duration: 10 }); // 5 ops / 10s per user

function createRoom({ name = 'New Room', pin, tipsUrl = '', code: codeOverride }) {
  let code = codeOverride
    ? String(codeOverride).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4)
    : nanoid();
  if (!code || code.length !== 4) code = nanoid();

  const room = {
    code,
    pin: String(pin || Math.floor(1000 + Math.random() * 9000)), // DJ PIN (private)
    name,
    tipsUrl,
    createdAt: Date.now(),
    requests: new Map(),
    order: []
  };
  rooms.set(code, room);
  return room;
}

// Boot room (fixed code for easy QR)
const defaultRoom = createRoom({
  name: process.env.ROOM_NAME || 'CityFest — The Loft',
  pin: process.env.ROOM_PIN || 2468,         // DJ PIN you enter in DJ panel
  tipsUrl: process.env.TIPS_URL || '',
  code: process.env.ROOM_CODE || 'AJAX'      // public 4-char join code
});
console.log(`[server] Room ${defaultRoom.name} => code=${defaultRoom.code}, DJ PIN=${defaultRoom.pin}`);

// REST helpers
app.get('/api/rooms/:code', (req, res) => {
  const room = rooms.get(req.params.code);
  if (!room) return res.status(404).json({ error: 'Room not found' });
  res.json({ code: room.code, name: room.name, tipsUrl: room.tipsUrl });
});

app.get('/health', (_req, res) => res.type('text').send('ok'));

// Socket guard
io.use(async (socket, next) => {
  try {
    await limiterByIP.consume(socket.handshake.address || 'unknown');
    next();
  } catch {
    next(new Error('Rate limit exceeded'));
  }
});

// Helper: strip non-serializable/internal fields before emitting
function publicEntry(entry) {
  const { voters, ...rest } = entry || {};
  return rest;
}

io.on('connection', (socket) => {
  socket.data = { roomCode: null, user: 'Guest', isDJ: false, uid: socket.id };

  // Audience/DJ join room
  socket.on('join', ({ code, user }) => {
    const room = rooms.get(code);
    if (!room) return socket.emit('error_msg', 'Room not found');
    socket.join(code);
    socket.data.roomCode = code;
    if (user) socket.data.user = String(user).slice(0, 24);
    socket.emit('state', serializeRoom(room, false));
  });

  // DJ auth (separate PIN)
  socket.on('dj_auth', ({ code, pin }) => {
    const room = rooms.get(code || socket.data.roomCode);
    if (!room) return socket.emit('dj_auth_err', 'Room not found');
    if (String(pin) !== String(room.pin)) return socket.emit('dj_auth_err', 'Invalid PIN');
    socket.data.isDJ = true;
    socket.data.roomCode = room.code;
    socket.join(room.code);
    socket.emit('dj_auth_ok', { room: serializeRoom(room, true) });
  });

  socket.on('dj_logout', () => {
    socket.data.isDJ = false;
    socket.emit('dj_auth_ok', { room: null });
  });

  // Add request
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
      createdAt: Date.now(),
      voters: new Set([socket.data.uid]) // first vote belongs to requester
    };
    room.requests.set(id, entry);
    room.order.push(id);
    io.to(room.code).emit('request_added', publicEntry(entry));
  });

  // Upvote (ONE vote per user per song)
  socket.on('upvote', async ({ id }) => {
    try { await limiterByUser.consume(`${socket.data.user}:${id}`); } catch { return; }
    const room = rooms.get(socket.data.roomCode);
    if (!room) return;
    const entry = room.requests.get(id);
    if (!entry) return;

    const voterKey = socket.data.uid; // could be replaced by a persistent user ID later
    if (entry.voters?.has(voterKey)) {
      socket.emit('error_msg', 'You’ve already voted for this song.');
      return;
    }

    if (!entry.voters) entry.voters = new Set();
    entry.voters.add(voterKey);
    entry.votes += 1;
    io.to(room.code).emit('request_updated', publicEntry(entry));
  });

  // DJ-only actions
  socket.on('dj_action', ({ action, payload }) => {
    const room = rooms.get(socket.data.roomCode);
    if (!room) return;
    if (!socket.data.isDJ) return socket.emit('error_msg', 'DJ auth required');

    if (action === 'set_status') {
      const { id, status } = payload || {};
      const entry = room.requests.get(id);
      if (!entry) return;
      entry.status = status; // 'queued' | 'playing' | 'done'
      io.to(room.code).emit('request_updated', publicEntry(entry));
    }

    if (action === 'reorder') {
      const { order } = payload || {};
      if (!Array.isArray(order)) return;
      const existing = new Set(room.order);
      room.order = order.filter((x) => existing.has(x));
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
    pinHint: forDJ ? `${String(room.pin)[0]}***` : undefined, // only reveal hint to DJ
    queue: room.order.map((id) => publicEntry(room.requests.get(id)))
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

app.get('*', (_req, res) => {
  res.set('Cache-Control', 'no-store');
  res.sendFile(path.join(clientDist, 'index.html'));
});

server.listen(PORT, () => console.log(`[server] Listening on :${PORT}`));
