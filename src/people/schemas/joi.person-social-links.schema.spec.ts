import { createPersonSchema } from './joi.create-person.schema';
import { updatePersonSchema } from './joi.update-person.schema';

describe('Person socialLinks Joi validation', () => {
  it('accepts valid url-only socialLinks on create', () => {
    const { error, value } = createPersonSchema.validate({
      fullName: 'Jane Doe',
      socialLinks: [
        { platform: 'instagram', url: 'https://instagram.com/jane' },
      ],
    });

    expect(error).toBeUndefined();
    expect(value.socialLinks).toHaveLength(1);
  });

  it('defaults socialLinks to empty array on create', () => {
    const { error, value } = createPersonSchema.validate({
      fullName: 'Jane Doe',
    });

    expect(error).toBeUndefined();
    expect(value.socialLinks).toEqual([]);
  });

  it('accepts valid value-only socialLinks on update', () => {
    const { error } = updatePersonSchema.validate({
      socialLinks: [{ platform: 'telegram', value: '@jane' }],
    });

    expect(error).toBeUndefined();
  });

  it('accepts socialLinks with both url and value', () => {
    const { error } = updatePersonSchema.validate({
      socialLinks: [
        {
          platform: 'instagram',
          url: 'https://instagram.com/jane',
          value: '@jane',
        },
      ],
    });

    expect(error).toBeUndefined();
  });

  it('rejects socialLinks entries without url and value', () => {
    const { error } = createPersonSchema.validate({
      fullName: 'Jane Doe',
      socialLinks: [{ platform: 'instagram' }],
    });

    expect(error).toBeDefined();
  });

  it('rejects invalid socialLinks url format', () => {
    const { error } = updatePersonSchema.validate({
      socialLinks: [{ platform: 'instagram', url: 'not-a-url' }],
    });

    expect(error).toBeDefined();
  });

  it('rejects non-http(s) socialLinks url schemes', () => {
    const { error } = updatePersonSchema.validate({
      socialLinks: [{ platform: 'instagram', url: 'ftp://example.com/jane' }],
    });

    expect(error).toBeDefined();
  });

  it('rejects over-limit socialLinks url length', () => {
    const tooLongUrl = `https://example.com/${'a'.repeat(285)}`;
    const { error } = updatePersonSchema.validate({
      socialLinks: [{ platform: 'instagram', url: tooLongUrl }],
    });

    expect(error).toBeDefined();
  });

  it('rejects over-limit socialLinks value length', () => {
    const { error } = updatePersonSchema.validate({
      socialLinks: [{ platform: 'instagram', value: 'a'.repeat(301) }],
    });

    expect(error).toBeDefined();
  });

  it('rejects whitespace-only socialLinks value when url is missing', () => {
    const { error } = updatePersonSchema.validate({
      socialLinks: [{ platform: 'instagram', value: '   ' }],
    });

    expect(error).toBeDefined();
  });
});
