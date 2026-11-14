import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptors, HttpHeaders } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { finalize } from 'rxjs';
import {
  MaintenanceDocumentListGate,
  PilotMaintenanceDocuments,
} from './pilot-maintenance-documents.service';
import { VehicleDocumentService } from './vehicle-document.service';
import { MaintenanceRecord } from '../../shared/models/maintenance.models';
import { VehicleDocument } from '../../shared/models/vehicle-document.models';
import { environment } from '../../../environments/environment';

const api = environment.apiBaseUrl;
const vehicleId = 'vehicle-sentinel';
const record = (id: string, vehicle = vehicleId): MaintenanceRecord => ({
  id,
  vehicleId: vehicle,
  serviceType: 'INSPECTION',
  serviceDate: '2026-01-01',
  mileage: 0,
  cost: 0,
  status: 'COMPLETED',
  createdAt: '2026-01-01',
  updatedAt: '2026-01-01',
});
const doc: VehicleDocument = {
  id: 'doc-sentinel',
  vehicleId,
  originalFileName: 'synthetic.txt',
  fileSize: 4,
  createdAt: '2026-01-01',
};

describe('pilot maintenance document policy', () => {
  let store: PilotMaintenanceDocuments;
  let http: HttpTestingController;
  let now: number;
  let active: number;
  let peak: number;
  let starts: number[];

  beforeEach(() => {
    now = 0;
    active = 0;
    peak = 0;
    starts = [];
    vi.spyOn(performance, 'now').mockImplementation(() => now);
    TestBed.configureTestingModule({
      providers: [
        PilotMaintenanceDocuments,
        provideHttpClient(
          withInterceptors([
            (request, next) => {
              if (request.method !== 'GET' || !/\/maintenance\/[^/]+\/documents$/.test(request.url))
                return next(request);
              starts.push(now);
              active++;
              peak = Math.max(peak, active);
              return next(request).pipe(finalize(() => active--));
            },
          ]),
        ),
        provideHttpClientTesting(),
      ],
    });
    store = TestBed.inject(PilotMaintenanceDocuments);
    http = TestBed.inject(HttpTestingController);
    store.selectVehicle(vehicleId);
  });
  afterEach(() => {
    http.verify();
    vi.restoreAllMocks();
  });
  function get(id: string) {
    return http.expectOne({ method: 'GET', url: `${api}/maintenance/${id}/documents` });
  }

  it.each([0, 1, 1000])('never auto-fetches %s registered history rows', (count) => {
    store.register(Array.from({ length: count }, (_, i) => record(`record-${i}`)));
    expect(Object.keys(store.rows())).toHaveLength(count);
    expect(starts).toHaveLength(0);
    expect(http.match(() => true)).toEqual([]);
  });

  it('represents loading, empty, cached and explicit refreshed success', () => {
    store.register([record('a')]);
    expect(store.rows()['a'].phase).toBe('idle');
    store.load('a');
    expect(store.rows()['a'].phase).toBe('loading');
    get('a').flush([]);
    expect(store.rows()['a'].phase).toBe('empty');
    now = 11_000;
    store.load('a'); // Cached trigger is not a refresh.
    expect(starts).toHaveLength(1);
    store.load('a', true);
    get('a').flush([doc]);
    expect(store.rows()['a']).toMatchObject({ phase: 'success', listed: true, documents: [doc] });
  });

  it('deduplicates overlapping loads and measures peak concurrency of one with delayed responses', () => {
    store.register([record('a'), record('b')]);
    store.load('a');
    const first = get('a');
    now = 55_000;
    for (let i = 0; i < 200; i++) {
      store.load('a', true);
      store.load('b', true);
    }
    expect(starts).toHaveLength(1);
    expect(active).toBe(1);
    expect(store.rows()['b'].message).toContain('Another document list');
    first.flush([doc]);
    store.load('b');
    get('b').flush([]);
    expect(peak).toBe(1);
    expect(active).toBe(0);
  });

  it('paces repeated manual attempts and models preflight/headroom over rolling windows', () => {
    store.register([record('a')]);
    for (now = 0; now <= 180_000; now += 1000) {
      const before = starts.length;
      store.load('a', true);
      if (starts.length !== before) get('a').flush([]);
    }
    expect(starts.length).toBe(17);
    for (const time of starts) {
      const count = starts.filter((start) => start >= time && start <= time + 60_000).length;
      expect(count).toBeLessThanOrEqual(6);
      expect(count * 2).toBeLessThanOrEqual(12); // GET + modeled fresh OPTIONS.
      expect(count * 2 + 10).toBeLessThanOrEqual(60); // Five bootstrap calls with OPTIONS.
      expect(count + 5).toBeLessThanOrEqual(30);
    }
    expect(peak).toBe(1);
  });

  it('retains the list allowance through cancellation and component-store recreation', () => {
    store.register([record('a')]);
    store.load('a');
    const pending = get('a');
    store.ngOnDestroy();
    expect(pending.cancelled).toBe(true);
    const next = new PilotMaintenanceDocuments(
      TestBed.inject(VehicleDocumentService),
      TestBed.inject(MaintenanceDocumentListGate),
    );
    next.selectVehicle('other-vehicle');
    next.register([record('b', 'other-vehicle')]);
    now = 10_999;
    next.load('b');
    expect(starts).toHaveLength(1);
    now = 11_000;
    next.load('b');
    get('b').flush([]);
    next.ngOnDestroy();
    expect(starts).toEqual([0, 11_000]);
  });

  it('preserves successful rows/documents through partial and refresh failure', () => {
    store.register([record('a'), record('b')]);
    store.load('a');
    get('a').flush([doc]);
    now = 11_000;
    store.load('b');
    get('b').flush({}, { status: 403, statusText: 'Forbidden' });
    expect(store.rows()['b'].phase).toBe('error');
    expect(store.rows()['a'].documents).toEqual([doc]);
    now = 22_000;
    store.load('a', true);
    get('a').flush({}, { status: 500, statusText: 'Failure' });
    expect(store.rows()['a']).toMatchObject({ phase: 'error', listed: true, documents: [doc] });
    store.register([record('a'), record('b')]);
    expect(store.rows()['a'].documents).toEqual([doc]);
  });

  it.each([
    { status: 429, header: null, wait: 60_000 },
    { status: 0, header: '120', wait: 60_000 }, // Opaque responses cannot supply 429 evidence.
    { status: 429, header: 'invalid', wait: 60_000 },
    { status: 429, header: '-5', wait: 60_000 },
    { status: 429, header: '9999999999999999999999999', wait: 60_000 },
    { status: 429, header: '1', wait: 60_000 },
    { status: 429, header: '120', wait: 120_000 },
  ])(
    'bounds retries without timers for status $status/header $header',
    ({ status, header, wait }) => {
      store.register([record('a')]);
      store.load('a');
      const headers =
        header === null ? new HttpHeaders() : new HttpHeaders({ 'Retry-After': header });
      get('a').flush(null, { status, statusText: 'Synthetic failure', headers });
      expect(store.rows()['a'].phase).toBe('error');
      for (now = 0; now < wait; now += 1000) store.load('a', true);
      expect(starts).toHaveLength(1);
      now = wait;
      expect(starts).toHaveLength(1); // Time alone never retries.
      store.load('a', true);
      get('a').flush([]);
      expect(starts).toEqual([0, wait]);
    },
  );

  it('honors a readable HTTP-date Retry-After', () => {
    const wall = Date.UTC(2026, 0, 1);
    vi.spyOn(Date, 'now').mockReturnValue(wall);
    store.register([record('a')]);
    store.load('a');
    get('a').flush(null, {
      status: 429,
      statusText: 'Limit',
      headers: { 'Retry-After': new Date(wall + 180_000).toUTCString() },
    });
    now = 179_999;
    store.load('a', true);
    expect(starts).toHaveLength(1);
    now = 180_000;
    store.load('a', true);
    get('a').flush([]);
    expect(starts).toEqual([0, 180_000]);
  });

  it('uses monotonic pacing despite wall-clock jumps', () => {
    store.register([record('a')]);
    store.load('a');
    get('a').flush([]);
    vi.spyOn(Date, 'now').mockReturnValue(Date.UTC(2099, 0, 1));
    now = 1;
    store.load('a', true);
    expect(starts).toHaveLength(1);
    now = 11_000;
    store.load('a', true);
    get('a').flush([]);
  });

  it('cancels pending lists on vehicle change and has no queued work to drain', () => {
    store.register([record('a'), record('b')]);
    store.load('a');
    const old = get('a');
    store.load('b');
    store.selectVehicle('next');
    store.register([record('c', 'next')]);
    expect(old.cancelled).toBe(true);
    expect(store.rows()['a']).toBeUndefined();
    now = 1_000_000;
    expect(starts).toHaveLength(1);
    store.load('c');
    get('c').flush([]);
    expect(store.rows()['c'].phase).toBe('empty');
  });

  it('cancels a removed history row and releases its slot', () => {
    store.register([record('a')]);
    store.load('a');
    const old = get('a');
    store.register([]);
    expect(old.cancelled).toBe(true);
    now = 11_000;
    store.register([record('b')]);
    store.load('b');
    get('b').flush([]);
  });

  it('serializes upload/list refresh races without losing uploaded or previously listed documents', () => {
    store.register([record('a')]);
    store.load('a');
    const list = get('a');
    const success = vi.fn(),
      failure = vi.fn();
    const file = new File(['test'], 'synthetic.txt');
    store.upload('a', file, success, failure);
    http.expectNone((request) => request.method === 'POST');
    list.flush([doc]);
    store.upload('a', file, success, failure);
    const upload = http.expectOne({ method: 'POST', url: `${api}/maintenance/a/documents` });
    expect(upload.request.body.get('file')).toBe(file);
    expect(upload.request.body.get('documentType')).toBe('MAINTENANCE_INVOICE');
    now = 60_000;
    store.load('a', true); // No refresh can race the upload response.
    expect(starts).toHaveLength(1);
    upload.flush({ ...doc, id: 'new-document' });
    expect(store.rows()['a'].documents.map((item) => item.id)).toEqual(['new-document', doc.id]);
    expect(success).toHaveBeenCalledOnce();
    expect(failure).not.toHaveBeenCalled();
    expect(store.uploadingId()).toBeNull();
  });

  it('does not mistake a first upload for a complete list', () => {
    store.register([record('a')]);
    store.upload(
      'a',
      new File(['test'], 'synthetic.txt'),
      () => {},
      () => {},
    );
    http.expectOne(`${api}/maintenance/a/documents`).flush(doc);
    expect(store.rows()['a']).toMatchObject({ phase: 'idle', listed: false, documents: [doc] });
    store.load('a');
    get('a').flush([doc]);
    expect(store.rows()['a'].listed).toBe(true);
  });

  it('preserves documents and exposes per-row upload failure without automatic retries', () => {
    store.register([record('a')]);
    store.load('a');
    get('a').flush([doc]);
    const failure = vi.fn();
    store.upload('a', new File(['test'], 'synthetic.txt'), () => {}, failure);
    http
      .expectOne(`${api}/maintenance/a/documents`)
      .flush(null, { status: 429, statusText: 'Limit' });
    expect(store.rows()['a'].documents).toEqual([doc]);
    expect(store.rows()['a'].message).toBe('Unable to upload maintenance document.');
    expect(failure).toHaveBeenCalledOnce();
    expect(store.uploadingId()).toBeNull();
    now = 11_000;
    store.load('a', true);
    expect(starts).toHaveLength(1);
  });

  it('cancels uploads and suppresses their callbacks on vehicle change or destroy', () => {
    store.register([record('a')]);
    const success = vi.fn(),
      failure = vi.fn();
    store.upload('a', new File(['test'], 'synthetic.txt'), success, failure);
    const pending = http.expectOne(`${api}/maintenance/a/documents`);
    store.selectVehicle('next');
    expect(pending.cancelled).toBe(true);
    expect(store.rows()).toEqual({});
    store.register([record('b', 'next')]);
    store.upload('b', new File(['test'], 'synthetic.txt'), success, failure);
    const other = http.expectOne(`${api}/maintenance/b/documents`);
    store.ngOnDestroy();
    expect(other.cancelled).toBe(true);
    expect(success).not.toHaveBeenCalled();
    expect(failure).not.toHaveBeenCalled();
    store.load('b');
    http.expectNone(() => true);
  });

  it('ignores unregistered or wrong-vehicle row identifiers', () => {
    store.register([record('foreign', 'other-vehicle')]);
    store.load('foreign');
    store.upload(
      'foreign',
      new File(['x'], 'synthetic.txt'),
      () => {},
      () => {},
    );
    expect(http.match(() => true)).toEqual([]);
  });
});
