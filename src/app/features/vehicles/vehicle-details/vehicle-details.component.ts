import { Component, OnInit, signal } from '@angular/core';
import { CommonModule, DatePipe, DecimalPipe, CurrencyPipe } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';

import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTabsModule } from '@angular/material/tabs';
import { MatTableModule } from '@angular/material/table';

import { MaintenanceService } from '../../../core/services/maintenance.service';
import { MaintenanceRecord } from '../../../shared/models/maintenance.models';

import { VehicleService } from '../../../core/services/vehicle.service';
import { Vehicle } from '../../../shared/models/vehicle.models';

import { FuelService } from '../../../core/services/fuel.service';
import { FuelLog } from '../../../shared/models/fuel.models';

import { AlertService } from '../../../core/services/alert.service';
import { Alert } from '../../../shared/models/alert.models';

import { AiInsightService } from '../../../core/services/ai-insight.service';
import { AiInsight } from '../../../shared/models/ai-insight.models';

import { VehicleStatus, UpdateVehicleRequest } from '../../../shared/models/vehicle.models';

import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';

import { FleetService } from '../../../core/services/fleet.service';
import { FleetContextService } from '../../../core/services/fleet-context.service';
import { AlertContextService } from '../../../core/services/alert-context.service';
import { Fleet } from '../../../shared/models/fleet.models';
import { VehicleDocumentService } from '../../../core/services/vehicle-document.service';
import { VehicleDocument } from '../../../shared/models/vehicle-document.models';

import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { ConfirmDialogComponent } from '../../../shared/components/confirm-dialog/confirm-dialog.component';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import {NotificationService} from '../../../core/services/notification.service';
import {TelematicsDevice, TelematicsEvent} from '../../../shared/models/telematics.models';
import {TelematicsService} from '../../../core/services/telematics.service';
import {VehicleMapComponent} from './vehicle-map/vehicle-map.component';

@Component({
  selector: 'app-vehicle-details',
  standalone: true,
  imports: [
    CommonModule,
    DatePipe,
    DecimalPipe,
    CurrencyPipe,
    MatCardModule,
    MatButtonModule,
    MatProgressSpinnerModule,
    MatTabsModule,
    MatTableModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatSnackBarModule,
    VehicleMapComponent
  ],
  templateUrl: './vehicle-details.component.html',
  styleUrl: './vehicle-details.component.css'
})
export class VehicleDetailsComponent implements OnInit {
  loading = signal(false);
  errorMessage = signal<string | null>(null);
  vehicle = signal<Vehicle | null>(null);

  generatingInsight = signal(false);
  loadingOlderInsights = signal(false);

  latestInsight = signal<AiInsight | null>(null);
  olderInsights = signal<AiInsight[]>([]);
  showOlderInsights = signal(false);

  maintenanceRecords = signal<MaintenanceRecord[]>([]);
  fuelLogs = signal<FuelLog[]>([]);
  alerts = signal<Alert[]>([]);
  updatingStatus = signal(false);

  editingVehicle = signal(false);
  savingVehicle = signal(false);
  fleets = signal<Fleet[]>([]);
  documents = signal<VehicleDocument[]>([]);
  uploadingDocument = signal(false);
  maintenanceDocuments = signal<Record<string, VehicleDocument[]>>({});
  uploadingMaintenanceDocument = signal<string | null>(null);
  selectedDocumentType = signal('GENERAL');
  latestTelematics = signal<TelematicsEvent | null>(null);
  device = signal<TelematicsDevice | null>(null);

  documentTypes = [
    'GENERAL',
    'REGISTRATION',
    'INSURANCE',
    'INSPECTION',
    'MAINTENANCE_INVOICE',
    'FUEL_RECEIPT',
    'PHOTO',
    'OTHER'
  ];

  readonly maxUploadSizeBytes = 10 * 1024 * 1024;

  vehicleForm;

  maintenanceColumns = [
    'serviceType',
    'serviceDate',
    'mileage',
    'cost',
    'vendor',
    'status',
    'documents'
  ];

  fuelColumns = [
    'fuelDate',
    'mileage',
    'gallons',
    'totalCost',
    'pricePerGallon'
  ];

  alertColumns = [
    'type',
    'message',
    'createdAt',
    'status',
    'actions'
  ];

  documentColumns = [
    'fileName',
    'documentType',
    'fileSize',
    'createdAt',
    'actions'
  ];

  constructor(
    private notificationService: NotificationService,
    private route: ActivatedRoute,
    private router: Router,
    private fb: FormBuilder,
    private vehicleService: VehicleService,
    private maintenanceService: MaintenanceService,
    private fuelService: FuelService,
    private alertService: AlertService,
    private aiInsightService: AiInsightService,
    private fleetService: FleetService,
    private fleetContextService: FleetContextService,
    private alertContextService: AlertContextService,
    private vehicleDocumentService: VehicleDocumentService,
    private dialog: MatDialog,
    private telematicsService: TelematicsService
  ) {
    this.vehicleForm = this.fb.nonNullable.group({
      fleetId: ['', [Validators.required]],
      licensePlate: [''],
      currentMileage: [0, [Validators.required, Validators.min(0)]]
    });
  }

  ngOnInit(): void {
    const vehicleId = this.route.snapshot.paramMap.get('vehicleId');

    if (!vehicleId) {
      this.errorMessage.set('Vehicle ID is missing.');
      return;
    }

    this.loadVehicle(vehicleId);
  }

  loadTelematicsDevice(vehicleId: string): void {
    this.telematicsService.getDevicesForVehicle(vehicleId).subscribe({
      next: devices => {
        this.device.set(devices[0] ?? null);
      },
      error: () => {
        this.device.set(null);
      }
    });
  }

  loadLatestTelematics(vehicleId: string): void {
    this.telematicsService.getCurrentVehicleState(vehicleId).subscribe({
      next: data => {
        // console.log('Latest vehicle telematics:', data);
        this.latestTelematics.set(data)
      },
      error: err => {
        // console.error('Latest telematics failed:', err);
        this.latestTelematics.set(null)
      }
    });
  }

  canSetStatus(status: VehicleStatus): boolean {
    return this.vehicle()?.status !== status;
  }

  loadVehicle(vehicleId: string): void {
    this.loading.set(true);
    this.errorMessage.set(null);

    this.vehicleService.getVehicle(vehicleId).subscribe({
      next: vehicle => {
        this.vehicle.set(vehicle);

        this.loadMaintenance(vehicle.id);
        this.loadFuelLogs(vehicle.id);
        this.loadAlerts(vehicle);
        this.loadLatestVehicleInsight(vehicle.id);
        this.loadFleets();
        this.patchVehicleForm(vehicle);
        this.loadDocuments(vehicle.id);
        this.loadLatestTelematics(vehicle.id);
        this.loadTelematicsDevice(vehicleId);

        this.loading.set(false);
      },
      error: err => {
        this.loading.set(false);
        // this.errorMessage.set('Unable to load vehicle.');
        this.notificationService.error(err?.error?.message ?? 'Unable to load vehicle.');
      }
    });
  }

  backToVehicles(): void {
    this.router.navigate(['/vehicles']);
  }

  loadMaintenance(vehicleId: string): void {
    this.maintenanceService.getVehicleMaintenance(vehicleId).subscribe({
      next: records => {
        this.maintenanceRecords.set(records);
        this.loadMaintenanceDocuments(records);
      },
      error: err => {
        this.errorMessage.set('Unable to load maintenance history.');
        this.notificationService.error(err?.error?.message ?? 'Unable to load maintenance history.');
      }
    });
  }

  loadFuelLogs(vehicleId: string): void {
    this.fuelService.getVehicleFuelLogs(vehicleId).subscribe({
      next: logs => {
        this.fuelLogs.set(logs);
      },
      error: err => {
        // this.errorMessage.set('Unable to load fuel history.');
        this.notificationService.error(err?.error?.message ?? 'Unable to load fuel history.');
      }
    });
  }

  loadAlerts(vehicle: Vehicle): void {
    this.alertService.getFleetAlerts(vehicle.fleetId).subscribe({
      next: alerts => {
        this.alerts.set(
          alerts.filter(alert => alert.vehicleId === vehicle.id)
        );
      },
      error: err => {
        // this.errorMessage.set('Unable to load alerts.');
        this.notificationService.error(err?.error?.message ?? 'Unable to load alerts.');
      }
    });
  }

  resolveAlert(alert: Alert): void {
    this.alertService.resolveAlert(alert.id).subscribe({
      next: updated => {
        this.alerts.update(current =>
          current.map(item => item.id === updated.id ? updated : item)
        );
        this.notificationService.success('Alert resolved successfully.');
      },
      error: err => {
        // this.errorMessage.set('Unable to resolve alert.');
        this.notificationService.error(err?.error?.message ?? 'Unable to resolve alert.');
      }
    });
  }

  loadLatestVehicleInsight(vehicleId: string): void {
    this.aiInsightService.getLatestVehicleInsight(vehicleId).subscribe({
      next: insight => {
        this.latestInsight.set(insight);
      },
      error: err => {
        // this.errorMessage.set('Unable to load latest vehicle AI insight.');
        this.notificationService.error(err?.error?.message ?? 'Unable to load latest vehicle AI insight.');
      }
    });
  }

  loadOlderInsights(): void {
    const vehicle = this.vehicle();

    if (!vehicle) {
      return;
    }

    this.loadingOlderInsights.set(true);
    this.errorMessage.set(null);

    this.aiInsightService.getVehicleInsights(vehicle.id).subscribe({
      next: insights => {
        const latestId = this.latestInsight()?.id;

        this.olderInsights.set(
          insights.filter(insight => insight.id !== latestId)
        );

        this.showOlderInsights.set(true);
        this.loadingOlderInsights.set(false);
        this.notificationService.success('Vehicle Insight has been loaded successfully.');
      },
      error: err => {
        this.loadingOlderInsights.set(false);
        // this.errorMessage.set('Unable to load older AI insights.');
        this.notificationService.error(err?.error?.message ?? 'Unable to load older vehicle AI insight.');
      }
    });
  }

  generateAiInsight(): void {
    const vehicle = this.vehicle();

    if (!vehicle) {
      return;
    }

    this.generatingInsight.set(true);
    this.errorMessage.set(null);

    this.aiInsightService.generateVehicleSummary(vehicle.id, {
      timeframe: 'Last 30 days',
      includeFuelStats: true,
      includeMaintenanceStats: true
    }).subscribe({
      next: insight => {
        this.latestInsight.set(insight);
        this.olderInsights.set([]);
        this.showOlderInsights.set(false);
        this.generatingInsight.set(false);
        this.notificationService.success('Vehicle AI insight generated successfully.');
      },
      error: err => {
        this.generatingInsight.set(false);
        // this.errorMessage.set('Unable to generate vehicle AI insight.');
        this.notificationService.error(err?.error?.message ?? 'Vehicle AI insight only available once a day.');
      }
    });
  }

  updateVehicleStatus(status: VehicleStatus): void {
    const vehicle = this.vehicle();

    if (!vehicle) {
      return;
    }

    this.updatingStatus.set(true);
    this.errorMessage.set(null);

    const request: UpdateVehicleRequest = {
      vin: vehicle.vin,
      make: vehicle.make,
      model: vehicle.model,
      year: vehicle.year,
      licensePlate: vehicle.licensePlate,
      currentMileage: vehicle.currentMileage,
      status,
      fleetId: vehicle.fleetId
    };

    this.vehicleService.updateVehicle(vehicle.id, request).subscribe({
      next: updated => {
        this.vehicle.set(updated);
        this.updatingStatus.set(false);
        // this.notificationService.success('Vehicle status updated successfully.');
      },
      error: err => {
        this.updatingStatus.set(false);
        // this.errorMessage.set('Unable to update vehicle status.');
        this.notificationService.error(err?.error?.message ?? 'Unable to update vehicle status.');
      }
    });
  }

  loadFleets(): void {
    this.fleetService.getMyFleets().subscribe({
      next: fleets => this.fleets.set(fleets),
      error: err => {
        // this.errorMessage.set('Unable to load fleets.')
        this.notificationService.error(err?.error?.message ?? 'Unable to load fleets.');
      }
    });
  }

  patchVehicleForm(vehicle: Vehicle): void {
    this.vehicleForm.patchValue({
      fleetId: vehicle.fleetId,
      licensePlate: vehicle.licensePlate || '',
      currentMileage: vehicle.currentMileage || 0
    });
  }

  startEditVehicle(): void {
    const vehicle = this.vehicle();

    if (!vehicle) {
      return;
    }

    this.patchVehicleForm(vehicle);
    this.editingVehicle.set(true);
  }

  cancelEditVehicle(): void {
    this.editingVehicle.set(false);

    const vehicle = this.vehicle();
    if (vehicle) {
      this.patchVehicleForm(vehicle);
    }
  }

  saveVehicleChanges(): void {
    const vehicle = this.vehicle();

    if (!vehicle || this.vehicleForm.invalid) {
      this.vehicleForm.markAllAsTouched();
      return;
    }

    this.savingVehicle.set(true);
    this.errorMessage.set(null);

    const raw = this.vehicleForm.getRawValue();

    const request: UpdateVehicleRequest = {
      vin: vehicle.vin,
      make: vehicle.make,
      model: vehicle.model,
      year: vehicle.year,
      licensePlate: raw.licensePlate,
      currentMileage: raw.currentMileage,
      status: vehicle.status,
      fleetId: raw.fleetId
    };

    this.vehicleService.updateVehicle(vehicle.id, request).subscribe({
      next: updated => {
        this.vehicle.set(updated);
        this.patchVehicleForm(updated);
        this.editingVehicle.set(false);
        this.savingVehicle.set(false);

        this.fleetContextService.setSelectedFleetId(updated.fleetId);
        this.alertContextService.loadOpenAlertCount(updated.fleetId);
        this.notificationService.success('Vehicle updated successfully.');
      },
      error: err => {
        this.savingVehicle.set(false);
        // this.errorMessage.set('Unable to update vehicle.');
        this.notificationService.error(err?.error?.message ?? 'Unable to update vehicle.');
      }
    });
  }

  loadDocuments(vehicleId: string): void {
    this.vehicleDocumentService.getVehicleDocuments(vehicleId).subscribe({
      next: documents => {
        this.documents.set(documents);
        // this.notificationService.success('Vehicle status updated successfully.');
      },
      error: err => {
        this.errorMessage.set('Unable to load documents.');
        this.notificationService.error(err?.error?.message ?? 'Unable to update vehicle status.');
      }
    });
  }

  onDocumentSelected(event: Event): void {
    const vehicle = this.vehicle();

    if (!vehicle) {
      return;
    }

    const input = event.target as HTMLInputElement;

    if (!input.files?.length) {
      return;
    }

    const file = input.files[0];

    if (file.size > this.maxUploadSizeBytes) {
      this.errorMessage.set('File is too large. Maximum upload size is 10 MB.');
      input.value = '';
      return;
    }

    const selectedType = this.selectedDocumentType();

    if (selectedType === 'PHOTO' && !this.isImageFile(file)) {
      this.errorMessage.set('PHOTO documents must be image files.');
      input.value = '';
      return;
    }

    this.uploadingDocument.set(true);
    this.errorMessage.set(null);

    this.vehicleDocumentService.uploadDocument(
      vehicle.id,
      file,
      this.selectedDocumentType()
    ).subscribe({
      next: document => {
        this.documents.update(current => [document, ...current]);
        this.uploadingDocument.set(false);
        input.value = '';
        this.notificationService.success('Document uploaded successfully.');
      },
      error: err => {
        this.uploadingDocument.set(false);
        // this.errorMessage.set('Unable to upload document.');
        this.notificationService.error(err?.error?.message ?? 'Unable to upload document.');
      }
    });
  }

  downloadDocument(document: VehicleDocument): void {
    this.vehicleDocumentService.downloadDocument(document.id).subscribe({
      next: response => {
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
        this.notificationService.success('Document downloaded successfully.');
      },
      error: err => {
        // this.errorMessage.set('Unable to download document.');
        this.notificationService.error(err?.error?.message ?? 'Unable to download document.');
      }
    });
  }

  deleteDocument(document: VehicleDocument): void {
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      width: '420px',
      data: {
        title: 'Delete Document',
        message: `Are you sure you want to delete "${document.originalFileName}"?`,
        confirmText: 'Delete',
        cancelText: 'Cancel'
      }
    });

    dialogRef.afterClosed().subscribe(confirmed => {
      if (!confirmed) {
        return;
      }

      this.vehicleDocumentService.deleteDocument(document.id).subscribe({
        next: () => {
          this.documents.update(current =>
            current.filter(item => item.id !== document.id)
          );
          this.notificationService.success('Document deleted successfully.');
        },
        error: err => {
          // this.errorMessage.set('Unable to delete document.');
          this.notificationService.error(err?.error?.message ?? 'Unable to delete document.');
        }
      });
    });
  }

  formatFileSize(bytes: number): string {
    if (bytes < 1024) {
      return `${bytes} B`;
    }

    if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(1)} KB`;
    }

    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  private isImageFile(file: File): boolean {
    const allowedMimeTypes = [
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/gif'
    ];

    const allowedExtensions = [
      '.jpg',
      '.jpeg',
      '.png',
      '.webp',
      '.gif'
    ];

    const fileName = file.name.toLowerCase();

    return allowedMimeTypes.includes(file.type)
      || allowedExtensions.some(extension => fileName.endsWith(extension));
  }

  loadMaintenanceDocuments(records: MaintenanceRecord[]): void {
    records.forEach(record => {
      this.vehicleDocumentService.getMaintenanceDocuments(record.id).subscribe({
        next: docs => {
          this.maintenanceDocuments.update(current => ({
            ...current,
            [record.id]: docs
          }));
        }
      });
    });
  }

  onMaintenanceDocumentSelected(event: Event, record: MaintenanceRecord): void {
    const input = event.target as HTMLInputElement;

    if (!input.files?.length) {
      return;
    }

    const file = input.files[0];

    if (file.size > this.maxUploadSizeBytes) {
      this.errorMessage.set('File is too large. Maximum upload size is 10 MB.');
      input.value = '';
      return;
    }

    this.uploadingMaintenanceDocument.set(record.id);

    this.vehicleDocumentService.uploadMaintenanceDocument(
      record.id,
      file,
      'MAINTENANCE_INVOICE'
    ).subscribe({
      next: doc => {
        this.maintenanceDocuments.update(current => ({
          ...current,
          [record.id]: [doc, ...(current[record.id] ?? [])]
        }));

        this.uploadingMaintenanceDocument.set(null);
        input.value = '';
        this.notificationService.success('Maintenance document uploaded.');
      },
      error: err => {
        this.uploadingMaintenanceDocument.set(null);
        // this.errorMessage.set('Unable to upload maintenance document.');
        this.notificationService.error(err?.error?.message ?? 'Unable to upload maintenance document.');
      }
    });
  }

  getDeviceStatus(): 'ONLINE' | 'STALE' | 'OFFLINE' {
    const device = this.device();

    if (!device?.lastSeenAt) {
      return 'OFFLINE';
    }

    const lastSeen = new Date(device.lastSeenAt).getTime();
    const minutesAgo = (Date.now() - lastSeen) / 1000 / 60;

    if (minutesAgo <= 10) {
      return 'ONLINE';
    }

    if (minutesAgo <= 60) {
      return 'STALE';
    }

    return 'OFFLINE';
  }

  getDeviceStatusClass(): string {
    return this.getDeviceStatus().toLowerCase();
  }

  // remove this later (used to simulate telematics data)
  simulateTelematicsEvent(): void {
    const vehicleId = this.vehicle()?.id; // replace if your vehicle id variable is different

    if (!vehicleId) {
      this.notificationService.error('No vehicle selected.');
      return;
    }

    const event = {
      vehicleId,
      recordedAt: new Date().toISOString(),
      latitude: 28.5383 + (Math.random() - 0.5) / 100,
      longitude: -81.3792 + (Math.random() - 0.5) / 100,
      speedMph: Math.floor(35 + Math.random() * 70),
      odometerMiles: Math.floor(110000 + Math.random() * 5000),
      fuelLevelPercent: Math.floor(5 + Math.random() * 90),
      engineTempF: Math.floor(185 + Math.random() * 75),
      batteryVoltage: Number((11.2 + Math.random() * 1.8).toFixed(1)),
      checkEngine: Math.random() > 0.8,
      harshBraking: Math.random() > 0.75,
      idleMinutes: Math.floor(Math.random() * 60)
    };

    this.telematicsService.createEvent(event).subscribe({
      next: telemetry => {
        this.latestTelematics.set(telemetry);
        this.notificationService.success('Telematics event generated.');
      },
      error: err => {
        this.notificationService.error(
          err?.error?.message ?? 'Unable to generate telematics event.'
        );
      }
    });
  }
}
