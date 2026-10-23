import { CLIENT_IP_HEADER, getClientIp } from './client-ip';

describe('getClientIp', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env.WEB_CLIENT_NAME = 'domWeb';
    process.env.WEB_CLIENT_PASSWORD = 'web-secret';
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  const request = (apiClient: unknown, header = '203.0.113.7') => ({
    ip: '10.0.0.1',
    headers: { [CLIENT_IP_HEADER]: header },
    body: { apiClient } as any,
  });

  it('trusts the forwarded visitor IP from the web client', () => {
    expect(
      getClientIp(request({ name: 'domWeb', password: 'web-secret' })),
    ).toBe('203.0.113.7');
  });

  it.each([
    [{ name: 'domWeb', password: 'wrong' }],
    [{ name: 'other', password: 'web-secret' }],
    [undefined],
  ])('ignores the header for %p', (apiClient) => {
    expect(getClientIp(request(apiClient))).toBe('10.0.0.1');
  });

  it('ignores a header that is not an IP address', () => {
    expect(
      getClientIp(
        request({ name: 'domWeb', password: 'web-secret' }, 'admin-lock'),
      ),
    ).toBe('10.0.0.1');
  });
});
