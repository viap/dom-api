export interface BookingExportData {
  id: string;
  title: string;
  description?: string;
  room: {
    id: string;
    name: string;
    capacity: number;
    company: {
      id: string;
      name: string;
    };
  };
  bookedBy: {
    id: string;
    name: string;
    email?: string;
  };
  startDateTime: string;
  endDateTime: string;
  duration: number; // in minutes
  status: string;
  attendees: string[];
  metadata?: {
    purpose?: string;
    department?: string;
    estimatedAttendees?: number;
    isPrivate?: boolean;
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
  isRecurring: boolean;
  recurrenceType?: string;
}

export interface BookingExportFilter {
  roomIds?: string[];
  startDate: string;
  endDate: string;
  status?: string[];
  includePrivate?: boolean;
  includeRecurring?: boolean;
}

export interface BookingExportResponse {
  data: BookingExportData[];
  summary: {
    totalBookings: number;
    totalDuration: number; // in minutes
    roomUtilization: {
      roomId: string;
      roomName: string;
      bookingCount: number;
      totalDuration: number;
      utilizationPercentage: number;
    }[];
  };
  filter: BookingExportFilter;
  exportedAt: string;
}
