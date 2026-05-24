import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { signJwt, verifyPassword } from '@flowforge/auth';
import { findUserForLogin } from '../repos/user.repo.js';

const LoginBodySchema = z.object({
  tenant_slug: z.string().regex(/^[a-z0-9][a-z0-9-]{1,62}$/),
  email: z.string().email(),
  password: z.string().min(1),
});

export type LoginRequest = z.infer<typeof LoginBodySchema>;

export interface AuthRoutesOpts {
  jwtSecret: string;
}

export const authRoutes: FastifyPluginAsync<AuthRoutesOpts> = async (fastify, opts) => {
  fastify.post<{ Body: LoginRequest }>('/auth/login', async (request, reply) => {
    const parsed = LoginBodySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({
        error: 'invalid_input',
        issues: parsed.error.flatten(),
      });
    }

    const { tenant_slug, email, password } = parsed.data;
    const db = fastify.db;
    const user = await findUserForLogin(db, tenant_slug, email);

    // Constant-time check: hash even on missing user to prevent timing attacks
    const dummyHash =
      '$argon2id$v=19$m=65536,t=3,p=1$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
    const isValid = user ? await verifyPassword(password, user.password_hash) : false;

    // Still hash dummy to prevent timing attacks
    if (!user) {
      await verifyPassword(password, dummyHash).catch(() => {
        // Intentionally ignore error
      });
    }

    if (!user || !isValid) {
      return reply.code(401).send({ error: 'invalid_credentials' });
    }

    const expiresInSec = 900; // 15 min
    const token = signJwt(
      {
        tenant_id: user.tenant_id,
        user_id: user.id,
        role: user.role,
      },
      opts.jwtSecret,
      expiresInSec,
    );

    return reply.send({
      token,
      expires_in: expiresInSec,
    });
  });
};
