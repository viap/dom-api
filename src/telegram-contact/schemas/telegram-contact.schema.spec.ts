import { telegramContactSessionSchema } from './telegram-contact-session.schema';
import { telegramIdentitySchema } from './telegram-identity.schema';
import { telegramLinkSessionSchema } from './telegram-link-session.schema';

describe('Telegram contact persistence schemas', () => {
  it('never selects raw token hashes by default', () => {
    expect(
      telegramLinkSessionSchema.path('startTokenHash').options.select,
    ).toBe(false);
    expect(
      telegramLinkSessionSchema.path('browserProofHash').options.select,
    ).toBe(false);
    expect(telegramContactSessionSchema.path('tokenHash').options.select).toBe(
      false,
    );
  });

  it('uses unique identity and token indexes plus TTL cleanup', () => {
    expect(telegramIdentitySchema.indexes()).toEqual(
      expect.arrayContaining([
        [{ telegramUserId: 1 }, expect.objectContaining({ unique: true })],
      ]),
    );
    expect(telegramLinkSessionSchema.indexes()).toEqual(
      expect.arrayContaining([
        [{ startTokenHash: 1 }, expect.objectContaining({ unique: true })],
        [{ browserProofHash: 1 }, expect.objectContaining({ unique: true })],
        [{ expiresAt: 1 }, expect.objectContaining({ expireAfterSeconds: 0 })],
      ]),
    );
    expect(telegramContactSessionSchema.indexes()).toEqual(
      expect.arrayContaining([
        [{ tokenHash: 1 }, expect.objectContaining({ unique: true })],
        [{ expiresAt: 1 }, expect.objectContaining({ expireAfterSeconds: 0 })],
      ]),
    );
  });

  it('bounds the persisted Telegram display name', () => {
    expect(telegramIdentitySchema.path('displayName').options.maxlength).toBe(
      129,
    );
  });
});
