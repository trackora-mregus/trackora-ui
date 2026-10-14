import { FleetTelematicsLocation, LiveVehicleLocationEvent } from './fleet-map.models';

type MergeableField = Exclude<keyof FleetTelematicsLocation, 'vehicleId' | 'recordedAt'>;

export interface VehicleLiveStateAccumulator {
  readonly vehicleId: string;
  readonly state: FleetTelematicsLocation | null;
  readonly fieldRecordedAt: Partial<Record<MergeableField, number>>;
  readonly pendingEvents: readonly LiveVehicleLocationEvent[];
}

const mergeableFields: readonly MergeableField[] = [
  'status',
  'label',
  'licensePlate',
  'latitude',
  'longitude',
  'speedMph',
  'engineTempF',
  'batteryVoltage',
  'odometerMiles',
  'fuelLevelPercent',
  'checkEngine',
  'headingDegrees',
];

export function createVehicleLiveStateAccumulator(vehicleId: string): VehicleLiveStateAccumulator {
  return {
    vehicleId,
    state: null,
    fieldRecordedAt: {},
    pendingEvents: [],
  };
}

export function mergeAuthoritativeVehicleState(
  accumulator: VehicleLiveStateAccumulator,
  state: FleetTelematicsLocation,
): VehicleLiveStateAccumulator {
  if (state.vehicleId !== accumulator.vehicleId) {
    return accumulator;
  }

  const timestamp = parseReportTime(state.recordedAt);

  if (timestamp === null) {
    return accumulator;
  }

  let next: VehicleLiveStateAccumulator = {
    vehicleId: accumulator.vehicleId,
    state: accumulator.state ?? { ...state },
    fieldRecordedAt: { ...accumulator.fieldRecordedAt },
    pendingEvents: [],
  };

  next = mergeValues(next, state, timestamp, state.recordedAt);

  for (const event of accumulator.pendingEvents) {
    next = mergeLiveVehicleEvent(next, event);
  }

  return next;
}

export function mergeLiveVehicleEvent(
  accumulator: VehicleLiveStateAccumulator,
  event: LiveVehicleLocationEvent,
): VehicleLiveStateAccumulator {
  if (event.vehicleId !== accumulator.vehicleId) {
    return accumulator;
  }

  const timestamp = parseReportTime(event.recordedAt);

  if (timestamp === null) {
    return accumulator;
  }

  if (!accumulator.state) {
    return {
      ...accumulator,
      pendingEvents: [...accumulator.pendingEvents, { ...event }],
    };
  }

  const values: Partial<Record<MergeableField, unknown>> = {
    status: 'ONLINE',
    label: event.vehicleName,
    licensePlate: event.licensePlate,
    latitude: event.latitude,
    longitude: event.longitude,
    speedMph: event.speedMph,
    engineTempF: event.engineTempF,
    batteryVoltage: event.batteryVoltage,
    odometerMiles: event.odometerMiles,
    headingDegrees: event.headingDegrees,
    fuelLevelPercent: event.fuelLevelPercent,
    checkEngine: event.checkEngine,
  };

  return mergeValues(accumulator, values, timestamp, event.recordedAt);
}

function mergeValues(
  accumulator: VehicleLiveStateAccumulator,
  values: Partial<Record<MergeableField, unknown>>,
  timestamp: number,
  recordedAt: string,
): VehicleLiveStateAccumulator {
  if (!accumulator.state) {
    return accumulator;
  }

  const state = { ...accumulator.state };
  const fieldRecordedAt = { ...accumulator.fieldRecordedAt };
  let changed = false;

  for (const field of mergeableFields) {
    const incoming = values[field];

    if (incoming === null || incoming === undefined) {
      continue;
    }

    const currentTimestamp = fieldRecordedAt[field];
    const current = state[field];
    const canFillUnknown = current === null || current === undefined;

    if (
      currentTimestamp !== undefined &&
      (timestamp < currentTimestamp || (timestamp === currentTimestamp && !canFillUnknown))
    ) {
      continue;
    }

    Object.assign(state, { [field]: incoming });
    fieldRecordedAt[field] = timestamp;
    changed = true;
  }

  if (!changed) {
    return accumulator;
  }

  const currentRecordedAt = parseReportTime(state.recordedAt) ?? Number.NEGATIVE_INFINITY;

  if (timestamp > currentRecordedAt) {
    state.recordedAt = recordedAt;
  }

  return {
    vehicleId: accumulator.vehicleId,
    state,
    fieldRecordedAt,
    pendingEvents: accumulator.pendingEvents,
  };
}

function parseReportTime(value: string): number | null {
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : null;
}
