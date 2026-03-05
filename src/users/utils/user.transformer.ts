import { UserResponseDto } from '../dto/user-response.dto';
import { UserDocument } from '../schemas/user.schema';

export function transformUserToDto(user: UserDocument): UserResponseDto {
  return new UserResponseDto({
    id: user._id.toString(),
    name: user.name,
    login: user.login,
    roles: user.roles,
    descr: user.descr,
    contacts: user.contacts,
  });
}

export function transformUsersToDto(users: UserDocument[]): UserResponseDto[] {
  return users.map(transformUserToDto);
}
