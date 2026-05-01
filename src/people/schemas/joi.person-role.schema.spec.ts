import { BadRequestException } from '@nestjs/common';
import { JoiValidationPipe } from '@/joi/joi.pipe';
import { PersonRole } from '../enums/person-role.enum';
import { createPersonSchema } from './joi.create-person.schema';
import { personQuerySchema } from './joi.person-query.schema';
import { personSlugParamsSchema } from './joi.person-slug.params.schema';
import { updatePersonSchema } from './joi.update-person.schema';

describe('Person role Joi validation', () => {
  it('accepts valid roles on create', () => {
    const { error } = createPersonSchema.validate({
      slug: 'jane-doe',
      fullName: 'Jane Doe',
      roles: [PersonRole.Founder, PersonRole.Team],
    });

    expect(error).toBeUndefined();
  });

  it('rejects invalid roles on create', () => {
    const { error } = createPersonSchema.validate({
      slug: 'jane-doe',
      fullName: 'Jane Doe',
      roles: ['moderator'],
    });

    expect(error).toBeDefined();
  });

  it('accepts valid roles on update', () => {
    const { error } = updatePersonSchema.validate({
      roles: [PersonRole.Speaker],
    });

    expect(error).toBeUndefined();
  });

  it('rejects invalid roles on update', () => {
    const { error } = updatePersonSchema.validate({
      roles: ['therapist'],
    });

    expect(error).toBeDefined();
  });

  it('accepts valid role query filter', () => {
    const { error } = personQuerySchema.validate({
      role: PersonRole.Organizer,
    });

    expect(error).toBeUndefined();
  });

  it('rejects invalid role query filter', () => {
    const { error } = personQuerySchema.validate({
      role: 'invalid',
    });

    expect(error).toBeDefined();
  });

  it('returns 4xx-style validation error for invalid role query in pipe', () => {
    const pipe = new JoiValidationPipe(personQuerySchema);

    expect(() => pipe.transform({ role: 'invalid' })).toThrow(
      BadRequestException,
    );
  });

  it('accepts valid slug values on create, update, and params', () => {
    expect(
      createPersonSchema.validate({
        slug: 'jane-doe',
        fullName: 'Jane Doe',
      }).error,
    ).toBeUndefined();
    expect(
      updatePersonSchema.validate({ slug: 'jane-doe' }).error,
    ).toBeUndefined();
    expect(
      personSlugParamsSchema.validate({ slug: 'jane-doe' }).error,
    ).toBeUndefined();
  });

  it('rejects invalid slug values', () => {
    const invalidSlugs = [
      'Jane Doe',
      'иван',
      '',
      'a'.repeat(121),
      '---',
      '-john',
      'john-',
      'john--doe',
    ];

    invalidSlugs.forEach((slug) => {
      expect(
        createPersonSchema.validate({
          slug,
          fullName: 'Jane Doe',
        }).error,
      ).toBeDefined();
      expect(updatePersonSchema.validate({ slug }).error).toBeDefined();
      expect(personSlugParamsSchema.validate({ slug }).error).toBeDefined();
    });
  });
});
