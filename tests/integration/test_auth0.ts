import { createCheckJwt } from '../../src/auth/auth0.js';

jest.mock('../../src/utils/config.js', () => ({
  getConfigParam: jest.fn().mockImplementation((name: string) => {
    const params: Record<string, string> = {
      '/secret-santa/auth0/domain': 'integration-test.auth0.com',
      '/secret-santa/auth0/audience': 'https://api.integration-test.example',
      '/secret-santa/auth0/client_id': 'integration-client-id',
      '/secret-santa/auth0/client_secret': 'integration-client-secret',
    };
    return Promise.resolve(params[name]);
  }),
}));

jest.mock('jwks-rsa', () => ({
  expressJwtSecret: jest.fn((opts: unknown) => {
    const o = opts as Record<string, unknown>;
    return jest.fn().mockReturnValue({ jwksUri: o['jwksUri'] });
  }),
}));

jest.mock('express-jwt', () => ({
  expressjwt: jest.fn((opts: unknown) => {
    const handler = jest.fn();
    (handler as unknown as Record<string, unknown>)['__testOpts'] = opts;
    return handler;
  }),
}));

jest.mock('../../src/utils/logger.js', () => ({
  Logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

describe('checkJwt middleware factory (integration)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return a valid Express RequestHandler', async () => {
    const middleware = await createCheckJwt();
    expect(middleware).toBeDefined();
    expect(typeof middleware).toBe('function');
  });

  it('should configure the middleware with the domain from SSM', async () => {
    const { expressjwt } = await import('express-jwt');
    await createCheckJwt();

    expect(expressjwt).toHaveBeenCalledTimes(1);
    const callArgs = (expressjwt as jest.Mock).mock.calls[0][0] as Record<string, unknown>;
    expect(callArgs['issuer']).toBe('https://integration-test.auth0.com/');
    expect(callArgs['audience']).toBe('https://api.integration-test.example');
    expect(callArgs['algorithms']).toEqual(['RS256']);
  });

  it('should configure JWKS endpoint using the domain from SSM', async () => {
    const jwksRsa = await import('jwks-rsa');
    await createCheckJwt();

    expect(jwksRsa.expressJwtSecret).toHaveBeenCalledWith(
      expect.objectContaining({
        jwksUri: 'https://integration-test.auth0.com/.well-known/jwks.json',
        cache: true,
        rateLimit: true,
      })
    );
  });
});
