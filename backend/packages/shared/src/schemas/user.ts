import { z } from 'zod';

import { RoleSchema } from './workflow.js';

export const UserSchema = z
  .object({
    id: z.string().uuid(),
    tenant_id: z.string().uuid(),
    email: z.string().email(),
    password_hash: z.string().min(1),
    role: RoleSchema,
    created_at: z.date(),
  })
  .strict();

export type User = z.infer<typeof UserSchema>;
