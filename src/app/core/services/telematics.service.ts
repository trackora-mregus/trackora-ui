import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';

import { environment } from '../../../environments/environment';
import {TelematicsDevice, TelematicsEvent} from '../../shared/models/telematics.models';
import {FleetTelematicsLocation, PageResponse, VehicleTrip} from '../../shared/models/fleet-map.models';
import { TelematicsHistoryPoint } from '../../shared/models/fleet-map.models';
import {Observable} from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class TelematicsService {
  constructor(private http: HttpClient) {}

  getLatestForVehicle(vehicleId: string) {
    return this.http.get<TelematicsEvent>(
      `${environment.apiBaseUrl}/vehicles/${vehicleId}/telematics/latest`
    );
  }

  createEvent(event: Partial<TelematicsEvent> & { vehicleId: string }) {
    return this.http.post<TelematicsEvent>(
      `${environment.apiBaseUrl}/telematics/events`,
      event
    );
  }

  getDevicesForVehicle(vehicleId: string) {
    return this.http.get<TelematicsDevice[]>(
      `${environment.apiBaseUrl}/vehicles/${vehicleId}/telematics/devices`
    );
  }

  getFleetLocations(fleetId: string) {
    return this.http.get<FleetTelematicsLocation[]>(
      `${environment.apiBaseUrl}/fleets/${fleetId}/telematics/latest`
    );
  }

  getVehicleHistory(vehicleId: string, start: string, end: string) {
    return this.http.get<TelematicsHistoryPoint[]>(
      `${environment.apiBaseUrl}/vehicles/${vehicleId}/telematics/history`,
      {
        params: {
          start,
          end
        }
      }
    );
  }

  getVehicleTrips(
    vehicleId: string,
    start: string,
    end: string,
    gapMinutes = 5,
    page = 0,
    size = 10
  ) {
    return this.http.get<PageResponse<VehicleTrip>>(
      `${environment.apiBaseUrl}/vehicles/${vehicleId}/telematics/trips`,
      {
        params: {
          start,
          end,
          gapMinutes,
          page,
          size
        }
      }
    );
  }

  getCurrentVehicleState(
    vehicleId: string
  ): Observable<FleetTelematicsLocation> {
    return this.http.get<FleetTelematicsLocation>(
      `${environment.apiBaseUrl}/vehicles/${vehicleId}/telematics/current`
    );
  }
}
