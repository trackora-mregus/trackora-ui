# Research: Reliable Vehicle Live Updates

## Decision 1: Preserve the existing REST-first synchronization model

**Decision**: Continue loading `GET /vehicles/{vehicleId}/telematics/current` when the view opens and merge subsequent `/topic/fleets/{fleetId}` events into that state. Refresh/reopen repeats the REST load.

**Rationale**: This matches the current backend contracts and constitution. It gives an immediate authoritative baseline and allows recovery after missed live events.

**Alternatives considered**:

- WebSocket-only initialization: rejected because a page could remain empty until the next packet and cannot recover missed state reliably.
- Periodic polling as the main live mechanism: rejected because it duplicates the established live stream and changes scope.

## Decision 2: Use a typed per-field freshness accumulator

**Decision**: Merge each non-null event field only when its `recordedAt` is newer than the stored freshness for that field. Seed all fields supplied by REST with the REST state's `recordedAt`. Null or omitted fields do not modify values or freshness; zero and false do. At equal report times, fill unknown fields but retain conflicting known values. Represent unavailable merged coordinates as null so telemetry can remain visible without a fabricated position.

**Rationale**: A single timestamp on the merged object cannot correctly resolve partial and out-of-order packets. Per-field freshness implements the clarified requirement without conflating raw packets and current state.

**Alternatives considered**:

- Replace the entire state for every event: rejected because partial packets erase known values.
- Reject or accept whole packets by one current-state timestamp: rejected because an older partial packet may contain a field whose last known value is older, while another field is already newer.
- Arrival-order wins: rejected by clarification because delayed REST responses or packets can regress state.

## Decision 3: Separate ingestion, rendering, and viewport effects

**Decision**: Every matching event advances retained live state, but marker rendering and panning are guarded by Live mode. History/replay layers remain untouched. Returning to Live renders retained state and centers once; later panning follows the auto-follow preference.

**Rationale**: Current code renders the live marker before checking mode, coupling state updates to map effects. Separating these responsibilities satisfies history isolation and viewport rules while retaining live progress in the background.

**Alternatives considered**:

- Stop consuming events in History mode: rejected because returning to Live would show stale state until another event or reload.
- Allow marker updates but suppress only panning: rejected because the specification says live updates must not interfere with historical presentation.

## Decision 4: Keep the shared STOMP service contract and verify its lifecycle

**Decision**: Retain the root-provided `FleetLiveLocationService`, its fleet-keyed Observable cache, RxJS multicast sharing, five-second reconnect configuration, and `connectToFleet(fleetId)` API. Add lifecycle tests and make only the smallest correction if tests expose consumer interference.

**Rationale**: The current `share` configuration already supports overlapping subscribers and final-subscriber teardown. Replacing it would risk Fleet Map regression and violate the preference for existing infrastructure.

**Alternatives considered**:

- One STOMP client per component: rejected because it duplicates logical subscriptions and allows consumers to diverge.
- A new global state framework: rejected as unnecessary architectural complexity.
- Convert the service to emit merged current-state objects: rejected because it would change the Fleet Map contract and conflate packets with state.

## Decision 5: Test state behavior separately from Leaflet effects

**Decision**: Put merge/order/null/zero rules behind a pure typed function or accumulator with direct Vitest coverage. In component tests, mock REST, the live Observable, and Leaflet effects to assert filtering, modes, auto-follow, telemetry, and race behavior. Test the service with a mocked STOMP client.

**Rationale**: Pure tests precisely cover the regression-prone transformation, while component and service tests verify integration boundaries without real network or tiles.

**Alternatives considered**:

- Browser-only manual testing: rejected because it does not provide repeatable regression protection.
- End-to-end tests only: rejected because setup is heavier and failure diagnosis is less precise.

## Decision 6: No backend or dependency changes

**Decision**: Use the existing current-state endpoint and live event topic. Do not add packages, endpoints, persistence, or reconnect policy changes.

**Rationale**: Available contracts already contain vehicle identity, telemetry, and report time. The defect is in frontend merging and side-effect control.

**Alternatives considered**:

- Backend snapshot push on subscription: rejected because it expands scope and duplicates REST recovery.
- New client-side persistence: rejected because REST is authoritative and browser persistence could surface stale state.
