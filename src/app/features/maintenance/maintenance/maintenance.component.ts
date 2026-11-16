import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize, Subject, takeUntil } from 'rxjs';
import { classifyHttpFailure, failureText } from '../../../core/http/http-failure';
import { Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { CommonModule, CurrencyPipe, DatePipe } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator';
import { MatSnackBarModule } from '@angular/material/snack-bar';

import { MatCardModule } from '@angular/material/card';
import { MatTableModule } from '@angular/material/table';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatButtonModule } from '@angular/material/button';
import { MatInputModule } from '@angular/material/input';

import { FleetService } from '../../../core/services/fleet.service';
import { VehicleService } from '../../../core/services/vehicle.service';
import { FleetContextService } from '../../../core/services/fleet-context.service';
import { MaintenanceService } from '../../../core/services/maintenance.service';

import { Fleet } from '../../../shared/models/fleet.models';
import { Vehicle } from '../../../shared/models/vehicle.models';
import {
  MaintenanceRecord,
  MaintenanceStatus,
  ServiceType,
} from '../../../shared/models/maintenance.models';
import { AlertContextService } from '../../../core/services/alert-context.service';
import { VehicleDocument } from '../../../shared/models/vehicle-document.models';
import { VehicleDocumentService } from '../../../core/services/vehicle-document.service';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { ConfirmDialogComponent } from '../../../shared/components/confirm-dialog/confirm-dialog.component';
import { NotificationService } from '../../../core/services/notification.service';

@Component({
  selector: 'app-maintenance',
  standalone: true,
  imports: [
    CommonModule,
    CurrencyPipe,
    DatePipe,
    ReactiveFormsModule,
    MatCardModule,
    MatTableModule,
    MatProgressSpinnerModule,
    MatSelectModule,
    MatFormFieldModule,
    MatButtonModule,
    MatInputModule,
    MatPaginator,
    MatSnackBarModule,
  ],
  templateUrl: './maintenance.component.html',
  styleUrl: './maintenance.component.css',
})
export class MaintenanceComponent implements OnInit {
  readonly maxUploadSizeBytes = 10 * 1024 * 1024;
  loading = signal(false);
  saving = signal(false);
  errorMessage = signal<string | null>(null);
  uploadError = signal<string | null>(null);
  private readonly destroyRef = inject(DestroyRef);
  private readonly uploadScope = new Subject<void>();
  private uploadRetryAt = new Map<string, number>();

  fleets = signal<Fleet[]>([]);
  vehicles = signal<Vehicle[]>([]);
  records = signal<MaintenanceRecord[]>([]);

  selectedFleetId = signal<string | null>(null);
  selectedVehicleId = signal<string | null>(null);

  maintenanceDocuments = signal<Record<string, VehicleDocument[]>>({});
  uploadingMaintenanceDocument = signal<string | null>(null);

  pageSize = signal(10);
  pageIndex = signal(0);

  serviceTypes: ServiceType[] = [
    'OIL_CHANGE',
    'BRAKES',
    'TIRES',
    'BATTERY',
    'TRANSMISSION',
    'INSPECTION',
    'REPAIR',
    'OTHER',
  ];

  statuses: MaintenanceStatus[] = ['SCHEDULED', 'COMPLETED', 'CANCELLED'];

  displayedColumns = [
    'serviceType',
    'serviceDate',
    'mileage',
    'cost',
    'vendor',
    'status',
    'documents',
    'actions',
  ];

  form;

  constructor(
    private notificationService: NotificationService,
    private fb: FormBuilder,
    private fleetService: FleetService,
    private vehicleService: VehicleService,
    private fleetContextService: FleetContextService,
    private maintenanceService: MaintenanceService,
    private alertContextService: AlertContextService,
    private vehicleDocumentService: VehicleDocumentService,
    private dialog: MatDialog,
  ) {
    this.form = this.fb.nonNullable.group({
      serviceType: ['OIL_CHANGE' as ServiceType, [Validators.required]],
      description: [''],
      serviceDate: [new Date().toISOString().substring(0, 10), [Validators.required]],
      mileage: [0, [Validators.required, Validators.min(0)]],
      cost: [0, [Validators.required, Validators.min(0)]],
      vendor: [''],
      nextServiceDate: [''],
      status: ['COMPLETED' as MaintenanceStatus, [Validators.required]],
    });
  }

  ngOnInit(): void {
    this.loadFleets();
  }

  onPageChange(event: any): void {
    this.pageIndex.set(event.pageIndex);
    this.pageSize.set(event.pageSize);
  }

  paginatedRecords() {
    const start = this.pageIndex() * this.pageSize();
    const end = start + this.pageSize();
    return this.records().slice(start, end);
  }

  loadFleets(): void {
    this.loading.set(true);
    this.errorMessage.set(null);

    this.fleetService.getMyFleets().subscribe({
      next: (fleets) => {
        this.fleets.set(fleets);

        if (fleets.length === 0) {
          this.loading.set(false);
          this.errorMessage.set('No fleets found.');
          return;
        }

        const savedFleetId = this.fleetContextService.selectedFleetId();
        const selectedFleet = fleets.find((fleet) => fleet.id === savedFleetId) ?? fleets[0];

        this.selectedFleetId.set(selectedFleet.id);
        this.fleetContextService.setSelectedFleetId(selectedFleet.id);

        this.loadVehicles(selectedFleet.id);
      },
      error: (err) => {
        this.loading.set(false);
        // this.errorMessage.set('Unable to load fleets.');
        this.notificationService.error(err?.error?.message ?? 'Unable to load fleets.');
      },
    });
  }

  onFleetChange(fleetId: string): void {
    this.uploadScope.next();
    this.uploadError.set(null);
    this.selectedFleetId.set(fleetId);
    this.fleetContextService.setSelectedFleetId(fleetId);
    this.selectedVehicleId.set(null);
    this.records.set([]);
    this.loadVehicles(fleetId);
  }

  loadVehicles(fleetId: string): void {
    this.loading.set(true);
    this.errorMessage.set(null);

    this.vehicleService.getFleetVehicles(fleetId).subscribe({
      next: (vehicles) => {
        this.vehicles.set(vehicles);

        if (vehicles.length === 0) {
          this.loading.set(false);
          this.errorMessage.set('No vehicles found for this fleet.');
          return;
        }

        const firstVehicle = vehicles[0];
        this.selectedVehicleId.set(firstVehicle.id);
        this.patchMileage(firstVehicle);
        this.loadMaintenance(firstVehicle.id);
      },
      error: (err) => {
        this.loading.set(false);
        // this.errorMessage.set('Unable to load vehicles.');
        this.notificationService.error(err?.error?.message ?? 'Unable to load vehicles.');
      },
    });
  }

  onVehicleChange(vehicleId: string): void {
    this.uploadScope.next();
    this.uploadError.set(null);
    this.selectedVehicleId.set(vehicleId);

    const vehicle = this.vehicles().find((v) => v.id === vehicleId);
    if (vehicle) {
      this.patchMileage(vehicle);
    }

    this.loadMaintenance(vehicleId);
  }

  loadMaintenance(vehicleId: string): void {
    this.loading.set(true);
    this.errorMessage.set(null);

    this.maintenanceService.getVehicleMaintenance(vehicleId).subscribe({
      next: (records) => {
        this.records.set(records);
        this.loadMaintenanceDocuments(records);
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        this.notificationService.error(
          err?.error?.message ?? 'Unable to load maintenance records.',
        );
      },
    });
  }

  createMaintenance(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const vehicleId = this.selectedVehicleId();

    if (!vehicleId) {
      this.errorMessage.set('Select a vehicle before adding maintenance.');
      return;
    }

    this.saving.set(true);
    this.errorMessage.set(null);

    const raw = this.form.getRawValue();

    const request = {
      serviceType: raw.serviceType,
      description: raw.description || undefined,
      serviceDate: raw.serviceDate,
      mileage: raw.mileage,
      cost: raw.cost,
      vendor: raw.vendor || undefined,
      nextServiceDate: raw.nextServiceDate || undefined,
    };

    this.maintenanceService.createMaintenance(vehicleId, request).subscribe({
      next: (record) => {
        this.records.update((current) => [record, ...current]);
        this.form.patchValue({
          description: '',
          cost: 0,
          vendor: '',
          nextServiceDate: '',
        });
        this.saving.set(false);
        this.notificationService.success('Maintenance saved successfully.');
      },
      error: (err) => {
        this.saving.set(false);
        // this.errorMessage.set('Unable to create maintenance record.');
        this.notificationService.error(
          err?.error?.message ?? 'Unable to load create maintenance record.',
        );
      },
    });
  }

  updateStatus(record: MaintenanceRecord, status: MaintenanceStatus): void {
    const request = {
      serviceType: record.serviceType,
      description: record.description || undefined,
      serviceDate: record.serviceDate,
      mileage: record.mileage,
      cost: record.cost,
      vendor: record.vendor || undefined,
      nextServiceDate: record.nextServiceDate || undefined,
      status,
    };

    this.maintenanceService.updateMaintenance(record.id, request).subscribe({
      next: (updated) => {
        this.records.update((current) =>
          current.map((item) => (item.id === updated.id ? updated : item)),
        );
      },
      error: (err) => {
        // this.errorMessage.set('Unable to update maintenance status.');
        this.notificationService.error(
          err?.error?.message ?? 'Unable to update maintenance status.',
        );
      },
    });
  }

  loadMaintenanceDocuments(records: MaintenanceRecord[]): void {
    records.forEach((record) => {
      this.vehicleDocumentService.getMaintenanceDocuments(record.id).subscribe({
        next: (docs) => {
          this.maintenanceDocuments.update((current) => ({
            ...current,
            [record.id]: docs,
          }));
        },
        error: (err) => {
          // console.warn(`Unable to load documents for maintenance ${record.id}`);
          this.notificationService.error(
            err?.error?.message ?? `Unable to load documents for maintenance ${record.id}`,
          );
        },
      });
    });
  }

  onMaintenanceDocumentSelected(event: Event, record: MaintenanceRecord): void {
    const input = event.target as HTMLInputElement;

    if (!input.files?.length) {
      return;
    }

    if (
      this.uploadingMaintenanceDocument() ||
      Date.now() < (this.uploadRetryAt.get(record.id) ?? 0)
    ) {
      input.value = '';
      return;
    }
    const file = input.files[0];

    if (file.size > this.maxUploadSizeBytes) {
      this.errorMessage.set('File is too large. Maximum upload size is 10 MB.');
      input.value = '';
      return;
    }

    this.uploadingMaintenanceDocument.set(record.id);
    this.errorMessage.set(null);
    this.uploadError.set(null);

    const selectedType = this.resolveMaintenanceDocumentType(file);

    this.vehicleDocumentService
      .uploadMaintenanceDocument(record.id, file, selectedType)
      .pipe(
        takeUntil(this.uploadScope),
        takeUntilDestroyed(this.destroyRef),
        finalize(() => {
          this.uploadingMaintenanceDocument.set(null);
          input.value = '';
        }),
      )
      .subscribe({
        next: (doc) => {
          this.maintenanceDocuments.update((current) => ({
            ...current,
            [record.id]: [doc, ...(current[record.id] ?? [])],
          }));

          input.value = '';
        },
        error: (err) => {
          const failure = classifyHttpFailure(err, 'upload');
          this.uploadRetryAt.set(record.id, Date.now() + (failure.retryAfterMs ?? 0));
          this.uploadError.set(failureText(failure));
        },
      });
  }

  downloadDocument(document: VehicleDocument): void {
    this.vehicleDocumentService.downloadDocument(document.id).subscribe({
      next: (response) => {
        const blob = response.body;

        if (!blob) {
          this.errorMessage.set('Unable to download document.');
          return;
        }

        const url = window.URL.createObjectURL(blob);
        const anchor = window.document.createElement('a');

        anchor.href = url;
        anchor.download = document.originalFileName;
        anchor.click();

        window.URL.revokeObjectURL(url);
      },
      error: (err) => {
        // this.errorMessage.set('Unable to download document.');
        this.notificationService.error(err?.error?.message ?? 'Unable to download document.');
      },
    });
  }

  deleteDocument(document: VehicleDocument, record: MaintenanceRecord): void {
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      width: '420px',
      data: {
        title: 'Delete Document',
        message: `Are you sure you want to delete "${document.originalFileName}"?`,
        confirmText: 'Delete',
        cancelText: 'Cancel',
      },
    });

    dialogRef.afterClosed().subscribe((confirmed) => {
      if (!confirmed) {
        return;
      }

      this.vehicleDocumentService.deleteDocument(document.id).subscribe({
        next: () => {
          this.maintenanceDocuments.update((current) => ({
            ...current,
            [record.id]: (current[record.id] ?? []).filter((item) => item.id !== document.id),
          }));
        },
        error: (err) => {
          // this.errorMessage.set('Unable to delete document.');
          this.notificationService.error(err?.error?.message ?? 'Unable to delete document.');
        },
      });
    });
  }

  refresh(): void {
    const vehicleId = this.selectedVehicleId();

    if (!vehicleId) {
      const fleetId = this.selectedFleetId();
      if (fleetId) {
        this.loadVehicles(fleetId);
        this.fleetContextService.setSelectedFleetId(fleetId);
        this.alertContextService.loadOpenAlertCount(fleetId);
      }
      return;
    }

    this.loadMaintenance(vehicleId);
  }

  private patchMileage(vehicle: Vehicle): void {
    this.form.patchValue({
      mileage: vehicle.currentMileage ?? 0,
    });
  }

  private resolveMaintenanceDocumentType(file: File): string {
    const contentType = file.type.toLowerCase();
    const fileName = file.name.toLowerCase();

    if (
      contentType.startsWith('image/') ||
      fileName.endsWith('.jpg') ||
      fileName.endsWith('.jpeg') ||
      fileName.endsWith('.png') ||
      fileName.endsWith('.webp') ||
      fileName.endsWith('.gif')
    ) {
      return 'PHOTO';
    }

    return 'MAINTENANCE_INVOICE';
  }
}
