import { computed, Injectable, OnDestroy, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { finalize, Observable, Subscription } from 'rxjs';
import { MaintenanceRecord } from '../../shared/models/maintenance.models';
import { VehicleDocument } from '../../shared/models/vehicle-document.models';
import { VehicleDocumentService } from './vehicle-document.service';

export interface MaintenanceDocumentRow {
  phase: 'idle' | 'loading' | 'empty' | 'success' | 'error';
  documents: VehicleDocument[];
  listed: boolean;
  uploading: boolean;
  message: string | null;
}

/** Browser-local list allowance, never a backend permission or shared capacity guarantee. */
@Injectable({ providedIn: 'root' })
export class MaintenanceDocumentListGate {
  private busy = false;
  private notBefore = 0;

  enter(): string | null {
    if (this.busy) return 'Another document list is loading. Try again when it finishes.';
    const remaining = Math.ceil((this.notBefore - performance.now()) / 1000);
    if (remaining > 0) return `Please wait at least ${remaining} seconds, then try again.`;
    this.busy = true;
    this.notBefore = performance.now() + 11_000;
    return null;
  }

  leave(): void {
    this.busy = false;
  }

  failure(error: unknown): void {
    if (!(error instanceof HttpErrorResponse) || (error.status !== 429 && error.status !== 0))
      return;
    let delay = 60_000;
    if (error.status === 429) {
      // HttpHeaders only exposes what this response actually made readable to the caller.
      const header = error.headers.get('Retry-After')?.trim();
      if (header && /^\d+$/.test(header)) {
        const seconds = Number(header);
        if (Number.isSafeInteger(seconds) && Number.isSafeInteger(seconds * 1000))
          delay = Math.max(delay, seconds * 1000);
      } else if (header && /^(Mon|Tue|Wed|Thu|Fri|Sat|Sun), /i.test(header)) {
        const date = Date.parse(header);
        if (Number.isFinite(date)) delay = Math.max(delay, date - Date.now());
      }
    }
    this.notBefore = Math.max(this.notBefore, performance.now() + delay);
  }
}

/** Component-owned state; destruction/vehicle changes cancel subscriptions, never queue work. */
@Injectable()
export class PilotMaintenanceDocuments implements OnDestroy {
  readonly rows = signal<Record<string, MaintenanceDocumentRow>>({});
  readonly documents = computed<Record<string, VehicleDocument[]>>(() => {
    const documents: Record<string, VehicleDocument[]> = {};
    for (const [id, row] of Object.entries(this.rows())) documents[id] = row.documents;
    return documents;
  });
  readonly uploadingId = signal<string | null>(null);
  private vehicleId: string | null = null;
  private epoch = 0;
  private destroyed = false;
  private active = new Map<string, Subscription>();

  constructor(
    private api: VehicleDocumentService,
    private gate: MaintenanceDocumentListGate,
  ) {}

  selectVehicle(vehicleId: string): void {
    if (this.destroyed) return;
    this.epoch++;
    this.cancelAll();
    this.vehicleId = vehicleId;
    this.rows.set({});
    this.uploadingId.set(null);
  }

  register(records: MaintenanceRecord[]): void {
    if (this.destroyed) return;
    const valid = records.filter((record) => record.vehicleId === this.vehicleId);
    const ids = new Set(valid.map((record) => record.id));
    for (const [id, subscription] of this.active) {
      if (!ids.has(id)) subscription.unsubscribe();
    }
    const previous = this.rows();
    const rows: Record<string, MaintenanceDocumentRow> = {};
    for (const record of valid)
      rows[record.id] = previous[record.id] ?? {
        phase: 'idle',
        documents: [],
        listed: false,
        uploading: false,
        message: null,
      };
    this.rows.set(rows);
  }

  load(id: string, refresh = false): void {
    const row = this.rows()[id];
    if (this.destroyed || !row || this.active.has(id) || (row.listed && !refresh)) return;
    const refusal = this.gate.enter();
    if (refusal) {
      this.patch(id, { message: refusal });
      return;
    }
    this.patch(id, { phase: 'loading', message: null });
    this.subscribe(
      id,
      this.api.getMaintenanceDocuments(id),
      (docs) => {
        this.patch(id, { phase: docs.length ? 'success' : 'empty', documents: docs, listed: true });
      },
      (error) => {
        this.gate.failure(error);
        this.patch(id, {
          phase: 'error',
          message: 'Unable to load documents. Wait before retrying.',
        });
      },
      () => this.gate.leave(),
    );
  }

  upload(id: string, file: File, success: () => void, failure: (error: unknown) => void): void {
    const row = this.rows()[id];
    if (this.destroyed || !row) return;
    if (this.active.has(id) || this.uploadingId()) {
      this.patch(id, {
        message: 'A document operation is in progress. Select the file again afterward.',
      });
      return;
    }
    this.uploadingId.set(id);
    this.patch(id, { uploading: true, message: null });
    this.subscribe(
      id,
      this.api.uploadMaintenanceDocument(id, file, 'MAINTENANCE_INVOICE'),
      (doc) => {
        const current = this.rows()[id];
        this.patch(id, {
          documents: [doc, ...current.documents.filter((item) => item.id !== doc.id)],
          phase: current.listed ? 'success' : 'idle',
        });
        success();
      },
      (error) => {
        this.gate.failure(error);
        this.patch(id, { message: 'Unable to upload maintenance document.' });
        failure(error);
      },
      () => {
        this.uploadingId.set(null);
        this.patch(id, { uploading: false });
      },
    );
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    this.epoch++;
    this.cancelAll();
  }

  private subscribe<T>(
    id: string,
    request: Observable<T>,
    next: (value: T) => void,
    error: (error: unknown) => void,
    done: () => void,
  ): void {
    const epoch = this.epoch;
    const subscription = new Subscription();
    this.active.set(id, subscription);
    subscription.add(
      request
        .pipe(
          finalize(() => {
            this.active.delete(id);
            done();
          }),
        )
        .subscribe({
          next: (value) => {
            if (!this.destroyed && epoch === this.epoch) next(value);
          },
          error: (failure) => {
            if (!this.destroyed && epoch === this.epoch) error(failure);
          },
        }),
    );
  }

  private cancelAll(): void {
    for (const subscription of this.active.values()) subscription.unsubscribe();
    this.active.clear();
  }

  private patch(id: string, change: Partial<MaintenanceDocumentRow>): void {
    this.rows.update((rows) => (rows[id] ? { ...rows, [id]: { ...rows[id], ...change } } : rows));
  }
}
