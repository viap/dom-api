import { joiCreateTherapyRequestSchema } from './joi.create-therapy-request.schema';
import {
  TherapyRequestCategory,
  TherapyRequestClientGender,
} from '../enums/therapy-request-analytics.enum';

describe('joiCreateTherapyRequestSchema', () => {
  const basePayload = {
    name: 'Client name',
    descr: 'Request description',
    contacts: [{ network: 'telegram', username: '@client' }],
  };

  it('accepts payload without optional user/psychologist ids', () => {
    const { error } = joiCreateTherapyRequestSchema.validate(basePayload);

    expect(error).toBeUndefined();
  });

  it('accepts valid optional user/psychologist ids', () => {
    const { error } = joiCreateTherapyRequestSchema.validate({
      ...basePayload,
      user: '507f1f77bcf86cd799439011',
      psychologist: '507f1f77bcf86cd799439012',
    });

    expect(error).toBeUndefined();
  });

  it('accepts valid optional analytics gender/category values', () => {
    const { error } = joiCreateTherapyRequestSchema.validate({
      ...basePayload,
      clientGender: TherapyRequestClientGender.Female,
      requestCategory: TherapyRequestCategory.Individual,
    });

    expect(error).toBeUndefined();
  });

  it('rejects invalid optional user/psychologist ids', () => {
    const { error } = joiCreateTherapyRequestSchema.validate({
      ...basePayload,
      user: 'invalid-user',
      psychologist: 'invalid-psychologist',
    });

    expect(error).toBeDefined();
  });

  it('rejects invalid analytics gender/category values', () => {
    const { error } = joiCreateTherapyRequestSchema.validate({
      ...basePayload,
      clientGender: 'invalid-gender',
      requestCategory: 'invalid-category',
    });

    expect(error).toBeDefined();
  });

  it('rejects attempts to spoof analytics review metadata', () => {
    const { error } = joiCreateTherapyRequestSchema.validate({
      ...basePayload,
      analyticsReviewRequired: false,
      analyticsInference: {
        clientGender: {
          value: TherapyRequestClientGender.Female,
          confidence: 1,
          sources: ['admin'],
          reasons: ['spoofed'],
          reviewedAt: new Date().toISOString(),
          reviewedBy: 'admin-1',
          manual: true,
        },
      },
    });

    expect(error).toBeDefined();
  });
});
