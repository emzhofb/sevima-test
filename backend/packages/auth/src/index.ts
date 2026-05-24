export { hashPassword, verifyPassword } from './password.js';
export { signJwt, verifyJwt } from './jwt.js';
export { authPlugin, requireRole } from './middleware.js';
export { checkRateLimit, createRateLimitMiddleware } from './rate-limit.js';
export type { JwtClaims, RequestContext, Role } from './types.js';
export type { RateLimitResult, RateLimitMiddlewareOptions } from './rate-limit.js';
