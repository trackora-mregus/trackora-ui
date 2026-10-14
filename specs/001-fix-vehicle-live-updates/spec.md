# Feature Specification: Reliable Vehicle Live Updates

**Feature Branch**: `[001-fix-vehicle-live-updates]`

**Created**: 2026-09-25

**Status**: Draft

**Input**: User description: "Fix real-time vehicle updates on the Vehicle Details Map while preserving authoritative initial loading, history and replay behavior, viewport preferences, shared live-stream consumers, reconnect recovery, and Fleet Map behavior. Add regression tests where reasonably possible."

## Clarifications

### Session 2026-09-25

- Q: When authoritative loading and live updates overlap or arrive out of order, which state should win? → A: Apply each field from the state with the newer report time.
- Q: When a live update explicitly contains null for a telemetry field, should the existing displayed value be preserved or cleared? → A: Treat null like an omitted field and preserve the existing value.
- Q: How quickly after receiving a valid live update must the Vehicle Details Map show the new marker position and telemetry? → A: Within 1 second of receipt.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - See the Current Vehicle Update Live (Priority: P1)

As a fleet operator viewing a vehicle in Live mode, I see its latest position and telemetry appear without refreshing or reopening the map, so I can monitor the vehicle accurately.

**Why this priority**: Timely vehicle state is the core purpose of the live Vehicle Details Map and the defect directly prevents it.

**Independent Test**: Open one vehicle's details, establish its current state, deliver subsequent updates for that vehicle, and verify the marker and telemetry change without a refresh while updates for other vehicles are ignored.

**Acceptance Scenarios**:

1. **Given** the Vehicle Details Map is opening, **when** current vehicle state is available, **then** the map initially displays that authoritative state without waiting for a live update.
2. **Given** a vehicle is displayed in Live mode, **when** an update for that vehicle contains new coordinates and heading, **then** its marker moves and reflects the new heading without a refresh.
3. **Given** a vehicle is displayed in Live mode, **when** an update for that vehicle contains new telemetry, **then** the displayed speed, fuel level, battery voltage, engine temperature, odometer, check-engine status, and last-reported time reflect every value supplied by the update.
4. **Given** a vehicle is displayed, **when** an update belongs to another vehicle, **then** the displayed marker and telemetry remain unchanged.
5. **Given** previously known telemetry, **when** a live update omits one or more telemetry fields, **then** the omitted fields retain their previously known values while supplied fields update.

---

### User Story 2 - Keep Control of the Map View (Priority: P2)

As a fleet operator, I can choose whether the live map follows the vehicle, so marker updates do not disrupt an area I am inspecting.

**Why this priority**: Live information remains useful only if it respects the operator's explicit viewport preference.

**Independent Test**: Observe the same moving vehicle with auto-follow first enabled and then disabled, and verify marker movement in both cases while the viewport follows only when enabled.

**Acceptance Scenarios**:

1. **Given** Live mode and auto-follow are enabled, **when** the displayed vehicle reports new coordinates, **then** the marker moves and the viewport follows the latest position.
2. **Given** Live mode is active and auto-follow is disabled, **when** the displayed vehicle reports new coordinates, **then** the marker moves but the user-selected viewport does not recenter.
3. **Given** the operator has returned from History mode to Live mode, **when** a latest known position exists, **then** the map centers on that position once and resumes the current Live-mode follow preference thereafter.

---

### User Story 3 - Preserve Historical Analysis (Priority: P2)

As a fleet operator reviewing history or replaying a trip, I can continue that work uninterrupted even while newer live vehicle information arrives.

**Why this priority**: Live and historical contexts represent different tasks, and mixing them can invalidate the operator's analysis.

**Independent Test**: Start a historical trip replay, deliver live position and telemetry updates, and verify the route, replay marker, playback, selection, and viewport remain unchanged; then return to Live mode and verify the latest live state appears.

**Acceptance Scenarios**:

1. **Given** History mode or trip replay is active, **when** live updates arrive, **then** they do not move the replay marker, alter the historical route, clear the selected trip, interrupt playback, or recenter the map.
2. **Given** live updates arrived during History mode, **when** the operator returns to Live mode, **then** the latest known live telemetry is displayed and the map centers on the latest known vehicle position.

---

### User Story 4 - Recover Without Disrupting Other Live Maps (Priority: P3)

As a fleet operator, I continue receiving live information after a temporary connection interruption, and opening or closing one map does not break live updates elsewhere.

**Why this priority**: Recovery and shared-consumer isolation make live monitoring dependable across normal navigation and transient network failures.

**Independent Test**: Use the Vehicle Details Map and Fleet Map concurrently, interrupt and restore live connectivity, close either consumer, and verify the remaining consumer continues updating; reopen the details page and verify authoritative current state is recovered.

**Acceptance Scenarios**:

1. **Given** a temporary live connection interruption, **when** connectivity is restored through existing recovery behavior, **then** subsequent matching vehicle updates resume without requiring a page refresh.
2. **Given** the Vehicle Details Map and Fleet Map both consume live updates, **when** either map is closed or stops consuming updates, **then** the other continues receiving and applying its updates.
3. **Given** live updates were missed or the page was closed, **when** the Vehicle Details Map is refreshed or reopened, **then** it re-establishes authoritative current vehicle state before applying later live updates.

### Edge Cases

- An update with valid zero latitude, longitude, speed, fuel, voltage, temperature, odometer, or heading values must apply those values rather than treating them as absent.
- An update that contains telemetry but no coordinates updates supplied telemetry without moving or hiding the marker.
- An update that contains coordinates but omits other telemetry moves the marker while preserving all omitted known values.
- An update that explicitly contains a null telemetry value preserves the previously known value for that field.
- An out-of-scope vehicle update arriving between initial loading and the first matching update must not alter the displayed state.
- A live update arriving before authoritative initial loading completes, or an older update arriving late, must not cause any field to regress; each field retains the value from the state with the newer report time.
- When two sources report the same time, an incoming value may fill an unknown field but must not replace a conflicting known value.
- Repeated updates carrying the same values must not cause unintended viewport movement when auto-follow is disabled or History mode is active.
- A malformed or unusable live update must leave the last known valid state visible and must not interrupt later valid updates.
- If no current coordinates are available, telemetry may still display, but the map must not fabricate a position.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The Vehicle Details Map MUST establish the displayed vehicle's authoritative current state whenever the view is opened, refreshed, or reopened.
- **FR-002**: After initial state is established, the view MUST apply incremental live updates without requiring a refresh or reopening.
- **FR-003**: The view MUST apply only updates whose vehicle identity matches the currently displayed vehicle.
- **FR-004**: New valid coordinates for the displayed vehicle MUST move its live marker, including coordinates containing zero values.
- **FR-005**: A new heading for the displayed vehicle MUST update the marker's displayed orientation or heading indication, including a heading of zero.
- **FR-006**: Supplied values for speed, fuel level, battery voltage, engine temperature, odometer, check-engine status, and last-reported time MUST update their respective displayed values.
- **FR-007**: Fields omitted from a partial live update or explicitly set to null MUST preserve their previously known values; any other explicit value, including zero or false, MUST be applied.
- **FR-008**: Live updates MUST NOT fabricate values for fields that have never been authoritatively reported; the latest known live state MUST represent unavailable coordinates as null while retaining any known telemetry.
- **FR-009**: In Live mode with auto-follow enabled, valid new coordinates MUST move the marker and keep the viewport following the vehicle.
- **FR-010**: In Live mode with auto-follow disabled, valid new coordinates MUST move the marker without forcing a viewport recenter or bounds reset.
- **FR-011**: While History mode or trip replay is active, live updates MUST NOT alter the historical route, replay marker, selected trip, playback state, or viewport.
- **FR-012**: The system MUST retain the latest known live state while History mode or trip replay is active.
- **FR-013**: Returning from History mode to Live mode MUST display the latest known live state and center the map once on the latest known valid position.
- **FR-014**: Following a temporary live-connection interruption, matching updates MUST resume through the product's existing recovery behavior.
- **FR-015**: Missed live updates MUST be recoverable by refreshing or reopening the view, which MUST re-establish authoritative current state.
- **FR-016**: Multiple active consumers of fleet live updates MUST operate independently; one consumer starting or stopping MUST NOT terminate, duplicate, or otherwise impair updates required by another.
- **FR-017**: Existing Fleet Map behavior for complete live events MUST remain functionally unchanged; when a partial event omits or nulls telemetry, Fleet Map MUST preserve its previously known values rather than erase them.
- **FR-018**: Invalid or unusable live messages MUST preserve the last known valid displayed state and MUST NOT prevent later valid messages from being processed.
- **FR-019**: Automated regression tests MUST cover matching-vehicle filtering, partial-value preservation, live marker and telemetry updates, viewport follow behavior, history/live separation, and shared-consumer independence wherever those behaviors can reasonably be automated.
- **FR-020**: When authoritative and live states overlap or arrive out of order, each field MUST retain or apply the value associated with the newer report time, regardless of message arrival order; at equal report times, an incoming value MAY fill an unknown field but MUST NOT replace a conflicting known value.
- **FR-021**: The Vehicle Details Map MUST show all applicable values from a valid matching live update within one second measured from delivery to the view's live-update subscriber until the marker and rendered telemetry reflect the merged state.

### Key Entities

- **Displayed Vehicle**: The vehicle selected in the details view, identified uniquely and associated with its latest known live state.
- **Authoritative Vehicle State**: The current state established when the view loads, including nullable coordinates plus heading, telemetry, status, and report time when available.
- **Live Vehicle Update**: An incremental, potentially partial report associated with one vehicle; supplied values amend the latest known state while omitted values preserve it.
- **Latest Known Live State**: The merged current state retained for the displayed vehicle, including while the user is viewing history; overlapping values are resolved per field using report time.
- **Map Mode**: The active viewing context—Live or History—which determines whether live state may affect rendered markers and viewport behavior.
- **Auto-Follow Preference**: The user's Live-mode choice controlling whether coordinate updates also recenter the viewport.
- **Historical Trip State**: The selected historical route, replay marker, playback status, and related viewport state, isolated from live updates.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In regression testing, 100% of valid matching-vehicle updates change all supplied marker and telemetry values without a page refresh, while 100% of nonmatching updates leave the displayed state unchanged.
- **SC-002**: In regression testing, 100% of fields omitted from partial updates retain their last known values, and explicit zero and false values are applied correctly.
- **SC-003**: In every tested Live-mode movement, the marker reaches the latest reported position; the viewport follows in 100% of auto-follow-enabled cases and remains unchanged in 100% of auto-follow-disabled cases.
- **SC-004**: During all tested History and replay sessions, incoming live updates cause zero changes to the historical route, replay marker, trip selection, playback state, or viewport.
- **SC-005**: In every tested transition from History to Live mode, the latest known live state is shown and the map centers on the latest valid position without requiring refresh.
- **SC-006**: In every tested temporary interruption, live updates resume after existing recovery completes, and refreshing or reopening always restores the authoritative current state.
- **SC-007**: Concurrent Vehicle Details Map and Fleet Map tests show zero lost updates or unintended shutdowns in one consumer when the other consumer starts or stops.
- **SC-008**: Existing Fleet Map real-time regression tests continue to pass with no user-visible behavior regression.
- **SC-009**: In 100% of deterministic timing tests for valid matching updates, no more than one second elapses from subscriber delivery until the marker and rendered telemetry reflect the merged state; network transit time is excluded.

## Assumptions

- Existing authoritative current-state and fleet live-update capabilities already provide the vehicle identity and telemetry fields needed by this fix; no backend contract change is expected.
- The latest known live state may continue to be updated internally while History mode is active, but it is not rendered into the historical experience until the user returns to Live mode.
- An omitted or null field means "no change" and does not clear a previously known value.
- Existing reconnect behavior remains the recovery mechanism for temporary live-connection interruptions; changing connection policy or retry timing is outside this bug fix.
- Auto-follow is an existing view preference whose current default remains unchanged.
- This bug fix is limited to correcting live state propagation, merging, filtering, viewport behavior, and consumer isolation; unrelated map redesigns and new telemetry fields are out of scope.
- The existing authorization model and vehicle access rules remain unchanged.
