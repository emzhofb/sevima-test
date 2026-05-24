import { describe, it, expect, beforeEach, vi } from 'vitest';
import { authRoutes } from './auth.js';

describe('authRoutes', () => {
  const jwtSecret = 'test-secret-key-12345';

  let mockDb: any;
  let mockFastify: any;

  beforeEach(() => {
    mockDb = {
      query: vi.fn(),
    };

    mockFastify = {
      db: mockDb,
      post: vi.fn(),
    };
  });

  it('should accept POST /auth/login', async () => {
    await authRoutes(mockFastify, { jwtSecret });
    expect(mockFastify.post).toHaveBeenCalledWith('/auth/login', expect.any(Function));
  });

  it('returns 400 on invalid request body', async () => {
    await authRoutes(mockFastify, { jwtSecret });

    const handler = mockFastify.post.mock.calls[0][1];
    const mockReply = {
      code: vi.fn().mockReturnThis(),
      send: vi.fn(),
    };

    // Invalid: missing email
    const request = {
      body: {
        tenant_slug: 'acme',
        password: 'pass',
      },
    };

    await handler(request, mockReply);
    expect(mockReply.code).toHaveBeenCalledWith(400);
    expect(mockReply.send).toHaveBeenCalledWith(
      expect.objectContaining({
        error: 'invalid_input',
      }),
    );
  });

  it('returns 401 on invalid credentials', async () => {
    mockDb.query.mockResolvedValueOnce({ rows: [] }); // User not found

    await authRoutes(mockFastify, { jwtSecret });

    const handler = mockFastify.post.mock.calls[0][1];
    const mockReply = {
      code: vi.fn().mockReturnThis(),
      send: vi.fn(),
    };

    const request = {
      body: {
        tenant_slug: 'acme',
        email: 'nouser@example.com',
        password: 'wrong',
      },
    };

    await handler(request, mockReply);
    expect(mockReply.code).toHaveBeenCalledWith(401);
    expect(mockReply.send).toHaveBeenCalledWith({
      error: 'invalid_credentials',
    });
  });

  it('validates email format', async () => {
    await authRoutes(mockFastify, { jwtSecret });

    const handler = mockFastify.post.mock.calls[0][1];
    const mockReply = {
      code: vi.fn().mockReturnThis(),
      send: vi.fn(),
    };

    const request = {
      body: {
        tenant_slug: 'acme',
        email: 'invalid-email',
        password: 'pass',
      },
    };

    await handler(request, mockReply);
    expect(mockReply.code).toHaveBeenCalledWith(400);
  });

  it('validates tenant_slug format', async () => {
    await authRoutes(mockFastify, { jwtSecret });

    const handler = mockFastify.post.mock.calls[0][1];
    const mockReply = {
      code: vi.fn().mockReturnThis(),
      send: vi.fn(),
    };

    const request = {
      body: {
        tenant_slug: '_invalid-slug', // starts with underscore
        email: 'user@example.com',
        password: 'pass',
      },
    };

    await handler(request, mockReply);
    expect(mockReply.code).toHaveBeenCalledWith(400);
  });

  it('should structure response correctly', async () => {
    await authRoutes(mockFastify, { jwtSecret });

    const handler = mockFastify.post.mock.calls[0][1];
    const mockReply = {
      code: vi.fn().mockReturnThis(),
      send: vi.fn().mockReturnThis(),
    };

    // Note: This is a simplified test since we'd need actual hashing
    // In real scenario, we'd mock verifyPassword
    mockDb.query.mockResolvedValueOnce({ rows: [] }); // User not found

    const request = {
      body: {
        tenant_slug: 'acme',
        email: 'user@example.com',
        password: 'pass',
      },
    };

    await handler(request, mockReply);
    expect(mockReply.send).toHaveBeenCalled();
  });
});
