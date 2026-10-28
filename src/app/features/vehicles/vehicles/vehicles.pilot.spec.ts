import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { PILOT_PRESENTATION } from '../../../core/config/pilot-presentation';
import { FleetContextService } from '../../../core/services/fleet-context.service';
import { VehiclesComponent } from './vehicles.component';
import { environment } from '../../../../environments/environment';

const api = environment.apiBaseUrl;
const fleets = ['fleet-one', 'fleet-two'].map((id) => ({
  id,
  name: id,
  ownerUserId: 'owner-sentinel',
  createdAt: '2026-01-01',
}));

describe('pilot Vehicles', () => {
  let fixture: ComponentFixture<VehiclesComponent>;
  let controller: HttpTestingController;
  let pilotMode = true;
  beforeEach(() => {
    pilotMode = true;
    localStorage.clear();
    TestBed.configureTestingModule({
      imports: [VehiclesComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: PILOT_PRESENTATION, useFactory: () => pilotMode },
      ],
    });
    controller = TestBed.inject(HttpTestingController);
  });
  afterEach(() => {
    controller.verify();
    localStorage.clear();
  });

  function start() {
    fixture = TestBed.createComponent(VehiclesComponent);
    fixture.detectChanges();
    controller.expectOne({ method: 'GET', url: `${api}/fleets` }).flush(fleets);
    controller.expectOne({ method: 'GET', url: `${api}/fleets/fleet-one/vehicles` }).flush([]);
    fixture.detectChanges();
    return fixture.componentInstance;
  }

  it('preserves authorized fleet selection, inventory and refresh without alerts', () => {
    TestBed.inject(FleetContextService).setSelectedFleetId('unreturned-fleet');
    const component = start();
    expect(component.selectedFleetId()).toBe('fleet-one');
    component.onFleetChange('fleet-two');
    controller.expectOne({ method: 'GET', url: `${api}/fleets/fleet-two/vehicles` }).flush([]);
    expect(TestBed.inject(FleetContextService).selectedFleetId()).toBe('fleet-two');
    component.refresh();
    controller.expectOne({ method: 'GET', url: `${api}/fleets/fleet-two/vehicles` }).flush([]);
    expect(controller.match(() => true)).toEqual([]);
    expect(fixture.nativeElement.querySelector('mat-select')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.create-card')).toBeNull();
  });

  it('suppresses create and external VIN decode at source', () => {
    const component = start();
    component.form.patchValue({ vin: 'sentinel-vin', make: 'Sentinel', model: 'Test' });
    component.createVehicle();
    component.decodeVin();
    expect(controller.match(() => true)).toEqual([]);
    expect(component.saving()).toBe(false);
    expect(component.decodingVin()).toBe(false);
  });

  it('keeps fleet and vehicle load errors visible', () => {
    const component = start();
    component.loadVehicles('fleet-one');
    controller
      .expectOne(`${api}/fleets/fleet-one/vehicles`)
      .flush({}, { status: 403, statusText: 'Forbidden' });
    expect(component.errorMessage()).toBe('Unable to load vehicles.');
    expect(component.loading()).toBe(false);
    component.loadFleets();
    controller.expectOne(`${api}/fleets`).flush({}, { status: 403, statusText: 'Forbidden' });
    expect(component.errorMessage()).toBe('Unable to load fleets.');
  });

  it('preserves nonpilot create controls and refresh alerts', () => {
    pilotMode = false;
    const component = start();
    expect(fixture.nativeElement.querySelector('.create-card')).not.toBeNull();
    component.refresh();
    controller.expectOne(`${api}/fleets/fleet-one/vehicles`).flush([]);
    controller.expectOne({ method: 'GET', url: `${api}/fleets/fleet-one/alerts` }).flush([]);
  });
});
