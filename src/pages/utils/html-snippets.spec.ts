import {
  analyzeHtmlSnippets,
  parseHtmlSnippetMarkers,
  removeHtmlSnippetMarker,
} from './html-snippets';

const marker = (id: string, type = 'button') =>
  `<span data-dom-html-snippet-id="${id}" data-dom-html-snippet="${type}"></span>`;

describe('HTML snippet markers', () => {
  it('parses markers independently of whitespace and attribute order', () => {
    expect(
      parseHtmlSnippetMarkers(
        `<div>${marker(
          'first',
        )}<span\n data-dom-html-snippet="button"\n data-dom-html-snippet-id="second"></span></div>`,
      ),
    ).toEqual({
      markers: [
        { id: 'first', type: 'button' },
        { id: 'second', type: 'button' },
      ],
      invalidMarkers: 0,
    });
  });

  it('reports invalid, duplicate, missing, orphan, and mismatched relations', () => {
    const analysis = analyzeHtmlSnippets(
      `${marker('duplicate')}${marker('duplicate')}${marker('missing')}${marker(
        'mismatch',
        'future',
      )}<div data-dom-html-snippet="button"></div>`,
      [
        { id: 'duplicate', type: 'button' },
        { id: 'duplicate', type: 'button' },
        { id: 'orphan', type: 'button' },
        { id: 'mismatch', type: 'button' },
      ],
    );

    expect(analysis.diagnostics).toEqual(
      expect.arrayContaining([
        { code: 'invalid-marker' },
        { code: 'duplicate-marker', id: 'duplicate' },
        { code: 'missing-configuration', id: 'missing' },
        { code: 'orphan-configuration', id: 'orphan' },
        { code: 'duplicate-configuration', id: 'duplicate' },
        { code: 'type-mismatch', id: 'mismatch' },
      ]),
    );
  });

  it('classifies missing and empty marker types as invalid', () => {
    expect(
      parseHtmlSnippetMarkers(
        '<span data-dom-html-snippet-id="missing"></span>' +
          '<span data-dom-html-snippet="" data-dom-html-snippet-id="empty"></span>',
      ),
    ).toEqual({ markers: [], invalidMarkers: 2 });
  });

  it('handles non-string configuration ids defensively', () => {
    expect(
      analyzeHtmlSnippets(marker('valid'), [
        { id: 'valid', type: 'button' },
        { id: 42, type: 'button' },
      ]).diagnostics,
    ).toContainEqual({ code: 'orphan-configuration' });
  });

  it('removes every exact button marker for an id and sanitizes the result', () => {
    const html = `<p>Before</p>${marker('target')}${marker(
      'target',
    )}<span data-dom-html-snippet="future" data-dom-html-snippet-id="target"></span>${marker(
      'other',
    )}<p onclick="danger()">After</p>`;
    const result = removeHtmlSnippetMarker(html, 'target');

    expect(result).not.toContain(marker('target'));
    expect(result).toContain('data-dom-html-snippet="future"');
    expect(result).toContain(marker('other'));
    expect(result).toContain('<p>Before</p>');
    expect(result).toContain('<p>After</p>');
    expect(result).not.toContain('onclick');
  });
});
