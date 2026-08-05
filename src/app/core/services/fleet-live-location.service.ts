import { Injectable } from '@angular/core';
import { Client, IMessage } from '@stomp/stompjs';
import {Observable, Subject} from 'rxjs';

import { environment } from '../../../environments/environment';
import { LiveVehicleLocationEvent } from '../../shared/models/fleet-map.models';

@Injectable({
  providedIn: 'root'
})
export class FleetLiveLocationService {

  private readonly locationSubject =
    new Subject<LiveVehicleLocationEvent>();

  readonly locationUpdates$ =
    this.locationSubject.asObservable();

  private client?: Client;

  connectToFleet(fleetId: string): Observable<LiveVehicleLocationEvent> {
    return new Observable(observer => {
      const wsUrl = this.getWebSocketUrl();

      this.client = new Client({
        brokerURL: wsUrl,
        reconnectDelay: 5000,
        debug: message => console.log('[STOMP]', message)
      });

      this.client.onConnect = () => {
        console.log('WebSocket connected');

        this.client?.subscribe(`/topic/fleets/${fleetId}`, (message: IMessage) => {
          observer.next(JSON.parse(message.body));
        });
      };

      this.client.onStompError = frame => {
        console.error('STOMP error', frame);
        observer.error(frame);
      };

      this.client.onWebSocketError = error => {
        console.error('WebSocket error', error);
      };

      this.client.activate();

      return () => {
        this.client?.deactivate();
      };
    });
  }

  private getWebSocketUrl(): string {
    return environment.wsBaseUrl;
  }
}
