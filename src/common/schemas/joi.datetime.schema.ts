import * as Joi from 'joi';

const strictUtcIsoPattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

export const joiUtcIsoDateTime = Joi.date()
  .iso()
  .raw()
  .custom((value, helpers) => {
    const original = helpers.original;
    if (typeof original !== 'string') {
      return helpers.error('any.invalid');
    }

    if (!strictUtcIsoPattern.test(original)) {
      return helpers.error('any.invalid');
    }

    const parsed = new Date(original);
    if (Number.isNaN(parsed.getTime())) {
      return helpers.error('any.invalid');
    }

    if (parsed.toISOString() !== original) {
      return helpers.error('any.invalid');
    }

    return value;
  }, 'strict UTC ISO datetime validation')
  .messages({
    'any.invalid':
      'must be a UTC ISO datetime string in YYYY-MM-DDTHH:mm:ss.sssZ format',
  });
