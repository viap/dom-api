import {
  ApplicationMessagingPolicyService,
  parseApplicationMessagingEnabled,
} from './application-messaging-policy.service';

describe('ApplicationMessagingPolicyService', () => {
  it.each([
    ['true', true],
    ['false', false],
  ] as const)('parses the explicit %s flag', (value, expected) => {
    expect(parseApplicationMessagingEnabled(value)).toBe(expected);
    expect(
      new ApplicationMessagingPolicyService({
        get: jest.fn().mockReturnValue(value),
      } as any).enabled,
    ).toBe(expected);
  });

  it.each([undefined, '', 'TRUE', '0', 'disabled'])(
    'rejects an ambiguous flag value %p',
    (value) => {
      expect(() => parseApplicationMessagingEnabled(value)).toThrow(
        'APPLICATION_MESSAGING_ENABLED',
      );
    },
  );
});
