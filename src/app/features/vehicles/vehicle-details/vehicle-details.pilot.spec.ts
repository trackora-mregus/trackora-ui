import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { MAT_TABS_CONFIG } from '@angular/material/tabs';
import { By } from '@angular/platform-browser';
import { Client } from '@stomp/stompjs';
import { PILOT_PRESENTATION } from '../../../core/config/pilot-presentation';
import { NotificationService } from '../../../core/services/notification.service';
import { Vehicle } from '../../../shared/models/vehicle.models';
import { MaintenanceRecord } from '../../../shared/models/maintenance.models';
import { VehicleDocument } from '../../../shared/models/vehicle-document.models';
import { VehicleDetailsComponent } from './vehicle-details.component';
import { VehicleMapComponent } from './vehicle-map/vehicle-map.component';
import { environment } from '../../../../environments/environment';

const api = environment.apiBaseUrl;
const vehicle: Vehicle = {
  id: 'vehicle-sentinel',
  fleetId: 'fleet-sentinel',
  vin: 'synthetic-vin',
  make: 'Sentinel',
  model: 'Test',
  year: 2026,
  licensePlate: 'SYNTHETIC',
  currentMileage: 0,
  status: 'ACTIVE',
  createdAt: '2026-01-01',
  updatedAt: '2026-01-01',
};
const record: MaintenanceRecord = {
  id: 'maintenance-sentinel',
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
  id: 'document-sentinel',
  vehicleId: vehicle.id,
  originalFileName: 'synthetic.txt',
  fileSize: 4,
  documentType: 'GENERAL',
  createdAt: '2026-01-01',
};

// Real templates, lifecycle and HTTP services. Every request terminates at the mock controller.
describe('pilot vehicle detail', () => {
  let fixture: ComponentFixture<VehicleDetailsComponent>;
  let component: VehicleDetailsComponent;
  let controller: HttpTestingController;
  let pilotMode = true;
  const notifications = { success: vi.fn(), error: vi.fn() };
  let activate: ReturnType<typeof vi.spyOn>;
  let webSocket: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    pilotMode = true;
    notifications.success.mockClear();
    notifications.error.mockClear();
    activate = vi.spyOn(Client.prototype, 'activate').mockImplementation(() => {});
    webSocket = vi.fn(function () {
      throw new Error('Unexpected WebSocket');
    });
    vi.stubGlobal('WebSocket', webSocket);
    TestBed.configureTestingModule({
      imports: [VehicleDetailsComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: MAT_TABS_CONFIG, useValue: { animationDuration: '0ms' } },
        { provide: PILOT_PRESENTATION, useFactory: () => pilotMode },
        { provide: NotificationService, useValue: notifications },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: convertToParamMap({ vehicleId: vehicle.id }) } },
        },
      ],
    });
    controller = TestBed.inject(HttpTestingController);
  });
  afterEach(() => {
    controller.verify();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  function start(pilot = true) {
    pilotMode = pilot;
    fixture = TestBed.createComponent(VehicleDetailsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    controller.expectOne({ method: 'GET', url: `${api}/vehicles/${vehicle.id}` }).flush(vehicle);
    controller
      .expectOne({ method: 'GET', url: `${api}/vehicles/${vehicle.id}/maintenance` })
      .flush([record]);
    controller
      .expectOne({ method: 'GET', url: `${api}/maintenance/${record.id}/documents` })
      .flush([doc]);
    controller.expectOne({ method: 'GET', url: `${api}/fleets` }).flush([]);
    controller
      .expectOne({ method: 'GET', url: `${api}/vehicles/${vehicle.id}/documents` })
      .flush([doc]);
    controller
      .expectOne({ method: 'GET', url: `${api}/vehicles/${vehicle.id}/telematics/devices` })
      .flush([]);
    return component;
  }

  function fileEvent(file: File): Event {
    const input = document.createElement('input');
    Object.defineProperty(input, 'files', { value: [file] });
    return { target: input } as unknown as Event;
  }

  it('loads only included reads and never creates live children, even when every tab is selected', async () => {
    const mapLifecycle = vi.spyOn(VehicleMapComponent.prototype, 'ngAfterViewInit');
    start();
    fixture.detectChanges();
    const tabs = Array.from(
      fixture.nativeElement.querySelectorAll('[role="tab"]') as NodeListOf<HTMLElement>,
    );
    expect(tabs.map((tab) => tab.textContent?.trim())).toEqual([
      'Maintenance',
      'Documents',
      'Assigned Device',
    ]);
    for (const tab of tabs) {
      tab.click();
      fixture.detectChanges();
      await fixture.whenStable();
    }
    expect(fixture.debugElement.query(By.directive(VehicleMapComponent))).toBeNull();
    expect(mapLifecycle).not.toHaveBeenCalled();
    expect(activate).not.toHaveBeenCalled();
    expect(webSocket).not.toHaveBeenCalled();
    expect(fixture.nativeElement.querySelector('.status-buttons')).toBeNull();
    expect(fixture.nativeElement.textContent).not.toContain('Edit Vehicle');
    expect(fixture.nativeElement.textContent).not.toContain('Delete');
    expect(controller.match(() => true)).toEqual([]);
  });

  it('preserves assigned-device data and handles empty/denied device reads', () => {
    start();
    component.loadTelematicsDevice(vehicle.id);
    controller.expectOne(`${api}/vehicles/${vehicle.id}/telematics/devices`).flush([
      {
        id: 'device-sentinel',
        vehicleId: vehicle.id,
        provider: 'Synthetic',
        externalDeviceId: 'synthetic-external',
        serialNumber: 'synthetic-serial',
        imei: null,
        vin: null,
        active: true,
        lastSeenAt: null,
        createdAt: '2026-01-01',
        updatedAt: '2026-01-01',
      },
    ]);
    expect(component.device()?.id).toBe('device-sentinel');
    component.loadTelematicsDevice(vehicle.id);
    controller
      .expectOne(`${api}/vehicles/${vehicle.id}/telematics/devices`)
      .flush({}, { status: 403, statusText: 'Forbidden' });
    expect(component.device()).toBeNull();
    expect(controller.match(() => true)).toEqual([]);
  });

  it('guards excluded handlers at source, preserving document state', () => {
    start();
    component.loadFuelLogs(vehicle.id);
    component.loadAlerts(vehicle);
    component.loadLatestVehicleInsight(vehicle.id);
    component.loadLatestTelematics(vehicle.id);
    component.loadOlderInsights();
    component.generateAiInsight();
    component.updateVehicleStatus('SOLD');
    component.startEditVehicle();
    component.saveVehicleChanges();
    component.deleteDocument(doc);
    component.resolveAlert({
      id: 'alert-sentinel',
      fleetId: vehicle.fleetId,
      vehicleId: vehicle.id,
      type: 'SYNTHETIC',
      severity: 'INFO',
      message: 'Synthetic',
      resolved: false,
      createdAt: '2026-01-01',
    });
    expect(controller.match(() => true)).toEqual([]);
    expect(component.editingVehicle()).toBe(false);
    expect(component.documents()).toEqual([doc]);
    expect(activate).not.toHaveBeenCalled();
  });

  it('keeps multipart vehicle and maintenance uploads and blob download contracts', () => {
    start();
    const file = new File(['test'], 'synthetic.txt', { type: 'text/plain' });
    component.onDocumentSelected(fileEvent(file));
    const upload = controller.expectOne({
      method: 'POST',
      url: `${api}/vehicles/${vehicle.id}/documents`,
    });
    expect(upload.request.body).toBeInstanceOf(FormData);
    expect(upload.request.body.get('file')).toBe(file);
    expect(upload.request.body.get('documentType')).toBe('GENERAL');
    upload.flush({ ...doc, id: 'new-document' });
    expect(component.documents()[0].id).toBe('new-document');
    expect(component.uploadingDocument()).toBe(false);

    component.onMaintenanceDocumentSelected(fileEvent(file), record);
    const invoice = controller.expectOne({
      method: 'POST',
      url: `${api}/maintenance/${record.id}/documents`,
    });
    expect(invoice.request.body.get('file')).toBe(file);
    expect(invoice.request.body.get('documentType')).toBe('MAINTENANCE_INVOICE');
    invoice.flush({ ...doc, id: 'invoice-sentinel' });
    expect(component.maintenanceDocuments()[record.id][0].id).toBe('invoice-sentinel');
    expect(component.uploadingMaintenanceDocument()).toBeNull();

    const createUrl = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:synthetic');
    const revokeUrl = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    component.downloadDocument(doc);
    const download = controller.expectOne({
      method: 'GET',
      url: `${api}/vehicle-documents/${doc.id}/download`,
    });
    expect(download.request.responseType).toBe('blob');
    const blob = new Blob(['test']);
    download.flush(blob);
    expect(createUrl).toHaveBeenCalledWith(blob);
    expect(click).toHaveBeenCalledOnce();
    expect(revokeUrl).toHaveBeenCalledWith('blob:synthetic');
    expect(controller.match(() => true)).toEqual([]);
  });

  it('retains validation and included document denial/error feedback without retries', () => {
    start();
    component.selectedDocumentType.set('PHOTO');
    component.onDocumentSelected(
      fileEvent(new File(['test'], 'synthetic.txt', { type: 'text/plain' })),
    );
    expect(component.errorMessage()).toBe('PHOTO documents must be image files.');
    expect(controller.match(() => true)).toEqual([]);
    component.selectedDocumentType.set('GENERAL');
    component.onDocumentSelected(fileEvent(new File(['test'], 'synthetic.txt')));
    controller
      .expectOne(`${api}/vehicles/${vehicle.id}/documents`)
      .flush({}, { status: 403, statusText: 'Forbidden' });
    expect(component.uploadingDocument()).toBe(false);
    expect(notifications.error).toHaveBeenCalledWith('Unable to upload document.');
    component.onMaintenanceDocumentSelected(fileEvent(new File(['test'], 'synthetic.txt')), record);
    controller
      .expectOne(`${api}/maintenance/${record.id}/documents`)
      .flush({}, { status: 413, statusText: 'Too large' });
    expect(component.uploadingMaintenanceDocument()).toBeNull();
    expect(notifications.error).toHaveBeenCalledWith('Unable to upload maintenance document.');
    component.loadDocuments(vehicle.id);
    controller
      .expectOne(`${api}/vehicles/${vehicle.id}/documents`)
      .flush({}, { status: 403, statusText: 'Forbidden' });
    expect(component.errorMessage()).toBe('Unable to load documents.');
    component.downloadDocument(doc);
    controller
      .expectOne(`${api}/vehicle-documents/${doc.id}/download`)
      .flush(null, { status: 403, statusText: 'Forbidden' });
    expect(notifications.error).toHaveBeenCalledWith('Unable to download document.');
  });

  it('preserves nonpilot automatic requests, controls and lazy map lifecycle', async () => {
    // Keep the real map component/lifecycle boundary while preventing tiles/live work in this local test.
    const mapLifecycle = vi
      .spyOn(VehicleMapComponent.prototype, 'ngAfterViewInit')
      .mockImplementation(() => {});
    start(false);
    controller
      .expectOne({ method: 'GET', url: `${api}/vehicles/${vehicle.id}/fuel-logs` })
      .flush([]);
    controller
      .expectOne({ method: 'GET', url: `${api}/fleets/${vehicle.fleetId}/alerts` })
      .flush([]);
    controller
      .expectOne({ method: 'GET', url: `${api}/vehicles/${vehicle.id}/ai/insights/latest` })
      .flush(null);
    controller
      .expectOne({ method: 'GET', url: `${api}/vehicles/${vehicle.id}/telematics/current` })
      .flush(null);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.status-buttons')).not.toBeNull();
    expect(fixture.nativeElement.textContent).toContain('Edit Vehicle');
    const tabs = Array.from(
      fixture.nativeElement.querySelectorAll('[role="tab"]') as NodeListOf<HTMLElement>,
    );
    expect(tabs.map((tab) => tab.textContent?.trim())).toEqual([
      'Maintenance',
      'Fuel',
      'Alerts',
      'Documents',
      'Telematics',
      'Map',
    ]);
    tabs.at(-1)!.click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.debugElement.query(By.directive(VehicleMapComponent))).not.toBeNull();
    expect(mapLifecycle).toHaveBeenCalledOnce();
  });
});
