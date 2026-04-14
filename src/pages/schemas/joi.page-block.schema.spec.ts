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

  it('should allow empty blocks on update', () => {
    const { error } = updatePageSchema.validate({
      blocks: [],
    });

    expect(error).toBeUndefined();
  });
});
