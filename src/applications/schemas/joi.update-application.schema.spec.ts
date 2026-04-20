import { updateApplicationSchema } from './joi.update-application.schema';

describe('updateApplicationSchema notes.createdAt validation', () => {
  it('accepts UTC ISO datetime for notes.createdAt', () => {
    const { error } = updateApplicationSchema.validate({
      notes: [
        {
          text: 'Called applicant',
          authorId: '660900000000000000000001',
          createdAt: '2026-04-10T11:20:00.000Z',
        },
      ],
    });

    expect(error).toBeUndefined();
  });

  it('rejects numeric notes.createdAt', () => {
    const { error } = updateApplicationSchema.validate({
      notes: [
        {
          text: 'Called applicant',
          authorId: '660900000000000000000001',
          createdAt: 1775810400000,
        },
      ],
    });

    expect(error).toBeDefined();
  });

  it('rejects non-UTC ISO notes.createdAt', () => {
    const { error } = updateApplicationSchema.validate({
      notes: [
        {
          text: 'Called applicant',
          authorId: '660900000000000000000001',
          createdAt: '2026-04-10T15:20:00.000+04:00',
        },
      ],
    });

    expect(error).toBeDefined();
  });

  it('rejects date-only notes.createdAt', () => {
    const { error } = updateApplicationSchema.validate({
      notes: [
        {
          text: 'Called applicant',
          authorId: '660900000000000000000001',
          createdAt: '2026-04-10',
        },
      ],
    });

    expect(error).toBeDefined();
  });

  it('rejects empty notes.createdAt', () => {
    const { error } = updateApplicationSchema.validate({
      notes: [
        {
          text: 'Called applicant',
          authorId: '660900000000000000000001',
          createdAt: '',
        },
      ],
    });

    expect(error).toBeDefined();
  });

  it('rejects semantically invalid notes.createdAt', () => {
    const { error } = updateApplicationSchema.validate({
      notes: [
        {
          text: 'Called applicant',
          authorId: '660900000000000000000001',
          createdAt: '2026-02-30T00:00:00.000Z',
        },
      ],
    });

    expect(error).toBeDefined();
  });
});
