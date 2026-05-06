import { createMenuSchema } from './joi.create-menu.schema';
import { updateMenuSchema } from './joi.update-menu.schema';

describe('menu joi schemas', () => {
  it('create requires at least key or pageId', () => {
    const { error } = createMenuSchema.validate({ title: 'Only title' });
    expect(error).toBeDefined();
  });

  it('create accepts key without pageId', () => {
    const { error } = createMenuSchema.validate({ key: 'main' });
    expect(error).toBeUndefined();
  });

  it('update rejects empty payload', () => {
    const { error } = updateMenuSchema.validate({});
    expect(error).toBeDefined();
  });

  it('update does not inject items default when omitted', () => {
    const { error, value } = updateMenuSchema.validate({ title: 'New title' });
    expect(error).toBeUndefined();
    expect(value.items).toBeUndefined();
  });

  it('update allows null key and pageId for unsetting', () => {
    const { error } = updateMenuSchema.validate({ key: null, pageId: null });
    expect(error).toBeUndefined();
  });
});
