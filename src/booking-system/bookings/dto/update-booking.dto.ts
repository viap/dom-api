import { RecurrenceType } from '../enums/recurrence-type.enum';

export interface UpdateBookingDto {
  title?: string;
  description?: string;
  room?: string;
  startDateTime?: Date | string;
  endDateTime?: Date | string;
  status?: string;
  cancellationReason?: string;
  recurrenceType?: RecurrenceType;
  recurrenceInterval?: number;
  daysOfWeek?: number[];
  recurrenceEndDate?: Date | string;
  attendees?: string[];
  timeZone?: string;
  metadata?: {
    purpose?: string;
    department?: string;
    contactEmail?: string;
    contactPhone?: string;
    specialRequirements?: string;
    estimatedAttendees?: number;
    isPrivate?: boolean;
    color?: string;
    priority?: number;
  };
  equipmentRequests?: {
    projector?: boolean;
    microphone?: boolean;
    videoConferencing?: boolean;
    catering?: boolean;
    whiteboard?: boolean;
    flipChart?: boolean;
    other?: string[];
  };
}
