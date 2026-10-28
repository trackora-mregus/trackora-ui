import { PILOT_PRESENTATION } from '../../../core/config/pilot-presentation';
import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import {MatPaginator, MatPaginatorModule} from '@angular/material/paginator';
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

import { Fleet } from '../../../shared/models/fleet.models';
import { Vehicle } from '../../../shared/models/vehicle.models';
import {AlertContextService} from '../../../core/services/alert-context.service';
import {NotificationService} from '../../../core/services/notification.service';

@Component({
  selector: 'app-vehicles',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatCardModule,
    MatTableModule,
    MatProgressSpinnerModule,
    MatSelectModule,
    MatFormFieldModule,
    MatButtonModule,
    MatInputModule,
    MatPaginator,
    MatSnackBarModule
  ],
  templateUrl: './vehicles.component.html',
  styleUrl: './vehicles.component.css'
})
export class VehiclesComponent implements OnInit {
  readonly pilotPresentation = inject(PILOT_PRESENTATION);
  loading = signal(false);
  saving = signal(false);
  errorMessage = signal<string | null>(null);

  fleets = signal<Fleet[]>([]);
  selectedFleetId = signal<string | null>(null);
  vehicles = signal<Vehicle[]>([]);

  decodingVin = signal(false);
  decodedVehicle = signal<string | null>(null);

  pageSize = signal(10);
  pageIndex = signal(0);

  displayedColumns = [
    'vehicle',
    'year',
    'licensePlate',
    'mileage',
    'status'
  ];

  form;

  constructor(
    private notificationService: NotificationService,
    private fb: FormBuilder,
    private fleetService: FleetService,
    private vehicleService: VehicleService,
    private fleetContextService: FleetContextService,
    private alertContextService: AlertContextService,
    private router: Router,
  ) {
    this.form = this.fb.nonNullable.group({
      vin: [''],
      make: ['', [Validators.required, Validators.maxLength(100)]],
      model: ['', [Validators.required, Validators.maxLength(100)]],
      year: [2020, [Validators.required, Validators.min(1900), Validators.max(2100)]],
      licensePlate: [''],
      currentMileage: [0, [Validators.min(0)]]
    });
  }

  ngOnInit(): void {
    this.loadFleets();
  }

  onPageChange(event: any): void {
    this.pageIndex.set(event.pageIndex);
    this.pageSize.set(event.pageSize);
  }

  paginatedVehicles() {
    const start = this.pageIndex() * this.pageSize();
    const end = start + this.pageSize();
    return this.vehicles().slice(start, end);
  }

  loadFleets(): void {
    this.loading.set(true);
    this.errorMessage.set(null);

    this.fleetService.getMyFleets().subscribe({
      next: fleets => {
        this.fleets.set(fleets);

        if (fleets.length === 0) {
          this.loading.set(false);
          this.errorMessage.set('No fleets found.');
          return;
        }

        const savedFleetId = this.fleetContextService.selectedFleetId();
        const selectedFleet =
          fleets.find(fleet => fleet.id === savedFleetId) ?? fleets[0];

        this.selectedFleetId.set(selectedFleet.id);
        this.fleetContextService.setSelectedFleetId(selectedFleet.id);

        this.loadVehicles(selectedFleet.id);
      },
      error: () => {
        this.loading.set(false);
        this.errorMessage.set('Unable to load fleets.');
      }
    });
  }

  onFleetChange(fleetId: string): void {
    this.selectedFleetId.set(fleetId);
    this.fleetContextService.setSelectedFleetId(fleetId);
    this.loadVehicles(fleetId);
  }

  loadVehicles(fleetId: string): void {
    this.loading.set(true);
    this.errorMessage.set(null);

    this.vehicleService.getFleetVehicles(fleetId).subscribe({
      next: vehicles => {
        this.vehicles.set(vehicles);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.errorMessage.set('Unable to load vehicles.');
      }
    });
  }

  createVehicle(): void {
    if (this.pilotPresentation) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const fleetId = this.selectedFleetId();

    if (!fleetId) {
      this.errorMessage.set('Select a fleet before creating a vehicle.');
      return;
    }

    this.saving.set(true);
    this.errorMessage.set(null);

    this.vehicleService.createVehicle(fleetId, this.form.getRawValue()).subscribe({
      next: vehicle => {
        this.vehicles.update(current => [vehicle, ...current]);
        this.form.reset({
          vin: '',
          make: '',
          model: '',
          year: 2020,
          licensePlate: '',
          currentMileage: 0
        });
        this.saving.set(false);
        this.notificationService.success('Vehicle created successfully.');
      },
      error: () => {
        this.saving.set(false);
        this.errorMessage.set('Unable to create vehicle.');
        this.notificationService.error('Unable to create vehicle.');
      }
    });
  }

  openVehicle(vehicle: Vehicle): void {
    this.router.navigate(['/vehicles', vehicle.id]);
  }

  refresh(): void {
    const fleetId = this.selectedFleetId();

    if (!fleetId) {
      this.loadFleets();
      return;
    }

    this.loadVehicles(fleetId);
    this.fleetContextService.setSelectedFleetId(fleetId);
    if (!this.pilotPresentation) this.alertContextService.loadOpenAlertCount(fleetId);
  }

  decodeVin(): void {
    if (this.pilotPresentation) return;
    const vin = this.form.controls.vin.value?.trim();

    if (!vin) {
      this.errorMessage.set('Enter a VIN first.');
      return;
    }

    this.decodingVin.set(true);
    this.errorMessage.set(null);
    this.decodedVehicle.set(null);

    this.vehicleService.decodeVin(vin).subscribe({
      next: decoded => {
        this.form.patchValue({
          vin: decoded.vin,
          make: decoded.make,
          model: decoded.model,
          year: decoded.year
        });

        this.decodedVehicle.set(
          `${decoded.year} ${decoded.make} ${decoded.model}`
        );

        this.decodingVin.set(false);
      },
      error: () => {
        this.decodingVin.set(false);
        this.errorMessage.set('Unable to decode VIN.');
      }
    });
  }
}
