import { createPageSchema } from './joi.create-page.schema';
import { updatePageSchema } from './joi.update-page.schema';

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

  it('should allow isHomepage boolean on create', () => {
    const { error } = createPageSchema.validate({
      title: 'Home',
      slug: 'home',
      status: 'published',
      isHomepage: true,
    });

    expect(error).toBeUndefined();
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
});
