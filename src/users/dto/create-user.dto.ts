export class CreateUserDto {
  readonly name: string;
  readonly roles?: Array<string>;
  readonly telegramId?: string;
  readonly descr?: string;
  readonly contacts?: object;
}
