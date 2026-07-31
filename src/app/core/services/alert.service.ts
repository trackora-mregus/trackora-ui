import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { Alert } from '../../shared/models/alert.models';

@Injectable({
  providedIn: 'root'
})
export class AlertService {
  constructor(private http: HttpClient) {}

  getFleetAlerts(fleetId: string): Observable<Alert[]> {
    return this.http.get<Alert[]>(
      `${environment.apiBaseUrl}/fleets/${fleetId}/alerts`
    );
  }

  resolveAlert(alertId: string): Observable<Alert> {
    return this.http.put<Alert>(
      `${environment.apiBaseUrl}/alerts/${alertId}/resolve`,
      {}
    );
  }

  deleteAlert(alertId: string): Observable<void> {
    return this.http.delete<void>(
      `${environment.apiBaseUrl}/alerts/${alertId}`
    );
  }
}
