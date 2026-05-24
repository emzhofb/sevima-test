import { z } from 'zod';

import { SlugSchema } from './workflow.js';

export const TenantSchema = z
  .object({
    id: z.string().uuid(),
    slug: SlugSchema,
    name: z.string().min(1).max(200),
    created_at: z.date(),
  })
  .strict();

export type Tenant = z.infer<typeof TenantSchema>;