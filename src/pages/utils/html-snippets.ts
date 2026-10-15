import sanitizeHtml from 'sanitize-html';
import { sanitizeHtmlBlockContent } from './html-sanitizer';

export const HTML_SNIPPET_ATTRIBUTE = 'data-dom-html-snippet';
export const HTML_SNIPPET_ID_ATTRIBUTE = 'data-dom-html-snippet-id';
export const HTML_BUTTON_SNIPPET_TYPE = 'button';
export const MAX_HTML_BLOCK_SNIPPETS = 20;

const HTML_SNIPPET_ID_PATTERN = /^[a-zA-Z0-9_-]{1,100}$/;

export interface HtmlSnippetMarker {
  id: string;
  type: string;
}

export type HtmlSnippetDiagnosticCode =
  | 'invalid-marker'
  | 'duplicate-marker'
  | 'missing-configuration'
  | 'orphan-configuration'
  | 'duplicate-configuration'
  | 'type-mismatch';

export interface HtmlSnippetDiagnostic {
  code: HtmlSnippetDiagnosticCode;
  id?: string;
}

type HtmlSnippetConfigurationLike = {
  id?: unknown;
  type?: unknown;
};

export interface HtmlSnippetAnalysis {
  markers: HtmlSnippetMarker[];
  diagnostics: HtmlSnippetDiagnostic[];
}

function inspectHtml(
  html: string,
  visit: (tagName: string, attributes: sanitizeHtml.Attributes) => void,
): void {
  sanitizeHtml(html, {
    allowedTags: false,
    allowVulnerableTags: true,
    allowedAttributes: false,
    transformTags: {
      '*': (tagName, attributes) => {
        visit(tagName, attributes);
        return { tagName, attribs: attributes };
      },
    },
  });
}

export function parseHtmlSnippetMarkers(html: string): {
  markers: HtmlSnippetMarker[];
  invalidMarkers: number;
} {
  const markers: HtmlSnippetMarker[] = [];
  let invalidMarkers = 0;

  inspectHtml(html, (tagName, attributes) => {
    const hasType = Object.prototype.hasOwnProperty.call(
      attributes,
      HTML_SNIPPET_ATTRIBUTE,
    );
    const hasId = Object.prototype.hasOwnProperty.call(
      attributes,
      HTML_SNIPPET_ID_ATTRIBUTE,
    );

    if (!hasType && !hasId) {
      return;
    }

    const type = attributes[HTML_SNIPPET_ATTRIBUTE];
    const id = attributes[HTML_SNIPPET_ID_ATTRIBUTE];
    if (
      tagName !== 'span' ||
      typeof type !== 'string' ||
      !type ||
      typeof id !== 'string' ||
      !HTML_SNIPPET_ID_PATTERN.test(id)
    ) {
      invalidMarkers += 1;
      return;
    }

    markers.push({ id, type });
  });

  return { markers, invalidMarkers };
}

export function analyzeHtmlSnippets(
  html: string,
  configurations: HtmlSnippetConfigurationLike[] = [],
): HtmlSnippetAnalysis {
  const parsed = parseHtmlSnippetMarkers(html);
  const diagnostics: HtmlSnippetDiagnostic[] = Array.from(
    { length: parsed.invalidMarkers },
    () => ({ code: 'invalid-marker' as const }),
  );
  const markerCounts = new Map<string, number>();
  const configurationCounts = new Map<string, number>();
  const firstConfiguration = new Map<string, HtmlSnippetConfigurationLike>();

  for (const marker of parsed.markers) {
    markerCounts.set(marker.id, (markerCounts.get(marker.id) || 0) + 1);
  }

  for (const configuration of configurations) {
    if (typeof configuration.id !== 'string') {
      diagnostics.push({ code: 'orphan-configuration' });
      continue;
    }
    configurationCounts.set(
      configuration.id,
      (configurationCounts.get(configuration.id) || 0) + 1,
    );
    if (!firstConfiguration.has(configuration.id)) {
      firstConfiguration.set(configuration.id, configuration);
    }
  }

  for (const [id, count] of markerCounts) {
    if (count > 1) {
      diagnostics.push({ code: 'duplicate-marker', id });
    }
    const configuration = firstConfiguration.get(id);
    if (!configuration) {
      diagnostics.push({ code: 'missing-configuration', id });
      continue;
    }
    const marker = parsed.markers.find((candidate) => candidate.id === id);
    if (marker && marker.type !== configuration.type) {
      diagnostics.push({ code: 'type-mismatch', id });
    }
  }

  for (const [id, count] of configurationCounts) {
    if (count > 1) {
      diagnostics.push({ code: 'duplicate-configuration', id });
    }
    if (!markerCounts.has(id)) {
      diagnostics.push({ code: 'orphan-configuration', id });
    }
  }

  return { markers: parsed.markers, diagnostics };
}

export function removeHtmlSnippetMarker(html: string, id: string): string {
  const withoutMarkers = sanitizeHtml(html, {
    allowedTags: false,
    allowVulnerableTags: true,
    allowedAttributes: false,
    exclusiveFilter(frame) {
      if (frame.tag !== 'span') {
        return false;
      }
      if (
        frame.attribs[HTML_SNIPPET_ATTRIBUTE] !== HTML_BUTTON_SNIPPET_TYPE ||
        frame.attribs[HTML_SNIPPET_ID_ATTRIBUTE] !== id
      ) {
        return false;
      }
      return true;
    },
  });

  return sanitizeHtmlBlockContent(withoutMarkers);
}
