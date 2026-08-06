import { Injectable } from '@angular/core';
import { Client, IMessage } from '@stomp/stompjs';
import {
  Observable,
  Subject,
  share
} from 'rxjs';

import { environment } from '../../../environments/environment';
import {
  LiveVehicleLocationEvent
} from '../../shared/models/fleet-map.models';

@Injectable({
  providedIn: 'root'
})
export class FleetLiveLocationService {

  private readonly fleetStreams = new Map<
    string,
    Observable<LiveVehicleLocationEvent>
  >();

  connectToFleet(
    fleetId: string
  ): Observable<LiveVehicleLocationEvent> {

    const existingStream = this.fleetStreams.get(fleetId);

    if (existingStream) {
      return existingStream;
    }

    const stream = new Observable<LiveVehicleLocationEvent>(
      observer => {
        const client = new Client({
          brokerURL: this.getWebSocketUrl(),
          reconnectDelay: 5000,

          debug: message => {
            if (!environment.production) {
              console.log('[STOMP]', message);
            }
          }
        });

        client.onConnect = () => {
          console.log(
            `WebSocket connected for fleet ${fleetId}`
          );

          client.subscribe(
            `/topic/fleets/${fleetId}`,
            (message: IMessage) => {
              try {
                const event =
                  JSON.parse(
                    message.body
                  ) as LiveVehicleLocationEvent;

                observer.next(event);
              } catch (error) {
                console.error(
                  'Unable to parse live vehicle event',
                  error
                );
              }
            }
          );
        };

        client.onStompError = frame => {
          console.error(
            'STOMP broker error',
            frame.headers['message'],
            frame.body
          );

          observer.error(frame);
        };

        client.onWebSocketError = error => {
          console.error(
            'WebSocket connection error',
            error
          );
        };

        client.activate();

        return () => {
          void client.deactivate();

          console.log(
            `WebSocket disconnected for fleet ${fleetId}`
          );
        };
      }
    ).pipe(
      share({
        connector: () =>
          new Subject<LiveVehicleLocationEvent>(),

        resetOnError: true,
        resetOnComplete: true,
        resetOnRefCountZero: true
      })
    );

    this.fleetStreams.set(fleetId, stream);

    return stream;
  }

  private getWebSocketUrl(): string {
    return environment.wsBaseUrl;
  }
}
