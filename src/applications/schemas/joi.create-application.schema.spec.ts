import { createApplicationSchema } from './joi.create-application.schema';

describe('createApplicationSchema domainId behavior', () => {
  const validBasePayload = {
    formType: 'general',
    applicant: {
      name: 'Jane Doe',
      contacts: [{ network: 'telegram', username: 'jane', hidden: false }],
    },
    payload: {
      message: 'General request',
    },
  };

  it('accepts payload without domainId', () => {
    const { error } = createApplicationSchema.validate(validBasePayload);
    expect(error).toBeUndefined();
  });

  it('accepts payload with domainId', () => {
    const { error } = createApplicationSchema.validate({
      ...validBasePayload,
      domainId: '660900000000000000000099',
    });
    expect(error).toBeUndefined();
  });

  it('accepts specialist request consultation format with an optional person target', () => {
    const { error } = createApplicationSchema.validate({
      schemaVersion: 2,
      formType: 'specialist_request',
      source: {
        entityType: 'person',
        entityId: '660900000000000000000098',
      },
      applicant: validBasePayload.applicant,
      payload: {
        personId: '660900000000000000000099',
        consultationFormat: 'online',
      },
    });

    expect(error).toBeUndefined();
  });

  it('rejects an invalid specialist request personId', () => {
    const { error } = createApplicationSchema.validate({
      schemaVersion: 2,
      formType: 'specialist_request',
      applicant: validBasePayload.applicant,
      payload: {
        personId: 'not-an-id',
        consultationFormat: 'online',
      },
    });

    expect(error).toBeDefined();
  });
});

describe('createApplicationSchema versioned payloads', () => {
  const applicant = {
    name: 'Jane Doe',
    contacts: [{ network: 'telegram', username: 'jane', hidden: false }],
  };

  it.each([undefined, 1])(
    'preserves the legacy partnership contract for schemaVersion %s',
    (schemaVersion) => {
      const accepted = createApplicationSchema.validate({
        ...(schemaVersion ? { schemaVersion } : {}),
        formType: 'partnership',
        applicant,
        payload: { organizationName: 'DOM partner' },
      });
      const rejected = createApplicationSchema.validate({
        ...(schemaVersion ? { schemaVersion } : {}),
        formType: 'partnership',
        applicant,
        payload: { message: 'Partnership request' },
      });

      expect(accepted.error).toBeUndefined();
      expect(rejected.error).toBeDefined();
    },
  );

  it('accepts a V2 partnership without an organization when message is present', () => {
    const { error } = createApplicationSchema.validate({
      schemaVersion: 2,
      formType: 'partnership',
      applicant,
      payload: { message: 'Partnership request' },
    });

    expect(error).toBeUndefined();
  });

  it.each([
    { payload: {} },
    { payload: { organizationName: 'DOM partner', message: '   ' } },
  ])('rejects a V2 partnership without a non-empty message', ({ payload }) => {
    const { error } = createApplicationSchema.validate({
      schemaVersion: 2,
      formType: 'partnership',
      applicant,
      payload,
    });

    expect(error).toBeDefined();
  });

  it('requires both company and message for V2 corporate training', () => {
    const valid = createApplicationSchema.validate({
      schemaVersion: 2,
      formType: 'corporate_training',
      applicant,
      payload: { companyName: 'DOM', message: 'Training request' },
    });
    const missingCompany = createApplicationSchema.validate({
      schemaVersion: 2,
      formType: 'corporate_training',
      applicant,
      payload: { message: 'Training request' },
    });
    const missingMessage = createApplicationSchema.validate({
      schemaVersion: 2,
      formType: 'corporate_training',
      applicant,
      payload: { companyName: 'DOM' },
    });

    expect(valid.error).toBeUndefined();
    expect(missingCompany.error).toBeDefined();
    expect(missingMessage.error).toBeDefined();
  });

  it.each(['online', 'in_person_tbilisi'])(
    'accepts the %s specialist consultation format with optional fields',
    (consultationFormat) => {
      const { error } = createApplicationSchema.validate({
        schemaVersion: 3,
        formType: 'specialist_request',
        applicant: {
          name: 'Jane Doe',
          preferredContact: {
            type: 'telegram_username',
            username: 'jane_doe',
            verification: 'unverified',
          },
        },
        payload: {
          consultationFormat,
          personId: '660900000000000000000099',
          message: 'Please contact me',
        },
      });

      expect(error).toBeUndefined();
    },
  );

  it('preserves the V1 specialist specialization contract', () => {
    const { error } = createApplicationSchema.validate({
      schemaVersion: 1,
      formType: 'specialist_request',
      applicant,
      payload: {
        specialization: 'Family therapy',
        personId: '660900000000000000000099',
      },
    });

    expect(error).toBeUndefined();
  });

  it.each([2, 3])(
    'rejects a specialist payload outside the V%s contract',
    (schemaVersion) => {
      for (const payload of [
        {},
        { personId: '660900000000000000000099' },
        { consultationFormat: 'hybrid' },
        { consultationFormat: 'online', specialization: 'Family therapy' },
      ]) {
        const { error } = createApplicationSchema.validate({
          schemaVersion,
          formType: 'specialist_request',
          applicant,
          payload,
        });

        expect(error).toBeDefined();
      }
    },
  );

  it.each([
    ['general', { message: 'General request' }],
    ['program_enrollment', { programId: '660900000000000000000099' }],
    ['event_registration', { eventId: '660900000000000000000099' }],
  ])('keeps the %s payload valid in V2', (formType, payload) => {
    const { error } = createApplicationSchema.validate({
      schemaVersion: 2,
      formType,
      applicant,
      payload,
    });

    expect(error).toBeUndefined();
  });

  it('rejects unsupported schema versions', () => {
    const { error } = createApplicationSchema.validate({
      schemaVersion: 4,
      formType: 'general',
      applicant,
      payload: { message: 'General request' },
    });

    expect(error).toBeDefined();
  });

  it('requires schemaVersion 2 for supervision applications', () => {
    const missingVersion = createApplicationSchema.validate({
      formType: 'supervision',
      applicant,
      payload: { requestText: 'I need supervision support' },
    });
    const legacyVersion = createApplicationSchema.validate({
      schemaVersion: 1,
      formType: 'supervision',
      applicant,
      payload: { requestText: 'I need supervision support' },
    });

    expect(missingVersion.error).toBeDefined();
    expect(legacyVersion.error).toBeDefined();
  });

  it('accepts the complete privacy-safe supervision payload', () => {
    const { error } = createApplicationSchema.validate({
      schemaVersion: 2,
      formType: 'supervision',
      applicant,
      payload: {
        requestText: 'I would like support with professional boundaries.',
        professionalRole: 'Practising psychologist',
        formatPreference: 'no_preference',
      },
    });

    expect(error).toBeUndefined();
  });

  it.each([
    {},
    { requestText: '   ' },
    { requestText: 'x'.repeat(1001) },
    { requestText: 'Support', professionalRole: 'x'.repeat(151) },
    { requestText: 'Support', formatPreference: 'online' },
  ])('rejects invalid supervision payloads', (payload) => {
    const { error } = createApplicationSchema.validate({
      schemaVersion: 2,
      formType: 'supervision',
      applicant,
      payload,
    });

    expect(error).toBeDefined();
  });
});

describe('createApplicationSchema V3 contacts', () => {
  const base = {
    schemaVersion: 3,
    formType: 'general',
    payload: { message: 'General request' },
  };

  it('accepts a canonical manual Telegram username', () => {
    const { error } = createApplicationSchema.validate({
      ...base,
      applicant: {
        name: 'Jane',
        preferredContact: {
          type: 'telegram_username',
          username: 'jane_doe',
          verification: 'unverified',
        },
      },
    });

    expect(error).toBeUndefined();
  });

  it.each(['@jane_doe', 'jane doe', 'https://t.me/jane_doe', 'abcd'])(
    'rejects non-canonical Telegram username %s',
    (username) => {
      const { error } = createApplicationSchema.validate({
        ...base,
        applicant: {
          name: 'Jane',
          preferredContact: {
            type: 'telegram_username',
            username,
            verification: 'unverified',
          },
        },
      });

      expect(error).toBeDefined();
    },
  );

  it('accepts one E.164 phone with explicit WhatsApp availability', () => {
    const { error } = createApplicationSchema.validate({
      ...base,
      applicant: {
        name: 'Jane',
        preferredContact: {
          type: 'phone',
          phoneE164: '+995555123456',
          whatsappAvailable: false,
        },
      },
    });

    expect(error).toBeUndefined();
  });

  it.each([
    { phoneE164: '555123456', whatsappAvailable: false },
    { phoneE164: '+0123456789', whatsappAvailable: false },
    { phoneE164: '+995555123456' },
  ])('rejects an invalid phone contact', (preferredContact) => {
    const { error } = createApplicationSchema.validate({
      ...base,
      applicant: {
        name: 'Jane',
        preferredContact: { type: 'phone', ...preferredContact },
      },
    });

    expect(error).toBeDefined();
  });

  it('rejects browser-supplied legacy contacts alongside V3 contact', () => {
    const { error } = createApplicationSchema.validate({
      ...base,
      applicant: {
        name: 'Jane',
        preferredContact: {
          type: 'phone',
          phoneE164: '+995555123456',
          whatsappAvailable: true,
        },
        contacts: [{ network: 'whatsapp', username: '+995555123456' }],
      },
    });

    expect(error).toBeDefined();
  });

  it('keeps V2 contacts valid and rejects preferredContact before V3', () => {
    const legacyApplicant = {
      name: 'Jane',
      contacts: [{ network: 'telegram', username: 'jane' }],
    };
    const accepted = createApplicationSchema.validate({
      schemaVersion: 2,
      formType: 'general',
      applicant: legacyApplicant,
      payload: { message: 'General request' },
    });
    const rejected = createApplicationSchema.validate({
      schemaVersion: 2,
      formType: 'general',
      applicant: {
        ...legacyApplicant,
        preferredContact: {
          type: 'telegram_username',
          username: 'jane_doe',
          verification: 'unverified',
        },
      },
      payload: { message: 'General request' },
    });

    expect(accepted.error).toBeUndefined();
    expect(rejected.error).toBeDefined();
  });
});

describe('createApplicationSchema size limits', () => {
  const base = {
    formType: 'general',
    applicant: {
      name: 'Jane Doe',
      contacts: [{ network: 'phone', username: '+995555000000' }],
    },
    payload: { message: 'Hello' },
  };

  it('rejects more than 5 contacts', () => {
    const contact = { network: 'phone', username: '+995555000000' };
    const { error } = createApplicationSchema.validate({
      ...base,
      applicant: { name: 'Jane', contacts: Array(6).fill(contact) },
    });
    expect(error).toBeDefined();
  });

  it('rejects oversized contact values', () => {
    const { error } = createApplicationSchema.validate({
      ...base,
      applicant: {
        name: 'Jane',
        contacts: [{ network: 'other', username: 'x'.repeat(201) }],
      },
    });
    expect(error).toBeDefined();
  });

  it('rejects more than 10 utm keys', () => {
    const utm = Object.fromEntries(
      Array.from({ length: 11 }, (_, i) => [`k${i}`, 'v']),
    );
    const { error } = createApplicationSchema.validate({
      ...base,
      source: { utm },
    });
    expect(error).toBeDefined();
  });
});
