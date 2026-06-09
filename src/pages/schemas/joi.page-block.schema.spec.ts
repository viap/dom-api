import { createPageSchema } from './joi.create-page.schema';
import { updatePageSchema } from './joi.update-page.schema';

const objectId = '507f1f77bcf86cd799439221';

describe('createPageSchema', () => {
  it('should allow empty blocks on create', () => {
    const { error } = createPageSchema.validate({
      title: 'About',
      slug: 'about',
      blocks: [],
    });

    expect(error).toBeUndefined();
  });

  it('should reject more than 20 blocks', () => {
    const { error } = createPageSchema.validate({
      title: 'About',
      slug: 'about',
      blocks: Array.from({ length: 21 }, (_, index) => ({
        id: `block-${index}`,
        type: 'applicationForm',
        applicationType: 'general',
      })),
    });

    expect(error).toBeDefined();
  });

  it('should reject more than 50 entity collection items', () => {
    const { error } = createPageSchema.validate({
      title: 'About',
      slug: 'about',
      blocks: [
        {
          id: 'team',
          type: 'entityCollection',
          entityType: 'people',
          layout: 'grid',
          items: Array.from({ length: 51 }, () => '507f1f77bcf86cd799439221'),
        },
      ],
    });

    expect(error).toBeDefined();
  });

  it('should reject invalid page button target ids at the joi layer', () => {
    const { error } = createPageSchema.validate({
      title: 'About',
      slug: 'about',
      blocks: [
        {
          id: 'cta',
          type: 'cta',
          buttons: [
            {
              label: 'Open',
              type: 'page',
              targetId: 'not-an-object-id',
            },
          ],
        },
      ],
    });

    expect(error).toBeDefined();
  });

  it('should allow application buttons with required entity targets', () => {
    const { error } = createPageSchema.validate({
      title: 'About',
      slug: 'about',
      blocks: [
        {
          id: 'cta',
          type: 'cta',
          buttons: [
            {
              label: 'Enroll',
              type: 'application',
              targetId: 'program_enrollment',
              applicationProgramId: '507f1f77bcf86cd799439221',
            },
            {
              label: 'Register',
              type: 'application',
              targetId: 'event_registration',
              applicationEventId: '507f1f77bcf86cd799439222',
            },
            {
              label: 'Partner',
              type: 'application',
              targetId: 'partnership',
            },
          ],
        },
      ],
    });

    expect(error).toBeUndefined();
  });

  it('should reject application buttons with missing entity targets', () => {
    const { error } = createPageSchema.validate({
      title: 'About',
      slug: 'about',
      blocks: [
        {
          id: 'cta',
          type: 'cta',
          buttons: [
            {
              label: 'Enroll',
              type: 'application',
              targetId: 'program_enrollment',
            },
          ],
        },
      ],
    });

    expect(error).toBeDefined();
  });

  it('should reject stale application entity target fields', () => {
    const { error } = createPageSchema.validate({
      title: 'About',
      slug: 'about',
      blocks: [
        {
          id: 'cta',
          type: 'cta',
          buttons: [
            {
              label: 'Partner',
              type: 'application',
              targetId: 'partnership',
              applicationEventId: '507f1f77bcf86cd799439222',
            },
          ],
        },
      ],
    });

    expect(error).toBeDefined();
  });

  it('should reject top-level hero buttons at the joi layer', () => {
    const { error } = createPageSchema.validate({
      title: 'About',
      slug: 'about',
      blocks: [
        {
          id: 'hero',
          type: 'hero',
          buttons: [
            {
              label: 'Open',
              type: 'external',
              url: 'https://example.com',
            },
          ],
        },
      ],
    });

    expect(error).toBeDefined();
  });

  it('should allow up to 50 gallery items', () => {
    const { error } = createPageSchema.validate({
      title: 'Gallery',
      slug: 'gallery',
      blocks: [
        {
          id: 'gallery-1',
          type: 'gallery',
          items: Array.from({ length: 50 }, (_, index) => ({
            mediaId:
              index % 2
                ? '507f1f77bcf86cd799439221'
                : '507f1f77bcf86cd799439222',
          })),
        },
      ],
    });

    expect(error).toBeUndefined();
  });

  it('should reject more than 50 gallery items', () => {
    const { error } = createPageSchema.validate({
      title: 'Gallery',
      slug: 'gallery',
      blocks: [
        {
          id: 'gallery-1',
          type: 'gallery',
          items: Array.from({ length: 51 }, (_, index) => ({
            mediaId:
              index % 2
                ? '507f1f77bcf86cd799439221'
                : '507f1f77bcf86cd799439222',
          })),
        },
      ],
    });

    expect(error).toBeDefined();
  });

  it('should reject invalid anchor and theme values', () => {
    const { error } = createPageSchema.validate({
      title: 'About',
      slug: 'about',
      blocks: [
        {
          id: 'intro',
          type: 'richText',
          anchorId: 'bad anchor',
          theme: 'bad/theme',
        },
      ],
    });

    expect(error).toBeDefined();
  });

  it('should allow background on non-cta blocks', () => {
    const { error } = createPageSchema.validate({
      title: 'About',
      slug: 'about',
      blocks: [
        {
          id: 'intro',
          type: 'richText',
          background: 'linear-gradient(90deg, #ffffff 0%, #f5f5f5 100%)',
        },
      ],
    });

    expect(error).toBeUndefined();
  });

  it('should allow background on cta blocks', () => {
    const { error } = createPageSchema.validate({
      title: 'About',
      slug: 'about',
      blocks: [
        {
          id: 'cta',
          type: 'cta',
          background: 'brand-surface-accent',
          buttons: [
            {
              label: 'Open',
              type: 'external',
              url: 'https://example.com',
            },
          ],
        },
      ],
    });

    expect(error).toBeUndefined();
  });

  it('should allow fullWidth true on all supported block types', () => {
    const minimalBlocks = [
      { id: 'rich-text', type: 'richText' },
      {
        id: 'entity-collection',
        type: 'entityCollection',
        entityType: 'people',
        layout: 'grid',
        items: [objectId],
      },
      { id: 'hero', type: 'hero' },
      {
        id: 'cta',
        type: 'cta',
        buttons: [
          {
            label: 'Open',
            type: 'external',
            url: 'https://example.com',
          },
        ],
      },
      {
        id: 'gallery',
        type: 'gallery',
        items: [{ mediaId: objectId }],
      },
      {
        id: 'application-form',
        type: 'applicationForm',
        applicationType: 'general',
      },
      {
        id: 'html',
        type: 'html',
        content: '<p>Hello</p>',
      },
    ];

    for (const block of minimalBlocks) {
      const { error, value } = createPageSchema.validate({
        title: 'About',
        slug: 'about',
        blocks: [{ ...block, fullWidth: true }],
      });

      expect(error).toBeUndefined();
      expect(value.blocks[0].fullWidth).toBe(true);
    }
  });

  it('should reject non-boolean fullWidth values', () => {
    const { error } = createPageSchema.validate({
      title: 'About',
      slug: 'about',
      blocks: [
        {
          id: 'intro',
          type: 'richText',
          fullWidth: 'wide',
        },
      ],
    });

    expect(error).toBeDefined();
  });

  it('should default omitted fullWidth to false', () => {
    const { error, value } = createPageSchema.validate({
      title: 'About',
      slug: 'about',
      blocks: [
        {
          id: 'intro',
          type: 'richText',
        },
      ],
    });

    expect(error).toBeUndefined();
    expect(value.blocks[0].fullWidth).toBe(false);
  });

  it('should allow textAlign on all supported block types', () => {
    const minimalBlocks = [
      { id: 'rich-text', type: 'richText' },
      {
        id: 'entity-collection',
        type: 'entityCollection',
        entityType: 'people',
        layout: 'grid',
        items: [objectId],
      },
      { id: 'hero', type: 'hero' },
      {
        id: 'cta',
        type: 'cta',
        buttons: [
          {
            label: 'Open',
            type: 'external',
            url: 'https://example.com',
          },
        ],
      },
      {
        id: 'gallery',
        type: 'gallery',
        items: [{ mediaId: objectId }],
      },
      {
        id: 'application-form',
        type: 'applicationForm',
        applicationType: 'general',
      },
      {
        id: 'html',
        type: 'html',
        content: '<p>Hello</p>',
      },
    ];

    for (const block of minimalBlocks) {
      const { error, value } = createPageSchema.validate({
        title: 'About',
        slug: 'about',
        blocks: [{ ...block, textAlign: 'right' }],
      });

      expect(error).toBeUndefined();
      expect(value.blocks[0].textAlign).toBe('right');
    }
  });

  it('should reject invalid textAlign values', () => {
    const { error } = createPageSchema.validate({
      title: 'About',
      slug: 'about',
      blocks: [
        {
          id: 'intro',
          type: 'richText',
          textAlign: 'justify',
        },
      ],
    });

    expect(error).toBeDefined();
  });

  it('should leave omitted textAlign as undefined', () => {
    const { error, value } = createPageSchema.validate({
      title: 'About',
      slug: 'about',
      blocks: [
        {
          id: 'intro',
          type: 'richText',
        },
      ],
    });

    expect(error).toBeUndefined();
    expect(value.blocks[0].textAlign).toBeUndefined();
  });

  it('should reject background values longer than 300 characters', () => {
    const { error } = createPageSchema.validate({
      title: 'About',
      slug: 'about',
      blocks: [
        {
          id: 'intro',
          type: 'richText',
          background: 'a'.repeat(301),
        },
      ],
    });

    expect(error).toBeDefined();
  });

  it('should reject legacy cta backgroundStyle values', () => {
    const { error } = createPageSchema.validate({
      title: 'About',
      slug: 'about',
      blocks: [
        {
          id: 'cta',
          type: 'cta',
          backgroundStyle: 'legacy-background',
          buttons: [
            {
              label: 'Open',
              type: 'external',
              url: 'https://example.com',
            },
          ],
        },
      ],
    });

    expect(error).toBeDefined();
  });

  it('should allow isHomepage boolean on create', () => {
    const { error } = createPageSchema.validate({
      title: 'Home',
      slug: 'home',
      status: 'published',
      isHomepage: true,
    });

    expect(error).toBeUndefined();
  });

  it('should default isTitleVisible to true on create', () => {
    const { error, value } = createPageSchema.validate({
      title: 'Home',
      slug: 'home',
    });

    expect(error).toBeUndefined();
    expect(value.isTitleVisible).toBe(true);
  });

  it('should allow explicit isTitleVisible false on create', () => {
    const { error, value } = createPageSchema.validate({
      title: 'Home',
      slug: 'home',
      isTitleVisible: false,
    });

    expect(error).toBeUndefined();
    expect(value.isTitleVisible).toBe(false);
  });

  it('should allow empty blocks on update', () => {
    const { error } = updatePageSchema.validate({
      blocks: [],
    });

    expect(error).toBeUndefined();
  });

  it('should reject invalid isHomepage type on update', () => {
    const { error } = updatePageSchema.validate({
      isHomepage: 'yes',
    });

    expect(error).toBeDefined();
  });

  it('should reject invalid isTitleVisible type on update', () => {
    const { error } = updatePageSchema.validate({
      isTitleVisible: 'yes',
    });

    expect(error).toBeDefined();
  });

  it('should accept a valid HTML block with all fields', () => {
    const { error } = createPageSchema.validate({
      title: 'Test',
      slug: 'test',
      blocks: [
        {
          id: 'html-1',
          type: 'html',
          title: 'Section Title',
          subtitle: 'Subtitle',
          description: 'Desc',
          padding: 'md',
          background: 'cream',
          template: 'horizontal-left',
          content: '<p>Hello world</p>',
        },
      ],
    });

    expect(error).toBeUndefined();
  });

  it('should accept HTML block with template defaulting to vertical', () => {
    const { error, value } = createPageSchema.validate({
      title: 'Test',
      slug: 'test',
      blocks: [
        {
          id: 'html-1',
          type: 'html',
          content: '<p>Hello</p>',
        },
      ],
    });

    expect(error).toBeUndefined();
    expect(value.blocks[0].template).toBe('vertical');
  });

  it('should reject HTML block with missing content', () => {
    const { error } = createPageSchema.validate({
      title: 'Test',
      slug: 'test',
      blocks: [
        {
          id: 'html-1',
          type: 'html',
          template: 'vertical',
        },
      ],
    });

    expect(error).toBeDefined();
  });

  it('should reject HTML block with empty content', () => {
    const { error } = createPageSchema.validate({
      title: 'Test',
      slug: 'test',
      blocks: [
        {
          id: 'html-1',
          type: 'html',
          content: '   ',
        },
      ],
    });

    expect(error).toBeDefined();
  });

  it('should reject HTML block with invalid template', () => {
    const { error } = createPageSchema.validate({
      title: 'Test',
      slug: 'test',
      blocks: [
        {
          id: 'html-1',
          type: 'html',
          template: 'diagonal',
          content: '<p>Hello</p>',
        },
      ],
    });

    expect(error).toBeDefined();
  });

  it('should reject HTML block with content exceeding max length', () => {
    const { error } = createPageSchema.validate({
      title: 'Test',
      slug: 'test',
      blocks: [
        {
          id: 'html-1',
          type: 'html',
          content: 'a'.repeat(50001),
        },
      ],
    });

    expect(error).toBeDefined();
  });

  it('should accept HTML block with minimal fields', () => {
    const { error } = createPageSchema.validate({
      title: 'Test',
      slug: 'test',
      blocks: [
        {
          id: 'html-1',
          type: 'html',
          content: '<div>Minimal</div>',
        },
      ],
    });

    expect(error).toBeUndefined();
  });
});
