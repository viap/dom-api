import { Request } from 'express';
import { UserDocument } from '../../users/schemas/user.schema';
import { PsychologistContext } from '../psychologist-context/psychologist.interface';
import { UserContext } from '../user-context/user-context.interface';

export interface EnhancedRequest extends Request {
  user?: UserDocument;
  userContext?: UserContext;
  psychologistContext?: PsychologistContext;
}
