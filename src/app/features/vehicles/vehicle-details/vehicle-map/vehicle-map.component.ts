import {
  AfterViewInit,
  Component,
  DestroyRef,
  ElementRef,
  inject,
  input, OnDestroy,
  signal,
  viewChild
} from '@angular/core';
import {DatePipe, DecimalPipe} from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import * as L from 'leaflet';

import { TelematicsService } from '../../../../core/services/telematics.service';
import {
  LiveVehicleLocationEvent,
  TelematicsHistoryPoint,
  FleetTelematicsLocation,
  VehicleTrip
} from '../../../../shared/models/fleet-map.models';
import { FleetLiveLocationService } from '../../../../core/services/fleet-live-location.service';
import {MatTooltip} from '@angular/material/tooltip';

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
    MatProgressSpinnerModule,
    DecimalPipe,
    MatTooltip
  ],
  templateUrl: './vehicle-map.component.html',
  styleUrl: './vehicle-map.component.css'
})
export class VehicleMapComponent implements AfterViewInit, OnDestroy {

  readonly mapMode = signal<'LIVE' | 'HISTORY'>('LIVE');
  readonly trips = signal<VehicleTrip[]>([]);
  readonly selectedTrip = signal<VehicleTrip | null>(null);
  readonly tripsLoading = signal(false);

  readonly tripPage = signal(0);
  readonly tripTotalPages = signal(0);

  readonly playbackRunning = signal(false);
  readonly playbackSpeed = signal(1);

  private resizeObserver?: ResizeObserver;
  private readonly tripLayer = L.layerGroup();

  private playbackMarker?: L.Marker;
  private playbackTimer?: ReturnType<typeof setInterval>;
  private playbackPoints: TelematicsHistoryPoint[] = [];
  private playbackIndex = 0;

  private readonly fleetLiveLocationService = inject(FleetLiveLocationService);

  readonly fleetId = input.required<string>();
  readonly vehicleId = input.required<string>();
  readonly vehicleName = input<string>('Vehicle');
  readonly licensePlate = input<string>('');

  private readonly telematicsService = inject(TelematicsService);
  private readonly destroyRef = inject(DestroyRef);

  private readonly mapContainer =
    viewChild.required<ElementRef<HTMLDivElement>>('mapContainer');

  readonly currentState = signal<FleetTelematicsLocation | null>(null);
  readonly loading = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly historyPoints = signal<TelematicsHistoryPoint[]>([]);
  readonly selectedRange = signal<'TODAY' | '7_DAYS' | '30_DAYS'>('TODAY');

  readonly autoFollow = signal(true);

  private map?: L.Map;
  // private routeLayer?: L.Polyline;
  private markerLayer = L.layerGroup();
  private liveMarker?: L.Marker;
  private readonly liveVehicleLayer = L.layerGroup();

  ngAfterViewInit(): void {
    this.initializeMap();
    this.observeMapSize();

    this.loadCurrentState();
    this.loadRange('TODAY');
    this.subscribeToLiveUpdates();

    setTimeout(() => {
      this.map?.invalidateSize(true);
    }, 300);
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();

    if (this.playbackTimer) {
      clearInterval(this.playbackTimer);
    }

    this.map?.remove();
  }

  private refreshMapSize(): void {
    setTimeout(() => {
      this.map?.invalidateSize(true);
    }, 100);
  }

  showLiveMode(): void {
    this.mapMode.set('LIVE');

    this.stopTripPlayback(true);
    this.selectedTrip.set(null);
    this.tripLayer.clearLayers();

    const state = this.currentState();

    setTimeout(() => {
      this.map?.invalidateSize(true);

      if (
        state?.latitude != null &&
        state.longitude != null
      ) {
        this.renderCurrentMarker(state);
      }
    }, 100);
  }

  showHistoryMode(): void {
    this.mapMode.set('HISTORY');
    this.stopTripPlayback(true);
    this.tripLayer.clearLayers();
    this.tripPage.set(0);
    this.reloadTrips();

    this.refreshMapSize();
  }

  formatDuration(minutes: number): string {

    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;

    if (hours === 0) {
      return `${mins} min`;
    }

    return `${hours}h ${mins}m`;
  }

  loadRange(
    range: 'TODAY' | '7_DAYS' | '30_DAYS'
  ): void {
    this.selectedRange.set(range);
    this.tripPage.set(0);
    this.selectedTrip.set(null);

    this.stopTripPlayback(true);
    this.tripLayer.clearLayers();

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

    this.loadTrips(start, end);
  }

  refresh(): void {
    this.loadRange(this.selectedRange());
  }

  toggleAutoFollow(): void {
    const enabled = !this.autoFollow();

    this.autoFollow.set(enabled);

    if (enabled) {
      const state = this.currentState();

      if (
        state?.latitude != null &&
        state.longitude != null
      ) {
        this.map?.panTo(
          [state.latitude, state.longitude],
          {
            animate: true,
            duration: 0.6
          }
        );
      }
    }
  }

  private initializeMap(): void {
    this.map = L.map(this.mapContainer().nativeElement, {
      center: [29.1311, -82.1941],
      zoom: 13
    });

    L.tileLayer(
      'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap contributors'
      }
    ).addTo(this.map);

    this.liveVehicleLayer.addTo(this.map);
    this.tripLayer.addTo(this.map);
  }

  private escapeHtml(value: string): string {
    return value
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  private subscribeToLiveUpdates(): void {
    this.fleetLiveLocationService
      .connectToFleet(this.fleetId())
      .pipe(
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: event => {
          if (
            event.vehicleId !== this.vehicleId()
          ) {
            return;
          }

          this.updateLiveVehicle(event);
        },

        error: error => {
          console.error(
            'Vehicle live tracking failed',
            error
          );
        }
      });
  }

  private updateLiveVehicle(
    event: LiveVehicleLocationEvent
  ): void {
    if (
      !this.map ||
      event.latitude == null ||
      event.longitude == null
    ) {
      return;
    }

    const position: L.LatLngExpression = [
      event.latitude,
      event.longitude
    ];

    const popupContent = `
    <strong>${this.escapeHtml(event.vehicleName)}</strong>
    <br>${this.escapeHtml(event.licensePlate ?? 'unknown license plate')}<br>
    Speed: ${event.speedMph ?? 0} mph<br>
    Fuel: ${event.fuelLevelPercent ?? '—'}%<br>
    Last reported:
    ${new Date(event.recordedAt).toLocaleString()}
  `;

    if (!this.liveMarker) {
      this.liveMarker = L.marker(position)
        .addTo(this.map)
        .bindPopup(popupContent);

      return;
    }

    this.liveMarker.setLatLng(position);
    this.liveMarker.setPopupContent(
      popupContent
    );

    if (
      this.mapMode() === 'LIVE' &&
      this.autoFollow()
    ) {
      this.map.panTo(position, {
        animate: true,
        duration: 0.6
      });
    }
  }

  private loadCurrentState(): void {
    this.telematicsService
      .getCurrentVehicleState(this.vehicleId())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: state => {
          this.currentState.set(state);
          this.renderCurrentMarker(state);
        },
        error: error => {
          console.error(
            'Unable to load current vehicle state',
            error
          );
        }
      });
  }

  private renderCurrentMarker(
    state: FleetTelematicsLocation
  ): void {
    if (
      !this.map ||
      state.latitude == null ||
      state.longitude == null
    ) {
      return;
    }

    const position: L.LatLngExpression = [
      state.latitude,
      state.longitude
    ];

    const icon = this.createVehicleIcon(state);

    if (!this.liveMarker) {
      this.liveMarker = L.marker(position, { icon })
        .addTo(this.liveVehicleLayer)
        .bindPopup(this.buildVehiclePopup(state));
    } else {
      this.liveMarker.setLatLng(position);
      this.liveMarker.setIcon(icon);
      this.liveMarker.setPopupContent(
        this.buildVehiclePopup(state)
      );
    }

    this.map.setView(position, 15);
  }

  private buildVehiclePopup(
    state: FleetTelematicsLocation
  ): string {
    return `
    <strong>${this.escapeHtml(state.label)}</strong><br>
    ${this.escapeHtml(state.licensePlate)}<br>
    Status: ${this.escapeHtml(state.status)}<br>
    Speed: ${state.speedMph ?? 0} mph<br>
    Fuel: ${state.fuelLevelPercent ?? '—'}%<br>
    Battery: ${
      state.batteryVoltage != null
        ? `${state.batteryVoltage} V`
        : '—'
    }<br>
    Engine: ${
      state.engineTempF != null
        ? `${state.engineTempF} °F`
        : '—'
    }<br>
    Odometer: ${
      state.odometerMiles != null
        ? `${state.odometerMiles} mi`
        : '—'
    }<br>
    Last reported:
    ${new Date(state.recordedAt).toLocaleString()}
  `;
  }

  private loadTrips(start: Date, end: Date): void {
    this.tripsLoading.set(true);

    this.telematicsService
      .getVehicleTrips(
        this.vehicleId(),
        start.toISOString(),
        end.toISOString(),
        5,
        this.tripPage(),
        10
      )
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: response => {
          this.trips.set(response.content ?? []);
          this.tripPage.set(response.page ?? 0);
          this.tripTotalPages.set(response.totalPages ?? 0);
          this.tripsLoading.set(false);
        },
        error: error => {
          console.error('Unable to load vehicle trips', error);
          this.trips.set([]);
          this.tripsLoading.set(false);
        }
      });
  }

  private reloadTrips(): void {
    const end = new Date();
    const start = new Date();

    switch (this.selectedRange()) {
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

    this.loadTrips(start, end);
  }

  showTrip(trip: VehicleTrip): void {
    this.stopTripPlayback();
    this.selectedTrip.set(trip);
    this.tripLayer.clearLayers();

    this.telematicsService
      .getVehicleHistory(
        this.vehicleId(),
        trip.startTime,
        trip.endTime
      )
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: points => {
          const validPoints = points.filter(
            point =>
              point.latitude !== null &&
              point.longitude !== null
          );

          this.playbackPoints = validPoints;
          this.playbackIndex = 0;

          if (validPoints.length === 0 || !this.map) {
            return;
          }

          const coordinates: L.LatLngExpression[] =
            validPoints.map(point => [
              point.latitude!,
              point.longitude!
            ]);

          const route = L.polyline(coordinates, {
            color: '#2563eb',
            weight: 5,
            opacity: 0.85
          }).addTo(this.tripLayer);

          const first = validPoints[0];
          const last = validPoints[validPoints.length - 1];

          L.circleMarker(
            [first.latitude!, first.longitude!],
            {
              radius: 8,
              color: '#16a34a',
              fillColor: '#16a34a',
              fillOpacity: 1
            }
          )
            .bindPopup('Trip start')
            .addTo(this.tripLayer);

          L.circleMarker(
            [last.latitude!, last.longitude!],
            {
              radius: 8,
              color: '#dc2626',
              fillColor: '#dc2626',
              fillOpacity: 1
            }
          )
            .bindPopup('Trip end')
            .addTo(this.tripLayer);

          this.map.fitBounds(route.getBounds(), {
            padding: [35, 35],
            maxZoom: 16
          });
        },
        error: error => {
          console.error('Unable to load trip history', error);
        }
      });
  }

  playTrip(): void {
    if (
      this.playbackPoints.length === 0 ||
      this.playbackRunning()
    ) {
      return;
    }

    this.playbackRunning.set(true);

    const intervalMs = 500 / this.playbackSpeed();

    this.playbackTimer = setInterval(() => {
      const point = this.playbackPoints[this.playbackIndex];

      if (
        !point ||
        point.latitude === null ||
        point.longitude === null
      ) {
        this.stopTripPlayback(false);
        return;
      }

      const position: L.LatLngExpression = [
        point.latitude,
        point.longitude
      ];

      if (!this.playbackMarker) {
        this.playbackMarker = L.marker(position, {
          icon: L.divIcon({
            className: 'playback-marker',
            html: `
            <span
              class="material-icons playback-icon"
              style="transform: rotate(${
              this.currentState()?.headingDegrees ?? 0
            }deg)"
            >
              navigation
            </span>
          `,
            iconSize: [32, 32],
            iconAnchor: [16, 16]
          })
        }).addTo(this.tripLayer);
      } else {
        this.playbackMarker.setLatLng(position);
      }

      this.playbackMarker.setPopupContent(`
      <strong>Trip playback</strong><br>
      Speed: ${point.speedMph ?? 0} mph<br>
      Time: ${new Date(point.recordedAt).toLocaleString()}
    `);

      if (this.autoFollow()) {
        this.map?.panTo(position, {
          animate: true,
          duration: 0.4
        });
      }

      this.playbackIndex++;

      if (this.playbackIndex >= this.playbackPoints.length) {
        this.stopTripPlayback(false);
      }
    }, intervalMs);
  }

  pauseTripPlayback(): void {
    if (this.playbackTimer) {
      clearInterval(this.playbackTimer);
      this.playbackTimer = undefined;
    }

    this.playbackRunning.set(false);
  }

  stopTripPlayback(reset = true): void {
    this.pauseTripPlayback();

    if (reset) {
      this.playbackIndex = 0;

      if (this.playbackMarker) {
        this.tripLayer.removeLayer(this.playbackMarker);
        this.playbackMarker = undefined;
      }
    }
  }

  restartTripPlayback(): void {
    this.stopTripPlayback(true);
    this.playTrip();
  }

  setPlaybackSpeed(speed: number): void {
    const wasRunning = this.playbackRunning();

    this.pauseTripPlayback();
    this.playbackSpeed.set(speed);

    if (wasRunning) {
      this.playTrip();
    }
  }

  previousTripsPage(): void {
    if (this.tripPage() === 0) {
      return;
    }

    this.tripPage.update(page => page - 1);
    this.reloadTrips();
  }

  nextTripsPage(): void {
    if (this.tripPage() >= this.tripTotalPages() - 1) {
      return;
    }

    this.tripPage.update(page => page + 1);
    this.reloadTrips();
  }

  private observeMapSize(): void {
    const element = this.mapContainer().nativeElement;

    this.resizeObserver = new ResizeObserver(() => {
      requestAnimationFrame(() => {
        this.map?.invalidateSize(false);
      });
    });

    this.resizeObserver.observe(element);
  }

  private createVehicleIcon(
    state: FleetTelematicsLocation
  ): L.DivIcon {
    const heading = state.headingDegrees ?? 0;

    const color =
      state.checkEngine
        ? '#dc2626'
        : state.status === 'OFFLINE'
          ? '#64748b'
          : '#2563eb';

    return L.divIcon({
      className: 'vehicle-map-marker',
      html: `
      <span
        class="material-icons vehicle-map-icon"
        style="
          color: ${color};
          transform: rotate(${heading}deg);
        "
      >
        navigation
      </span>
    `,
      iconSize: [34, 34],
      iconAnchor: [17, 17],
      popupAnchor: [0, -14]
    });
  }
}
