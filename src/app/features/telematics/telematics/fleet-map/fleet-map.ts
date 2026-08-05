import {ActivatedRoute} from '@angular/router';
import { Subject, timer, takeUntil } from 'rxjs';

import {
  AfterViewInit,
  OnDestroy,
  Component,
  inject,
  signal
} from '@angular/core';

import * as L from 'leaflet';

import { TelematicsService } from '../../../../core/services/telematics.service';
import {
  FleetTelematicsLocation,
  LiveVehicleLocationEvent, TelematicsHistoryPoint,
  VehicleTrip
} from '../../../../shared/models/fleet-map.models';
import {FleetLiveLocationService} from '../../../../core/services/fleet-live-location.service';
import {MatButton} from '@angular/material/button';
import {DatePipe, DecimalPipe, NgIf} from '@angular/common';
import {LiveAlertEvent} from '../../../../shared/models/telematics.models';
import {FleetAlertLiveService} from '../../../../core/services/fleet-alert-live.service';

delete (L.Icon.Default.prototype as any)._getIconUrl;

L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    'assets/leaflet/marker-icon-2x.png',
  iconUrl:
    'assets/leaflet/marker-icon.png',
  shadowUrl:
    'assets/leaflet/marker-shadow.png'
});

@Component({
  selector: 'app-fleet-map',
  standalone: true,
  templateUrl: './fleet-map.html',
  imports: [
    MatButton,
    DatePipe,
    DecimalPipe
  ],
  styleUrl: './fleet-map.css'
})
export class FleetMapComponent implements AfterViewInit {

  private readonly telematicsService = inject(TelematicsService);
  private readonly route = inject(ActivatedRoute);
  private readonly destroy$ = new Subject<void>();
  private markersLayer = L.layerGroup();
  private readonly liveLocationService = inject(FleetLiveLocationService);
  private routeLayer = L.layerGroup();
  private readonly alertLiveService = inject(FleetAlertLiveService)

  private playbackMarker?: L.Marker;
  private playbackTimer?: ReturnType<typeof setInterval>;
  private playbackPoints: TelematicsHistoryPoint[] = [];
  private playbackIndex = 0;

  map!: L.Map;

  locations = signal<FleetTelematicsLocation[]>([]);

  fleetId = '';

  historyStart = signal<string>(this.toDatetimeLocal(new Date(Date.now() - 24 * 60 * 60 * 1000)));
  historyEnd = signal<string>(this.toDatetimeLocal(new Date()));

  trips = signal<VehicleTrip[]>([]);
  selectedVehicleId = signal<string | null>(null);
  selectedVehicle = signal<FleetTelematicsLocation | null>(null);
  selectedTrip = signal<VehicleTrip | null>(null);
  tripPage = signal(0);
  tripTotalPages = signal(0);

  alerts = signal<LiveAlertEvent[]>([]);

  ngAfterViewInit(): void {
    this.initializeMap();

    const fleetId = this.route.snapshot.paramMap.get('fleetId');

    if (fleetId) {
      this.fleetId = fleetId;

      timer(0, 30000)
        .pipe(takeUntil(this.destroy$))
        .subscribe(() => this.loadFleet(this.fleetId));

      this.alertLiveService.connect(this.fleetId);

      this.alertLiveService
        .stream()
        .pipe(takeUntil(this.destroy$))
        .subscribe(alert => {

          console.log('Live alert received:', alert);

          this.alerts.update(current => [
            alert,
            ...current
          ].slice(0, 50));
        });
    }

    this.liveLocationService
      .connectToFleet(this.fleetId)
      .pipe(takeUntil(this.destroy$))
      .subscribe(event => this.updateLiveVehicle(event));
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadFleet(fleetId: string): void {
    this.fleetId = fleetId;

    this.telematicsService
      .getFleetLocations(fleetId)
      .subscribe(locations => {

        this.locations.set(locations);

        this.renderMarkers(locations);
      });
  }

  clearHistoryPoints(): void {
    this.routeLayer.clearLayers();
  }

  closeTripsPanel(): void {
    this.trips.set([]);
    this.selectedTrip.set(null);
    this.selectedVehicleId.set(null);
    this.stopTripPlayback();
    this.routeLayer.clearLayers();
  }

  clearLiveAlerts(): void {
    this.alerts.set([]);
  }

  private initializeMap(): void {
    this.map = L.map('fleet-map').setView([28.5383, -81.3792], 8);

    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19
    }).addTo(this.map);

    this.markersLayer.addTo(this.map);
    this.routeLayer.addTo(this.map);
  }

  showTrip(trip: VehicleTrip): void {
    this.selectedTrip.set(trip);
    const vehicleId = this.selectedVehicleId();
    const vehicle = this.selectedVehicle();

    if (!vehicleId) {
      return;
    }

    this.telematicsService
      .getVehicleHistory(
        vehicleId,
        trip.startTime,
        trip.endTime
      )
      .subscribe(points => {

        this.routeLayer.clearLayers();

        this.playbackPoints = points;
        this.playbackIndex = 0;

        points.forEach(point => {

          if (!point.latitude || !point.longitude) {
            return;
          }

          L.circleMarker(
            [point.latitude, point.longitude],
            {
              radius: 5,
              color: '#000000',
              fillColor: '#000000',
              fillOpacity: 0.9,
              weight: 1
            }
          )
            .bindPopup(`
              <strong>${vehicle?.label}</strong><br/>
              Plate: ${vehicle?.licensePlate ?? 'N/A'}<br/>
              Speed: ${point.speedMph ?? 0} mph<br/>
              Time: ${new Date(point.recordedAt).toLocaleString()}<br/>
              Lat: ${point.latitude}<br/>
              Lon: ${point.longitude}
           `)
            .addTo(this.routeLayer);
        });
      });
  }

  playTrip(): void {
    if (this.playbackPoints.length === 0) {
      return;
    }

    this.stopTripPlayback();

    this.playbackTimer = setInterval(() => {
      const point = this.playbackPoints[this.playbackIndex];

      if (!point || point.latitude === null || point.longitude === null) {
        this.stopTripPlayback();
        return;
      }

      const latLng: [number, number] = [point.latitude, point.longitude];

      if (!this.playbackMarker) {
        this.playbackMarker = L.marker(latLng, {
          icon: L.divIcon({
            className: 'playback-marker',
            html: `<span class="material-icons playback-icon">navigation</span>`,
            iconSize: [32, 32],
            iconAnchor: [16, 16]
          })
        }).addTo(this.routeLayer);
      } else {
        this.playbackMarker.setLatLng(latLng);
      }

      this.playbackMarker.bindPopup(`
      <strong>Playback</strong><br/>
      Speed: ${point.speedMph ?? 0} mph<br/>
      Time: ${new Date(point.recordedAt).toLocaleString()}
    `);

      this.playbackIndex++;

      if (this.playbackIndex >= this.playbackPoints.length) {
        this.stopTripPlayback();
      }
    }, 500);
  }

  stopTripPlayback(): void {
    if (this.playbackTimer) {
      clearInterval(this.playbackTimer);
      this.playbackTimer = undefined;
    }

    this.playbackIndex = 0;

    if (this.playbackMarker) {
      this.routeLayer.removeLayer(this.playbackMarker);
      this.playbackMarker = undefined;
    }
  }

  nextTripsPage(): void {
    if (this.tripPage() < this.tripTotalPages() - 1) {
      this.tripPage.update(p => p + 1);

      const vehicle = this.selectedVehicle();

      if (vehicle) {
        this.loadTrips(vehicle.vehicleId);
      }
    }
  }

  previousTripsPage(): void {
    if (this.tripPage() > 0) {
      this.tripPage.update(p => p - 1);

      const vehicle = this.selectedVehicle();

      if (vehicle) {
        this.loadTrips(vehicle.vehicleId);
      }
    }
  }

  private renderMarkers(locations: FleetTelematicsLocation[]): void {
    this.markersLayer.clearLayers();

    locations.forEach(location => {
      L.marker(
        [location.latitude, location.longitude],
        { icon: this.createVehicleIcon(location) }
      )
        .on('click', () => {
          this.selectedVehicle.set(location);
          this.selectedVehicleId.set(location.vehicleId);
          this.tripPage.set(0);
          this.loadTrips(location.vehicleId);
        })
        .bindPopup(`
        <strong>${location.label}</strong><br/>
        Status: ${location.status}<br/>
        Plate: ${location.licensePlate ?? 'N/A'}<br/>
        Speed: ${location.speedMph ?? 0} mph<br/>
        Fuel: ${location.fuelLevelPercent ?? 0}%<br/>
        Last Seen: ${new Date(location.recordedAt).toLocaleString()}
      `)
        .addTo(this.markersLayer);
    });

    if (locations.length > 0) {
      const bounds = L.latLngBounds(
        locations.map(location => [location.latitude, location.longitude])
      );

      this.map.fitBounds(bounds, { padding: [40, 40] });
    }
  }

  private getMarkerColor(location: FleetTelematicsLocation): string {

    if (location.checkEngine) {
      return '#dc2626';
    }

    if ((location.fuelLevelPercent ?? 100) < 15) {
      return '#f59e0b';
    }

    if ((location.speedMph ?? 0) > 0) {
      return '#2563eb';
    }

    if (location.status === 'OFFLINE') {
      return '#64748b';
    }

    if (location.status === 'STALE') {
      return '#f59e0b';
    }

    return '#64748b';
  }

  private createVehicleIcon(location: FleetTelematicsLocation): L.DivIcon {
    const color = this.getMarkerColor(location);
    const heading = location.headingDegrees ?? 0;

    return L.divIcon({
      className: 'vehicle-marker',
      html: `
      <span
        class="material-icons vehicle-icon"
        style="color:${color}; transform: rotate(${heading}deg);">
        navigation
      </span>
    `,
      iconSize: [28, 28],
      iconAnchor: [14, 14],
      popupAnchor: [0, -12]
    });
  }

  private updateLiveVehicle(event: LiveVehicleLocationEvent): void {
    const current = this.locations();

    const onlineStatus: FleetTelematicsLocation['status'] = 'ONLINE';

    const updated: FleetTelematicsLocation[] = current.some(location => location.vehicleId === event.vehicleId)
      ? current.map(location =>
        location.vehicleId === event.vehicleId
          ? {
            ...location,
            status: onlineStatus,
            label: event.vehicleName,
            licensePlate: event.licensePlate ?? location.licensePlate,
            latitude: event.latitude,
            longitude: event.longitude,
            speedMph: event.speedMph,
            engineTempF: event.engineTempF,
            batteryVoltage: event.batteryVoltage,
            odometerMiles: event.odometerMiles,
            headingDegrees: event.headingDegrees,
            fuelLevelPercent: event.fuelLevelPercent,
            checkEngine: event.checkEngine,
            recordedAt: event.recordedAt
          }
          : location
      )
      : [
        ...current,
        {
          vehicleId: event.vehicleId,
          status: onlineStatus,
          label: event.vehicleName,
          licensePlate: event.licensePlate ?? '',
          latitude: event.latitude,
          longitude: event.longitude,
          speedMph: event.speedMph,
          engineTempF: event.engineTempF,
          batteryVoltage: event.batteryVoltage,
          odometerMiles: event.odometerMiles,
          headingDegrees: event.headingDegrees,
          fuelLevelPercent: event.fuelLevelPercent,
          checkEngine: event.checkEngine,
          recordedAt: event.recordedAt
        }
      ];

    this.locations.set(updated);
    this.renderMarkers(updated);
  }

  private loadTrips(vehicleId: string): void {

    const start =
      this.toIsoFromDatetimeLocal(this.historyStart());

    const end =
      this.toIsoFromDatetimeLocal(this.historyEnd());

    this.telematicsService
      .getVehicleTrips(
        vehicleId,
        start,
        end,
        5,
        this.tripPage(),
        10
      )
      .subscribe({
        next: response => {
          console.log('Trips response:', response);

          this.trips.set(response.content ?? []);
          this.tripPage.set(response.page ?? 0);
          this.tripTotalPages.set(response.totalPages ?? 0);
        },
        error: err => {
          console.error('Unable to load trips', err);
        }
      });
  }

  loadToday(): void {
    const now = new Date();

    const start = new Date();
    start.setHours(0, 0, 0, 0);

    this.historyStart.set(this.toDatetimeLocal(start));
    this.historyEnd.set(this.toDatetimeLocal(now));
  }

  loadLast7Days(): void {
    const now = new Date();

    const start = new Date();
    start.setDate(start.getDate() - 7);

    this.historyStart.set(this.toDatetimeLocal(start));
    this.historyEnd.set(this.toDatetimeLocal(now));
  }

  loadLast30Days(): void {
    const now = new Date();

    const start = new Date();
    start.setDate(start.getDate() - 30);

    this.historyStart.set(this.toDatetimeLocal(start));
    this.historyEnd.set(this.toDatetimeLocal(now));
  }

  formatDuration(minutes: number): string {

    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;

    if (hours === 0) {
      return `${mins} min`;
    }

    return `${hours}h ${mins}m`;
  }

  private showVehicleHistory(vehicle: FleetTelematicsLocation): void {
    const start = this.toIsoFromDatetimeLocal(this.historyStart());
    const end = this.toIsoFromDatetimeLocal(this.historyEnd());

    this.telematicsService.getVehicleHistory(vehicle.vehicleId, start, end).subscribe(points => {
      this.routeLayer.clearLayers();

      const validPoints = points.filter(
        point => point.latitude !== null && point.longitude !== null
      );

      validPoints.forEach(point => {
        L.circleMarker([point.latitude!, point.longitude!], {
          radius: 5,
          color: '#000000',
          fillColor: '#000000',
          fillOpacity: 0.9,
          weight: 1
        })
          .bindPopup(`
            <strong>${vehicle.label}</strong><br/>
            Plate: ${vehicle.licensePlate ?? 'N/A'}<br/>
            Speed: ${point.speedMph ?? 0} mph<br/>
            Time: ${new Date(point.recordedAt).toLocaleString()}
        `)
          .addTo(this.routeLayer);
      });

      if (validPoints.length > 0) {
        const bounds = L.latLngBounds(
          validPoints.map(point => [point.latitude!, point.longitude!] as [number, number])
        );

        this.map.fitBounds(bounds, {
          padding: [40, 40]
        });
      }
    });
  }

  private toDatetimeLocal(date: Date): string {
    return date.toISOString().slice(0, 16);
  }

  private toIsoFromDatetimeLocal(value: string): string {
    return new Date(value).toISOString();
  }
}
