# Quickstart: Validate Reliable Vehicle Live Updates

## Prerequisites

- Node.js and npm compatible with the repository lockfile
- Dependencies installed with `npm ci`
- Backend REST and STOMP services available for manual validation
- A fleet containing at least one vehicle with current state and live telemetry

## Automated validation

Baseline on 2026-09-25: the Angular test build was blocked before executing tests by stale class imports in `activity.spec.ts`, `forgot-password.component.spec.ts`, and `fleet-map.spec.ts`. The feature implementation corrects the Fleet Map import; the two unrelated stale imports must also be corrected before the constitution-required full-suite gate can pass.

Run focused regression tests after implementation:

```bash
npm test -- --watch=false --include='src/app/features/vehicles/vehicle-details/vehicle-map/vehicle-map.component.spec.ts'
npm test -- --watch=false --include='src/app/core/services/fleet-live-location.service.spec.ts'
npm test -- --watch=false --include='src/app/features/telematics/telematics/fleet-map/fleet-map.spec.ts'
```

Then run the full quality gates:

```bash
npm test -- --watch=false
npm run build
```

Expected: all affected and full tests pass, and the production build completes within configured budgets.

## Validation result (2026-09-25)

- Focused live-location regression tests: **PASS** — 4 files, 16 tests.
- Complete Angular test suite: **PASS** — 24 files, 36 tests.
- TypeScript application and test compilation: **PASS**.
- Production Angular build: **PASS** outside the filesystem sandbox; the initial bundle budget and existing Leaflet/STOMP CommonJS notices remain warnings only.
- Live-backend manual scenarios: **NOT RUN** — no backend was available on `localhost:8080`, so authoritative REST, authenticated navigation, and a real STOMP reconnect could not be exercised manually in this environment. Automated tests cover their frontend state, lifecycle, and recovery contracts.

## Manual validation scenarios

### 1. Authoritative load and live movement

1. Open a Vehicle Details Map in Live mode.
2. Confirm current marker and telemetry appear before another packet is required.
3. Send a matching update with new coordinates, heading, and telemetry.
4. Confirm the marker and all supplied values update within one second.
5. Send an update for another vehicle and confirm nothing changes.

### 2. Partial, null, zero, and out-of-order updates

1. Establish known values for all telemetry fields.
2. Send a newer packet containing only speed and confirm other values remain.
3. Send null telemetry values and confirm known values remain.
4. Send zero speed/heading/fuel and false check-engine values and confirm they display.
5. Send an older conflicting packet and confirm newer per-field values remain.
6. Delay the initial current-state response until after a live packet and confirm the late response does not regress newer values.

### 3. Auto-follow behavior

1. With Live mode and auto-follow enabled, send new coordinates and confirm the map follows.
2. Disable auto-follow and move the viewport manually.
3. Send new coordinates and confirm the marker moves but the viewport remains where the user placed it.

### 4. History and replay isolation

1. Enter History mode, select a trip, and begin replay.
2. Send matching live updates.
3. Confirm the route, replay marker, playback, trip selection, and viewport are unchanged.
4. Return to Live mode and confirm the latest retained live state appears and the map centers once.

### 5. Recovery and concurrent consumers

1. Open Fleet Map and a Vehicle Details Map for the same fleet.
2. Confirm both receive live packets.
3. Close either view and confirm the other continues updating.
4. Temporarily interrupt the live connection, restore it, and confirm updates resume through existing reconnect behavior.
5. Refresh/reopen Vehicle Details and confirm REST restores current state before later live increments.

See [data-model.md](data-model.md) for merge rules and [contracts/live-vehicle-state.md](contracts/live-vehicle-state.md) for the integration boundary.
