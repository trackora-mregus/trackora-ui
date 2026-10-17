import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Subject, of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { FleetLiveLocationService } from '../../../../core/services/fleet-live-location.service';
import { TelematicsService } from '../../../../core/services/telematics.service';
import {
  FleetTelematicsLocation,
  LiveVehicleLocationEvent,
} from '../../../../shared/models/fleet-map.models';
import { VehicleMapComponent } from './vehicle-map.component';
import { runMonitoringBoundaryMatrix } from '../../../../../testing/monitoring-boundary-fixtures.spec-helper';

const restState: FleetTelematicsLocation = {
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

describe('VehicleMapComponent live updates', () => {
  let component: VehicleMapComponent;
  let fixture: ComponentFixture<VehicleMapComponent>;
  let events: Subject<LiveVehicleLocationEvent>;
  let telematics: {
    getCurrentVehicleState: ReturnType<typeof vi.fn>;
    getVehicleTrips: ReturnType<typeof vi.fn>;
    getVehicleHistory: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    events = new Subject<LiveVehicleLocationEvent>();
    telematics = {
      getCurrentVehicleState: vi.fn(() => of(restState)),
      getVehicleTrips: vi.fn(() =>
        of({
          content: [],
          page: 0,
          size: 10,
          totalElements: 0,
          totalPages: 0,
        }),
      ),
      getVehicleHistory: vi.fn(() => of([])),
    };

    await TestBed.configureTestingModule({
      imports: [VehicleMapComponent],
      providers: [
        { provide: TelematicsService, useValue: telematics },
        {
          provide: FleetLiveLocationService,
          useValue: { connectToFleet: vi.fn(() => events.asObservable()) },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(VehicleMapComponent);
    fixture.componentRef.setInput('fleetId', 'fleet-1');
    fixture.componentRef.setInput('vehicleId', 'vehicle-1');
    fixture.componentRef.setInput('vehicleName', 'Truck 1');
    fixture.componentRef.setInput('licensePlate', 'ABC123');
    component = fixture.componentInstance;
  });

  function initializeWithoutLeaflet(): void {
    const internals = component as unknown as {
      initializeMap(): void;
      observeMapSize(): void;
      loadRange(range: 'TODAY' | '7_DAYS' | '30_DAYS'): void;
      renderCurrentMarker(state: FleetTelematicsLocation): void;
    };
    vi.spyOn(internals, 'initializeMap').mockImplementation(() => undefined);
    vi.spyOn(internals, 'observeMapSize').mockImplementation(() => undefined);
    vi.spyOn(internals, 'loadRange').mockImplementation(() => undefined);
    vi.spyOn(internals, 'renderCurrentMarker').mockImplementation(() => undefined);
    fixture.detectChanges();
  }

  it('loads REST state and applies only matching partial events', () => {
    initializeWithoutLeaflet();
    const render = (
      component as unknown as {
        renderCurrentMarker: ReturnType<typeof vi.fn>;
      }
    ).renderCurrentMarker;
    render.mockClear();
    events.next({
      vehicleId: 'vehicle-2',
      fleetId: 'fleet-1',
      speedMph: 99,
      recordedAt: '2026-09-25T12:01:00Z',
    });
    expect(component.currentState()?.speedMph).toBe(40);

    events.next({
      vehicleId: 'vehicle-1',
      fleetId: 'fleet-1',
      latitude: 30,
      longitude: -81,
      headingDegrees: 0,
      speedMph: 0,
      fuelLevelPercent: null,
      checkEngine: false,
      recordedAt: '2026-09-25T12:01:00Z',
    });
    expect(component.currentState()).toMatchObject({
      speedMph: 0,
      fuelLevelPercent: 60,
      checkEngine: false,
      latitude: 30,
      longitude: -81,
      headingDegrees: 0,
    });
    expect(render).toHaveBeenCalledWith(
      expect.objectContaining({
        latitude: 30,
        longitude: -81,
        headingDegrees: 0,
      }),
    );
  });

  it('updates telemetry without coordinates and renders all required values', () => {
    initializeWithoutLeaflet();
    events.next({
      vehicleId: 'vehicle-1',
      fleetId: 'fleet-1',
      speedMph: 51,
      fuelLevelPercent: 44,
      batteryVoltage: 13.1,
      engineTempF: 201,
      odometerMiles: 1005,
      checkEngine: false,
      recordedAt: '2026-09-25T12:01:00Z',
    });
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent;
    expect(text).toContain('51 mph');
    expect(text).toContain('44%');
    expect(text).toContain('13.1 V');
    expect(text).toContain('201 °F');
    expect(text).toContain('1,005 mi');
    expect(text).toContain('Check Engine');
    expect(text).toContain('Off');
  });

  it('does not let older REST state overwrite a buffered newer event', () => {
    const delayedRest = new Subject<FleetTelematicsLocation>();
    telematics.getCurrentVehicleState.mockReturnValue(delayedRest.asObservable());
    initializeWithoutLeaflet();
    events.next({
      vehicleId: 'vehicle-1',
      fleetId: 'fleet-1',
      latitude: 30,
      longitude: -81,
      speedMph: 65,
      recordedAt: '2026-09-25T12:02:00Z',
    });
    delayedRest.next(restState);
    expect(component.currentState()).toMatchObject({
      latitude: 30,
      longitude: -81,
      speedMph: 65,
      fuelLevelPercent: 60,
    });
  });

  it('pans only in Live mode with auto-follow enabled', () => {
    initializeWithoutLeaflet();
    const panTo = vi.fn();
    Object.assign(component as object, { map: { panTo, remove: vi.fn() } });
    events.next({
      vehicleId: 'vehicle-1',
      fleetId: 'fleet-1',
      latitude: 30,
      longitude: -81,
      recordedAt: '2026-09-25T12:01:00Z',
    });
    expect(panTo).toHaveBeenCalledTimes(1);

    component.autoFollow.set(false);
    events.next({
      vehicleId: 'vehicle-1',
      fleetId: 'fleet-1',
      latitude: 31,
      longitude: -80,
      recordedAt: '2026-09-25T12:02:00Z',
    });
    expect(panTo).toHaveBeenCalledTimes(1);

    component.autoFollow.set(true);
    component.mapMode.set('HISTORY');
    events.next({
      vehicleId: 'vehicle-1',
      fleetId: 'fleet-1',
      latitude: 32,
      longitude: -79,
      recordedAt: '2026-09-25T12:03:00Z',
    });
    expect(panTo).toHaveBeenCalledTimes(1);
    expect(component.currentState()?.latitude).toBe(32);
  });

  it('centers on retained coordinates when auto-follow is enabled', () => {
    initializeWithoutLeaflet();
    const panTo = vi.fn();
    Object.assign(component as object, { map: { panTo, remove: vi.fn() } });
    component.autoFollow.set(false);
    component.toggleAutoFollow();
    expect(component.autoFollow()).toBe(true);
    expect(panTo).toHaveBeenCalledWith([29, -82], expect.objectContaining({ animate: true }));
  });

  it('retains live state during History and renders it when Live resumes', () => {
    vi.useFakeTimers();
    initializeWithoutLeaflet();
    const render = (
      component as unknown as {
        renderCurrentMarker: ReturnType<typeof vi.fn>;
      }
    ).renderCurrentMarker;
    const setView = vi.fn();
    Object.assign(component as object, {
      map: {
        hasLayer: vi.fn(() => false),
        addLayer: vi.fn(),
        invalidateSize: vi.fn(),
        setView,
        remove: vi.fn(),
      },
    });
    component.mapMode.set('HISTORY');
    const selectedTrip = {
      startTime: '2026-09-25T10:00:00Z',
      endTime: '2026-09-25T11:00:00Z',
      pointCount: 2,
      maxSpeedMph: 50,
      avgSpeedMph: 30,
      durationMinutes: 60,
      distanceMiles: 30,
    };
    component.selectedTrip.set(selectedTrip);
    component.playbackRunning.set(true);
    render.mockClear();
    events.next({
      vehicleId: 'vehicle-1',
      fleetId: 'fleet-1',
      latitude: 33,
      longitude: -78,
      recordedAt: '2026-09-25T12:04:00Z',
    });
    expect(render).not.toHaveBeenCalled();
    expect(component.selectedTrip()).toBe(selectedTrip);
    expect(component.playbackRunning()).toBe(true);

    component.showLiveMode();
    vi.runAllTimers();
    expect(render).toHaveBeenCalledWith(expect.objectContaining({ latitude: 33, longitude: -78 }));
    expect(setView).toHaveBeenCalledWith([33, -78], 15);
    vi.useRealTimers();
  });

  it('requests authoritative state for every new component instance', () => {
    initializeWithoutLeaflet();
    expect(telematics.getCurrentVehicleState).toHaveBeenCalledWith('vehicle-1');
    fixture.destroy();

    const second = TestBed.createComponent(VehicleMapComponent);
    second.componentRef.setInput('fleetId', 'fleet-1');
    second.componentRef.setInput('vehicleId', 'vehicle-1');
    const next = second.componentInstance;
    const internals = next as unknown as {
      initializeMap(): void;
      observeMapSize(): void;
      loadRange(range: 'TODAY' | '7_DAYS' | '30_DAYS'): void;
      renderCurrentMarker(state: FleetTelematicsLocation): void;
    };
    vi.spyOn(internals, 'initializeMap').mockImplementation(() => undefined);
    vi.spyOn(internals, 'observeMapSize').mockImplementation(() => undefined);
    vi.spyOn(internals, 'loadRange').mockImplementation(() => undefined);
    vi.spyOn(internals, 'renderCurrentMarker').mockImplementation(() => undefined);
    second.detectChanges();
    expect(telematics.getCurrentVehicleState).toHaveBeenCalledTimes(2);
    second.destroy();
  });

  it('preserves REST, live telemetry, and history isolation across every monitoring boundary state', async () => {
    initializeWithoutLeaflet();
    component.mapMode.set('HISTORY');
    let sequence = 1;
    await runMonitoringBoundaryMatrix(() => {
      const speedMph = 40 + sequence;
      events.next({
        vehicleId: 'vehicle-1', fleetId: 'fleet-1', speedMph,
        recordedAt: `2026-09-25T12:0${sequence}:00Z`
      });
      expect(component.currentState()?.speedMph).toBe(speedMph);
      expect(component.mapMode()).toBe('HISTORY');
      sequence += 1;
    });
    expect(telematics.getCurrentVehicleState).toHaveBeenCalledWith('vehicle-1');
  });
});
