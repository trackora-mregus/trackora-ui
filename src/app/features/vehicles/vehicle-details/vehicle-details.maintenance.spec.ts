import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpResponse, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { MAT_TABS_CONFIG } from '@angular/material/tabs';
import { BehaviorSubject, finalize, tap } from 'rxjs';
import { Client } from '@stomp/stompjs';
import { VehicleDetailsComponent } from './vehicle-details.component';
import { NotificationService } from '../../../core/services/notification.service';
import { PILOT_PRESENTATION } from '../../../core/config/pilot-presentation';
import { MaintenanceRecord } from '../../../shared/models/maintenance.models';
import { VehicleDocument } from '../../../shared/models/vehicle-document.models';
import { Vehicle } from '../../../shared/models/vehicle.models';
import { environment } from '../../../../environments/environment';

const api = environment.apiBaseUrl;
function vehicle(id: string): Vehicle {
  return {
    id,
    fleetId: 'fleet-sentinel',
    vin: 'synthetic',
    make: 'Synthetic',
    model: 'Test',
    year: 2026,
    licensePlate: 'SYNTHETIC',
    currentMileage: 0,
    status: 'ACTIVE',
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
  };
}
function record(id: string, vehicleId = 'one'): MaintenanceRecord {
  return {
    id,
    vehicleId,
    serviceType: 'INSPECTION',
    serviceDate: '2026-01-01',
    mileage: 0,
    cost: 0,
    status: 'COMPLETED',
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
  };
}
const doc: VehicleDocument = {
  id: 'doc-sentinel',
  vehicleId: 'one',
  originalFileName: 'synthetic.txt',
  fileSize: 4,
  createdAt: '2026-01-01',
};

describe('vehicle detail maintenance discovery', () => {
  let fixture: ComponentFixture<VehicleDetailsComponent>;
  let component: VehicleDetailsComponent;
  let http: HttpTestingController;
  let params: BehaviorSubject<ReturnType<typeof convertToParamMap>>;
  let now: number;
  let pilot: boolean;
  let active: number;
  let peak: number;
  const feedback = { error: vi.fn(), success: vi.fn() };

  beforeEach(() => {
    now = 0;
    pilot = true;
    active = 0;
    peak = 0;
    feedback.error.mockClear();
    feedback.success.mockClear();
    params = new BehaviorSubject(convertToParamMap({ vehicleId: 'one' }));
    vi.spyOn(performance, 'now').mockImplementation(() => now);
    vi.spyOn(Client.prototype, 'activate').mockImplementation(() => {
      throw new Error('Unexpected live work');
    });
    vi.stubGlobal(
      'WebSocket',
      vi.fn(function () {
        throw new Error('Unexpected WebSocket');
      }),
    );
    TestBed.configureTestingModule({
      imports: [VehicleDetailsComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(
          withInterceptors([
            (request, next) => {
              active++;
              peak = Math.max(peak, active);
              let counted = true;
              return next(request).pipe(
                tap((event) => {
                  if (event instanceof HttpResponse && counted) {
                    active--;
                    counted = false;
                  }
                }),
                finalize(() => {
                  if (counted) active--;
                }),
              );
            },
          ]),
        ),
        provideHttpClientTesting(),
        { provide: PILOT_PRESENTATION, useFactory: () => pilot },
        { provide: MAT_TABS_CONFIG, useValue: { animationDuration: '0ms' } },
        { provide: NotificationService, useValue: feedback },
        {
          provide: ActivatedRoute,
          useValue: { paramMap: params, snapshot: { paramMap: params.value } },
        },
      ],
    });
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => {
    http.verify();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  function create() {
    fixture = TestBed.createComponent(VehicleDetailsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }
  function finish(id = 'one', records: MaintenanceRecord[] = [record('a', id)]) {
    http.expectOne({ method: 'GET', url: `${api}/vehicles/${id}` }).flush(vehicle(id));
    http.expectOne({ method: 'GET', url: `${api}/vehicles/${id}/maintenance` }).flush(records);
    http.expectOne({ method: 'GET', url: `${api}/fleets` }).flush([]);
    http.expectOne({ method: 'GET', url: `${api}/vehicles/${id}/documents` }).flush([doc]);
    http.expectOne({ method: 'GET', url: `${api}/vehicles/${id}/telematics/devices` }).flush([]);
  }
  function list(id: string) {
    return http.expectOne({ method: 'GET', url: `${api}/maintenance/${id}/documents` });
  }
  function inputEvent(): Event {
    const input = document.createElement('input');
    Object.defineProperty(input, 'files', { value: [new File(['test'], 'synthetic.txt')] });
    return { target: input } as unknown as Event;
  }

  it.each([{ records: [] }, { records: [record('a')] }])(
    'has no eager list HTTP for an empty or single history',
    async ({ records }) => {
      create();
      finish('one', records);
      fixture.detectChanges();
      await fixture.whenStable();
      expect(http.match(() => true)).toEqual([]);
      expect(component.maintenanceRecords()).toEqual(records);
      if (records.length)
        expect(fixture.nativeElement.textContent).toContain('Documents not loaded.');
      else expect(fixture.nativeElement.textContent).toContain('No maintenance records');
      expect(Client.prototype.activate).not.toHaveBeenCalled();
      expect(WebSocket).not.toHaveBeenCalled();
    },
  );

  it('loads by deliberate row control and preserves successful UI rows during partial failure', async () => {
    create();
    finish('one', [record('a'), record('b')]);
    fixture.detectChanges();
    await fixture.whenStable();
    const button: HTMLButtonElement = fixture.nativeElement.querySelector(
      '[aria-label="Load documents for maintenance a"]',
    );
    expect(button).not.toBeNull();
    button.click();
    fixture.detectChanges();
    expect(component.pilotMaintenanceDocuments.rows()['a'].phase).toBe('loading');
    list('a').flush([doc]);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Documents loaded.');
    expect(fixture.nativeElement.textContent).toContain(doc.originalFileName);
    now = 11_000;
    component.pilotMaintenanceDocuments.load('b');
    list('b').flush({}, { status: 403, statusText: 'Forbidden' });
    fixture.detectChanges();
    expect(component.maintenanceDocuments()['a']).toEqual([doc]);
    expect(fixture.nativeElement.textContent).toContain('Document list unavailable.');
    expect(fixture.nativeElement.textContent).toContain(doc.originalFileName);
    expect(http.match(() => true)).toEqual([]);
  });

  it('measures page request peak at four when a list is opened before other bootstrap reads finish', () => {
    create();
    http.expectOne(`${api}/vehicles/one`).flush(vehicle('one'));
    expect(active).toBe(4);
    http.expectOne(`${api}/vehicles/one/maintenance`).flush([record('a')]);
    expect(active).toBe(3);
    component.pilotMaintenanceDocuments.load('a');
    expect(active).toBe(4);
    component.pilotMaintenanceDocuments.load('a', true);
    expect(active).toBe(4);
    list('a').flush([]);
    http.expectOne(`${api}/fleets`).flush([]);
    http.expectOne(`${api}/vehicles/one/documents`).flush([]);
    http.expectOne(`${api}/vehicles/one/telematics/devices`).flush([]);
    expect(peak).toBe(4);
    expect(active).toBe(0);
    // This measures mocked HTTP only, not browser OPTIONS concurrency.
  });

  it('cancels rapid vehicle-ID requests and never installs an older response', () => {
    create();
    const one = http.expectOne(`${api}/vehicles/one`);
    params.next(convertToParamMap({ vehicleId: 'two' }));
    const two = http.expectOne(`${api}/vehicles/two`);
    params.next(convertToParamMap({ vehicleId: 'three' }));
    expect(one.cancelled).toBe(true);
    expect(two.cancelled).toBe(true);
    finish('three', [record('c', 'three')]);
    expect(component.vehicle()?.id).toBe('three');
    expect(Object.keys(component.pilotMaintenanceDocuments.rows())).toEqual(['c']);
    params.next(convertToParamMap({ vehicleId: 'three' }));
    http.expectNone(() => true);
  });

  it('cancels outstanding old detail reads and maintenance lists on selection change', () => {
    create();
    http.expectOne(`${api}/vehicles/one`).flush(vehicle('one'));
    http.expectOne(`${api}/vehicles/one/maintenance`).flush([record('a')]);
    const fleets = http.expectOne(`${api}/fleets`),
      docs = http.expectOne(`${api}/vehicles/one/documents`),
      devices = http.expectOne(`${api}/vehicles/one/telematics/devices`);
    component.pilotMaintenanceDocuments.load('a');
    const pending = list('a');
    params.next(convertToParamMap({ vehicleId: 'two' }));
    expect([fleets, docs, devices, pending].every((request) => request.cancelled)).toBe(true);
    expect(component.vehicle()).toBeNull();
    expect(component.documents()).toEqual([]);
    expect(component.pilotMaintenanceDocuments.rows()).toEqual({});
    finish('two', [record('b', 'two')]);
    expect(component.vehicle()?.id).toBe('two');
    expect(component.maintenanceDocuments()['a']).toBeUndefined();
  });

  it('cancels an upload across vehicle changes and suppresses stale feedback', () => {
    create();
    finish();
    component.onMaintenanceDocumentSelected(inputEvent(), record('a'));
    const upload = http.expectOne({ method: 'POST', url: `${api}/maintenance/a/documents` });
    expect(upload.request.body.get('documentType')).toBe('MAINTENANCE_INVOICE');
    component.pilotMaintenanceDocuments.load('a', true);
    http.expectNone((request) => request.method === 'GET');
    params.next(convertToParamMap({ vehicleId: 'two' }));
    expect(upload.cancelled).toBe(true);
    finish('two', []);
    expect(feedback.success).not.toHaveBeenCalled();
    expect(feedback.error).not.toHaveBeenCalled();
    expect(component.maintenanceDocuments()).toEqual({});
    expect(component.uploadingMaintenanceDocument()).toBeNull();
  });

  it('keeps upload/list/download contracts and does not automatically refresh after uploading', () => {
    create();
    finish();
    component.onMaintenanceDocumentSelected(inputEvent(), record('a'));
    http.expectOne({ method: 'POST', url: `${api}/maintenance/a/documents` }).flush(doc);
    expect(component.maintenanceDocuments()['a']).toEqual([doc]);
    expect(component.pilotMaintenanceDocuments.rows()['a'].listed).toBe(false);
    expect(feedback.success).toHaveBeenCalledWith('Maintenance document uploaded.');
    http.expectNone((request) => request.method === 'GET');
    const createUrl = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:synthetic');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    component.downloadDocument(doc);
    const download = http.expectOne({
      method: 'GET',
      url: `${api}/vehicle-documents/${doc.id}/download`,
    });
    expect(download.request.responseType).toBe('blob');
    download.flush(new Blob(['test']));
    expect(createUrl).toHaveBeenCalledOnce();
  });

  it('cancels lists, upload and downloads at destroy; no queued or route-triggered work survives', () => {
    create();
    finish('one', [record('a'), record('b')]);
    component.pilotMaintenanceDocuments.load('a');
    const pending = list('a');
    component.onMaintenanceDocumentSelected(inputEvent(), record('b'));
    const upload = http.expectOne(`${api}/maintenance/b/documents`);
    component.downloadDocument(doc);
    const download = http.expectOne(`${api}/vehicle-documents/${doc.id}/download`);
    fixture.destroy();
    expect([pending, upload, download].every((request) => request.cancelled)).toBe(true);
    params.next(convertToParamMap({ vehicleId: 'next' }));
    now = 1_000_000;
    expect(http.match(() => true)).toEqual([]);
    expect(feedback.success).not.toHaveBeenCalled();
  });

  it('preserves nonpilot eager fan-out and does not install the pilot route-change behavior', () => {
    pilot = false;
    create();
    finish('one', [record('a'), record('b')]);
    list('a').flush([doc]);
    list('b').flush([]);
    http.expectOne(`${api}/vehicles/one/fuel-logs`).flush([]);
    http.expectOne(`${api}/fleets/fleet-sentinel/alerts`).flush([]);
    http.expectOne(`${api}/vehicles/one/ai/insights/latest`).flush(null);
    http.expectOne(`${api}/vehicles/one/telematics/current`).flush(null);
    expect(component.maintenanceDocuments()).toEqual({ a: [doc], b: [] });
    params.next(convertToParamMap({ vehicleId: 'two' }));
    http.expectNone(() => true);
    component.onMaintenanceDocumentSelected(inputEvent(), record('a'));
    http.expectOne(`${api}/maintenance/a/documents`).flush({ ...doc, id: 'new-doc' });
    expect(component.maintenanceDocuments()['a'][0].id).toBe('new-doc');
  });
});
