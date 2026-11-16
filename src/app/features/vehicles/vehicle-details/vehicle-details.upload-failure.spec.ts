import { throwError } from 'rxjs';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import {
  HttpClient,
  HttpResponse,
  provideHttpClient,
  withInterceptors,
} from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { MAT_TABS_CONFIG } from '@angular/material/tabs';
import { Client } from '@stomp/stompjs';
import { VehicleDetailsComponent } from './vehicle-details.component';
import { MaintenanceComponent } from '../../maintenance/maintenance/maintenance.component';
import { PILOT_PRESENTATION } from '../../../core/config/pilot-presentation';
import { errorInterceptor } from '../../../core/interceptors/error.interceptor';
import { authInterceptor } from '../../../core/interceptors/auth.interceptor';
import { NotificationService } from '../../../core/services/notification.service';
import { VehicleDocumentService } from '../../../core/services/vehicle-document.service';
import { Vehicle } from '../../../shared/models/vehicle.models';
import { MaintenanceRecord } from '../../../shared/models/maintenance.models';
import { VehicleDocument } from '../../../shared/models/vehicle-document.models';
import { environment } from '../../../../environments/environment';

const api = environment.apiBaseUrl;
const vehicle: Vehicle = {
  id: 'synthetic-vehicle',
  fleetId: 'synthetic-fleet',
  vin: 'SYNTHETIC',
  make: 'Synthetic',
  model: 'Test',
  year: 2026,
  licensePlate: 'SYNTHETIC',
  currentMileage: 0,
  status: 'ACTIVE',
  createdAt: '2026-01-01',
  updatedAt: '2026-01-01',
};
const record: MaintenanceRecord = {
  id: 'synthetic-record',
  vehicleId: vehicle.id,
  serviceType: 'INSPECTION',
  serviceDate: '2026-01-01',
  mileage: 0,
  cost: 0,
  status: 'COMPLETED',
  createdAt: '2026-01-01',
  updatedAt: '2026-01-01',
};
const doc: VehicleDocument = {
  id: 'synthetic-document',
  vehicleId: vehicle.id,
  originalFileName: 'synthetic.pdf',
  fileSize: 4,
  createdAt: '2026-01-01',
};
const variants = [
  { path: 'vehicle', pilot: true },
  { path: 'vehicle', pilot: false },
  { path: 'maintenance-detail', pilot: true },
  { path: 'maintenance-detail', pilot: false },
  { path: 'maintenance-page', pilot: false },
] as const;

describe.each(variants)('upload failure $path pilot=$pilot', ({ path, pilot }) => {
  let fixture: ComponentFixture<VehicleDetailsComponent> | ComponentFixture<MaintenanceComponent>;
  let detail: VehicleDetailsComponent | null;
  let page: MaintenanceComponent | null;
  let http: HttpTestingController;
  const notices = { error: vi.fn(), success: vi.fn() };
  const isVehicle = path === 'vehicle';
  const endpoint = () =>
    isVehicle
      ? `${api}/vehicles/${vehicle.id}/documents`
      : `${api}/maintenance/${record.id}/documents`;
  beforeEach(() => {
    notices.error.mockClear();
    notices.success.mockClear();
    vi.spyOn(Client.prototype, 'activate').mockImplementation(() => {
      throw new Error('Unexpected live work');
    });
    vi.stubGlobal(
      'WebSocket',
      vi.fn(() => {
        throw new Error('Unexpected WebSocket');
      }),
    );
    TestBed.configureTestingModule({
      imports: [VehicleDetailsComponent, MaintenanceComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([authInterceptor, errorInterceptor])),
        provideHttpClientTesting(),
        { provide: PILOT_PRESENTATION, useValue: pilot },
        { provide: NotificationService, useValue: notices },
        { provide: MAT_TABS_CONFIG, useValue: { animationDuration: '0ms' } },
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({}) } } },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    detail = null;
    page = null;
    if (path === 'maintenance-page') {
      vi.spyOn(MaintenanceComponent.prototype, 'ngOnInit').mockImplementation(() => {});
      const f = TestBed.createComponent(MaintenanceComponent);
      fixture = f;
      page = f.componentInstance;
      page.selectedVehicleId.set(vehicle.id);
      page.records.set([record]);
    } else {
      vi.spyOn(VehicleDetailsComponent.prototype, 'ngOnInit').mockImplementation(() => {});
      const f = TestBed.createComponent(VehicleDetailsComponent);
      fixture = f;
      detail = f.componentInstance;
      detail.vehicle.set(vehicle);
      detail.maintenanceRecords.set([record]);
      detail.pilotMaintenanceDocuments.selectVehicle(vehicle.id);
      detail.pilotMaintenanceDocuments.register([record]);
    }
    localStorage.setItem('fleetwise_token', 'synthetic-session');
  });
  afterEach(() => {
    http.verify();
    localStorage.clear();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });
  function select() {
    const input = document.createElement('input');
    input.value = 'synthetic-selection';
    Object.defineProperty(input, 'files', {
      value: [new File(['test'], 'synthetic.pdf', { type: 'application/pdf' })],
    });
    const event = new Event('change');
    Object.defineProperty(event, 'target', { value: input });
    if (page) page.onMaintenanceDocumentSelected(event, record);
    else if (isVehicle) detail!.onDocumentSelected(event);
    else detail!.onMaintenanceDocumentSelected(event, record);
    return input;
  }
  function message(): string | null {
    return path === 'maintenance-detail' && pilot
      ? detail!.pilotMaintenanceDocuments.rows()[record.id].message
      : (page ?? detail)!.uploadError();
  }
  function busy(): boolean {
    return page
      ? page.uploadingMaintenanceDocument() !== null
      : isVehicle
        ? detail!.uploadingDocument()
        : detail!.uploadingMaintenanceDocument() !== null;
  }
  function documents(): VehicleDocument[] {
    return page
      ? (page.maintenanceDocuments()[record.id] ?? [])
      : isVehicle
        ? detail!.documents()
        : (detail!.maintenanceDocuments()[record.id] ?? []);
  }
  it.each([400, 401, 403, 413, 415, 429, 500, 503])(
    'handles readable %s once, cleans state, retains choices and never reports success',
    async (status) => {
      const input = select();
      expect(busy()).toBe(true);
      const req = http.expectOne({ method: 'POST', url: endpoint() });
      expect(req.request.headers.get('Authorization')).toBe('Bearer synthetic-session');
      expect(req.request.body.get('file').name).toBe('synthetic.pdf');
      expect(req.request.body.get('documentType')).toBe(
        isVehicle ? 'GENERAL' : 'MAINTENANCE_INVOICE',
      );
      req.flush({ message: 'Readable upload explanation' }, { status, statusText: 'Synthetic' });
      expect(busy()).toBe(false);
      expect(input.value).toBe('');
      expect(message()).toContain('Readable upload explanation');
      expect(documents()).toEqual([]);
      expect(notices.error).not.toHaveBeenCalled();
      expect(notices.success).not.toHaveBeenCalled();
      if (detail) expect(detail.selectedDocumentType()).toBe('GENERAL');
      fixture.detectChanges();
      await fixture.whenStable();
      const text = fixture.nativeElement.textContent as string;
      expect(text.split('Readable upload explanation').length - 1).toBe(1);
      http.expectNone(() => true);
    },
  );
  it('does not diagnose status 0, preserves successful documents, and supports intentional reselection only', () => {
    select();
    http.expectOne(endpoint()).flush(doc);
    expect(documents()).toEqual([doc]);
    notices.success.mockClear();
    const input = select();
    http.expectOne(endpoint()).error(new ProgressEvent('error'));
    expect(message()).toContain('could not be confirmed');
    expect(message()).toContain('Check the document list');
    expect(message()).not.toMatch(/offline|CORS|rate.limit|unreachable/);
    expect(documents()).toEqual([doc]);
    expect(busy()).toBe(false);
    expect(input.value).toBe('');
    expect(notices.success).not.toHaveBeenCalled();
    expect(notices.error).not.toHaveBeenCalled();
    http.expectNone(() => true);
    select();
    http.expectOne(endpoint()).flush({ ...doc, id: 'synthetic-next-document' });
    expect(documents()[0].id).toBe('synthetic-next-document');
    http.expectNone(() => true);
  });
  it.each([{}, { message: {} }, { message: 'Bearer synthetic-sensitive' }])(
    'safely handles malformed or unsafe body %j',
    (body) => {
      select();
      http.expectOne(endpoint()).flush(body, { status: 500, statusText: 'Synthetic' });
      expect(message()).toContain('Unexpected server error.');
      expect(message()).not.toContain('synthetic-sensitive');
      expect(message()).not.toContain('[object Object]');
      expect(busy()).toBe(false);
      expect(notices.error).not.toHaveBeenCalled();
    },
  );
  it.each([undefined, 'not-readable-time', '10'])(
    'uses only valid readable Retry-After %s without automatic retries',
    (header) => {
      let now = 100000;
      vi.spyOn(Date, 'now').mockImplementation(() => now);
      select();
      http.expectOne(endpoint()).flush(
        { message: 'Request limit exceeded' },
        {
          status: 429,
          statusText: 'Synthetic',
          headers: header === undefined ? {} : { 'Retry-After': header },
        },
      );
      expect(message()).toContain('Request limit exceeded');
      if (header === '10') {
        expect(message()).toContain('Wait at least 10 seconds');
        select();
        http.expectNone(() => true);
        now += 10000;
        http.expectNone(() => true);
      } else expect(message()).not.toContain('Wait at least');
      select();
      http.expectOne(endpoint()).flush(doc);
      expect(busy()).toBe(false);
    },
  );
  it('blocks overlapping selections, preserves success contract, cancels at destroy and clears the input', () => {
    const first = select();
    const pending = http.expectOne(endpoint());
    select();
    http.expectNone(() => true);
    fixture.destroy();
    expect(pending.cancelled).toBe(true);
    expect(busy()).toBe(false);
    expect(first.value).toBe('');
    expect(documents()).toEqual([]);
    expect(notices.success).not.toHaveBeenCalled();
    expect(notices.error).not.toHaveBeenCalled();
  });
  it('does not expose unexpected non-HTTP errors or leave busy state set', () => {
    const service = TestBed.inject(VehicleDocumentService);
    if (isVehicle)
      vi.spyOn(service, 'uploadDocument').mockReturnValue(
        throwError(() => new Error('private diagnostic')),
      );
    else
      vi.spyOn(service, 'uploadMaintenanceDocument').mockReturnValue(
        throwError(() => new Error('private diagnostic')),
      );
    const input = select();
    expect(message()).toContain('could not be confirmed');
    expect(message()).not.toContain('private diagnostic');
    expect(busy()).toBe(false);
    expect(input.value).toBe('');
    expect(documents()).toEqual([]);
    expect(notices.success).not.toHaveBeenCalled();
    http.expectNone(() => true);
  });
  if (pilot && isVehicle) {
    it('cancels an unconfirmed vehicle upload on rapid selection changes', () => {
      const input = select();
      const pending = http.expectOne(endpoint());
      detail!.loadVehicle('synthetic-other');
      expect(pending.cancelled).toBe(true);
      expect(input.value).toBe('');
      expect(busy()).toBe(false);
      const next = http.expectOne(`${api}/vehicles/synthetic-other`);
      detail!.loadVehicle('synthetic-third');
      expect(next.cancelled).toBe(true);
      const third = http.expectOne(`${api}/vehicles/synthetic-third`);
      fixture.destroy();
      expect(third.cancelled).toBe(true);
      expect(notices.success).not.toHaveBeenCalled();
      expect(notices.error).not.toHaveBeenCalled();
    });
  }
  if (path === 'maintenance-page') {
    it('cancels the upload when another vehicle is selected', () => {
      const input = select();
      const pending = http.expectOne(endpoint());
      page!.onVehicleChange('synthetic-other');
      expect(pending.cancelled).toBe(true);
      expect(input.value).toBe('');
      expect(busy()).toBe(false);
      http.expectOne(`${api}/vehicles/synthetic-other/maintenance`).flush([]);
      expect(notices.success).not.toHaveBeenCalled();
      expect(documents()).toEqual([]);
    });
  }
  it('keeps successful uploads and explicit downloads; bearer is scoped to the existing API', () => {
    select();
    http.expectOne(endpoint()).flush(doc);
    expect(documents()[0]).toEqual(doc);
    expect(busy()).toBe(false);
    const service = TestBed.inject(VehicleDocumentService);
    const received = vi.fn();
    service.downloadDocument(doc.id).subscribe(received);
    const download = http.expectOne({
      method: 'GET',
      url: `${api}/vehicle-documents/${doc.id}/download`,
    });
    expect(download.request.responseType).toBe('blob');
    expect(download.request.headers.get('Authorization')).toBe('Bearer synthetic-session');
    download.flush(new Blob(['synthetic']));
    expect(received.mock.calls[0][0]).toBeInstanceOf(HttpResponse);
    TestBed.inject(HttpClient).get('https://example.invalid/untrusted').subscribe();
    const untrusted = http.expectOne('https://example.invalid/untrusted');
    expect(untrusted.request.headers.has('Authorization')).toBe(false);
    untrusted.flush({});
    http.expectNone(() => true);
    expect(Client.prototype.activate).not.toHaveBeenCalled();
  });
});
