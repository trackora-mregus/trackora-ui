export interface FleetTelematicsLocation {
  vehicleId: string;
  status: 'ONLINE' | 'STALE' | 'OFFLINE';
  label: string;
  licensePlate: string;
  latitude: number | null;
  longitude: number | null;
  speedMph: number | null;
  engineTempF: number | null;
  batteryVoltage: number | null;
  odometerMiles: number | null;
  fuelLevelPercent: number | null;
  checkEngine: boolean;
  headingDegrees: number | null;
  recordedAt: string;
}

export interface LiveVehicleLocationEvent {
  vehicleId: string;
  fleetId: string;
  vehicleName?: string | null;
  licensePlate?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  speedMph?: number | null;
  engineTempF?: number | null;
  batteryVoltage?: number | null;
  odometerMiles?: number | null;
  headingDegrees?: number | null;
  fuelLevelPercent?: number | null;
  checkEngine?: boolean | null;
  recordedAt: string;
}

export interface TelematicsHistoryPoint {
  latitude: number | null;
  longitude: number | null;
  speedMph: number | null;
  recordedAt: string;
  vehicleId: string;
  make: string;
  model: string;
  licensePlate: string;
}

export interface VehicleTrip {
  startTime: string;
  endTime: string;
  pointCount: number;
  maxSpeedMph: number;
  avgSpeedMph: number;
  durationMinutes: number;
  distanceMiles: number;
}

export interface PageResponse<T> {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}
