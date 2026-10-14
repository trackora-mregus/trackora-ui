import { TestBed } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';
import { describe, expect, it, vi } from 'vitest';

import { FleetAlertLiveService } from '../../../../core/services/fleet-alert-live.service';
import { FleetLiveLocationService } from '../../../../core/services/fleet-live-location.service';
import { TelematicsService } from '../../../../core/services/telematics.service';
import { FleetMapComponent } from './fleet-map';

describe('FleetMapComponent live compatibility', () => {
  it('preserves known telemetry when a partial event omits or nulls fields', async () => {
    await TestBed.configureTestingModule({
      imports: [FleetMapComponent],
      providers: [
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: { paramMap: { get: vi.fn(() => 'fleet-1') } },
          },
        },
        { provide: TelematicsService, useValue: {} },
        { provide: FleetLiveLocationService, useValue: {} },
        { provide: FleetAlertLiveService, useValue: {} },
      ],
    }).compileComponents();

    const component = TestBed.createComponent(FleetMapComponent).componentInstance;
    const renderMarkers = vi.fn();
    Object.assign(component as object, { renderMarkers });
    component.locations.set([
      {
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
      },
    ]);

    (component as unknown as { updateLiveVehicle(event: object): void }).updateLiveVehicle({
      vehicleId: 'vehicle-1',
      fleetId: 'fleet-1',
      speedMph: 0,
      fuelLevelPercent: null,
      checkEngine: false,
      recordedAt: '2026-09-25T12:01:00Z',
    });

    expect(component.locations()[0]).toMatchObject({
      speedMph: 0,
      fuelLevelPercent: 60,
      checkEngine: false,
      latitude: 29,
      longitude: -82,
    });
    expect(renderMarkers).toHaveBeenCalled();
  });
});
