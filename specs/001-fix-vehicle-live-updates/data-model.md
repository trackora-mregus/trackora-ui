# Data Model: Reliable Vehicle Live Updates

## 1. LiveVehicleLocationEvent

An incremental fleet-stream packet for one vehicle. It remains distinct from merged current state.

| Field | Type | Merge rule |
|---|---|---|
| `vehicleId` | string, required | Must equal the displayed vehicle before any state change. |
| `fleetId` | string, required | Identifies the logical stream; does not authorize access. |
| `recordedAt` | ISO-8601 string, required | Supplies freshness for every non-null field in this packet. Invalid timestamps make the packet unusable. |
| `vehicleName` | string, optional/null | Preserve known label when absent/null; otherwise merge by freshness. |
| `licensePlate` | string, optional/null | Preserve known plate when absent/null; otherwise merge by freshness. |
| `latitude`, `longitude` | number, optional/null | Merge independently by freshness; a marker position is renderable only when both merged coordinates are known. Zero is valid. |
| `speedMph` | number, optional/null | Preserve on absent/null; zero is valid. |
| `headingDegrees` | number, optional/null | Preserve on absent/null; zero is valid. |
| `fuelLevelPercent` | number, optional/null | Preserve on absent/null; zero is valid. |
| `batteryVoltage` | number, optional/null | Preserve on absent/null; zero is valid. |
| `engineTempF` | number, optional/null | Preserve on absent/null; zero is valid. |
| `odometerMiles` | number, optional/null | Preserve on absent/null; zero is valid. |
| `checkEngine` | boolean, optional/null | Preserve on absent/null; false is valid. |

## 2. FleetTelematicsLocation

The latest merged display state for a vehicle. Existing fields remain: identity, online/stale/offline status, label, plate, coordinates, telemetry, heading, check-engine status, and `recordedAt`. Coordinate types become nullable so the model can retain real telemetry without inventing a position.

| Field | Type | Rule |
|---|---|---|
| `latitude`, `longitude` | `number | null` | Null means no position is known; zero is valid. A marker is renderable only when both are non-null. |
| Telemetry fields | Existing nullable scalar types | Known values remain available even when either coordinate is null. |

Validation and invariants:

- It is never created by casting a raw live event.
- Unknown nullable telemetry remains null until REST or a valid event supplies it.
- A live event can update telemetry without coordinates.
- The displayed marker requires both latitude and longitude to be non-null; current state may retain telemetry with either coordinate null.
- A matching accepted live packet may set status to `ONLINE`; REST retains its authoritative status.
- `recordedAt` represents the newest accepted report time across the merged state.

## 3. VehicleLiveStateAccumulator

Internal typed state used to resolve partial and out-of-order inputs.

| Field | Meaning |
|---|---|
| `state` | Current merged `FleetTelematicsLocation` or null before any usable source. |
| `fieldRecordedAt` | Timestamp map keyed by every mergeable current-state field. |
| `source` | Optional source metadata (`REST` or `LIVE`) for diagnostics/tests; it does not override report-time ordering. |

Merge invariants:

1. Vehicle identity cannot change after initialization.
2. Only non-null, non-undefined incoming values are candidates.
3. A candidate replaces a known field only when its report time is newer.
4. With equal report times, an unknown field may be filled, but a conflicting known value is retained to avoid arrival-order regression.
5. Invalid report times do not mutate the accumulator.
6. Merge returns a new accumulator/state object; previous objects are not mutated.

## 4. MapPresentationState

Existing component-owned state controlling presentation.

| Field | Values | Effect |
|---|---|---|
| `mapMode` | `LIVE`, `HISTORY` | Only Live mode renders retained live-state changes. |
| `autoFollow` | boolean | In Live mode, true pans after a coordinate change; false leaves viewport untouched. |
| `selectedTrip` | trip/null | Live ingestion never clears or replaces it. |
| `playbackRunning` | boolean | Live ingestion never pauses, restarts, or advances it. |

## State Transitions

```text
View opens
  -> subscribe to fleet stream
  -> request authoritative current state
  -> merge whichever inputs arrive using per-field report times
  -> render latest state in Live mode

Live -> History
  -> retain and merge matching live inputs internally
  -> suppress live marker and viewport side effects
  -> preserve trip selection/replay state

History -> Live
  -> render retained latest live state
  -> center once on latest valid position
  -> apply auto-follow preference to subsequent coordinate updates

Temporary disconnect -> reconnect
  -> existing stream reconnects/resubscribes
  -> later packets continue through the same merge rules

Refresh/reopen
  -> discard view-local accumulator
  -> establish a new authoritative REST baseline
```
