import { joiUpdateTherapyRequestAnalyticsSchema } from './joi.update-therapy-request-analytics.schema';

describe('joiUpdateTherapyRequestAnalyticsSchema', () => {
  it('accepts manual analytics corrections', () => {
    const { error } = joiUpdateTherapyRequestAnalyticsSchema.validate({
      clientGender: 'unknown',
      requestCategory: 'family',
      topic: 'Family conflict',
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
});
