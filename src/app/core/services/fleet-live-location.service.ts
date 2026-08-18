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

  private readonly streams = new Map<
    string,
    Observable<LiveVehicleLocationEvent>
  >();

  connectToFleet(
    fleetId: string
  ): Observable<LiveVehicleLocationEvent> {

    const existing = this.streams.get(fleetId);

    if (existing) {
      return existing;
    }

    const stream = new Observable<LiveVehicleLocationEvent>(
      observer => {

        const client = new Client({
          brokerURL: environment.wsBaseUrl,
          reconnectDelay: 5000,

          debug: message => {
            if (!environment.production) {
              console.log('[STOMP]', message);
            }
          }
        });

        client.onConnect = () => {
          console.log(
            `WebSocket connected to fleet ${fleetId}`
          );

          client.subscribe(
            `/topic/fleets/${fleetId}`,
            (message: IMessage) => {
              try {
                const event =
                  JSON.parse(
                    message.body
                  ) as LiveVehicleLocationEvent;

                console.log(
                  'Live vehicle event:',
                  event
                );

                observer.next(event);

              } catch (error) {
                console.error(
                  'Unable to parse live location event',
                  error
                );
              }
            }
          );
        };

        client.onStompError = frame => {
          console.error(
            'STOMP error:',
            frame.headers['message'],
            frame.body
          );
        };

        client.onWebSocketError = error => {
          console.error(
            'WebSocket error:',
            error
          );
        };

        client.activate();

        return () => {
          void client.deactivate();
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

    this.streams.set(fleetId, stream);

    return stream;
  }
}
