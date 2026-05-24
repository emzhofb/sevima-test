import Fastify from 'fastify';
import { test, expect } from 'vitest';
import { authPlugin, requireRole } from './middleware.js';
import { signJwt } from './jwt.js';

const jwtSecret = 'test-secret-which-is-long-enough';

test('authPlugin rejects missing token', async () => {
  const app = Fastify();
  app.register(authPlugin, { jwtSecret });
  app.get('/private', async () => ({ ok: true }));

  const res = await app.inject({ method: 'GET', url: '/private' });
  expect(res.statusCode).toBe(401);
  await app.close();
});

test('authPlugin accepts valid token and sets ctx', async () => {
  const app = Fastify();
  app.register(authPlugin, { jwtSecret });
  app.get('/private', async (req) => ({ ctx: req.ctx }));

  const token = signJwt({ user_id: 'u1', tenant_id: 't1', role: 'ADMIN' }, jwtSecret);
  const res = await app.inject({
    method: 'GET',
    url: '/private',
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(res.statusCode).toBe(200);
  const body = JSON.parse(res.body);
  expect(body.ctx.user_id).toBe('u1');
  expect(body.ctx.role).toBe('ADMIN');
  await app.close();
});

test('requireRole denies insufficient role', async () => {
  const app = Fastify();
  app.register(authPlugin, { jwtSecret });
  app.get('/editor-only', { preHandler: requireRole('EDITOR') }, async () => ({ ok: true }));

  const token = signJwt({ user_id: 'u2', tenant_id: 't1', role: 'VIEWER' }, jwtSecret);
  const res = await app.inject({
    method: 'GET',
    url: '/editor-only',
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(res.statusCode).toBe(403);
  await app.close();
});
