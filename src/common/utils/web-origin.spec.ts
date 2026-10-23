import { parsePublicWebUrl } from './web-origin';

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
