---

description: "Dependency-ordered implementation tasks for reliable Vehicle Details Map live updates"
---

# Tasks: Reliable Vehicle Live Updates

**Input**: Design documents from `specs/001-fix-vehicle-live-updates/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md), [data-model.md](data-model.md), [contracts/live-vehicle-state.md](contracts/live-vehicle-state.md), [quickstart.md](quickstart.md)

**Tests**: Regression tests are required by the feature specification and Trackora constitution. Write each story's tests first and confirm they fail for the intended behavior before implementing that story.

**Organization**: Tasks are grouped by user story so each behavior can be implemented and validated as an independent increment.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel because it touches a different file and has no dependency on another incomplete task in the same group.
- **[Story]**: Maps the task to a user story from `spec.md`.
- Every task names the exact file it creates, changes, or validates.

## Phase 1: Setup (Existing Project Baseline)

**Purpose**: Confirm the existing Angular test environment before changing shared models or behavior.

- [X] T001 Run the existing Vehicle Details Map and Fleet Map specs through the test script in `package.json`, and document any pre-existing failures in `specs/001-fix-vehicle-live-updates/quickstart.md`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Establish the typed partial-event contract and deterministic merge behavior used by every story.

**⚠️ CRITICAL**: Complete this phase before beginning any user-story implementation.

- [X] T002 Update `src/app/shared/models/fleet-map.models.ts` so `LiveVehicleLocationEvent` keeps vehicle identity and `recordedAt` required while label, plate, coordinates, speed, heading, fuel, battery, engine temperature, odometer, and check-engine values allow optional/null partial packets; change only `FleetTelematicsLocation.latitude` and `.longitude` to `number | null` so current state can retain telemetry without fabricating a position
- [X] T003 Add failing accumulator tests in `src/app/shared/models/vehicle-live-state.spec.ts` for these invariants: “Only non-null, non-undefined incoming values are candidates,” zero and false remain valid, newer report time wins per field, older input cannot regress a field, equal-time input only fills unknown fields, invalid timestamps do not mutate state, and merges are immutable
- [X] T004 Implement typed `VehicleLiveStateAccumulator`, per-field freshness metadata, REST seeding, and live-event merging in `src/app/shared/models/vehicle-live-state.ts` until T003 passes without casting a raw event to `FleetTelematicsLocation`

**Checkpoint**: Shared state can deterministically merge authoritative and incremental inputs without erasing known values.

---

## Phase 3: User Story 1 - See the Current Vehicle Update Live (Priority: P1) 🎯 MVP

**Goal**: Establish authoritative current state, then update only the displayed vehicle's marker and telemetry from matching partial live events within one second.

**Independent Test**: Open one vehicle's details, resolve REST and live inputs in both orders, emit matching and nonmatching partial packets, and verify that marker position/heading and all supplied telemetry update without refresh while preserved fields do not regress.

### Tests for User Story 1

- [X] T005 [US1] Replace the smoke-only coverage in `src/app/features/vehicles/vehicle-details/vehicle-map/vehicle-map.component.spec.ts` with failing tests for authoritative REST display, vehicle-ID filtering, coordinate/heading marker updates, telemetry-only packets with null coordinates, partial/null preservation, zero/false values, malformed timestamps, equal-time unknown-field filling without conflicting-value replacement, a delayed REST response not overwriting newer live fields, and deterministic timing of at most one second from subscriber delivery until marker and rendered telemetry reflect merged state (excluding network transit)
- [X] T006 [US1] Add failing template assertions in `src/app/features/vehicles/vehicle-details/vehicle-map/vehicle-map.component.spec.ts` for live speed, fuel, battery voltage, engine temperature, odometer, check-engine status, and last-reported time after a matching event

### Implementation for User Story 1

- [X] T007 [US1] Refactor REST and fleet-stream ingestion in `src/app/features/vehicles/vehicle-details/vehicle-map/vehicle-map.component.ts` to filter by current vehicle ID, merge both sources through `VehicleLiveStateAccumulator`, retain telemetry-only events, reject unusable timestamps, and update `currentState` immutably
- [X] T008 [US1] Refactor marker rendering in `src/app/features/vehicles/vehicle-details/vehicle-map/vehicle-map.component.ts` so valid merged coordinate pairs move the marker, heading changes rebuild its icon, zero coordinates/headings are accepted, and telemetry changes do not require coordinates
- [X] T009 [US1] Update `src/app/features/vehicles/vehicle-details/vehicle-map/vehicle-map.component.html` only as needed to ensure check-engine status and every required live telemetry field visibly reflects `currentState` without introducing fabricated values
- [X] T010 [US1] Run the focused Vehicle Details Map and accumulator specs documented in `specs/001-fix-vehicle-live-updates/quickstart.md` and correct US1 regressions in `src/app/features/vehicles/vehicle-details/vehicle-map/vehicle-map.component.ts`

**Checkpoint**: User Story 1 works independently as the MVP; authoritative state loads and matching packets update the vehicle without refresh.

---

## Phase 4: User Story 2 - Keep Control of the Map View (Priority: P2)

**Goal**: Continue moving the live marker while panning only when Live-mode auto-follow is enabled, and center once after returning from History.

**Independent Test**: Emit coordinate changes with auto-follow enabled and disabled, then transition History to Live and verify marker movement in Live mode, conditional panning, and exactly one transition recenter.

### Tests for User Story 2

- [X] T011 [US2] Add failing viewport tests in `src/app/features/vehicles/vehicle-details/vehicle-map/vehicle-map.component.spec.ts` for auto-follow enabled panning, auto-follow disabled viewport preservation, enabling follow centering on retained coordinates, and History-to-Live centering exactly once

### Implementation for User Story 2

- [X] T012 [US2] Separate marker rendering from viewport control in `src/app/features/vehicles/vehicle-details/vehicle-map/vehicle-map.component.ts`; pan after coordinate changes only when mode is `LIVE` and auto-follow is true, preserve the viewport otherwise, and center once when returning to Live
- [X] T013 [US2] Verify the existing follow control remains available and correctly reflects `autoFollow` in `src/app/features/vehicles/vehicle-details/vehicle-map/vehicle-map.component.html`, removing duplicate or unreachable follow controls if necessary without redesigning the UI

**Checkpoint**: User Story 2 independently proves the user retains viewport control while live marker updates continue.

---

## Phase 5: User Story 3 - Preserve Historical Analysis (Priority: P2)

**Goal**: Keep accepting live state internally during History and replay without changing historical layers, marker, selection, playback, or viewport; render the retained state only after returning to Live.

**Independent Test**: Start a selected trip replay, emit matching live updates, verify every historical visual and playback value is unchanged, then return to Live and see the retained latest live state.

### Tests for User Story 3

- [X] T014 [US3] Add failing History/replay isolation tests in `src/app/features/vehicles/vehicle-details/vehicle-map/vehicle-map.component.spec.ts` asserting live events retain current live state but do not render/move the live marker, mutate the route or replay marker, clear the selected trip, change playback state, or pan/refit while History is active
- [X] T015 [US3] Add a failing transition test in `src/app/features/vehicles/vehicle-details/vehicle-map/vehicle-map.component.spec.ts` proving the newest live state received during History renders and centers when Live mode resumes

### Implementation for User Story 3

- [X] T016 [US3] Gate live marker and viewport side effects by `mapMode` in `src/app/features/vehicles/vehicle-details/vehicle-map/vehicle-map.component.ts` while continuing to merge matching events internally, and render the retained latest live state from `showLiveMode()` without touching historical route or replay state during ingestion

**Checkpoint**: User Story 3 independently preserves uninterrupted historical analysis and resumes Live at the newest retained position.

---

## Phase 6: User Story 4 - Recover Without Disrupting Other Live Maps (Priority: P3)

**Goal**: Preserve reconnect recovery and guarantee that concurrent Fleet Map and Vehicle Details consumers cannot terminate or duplicate each other's logical fleet stream.

**Independent Test**: Subscribe two consumers to one fleet, emit packets, unsubscribe each in turn, simulate reconnect/resubscription, and verify one logical connection serves active consumers; then refresh Vehicle Details and confirm REST re-establishes current state.

### Tests for User Story 4

- [X] T017 [P] [US4] Create failing STOMP lifecycle tests in `src/app/core/services/fleet-live-location.service.spec.ts` for one client per overlapping fleet stream, delivery to both subscribers, independent unsubscription, teardown only after the final subscriber, a fresh subscription after teardown, reconnect configuration, parse-error isolation, and later valid-message delivery
- [X] T018 [P] [US4] Replace smoke-only Fleet Map coverage in `src/app/features/telematics/telematics/fleet-map/fleet-map.spec.ts` with regression tests that its live consumer still receives updates when another subscriber stops, complete-event output remains unchanged, and partial null/omitted telemetry preserves previously known values
- [X] T019 [US4] Add refresh/reopen recovery coverage in `src/app/features/vehicles/vehicle-details/vehicle-map/vehicle-map.component.spec.ts` proving a new component instance requests authoritative current state and then applies later matching live packets

### Implementation for User Story 4

- [X] T020 [US4] Make the smallest test-driven lifecycle correction needed in `src/app/core/services/fleet-live-location.service.ts` while preserving `connectToFleet(fleetId)`, raw `LiveVehicleLocationEvent` delivery, one cached shared Observable per fleet, five-second reconnect behavior, and independent active consumers
- [X] T021 [US4] Apply only compatibility fixes exposed by T018 in `src/app/features/telematics/telematics/fleet-map/fleet-map.ts`: preserve existing output for complete events, preserve known telemetry for partial null/omitted fields, and add explicit non-null coordinate guards required by nullable `FleetTelematicsLocation` without redesigning Fleet Map behavior

**Checkpoint**: User Story 4 independently demonstrates recovery and shared-stream consumer isolation with no Fleet Map regression.

---

## Phase 7: Polish & Cross-Cutting Validation

**Purpose**: Verify the completed bug fix against the contract, constitution, and production quality gates.

- [X] T022 [P] Remove or production-gate verbose event payload logging while retaining safe connection, parse, and transport diagnostics in `src/app/core/services/fleet-live-location.service.ts`
- [X] T023 [P] Remove temporary debugging output and confirm lifecycle-safe subscriptions, timers, `ResizeObserver`, and Leaflet cleanup in `src/app/features/vehicles/vehicle-details/vehicle-map/vehicle-map.component.ts`
- [ ] T024 Run all automated and manual scenarios in `specs/001-fix-vehicle-live-updates/quickstart.md`, updating only inaccurate validation instructions in that file
- [X] T025 Run the complete test suite through `package.json` and fix any regressions in files changed by this feature without weakening, deleting, or skipping tests
- [X] T026 Run the production build through `package.json` and resolve feature-related compilation, typing, or configured budget failures in files changed by this feature
- [X] T027 Verify every guarantee in `specs/001-fix-vehicle-live-updates/contracts/live-vehicle-state.md` against the final implementation and update `specs/001-fix-vehicle-live-updates/quickstart.md` with the final validation result

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: Starts immediately.
- **Phase 2 (Foundational)**: Depends on T001 and blocks all user stories.
- **Phase 3 (US1)**: Depends on T002–T004; this is the recommended MVP.
- **Phase 4 (US2)**: Depends on the retained live state and marker update path delivered by US1.
- **Phase 5 (US3)**: Depends on US1 state ingestion; it can be developed alongside US2 after US1 completes, but both edit the same component/spec and therefore require coordination.
- **Phase 6 (US4)**: Depends on the foundational event contract; service tests T017 and Fleet Map tests T018 can begin after Phase 2 and run in parallel with US1–US3, while T019 depends on the US1 component harness.
- **Phase 7 (Polish)**: Depends on all selected story phases.

### User Story Dependencies

```text
Setup -> Foundation -> US1 (MVP) -> US2
                          |       
                          +-----> US3

Foundation --------------------> US4

US1 + US2 + US3 + US4 -> Polish
```

- **US1 (P1)**: First independently deliverable story after the foundation.
- **US2 (P2)**: Uses US1's merged state/marker path but has independently testable viewport behavior.
- **US3 (P2)**: Uses US1's retained state but has independently testable History/replay isolation.
- **US4 (P3)**: Shared-service work is independent after the foundation; its component recovery test uses the US1 harness.

### Within Each User Story

- Write behavioral tests first and verify they fail for the intended missing behavior.
- Complete model/state transformation before component integration.
- Separate state ingestion from marker rendering and viewport effects.
- Run the story's focused tests before moving to the next checkpoint.

## Parallel Opportunities

- After T002, T003/T004 remain sequential because implementation must follow the failing accumulator tests.
- In US1, T005 and T006 are sequential because both modify the same component spec.
- US2 and US3 can be developed in parallel after US1 by separate owners if edits to `vehicle-map.component.ts` and its spec are coordinated.
- T017 and T018 are truly parallel because they create/modify different specs.
- US4 shared-service/Fleet Map work can proceed alongside US2/US3 after the foundation.
- T022 and T023 are parallel because they touch different production files.

## Parallel Examples

### User Story 1

```text
Task T005: Build the component behavior harness and failing REST/live merge tests.
Task T006: Add required rendered-telemetry assertions in the same spec with coordinated ownership.
```

### User Stories 2 and 3

```text
After US1, one owner can implement T011–T013 while another prepares T014–T016.
Coordinate commits because both streams edit the Vehicle Map component and spec.
```

### User Story 4

```text
Task T017: Test shared STOMP lifecycle in fleet-live-location.service.spec.ts.
Task T018: Test Fleet Map compatibility in fleet-map.spec.ts.
```

## Implementation Strategy

### MVP First

1. Complete T001–T004 to establish the typed merge foundation.
2. Complete T005–T010 for User Story 1.
3. Stop and validate the MVP: REST establishes state and matching partial events update marker/telemetry without refresh.

### Incremental Delivery

1. **Foundation**: Partial event types and deterministic per-field merge.
2. **US1**: Reliable current vehicle updates.
3. **US2**: Intentional viewport and auto-follow behavior.
4. **US3**: History/replay isolation.
5. **US4**: Shared-stream recovery and Fleet Map compatibility.
6. **Polish**: Full tests, production build, and quickstart validation.

## Notes

- Do not introduce a second transport, global state framework, backend contract, or dependency.
- Keep `LiveVehicleLocationEvent` and `FleetTelematicsLocation` conceptually distinct.
- Treat null/undefined as “no change”; treat zero and false as values.
- Compare report times per field rather than using arrival order.
- Do not weaken existing tests or alter unrelated map behavior.
