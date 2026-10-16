// Create a portal account. Self sign-up is closed, so this is the only way in.
//
//   docker compose run --rm portal-api npm run create-user -- <email> "<name>" <password>
import 'dotenv/config';
import { db } from '../src/db.js';
import { hashPassword } from '../src/auth.js';

const [email, name, password] = process.argv.slice(2);
if (!email || !name || !password || password.length < 8) {
  console.error('usage: npm run create-user -- <email> "<name>" <password (8+ chars)>');
  process.exit(1);
}

try {
  const [user] = await db('users')
    .insert({ email: email.toLowerCase(), name, password_hash: await hashPassword(password) })
    .returning(['id', 'email']);
  console.log(`created user ${user.id} <${user.email}>`);
} catch (err) {
  console.error(err.code === '23505' ? 'an account with that email already exists' : err.message);
  process.exitCode = 1;
} finally {
  await db.destroy();
}
