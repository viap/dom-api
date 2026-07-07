import { BadRequestException } from '@nestjs/common';
import { JoiValidationPipe } from '@/joi/joi.pipe';
import { PersonRole } from '../enums/person-role.enum';
import { WorkFormat } from '../enums/work-format.enum';
import { Languages } from '../enums/languages.enum';
import { PersonAvailability } from '../enums/person-availability.enum';
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

  it('accepts valid work formats on create and update', () => {
    expect(
      createPersonSchema.validate({
        slug: 'jane-doe',
        fullName: 'Jane Doe',
        workFormat: [WorkFormat.InPerson, WorkFormat.Online],
      }).error,
    ).toBeUndefined();

    expect(
      updatePersonSchema.validate({
        workFormat: [WorkFormat.Online],
      }).error,
    ).toBeUndefined();
  });

  it('rejects invalid work formats', () => {
    expect(
      createPersonSchema.validate({
        slug: 'jane-doe',
        fullName: 'Jane Doe',
        workFormat: ['hybrid'],
      }).error,
    ).toBeDefined();

    expect(
      updatePersonSchema.validate({
        workFormat: ['in-person'],
      }).error,
    ).toBeDefined();
  });

  it('accepts valid languages on create and update', () => {
    expect(
      createPersonSchema.validate({
        slug: 'jane-doe',
        fullName: 'Jane Doe',
        languages: [Languages.Ru, Languages.En],
      }).error,
    ).toBeUndefined();

    expect(
      updatePersonSchema.validate({
        languages: [Languages.Ka],
      }).error,
    ).toBeUndefined();
  });

  it('defaults languages to [ru] on create when omitted', () => {
    const { error, value } = createPersonSchema.validate({
      slug: 'jane-doe',
      fullName: 'Jane Doe',
    });

    expect(error).toBeUndefined();
    expect(value.languages).toEqual([Languages.Ru]);
  });

  it('rejects invalid or duplicate languages and empty languages arrays', () => {
    expect(
      createPersonSchema.validate({
        slug: 'jane-doe',
        fullName: 'Jane Doe',
        languages: ['eng'],
      }).error,
    ).toBeDefined();

    expect(
      createPersonSchema.validate({
        slug: 'jane-doe',
        fullName: 'Jane Doe',
        languages: [Languages.Ru, Languages.Ru],
      }).error,
    ).toBeDefined();

    expect(
      updatePersonSchema.validate({
        languages: [],
      }).error,
    ).toBeDefined();
  });

  it('accepts specialist profile fields on create and update', () => {
    const payload = {
      slug: 'jane-doe',
      fullName: 'Jane Doe',
      title: 'Clinical psychologist',
      workLocationId: '660900000000000000000099',
      specializations: ['Family therapy'],
      educationItems: [
        {
          startDate: '2010-09-01',
          endDate: '2014-06-30',
          institution: 'State University',
          detail: 'Psychology',
        },
      ],
      experienceItems: [
        {
          startDate: '2015-01-01',
          title: 'Therapist',
          organization: 'DOM',
          detail: 'Individual sessions',
        },
      ],
      availability: PersonAvailability.Accepting,
    };

    expect(createPersonSchema.validate(payload).error).toBeUndefined();
    expect(
      updatePersonSchema.validate({
        title: payload.title,
        workLocationId: payload.workLocationId,
        specializations: payload.specializations,
        educationItems: payload.educationItems,
        experienceItems: payload.experienceItems,
        availability: PersonAvailability.Waitlist,
      }).error,
    ).toBeUndefined();
  });

  it('accepts null clear values for optional specialist profile fields', () => {
    expect(
      createPersonSchema.validate({
        slug: 'jane-doe',
        fullName: 'Jane Doe',
        title: null,
        workLocationId: null,
      }).error,
    ).toBeUndefined();

    expect(
      updatePersonSchema.validate({
        title: null,
        workLocationId: null,
      }).error,
    ).toBeUndefined();
  });

  it('rejects invalid specialist profile fields', () => {
    expect(
      updatePersonSchema.validate({ availability: 'busy' }).error,
    ).toBeDefined();

    expect(
      updatePersonSchema.validate({ workLocationId: 'not-an-id' }).error,
    ).toBeDefined();

    expect(
      updatePersonSchema.validate({
        educationItems: [{ institution: '', startDate: '2026-02-30' }],
      }).error,
    ).toBeDefined();

    expect(
      updatePersonSchema.validate({
        experienceItems: [{ title: '', startDate: '2026/02/20' }],
      }).error,
    ).toBeDefined();
  });
});
