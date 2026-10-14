# Implementation Plan: Reliable Vehicle Live Updates

**Branch**: `[001-fix-vehicle-live-updates]` | **Date**: 2026-09-25 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/001-fix-vehicle-live-updates/spec.md`

## Summary

Correct the Vehicle Details Map so REST establishes authoritative state and fleet WebSocket events increment it without losing partial values, accepting stale data, or disturbing History mode. Introduce a typed, pure merge accumulator that tracks freshness per field; keep the shared STOMP transport contract intact; make state ingestion independent from marker rendering and viewport control; and add regression tests for merging, filtering, mode transitions, auto-follow, reconnection-compatible sharing, and Fleet Map coexistence.

## Technical Context

**Language/Version**: TypeScript 5.9.2; Angular workspace currently on 21.2.x  
**Primary Dependencies**: Angular standalone components, Angular Signals, RxJS 7.8, STOMP.js 7.3, Leaflet 1.9, Angular Material 21.2  
**Storage**: In-memory component state only; authoritative state remains backend-owned  
**Testing**: Angular unit-test builder with Vitest 4 and jsdom  
**Target Platform**: Modern evergreen desktop/mobile browsers supported by the existing Angular application  
**Project Type**: Single frontend web application  
**Performance Goals**: Within one second from delivery to the view's live-update subscriber, update both the Leaflet marker and rendered telemetry; exclude network transit and verify with deterministic timing  
**Constraints**: Preserve REST-first recovery, existing STOMP reconnect behavior, zero-valued telemetry, History/replay isolation, user-controlled auto-follow, shared-consumer independence, and existing Fleet Map behavior; no backend or dependency changes  
**Scale/Scope**: One selected vehicle in the details view plus concurrent consumers of one cached live stream per fleet; changes limited to live-location models/merge behavior, Vehicle Details Map, shared stream tests, and regression coverage

## Constitution Check

*GATE: Passed before Phase 0 and re-checked after Phase 1.*

| Principle | Design response | Status |
|---|---|---|
| Architecture consistency | Reuses the installed Angular, Signals, RxJS, STOMP, Material, and Leaflet stack; adds no dependency or parallel transport. | Pass |
| Components present; services integrate | STOMP lifecycle remains in `FleetLiveLocationService`; view mode, marker, and viewport behavior remain in `VehicleMapComponent`; pure merging is reusable typed domain logic. | Pass |
| Typed reactive state | Uses explicit event, merged-state, and field-freshness types with immutable signal updates; no `any` or raw-event casts. | Pass |
| Domain meaning | `LiveVehicleLocationEvent` remains an incremental packet and `FleetTelematicsLocation` remains merged current state with nullable coordinates when no position is known. | Pass |
| REST then WebSocket then REST recovery | Initial/reopen state uses the existing current-state request; live events increment it; reconnect policy remains existing; reload recovers through REST. | Pass |
| Partial event preservation | Null or omitted event values preserve known values; zero and false remain valid; freshness is tracked per field. | Pass |
| Live/history separation | Live state may advance internally in History mode, but live marker, replay state, route, playback, and viewport do not change until Live mode resumes. | Pass |
| Intentional viewport changes | Initial REST load and History-to-Live transition center once; live updates pan only with auto-follow enabled. | Pass |
| Lifecycle safety | Component subscription continues to use `takeUntilDestroyed`; shared service retains reference-counted teardown and reconnect configuration. | Pass |
| Security and secrets | Existing authentication, authorization, endpoints, environment configuration, and logging boundaries are unchanged. | Pass |
| Explicit API contracts | Existing REST and WebSocket payload contracts are preserved; optional/null event fields are typed accurately. | Pass |
| UI consistency | No new UI system or redesign; existing map and telemetry presentation are updated reactively. | Pass |
| Tests are part of feature | Adds focused regression tests and requires affected tests plus production build to pass. | Pass |
| Diagnosability | Existing connection/parse error reporting remains; malformed events do not terminate later processing; no sensitive payload logging is added. | Pass |

The repository currently declares Angular 21.2.x although the constitution describes Angular 20 as its foundation. This bug fix neither introduces nor changes that pre-existing version state, so it does not create an architectural exception.

### Post-design re-check

Phase 1 introduces only internal documentation for the existing frontend contracts and a typed in-memory merge model. There are no new backend endpoints, transports, persistence stores, frameworks, or constitution violations. All gates remain passed.

## Project Structure

### Documentation (this feature)

```text
specs/001-fix-vehicle-live-updates/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── live-vehicle-state.md
└── tasks.md                 # Created later by $speckit-tasks
```

### Source Code (repository root)

```text
src/app/
├── core/services/
│   ├── fleet-live-location.service.ts
│   └── fleet-live-location.service.spec.ts       # planned
├── shared/models/
│   └── fleet-map.models.ts
└── features/
    ├── vehicles/vehicle-details/vehicle-map/
    │   ├── vehicle-map.component.ts
    │   ├── vehicle-map.component.html
    │   └── vehicle-map.component.spec.ts
    └── telematics/telematics/fleet-map/
        ├── fleet-map.ts
        └── fleet-map.spec.ts
```

**Structure Decision**: Modify the existing single Angular application in place. Keep integration ownership in the core service, domain types beside current fleet-map models, and feature-specific display behavior and tests in the Vehicle Details Map. Fleet Map changes are limited to compatibility corrections or regression tests required to preserve its existing live behavior.

## Implementation Strategy

1. Make `LiveVehicleLocationEvent` accurately represent partial packets by allowing telemetry and coordinate properties to be absent or null; update `FleetTelematicsLocation` coordinates to `number | null` so merged current state can retain telemetry without fabricating a position, while preserving its current-state semantics.
2. Add a pure typed merge boundary that accepts authoritative state or an incremental event, tracks a report time for every mergeable field, ignores invalid/older values, preserves null/omitted values, and accepts zero/false values.
3. Seed the accumulator from REST when current state arrives, but merge rather than replace so a newer live event received during loading cannot regress any field.
4. Filter events by the current vehicle identity before merging. Update telemetry state even when coordinates are missing; render/move a live marker only when the merged state has valid coordinates.
5. Always retain the latest merged live state. Render live changes and auto-follow only in Live mode; while History is active, do not mutate live/replay layers or viewport. On return to Live, render the retained state and center once.
6. Keep `FleetLiveLocationService.connectToFleet()` as the stable shared Observable API. Verify one logical client per fleet while consumers overlap, independent unsubscription, teardown after the final subscriber, and reconnection-compatible resubscription. Preserve Fleet Map output for complete events while making its partial-event merging preserve known values as required by the shared contract.
7. Add behavioral tests around the pure merge logic and component side effects, including the equal-time rule and deterministic subscriber-delivery-to-render timing, plus focused Fleet Map/shared-service regression tests. Run targeted tests, the full frontend test suite, and the production build.

## Complexity Tracking

No constitution violations require justification.
