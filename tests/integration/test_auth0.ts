import { createCheckJwt } from '../../backend/src/auth/auth0.js';

jest.mock('../../backend/src/utils/config.js', () => ({
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

jest.mock('../../backend/src/utils/logger.js', () => ({
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

  // Constitution v1.13: JWT must be read from the access_token cookie, not the Authorization header
  it('should configure getToken to read JWT from the access_token cookie', async () => {
    const { expressjwt } = await import('express-jwt');
    await createCheckJwt();

    const callArgs = (expressjwt as jest.Mock).mock.calls[0][0] as Record<string, unknown>;
    expect(typeof callArgs['getToken']).toBe('function');

    const getToken = callArgs['getToken'] as (req: unknown) => string | undefined;

    // Should extract token from access_token cookie
    const reqWithCookie = { headers: { cookie: 'access_token=my-jwt-token' } };
    expect(getToken(reqWithCookie)).toBe('my-jwt-token');

    // Should handle multiple cookies correctly
    const reqMultipleCookies = { headers: { cookie: 'other=val; access_token=target-token; extra=ignored' } };
    expect(getToken(reqMultipleCookies)).toBe('target-token');

    // Should return undefined when no cookies present
    const reqNoCookies = { headers: {} };
    expect(getToken(reqNoCookies)).toBeUndefined();

    // Should return undefined when access_token cookie is absent
    const reqOtherCookies = { headers: { cookie: 'session=abc; other=def' } };
    expect(getToken(reqOtherCookies)).toBeUndefined();
  });
});
