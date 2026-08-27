import crypto from 'node:crypto';
import { hash } from 'bcryptjs';
import db from '../src/config/db.js';

const email = process.env.ADMIN_EMAIL || 'admin@cofradia.com';
const password = crypto.randomBytes(18).toString('base64url');

try {
  const user = await db.user.findUnique({ where: { email } });
  if (!user) throw new Error(`No existe el usuario administrador ${email}.`);

  await db.user.update({
    where: { id: user.id },
    data: {
      password: await hash(password, 12),
      tokenValidAfter: new Date(),
    },
  });

  console.log(JSON.stringify({ email, password }));
} finally {
  await db.$disconnect();
}
