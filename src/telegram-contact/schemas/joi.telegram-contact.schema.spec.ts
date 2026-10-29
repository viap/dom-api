import {
  confirmTelegramLinkSchema,
  exchangeTelegramLinkSchema,
} from './joi.telegram-contact.schema';

const apiClient = { name: 'domBot', password: 'secret' };

describe('Telegram contact Joi schemas', () => {
  it('accepts only canonical Telegram identity from a private chat payload', () => {
    const accepted = confirmTelegramLinkSchema.validate({
      apiClient,
      startToken: 's'.repeat(43),
      privateChatId: '12345',
      telegram: { id: '12345', username: 'jane_doe' },
    });
    const invalidId = confirmTelegramLinkSchema.validate({
      apiClient,
      startToken: 's'.repeat(43),
      privateChatId: '12345',
      telegram: { id: '$ne', username: 'jane_doe' },
    });

    expect(accepted.error).toBeUndefined();
    expect(invalidId.error).toBeDefined();
  });

  it('accepts an optional current session only as an opaque secret', () => {
    expect(
      exchangeTelegramLinkSchema.validate({
        apiClient,
        browserProof: 'p'.repeat(43),
        currentSessionToken: 't'.repeat(43),
      }).error,
    ).toBeUndefined();
    expect(
      exchangeTelegramLinkSchema.validate({
        apiClient,
        browserProof: 'short',
      }).error,
    ).toBeDefined();
  });
});
