export interface CreateLocationDto {
  title: string;
  address: string;
  city?: string;
  country?: string;
  geo?: {
    lat: number;
    lng: number;
  };
  notes?: string;
}
