import { LOCAL_FAILURE_FEEDBACK } from '../http/http-failure';
import { Injectable } from '@angular/core';
import { HttpClient, HttpContext } from '@angular/common/http';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { VehicleDocument } from '../../shared/models/vehicle-document.models';

@Injectable({
  providedIn: 'root',
})
export class VehicleDocumentService {
  constructor(private http: HttpClient) {}

  getVehicleDocuments(vehicleId: string): Observable<VehicleDocument[]> {
    return this.http.get<VehicleDocument[]>(
      `${environment.apiBaseUrl}/vehicles/${vehicleId}/documents`,
    );
  }

  uploadDocument(
    vehicleId: string,
    file: File,
    documentType?: string,
  ): Observable<VehicleDocument> {
    const formData = new FormData();

    formData.append('file', file);

    if (documentType) {
      formData.append('documentType', documentType);
    }

    return this.http.post<VehicleDocument>(
      `${environment.apiBaseUrl}/vehicles/${vehicleId}/documents`,
      formData,
      { context: new HttpContext().set(LOCAL_FAILURE_FEEDBACK, true) },
    );
  }

  downloadDocument(documentId: string) {
    return this.http.get(`${environment.apiBaseUrl}/vehicle-documents/${documentId}/download`, {
      responseType: 'blob',
      observe: 'response',
    });
  }

  deleteDocument(documentId: string): Observable<void> {
    return this.http.delete<void>(`${environment.apiBaseUrl}/vehicle-documents/${documentId}`);
  }

  getMaintenanceDocuments(maintenanceId: string) {
    return this.http.get<VehicleDocument[]>(
      `${environment.apiBaseUrl}/maintenance/${maintenanceId}/documents`,
    );
  }

  uploadMaintenanceDocument(maintenanceId: string, file: File, documentType?: string) {
    const formData = new FormData();

    formData.append('file', file);

    if (documentType) {
      formData.append('documentType', documentType);
    }

    return this.http.post<VehicleDocument>(
      `${environment.apiBaseUrl}/maintenance/${maintenanceId}/documents`,
      formData,
      { context: new HttpContext().set(LOCAL_FAILURE_FEEDBACK, true) },
    );
  }
}
