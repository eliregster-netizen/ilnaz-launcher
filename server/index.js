const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { MongoClient, ObjectId } = require('mongodb');
const { GridFSBucket } = require('mongodb');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// GridFS setup
let gfsBucket;

function initGridFS(db) {
  gfsBucket = new GridFSBucket(db, { bucketName: 'uploads' });
}

// Multer config (memory storage for GridFS)
const storage = multer.memoryStorage();
const upload = multer({ storage, limits: { fileSize: 100 * 1024 * 1024 } });

const app = express();
const server = http.createServer(app);
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
  : ['http://localhost:5173', 'http://localhost:3000'];

const JWT_SECRET = process.env.JWT_SECRET || 'ilnaz-default-secret-change-in-production';

const io = new Server(server, {
  cors: { origin: ALLOWED_ORIGINS, credentials: true },
  maxHttpBufferSize: 15 * 1024 * 1024, // 15MB для поддержки файлов до 10MB в base64
});

app.use(cors({ origin: ALLOWED_ORIGINS, credentials: true }));
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  res.removeHeader('X-Powered-By');
  next();
});
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

const MONGO_URI = process.env.MONGO_URI;
if (!MONGO_URI) { console.error('MONGO_URI not set! Using fallback...'); }

let db, users, friendRequests, conversations, conversationMembers, messages, publicThemes;

async function connectDB() {
  if (!MONGO_URI) {
    console.error('MONGO_URI not set! Running without DB...');
    return;
  }
  try {
    const client = new MongoClient(MONGO_URI);
    await client.connect();
    db = client.db('ilnaz');
    users = db.collection('users');
    friendRequests = db.collection('friend_requests');
    conversations = db.collection('conversations');
    conversationMembers = db.collection('conversation_members');
    messages = db.collection('messages');
    playlists = db.collection('playlists');
    music = db.collection('music');
    publicThemes = db.collection('public_themes');
    
    // Init GridFS
    initGridFS(db);
    
    console.log('DB connected & GridFS initialized');
  } catch (err) {
    console.error('DB connection failed:', err.message);
  }
}

function generateId() { return crypto.randomUUID().slice(0, 8); }

async function getUser(id) {
  if (!users) {
    console.error('Database not connected yet!');
    return null;
  }
  const u = await users.findOne({ id });
  if (u) u.friends = u.friends || [];
  return u;
}

connectDB().catch(e => console.error(e));

function requireDB(req, res, next) {
  if (!db) {
    return res.status(503).json({ error: 'Database not connected' });
  }
  next();
}

app.use('/api', requireDB);

app.post('/api/register', async (req, res) => {
  try {
    const ip = getClientIp(req);
    if (!rateLimit(`register:${ip}`, RATE_LIMIT_MAX.register)) return res.status(429).json({ error: 'Too many requests' });
    const { username, password, nickname } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Username and password required' });
    if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });
    if (await users.findOne({ username })) return res.status(409).json({ error: 'Username already exists' });
    const userId = generateId();
    const count = await users.countDocuments();
    const role = count === 0 ? 'owner' : 'user';
    const hashedPassword = await bcrypt.hash(password, 10);
    await users.insertOne({
      id: userId, username, password: hashedPassword, nickname: nickname || username,
      avatar: null, banner: null, bio: 'Welcome to ILNAZ GAMING LAUNCHER!',
      status: 'offline', friends: [], games_played: 0, hours_played: 0,
      role, banned: false, created_at: new Date().toISOString(), last_seen: new Date().toISOString()
    });
    const user = await getUser(userId);
    const token = jwt.sign({ userId: user.id, role: user.role }, JWT_SECRET, { expiresIn: '30d' });
    res.json({ success: true, user, token });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/login', async (req, res) => {
  const ip = getClientIp(req);
  if (!rateLimit(`login:${ip}`, RATE_LIMIT_MAX.login)) return res.status(429).json({ error: 'Too many requests' });
  const { username, password } = req.body;
  const user = await users.findOne({ username });
  if (!user) return res.status(404).json({ error: 'User not found' });
  if (user.banned) return res.status(403).json({ error: 'Account is banned' });

  let validPassword = await bcrypt.compare(password, user.password);

  if (!validPassword && !user.password.startsWith('$2')) {
    validPassword = user.password === password;
    if (validPassword) {
      const hashed = await bcrypt.hash(password, 10);
      await users.updateOne({ id: user.id }, { $set: { password: hashed } });
    }
  }

  if (!validPassword) return res.status(401).json({ error: 'Wrong password' });
  await users.updateOne({ id: user.id }, { $set: { status: 'online', last_seen: new Date().toISOString() } });
  user.friends = user.friends || [];
  io.emit('user-status', { id: user.id, status: 'online' });
  const token = jwt.sign({ userId: user.id, role: user.role }, JWT_SECRET, { expiresIn: '30d' });
  res.json({ success: true, user, token });
});

app.get('/api/users/:id', async (req, res) => {
  const user = await getUser(req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json(user);
});

app.get('/api/users/by-username/:username', async (req, res) => {
  const user = await users.findOne({ username: req.params.username });
  if (!user) return res.status(404).json({ error: 'User not found' });
  user.friends = user.friends || [];
  res.json(user);
});

app.get('/api/search', async (req, res) => {
  const { q } = req.query;
  if (!q) return res.json([]);
  const found = await users.find({
    $or: [{ username: { $regex: q, $options: 'i' } }, { nickname: { $regex: q, $options: 'i' } }]
  }).limit(20).toArray();
  found.forEach(u => u.friends = u.friends || []);
  res.json(found);
});

app.post('/api/users/:id/status', authenticateToken, async (req, res) => {
  if (req.params.id !== req.userId) return res.status(403).json({ error: 'Not allowed' });
  const { status } = req.body;
  await users.updateOne({ id: req.params.id }, { $set: { status, last_seen: new Date().toISOString() } });
  io.emit('user-status', { id: req.params.id, status });
  res.json({ success: true });
});

app.put('/api/users/:id', authenticateToken, async (req, res) => {
  if (req.params.id !== req.userId) return res.status(403).json({ error: 'Not allowed' });
  const { nickname, avatar, banner, bio } = req.body;
  const updates = {};
  if (nickname !== undefined) updates.nickname = nickname;
  if (avatar !== undefined) updates.avatar = avatar;
  if (banner !== undefined) updates.banner = banner;
  if (bio !== undefined) updates.bio = bio;
  if (Object.keys(updates).length === 0) return res.json({ success: true });
  await users.updateOne({ id: req.params.id }, { $set: updates });
  res.json({ success: true, user: await getUser(req.params.id) });
});

app.put('/api/users/:id/stats', authenticateToken, async (req, res) => {
  if (req.params.id !== req.userId) return res.status(403).json({ error: 'Not allowed' });
  const { games_played, hours_played } = req.body;
  const user = await users.findOne({ id: req.params.id });
  const updates = {};
  if (games_played !== undefined) updates.games_played = (user.games_played || 0) + games_played;
  if (hours_played !== undefined) updates.hours_played = (user.hours_played || 0) + hours_played;
  if (Object.keys(updates).length === 0) return res.json({ success: true });
  await users.updateOne({ id: req.params.id }, { $set: updates });
  res.json({ success: true, user: await getUser(req.params.id) });
});

app.post('/api/friends/request', authenticateToken, async (req, res) => {
  const { toId } = req.body;
  const fromId = req.userId;
  if (fromId === toId) return res.status(400).json({ error: 'Cannot add yourself' });
  const toUser = await getUser(toId);
  if (toUser && (toUser.friends || []).includes(fromId)) return res.status(409).json({ error: 'Already friends' });
  const reqId = generateId();
  const existing = await friendRequests.findOne({ from_id: fromId, to_id: toId });
  if (existing) {
    if (existing.status === 'pending') return res.status(409).json({ error: 'Request already sent' });
    await friendRequests.updateOne({ id: existing.id }, { $set: { status: 'pending' } });
    io.to(toId).emit('friend-request', { fromId });
    return res.json({ success: true, resent: true });
  }
  await friendRequests.insertOne({ id: reqId, from_id: fromId, to_id: toId, status: 'pending', created_at: new Date().toISOString() });
  io.to(toId).emit('friend-request', { fromId });
  res.json({ success: true });
});

app.get('/api/friends/pending/:userId', async (req, res) => {
  const reqs = await friendRequests.find({ to_id: req.params.userId, status: 'pending' }).toArray();
  const results = [];
  for (const fr of reqs) {
    const u = await getUser(fr.from_id);
    if (u) results.push({ ...fr, nickname: u.nickname, username: u.username, avatar: u.avatar, status: u.status, role: u.role });
  }
  res.json(results);
});

app.get('/api/friends/sent/:userId', async (req, res) => {
  const reqs = await friendRequests.find({ from_id: req.params.userId, status: 'pending' }).toArray();
  const results = [];
  for (const fr of reqs) {
    const u = await getUser(fr.to_id);
    if (u) results.push({ ...fr, nickname: u.nickname, username: u.username, avatar: u.avatar, status: u.status, role: u.role });
  }
  res.json(results);
});

app.put('/api/friends/accept/:requestId', authenticateToken, async (req, res) => {
  const userId = req.userId;
  const request = await friendRequests.findOne({ id: req.params.requestId, to_id: userId, status: 'pending' });
  if (!request) return res.status(404).json({ error: 'Request not found' });
  await users.updateOne({ id: userId }, { $addToSet: { friends: request.from_id } });
  await users.updateOne({ id: request.from_id }, { $addToSet: { friends: userId } });
  await friendRequests.updateOne({ id: request.id }, { $set: { status: 'accepted' } });
  io.emit('friend-accepted', { userId, friendId: request.from_id });
  res.json({ success: true });
});

app.delete('/api/friends/decline/:requestId', authenticateToken, async (req, res) => {
  const userId = req.userId;
  const request = await friendRequests.findOne({ id: req.params.requestId, to_id: userId, status: 'pending' });
  if (!request) return res.status(404).json({ error: 'Request not found' });
  await friendRequests.updateOne({ id: request.id }, { $set: { status: 'declined' } });
  res.json({ success: true });
});

// Cancel a sent friend request (only by the sender)
app.delete('/api/friends/request/:requestId', authenticateToken, async (req, res) => {
  const userId = req.userId;
  const request = await friendRequests.findOne({ id: req.params.requestId, from_id: userId, status: 'pending' });
  if (!request) return res.status(404).json({ error: 'Request not found or already processed' });
  await friendRequests.updateOne({ id: request.id }, { $set: { status: 'cancelled' } });
  res.json({ success: true });
});

app.delete('/api/friends/remove/:friendId', authenticateToken, async (req, res) => {
  const userId = req.userId;
  const friendId = req.params.friendId;
  await users.updateOne({ id: userId }, { $pull: { friends: friendId } });
  await users.updateOne({ id: friendId }, { $pull: { friends: userId } });
  const u = await getUser(userId);
  res.json({ success: true, friends: u.friends });
});

app.get('/api/friends/list/:userId', async (req, res) => {
  const user = await getUser(req.params.userId);
  if (!user) return res.status(404).json({ error: 'User not found' });
  const friends = [];
  for (const id of (user.friends || [])) { const f = await getUser(id); if (f) friends.push(f); }
  res.json(friends);
});

function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Authentication required' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.userId = decoded.userId;
    req.userRole = decoded.role;
    next();
  } catch (err) {
    return res.status(403).json({ error: 'Invalid or expired token' });
  }
}

async function requireAdmin(req, res, next) {
  const user = await users.findOne({ id: req.userId });
  console.log('[Admin Check] userId:', req.userId, 'userRole:', user?.role, 'username:', user?.username);
  if (!user || (user.role !== 'admin' && user.role !== 'owner')) return res.status(403).json({ error: 'Admin access required' });
  next();
}

app.get('/api/admin/users', authenticateToken, requireAdmin, async (req, res) => {
  const us = await users.find().sort({ created_at: -1 }).toArray();
  console.log('[Admin Users] Found', us.length, 'users');
  us.forEach(u => u.friends = u.friends || []);
  res.json(us);
});

app.delete('/api/admin/users/:id', authenticateToken, requireAdmin, async (req, res) => {
  const target = await users.findOne({ id: req.params.id });
  if (target && target.role === 'owner') return res.status(403).json({ error: 'Cannot modify the owner' });
  await friendRequests.deleteMany({ $or: [{ from_id: req.params.id }, { to_id: req.params.id }] });
  await users.deleteOne({ id: req.params.id });
  io.emit('user-deleted', { id: req.params.id });
  res.json({ success: true });
});

app.put('/api/admin/users/:id/ban', authenticateToken, requireAdmin, async (req, res) => {
  const target = await users.findOne({ id: req.params.id });
  if (target && target.role === 'owner') return res.status(403).json({ error: 'Cannot modify the owner' });
  const { banned } = req.body;
  await users.updateOne({ id: req.params.id }, { $set: { banned, status: banned ? 'banned' : 'offline' } });
  if (banned) io.emit('user-banned', { id: req.params.id });
  res.json({ success: true });
});

app.put('/api/admin/users/:id/edit', authenticateToken, requireAdmin, async (req, res) => {
  const target = await users.findOne({ id: req.params.id });
  if (target && target.role === 'owner') return res.status(403).json({ error: 'Cannot modify the owner' });
  const { nickname, avatar, banner, bio, role, games_played, hours_played } = req.body;
  const updates = {};
  if (nickname !== undefined) updates.nickname = nickname;
  if (avatar !== undefined) updates.avatar = avatar;
  if (banner !== undefined) updates.banner = banner;
  if (bio !== undefined) updates.bio = bio;
  if (role !== undefined && target.role !== 'owner') updates.role = role;
  if (games_played !== undefined) updates.games_played = games_played;
  if (hours_played !== undefined) updates.hours_played = hours_played;
  if (Object.keys(updates).length === 0) return res.json({ success: true });
  await users.updateOne({ id: req.params.id }, { $set: updates });
  res.json({ success: true, user: await getUser(req.params.id) });
});

app.get('/api/admin/stats', authenticateToken, requireAdmin, async (req, res) => {
  res.json({
    totalUsers: await users.countDocuments(),
    totalAdmins: await users.countDocuments({ role: 'admin' }),
    totalOwners: await users.countDocuments({ role: 'owner' }),
    totalBanned: await users.countDocuments({ banned: true }),
    onlineUsers: await users.countDocuments({ status: 'online' })
  });
});

const activeCalls = {};

const rateLimitMap = {};
const RATE_LIMIT_WINDOW = 60 * 1000;
const RATE_LIMIT_MAX = { login: 10, register: 5, general: 30 };

function rateLimit(key, limit = RATE_LIMIT_MAX.general) {
  const now = Date.now();
  if (!rateLimitMap[key]) rateLimitMap[key] = [];
  rateLimitMap[key] = rateLimitMap[key].filter(t => now - t < RATE_LIMIT_WINDOW);
  if (rateLimitMap[key].length >= limit) return false;
  rateLimitMap[key].push(now);
  return true;
}

function getClientIp(req) {
  return req.headers['x-forwarded-for'] || req.connection.remoteAddress || 'unknown';
}

const cleanupInterval = setInterval(() => {
  const now = Date.now();
  for (const convId in activeCalls) {
    const call = activeCalls[convId];
    if (call.joined.length === 0 || (now - call.createdAt > 30 * 60 * 1000)) {
      call.joined.forEach(mid => io.to(mid).emit('call-ended', { conversationId: convId }));
      delete activeCalls[convId];
    }
  }
}, 5 * 60 * 1000);

io.on('connection', (socket) => {
  // Восстанавливаем userId из socket.data при reconnect
  let currentUserId = socket.data.userId || null;

  socket.on('join', (userId) => {
    currentUserId = userId;
    socket.data.userId = userId; // Сохраняем для reconnect
    socket.join(userId);
  });

  socket.on('join-conversation', (conversationId) => socket.join(conversationId));
  socket.on('leave-conversation', (conversationId) => socket.leave(conversationId));
  socket.on('send-message', async (data) => {
    if (!currentUserId) return;
    const { conversationId, content, image, file, fileName, fileType, fileSize } = data;
    const member = await conversationMembers.findOne({ conversation_id: conversationId, user_id: currentUserId });
    if (!member) return;
    const msgId = generateId();
    await messages.insertOne({
      id: msgId, conversation_id: conversationId, sender_id: currentUserId,
      content: content || '', image: image || null,
      file: file || null, file_name: fileName || null, file_type: fileType || null, file_size: fileSize || null,
      edited: false, deleted: false, created_at: new Date().toISOString()
    });
    const sender = await getUser(currentUserId);
    io.to(conversationId).emit('new-message', {
      id: msgId, conversation_id: conversationId, sender_id: currentUserId,
      content: content || '', image: image || null,
      file: file || null, file_name: fileName || null, file_type: fileType || null, file_size: fileSize || null,
      edited: false, deleted: false, created_at: new Date().toISOString(),
      nickname: sender.nickname, username: sender.username, avatar: sender.avatar
    });
  });
  socket.on('typing', (data) => socket.to(data.conversationId).emit('user-typing', data));

  socket.on('call-start', async (data) => {
    const conv = await conversations.findOne({ id: data.conversationId });
    if (!conv) return;
    const memberIds = conv.members || [];
    if (!memberIds.some(m => m.id === data.initiatorId)) return;
    activeCalls[data.conversationId] = {
      initiatorId: data.initiatorId,
      joined: [data.initiatorId],
      memberIds: memberIds.map(m => m.id),
      createdAt: Date.now(),
    };
    memberIds.forEach(mid => {
      if (mid.id !== data.initiatorId) {
        io.to(mid.id).emit('call-incoming', {
          conversationId: data.conversationId,
          initiatorId: data.initiatorId,
        });
      }
    });
  });

  socket.on('call-join-request', async (data) => {
    const call = activeCalls[data.conversationId];
    if (!call) return;
    const conv = await conversations.findOne({ id: data.conversationId });
    if (!conv) return;
    const memberIds = conv.members || [];
    if (!memberIds.some(m => m.id === data.userId)) return;
    if (call.joined.includes(data.userId)) return;
    call.joined.push(data.userId);
    io.to(call.initiatorId).emit('call-peer-joined', {
      conversationId: data.conversationId,
      userId: data.userId,
      joined: call.joined,
    });
  });

  socket.on('call-offer', (data) => {
    io.to(data.to).emit('call-offer', {
      from: data.from,
      conversationId: data.conversationId,
      sdp: data.sdp,
    });
  });

  socket.on('call-answer', (data) => {
    io.to(data.to).emit('call-answer', {
      from: data.from,
      conversationId: data.conversationId,
      sdp: data.sdp,
    });
  });

  socket.on('call-signal', (data) => {
    io.to(data.to).emit('call-signal', data);
  });

  socket.on('call-mute', (data) => {
    const call = activeCalls[data.conversationId];
    if (call) {
      call.joined.forEach(mid => {
        if (mid !== data.userId) io.to(mid).emit('call-member-muted', { userId: data.userId, muted: data.muted });
      });
    }
  });

  socket.on('call-leave', (data) => {
    const call = activeCalls[data.conversationId];
    if (call) {
      call.joined = call.joined.filter(id => id !== data.userId);
      call.joined.forEach(mid => {
        io.to(mid).emit('call-peer-left', {
          conversationId: data.conversationId,
          userId: data.userId,
          joined: call.joined,
        });
      });
      if (call.joined.length === 0) {
        delete activeCalls[data.conversationId];
      } else if (data.userId === call.initiatorId && call.joined.length > 0) {
        call.initiatorId = call.joined[0];
        call.joined.forEach(mid => {
          io.to(mid).emit('call-initiator-changed', {
            conversationId: data.conversationId,
            newInitiatorId: call.initiatorId,
            joined: call.joined,
          });
        });
      }
    }
  });

  socket.on('call-end', (data) => {
    const call = activeCalls[data.conversationId];
    if (call) {
      call.joined.forEach(mid => io.to(mid).emit('call-ended', { conversationId: data.conversationId }));
    }
    delete activeCalls[data.conversationId];
  });

  socket.on('disconnect', () => {
    if (currentUserId) {
      for (const convId in activeCalls) {
        if (activeCalls[convId].joined.includes(currentUserId)) {
          activeCalls[convId].joined = activeCalls[convId].joined.filter(id => id !== currentUserId);
          activeCalls[convId].joined.forEach(mid => {
            io.to(mid).emit('call-peer-left', {
              conversationId: convId,
              userId: currentUserId,
              joined: activeCalls[convId].joined,
            });
          });
          if (activeCalls[convId].joined.length === 0) {
            delete activeCalls[convId];
          } else if (currentUserId === activeCalls[convId].initiatorId && activeCalls[convId].joined.length > 0) {
            activeCalls[convId].initiatorId = activeCalls[convId].joined[0];
            activeCalls[convId].joined.forEach(mid => {
              io.to(mid).emit('call-initiator-changed', {
                conversationId: convId,
                newInitiatorId: activeCalls[convId].initiatorId,
                joined: activeCalls[convId].joined,
              });
            });
          }
        }
      }
    }
  });
});

app.post('/api/chat/conversations', authenticateToken, async (req, res) => {
  const { type, name, memberIds } = req.body;
  const creatorId = req.userId;
  if (!creatorId || !memberIds || memberIds.length === 0) return res.status(400).json({ error: 'Missing required fields' });
  if (type === 'private' && memberIds.length !== 1) return res.status(400).json({ error: 'Private chat needs exactly 1 user' });
  if (type === 'private') {
    const otherUserId = memberIds[0];
    const memberDocs = await conversationMembers.find({ user_id: otherUserId }).toArray();
    const otherConvIds = memberDocs.map(m => m.conversation_id);
    if (otherConvIds.length > 0) {
      const existing = await conversations.findOne({ id: { $in: otherConvIds }, type: 'private' });
      if (existing) {
        const existingMembers = await conversationMembers.find({ conversation_id: existing.id }).toArray();
        const existingUserIds = existingMembers.map(m => m.user_id);
        if (existingUserIds.includes(creatorId)) {
          return res.json({ success: true, conversationId: existing.id, existing: true });
        }
      }
    }
  }
  const convId = generateId() + generateId();
  await conversations.insertOne({ id: convId, type, name: name || null, icon: null, description: null, creator_id: creatorId, created_at: new Date().toISOString() });
  for (const mid of [...memberIds, creatorId]) await conversationMembers.insertOne({ conversation_id: convId, user_id: mid, last_read_msg: 0, joined_at: new Date().toISOString() });
  const conv = await conversations.findOne({ id: convId });
  io.to(creatorId).emit('new-conversation', { conversationId: convId, conversation: conv });
  for (const mid of memberIds) io.to(mid).emit('new-conversation', { conversationId: convId, conversation: conv });
  res.json({ success: true, conversationId: convId });
});

app.get('/api/chat/conversations/:userId', async (req, res) => {
  const userId = req.params.userId;
  const memberDocs = await conversationMembers.find({ user_id: userId }).toArray();
  const convIds = memberDocs.map(m => m.conversation_id);
  const convs = await conversations.find({ id: { $in: convIds } }).toArray();
  const results = [];
  for (const c of convs) {
    const unread = await messages.countDocuments({ conversation_id: c.id, sender_id: { $ne: userId }, deleted: false });
    const lastMsg = await messages.findOne({ conversation_id: c.id, deleted: false }, { sort: { created_at: -1 } });
    const otherMember = await conversationMembers.findOne({ conversation_id: c.id, user_id: { $ne: userId } });
    const otherUser = otherMember ? await getUser(otherMember.user_id) : null;
    results.push({
      ...c, unread_count: unread,
      last_message: lastMsg ? lastMsg.content : null,
      last_message_time: lastMsg ? lastMsg.created_at : null,
      other_user_name: otherUser ? otherUser.nickname : null,
      other_user_avatar: otherUser ? otherUser.avatar : null,
      other_user_id: otherUser ? otherUser.id : null,
      other_user_status: otherUser ? otherUser.status : null
    });
  }
  res.json(results);
});

app.get('/api/chat/messages/:conversationId', async (req, res) => {
  const { limit = 50, before } = req.query;
  let query = { conversation_id: req.params.conversationId };
  if (before) {
    const beforeMsg = await messages.findOne({ id: before });
    if (beforeMsg) query.created_at = { $lt: beforeMsg.created_at };
  }
  const msgs = await messages.find(query).sort({ created_at: 1 }).limit(parseInt(limit)).toArray();
  const senderIds = [...new Set(msgs.map(m => m.sender_id))];
  const senders = await users.find({ id: { $in: senderIds } }).toArray();
  const senderMap = {};
  senders.forEach(s => senderMap[s.id] = s);
  res.json(msgs.map(m => ({ ...m, nickname: senderMap[m.sender_id]?.nickname, username: senderMap[m.sender_id]?.username, avatar: senderMap[m.sender_id]?.avatar })));
});

app.get('/api/chat/conversation/:conversationId', async (req, res) => {
  const conv = await conversations.findOne({ id: req.params.conversationId });
  if (!conv) return res.status(404).json({ error: 'Conversation not found' });
  const memberDocs = await conversationMembers.find({ conversation_id: req.params.conversationId }).toArray();
  const members = [];
  for (const md of memberDocs) { const u = await getUser(md.user_id); if (u) members.push({ ...u, last_read_msg: md.last_read_msg }); }
  conv.members = members;
  res.json(conv);
});

app.put('/api/chat/messages/:messageId', authenticateToken, async (req, res) => {
  const { content } = req.body;
  const msg = await messages.findOne({ id: req.params.messageId });
  if (!msg || msg.sender_id !== req.userId) return res.status(403).json({ error: 'Not allowed' });
  if (msg.deleted) return res.status(400).json({ error: 'Message deleted' });
  await messages.updateOne({ id: msg.id }, { $set: { content, edited: true } });
  io.to(msg.conversation_id).emit('message-edited', { messageId: msg.id, content, conversationId: msg.conversation_id });
  res.json({ success: true });
});

app.delete('/api/chat/messages/:messageId', authenticateToken, async (req, res) => {
  const msg = await messages.findOne({ id: req.params.messageId });
  if (!msg || msg.sender_id !== req.userId) return res.status(403).json({ error: 'Not allowed' });
  await messages.updateOne({ id: msg.id }, { $set: { deleted: true, content: '' } });
  io.to(msg.conversation_id).emit('message-deleted', { messageId: msg.id, conversationId: msg.conversation_id });
  res.json({ success: true });
});

app.put('/api/chat/conversations/:conversationId/read', authenticateToken, async (req, res) => {
  const { lastMsgId } = req.body;
  await conversationMembers.updateOne({ conversation_id: req.params.conversationId, user_id: req.userId }, { $set: { last_read_msg: lastMsgId } });
  res.json({ success: true });
});

app.post('/api/chat/conversations/:conversationId/leave', authenticateToken, async (req, res) => {
  await conversationMembers.deleteOne({ conversation_id: req.params.conversationId, user_id: req.userId });
  io.to(req.params.conversationId).emit('member-left', { conversationId: req.params.conversationId, userId: req.userId });
  res.json({ success: true });
});

app.put('/api/chat/conversations/:conversationId/add-members', authenticateToken, async (req, res) => {
  const { newMemberIds } = req.body;
  if (!newMemberIds || newMemberIds.length === 0) return res.status(400).json({ error: 'No members to add' });
  const member = await conversationMembers.findOne({ conversation_id: req.params.conversationId, user_id: req.userId });
  if (!member) return res.status(403).json({ error: 'Not a member' });
  const conv = await conversations.findOne({ id: req.params.conversationId });
  if (!conv || conv.type === 'private') return res.status(400).json({ error: 'Can only add members to groups' });
  for (const mid of newMemberIds) {
    const alreadyMember = await conversationMembers.findOne({ conversation_id: req.params.conversationId, user_id: mid });
    if (alreadyMember) continue;
    await conversationMembers.insertOne({ conversation_id: req.params.conversationId, user_id: mid, last_read_msg: 0, joined_at: new Date().toISOString() });
    const newMember = await getUser(mid);
    const msgId = generateId();
    await messages.insertOne({
      id: msgId, conversation_id: req.params.conversationId, sender_id: 'system',
      content: `${newMember ? newMember.nickname : 'Пользователь'} был добавлен сюда`,
      image: null, edited: false, deleted: false, is_system: true,
      created_at: new Date().toISOString()
    });
    io.to(req.params.conversationId).emit('new-message', {
      id: msgId, conversation_id: req.params.conversationId, sender_id: 'system',
      content: `${newMember ? newMember.nickname : 'Пользователь'} был добавлен сюда`,
      image: null, edited: false, deleted: false, is_system: true,
      created_at: new Date().toISOString(), nickname: 'System', username: 'system', avatar: null
    });
    io.to(mid).emit('new-conversation', { conversationId: req.params.conversationId, conversation: await conversations.findOne({ id: req.params.conversationId }) });
  }
  io.to(req.params.conversationId).emit('members-added', { conversationId: req.params.conversationId, newMemberIds });
  res.json({ success: true });
});

// Remove a member from a group conversation (creator or admin only)
app.delete('/api/chat/conversations/:conversationId/members/:memberId', authenticateToken, async (req, res) => {
  const conv = await conversations.findOne({ id: req.params.conversationId });
  if (!conv) return res.status(404).json({ error: 'Conversation not found' });
  if (conv.type === 'private') return res.status(400).json({ error: 'Cannot remove members from private chat' });
  const actor = await conversationMembers.findOne({ conversation_id: req.params.conversationId, user_id: req.userId });
  if (!actor) return res.status(403).json({ error: 'Not a member' });
  // Only creator can remove members, or member can remove themselves
  const targetId = req.params.memberId;
  const isSelf = targetId === req.userId;
  const isCreator = conv.creator_id === req.userId;
  if (!isSelf && !isCreator) return res.status(403).json({ error: 'Only creator can remove other members' });
  // Prevent creator from removing themselves (they must transfer or delete)
  if (isSelf && isCreator) return res.status(400).json({ error: 'Creator cannot leave. Transfer ownership or delete the group' });
  await conversationMembers.deleteOne({ conversation_id: req.params.conversationId, user_id: targetId });
  const removedUser = await getUser(targetId);
  const msgId = generateId();
  await messages.insertOne({
    id: msgId, conversation_id: req.params.conversationId, sender_id: 'system',
    content: `${removedUser ? removedUser.nickname : 'Пользователь'} покинул группу`,
    image: null, edited: false, deleted: false, is_system: true,
    created_at: new Date().toISOString()
  });
  io.to(req.params.conversationId).emit('new-message', {
    id: msgId, conversation_id: req.params.conversationId, sender_id: 'system',
    content: `${removedUser ? removedUser.nickname : 'Пользователь'} покинул группу`,
    image: null, edited: false, deleted: false, is_system: true,
    created_at: new Date().toISOString(), nickname: 'System', username: 'system', avatar: null
  });
  io.to(req.params.conversationId).emit('member-removed', { conversationId: req.params.conversationId, memberId: targetId });
  io.to(targetId).emit('conversation-deleted', { conversationId: req.params.conversationId });
  res.json({ success: true });
});

app.put('/api/chat/conversations/:conversationId/edit', authenticateToken, async (req, res) => {
  const { name, icon, description } = req.body;
  const conv = await conversations.findOne({ id: req.params.conversationId });
  if (!conv) return res.status(404).json({ error: 'Conversation not found' });
  if (!await conversationMembers.findOne({ conversation_id: req.params.conversationId, user_id: req.userId })) return res.status(403).json({ error: 'Not a member' });
  const updates = {};
  if (name !== undefined) updates.name = name;
  if (icon !== undefined) updates.icon = icon;
  if (description !== undefined) updates.description = description;
  if (Object.keys(updates).length === 0) return res.json({ success: true, conversation: conv });
  await conversations.updateOne({ id: req.params.conversationId }, { $set: updates });
  const updated = await conversations.findOne({ id: req.params.conversationId });
  io.to(req.params.conversationId).emit('conversation-updated', { conversationId: req.params.conversationId, conversation: updated });
  res.json({ success: true, conversation: updated });
});

app.delete('/api/chat/conversations/:conversationId', authenticateToken, async (req, res) => {
  const conv = await conversations.findOne({ id: req.params.conversationId });
  if (!conv) return res.status(404).json({ error: 'Conversation not found' });
  if (conv.creator_id !== req.userId) return res.status(403).json({ error: 'Only creator can delete' });
  await messages.deleteMany({ conversation_id: req.params.conversationId });
  await conversationMembers.deleteMany({ conversation_id: req.params.conversationId });
  await conversations.deleteOne({ id: req.params.conversationId });
  io.to(req.params.conversationId).emit('conversation-deleted', { conversationId: req.params.conversationId });
  res.json({ success: true });
});

// --- Themes API ---

app.get('/api/themes/public', async (req, res) => {
  try {
    const themes = await publicThemes.find().sort({ created_at: -1 }).toArray();
    for (const t of themes) {
      if (t.authorId) {
        const u = await users.findOne({ id: t.authorId });
        t.authorAvatar = u?.avatar || null;
        t.authorRole = u?.role || null;
      }
      // Merge data fields if they exist separately
      if (t.data && !t.colors) {
        t.colors = t.data.colors;
        t.background = t.data.background;
        t.launcherTitle = t.data.launcherTitle;
      }
    }
    res.json({ themes });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/themes/publish', authenticateToken, async (req, res) => {
  try {
    const { name, version, description, launcherTitle, colors, data, background } = req.body;
    if (!name) return res.status(400).json({ error: 'Theme name required' });
    const user = await getUser(req.userId);
    
    // Store full data object or merge individual fields
    const themeData = data || {
      name,
      version: version || '1.0',
      description: description || '',
      launcherTitle: launcherTitle || null,
      colors: colors || {},
      background: background || null,
    };
    
    const theme = {
      id: generateId(),
      name: themeData.name,
      author: user ? user.nickname : 'Аноним',
      authorId: req.userId,
      authorRole: user?.role || null,
      version: themeData.version,
      description: themeData.description,
      launcherTitle: themeData.launcherTitle,
      colors: themeData.colors,
      background: themeData.background,
      data: { ...themeData, author: user ? user.nickname : 'Аноним', authorRole: user?.role || null },
      created_at: new Date().toISOString(),
      downloads: 0,
    };
    await publicThemes.insertOne(theme);
    res.json({ success: true, theme });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/themes/download/:themeId', async (req, res) => {
  try {
    const themeId = req.params.themeId;
    console.log('Download request for:', themeId);
    // Try to find by id or _id
    let theme = await publicThemes.findOne({ id: themeId });
    if (!theme) theme = await publicThemes.findOne({ _id: new ObjectId(themeId) });
    console.log('Found theme:', theme ? theme.name : 'null');
    if (!theme) return res.status(404).json({ error: 'Theme not found' });
    await publicThemes.updateOne({ id: theme.id }, { $inc: { downloads: 1 } });
    if (theme.authorId) {
      const u = await users.findOne({ id: theme.authorId });
      theme.authorAvatar = u?.avatar || null;
    }
    // Return full theme data - try data field first, fallback to individual fields
    const fullData = theme.data || {
      name: theme.name,
      author: theme.author,
      version: theme.version,
      description: theme.description,
      launcherTitle: theme.launcherTitle,
      colors: theme.colors,
      background: theme.background,
    };
    console.log('Returning data:', fullData.name);
    res.json({ success: true, data: fullData });
  } catch (err) { 
    console.error('Download error:', err);
    res.status(500).json({ error: err.message }); 
  }
});

app.delete('/api/themes/public/:themeId', authenticateToken, async (req, res) => {
  try {
    const themeId = req.params.themeId;
    console.log('Delete request for:', themeId, 'userId:', req.userId);
    // Try to find by id or _id
    let theme = await publicThemes.findOne({ id: themeId });
    if (!theme) theme = await publicThemes.findOne({ _id: new ObjectId(themeId) });
    if (!theme) {
      // Check all themes to debug
      const allThemes = await publicThemes.find().limit(5).toArray();
      console.log('Available themes:', allThemes.map(t => ({ id: t.id, _id: t._id, name: t.name })));
      return res.status(404).json({ error: 'Theme not found' });
    }
    console.log('Found theme:', theme.name, 'authorId:', theme.authorId);
    const user = await getUser(req.userId);
    console.log('User found:', user?.id, user?.role, 'username:', user?.username);
    if (!user) return res.status(403).json({ error: 'User not found' });
    if (user.role !== 'admin' && user.role !== 'owner' && theme.authorId !== req.userId) {
      console.log('Forbidden - user role:', user.role, 'theme authorId:', theme.authorId, 'req.userId:', req.userId);
      return res.status(403).json({ error: 'Forbidden' });
    }
    await publicThemes.deleteOne({ id: themeId });
    console.log('Theme deleted successfully');
    res.json({ success: true });
  } catch (err) { 
    console.error('Delete error:', err);
    res.status(500).json({ error: err.message }); 
  }
});

const PORT = process.env.PORT || 3001;

// ============ MUSIC API ============

// Serve music files from GridFS
app.get('/music/:filename', async (req, res) => {
  try {
    const filename = req.params.filename;
    const filesCollection = db.collection('uploads.files');
    const fileDoc = await filesCollection.findOne({ filename });
    
    if (!fileDoc) {
      // Try default
      const defaultFile = path.join(__dirname, '../public/default-track.mp3');
      if (fs.existsSync(defaultFile)) {
        return res.sendFile(defaultFile);
      }
      return res.status(404).json({ error: 'File not found' });
    }
    
    res.set('Content-Type', fileDoc.contentType || 'audio/mpeg');
    res.set('Content-Length', fileDoc.length);
    
    const downloadStream = gfsBucket.openDownloadStreamByName(filename);
    downloadStream.pipe(res);
  } catch (err) {
    console.error('[GridFS] Error serving music:', err);
    res.status(500).json({ error: err.message });
  }
});

// Serve cover images from GridFS
app.get('/uploads/covers/:filename', async (req, res) => {
  try {
    const filename = req.params.filename;
    const filesCollection = db.collection('uploads.files');
    const fileDoc = await filesCollection.findOne({ filename });
    
    if (!fileDoc) {
      const defaultFile = path.join(__dirname, '../public/default-cover.jpg');
      if (fs.existsSync(defaultFile)) {
        return res.sendFile(defaultFile);
      }
      return res.status(404).json({ error: 'File not found' });
    }
    
    res.set('Content-Type', fileDoc.contentType || 'image/jpeg');
    res.set('Content-Length', fileDoc.length);
    
    const downloadStream = gfsBucket.openDownloadStreamByName(filename);
    downloadStream.pipe(res);
  } catch (err) {
    console.error('[GridFS] Error serving cover:', err);
    res.status(500).json({ error: err.message });
  }
});



app.get('/api/music', async (_req, res) => {
  try {
    const tracks = await music.find().sort({ created_at: -1 }).toArray();
    res.json({ tracks });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/music', authenticateToken, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const user = await getUser(req.userId);
    
    // Upload to GridFS
    const filename = `${crypto.randomBytes(8).toString('hex')}${path.extname(req.file.originalname)}`;
    const uploadStream = gfsBucket.openUploadStream(filename, {
      contentType: req.file.mimetype,
      metadata: { originalName: req.file.originalname, userId: req.userId }
    });
    
    uploadStream.end(req.file.buffer);
    
    await new Promise((resolve, reject) => {
      uploadStream.on('finish', resolve);
      uploadStream.on('error', reject);
    });
    
    const track = {
      id: generateId(),
      filename: filename,
      originalName: req.file.originalname,
      author: user ? user.nickname : 'Аноним',
      authorId: req.userId,
      authorRole: user?.role || null,
      size: req.file.size,
      format: path.extname(req.file.originalname).slice(1).toLowerCase(),
      path: `/music/${filename}`,
      cover: null,
      duration: 0,
      playCount: 0,
      created_at: new Date().toISOString(),
    };
    
    await music.insertOne(track);
    await users.updateOne({ id: req.userId }, { $push: { uploadedTracks: track.id } });
    
    res.json({ success: true, track });
  } catch (err) {
    console.error('[Music Upload] Error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/music/:trackId', authenticateToken, async (req, res) => {
  try {
    const trackId = req.params.trackId;
    let track = await music.findOne({ id: trackId });
    if (!track) track = await music.findOne({ _id: new ObjectId(trackId) });
    if (!track) return res.status(404).json({ error: 'Track not found' });
    
    const user = await getUser(req.userId);
    if (user.role !== 'admin' && user.role !== 'owner' && track.authorId !== req.userId) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    
    const filePath = path.join(MUSIC_DIR, track.filename);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    await music.deleteOne({ id: trackId });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// === PLAYLISTS API ===
let playlists;
app.post('/api/playlists', authenticateToken, upload.single('cover'), async (req, res) => {
  try {
    const user = await getUser(req.userId);
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'Name required' });
    
    const playlist = {
      id: generateId(),
      name,
      author: user ? user.nickname : 'Аноним',
      authorId: req.userId,
      authorRole: user?.role || null,
      cover: req.file ? `/uploads/covers/${req.file.filename}` : null,
      tracks: [],
      created_at: new Date().toISOString(),
    };
    await playlists.insertOne(playlist);
    res.json({ success: true, playlist });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/playlists', async (_req, res) => {
  try {
    const all = await playlists.find().sort({ created_at: -1 }).toArray();
    res.json({ playlists: all });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/playlists/:id', authenticateToken, async (req, res) => {
  try {
    let pl = await playlists.findOne({ id: req.params.id });
    if (!pl) pl = await playlists.findOne({ _id: new ObjectId(req.params.id) });
    if (!pl) return res.status(404).json({ error: 'Not found' });
    res.json({ playlist: pl });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/playlists/:id', authenticateToken, upload.single('cover'), async (req, res) => {
  try {
    let pl = await playlists.findOne({ id: req.params.id });
    if (!pl) pl = await playlists.findOne({ _id: new ObjectId(req.params.id) });
    if (!pl) return res.status(404).json({ error: 'Not found' });
    
    const user = await getUser(req.userId);
    if (user.role !== 'admin' && user.role !== 'owner' && pl.authorId !== req.userId) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    
    const updates = {};
    if (req.body.name) updates.name = req.body.name;
    if (req.file) updates.cover = `/uploads/covers/${req.file.filename}`;
    
    await playlists.updateOne({ id: req.params.id }, { $set: updates });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/playlists/:id', authenticateToken, async (req, res) => {
  try {
    let pl = await playlists.findOne({ id: req.params.id });
    if (!pl) pl = await playlists.findOne({ _id: new ObjectId(req.params.id) });
    if (!pl) return res.status(404).json({ error: 'Not found' });
    
    const user = await getUser(req.userId);
    if (user.role !== 'admin' && user.role !== 'owner' && pl.authorId !== req.userId) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    
    // Delete cover file
    if (pl.cover) {
      const coverPath = path.join(__dirname, pl.cover);
      if (fs.existsSync(coverPath)) fs.unlinkSync(coverPath);
    }
    
    await playlists.deleteOne({ id: req.params.id });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Add track to playlist
app.post('/api/playlists/:id/add', authenticateToken, async (req, res) => {
  try {
    let pl = await playlists.findOne({ id: req.params.id });
    if (!pl) pl = await playlists.findOne({ _id: new ObjectId(req.params.id) });
    if (!pl) return res.status(404).json({ error: 'Not found' });
    
    const { trackId } = req.body;
    if (!trackId) return res.status(400).json({ error: 'trackId required' });
    
    // Check if track exists
    let track = await music.findOne({ id: trackId });
    if (!track) track = await music.findOne({ _id: new ObjectId(trackId) });
    if (!track) return res.status(404).json({ error: 'Track not found' });
    
    // Add if not already in playlist
    if (!pl.tracks.includes(trackId)) {
      await playlists.updateOne({ id: req.params.id }, { $push: { tracks: trackId } });
    }
    
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Remove track from playlist
app.delete('/api/playlists/:id/remove/:trackId', authenticateToken, async (req, res) => {
  try {
    let pl = await playlists.findOne({ id: req.params.id });
    if (!pl) pl = await playlists.findOne({ _id: new ObjectId(req.params.id) });
    if (!pl) return res.status(404).json({ error: 'Not found' });
    
    const user = await getUser(req.userId);
    if (user.role !== 'admin' && user.role !== 'owner' && pl.authorId !== req.userId) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    
    await playlists.updateOne({ id: req.params.id }, { $pull: { tracks: req.params.trackId } });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Upload track cover
app.post('/api/music/:id/cover', authenticateToken, upload.single('cover'), async (req, res) => {
  try {
    let track = await music.findOne({ id: req.params.id });
    if (!track) track = await music.findOne({ _id: new ObjectId(req.params.id) });
    if (!track) return res.status(404).json({ error: 'Track not found' });

    const user = await getUser(req.userId);
    if (user.role !== 'admin' && user.role !== 'owner' && track.authorId !== req.userId) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    if (!req.file) return res.status(400).json({ error: 'No cover uploaded' });

    // Upload cover to GridFS
    const coverFilename = `${crypto.randomBytes(8).toString('hex')}${path.extname(req.file.originalname)}`;
    const uploadStream = gfsBucket.openUploadStream(coverFilename, {
      contentType: req.file.mimetype,
      metadata: { originalName: req.file.originalname, type: 'cover', trackId: req.params.id }
    });
    
    uploadStream.end(req.file.buffer);
    
    await new Promise((resolve, reject) => {
      uploadStream.on('finish', resolve);
      uploadStream.on('error', reject);
    });

    const coverPath = `/uploads/covers/${coverFilename}`;
    await music.updateOne({ id: req.params.id }, { $set: { cover: coverPath } });
    res.json({ success: true, cover: coverPath });
  } catch (err) {
    console.error('[Cover Upload] Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Update track duration
app.post('/api/music/:id/duration', authenticateToken, async (req, res) => {
  try {
    const { duration } = req.body;
    await music.updateOne({ id: req.params.id }, { $set: { duration: parseFloat(duration) || 0 } });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Increment play count
app.post('/api/music/:id/play', authenticateToken, async (req, res) => {
  try {
    await music.updateOne({ id: req.params.id }, { $inc: { playCount: 1 } });
    const track = await music.findOne({ id: req.params.id });
    res.json({ success: true, playCount: track?.playCount || 0 });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Playlist play count (sum of track play counts)
app.get('/api/playlists/:id/play-count', async (req, res) => {
  try {
    let pl = await playlists.findOne({ id: req.params.id });
    if (!pl) pl = await playlists.findOne({ _id: new ObjectId(req.params.id) });
    if (!pl) return res.status(404).json({ error: 'Not found' });

    let totalPlays = 0;
    for (const trackId of pl.tracks) {
      const track = await music.findOne({ id: trackId });
      if (track) totalPlays += (track.playCount || 0);
    }

    res.json({ playCount: totalPlays });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Simple healthcheck (no DB needed)
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Serve static frontend files
const DIST_DIR = path.join(__dirname, '../dist');
if (fs.existsSync(DIST_DIR)) {
  app.use(express.static(DIST_DIR));
  // SPA fallback
  app.get('*', (_req, res) => {
    res.sendFile(path.join(DIST_DIR, 'index.html'));
  });
}

server.listen(PORT, () => console.log(`ILNAZ GAMING SERVER running on port ${PORT}`));
