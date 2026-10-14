# Contract: Vehicle Details Live-State Consumption

This is an internal frontend behavior contract. It documents existing backend interfaces and consumer guarantees; it does not request backend changes.

## Authoritative input

- Request: `GET /vehicles/{vehicleId}/telematics/current`
- Response model: `FleetTelematicsLocation`, whose latitude and longitude are independently nullable when no current position is known
- Used on: initial open, refresh, and reopen
- Guarantee: establishes or merges authoritative current state without overwriting fields already known from a newer report time

## Incremental input

- Subscription: `/topic/fleets/{fleetId}`
- Packet model: `LiveVehicleLocationEvent`
- Delivery: shared by concurrent consumers through `FleetLiveLocationService.connectToFleet(fleetId)`
- Recovery: existing STOMP reconnect and resubscription behavior

## Consumer guarantees

1. A consumer applies only packets whose `vehicleId` equals its displayed vehicle.
2. Null or omitted fields preserve prior values; zero and false are accepted values.
3. Each supplied field is ordered by `recordedAt`, not arrival time.
4. A packet without coordinates may update telemetry.
5. Marker movement requires a valid merged coordinate pair.
6. In History mode, packets may advance retained state but cannot alter map layers, playback, trip selection, or viewport.
7. In Live mode, marker/telemetry updates render within one second measured from delivery to the view's live-update subscriber until both reflect merged state; network transit is excluded and viewport movement additionally requires auto-follow.
8. Returning to Live renders retained state and centers once on its latest valid position.
9. One consumer unsubscribing cannot end updates for another active consumer of the same fleet stream.
10. A malformed packet is reported diagnostically, does not mutate state, and does not terminate later valid packet processing.

## Equal-time conflict rule

When an incoming value and a known value have the same valid report time, the incoming value may fill an unknown field but does not replace a conflicting known value. This removes arrival order as a tie-breaker and keeps results deterministic.

## Compatibility boundary

- `FleetLiveLocationService.connectToFleet(fleetId)` continues returning raw `LiveVehicleLocationEvent` packets.
- Fleet Map remains a consumer of the same event stream. Complete-event output remains unchanged; partial null/omitted telemetry preserves its known values.
- No topic, endpoint, retry interval, authentication behavior, or backend field name changes.
