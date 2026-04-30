const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, 'ilnaz.db');
const db = new Database(DB_PATH);

function addColumnIfNotExists(table, column, definition) {
  try {
    db.prepare(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`).run();
    console.log(`✓ Added column ${column} to ${table}`);
  } catch (e) {
    if (!e.message.includes('duplicate')) throw e;
  }
}

addColumnIfNotExists('users', 'role', "TEXT DEFAULT 'user'");
addColumnIfNotExists('users', 'banned', 'INTEGER DEFAULT 0');

const args = process.argv.slice(2);

if (args.length < 2) {
  console.log('Usage: node admin.js <command> <args>');
  console.log('');
  console.log('Commands:');
  console.log('  make-admin <username>   - Make user an admin');
  console.log('  remove-admin <username> - Remove admin role');
  console.log('  set-owner <username>    - Make user owner (cannot be changed/banned/deleted)');
  console.log('  list-admins            - List all admins');
  console.log('  list-users             - List all users');
  console.log('  ban <username>          - Ban a user');
  console.log('  unban <username>        - Unban a user');
  process.exit(1);
}

const command = args[0];

function findUser(username) {
  return db.prepare('SELECT * FROM users WHERE username = ?').get(username);
}

switch (command) {
  case 'make-admin': {
    const username = args[1];
    if (!username) {
      console.error('Error: Username required');
      process.exit(1);
    }
    const user = findUser(username);
    if (!user) {
      console.error(`Error: User "${username}" not found`);
      process.exit(1);
    }
    if (user.role === 'owner') {
      console.error('Error: Cannot change role of owner');
      process.exit(1);
    }
    db.prepare('UPDATE users SET role = ? WHERE id = ?').run('admin', user.id);
    console.log(`✓ User "${username}" is now an admin`);
    break;
  }

  case 'remove-admin': {
    const username = args[1];
    if (!username) {
      console.error('Error: Username required');
      process.exit(1);
    }
    const user = findUser(username);
    if (!user) {
      console.error(`Error: User "${username}" not found`);
      process.exit(1);
    }
    if (user.role === 'owner') {
      console.error('Error: Cannot change role of owner');
      process.exit(1);
    }
    db.prepare('UPDATE users SET role = ? WHERE id = ?').run('user', user.id);
    console.log(`✓ User "${username}" is no longer an admin`);
    break;
  }

  case 'set-owner': {
    const username = args[1];
    if (!username) {
      console.error('Error: Username required');
      process.exit(1);
    }
    const user = findUser(username);
    if (!user) {
      console.error(`Error: User "${username}" not found`);
      process.exit(1);
    }
    db.prepare('UPDATE users SET role = ? WHERE id = ?').run('owner', user.id);
    console.log(`✓ User "${username}" is now the OWNER`);
    console.log('  ⚠ Owners cannot be banned, deleted, or demoted!');
    break;
  }

  case 'list-admins': {
    const admins = db.prepare('SELECT id, username, nickname, role FROM users WHERE role != ?').all('user');
    if (admins.length === 0) {
      console.log('No admins found');
    } else {
      console.log('Admins:');
      admins.forEach(a => {
        const badge = a.role === 'owner' ? '👑 OWNER' : '🛡️ ADMIN';
        console.log(`  - ${a.username} (${a.nickname}) [ID: ${a.id}] ${badge}`);
      });
    }
    break;
  }

  case 'list-users': {
    const users = db.prepare('SELECT id, username, nickname, role, banned FROM users ORDER BY username').all();
    if (users.length === 0) {
      console.log('No users found');
    } else {
      console.log('Users:');
      users.forEach(u => {
        const badges = [];
        if (u.role === 'owner') badges.push('👑 OWNER');
        else if (u.role === 'admin') badges.push('🛡️ ADMIN');
        if (u.banned) badges.push('🔒 BANNED');
        const badgeStr = badges.length > 0 ? ` [${badges.join(', ')}]` : '';
        console.log(`  - ${u.username} (${u.nickname}) [ID: ${u.id}]${badgeStr}`);
      });
    }
    break;
  }

  case 'ban': {
    const username = args[1];
    if (!username) {
      console.error('Error: Username required');
      process.exit(1);
    }
    const user = findUser(username);
    if (!user) {
      console.error(`Error: User "${username}" not found`);
      process.exit(1);
    }
    if (user.role === 'owner') {
      console.error('Error: Cannot ban the owner!');
      process.exit(1);
    }
    db.prepare('UPDATE users SET banned = 1, status = ? WHERE id = ?').run('banned', user.id);
    console.log(`✓ User "${username}" has been banned`);
    break;
  }

  case 'unban': {
    const username = args[1];
    if (!username) {
      console.error('Error: Username required');
      process.exit(1);
    }
    const user = findUser(username);
    if (!user) {
      console.error(`Error: User "${username}" not found`);
      process.exit(1);
    }
    db.prepare('UPDATE users SET banned = 0, status = ? WHERE id = ?').run('offline', user.id);
    console.log(`✓ User "${username}" has been unbanned`);
    break;
  }

  default:
    console.error(`Unknown command: ${command}`);
    process.exit(1);
}

db.close();
