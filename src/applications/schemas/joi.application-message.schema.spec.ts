import {
  listApplicationMessageThreadsSchema,
  receiveApplicationReplySchema,
} from './joi.application-message.schema';

describe('application message Joi contracts', () => {
  const apiClient = { name: 'domBot', password: 'bot-secret' };
  const identity = {
    privateChatId: '42',
    telegramUserId: '42',
  };

  it('accepts a selected application instead of a native reply reference', () => {
    const result = receiveApplicationReplySchema.validate({
      apiClient,
      ...identity,
      telegramMessageId: 101,
      applicationId: '507f1f77bcf86cd799439031',
      text: 'Applicant reply',
    });

    expect(result.error).toBeUndefined();
  });

  it('requires exactly one thread selector for inbound replies', () => {
    expect(
      receiveApplicationReplySchema.validate({
        apiClient,
        ...identity,
        telegramMessageId: 101,
        text: 'Applicant reply',
      }).error,
    ).toBeDefined();
    expect(
      receiveApplicationReplySchema.validate({
        apiClient,
        ...identity,
        telegramMessageId: 101,
        applicationId: '507f1f77bcf86cd799439031',
        replyToTelegramMessageId: 100,
        text: 'Applicant reply',
      }).error,
    ).toBeDefined();
  });

  it('defaults thread pagination to the first page', () => {
    const result = listApplicationMessageThreadsSchema.validate({
      apiClient,
      ...identity,
    });

    expect(result.error).toBeUndefined();
    expect(result.value.page).toBe(0);
  });
});
