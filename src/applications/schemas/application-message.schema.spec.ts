import { applicationMessageSchema } from './application-message.schema';

describe('ApplicationMessage persistence schema', () => {
  it('has no TTL index and keeps idempotency indexes', () => {
    const indexes = applicationMessageSchema.indexes();
    expect(indexes.some(([, options]) => 'expireAfterSeconds' in options)).toBe(
      false,
    );
    expect(
      indexes.some(
        ([fields, options]) =>
          fields.clientMessageId === 1 && options.unique === true,
      ),
    ).toBe(true);
  });
});
