import { parseCorsOrigins, parsePublicWebUrl } from './web-origin';

describe('CORS_ORIGINS', () => {
  const [range, site] = parseCorsOrigins(
    ' http://localhost:3000-3999, https://dom.example.com ',
    'dev',
  );

  it.each([3000, 3006, 3456, 3999])('allows HTTP localhost port %i', (port) => {
    expect(`http://localhost:${port}`).toMatch(range);
  });

  it.each([
    'http://localhost:2999',
    'http://localhost:4000',
    'http://localhost:30000',
    'http://127.0.0.1:3006',
    'https://localhost:3006',
    'http://localhost.example.com:3006',
  ])('excludes %s from the localhost range', (origin) => {
    expect(origin).not.toMatch(range);
  });

  it('keeps explicitly listed origins as exact strings', () => {
    expect(site).toBe('https://dom.example.com');
    expect(parseCorsOrigins('http://localhost:3006', 'dev')).toEqual([
      'http://localhost:3006',
    ]);
  });

  it.each(['prod', 'production', 'test', 'development', undefined])(
    'uses only exact entries with NODE_ENV=%p',
    (nodeEnv) => {
      const origins = parseCorsOrigins(
        ' http://localhost:3000-3999, https://dom.example.com ',
        nodeEnv,
      );
      expect(origins).toEqual([
        'http://localhost:3000-3999',
        'https://dom.example.com',
      ]);
    },
  );

  it.each([undefined, '', ' , '])(
    'defaults to localhost:3006 for %p',
    (value) => {
      expect(parseCorsOrigins(value, 'dev')).toEqual(['http://localhost:3006']);
      expect(parseCorsOrigins(value, 'prod')).toEqual([
        'http://localhost:3006',
      ]);
    },
  );
});

describe('PUBLIC_WEB_URL origin parsing', () => {
  it.each([
    ['https://psydom.org', 'https://psydom.org'],
    ['https://psydom.org/', 'https://psydom.org'],
    ['http://127.0.0.1:3006', 'http://127.0.0.1:3006'],
    ['http://[::1]:3006', 'http://[::1]:3006'],
  ])('accepts %s', (input, expected) => {
    expect(parsePublicWebUrl(input)).toBe(expected);
  });

  it.each([
    undefined,
    '',
    'psydom.org',
    'http://localhost:3006',
    'http://devbox:3006',
    'ftp://psydom.org',
    'https://user:pass@psydom.org',
    'https://psydom.org/path',
    'https://psydom.org?query=1',
    'https://psydom.org#fragment',
  ])('rejects invalid origin %s', (input) => {
    expect(() => parsePublicWebUrl(input)).toThrow('PUBLIC_WEB_URL');
  });
});
