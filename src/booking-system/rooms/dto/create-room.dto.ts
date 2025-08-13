export interface CreateRoomDto {
  name: string;
  description?: string;
  company: string;
  capacity: number;
  amenities?: string[];
  location?: string;
  isActive?: boolean;
  settings?: {
    allowMultipleBookings?: boolean;
    minimumBookingDuration?: number;
    maximumBookingDuration?: number;
    cleaningTimeAfterBooking?: number;
    advanceNoticeRequired?: number;
  };
  equipment?: {
    projector?: boolean;
    whiteboard?: boolean;
    audioSystem?: boolean;
    videoConferencing?: boolean;
    wifi?: boolean;
    airConditioning?: boolean;
    other?: string[];
  };
}
