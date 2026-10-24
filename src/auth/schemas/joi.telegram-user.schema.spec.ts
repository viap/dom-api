import { joiTelegramUserSchema } from './joi.telegram-user.schema';

describe('joiTelegramUserSchema', () => {
  it('accepts an empty username sent for users without one', () => {
    const { error } = joiTelegramUserSchema.validate({
      id: '12345',
      username: '',
      first_name: 'Name',
      last_name: '',
    });

    expect(error).toBeUndefined();
  });

  it('rejects oversized ids', () => {
    const { error } = joiTelegramUserSchema.validate({ id: '1'.repeat(33) });

    expect(error).toBeDefined();
  });
});
