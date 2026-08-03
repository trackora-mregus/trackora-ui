import {
  AfterViewInit,
  Component,
  DestroyRef,
  ElementRef,
  inject,
  input,
  signal,
  viewChild
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import * as L from 'leaflet';

import { TelematicsService } from '../../../../core/services/telematics.service';
import {TelematicsHistoryPoint} from '../../../../shared/models/fleet-map.models';

type ValidTelematicsHistoryPoint =
  TelematicsHistoryPoint & {
  latitude: number;
  longitude: number;
};

@Component({
  selector: 'app-vehicle-map',
  standalone: true,
  imports: [
    DatePipe,
    MatButtonModule,
    MatCardModule,
    MatIconModule,
    MatProgressSpinnerModule
  ],
  templateUrl: './vehicle-map.component.html',
  styleUrl: './vehicle-map.component.css'
})
export class VehicleMapComponent implements AfterViewInit {

  readonly vehicleId = input.required<string>();
  readonly vehicleName = input<string>('Vehicle');
  readonly licensePlate = input<string>('');

  private readonly telematicsService = inject(TelematicsService);
  private readonly destroyRef = inject(DestroyRef);

  private readonly mapContainer =
    viewChild.required<ElementRef<HTMLDivElement>>('mapContainer');

  readonly loading = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly historyPoints = signal<TelematicsHistoryPoint[]>([]);
  readonly selectedRange = signal<'TODAY' | '7_DAYS' | '30_DAYS'>('TODAY');

  private map?: L.Map;
  private routeLayer?: L.Polyline;
  private markerLayer = L.layerGroup();

  ngAfterViewInit(): void {
    this.initializeMap();
    this.loadRange('TODAY');
  }

  loadRange(range: 'TODAY' | '7_DAYS' | '30_DAYS'): void {
    this.selectedRange.set(range);

    const end = new Date();
    const start = new Date();

    switch (range) {
      case 'TODAY':
        start.setHours(0, 0, 0, 0);
        break;

      case '7_DAYS':
        start.setDate(end.getDate() - 7);
        break;

      case '30_DAYS':
        start.setDate(end.getDate() - 30);
        break;
    }

    this.loadHistory(start, end);
  }

  refresh(): void {
    this.loadRange(this.selectedRange());
  }

  private initializeMap(): void {
    this.map = L.map(this.mapContainer().nativeElement, {
      center: [29.1311, -82.1941],
      zoom: 13,
      zoomControl: true
    });

    L.tileLayer(
      'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap contributors'
      }
    ).addTo(this.map);

    this.markerLayer.addTo(this.map);

    setTimeout(() => {
      this.map?.invalidateSize();
    });
  }

  private loadHistory(start: Date, end: Date): void {
    this.loading.set(true);
    this.errorMessage.set(null);

    this.telematicsService
      .getVehicleHistory(
        this.vehicleId(),
        start.toISOString(),
        end.toISOString()
      )
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
          next: points => {
            const validPoints = points.filter(
              (point): point is ValidTelematicsHistoryPoint =>
                point.latitude !== null &&
                point.longitude !== null
            );

            this.historyPoints.set(validPoints);
            this.renderRoute(validPoints);
            this.loading.set(false);
          },
        error: error => {
          console.error('Unable to load vehicle history', error);

          this.historyPoints.set([]);
          this.clearMapLayers();
          this.errorMessage.set(
            'Unable to load location history for this vehicle.'
          );
          this.loading.set(false);
        }
      });
  }

  private renderRoute(points: ValidTelematicsHistoryPoint[]): void {
    this.clearMapLayers();

    if (!this.map || points.length === 0) {
      return;
    }

    const coordinates: L.LatLngExpression[] =
      points.map(point => [
        point.latitude,
        point.longitude
      ]);

    this.routeLayer = L.polyline(coordinates, {
      color: '#2563eb',
      weight: 5,
      opacity: 0.85
    }).addTo(this.map);

    const first = points[0];
    const last = points[points.length - 1];

    this.addEndpointMarker(first, 'Start', '#16a34a');
    this.addEndpointMarker(last, 'Latest', '#dc2626');

    this.map.fitBounds(this.routeLayer.getBounds(), {
      padding: [35, 35],
      maxZoom: 16
    });

    setTimeout(() => {
      this.map?.invalidateSize();
    });
  }

  private addEndpointMarker(
    point: ValidTelematicsHistoryPoint,
    label: string,
    color: string
  ): void {
    const marker = L.circleMarker(
      [point.latitude, point.longitude],
      {
        radius: 8,
        color,
        fillColor: color,
        fillOpacity: 1,
        weight: 3
      }
    );

    marker.bindPopup(`
      <strong>${label}</strong><br>
      ${this.escapeHtml(this.vehicleName())}<br>
      ${this.escapeHtml(this.licensePlate())}<br>
      Speed: ${point.speedMph ?? 0} mph<br>
      Time: ${new Date(point.recordedAt).toLocaleString()}
    `);

    marker.addTo(this.markerLayer);
  }

  private clearMapLayers(): void {
    if (this.map && this.routeLayer) {
      this.map.removeLayer(this.routeLayer);
      this.routeLayer = undefined;
    }

    this.markerLayer.clearLayers();
  }

  private escapeHtml(value: string): string {
    return value
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }
}
