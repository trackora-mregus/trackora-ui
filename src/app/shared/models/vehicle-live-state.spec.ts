import { describe, expect, it } from 'vitest';

import { FleetTelematicsLocation } from './fleet-map.models';
import {
  createVehicleLiveStateAccumulator,
  mergeAuthoritativeVehicleState,
  mergeLiveVehicleEvent,
} from './vehicle-live-state';

const initial: FleetTelematicsLocation = {
  vehicleId: 'vehicle-1',
  status: 'STALE',
  label: 'Truck 1',
  licensePlate: 'ABC123',
  latitude: 29,
  longitude: -82,
  speedMph: 40,
  engineTempF: 190,
  batteryVoltage: 12.5,
  odometerMiles: 1000,
  fuelLevelPercent: 60,
  checkEngine: true,
  headingDegrees: 90,
  recordedAt: '2026-09-25T12:00:00Z',
};

function seeded() {
  return mergeAuthoritativeVehicleState(
    createVehicleLiveStateAccumulator(initial.vehicleId),
    initial,
  );
}

describe('vehicle live state accumulator', () => {
  it('preserves omitted and null fields while applying zero and false', () => {
    const result = mergeLiveVehicleEvent(seeded(), {
      vehicleId: initial.vehicleId,
      fleetId: 'fleet-1',
      speedMph: 0,
      fuelLevelPercent: null,
      checkEngine: false,
      recordedAt: '2026-09-25T12:01:00Z',
    });

    expect(result.state).toMatchObject({
      speedMph: 0,
      fuelLevelPercent: 60,
      checkEngine: false,
      batteryVoltage: 12.5,
    });
  });

  it('orders each field by report time instead of arrival order', () => {
    const newer = mergeLiveVehicleEvent(seeded(), {
      vehicleId: initial.vehicleId,
      fleetId: 'fleet-1',
      speedMph: 55,
      recordedAt: '2026-09-25T12:02:00Z',
    });
    const older = mergeLiveVehicleEvent(newer, {
      vehicleId: initial.vehicleId,
      fleetId: 'fleet-1',
      speedMph: 10,
      fuelLevelPercent: 50,
      recordedAt: '2026-09-25T12:01:00Z',
    });

    expect(older.state?.speedMph).toBe(55);
    expect(older.state?.fuelLevelPercent).toBe(50);
  });

  it('fills unknown equal-time fields without replacing conflicts', () => {
    const base = mergeAuthoritativeVehicleState(
      createVehicleLiveStateAccumulator(initial.vehicleId),
      { ...initial, batteryVoltage: null },
    );
    const result = mergeLiveVehicleEvent(base, {
      vehicleId: initial.vehicleId,
      fleetId: 'fleet-1',
      speedMph: 99,
      batteryVoltage: 13.2,
      recordedAt: initial.recordedAt,
    });

    expect(result.state?.speedMph).toBe(40);
    expect(result.state?.batteryVoltage).toBe(13.2);
  });

  it('buffers live events until REST establishes state and keeps newer values', () => {
    const empty = createVehicleLiveStateAccumulator(initial.vehicleId);
    const pending = mergeLiveVehicleEvent(empty, {
      vehicleId: initial.vehicleId,
      fleetId: 'fleet-1',
      latitude: 30,
      longitude: -81,
      speedMph: 65,
      recordedAt: '2026-09-25T12:02:00Z',
    });
    const result = mergeAuthoritativeVehicleState(pending, initial);

    expect(result.state).toMatchObject({
      latitude: 30,
      longitude: -81,
      speedMph: 65,
      fuelLevelPercent: 60,
    });
  });

  it('ignores invalid timestamps, other vehicles, and does not mutate input', () => {
    const base = seeded();
    const invalid = mergeLiveVehicleEvent(base, {
      vehicleId: initial.vehicleId,
      fleetId: 'fleet-1',
      speedMph: 80,
      recordedAt: 'invalid',
    });
    const other = mergeLiveVehicleEvent(base, {
      vehicleId: 'vehicle-2',
      fleetId: 'fleet-1',
      speedMph: 80,
      recordedAt: '2026-09-25T12:03:00Z',
    });
    const changed = mergeLiveVehicleEvent(base, {
      vehicleId: initial.vehicleId,
      fleetId: 'fleet-1',
      speedMph: 80,
      recordedAt: '2026-09-25T12:03:00Z',
    });

    expect(invalid).toBe(base);
    expect(other).toBe(base);
    expect(base.state?.speedMph).toBe(40);
    expect(changed.state?.speedMph).toBe(80);
    expect(changed.state).not.toBe(base.state);
  });
});
