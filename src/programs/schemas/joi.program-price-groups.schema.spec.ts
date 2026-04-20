import { createProgramSchema } from './joi.create-program.schema';
import { updateProgramSchema } from './joi.update-program.schema';

describe('Program Joi priceGroups validation', () => {
  const baseCreatePayload = {
    domainId: '507f1f77bcf86cd799439021',
    kind: 'school',
    title: 'Program title',
    slug: 'program-title',
    format: 'online',
  };

  it('accepts UTC ISO datetime fields', () => {
    const { error } = createProgramSchema.validate({
      ...baseCreatePayload,
      startDate: '2026-04-20T10:00:00.000Z',
      endDate: '2026-04-21T10:00:00.000Z',
      applicationDeadline: '2026-04-19T10:00:00.000Z',
    });

    expect(error).toBeUndefined();
  });

  it('rejects numeric datetime fields', () => {
    const { error } = createProgramSchema.validate({
      ...baseCreatePayload,
      startDate: 1776038400000,
      endDate: 1776124800000,
      applicationDeadline: 1775952000000,
    });

    expect(error).toBeDefined();
  });

  it('rejects numeric datetime fields in update payload', () => {
    const { error } = updateProgramSchema.validate({
      startDate: 1776038400000,
      endDate: 1776124800000,
      applicationDeadline: 1775952000000,
    });

    expect(error).toBeDefined();
  });

  it('rejects semantically invalid datetime fields', () => {
    const { error } = createProgramSchema.validate({
      ...baseCreatePayload,
      startDate: '2026-02-30T10:00:00.000Z',
      endDate: '2026-04-21T10:00:00.000Z',
      applicationDeadline: '2026-04-19T10:00:00.000Z',
    });

    expect(error).toBeDefined();
  });

  it('rejects offset datetime fields', () => {
    const { error } = createProgramSchema.validate({
      ...baseCreatePayload,
      startDate: '2026-04-20T10:00:00.000+04:00',
      endDate: '2026-04-21T10:00:00.000Z',
      applicationDeadline: '2026-04-19T10:00:00.000Z',
    });

    expect(error).toBeDefined();
  });

  it('rejects date-only datetime fields', () => {
    const { error } = createProgramSchema.validate({
      ...baseCreatePayload,
      startDate: '2026-04-20',
      endDate: '2026-04-21T10:00:00.000Z',
      applicationDeadline: '2026-04-19T10:00:00.000Z',
    });

    expect(error).toBeDefined();
  });

  it('rejects empty datetime fields', () => {
    const { error } = createProgramSchema.validate({
      ...baseCreatePayload,
      startDate: '',
      endDate: '2026-04-21T10:00:00.000Z',
      applicationDeadline: '2026-04-19T10:00:00.000Z',
    });

    expect(error).toBeDefined();
  });

  it('accepts valid priceGroups with ISO deadline', () => {
    const { error } = createProgramSchema.validate({
      ...baseCreatePayload,
      priceGroups: [
        {
          title: 'Regular',
          deadline: '2026-04-20T00:00:00.000Z',
          price: { currency: 'gel', value: 700 },
        },
      ],
    });

    expect(error).toBeUndefined();
  });

  it('rejects non-ISO deadline in priceGroups', () => {
    const { error } = createProgramSchema.validate({
      ...baseCreatePayload,
      priceGroups: [
        {
          title: 'Regular',
          deadline: '20/04/2026',
          price: { currency: 'gel', value: 700 },
        },
      ],
    });

    expect(error).toBeDefined();
  });

  it('rejects date-only deadline in priceGroups', () => {
    const { error } = createProgramSchema.validate({
      ...baseCreatePayload,
      priceGroups: [
        {
          title: 'Regular',
          deadline: '2026-04-20',
          price: { currency: 'gel', value: 700 },
        },
      ],
    });

    expect(error).toBeDefined();
  });

  it('rejects semantically invalid deadline in priceGroups', () => {
    const { error } = createProgramSchema.validate({
      ...baseCreatePayload,
      priceGroups: [
        {
          title: 'Regular',
          deadline: '2026-02-30T00:00:00.000Z',
          price: { currency: 'gel', value: 700 },
        },
      ],
    });

    expect(error).toBeDefined();
  });

  it('rejects endDate earlier than startDate', () => {
    const { error } = createProgramSchema.validate({
      ...baseCreatePayload,
      startDate: '2026-04-21T10:00:00.000Z',
      endDate: '2026-04-20T10:00:00.000Z',
      applicationDeadline: '2026-04-19T10:00:00.000Z',
    });

    expect(error).toBeDefined();
  });

  it('rejects applicationDeadline after startDate', () => {
    const { error } = createProgramSchema.validate({
      ...baseCreatePayload,
      startDate: '2026-04-20T10:00:00.000Z',
      endDate: '2026-04-21T10:00:00.000Z',
      applicationDeadline: '2026-04-20T11:00:00.000Z',
    });

    expect(error).toBeDefined();
  });

  it('rejects priceGroups item without price', () => {
    const { error } = updateProgramSchema.validate({
      priceGroups: [{ title: 'No price' }],
    });

    expect(error).toBeDefined();
  });

  it('rejects legacy top-level price field', () => {
    const { error } = updateProgramSchema.validate({
      price: { currency: 'gel', value: 700 },
    });

    expect(error).toBeDefined();
  });
});
