const { MongoClient } = require('mongodb');
const readline = require('readline');

const MONGO_URI = process.env.MONGO_URI || 'mongodb+srv://ilnaz:2304Oliver2304@cluster0.em3o0bd.mongodb.net/ilnaz?appName=Cluster0';

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

async function runAdmin() {
  const client = new MongoClient(MONGO_URI);
  await client.connect();
  const db = client.db();
  const users = db.collection('users');

  const args = process.argv.slice(2);

  if (args.length < 1) {
    console.log('Usage: node server/admin.js <command> <args>');
    console.log('');
    console.log('Commands:');
    console.log('  make-admin <username>   - Make user an admin');
    console.log('  remove-admin <username> - Remove admin role');
    console.log('  set-owner <username>    - Make user owner');
    console.log('  list-admins             - List all admins');
    console.log('  list-users              - List all users');
    console.log('  ban <username>          - Ban a user');
    console.log('  unban <username>        - Unban a user');
    process.exit(1);
  }

  const command = args[0];
  const username = args[1];

  async function findUser(name) {
    return users.findOne({ $or: [{ username: name }, { nickname: name }] });
  }

  switch (command) {
    case 'make-admin': {
      if (!username) { console.error('Username required'); process.exit(1); }
      const user = await findUser(username);
      if (!user) { console.error(`User "${username}" not found`); process.exit(1); }
      if (user.role === 'owner') { console.error('Cannot change owner'); process.exit(1); }
      await users.updateOne({ id: user.id }, { $set: { role: 'admin' } });
      console.log(`✓ User "${user.username}" is now an admin`);
      break;
    }

    case 'remove-admin': {
      if (!username) { console.error('Username required'); process.exit(1); }
      const user = await findUser(username);
      if (!user) { console.error(`User "${username}" not found`); process.exit(1); }
      if (user.role === 'owner') { console.error('Cannot change owner'); process.exit(1); }
      await users.updateOne({ id: user.id }, { $set: { role: 'user' } });
      console.log(`✓ User "${user.username}" is no longer an admin`);
      break;
    }

    case 'set-owner': {
      if (!username) { console.error('Username required'); process.exit(1); }
      const user = await findUser(username);
      if (!user) { console.error(`User "${username}" not found`); process.exit(1); }
      await users.updateOne({ id: user.id }, { $set: { role: 'owner' } });
      console.log(`✓ User "${user.username}" is now the OWNER`);
      break;
    }

    case 'list-admins': {
      const admins = await users.find({ role: { $ne: 'user' } }).toArray();
      if (admins.length === 0) { console.log('No admins found'); }
      else { admins.forEach(a => console.log(`  - ${a.username} (${a.nickname}) [ID: ${a.id}] ${a.role === 'owner' ? '👑 OWNER' : '🛡️ ADMIN'}`)); }
      break;
    }

    case 'list-users': {
      const allUsers = await users.find().sort({ username: 1 }).toArray();
      if (allUsers.length === 0) { console.log('No users found'); }
      else {
        allUsers.forEach(u => {
          const badges = [];
          if (u.role === 'owner') badges.push('👑 OWNER');
          else if (u.role === 'admin') badges.push('🛡️ ADMIN');
          if (u.banned) badges.push('🔒 BANNED');
          console.log(`  - ${u.username} (${u.nickname}) [ID: ${u.id}]${badges.length ? ' [' + badges.join(', ') + ']' : ''}`);
        });
      }
      break;
    }

    case 'ban': {
      if (!username) { console.error('Username required'); process.exit(1); }
      const user = await findUser(username);
      if (!user) { console.error(`User "${username}" not found`); process.exit(1); }
      if (user.role === 'owner') { console.error('Cannot ban owner'); process.exit(1); }
      await users.updateOne({ id: user.id }, { $set: { banned: true, status: 'banned' } });
      console.log(`✓ User "${user.username}" has been banned`);
      break;
    }

    case 'unban': {
      if (!username) { console.error('Username required'); process.exit(1); }
      const user = await findUser(username);
      if (!user) { console.error(`User "${username}" not found`); process.exit(1); }
      await users.updateOne({ id: user.id }, { $set: { banned: false, status: 'offline' } });
      console.log(`✓ User "${user.username}" has been unbanned`);
      break;
    }

    default:
      console.error(`Unknown command: ${command}`);
      process.exit(1);
  }

  await client.close();
}

runAdmin().catch(err => { console.error(err); process.exit(1); });
