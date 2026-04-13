import { sanitizeRichTextHtml } from './html-sanitizer';

describe('sanitizeRichTextHtml', () => {
  it('should strip dangerous html payloads', () => {
    const html =
      '<p>Hi</p><img src="x" onerror="alert(1)"><a href="javascript:alert(1)">link</a><svg onload="alert(1)"></svg>';

    expect(sanitizeRichTextHtml(html)).toBe(
      '<p>Hi</p><img src="x" /><a>link</a>',
    );
  });

  it('should preserve allowed formatting', () => {
    const html =
      '<p><strong>Hello</strong> <a href="https://example.com">world</a></p>';

    expect(sanitizeRichTextHtml(html)).toBe(html);
  });
});
