const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const Database = require('better-sqlite3');
const path = require('path');
const crypto = require('crypto');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' },
});

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

const DB_PATH = path.join(__dirname, 'ilnaz.db');
const db = new Database(DB_PATH);

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    nickname TEXT NOT NULL,
    avatar TEXT DEFAULT NULL,
    banner TEXT DEFAULT NULL,
    bio TEXT DEFAULT 'Welcome to ILNAZ GAMING LAUNCHER!',
    status TEXT DEFAULT 'offline',
    friends TEXT DEFAULT '[]',
    games_played INTEGER DEFAULT 0,
    hours_played REAL DEFAULT 0,
    role TEXT DEFAULT 'user',
    banned INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_seen DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS friend_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    from_id TEXT NOT NULL,
    to_id TEXT NOT NULL,
    status TEXT DEFAULT 'pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(from_id, to_id),
    FOREIGN KEY (from_id) REFERENCES users(id),
    FOREIGN KEY (to_id) REFERENCES users(id)
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS conversations (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL DEFAULT 'private',
    name TEXT DEFAULT NULL,
    icon TEXT DEFAULT NULL,
    description TEXT DEFAULT NULL,
    creator_id TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (creator_id) REFERENCES users(id)
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS conversation_members (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    conversation_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    last_read_msg INTEGER DEFAULT 0,
    joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(conversation_id, user_id),
    FOREIGN KEY (conversation_id) REFERENCES conversations(id),
    FOREIGN KEY (user_id) REFERENCES users(id)
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    conversation_id TEXT NOT NULL,
    sender_id TEXT NOT NULL,
    content TEXT NOT NULL DEFAULT '',
    image TEXT DEFAULT NULL,
    edited INTEGER DEFAULT 0,
    deleted INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (conversation_id) REFERENCES conversations(id),
    FOREIGN KEY (sender_id) REFERENCES users(id)
  )
`);

function isAdmin(userId) {
  const user = db.prepare('SELECT role FROM users WHERE id = ?').get(userId);
  return user && (user.role === 'admin' || user.role === 'owner');
}

function isOwner(userId) {
  const user = db.prepare('SELECT role FROM users WHERE id = ?').get(userId);
  return user && user.role === 'owner';
}

function requireAdmin(req, res, next) {
  const userId = req.headers['x-user-id'];
  if (!userId || !isAdmin(userId)) {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}

function protectOwner(targetId) {
  if (isOwner(targetId)) {
    return { error: 'Cannot modify the owner', forbidden: true };
  }
  return null;
}

function generateId() {
  return crypto.randomUUID().slice(0, 8);
}

app.post('/api/register', (req, res) => {
  try {
    const { username, password, nickname } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required' });
    }
    const userId = generateId();
    const displayName = nickname || username;
    const stmt = db.prepare(
      `INSERT INTO users (id, username, password, nickname) VALUES (?, ?, ?, ?)`
    );
    stmt.run(userId, username, password, displayName);
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
    user.friends = JSON.parse(user.friends);
    res.json({ success: true, user });
  } catch (err) {
    if (err.message.includes('UNIQUE')) {
      return res.status(409).json({ error: 'Username already exists' });
    }
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }
  if (user.banned) {
    return res.status(403).json({ error: 'Account is banned' });
  }
  if (user.password !== password) {
    return res.status(401).json({ error: 'Wrong password' });
  }
  db.prepare('UPDATE users SET status = ?, last_seen = CURRENT_TIMESTAMP WHERE id = ?')
    .run('online', user.id);
  user.friends = JSON.parse(user.friends);
  io.emit('user-status', { id: user.id, status: 'online' });
  res.json({ success: true, user });
});

app.get('/api/users/:id', (req, res) => {
  const user = db.prepare('SELECT id, username, nickname, avatar, banner, bio, status, friends, games_played, hours_played, role, banned, created_at, last_seen FROM users WHERE id = ?').get(req.params.id);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }
  user.friends = JSON.parse(user.friends);
  res.json(user);
});

app.get('/api/users/by-username/:username', (req, res) => {
  const user = db.prepare('SELECT id, username, nickname, avatar, banner, bio, status, friends, games_played, hours_played, role, banned, created_at, last_seen FROM users WHERE username = ?').get(req.params.username);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }
  user.friends = JSON.parse(user.friends);
  res.json(user);
});

app.get('/api/search', (req, res) => {
  const { q } = req.query;
  if (!q) return res.json([]);
  const users = db.prepare(
    `SELECT id, username, nickname, avatar, banner, bio, status, friends, games_played, hours_played, role, banned
     FROM users 
     WHERE username LIKE ? OR nickname LIKE ? OR id LIKE ?
     LIMIT 20`
  ).all(`%${q}%`, `%${q}%`, `%${q}%`);
  users.forEach(u => u.friends = JSON.parse(u.friends || '[]'));
  res.json(users);
});

app.post('/api/users/:id/status', (req, res) => {
  const { status } = req.body;
  db.prepare('UPDATE users SET status = ?, last_seen = CURRENT_TIMESTAMP WHERE id = ?')
    .run(status, req.params.id);
  io.emit('user-status', { id: req.params.id, status });
  res.json({ success: true });
});

app.put('/api/users/:id', (req, res) => {
  const { nickname, avatar, banner, bio } = req.body;
  const updates = [];
  const values = [];
  if (nickname !== undefined) { updates.push('nickname = ?'); values.push(nickname); }
  if (avatar !== undefined) { updates.push('avatar = ?'); values.push(avatar); }
  if (banner !== undefined) { updates.push('banner = ?'); values.push(banner); }
  if (bio !== undefined) { updates.push('bio = ?'); values.push(bio); }
  if (updates.length === 0) return res.json({ success: true });
  values.push(req.params.id);
  db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).run(...values);
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  user.friends = JSON.parse(user.friends);
  res.json({ success: true, user });
});

app.post('/api/friends/request', (req, res) => {
  const { fromId, toId } = req.body;
  if (fromId === toId) return res.status(400).json({ error: 'Cannot add yourself' });
  const user = db.prepare('SELECT friends FROM users WHERE id = ?').get(toId);
  if (user && JSON.parse(user.friends).includes(fromId)) {
    return res.status(409).json({ error: 'Already friends' });
  }
  const existing = db.prepare('SELECT id, status FROM friend_requests WHERE from_id = ? AND to_id = ?')
    .get(fromId, toId);
  if (existing) {
    if (existing.status === 'pending') return res.status(409).json({ error: 'Request already sent' });
    if (existing.status === 'declined') {
      db.prepare('UPDATE friend_requests SET status = ? WHERE id = ?').run('pending', existing.id);
      io.to(toId).emit('friend-request', { fromId });
      return res.json({ success: true, resent: true });
    }
    if (existing.status === 'accepted') {
      db.prepare('UPDATE friend_requests SET status = ? WHERE id = ?').run('pending', existing.id);
      io.to(toId).emit('friend-request', { fromId });
      return res.json({ success: true, resent: true });
    }
  }
  db.prepare('INSERT INTO friend_requests (from_id, to_id) VALUES (?, ?)').run(fromId, toId);
  io.to(toId).emit('friend-request', { fromId });
  res.json({ success: true });
});

app.get('/api/friends/pending/:userId', (req, res) => {
  const requests = db.prepare(`
    SELECT fr.id, fr.from_id as fromId, fr.created_at as createdAt,
           u.nickname, u.username, u.avatar, u.status, u.role
    FROM friend_requests fr
    JOIN users u ON fr.from_id = u.id
    WHERE fr.to_id = ? AND fr.status = ?
  `).all(req.params.userId, 'pending');
  res.json(requests);
});

app.get('/api/friends/sent/:userId', (req, res) => {
  const requests = db.prepare(`
    SELECT fr.id, fr.to_id as toId, fr.created_at as createdAt,
           u.nickname, u.username, u.avatar, u.status, u.role
    FROM friend_requests fr
    JOIN users u ON fr.to_id = u.id
    WHERE fr.from_id = ? AND fr.status = ?
  `).all(req.params.userId, 'pending');
  res.json(requests);
});

app.put('/api/friends/accept/:requestId', (req, res) => {
  const { userId } = req.body;
  const request = db.prepare('SELECT * FROM friend_requests WHERE id = ? AND to_id = ? AND status = ?')
    .get(req.params.requestId, userId, 'pending');
  if (!request) return res.status(404).json({ error: 'Request not found' });
  const toUser = db.prepare('SELECT friends FROM users WHERE id = ?').get(userId);
  const fromFriends = JSON.parse(toUser.friends);
  fromFriends.push(request.from_id);
  db.prepare('UPDATE users SET friends = ? WHERE id = ?').run(JSON.stringify(fromFriends), userId);
  const fromUser = db.prepare('SELECT friends FROM users WHERE id = ?').get(request.from_id);
  const toFriends = JSON.parse(fromUser.friends);
  toFriends.push(userId);
  db.prepare('UPDATE users SET friends = ? WHERE id = ?').run(JSON.stringify(toFriends), request.from_id);
  db.prepare('UPDATE friend_requests SET status = ? WHERE id = ?').run('accepted', req.params.requestId);
  io.emit('friend-accepted', { userId, friendId: request.from_id });
  res.json({ success: true });
});

app.delete('/api/friends/decline/:requestId', (req, res) => {
  const { userId } = req.body;
  const request = db.prepare('SELECT * FROM friend_requests WHERE id = ? AND to_id = ? AND status = ?')
    .get(req.params.requestId, userId, 'pending');
  if (!request) return res.status(404).json({ error: 'Request not found' });
  db.prepare('UPDATE friend_requests SET status = ? WHERE id = ?').run('declined', req.params.requestId);
  res.json({ success: true });
});

app.delete('/api/friends/remove/:userId/:friendId', (req, res) => {
  const user = db.prepare('SELECT friends FROM users WHERE id = ?').get(req.params.userId);
  if (!user) return res.status(404).json({ error: 'User not found' });
  const friends = JSON.parse(user.friends).filter(f => f !== req.params.friendId);
  db.prepare('UPDATE users SET friends = ? WHERE id = ?').run(JSON.stringify(friends), req.params.userId);
  const friend = db.prepare('SELECT friends FROM users WHERE id = ?').get(req.params.friendId);
  if (friend) {
    const theirFriends = JSON.parse(friend.friends).filter(f => f !== req.params.userId);
    db.prepare('UPDATE users SET friends = ? WHERE id = ?').run(JSON.stringify(theirFriends), req.params.friendId);
  }
  res.json({ success: true, friends });
});

app.get('/api/friends/list/:userId', (req, res) => {
  const user = db.prepare('SELECT friends FROM users WHERE id = ?').get(req.params.userId);
  if (!user) return res.status(404).json({ error: 'User not found' });
  const friendIds = JSON.parse(user.friends);
  const friends = [];
  for (const id of friendIds) {
    const friend = db.prepare('SELECT id, username, nickname, avatar, banner, bio, status, games_played, hours_played FROM users WHERE id = ?').get(id);
    if (friend) friends.push(friend);
  }
  res.json(friends);
});

app.get('/api/admin/users', requireAdmin, (req, res) => {
  const users = db.prepare('SELECT id, username, nickname, avatar, banner, bio, status, friends, games_played, hours_played, role, banned, created_at, last_seen FROM users ORDER BY created_at DESC').all();
  users.forEach(u => u.friends = JSON.parse(u.friends || '[]'));
  res.json(users);
});

app.delete('/api/admin/users/:id', requireAdmin, (req, res) => {
  const protected = protectOwner(req.params.id);
  if (protected) return res.status(403).json(protected);
  db.prepare('DELETE FROM friend_requests WHERE from_id = ? OR to_id = ?').run(req.params.id, req.params.id);
  db.prepare('UPDATE users SET friends = ? WHERE id != ?').run('[]', req.params.id);
  db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id);
  io.emit('user-deleted', { id: req.params.id });
  res.json({ success: true });
});

app.put('/api/admin/users/:id/ban', requireAdmin, (req, res) => {
  const protected = protectOwner(req.params.id);
  if (protected) return res.status(403).json(protected);
  const { banned } = req.body;
  const status = banned ? 'banned' : 'offline';
  db.prepare('UPDATE users SET banned = ?, status = ? WHERE id = ?').run(banned ? 1 : 0, status, req.params.id);
  if (banned) {
    io.emit('user-banned', { id: req.params.id });
  }
  res.json({ success: true });
});

app.put('/api/admin/users/:id/edit', requireAdmin, (req, res) => {
  const protected = protectOwner(req.params.id);
  if (protected) return res.status(403).json(protected);
  const { nickname, avatar, banner, bio, role, games_played, hours_played } = req.body;
  const targetRole = db.prepare('SELECT role FROM users WHERE id = ?').get(req.params.id).role;
  if (targetRole === 'owner' && role !== undefined) {
    return res.status(403).json({ error: 'Cannot change owner role' });
  }
  const updates = [];
  const values = [];
  if (nickname !== undefined) { updates.push('nickname = ?'); values.push(nickname); }
  if (avatar !== undefined) { updates.push('avatar = ?'); values.push(avatar); }
  if (banner !== undefined) { updates.push('banner = ?'); values.push(banner); }
  if (bio !== undefined) { updates.push('bio = ?'); values.push(bio); }
  if (role !== undefined && targetRole !== 'owner') { updates.push('role = ?'); values.push(role); }
  if (games_played !== undefined) { updates.push('games_played = ?'); values.push(games_played); }
  if (hours_played !== undefined) { updates.push('hours_played = ?'); values.push(hours_played); }
  if (updates.length === 0) return res.json({ success: true });
  values.push(req.params.id);
  db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).run(...values);
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  user.friends = JSON.parse(user.friends);
  res.json({ success: true, user });
});

app.get('/api/admin/stats', requireAdmin, (req, res) => {
  const totalUsers = db.prepare('SELECT COUNT(*) as count FROM users').get().count;
  const totalAdmins = db.prepare('SELECT COUNT(*) as count FROM users WHERE role = ?').get('admin').count;
  const totalOwners = db.prepare('SELECT COUNT(*) as count FROM users WHERE role = ?').get('owner').count;
  const totalBanned = db.prepare('SELECT COUNT(*) as count FROM users WHERE banned = 1').get().count;
  const onlineUsers = db.prepare('SELECT COUNT(*) as count FROM users WHERE status = ?').get('online').count;
  res.json({ totalUsers, totalAdmins, totalOwners, totalBanned, onlineUsers });
});

io.on('connection', (socket) => {
  socket.on('join', (userId) => {
    socket.join(userId);
  });
  socket.on('join-conversation', (conversationId) => {
    socket.join(conversationId);
  });
  socket.on('leave-conversation', (conversationId) => {
    socket.leave(conversationId);
  });
  socket.on('send-message', (data) => {
    const { conversationId, senderId, content, image } = data;
    const member = db.prepare('SELECT 1 FROM conversation_members WHERE conversation_id = ? AND user_id = ?').get(conversationId, senderId);
    if (!member) return;
    const result = db.prepare('INSERT INTO messages (conversation_id, sender_id, content, image) VALUES (?, ?, ?, ?)').run(conversationId, senderId, content || '', image || null);
    const msg = db.prepare(`
      SELECT m.*, u.nickname, u.username, u.avatar
      FROM messages m JOIN users u ON m.sender_id = u.id
      WHERE m.id = ?
    `).get(result.lastInsertRowid);
    io.to(conversationId).emit('new-message', msg);
  });
  socket.on('typing', (data) => {
    const { conversationId, userId } = data;
    socket.to(conversationId).emit('user-typing', { conversationId, userId });
  });
  socket.on('disconnect', () => {});
});

// === CHAT ENDPOINTS ===

app.post('/api/chat/conversations', (req, res) => {
  const { creatorId, type, name, memberIds } = req.body;
  if (!creatorId || !memberIds || memberIds.length === 0) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  if (type === 'private' && memberIds.length !== 1) {
    return res.status(400).json({ error: 'Private chat requires exactly 1 other user' });
  }
  if (type === 'private') {
    const existing = db.prepare(`
      SELECT c.id FROM conversations c
      JOIN conversation_members cm1 ON c.id = cm1.conversation_id
      JOIN conversation_members cm2 ON c.id = cm2.conversation_id
      WHERE c.type = 'private' AND cm1.user_id = ? AND cm2.user_id = ?
    `).get(creatorId, memberIds[0]);
    if (existing) return res.json({ success: true, conversationId: existing.id, existing: true });
  }
  const convId = generateId() + generateId();
  db.prepare('INSERT INTO conversations (id, type, name, creator_id) VALUES (?, ?, ?, ?)')
    .run(convId, type, name || null, creatorId);
  const allMembers = [...memberIds, creatorId];
  const stmt = db.prepare('INSERT INTO conversation_members (conversation_id, user_id) VALUES (?, ?)');
  const insertMany = db.transaction((members) => {
    for (const mid of members) stmt.run(convId, mid);
  });
  insertMany(allMembers);
  const conv = db.prepare('SELECT * FROM conversations WHERE id = ?').get(convId);
  io.to(creatorId).emit('new-conversation', { conversationId: convId, conversation: conv });
  memberIds.forEach(mid => io.to(mid).emit('new-conversation', { conversationId: convId, conversation: conv }));
  res.json({ success: true, conversationId: convId });
});

app.get('/api/chat/conversations/:userId', (req, res) => {
  const conversations = db.prepare(`
    SELECT c.*, 
      (SELECT COUNT(*) FROM messages m WHERE m.conversation_id = c.id AND m.sender_id != ? AND m.deleted = 0 AND m.id > COALESCE(cm.last_read_msg, 0)) as unread_count,
      (SELECT m.content FROM messages m WHERE m.conversation_id = c.id AND m.deleted = 0 ORDER BY m.id DESC LIMIT 1) as last_message,
      (SELECT m.created_at FROM messages m WHERE m.conversation_id = c.id ORDER BY m.id DESC LIMIT 1) as last_message_time,
      (SELECT u.nickname FROM users u JOIN conversation_members cm2 ON u.id = cm2.user_id WHERE cm2.conversation_id = c.id AND u.id != ? LIMIT 1) as other_user_name,
      (SELECT u.avatar FROM users u JOIN conversation_members cm2 ON u.id = cm2.user_id WHERE cm2.conversation_id = c.id AND u.id != ? LIMIT 1) as other_user_avatar,
      (SELECT u.id FROM users u JOIN conversation_members cm2 ON u.id = cm2.user_id WHERE cm2.conversation_id = c.id AND u.id != ? LIMIT 1) as other_user_id,
      (SELECT u.status FROM users u JOIN conversation_members cm2 ON u.id = cm2.user_id WHERE cm2.conversation_id = c.id AND u.id != ? LIMIT 1) as other_user_status
    FROM conversations c
    JOIN conversation_members cm ON c.id = cm.conversation_id
    WHERE cm.user_id = ?
    ORDER BY last_message_time DESC NULLS LAST
  `).all(req.params.userId, req.params.userId, req.params.userId, req.params.userId, req.params.userId, req.params.userId);
  res.json(conversations);
});

app.get('/api/chat/messages/:conversationId', (req, res) => {
  const { limit = 50, before } = req.query;
  let query = `
    SELECT m.*, u.nickname, u.username, u.avatar
    FROM messages m
    JOIN users u ON m.sender_id = u.id
    WHERE m.conversation_id = ?
  `;
  const params = [req.params.conversationId];
  if (before) {
    query += ' AND m.id < ?';
    params.push(parseInt(before));
  }
  query += ' ORDER BY m.id DESC LIMIT ?';
  params.push(parseInt(limit));
  const messages = db.prepare(query).all(...params);
  messages.reverse();
  res.json(messages);
});

app.get('/api/chat/conversation/:conversationId', (req, res) => {
  const conv = db.prepare('SELECT * FROM conversations WHERE id = ?').get(req.params.conversationId);
  if (!conv) return res.status(404).json({ error: 'Conversation not found' });
  const members = db.prepare(`
    SELECT u.id, u.nickname, u.username, u.avatar, u.status, cm.last_read_msg
    FROM conversation_members cm
    JOIN users u ON cm.user_id = u.id
    WHERE cm.conversation_id = ?
  `).all(req.params.conversationId);
  conv.members = members;
  res.json(conv);
});

app.put('/api/chat/messages/:messageId', (req, res) => {
  const { userId, content } = req.body;
  const msg = db.prepare('SELECT * FROM messages WHERE id = ?').get(req.params.messageId);
  if (!msg || msg.sender_id !== userId) return res.status(403).json({ error: 'Not allowed' });
  if (msg.deleted) return res.status(400).json({ error: 'Message deleted' });
  db.prepare('UPDATE messages SET content = ?, edited = 1 WHERE id = ?').run(content, req.params.messageId);
  io.to(msg.conversation_id).emit('message-edited', { messageId: msg.id, content, conversationId: msg.conversation_id });
  res.json({ success: true });
});

app.delete('/api/chat/messages/:messageId', (req, res) => {
  const { userId } = req.query;
  const msg = db.prepare('SELECT * FROM messages WHERE id = ?').get(req.params.messageId);
  if (!msg || msg.sender_id !== userId) return res.status(403).json({ error: 'Not allowed' });
  db.prepare("UPDATE messages SET deleted = 1, content = '' WHERE id = ?").run(req.params.messageId);
  io.to(msg.conversation_id).emit('message-deleted', { messageId: msg.id, conversationId: msg.conversation_id });
  res.json({ success: true });
});

app.put('/api/chat/conversations/:conversationId/read', (req, res) => {
  const { userId, lastMsgId } = req.body;
  db.prepare('UPDATE conversation_members SET last_read_msg = ? WHERE conversation_id = ? AND user_id = ?')
    .run(lastMsgId, req.params.conversationId, userId);
  res.json({ success: true });
});

app.post('/api/chat/conversations/:conversationId/leave', (req, res) => {
  const { userId } = req.body;
  db.prepare('DELETE FROM conversation_members WHERE conversation_id = ? AND user_id = ?')
    .run(req.params.conversationId, userId);
  io.to(req.params.conversationId).emit('member-left', { conversationId: req.params.conversationId, userId });
  res.json({ success: true });
});

app.put('/api/chat/conversations/:conversationId/add-members', (req, res) => {
  const { userId, newMemberIds } = req.body;
  if (!newMemberIds || newMemberIds.length === 0) return res.status(400).json({ error: 'No members to add' });
  const conv = db.prepare('SELECT * FROM conversations WHERE id = ?').get(req.params.conversationId);
  if (!conv) return res.status(404).json({ error: 'Conversation not found' });
  const member = db.prepare('SELECT 1 FROM conversation_members WHERE conversation_id = ? AND user_id = ?').get(req.params.conversationId, userId);
  if (!member) return res.status(403).json({ error: 'Not a member' });
  const stmt = db.prepare('INSERT OR IGNORE INTO conversation_members (conversation_id, user_id) VALUES (?, ?)');
  newMemberIds.forEach(mid => stmt.run(req.params.conversationId, mid));
  io.to(req.params.conversationId).emit('members-added', { conversationId: req.params.conversationId, newMemberIds });
  res.json({ success: true });
});

app.put('/api/chat/conversations/:conversationId/edit', (req, res) => {
  const { userId, name, icon, description } = req.body;
  const conv = db.prepare('SELECT * FROM conversations WHERE id = ?').get(req.params.conversationId);
  if (!conv) return res.status(404).json({ error: 'Conversation not found' });
  const member = db.prepare('SELECT 1 FROM conversation_members WHERE conversation_id = ? AND user_id = ?').get(req.params.conversationId, userId);
  if (!member) return res.status(403).json({ error: 'Not a member' });
  const updates = [];
  const values = [];
  if (name !== undefined) { updates.push('name = ?'); values.push(name); }
  if (icon !== undefined) { updates.push('icon = ?'); values.push(icon); }
  if (description !== undefined) { updates.push('description = ?'); values.push(description); }
  if (updates.length === 0) return res.json({ success: true, conversation: conv });
  values.push(req.params.conversationId);
  db.prepare(`UPDATE conversations SET ${updates.join(', ')} WHERE id = ?`).run(...values);
  const updated = db.prepare('SELECT * FROM conversations WHERE id = ?').get(req.params.conversationId);
  io.to(req.params.conversationId).emit('conversation-updated', { conversationId: req.params.conversationId, conversation: updated });
  res.json({ success: true, conversation: updated });
});

const PORT = process.env.PORT || 3001;

server.listen(PORT, () => {
  console.log(`ILNAZ GAMING SERVER running on port ${PORT}`);
  console.log(`Database: ${DB_PATH}`);
});
