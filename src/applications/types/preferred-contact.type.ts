export enum PreferredContactType {
  TelegramUsername = 'telegram_username',
  TelegramIdentity = 'telegram_identity',
  Phone = 'phone',
}

export interface TelegramUsernamePreferredContact {
  type: PreferredContactType.TelegramUsername;
  username: string;
  verification: 'unverified';
}

export interface PhonePreferredContact {
  type: PreferredContactType.Phone;
  phoneE164: string;
  whatsappAvailable: boolean;
}

export interface TelegramIdentityPreferredContact {
  type: PreferredContactType.TelegramIdentity;
  identityId: string;
  usernameSnapshot?: string;
  verifiedAt: string;
}

export interface TelegramIdentityContactRequest {
  type: PreferredContactType.TelegramIdentity;
}

export type PreferredContact =
  | TelegramUsernamePreferredContact
  | TelegramIdentityPreferredContact
  | PhonePreferredContact;

export type PreferredContactInput =
  | TelegramUsernamePreferredContact
  | TelegramIdentityContactRequest
  | PhonePreferredContact;
