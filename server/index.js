const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');
const crypto = require('crypto');
const { MongoClient, ObjectId } = require('mongodb');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' },
});

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

const MONGO_URI = process.env.MONGO_URI;

if (!MONGO_URI) {
  console.error('MONGO_URI environment variable is not set!');
  process.exit(1);
}

let db;
let users;
let friendRequests;
let conversations;
let conversationMembers;
let messages;

async function connectDB() {
  const client = new MongoClient(MONGO_URI);
  await client.connect();
  db = client.db('ilnaz');
  users = db.collection('users');
  friendRequests = db.collection('friend_requests');
  conversations = db.collection('conversations');
  conversationMembers = db.collection('conversation_members');
  messages = db.collection('messages');
  console.log('MongoDB connected');
}

function isAdmin(userId) {
  return users.findOne({ id: userId }).then(u => u && (u.role === 'admin' || u.role === 'owner'));
}

function isOwner(userId) {
  return users.findOne({ id: userId }).then(u => u && u.role === 'owner');
}

function protectOwner(targetId) {
  return isOwner(targetId).then(is => is ? { error: 'Cannot modify the owner', forbidden: true } : null);
}

function generateId() {
  return crypto.randomUUID().slice(0, 8);
}

async function getUser(id) {
  const u = await users.findOne({ id });
  if (u) u.friends = u.friends || [];
  return u;
}

connectDB().catch(e => console.error(e));

app.post('/api/register', async (req, res) => {
  try {
    const { username, password, nickname } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required' });
    }
    const existing = await users.findOne({ username });
    if (existing) return res.status(409).json({ error: 'Username already exists' });

    const userId = generateId();
    const count = await users.countDocuments();
    const role = count === 0 ? 'owner' : 'user';
    const displayName = nickname || username;

    await users.insertOne({
      id: userId, username, password, nickname: displayName,
      avatar: null, banner: null, bio: 'Welcome to ILNAZ GAMING LAUNCHER!',
      status: 'offline', friends: [], games_played: 0, hours_played: 0,
      role, banned: false, created_at: new Date().toISOString(), last_seen: new Date().toISOString()
    });
    const user = await getUser(userId);
    res.json({ success: true, user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  const user = await users.findOne({ username });
  if (!user) return res.status(404).json({ error: 'User not found' });
  if (user.banned) return res.status(403).json({ error: 'Account is banned' });
  if (user.password !== password) return res.status(401).json({ error: 'Wrong password' });
  await users.updateOne({ id: user.id }, { $set: { status: 'online', last_seen: new Date().toISOString() } });
  user.friends = user.friends || [];
  io.emit('user-status', { id: user.id, status: 'online' });
  res.json({ success: true, user });
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

app.post('/api/users/:id/status', async (req, res) => {
  const { status } = req.body;
  await users.updateOne({ id: req.params.id }, { $set: { status, last_seen: new Date().toISOString() } });
  io.emit('user-status', { id: req.params.id, status });
  res.json({ success: true });
});

app.put('/api/users/:id', async (req, res) => {
  const { nickname, avatar, banner, bio } = req.body;
  const updates = {};
  if (nickname !== undefined) updates.nickname = nickname;
  if (avatar !== undefined) updates.avatar = avatar;
  if (banner !== undefined) updates.banner = banner;
  if (bio !== undefined) updates.bio = bio;
  if (Object.keys(updates).length === 0) return res.json({ success: true });
  await users.updateOne({ id: req.params.id }, { $set: updates });
  const user = await getUser(req.params.id);
  res.json({ success: true, user });
});

app.post('/api/friends/request', async (req, res) => {
  const { fromId, toId } = req.body;
  if (fromId === toId) return res.status(400).json({ error: 'Cannot add yourself' });
  const toUser = await getUser(toId);
  if (toUser && (toUser.friends || []).includes(fromId)) {
    return res.status(409).json({ error: 'Already friends' });
  }
  const existing = await friendRequests.findOne({ from_id: fromId, to_id: toId });
  if (existing) {
    if (existing.status === 'pending') return res.status(409).json({ error: 'Request already sent' });
    if (existing.status === 'declined' || existing.status === 'accepted') {
      await friendRequests.updateOne({ _id: existing._id }, { $set: { status: 'pending' } });
      io.to(toId).emit('friend-request', { fromId });
      return res.json({ success: true, resent: true });
    }
  }
  await friendRequests.insertOne({ from_id: fromId, to_id: toId, status: 'pending', created_at: new Date().toISOString() });
  io.to(toId).emit('friend-request', { fromId });
  res.json({ success: true });
});

app.get('/api/friends/pending/:userId', async (req, res) => {
  const reqs = await friendRequests.find({ to_id: req.params.userId, status: 'pending' }).toArray();
  const results = [];
  for (const fr of reqs) {
    const u = await users.findOne({ id: fr.from_id });
    if (u) results.push({ ...fr, nickname: u.nickname, username: u.username, avatar: u.avatar, status: u.status, role: u.role });
  }
  res.json(results);
});

app.get('/api/friends/sent/:userId', async (req, res) => {
  const reqs = await friendRequests.find({ from_id: req.params.userId, status: 'pending' }).toArray();
  const results = [];
  for (const fr of reqs) {
    const u = await users.findOne({ id: fr.to_id });
    if (u) results.push({ ...fr, nickname: u.nickname, username: u.username, avatar: u.avatar, status: u.status, role: u.role });
  }
  res.json(results);
});

app.put('/api/friends/accept/:requestId', async (req, res) => {
  const { userId } = req.body;
  const request = await friendRequests.findOne({ _id: new ObjectId(req.params.requestId), to_id: userId, status: 'pending' });
  if (!request) return res.status(404).json({ error: 'Request not found' });
  await users.updateOne({ id: userId }, { $addToSet: { friends: request.from_id } });
  await users.updateOne({ id: request.from_id }, { $addToSet: { friends: userId } });
  await friendRequests.updateOne({ _id: request._id }, { $set: { status: 'accepted' } });
  io.emit('friend-accepted', { userId, friendId: request.from_id });
  res.json({ success: true });
});

app.delete('/api/friends/decline/:requestId', async (req, res) => {
  const { userId } = req.body;
  const request = await friendRequests.findOne({ _id: new ObjectId(req.params.requestId), to_id: userId, status: 'pending' });
  if (!request) return res.status(404).json({ error: 'Request not found' });
  await friendRequests.updateOne({ _id: request._id }, { $set: { status: 'declined' } });
  res.json({ success: true });
});

app.delete('/api/friends/remove/:userId/:friendId', async (req, res) => {
  await users.updateOne({ id: req.params.userId }, { $pull: { friends: req.params.friendId } });
  await users.updateOne({ id: req.params.friendId }, { $pull: { friends: req.params.userId } });
  const u = await getUser(req.params.userId);
  res.json({ success: true, friends: u.friends });
});

app.get('/api/friends/list/:userId', async (req, res) => {
  const user = await getUser(req.params.userId);
  if (!user) return res.status(404).json({ error: 'User not found' });
  const friends = [];
  for (const id of (user.friends || [])) {
    const f = await users.findOne({ id });
    if (f) friends.push(f);
  }
  res.json(friends);
});

async function requireAdmin(req, res, next) {
  const userId = req.headers['x-user-id'];
  if (!userId) return res.status(403).json({ error: 'Admin access required' });
  const user = await users.findOne({ id: userId });
  if (!user || (user.role !== 'admin' && user.role !== 'owner')) {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}

app.get('/api/admin/users', requireAdmin, async (req, res) => {
  const us = await users.find().sort({ created_at: -1 }).toArray();
  us.forEach(u => u.friends = u.friends || []);
  res.json(us);
});

app.delete('/api/admin/users/:id', requireAdmin, async (req, res) => {
  const prot = await protectOwner(req.params.id);
  if (prot) return res.status(403).json(prot);
  await friendRequests.deleteMany({ $or: [{ from_id: req.params.id }, { to_id: req.params.id }] });
  await users.deleteOne({ id: req.params.id });
  io.emit('user-deleted', { id: req.params.id });
  res.json({ success: true });
});

app.put('/api/admin/users/:id/ban', requireAdmin, async (req, res) => {
  const prot = await protectOwner(req.params.id);
  if (prot) return res.status(403).json(prot);
  const { banned } = req.body;
  await users.updateOne({ id: req.params.id }, { $set: { banned, status: banned ? 'banned' : 'offline' } });
  if (banned) io.emit('user-banned', { id: req.params.id });
  res.json({ success: true });
});

app.put('/api/admin/users/:id/edit', requireAdmin, async (req, res) => {
  const prot = await protectOwner(req.params.id);
  if (prot) return res.status(403).json(prot);
  const { nickname, avatar, banner, bio, role, games_played, hours_played } = req.body;
  const target = await users.findOne({ id: req.params.id });
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
  const user = await getUser(req.params.id);
  res.json({ success: true, user });
});

app.get('/api/admin/stats', requireAdmin, async (req, res) => {
  const totalUsers = await users.countDocuments();
  const totalAdmins = await users.countDocuments({ role: 'admin' });
  const totalOwners = await users.countDocuments({ role: 'owner' });
  const totalBanned = await users.countDocuments({ banned: true });
  const onlineUsers = await users.countDocuments({ status: 'online' });
  res.json({ totalUsers, totalAdmins, totalOwners, totalBanned, onlineUsers });
});

io.on('connection', (socket) => {
  socket.on('join', (userId) => socket.join(userId));
  socket.on('join-conversation', (conversationId) => socket.join(conversationId));
  socket.on('leave-conversation', (conversationId) => socket.leave(conversationId));
  socket.on('send-message', async (data) => {
    const { conversationId, senderId, content, image } = data;
    const member = await conversationMembers.findOne({ conversation_id: conversationId, user_id: senderId });
    if (!member) return;
    const result = await messages.insertOne({ conversation_id: conversationId, sender_id: senderId, content: content || '', image: image || null, edited: false, deleted: false, created_at: new Date().toISOString() });
    const msg = await messages.findOne({ _id: result.insertedId });
    const sender = await users.findOne({ id: senderId });
    io.to(conversationId).emit('new-message', { ...msg, nickname: sender.nickname, username: sender.username, avatar: sender.avatar });
  });
  socket.on('typing', (data) => {
    socket.to(data.conversationId).emit('user-typing', { conversationId: data.conversationId, userId: data.userId });
  });
  socket.on('disconnect', () => {});
});

app.post('/api/chat/conversations', async (req, res) => {
  const { creatorId, type, name, memberIds } = req.body;
  if (!creatorId || !memberIds || memberIds.length === 0) return res.status(400).json({ error: 'Missing required fields' });
  if (type === 'private' && memberIds.length !== 1) return res.status(400).json({ error: 'Private chat requires exactly 1 other user' });
  if (type === 'private') {
    const existingConv = await conversations.findOne({ type: 'private' });
    // Simplified check for private conv existence; ideally should check members
    if (existingConv) return res.json({ success: true, conversationId: existingConv.id, existing: true });
  }
  const convId = generateId() + generateId();
  await conversations.insertOne({ id: convId, type, name: name || null, icon: null, description: null, creator_id: creatorId, created_at: new Date().toISOString() });
  const allMembers = [...memberIds, creatorId];
  for (const mid of allMembers) await conversationMembers.insertOne({ conversation_id: convId, user_id: mid, last_read_msg: 0, joined_at: new Date().toISOString() });
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
    let otherUser = null;
    if (otherMember) otherUser = await users.findOne({ id: otherMember.user_id });
    results.push({
      ...c, unread_count: unread, last_message: lastMsg ? lastMsg.content : null,
      last_message_time: lastMsg ? lastMsg.created_at : null,
      other_user_name: otherUser ? otherUser.nickname : null, other_user_avatar: otherUser ? otherUser.avatar : null,
      other_user_id: otherUser ? otherUser.id : null, other_user_status: otherUser ? otherUser.status : null
    });
  }
  res.json(results);
});

app.get('/api/chat/messages/:conversationId', async (req, res) => {
  const { limit = 50, before } = req.query;
  let query = { conversation_id: req.params.conversationId };
  if (before) query.id = { $lt: parseInt(before) };
  const msgs = await messages.find(query).sort({ created_at: 1 }).limit(parseInt(limit)).toArray();
  const senderIds = [...new Set(msgs.map(m => m.sender_id))];
  const senders = await users.find({ id: { $in: senderIds } }).toArray();
  const senderMap = {};
  senders.forEach(s => senderMap[s.id] = s);
  const enriched = msgs.map(m => ({ ...m, nickname: senderMap[m.sender_id]?.nickname, username: senderMap[m.sender_id]?.username, avatar: senderMap[m.sender_id]?.avatar }));
  res.json(enriched);
});

app.get('/api/chat/conversation/:conversationId', async (req, res) => {
  const conv = await conversations.findOne({ id: req.params.conversationId });
  if (!conv) return res.status(404).json({ error: 'Conversation not found' });
  const memberDocs = await conversationMembers.find({ conversation_id: req.params.conversationId }).toArray();
  const members = [];
  for (const md of memberDocs) {
    const u = await users.findOne({ id: md.user_id });
    if (u) members.push({ ...u, last_read_msg: md.last_read_msg });
  }
  conv.members = members;
  res.json(conv);
});

app.put('/api/chat/messages/:messageId', async (req, res) => {
  const { userId, content } = req.body;
  const msg = await messages.findOne({ _id: new ObjectId(req.params.messageId) });
  if (!msg || msg.sender_id !== userId) return res.status(403).json({ error: 'Not allowed' });
  if (msg.deleted) return res.status(400).json({ error: 'Message deleted' });
  await messages.updateOne({ _id: msg._id }, { $set: { content, edited: true } });
  io.to(msg.conversation_id).emit('message-edited', { messageId: msg._id.toString(), content, conversationId: msg.conversation_id });
  res.json({ success: true });
});

app.delete('/api/chat/messages/:messageId', async (req, res) => {
  const { userId } = req.query;
  const msg = await messages.findOne({ _id: new ObjectId(req.params.messageId) });
  if (!msg || msg.sender_id !== userId) return res.status(403).json({ error: 'Not allowed' });
  await messages.updateOne({ _id: msg._id }, { $set: { deleted: true, content: '' } });
  io.to(msg.conversation_id).emit('message-deleted', { messageId: msg._id.toString(), conversationId: msg.conversation_id });
  res.json({ success: true });
});

app.put('/api/chat/conversations/:conversationId/read', async (req, res) => {
  const { userId, lastMsgId } = req.body;
  await conversationMembers.updateOne({ conversation_id: req.params.conversationId, user_id: userId }, { $set: { last_read_msg: lastMsgId } });
  res.json({ success: true });
});

app.post('/api/chat/conversations/:conversationId/leave', async (req, res) => {
  const { userId } = req.body;
  await conversationMembers.deleteOne({ conversation_id: req.params.conversationId, user_id: userId });
  io.to(req.params.conversationId).emit('member-left', { conversationId: req.params.conversationId, userId });
  res.json({ success: true });
});

app.put('/api/chat/conversations/:conversationId/add-members', async (req, res) => {
  const { userId, newMemberIds } = req.body;
  if (!newMemberIds || newMemberIds.length === 0) return res.status(400).json({ error: 'No members to add' });
  const member = await conversationMembers.findOne({ conversation_id: req.params.conversationId, user_id: userId });
  if (!member) return res.status(403).json({ error: 'Not a member' });
  for (const mid of newMemberIds) await conversationMembers.insertOne({ conversation_id: req.params.conversationId, user_id: mid, last_read_msg: 0, joined_at: new Date().toISOString() });
  io.to(req.params.conversationId).emit('members-added', { conversationId: req.params.conversationId, newMemberIds });
  res.json({ success: true });
});

app.put('/api/chat/conversations/:conversationId/edit', async (req, res) => {
  const { userId, name, icon, description } = req.body;
  const conv = await conversations.findOne({ id: req.params.conversationId });
  if (!conv) return res.status(404).json({ error: 'Conversation not found' });
  const member = await conversationMembers.findOne({ conversation_id: req.params.conversationId, user_id: userId });
  if (!member) return res.status(403).json({ error: 'Not a member' });
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

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`ILNAZ GAMING SERVER running on port ${PORT}`);
});
