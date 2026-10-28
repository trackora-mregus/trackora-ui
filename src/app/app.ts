import { PILOT_PRESENTATION } from './core/config/pilot-presentation';
import { Component, inject, computed, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { AlertContextService } from './core/services/alert-context.service';
import { FleetContextService } from './core/services/fleet-context.service';
import { AuthService } from './core/auth/auth.service';
import { MatMenuModule } from '@angular/material/menu';
import { MatIconModule } from '@angular/material/icon';
import { Alert } from './shared/models/alert.models';
import {ThemeService} from './core/services/theme.service';

import { debounceTime, distinctUntilChanged, Subject, switchMap } from 'rxjs';

import { SearchService } from './core/services/search.service';
import { SearchResponse } from './shared/models/search.models';
import {DatePipe} from '@angular/common';
import {MatBadgeModule} from '@angular/material/badge';
import {AppNotificationService} from './core/services/app-notification.service';
import {AppNotification} from './shared/models/notification.models';

@Component({
  selector: 'app-root',
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    MatToolbarModule,
    MatButtonModule,
    MatMenuModule,
    MatIconModule,
    DatePipe,
    MatMenuModule,
    MatBadgeModule,
    MatIconModule
  ],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  readonly pilotPresentation = inject(PILOT_PRESENTATION);
  protected readonly title = signal('fleetwise-ui');

  searchQuery = '';
  searchResults: SearchResponse | null = null;
  searchOpen = false;

  private searchTerms = new Subject<string>();

  constructor(
    private authService: AuthService,
    private router: Router,
    public alertContextService: AlertContextService,
    private fleetContextService: FleetContextService,
    public themeService: ThemeService,
    private searchService: SearchService,
    public appNotificationService: AppNotificationService,
  ) {
    this.searchTerms.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      switchMap(query => this.searchService.search(query))
    ).subscribe(results => {
      this.searchResults = results;
      this.searchOpen = true;
    });
  }

  ngOnInit(): void {
    if (this.pilotPresentation) return;
    const fleetId = this.fleetContextService.selectedFleetId();
    this.appNotificationService.refresh();

    if (fleetId) {
      this.alertContextService.loadOpenAlertCount(fleetId);
    }
  }

  openAlert(alert: Alert): void {
    if (this.pilotPresentation) return;
    if (alert.vehicleId) {
      this.router.navigate(['/vehicles', alert.vehicleId]);
      return;
    }

    this.router.navigate(['/alerts']);
  }

  showShell(): boolean {
    return this.authService.isAuthenticated() && this.router.url !== '/login';
  }

  logout(): void {
    this.authService.logout();
    this.alertContextService.clear();
    this.router.navigate(['/login']);
  }

  onSearchChange(query: string): void {
    if (this.pilotPresentation) return;
    this.searchQuery = query;

    if (query.trim().length < 2) {
      this.searchResults = null;
      this.searchOpen = false;
      return;
    }

    this.searchTerms.next(query.trim());
  }

  openVehicle(vehicleId: string): void {
    this.searchOpen = false;
    this.searchQuery = '';
    this.searchResults = null;

    this.router.navigate(['/vehicles', vehicleId]);
  }

  openSearchAlert(): void {
    if (this.pilotPresentation) return;
    this.searchOpen = false;
    this.searchQuery = '';
    this.searchResults = null;

    this.router.navigate(['/alerts']);
  }

  getNotificationIcon(type: string): string {
    console.log(type);
    switch (type) {
      case 'MAINTENANCE_DUE':
      case 'MAINTENANCE_OVERDUE':
        return 'build';

      case 'CRITICAL_ALERT':
        return 'warning';

      case 'AI_SUMMARY':
        return 'psychology';

      default:
        return 'notifications';
    }
  }

  openNotification(notification: AppNotification): void {
    if (this.pilotPresentation) return;
    this.appNotificationService.markAsRead(notification.id);

    const type = String(notification.type ?? '').trim().toUpperCase();

    console.log(type);

    switch (type) {
      case 'MAINTENANCE_DUE':
      case 'MAINTENANCE_OVERDUE':
        this.router.navigate(['/maintenance']);
        break;

      case 'CRITICAL_ALERT':
        this.router.navigate(['/alerts']);
        break;

      case 'AI_SUMMARY':
        this.router.navigate(['/dashboard']);
        break;

      case 'AI_VEHICLE_SUMMARY':
        this.router.navigate(['/vehicles']);
        break;

      default:
        console.warn('Unknown notification type:', notification.type);
        this.router.navigate(['/dashboard']);
    }
  }
}
