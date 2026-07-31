import {Component, inject, OnInit, signal} from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatTableModule } from '@angular/material/table';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatButtonModule } from '@angular/material/button';
import {MatPaginator} from '@angular/material/paginator';
import {MatSnackBar, MatSnackBarModule} from '@angular/material/snack-bar';

import { FleetService } from '../../../core/services/fleet.service';
import { AlertService } from '../../../core/services/alert.service';
import { FleetContextService } from '../../../core/services/fleet-context.service';

import { Fleet } from '../../../shared/models/fleet.models';
import { Alert } from '../../../shared/models/alert.models';
import {AlertContextService} from '../../../core/services/alert-context.service';
import {NotificationService} from '../../../core/services/notification.service';
import {MatIcon} from '@angular/material/icon';
import {MatTooltip} from '@angular/material/tooltip';

@Component({
  selector: 'app-alerts',
  standalone: true,
  imports: [
    CommonModule,
    DatePipe,
    MatCardModule,
    MatTableModule,
    MatProgressSpinnerModule,
    MatSelectModule,
    MatFormFieldModule,
    MatButtonModule,
    MatPaginator,
    MatSnackBarModule,
    MatIcon,
    MatTooltip
  ],
  templateUrl: './alerts.component.html',
  styleUrl: './alerts.component.css'
})
export class AlertsComponent implements OnInit {
  private readonly snackBar = inject(MatSnackBar);
  loading = signal(false);
  errorMessage = signal<string | null>(null);

  fleets = signal<Fleet[]>([]);
  alerts = signal<Alert[]>([]);

  selectedFleetId = signal<string | null>(null);

  severityFilter = signal<'ALL' | 'CRITICAL' | 'WARNING' | 'INFO'>('ALL');
  statusFilter = signal<'ALL' | 'OPEN' | 'RESOLVED'>('ALL');

  pageSize = signal(10);
  pageIndex = signal(0);

  displayedColumns = [
    'severity',
    'type',
    'message',
    'createdAt',
    'status',
    'actions'
  ];

  constructor(
    private notificationService: NotificationService,
    private fleetService: FleetService,
    private alertService: AlertService,
    private fleetContextService: FleetContextService,
    private alertContextService: AlertContextService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.loadFleets();
  }

  onPageChange(event: any): void {
    this.pageIndex.set(event.pageIndex);
    this.pageSize.set(event.pageSize);
  }

  paginatedAlerts() {
    const start = this.pageIndex() * this.pageSize();
    const end = start + this.pageSize();
    return this.alerts().slice(start, end);
  }

  filteredAlerts() {
    return this.alerts().filter(alert => {
      const severityMatches =
        this.severityFilter() === 'ALL' ||
        alert.severity === this.severityFilter();

      const statusMatches =
        this.statusFilter() === 'ALL' ||
        (this.statusFilter() === 'OPEN' && !alert.resolved) ||
        (this.statusFilter() === 'RESOLVED' && alert.resolved);

      return severityMatches && statusMatches;
    });
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

        this.loadAlerts(selectedFleet.id);
      },
      error: err => {
        this.loading.set(false);
        this.notificationService.error(err?.error?.message ?? 'Unable to load fleets.');
      }
    });
  }

  onFleetChange(fleetId: string): void {
    this.selectedFleetId.set(fleetId);
    this.fleetContextService.setSelectedFleetId(fleetId);
    this.loadAlerts(fleetId);
  }

  loadAlerts(fleetId: string): void {
    this.loading.set(true);
    this.errorMessage.set(null);

    this.alertService.getFleetAlerts(fleetId).subscribe({
      next: alerts => {
        this.alerts.set(alerts);
        this.loading.set(false);
      },
      error: err => {
        this.loading.set(false);
        this.notificationService.error(err?.error?.message ?? 'Unable to generate alert.');
      }
    });
  }

  resolveAlert(alert: Alert): void {
    this.alertService.resolveAlert(alert.id).subscribe({
      next: updated => {
        this.alerts.update(current =>
          current.map(item => item.id === updated.id ? updated : item)
        );
        this.notificationService.success('Alert resolved.');
      },
      error: err => {
        // this.errorMessage.set('Unable to resolve alert.');
        this.notificationService.error(err?.error?.message ?? 'Unable to generate alert.');
      }
    });
  }

  confirmDelete(alert: Alert): void {
    if (confirm(`Delete alert "${alert.type}"?`)) {
      this.deleteAlert(alert.id);
    }
  }

  deleteAlert(alertId: string): void {
    this.alertService.deleteAlert(alertId).subscribe({
      next: () => {
        this.alerts.update(alerts =>
          alerts.filter(alert => alert.id !== alertId)
        );

        this.snackBar.open('Alert deleted', 'Close', {
          duration: 3000
        });
      },
      error: () => {
        this.snackBar.open('Unable to delete alert', 'Close', {
          duration: 3000
        });
      }
    });
  }

  openVehicle(alert: Alert): void {
    if (!alert.vehicleId) {
      return;
    }

    this.router.navigate(['/vehicles', alert.vehicleId]);
  }

  refresh(): void {
    const fleetId = this.selectedFleetId();

    if (!fleetId) {
      this.loadFleets();
      return;
    }

    this.loadAlerts(fleetId);
    this.fleetContextService.setSelectedFleetId(fleetId);
    this.alertContextService.loadOpenAlertCount(fleetId);
  }
}
