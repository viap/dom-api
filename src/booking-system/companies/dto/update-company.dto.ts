export interface UpdateCompanyDto {
  name?: string;
  description?: string;
  address?: string;
  phone?: string;
  email?: string;
  website?: string;
  isActive?: boolean;
  settings?: {
    defaultBookingDuration?: number;
    advanceBookingDays?: number;
    cancellationPolicy?: string;
    timeZone?: string;
  };
}
