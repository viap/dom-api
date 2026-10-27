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

// HTML blocks may carry inline code and styles, but nothing loaded from
// elsewhere: <script> with src/href and CSS @import are removed (<link>,
// <iframe> etc. are already dropped above).
const EXTERNAL_SCRIPT_ATTRIBUTES = ['src', 'href', 'xlink:href'];

function isExternalScript(frame: sanitizeHtml.IFrame): boolean {
  return (
    frame.tag === 'script' &&
    EXTERNAL_SCRIPT_ATTRIBUTES.some((name) => name in frame.attribs)
  );
}

function stripCssImports(html: string): string {
  return html.replace(
    /(<style\b[^>]*>)([\s\S]*?)(<\/style>)/gi,
    (_match, open: string, css: string, close: string) =>
      open + css.replace(/@import\b[^;]*;?/gi, '') + close,
  );
}

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
  if (_tagName === 'a' && cleaned.target === '_blank') {
    const relParts = new Set(
      String(cleaned.rel || '')
        .split(/\s+/)
        .map((value) => value.trim())
        .filter(Boolean),
    );
    relParts.add('noopener');
    relParts.add('noreferrer');
    cleaned.rel = Array.from(relParts).join(' ');
  }
  return { tagName: _tagName, attribs: cleaned };
}

export function sanitizeHtmlBlockContent(html: string): string {
  return stripCssImports(
    sanitizeHtml(html, {
      allowedTags: false,
      allowVulnerableTags: true,
      allowedAttributes: false,
      allowedSchemes: ['http', 'https', 'mailto', 'tel', 'data'],
      allowedSchemesByTag: {
        a: ['http', 'https', 'mailto', 'tel'],
      },
      // Every URL-carrying attribute, not only href/src/cite: otherwise
      // javascript: in form action, formaction or SVG xlink:href survives.
      allowedSchemesAppliedToAttributes: [
        'href',
        'src',
        'cite',
        'action',
        'formaction',
        'xlink:href',
      ],
      disallowedTagsMode: 'discard',
      allowProtocolRelative: false,
      enforceHtmlBoundary: true,
      exclusiveFilter(frame) {
        return DANGEROUS_TAGS.has(frame.tag) || isExternalScript(frame);
      },
      transformTags: {
        '*': stripEventHandlers,
      },
    }),
  ).trim();
}
