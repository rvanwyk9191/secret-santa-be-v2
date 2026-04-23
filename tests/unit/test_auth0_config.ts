import { createCheckJwt } from '../../src/auth/auth0.js';

const mockParams: Record<string, string> = {
  '/secret-santa/auth0/domain': 'test.auth0.com',
  '/secret-santa/auth0/audience': 'https://api.test.example',
  '/secret-santa/auth0/client_id': 'test-client-id',
  '/secret-santa/auth0/client_secret': 'test-client-secret',
};

jest.mock('../../src/utils/config.js', () => ({
  getConfigParam: jest.fn().mockImplementation((name: string) =>
    Promise.resolve(mockParams[name])
  ),
}));

jest.mock('jwks-rsa', () => ({
  expressJwtSecret: jest.fn(() => jest.fn()),
}));

jest.mock('express-jwt', () => ({
  expressjwt: jest.fn(() => jest.fn()),
}));

jest.mock('../../src/utils/logger.js', () => ({
  Logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

describe('Auth0 SSM configuration (unit)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should call getConfigParam for all four required SSM paths', async () => {
    const { getConfigParam } = await import('../../src/utils/config.js');
    await createCheckJwt();

    expect(getConfigParam).toHaveBeenCalledWith('/secret-santa/auth0/domain');
    expect(getConfigParam).toHaveBeenCalledWith('/secret-santa/auth0/audience');
    expect(getConfigParam).toHaveBeenCalledWith('/secret-santa/auth0/client_id');
    expect(getConfigParam).toHaveBeenCalledWith(
      '/secret-santa/auth0/client_secret',
      { decrypt: true }
    );
    expect(getConfigParam).toHaveBeenCalledTimes(4);
  });

  it('should return a middleware function when all SSM params are present', async () => {
    const middleware = await createCheckJwt();
    expect(typeof middleware).toBe('function');
  });

  it('should throw when domain is missing from SSM', async () => {
    const { getConfigParam } = await import('../../src/utils/config.js');
    (getConfigParam as jest.Mock).mockImplementation((name: string) =>
      Promise.resolve(name === '/secret-santa/auth0/domain' ? undefined : mockParams[name])
    );

    await expect(createCheckJwt()).rejects.toThrow(
      'Auth0 domain not found in SSM: /secret-santa/auth0/domain'
    );
  });

  it('should throw when audience is missing from SSM', async () => {
    const { getConfigParam } = await import('../../src/utils/config.js');
    (getConfigParam as jest.Mock).mockImplementation((name: string) =>
      Promise.resolve(name === '/secret-santa/auth0/audience' ? undefined : mockParams[name])
    );

    await expect(createCheckJwt()).rejects.toThrow(
      'Auth0 audience not found in SSM: /secret-santa/auth0/audience'
    );
  });

  it('should throw when client_id is missing from SSM', async () => {
    const { getConfigParam } = await import('../../src/utils/config.js');
    (getConfigParam as jest.Mock).mockImplementation((name: string) =>
      Promise.resolve(name === '/secret-santa/auth0/client_id' ? undefined : mockParams[name])
    );

    await expect(createCheckJwt()).rejects.toThrow(
      'Auth0 client_id not found in SSM: /secret-santa/auth0/client_id'
    );
  });

  it('should throw when client_secret is missing from SSM', async () => {
    const { getConfigParam } = await import('../../src/utils/config.js');
    (getConfigParam as jest.Mock).mockImplementation((name: string) =>
      Promise.resolve(name === '/secret-santa/auth0/client_secret' ? undefined : mockParams[name])
    );

    await expect(createCheckJwt()).rejects.toThrow(
      'Auth0 client_secret not found in SSM: /secret-santa/auth0/client_secret'
    );
  });
});
