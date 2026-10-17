import { PageBlockType } from '../enums/page-block-type.enum';
import { PageRootBlock } from '../types/page-block.interface';
import { preserveOmittedHtmlSnippets } from './html-snippet-preservation';

const snippets = [
  {
    id: 'saved',
    type: 'button' as const,
    button: {
      label: 'Saved',
      type: 'external' as any,
      url: 'https://example.com',
    },
  },
];

const html = (id: string, withSnippets = false) => ({
  id,
  type: PageBlockType.Html,
  template: 'vertical' as const,
  content: '<p>Updated</p>',
  ...(withSnippets ? { snippets } : {}),
});

describe('preserveOmittedHtmlSnippets', () => {
  it('preserves omitted snippets recursively and lets an explicit empty list clear', () => {
    const existing = [
      {
        id: 'group',
        type: PageBlockType.Group,
        blocks: [html('nested', true)],
      },
      html('clear', true),
    ];
    const incoming = [
      {
        id: 'group',
        type: PageBlockType.Group,
        blocks: [html('nested')],
      },
      { ...html('clear'), snippets: [] },
    ] as unknown as PageRootBlock[];

    const result = preserveOmittedHtmlSnippets(incoming, existing) as any[];
    expect(result[0].blocks[0].snippets).toEqual(snippets);
    expect(result[1].snippets).toEqual([]);
  });

  it('allows a new uniquely identified legacy HTML block without guessing', () => {
    const [result] = preserveOmittedHtmlSnippets(
      [html('new') as any],
      [html('existing', true)],
    );
    expect('snippets' in result).toBe(false);
  });

  it('rejects duplicate incoming ids when preservation would be ambiguous', () => {
    expect(() =>
      preserveOmittedHtmlSnippets(
        [html('dup') as any, html('dup') as any],
        [html('dup', true)],
      ),
    ).toThrow(/ambiguous block id/);
  });

  it('rejects duplicate existing ids rather than guessing', () => {
    expect(() =>
      preserveOmittedHtmlSnippets(
        [html('dup') as any],
        [html('dup', true), html('dup', true)],
      ),
    ).toThrow(/ambiguous existing block id/);
  });
});

it('preserves omitted snippets in later hidden Hero buttons without reviving a legacy fallback', () => {
  const make = (saved: boolean) =>
    [
      {
        id: 'hero',
        type: PageBlockType.Hero,
        items: [
          {
            title: 'Card',
            buttons: [
              { label: 'First', type: 'external', url: 'https://example.com' },
              {
                label: 'Hidden',
                type: 'block',
                isVisible: false,
                block: html('inner', saved),
              },
            ],
          },
        ],
      },
    ] as unknown as PageRootBlock[];
  const existing = make(true);
  const incoming = make(false);
  const result = preserveOmittedHtmlSnippets(incoming, existing) as any[];
  expect(result[0].items[0].buttons[1].block.snippets).toEqual(snippets);
  expect(result[0].items[0].buttons[1].isVisible).toBe(false);
  expect(
    (incoming[0] as any).items[0].buttons[1].block.snippets,
  ).toBeUndefined();
});
