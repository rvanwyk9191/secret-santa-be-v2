import { createAuthMiddleware } from '../../src/auth/authRouter.js';

const mockParams: Record<string, string> = {
  '/secret-santa/auth0/domain': 'test.auth0.com',
  '/secret-santa/auth0/client_id': 'test-client-id',
  '/secret-santa/auth0/client_secret': 'test-client-secret',
  '/secret-santa/auth0/audience': 'https://api.test.example',
};

process.env['SESSION_SECRET'] = 'test-session-secret-32-chars-longXX';
process.env['BASE_URL'] = 'https://127.0.0.1:3000';

jest.mock('../../src/utils/config.js', () => ({
  getConfigParam: jest.fn().mockImplementation((name: string) =>
    Promise.resolve(mockParams[name])
  ),
}));

jest.mock('express-openid-connect', () => ({
  auth: jest.fn(() => jest.fn()),
}));

jest.mock('../../src/utils/logger.js', () => ({
  Logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

describe('Auth router SSM configuration (unit)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('reads all 4 required SSM paths', async () => {
    const { getConfigParam } = await import('../../src/utils/config.js');
    await createAuthMiddleware();

    expect(getConfigParam).toHaveBeenCalledWith('/secret-santa/auth0/domain');
    expect(getConfigParam).toHaveBeenCalledWith('/secret-santa/auth0/client_id');
    expect(getConfigParam).toHaveBeenCalledWith('/secret-santa/auth0/client_secret', { decrypt: true });
    expect(getConfigParam).toHaveBeenCalledWith('/secret-santa/auth0/audience');
    expect(getConfigParam).toHaveBeenCalledTimes(4);
  });

  it('returns a middleware function when all SSM params are present', async () => {
    const middleware = await createAuthMiddleware();
    expect(typeof middleware).toBe('function');
  });

  it('passes clientID, issuerBaseURL, and baseURL to auth()', async () => {
    const { auth } = await import('express-openid-connect');
    await createAuthMiddleware();

    expect(auth).toHaveBeenCalledWith(
      expect.objectContaining({
        clientID: 'test-client-id',
        issuerBaseURL: 'https://test.auth0.com',
        baseURL: 'https://127.0.0.1:3000', // from BASE_URL env var
      })
    );
  });

  it('configures login/callback/logout routes under /api/auth', async () => {
    const { auth } = await import('express-openid-connect');
    await createAuthMiddleware();

    expect(auth).toHaveBeenCalledWith(
      expect.objectContaining({
        routes: expect.objectContaining({
          login: '/api/auth/login',
          callback: '/api/auth/callback',
          logout: '/api/auth/logout',
        }),
      })
    );
  });

  it('includes audience in authorizationParams', async () => {
    const { auth } = await import('express-openid-connect');
    await createAuthMiddleware();

    expect(auth).toHaveBeenCalledWith(
      expect.objectContaining({
        authorizationParams: expect.objectContaining({
          audience: 'https://api.test.example',
        }),
      })
    );
  });

  it('sets transactionCookie to SameSite=None (Phase 4.8)', async () => {
    const { auth } = await import('express-openid-connect');
    await createAuthMiddleware();

    expect(auth).toHaveBeenCalledWith(
      expect.objectContaining({
        transactionCookie: expect.objectContaining({
          sameSite: 'None',
        }),
      })
    );
  });

  it('sets session cookie to SameSite=None; Secure (Phase 4.8)', async () => {
    const { auth } = await import('express-openid-connect');
    await createAuthMiddleware();

    expect(auth).toHaveBeenCalledWith(
      expect.objectContaining({
        session: expect.objectContaining({
          cookie: expect.objectContaining({
            sameSite: 'None',
            secure: true,
          }),
        }),
      })
    );
  });

  it('throws when domain SSM param is missing', async () => {
    const { getConfigParam } = await import('../../src/utils/config.js');
    (getConfigParam as jest.Mock).mockImplementation((name: string) =>
      Promise.resolve(name === '/secret-santa/auth0/domain' ? undefined : mockParams[name])
    );
    await expect(createAuthMiddleware()).rejects.toThrow('SSM param missing: /secret-santa/auth0/domain');
  });

  it('throws when SESSION_SECRET env var is missing', async () => {
    const { getConfigParam } = await import('../../src/utils/config.js');
    (getConfigParam as jest.Mock).mockImplementation((name: string) =>
      Promise.resolve(mockParams[name])
    );
    const savedSecret = process.env['SESSION_SECRET'];
    delete process.env['SESSION_SECRET'];
    await expect(createAuthMiddleware()).rejects.toThrow('Environment variable SESSION_SECRET is required');
    process.env['SESSION_SECRET'] = savedSecret;
  });

  it('throws when BASE_URL uses http:// (any host)', async () => {
    const savedURL = process.env['BASE_URL'];
    process.env['BASE_URL'] = 'http://127.0.0.1:3000';
    await expect(createAuthMiddleware()).rejects.toThrow('BASE_URL must use HTTPS in all environments');
    process.env['BASE_URL'] = savedURL;
  });

  it('does not throw when BASE_URL is https://127.0.0.1', async () => {
    process.env['BASE_URL'] = 'https://127.0.0.1:3000';
    await expect(createAuthMiddleware()).resolves.toBeTruthy();
  });
});
