import {
  sanitizeHtmlBlockContent,
  sanitizeRichTextHtml,
} from './html-sanitizer';

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

describe('sanitizeHtmlBlockContent', () => {
  it('should strip iframe tags', () => {
    const html = '<p>Hello</p><iframe src="https://evil.com"></iframe>';
    expect(sanitizeHtmlBlockContent(html)).toBe('<p>Hello</p>');
  });

  it('should strip object and embed tags', () => {
    const html = '<p>Hello</p><object data="x"></object><embed src="y">';
    expect(sanitizeHtmlBlockContent(html)).toBe('<p>Hello</p>');
  });

  it('should strip event handler attributes', () => {
    const html = '<div onclick="alert(1)" onmouseover="alert(2)">click</div>';
    expect(sanitizeHtmlBlockContent(html)).toBe('<div>click</div>');
  });

  it('should strip javascript: scheme in href', () => {
    const html = '<a href="javascript:alert(1)">link</a>';
    const result = sanitizeHtmlBlockContent(html);
    expect(result).not.toContain('javascript:');
  });

  it('should preserve script and style tags', () => {
    const html =
      '<script>window.x = 1</script><style>.foo { color: red; }</style><p>Hello</p>';
    expect(sanitizeHtmlBlockContent(html)).toContain('<script>');
    expect(sanitizeHtmlBlockContent(html)).toContain('<style>');
    expect(sanitizeHtmlBlockContent(html)).toContain('window.x');
    expect(sanitizeHtmlBlockContent(html)).toContain('color: red');
    expect(sanitizeHtmlBlockContent(html)).toContain('<p>Hello</p>');
  });

  it('should preserve style tags with safe sibling content', () => {
    const html = '<style>.foo { color: red; }</style><p>Hello</p>';
    expect(sanitizeHtmlBlockContent(html)).toContain('<style>');
    expect(sanitizeHtmlBlockContent(html)).toContain('<p>Hello</p>');
  });

  it('should preserve style attributes', () => {
    const html = '<div style="color: red; font-size: 16px;">styled</div>';
    const result = sanitizeHtmlBlockContent(html);
    expect(result).toContain('style=');
    expect(result).toContain('color');
    expect(result).toContain('font-size');
  });

  it('should preserve b and i tags', () => {
    const html = '<p><b>bold</b> <i>italic</i></p>';
    expect(sanitizeHtmlBlockContent(html)).toBe(html);
  });

  it('should preserve id and data attributes', () => {
    const html = '<div id="section-1" data-index="0">content</div>';
    expect(sanitizeHtmlBlockContent(html)).toBe(html);
  });

  it('should preserve class attributes', () => {
    const html = '<div class="my-class"><p class="text-lg">Hello</p></div>';
    expect(sanitizeHtmlBlockContent(html)).toBe(html);
  });

  it('should preserve structural tags', () => {
    const html =
      '<section><header><h1>Title</h1></header><article><p>Content</p></article><footer><p>Footer</p></footer></section>';
    expect(sanitizeHtmlBlockContent(html)).toBe(html);
  });

  it('should preserve table structure with colspan/rowspan', () => {
    const html =
      '<table><thead><tr><th colspan="2">Header</th></tr></thead><tbody><tr><td rowspan="2">Cell</td><td>Cell</td></tr></tbody></table>';
    expect(sanitizeHtmlBlockContent(html)).toBe(html);
  });

  it('should preserve inline formatting tags', () => {
    const html =
      '<p><strong>bold</strong> <em>italic</em> <u>underline</u> <s>strike</s> <mark>highlight</mark> <sub>sub</sub> <sup>sup</sup></p>';
    expect(sanitizeHtmlBlockContent(html)).toBe(html);
  });

  it('should preserve figure/figcaption', () => {
    const html =
      '<figure><img src="https://example.com/img.jpg" alt="test" /><figcaption>Caption</figcaption></figure>';
    expect(sanitizeHtmlBlockContent(html)).toBe(html);
  });

  it('should preserve mailto and tel schemes', () => {
    const html =
      '<a href="mailto:test@example.com">email</a> <a href="tel:+1234567890">call</a>';
    expect(sanitizeHtmlBlockContent(html)).toBe(html);
  });

  it('should append noopener noreferrer to blank target links', () => {
    const html =
      '<a href="https://example.com" target="_blank" rel="nofollow">link</a>';
    expect(sanitizeHtmlBlockContent(html)).toContain(
      'rel="nofollow noopener noreferrer"',
    );
  });

  it('should return empty string for whitespace-only input', () => {
    expect(sanitizeHtmlBlockContent('   ')).toBe('');
    expect(sanitizeHtmlBlockContent('')).toBe('');
  });

  it('should return empty string for undefined input', () => {
    expect(sanitizeHtmlBlockContent(undefined)).toBe('');
  });

  it('should preserve form elements (not in dangerous list)', () => {
    const html =
      '<form action="/"><input type="text" /><button>Go</button></form>';
    expect(sanitizeHtmlBlockContent(html)).toContain('<form');
    expect(sanitizeHtmlBlockContent(html)).toContain('<button>');
  });

  it('should strip noscript and template tags', () => {
    const html =
      '<p>Hello</p><noscript>no js</noscript><template><div>tmpl</div></template>';
    expect(sanitizeHtmlBlockContent(html)).toBe('<p>Hello</p>');
  });
});
