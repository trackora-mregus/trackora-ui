export interface TelematicsEvent {
  id: string;
  vehicleId: string;
  recordedAt: string;

  latitude: number | null;
  longitude: number | null;

  speedMph: number | null;
  fuelLevelPercent: number | null;
  engineTempF: number | null;
  batteryVoltage: number | null;
  odometerMiles: number | null;

  checkEngine: boolean;
  harshBraking: boolean;
  idleMinutes: number;
}

export interface TelematicsDevice {
  id: string;
  vehicleId: string;
  provider: string;
  externalDeviceId: string;
  serialNumber: string | null;
  imei: string | null;
  vin: string | null;
  active: boolean;
  lastSeenAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface LiveAlertEvent {
  alertId: string;
  fleetId: string;
  vehicleId: string;
  vehicleName: string;
  licensePlate: string;
  type: string;
  severity: string;
  message: string;
  createdAt: string;
}
