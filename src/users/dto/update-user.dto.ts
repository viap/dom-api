export class UpdateUserDto {
  readonly telegramId: string;
  readonly name: string;
  readonly descr: string;
  readonly roles: Array<string>;
  readonly img?: string;
}
