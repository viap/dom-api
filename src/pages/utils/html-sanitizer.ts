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

const DANGEROUS_TAGS = new Set([
  'iframe',
  'object',
  'embed',
  'noscript',
  'template',
  'link',
  'meta',
  'base',
]);

function stripEventHandlers(
  _tagName: string,
  attribs: sanitizeHtml.Attributes,
): sanitizeHtml.Tag {
  const cleaned: sanitizeHtml.Attributes = {};
  for (const [key, value] of Object.entries(attribs)) {
    if (!key.toLowerCase().startsWith('on')) {
      cleaned[key] = value;
    }
  }
  return { tagName: _tagName, attribs: cleaned };
}

export function sanitizeHtmlBlockContent(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: false,
    allowVulnerableTags: true,
    allowedAttributes: false,
    allowedSchemes: ['http', 'https', 'mailto', 'tel', 'data'],
    allowedSchemesByTag: {
      a: ['http', 'https', 'mailto', 'tel'],
    },
    disallowedTagsMode: 'discard',
    allowProtocolRelative: false,
    enforceHtmlBoundary: true,
    exclusiveFilter(frame) {
      return DANGEROUS_TAGS.has(frame.tag);
    },
    transformTags: {
      '*': stripEventHandlers,
    },
  }).trim();
}
