import { BadRequestException } from '@nestjs/common';
import { JoiValidationPipe } from '@/joi/joi.pipe';
import { createPartnerSchema } from './joi.create-partner.schema';
import { updatePartnerSchema } from './joi.update-partner.schema';

describe('Partner links Joi validation', () => {
  it('accepts valid url-only links on create', () => {
    const { error, value } = createPartnerSchema.validate({
      title: 'DOM',
      type: 'media',
      links: [{ platform: 'instagram', url: 'https://instagram.com/dom' }],
    });

    expect(error).toBeUndefined();
    expect(value.links).toHaveLength(1);
  });

  it('defaults links to empty array on create', () => {
    const { error, value } = createPartnerSchema.validate({
      title: 'DOM',
      type: 'media',
    });

    expect(error).toBeUndefined();
    expect(value.links).toEqual([]);
    expect(value.contacts).toEqual([]);
  });

  it('accepts valid contacts on create', () => {
    const { error } = createPartnerSchema.validate({
      title: 'DOM',
      type: 'media',
      contacts: [{ network: 'telegram', username: '@dom', hidden: false }],
    });

    expect(error).toBeUndefined();
  });

  it('rejects invalid contacts on update', () => {
    const { error } = updatePartnerSchema.validate({
      contacts: [{ network: 'invalid-network', username: '@dom' }],
    });

    expect(error).toBeDefined();
  });

  it('accepts valid links on update', () => {
    const { error } = updatePartnerSchema.validate({
      links: [{ platform: 'telegram', url: 'https://t.me/dom' }],
    });

    expect(error).toBeUndefined();
  });

  it('accepts valid value-only links on create', () => {
    const { error } = createPartnerSchema.validate({
      title: 'DOM',
      type: 'media',
      links: [{ platform: 'telegram', value: '@dom' }],
    });

    expect(error).toBeUndefined();
  });

  it('accepts links that include both url and value', () => {
    const { error } = updatePartnerSchema.validate({
      links: [
        {
          platform: 'instagram',
          url: 'https://instagram.com/dom',
          value: '@dom',
        },
      ],
    });

    expect(error).toBeUndefined();
  });

  it('rejects link entries without url and value', () => {
    const { error } = createPartnerSchema.validate({
      title: 'DOM',
      type: 'media',
      links: [{ platform: 'instagram' }],
    });

    expect(error).toBeDefined();
  });

  it('rejects invalid links platform', () => {
    const { error } = createPartnerSchema.validate({
      title: 'DOM',
      type: 'media',
      links: [{ platform: 'facebook', url: 'https://facebook.com/dom' }],
    });

    expect(error).toBeDefined();
  });

  it('rejects invalid links url', () => {
    const { error } = updatePartnerSchema.validate({
      links: [{ platform: 'instagram', url: 'not-a-url' }],
    });

    expect(error).toBeDefined();
  });

  it('rejects non-http(s) links url schemes', () => {
    const { error } = updatePartnerSchema.validate({
      links: [{ platform: 'instagram', url: 'ftp://example.com/dom' }],
    });

    expect(error).toBeDefined();
  });

  it('rejects over-limit links url length', () => {
    const tooLongUrl = `https://example.com/${'a'.repeat(285)}`;
    const { error } = updatePartnerSchema.validate({
      links: [{ platform: 'instagram', url: tooLongUrl }],
    });

    expect(error).toBeDefined();
  });

  it('rejects over-limit links value length', () => {
    const { error } = updatePartnerSchema.validate({
      links: [{ platform: 'instagram', value: 'a'.repeat(301) }],
    });

    expect(error).toBeDefined();
  });

  it('rejects whitespace-only value when url is missing', () => {
    const { error } = updatePartnerSchema.validate({
      links: [{ platform: 'instagram', value: '   ' }],
    });

    expect(error).toBeDefined();
  });

  it('rejects unknown fields in create payload', () => {
    const pipe = new JoiValidationPipe(createPartnerSchema);

    expect(() =>
      pipe.transform({
        title: 'DOM',
        type: 'media',
        unexpectedField: 'not-allowed',
      }),
    ).toThrow(BadRequestException);
  });

});
