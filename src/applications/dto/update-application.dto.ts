import { ApplicationStatus } from '../enums/application-status.enum';

export interface UpdateApplicationDto {
  status?: ApplicationStatus;
  assignedTo?: string;
  source?: {
    entityType?: string;
    entityId?: string;
    utm?: Record<string, string>;
  };
  payload?: Record<string, unknown>;
  notes?: Array<{
    text: string;
    authorId: string;
    createdAt: string;
  }>;
}
