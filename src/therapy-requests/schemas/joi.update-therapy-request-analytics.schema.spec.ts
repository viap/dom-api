import { joiUpdateTherapyRequestAnalyticsSchema } from './joi.update-therapy-request-analytics.schema';

describe('joiUpdateTherapyRequestAnalyticsSchema', () => {
  it('accepts manual analytics corrections', () => {
    const { error } = joiUpdateTherapyRequestAnalyticsSchema.validate({
      clientGender: 'unknown',
      requestCategory: 'family',
      analyticsReviewRequired: false,
    });

    expect(error).toBeUndefined();
  });

  it('rejects unsupported values', () => {
    const { error } = joiUpdateTherapyRequestAnalyticsSchema.validate({
      clientGender: 'verified',
      requestCategory: 'couple',
    });

    expect(error).toBeDefined();
  });

  it('rejects topic analytics edits', () => {
    const { error } = joiUpdateTherapyRequestAnalyticsSchema.validate({
      topic: 'Family conflict',
    });

    expect(error).toBeDefined();
  });
});
