import sanitizeHtml from 'sanitize-html';

export function sanitizeRichTextHtml(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: [
      'p',
      'br',
      'strong',
      'em',
      'u',
      'blockquote',
      'ul',
      'ol',
      'li',
      'a',
      'h2',
      'h3',
      'h4',
      'img',
    ],
    allowedAttributes: {
      a: ['href', 'target', 'rel'],
      img: ['src', 'alt', 'title'],
    },
    allowedSchemes: ['http', 'https', 'mailto'],
    allowedSchemesByTag: {
      img: ['http', 'https'],
    },
    disallowedTagsMode: 'discard',
    allowProtocolRelative: false,
    enforceHtmlBoundary: true,
  }).trim();
}
