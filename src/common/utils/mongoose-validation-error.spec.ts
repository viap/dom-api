import mongoose from 'mongoose';
import {
  formatMongooseUpdateValidationError,
  getMongooseValidationErrorPaths,
} from './mongoose-validation-error';

describe('mongoose validation error helpers', () => {
  it('returns sorted ValidationError paths without values or reasons', () => {
    const error = new mongoose.Error.ValidationError();
    error.addError(
      'zeta',
      new mongoose.Error.ValidatorError({
        path: 'zeta',
        value: 'secret-zeta',
        message: 'zeta contains secret-zeta',
      }),
    );
    error.addError(
      'alpha',
      new mongoose.Error.ValidatorError({
        path: 'alpha',
        value: 'secret-alpha',
        message: 'alpha contains secret-alpha',
      }),
    );

    expect(getMongooseValidationErrorPaths(error)).toEqual(['alpha', 'zeta']);
    expect(formatMongooseUpdateValidationError(error)).toBe(
      'Update validation failed: alpha, zeta',
    );
    expect(formatMongooseUpdateValidationError(error)).not.toContain('secret');
  });

  it('deduplicates ValidationError paths', () => {
    const error = new mongoose.Error.ValidationError();
    error.addError(
      'duplicate',
      new mongoose.Error.ValidatorError({ path: 'duplicate', value: 'first' }),
    );
    error.addError(
      'duplicate',
      new mongoose.Error.ValidatorError({ path: 'duplicate', value: 'second' }),
    );

    expect(getMongooseValidationErrorPaths(error)).toEqual(['duplicate']);
  });

  it.each([
    [
      'CastError',
      new mongoose.Error.CastError('String', 'private-value', 'blocks.0.type'),
      'blocks.0.type',
    ],
    [
      'StrictModeError',
      new mongoose.Error.StrictModeError('seo.extra'),
      'seo.extra',
    ],
  ])('returns the path from %s', (_name, error, path) => {
    expect(getMongooseValidationErrorPaths(error)).toEqual([path]);
    expect(formatMongooseUpdateValidationError(error)).toBe(
      `Update validation failed: ${path}`,
    );
    expect(formatMongooseUpdateValidationError(error)).not.toContain(
      'private-value',
    );
  });

  it('uses a stable generic message when a classified error has no path', () => {
    const error = new mongoose.Error.ValidationError();

    expect(getMongooseValidationErrorPaths(error)).toEqual([]);
    expect(formatMongooseUpdateValidationError(error)).toBe(
      'Update validation failed',
    );
  });

  it('passes through unknown errors', () => {
    const error = new Error('database unavailable');

    expect(getMongooseValidationErrorPaths(error)).toBeNull();
    expect(formatMongooseUpdateValidationError(error)).toBeNull();
  });
});
