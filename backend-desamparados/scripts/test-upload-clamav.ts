import app from '../src/app.js';
import db from '../src/config/db.js';
import { publicStorageDir } from '../src/middleware/upload.middleware.js';
import fs from 'node:fs/promises';
import type { AddressInfo } from 'node:net';

const email = process.env.INTEGRATION_ADMIN_EMAIL || 'admin@cofradia.com';
const password = process.env.INTEGRATION_ADMIN_PASSWORD || 'admin123';
const server = app.listen(0);
await new Promise<void>((resolve) => server.once('listening', resolve));
const port = (server.address() as AddressInfo).port;
const baseUrl = `http://127.0.0.1:${port}`;
let uploadedFilename: string | undefined;

try {
  const login = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!login.ok) throw new Error(`Login de integración rechazado: HTTP ${login.status}`);
  const loginBody = await login.json() as { token?: string };
  if (!loginBody.token) throw new Error('El login no devolvió token.');

  const form = new FormData();
  form.append('file', new Blob(['%PDF-1.4\n1 0 obj\n<<>>\nendobj\n%%EOF'], { type: 'application/pdf' }), 'clamav-clean-test.pdf');
  const upload = await fetch(`${baseUrl}/api/upload/public`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${loginBody.token}` },
    body: form,
  });
  const uploadBody = await upload.json() as { data?: { filename?: string } };
  if (!upload.ok || !uploadBody.data?.filename) throw new Error(`Subida limpia rechazada: HTTP ${upload.status}`);
  uploadedFilename = uploadBody.data.filename;
  console.log(JSON.stringify({ status: upload.status, filename: uploadedFilename, clamav: 'clean' }));
} finally {
  if (uploadedFilename) await fs.unlink(`${publicStorageDir}/${uploadedFilename}`).catch(() => undefined);
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await db.$disconnect();
}
