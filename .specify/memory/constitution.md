# Trackora Frontend Constitution

## Core Principles

### I. Frontend Architecture Must Remain Consistent

Trackora's frontend MUST remain an Angular application using the established
project architecture and conventions.

The current frontend foundation includes:

- Angular 20
- Standalone components
- TypeScript
- Angular Signals
- RxJS
- Angular Material
- Typed HTTP services
- STOMP WebSockets
- Leaflet for maps

New frontend functionality MUST integrate with the existing architecture rather
than introducing parallel frameworks, state-management systems, UI libraries,
or networking abstractions without demonstrated need.

Introducing any of the following requires an explicit specification and
architectural justification:

- Another frontend framework
- A global state-management framework
- Another mapping framework
- Another WebSocket/STOMP abstraction
- Another major UI component library
- A major replacement of Angular Material
- A fundamentally different application architecture

New dependencies MUST have a clear purpose and MUST NOT duplicate functionality
already provided by the existing stack without justification.

Architectural complexity MUST NOT be introduced solely because it may be useful
in the future.

---

### II. Components Own Presentation; Services Own Integration

Angular components MUST remain focused on presentation, user interaction, and
feature state.

Backend communication MUST be encapsulated in Angular services.

Components SHOULD NOT construct arbitrary HTTP URLs or directly manage backend
transport concerns when an appropriate service boundary exists.

The expected dependency direction is:

```text
Component -> Angular Service -> Trackora API
```

Examples include:

```text
VehicleMapComponent -> TelematicsService
FleetMapComponent -> TelematicsService
FleetMapComponent -> FleetLiveLocationService
```

Services are responsible for concerns such as:

- HTTP communication
- WebSocket/STOMP communication
- Request construction
- Response typing
- Shared integration behavior

Components are responsible for concerns such as:

- Presentation state
- User interaction
- View-specific transformations
- Rendering
- Feature-specific behavior

Shared behavior MUST NOT be duplicated across components when an existing
service or reusable abstraction is the appropriate owner.

---

### III. State Must Be Typed and Reactive

Trackora frontend state MUST be explicitly typed.

TypeScript `any` SHOULD NOT be introduced when the application's domain model
is known.

API contracts SHOULD have explicit TypeScript interfaces or types.

Angular Signals SHOULD be used for local and reactive component state where
appropriate.

RxJS SHOULD be used for asynchronous streams and event-driven behavior where
appropriate.

Signals and RxJS SHOULD be used intentionally rather than converting between
them without a clear reason.

Mutable UI state SHOULD have a single clear owner.

State updates MUST be predictable and SHOULD avoid hidden mutation.

When updating signal collections, immutable update patterns SHOULD be
preferred.

For example:

```typescript
this.alerts.update(alerts =>
  alerts.filter(alert => alert.id !== alertId)
);
```

rather than mutating the existing array.

---

### IV. Domain Models Must Preserve Their Meaning

Similar-looking domain objects MUST NOT be treated as interchangeable merely
because they contain overlapping fields.

In particular:

`TelematicsEvent` represents an individual telemetry event or packet.

`FleetTelematicsLocation` represents the latest known merged vehicle state.

These models MUST remain conceptually distinct.

Raw event models MUST NOT be cast to current-state models merely to satisfy the
TypeScript compiler.

Mapping between different domain models MUST be explicit.

Optional and nullable fields MUST accurately reflect backend contracts.

Coordinates MUST be checked explicitly for null or undefined rather than using
truthiness because zero is a valid coordinate.

For example:

```typescript
if (
  location.latitude != null &&
  location.longitude != null
) {
  // valid coordinates
}
```

---

### V. REST Establishes State; WebSockets Increment It

Trackora's real-time frontend architecture follows:

```text
REST initial state
        ↓
WebSocket incremental updates
        ↓
REST recovery
```

REST is the authoritative mechanism for establishing application state when a
page or feature loads.

WebSockets provide incremental real-time updates.

WebSockets MUST NOT be treated as the durable source of truth.

A page MUST NOT require a new WebSocket event before it can display the
currently known state.

Refreshing or reopening a page MUST recover authoritative state through REST.

A missed WebSocket event MUST NOT permanently corrupt the UI.

Temporary WebSocket interruption MUST be recoverable.

Components consuming the same logical live stream MUST NOT interfere with one
another.

Shared WebSocket infrastructure SHOULD avoid unnecessary duplicate connections
for the same logical subscription.

A component unsubscribing MUST NOT unintentionally terminate live updates
required by another active component.

---

### VI. Partial Real-Time Events Must Preserve Known State

WebSocket events MAY contain partial telemetry.

Missing values in a live event MUST NOT erase previously known values unless
the backend contract explicitly defines that behavior.

Frontend state updates MUST merge partial real-time events with existing known
state.

For example:

```typescript
batteryVoltage:
  event.batteryVoltage ??
  previous?.batteryVoltage ??
  null
```

This rule applies to fields including, where applicable:

- Speed
- Heading
- Fuel level
- Battery voltage
- Engine temperature
- Odometer
- Check-engine state
- Vehicle labels and metadata

A partial packet MUST NOT cause the UI to display unknown data merely because
that field was omitted from the latest event.

The frontend MUST NOT independently invent telemetry values.

---

### VII. Live and Historical Telemetry Are Separate Experiences

Live vehicle tracking and historical trip analysis MUST remain separate
concepts.

Live mode represents the latest known vehicle state.

History mode represents historical telemetry and detected trips.

Trip replay MUST operate on historical telemetry belonging to the selected
trip.

Live WebSocket updates MUST NOT:

- Move a trip replay marker
- Replace historical replay state
- Recenter an active trip replay
- Clear the selected trip
- Interrupt playback
- Alter the historical route

Live state MAY continue updating internally while History mode is active, but
it MUST NOT interfere with the historical user experience.

Returning to Live mode SHOULD display the latest known live state.

Historical route direction SHOULD be derived from historical route data rather
than current vehicle heading.

---

### VIII. Map Viewport Changes Must Be Intentional

Rendering map markers and controlling the map viewport are separate
responsibilities.

Updating a marker MUST NOT automatically imply that the entire map should
recenter or refit its bounds.

Viewport changes MUST correspond to explicit feature behavior.

Examples include:

- Initial live vehicle load
- User-enabled auto-follow
- Selecting a historical trip
- Explicit fleet recentering
- Returning from History mode to Live mode

Live WebSocket updates SHOULD update markers without unnecessarily resetting
the user's chosen viewport.

When auto-follow is enabled in Live mode, the map MAY follow the live vehicle.

When auto-follow is disabled, live markers MUST continue updating without
forcing the viewport back to the vehicle.

During trip replay, the replay experience owns the relevant viewport behavior.

Leaflet maps rendered inside dynamically sized or initially hidden Angular
containers MUST account for container resizing appropriately.

---

### IX. Subscriptions Must Be Lifecycle-Safe

Observable and WebSocket subscriptions MUST NOT leak after their consuming
component is destroyed.

Angular lifecycle-safe mechanisms such as:

```typescript
takeUntilDestroyed(this.destroyRef)
```

SHOULD be used for component subscriptions.

Manual cleanup MAY be used when required by external libraries.

Timers, observers, map instances, and external resources MUST be cleaned up.

Examples include:

- `setInterval`
- `ResizeObserver`
- Leaflet map instances
- STOMP clients when their ownership ends
- Event listeners

Component destruction MUST NOT leave background work that can mutate stale UI
state.

---

### X. Security Is Enforced by the Backend

The frontend MUST NOT be treated as an authorization boundary.

Route guards, hidden controls, disabled buttons, conditional rendering, and
client-side checks improve user experience but MUST NOT be considered security
enforcement.

The frontend MUST NOT attempt to bypass backend tenant ownership rules.

Client-supplied identifiers such as:

- `userId`
- `ownerId`
- `tenantId`
- `fleetId`
- `vehicleId`

MUST NOT be assumed to grant authorization.

The frontend SHOULD send the identifiers required by documented API contracts,
while authentication and ownership decisions remain server-controlled.

Authentication credentials and tokens MUST be handled through the established
Trackora authentication infrastructure.

---

### XI. Secrets Must Never Enter the Frontend Bundle

Secrets MUST NOT be placed in Angular source code or frontend environment files
that are bundled into the application.

The frontend MUST NOT contain:

- OpenAI API keys
- Database credentials
- Azure Service Bus credentials
- AWS secret keys
- S3 credentials
- JWT signing secrets
- Private backend tokens
- Other server-side credentials

Anything shipped to a browser MUST be assumed publicly inspectable.

Frontend configuration MUST contain only values safe to expose to users.

Sensitive information MUST NOT be written to browser logs.

Development debugging logs MUST be removed or appropriately disabled for
production when they expose unnecessary operational data.

---

### XII. API Contracts Must Be Explicit

Frontend services MUST conform to established backend API contracts.

Requests and responses SHOULD use explicit TypeScript models.

Backend API field names MUST NOT be silently reinterpreted.

Breaking API assumptions MUST be investigated rather than hidden with casts,
`any`, fabricated defaults, or duplicated frontend models.

HTTP errors SHOULD be handled intentionally.

User-facing errors SHOULD be understandable without exposing internal backend
details.

Changes requiring a backend contract modification MUST be identified explicitly
during specification or planning.

Frontend implementation MUST NOT silently assume that backend changes will
exist.

If a feature requires coordinated frontend and backend changes, that dependency
MUST be documented.

---

### XIII. Angular UI Must Follow Established Patterns

New UI MUST integrate with Trackora's existing design patterns.

Angular Material SHOULD remain the primary component library for application UI
where an appropriate component exists.

Existing Trackora layout, typography, spacing, navigation, loading, empty-state,
and error-state patterns SHOULD be reused.

New components MUST account for applicable states such as:

- Loading
- Loaded
- Empty
- Error
- Disabled
- Offline or unavailable

Interactive controls SHOULD provide clear user feedback.

Accessibility SHOULD be considered for interactive elements, forms, dialogs,
navigation, icons, and status indicators.

Responsive behavior SHOULD be preserved when modifying existing views.

Feature implementation SHOULD prioritize consistency with Trackora over
introducing isolated visual patterns.

---

### XIV. Tests Are Part of the Feature

Frontend work is not complete merely because it works manually.

Meaningful frontend business and state-management logic MUST have tests where
practical.

Regression-prone behavior SHOULD have automated tests.

Every confirmed bug fix MUST include a regression test when the behavior can
reasonably be tested automatically.

High-value test targets include:

- State transformations
- Partial WebSocket event merging
- Vehicle filtering
- Live-location updates
- Auto-follow behavior
- History/live separation
- Error handling
- Service behavior
- Authentication-sensitive UI behavior
- Complex component behavior

Tests MUST verify behavior rather than exist solely to increase coverage.

Trackora does not require an arbitrary coverage percentage.

Tests MUST NOT be deleted, disabled, skipped, or weakened solely to make a
change pass.

Frontend changes MUST leave the applicable Angular test suite passing.

Frontend changes MUST leave the production Angular build passing.

---

### XV. Production Behavior Must Be Diagnosable

Frontend failures SHOULD provide enough diagnostic information during
development and operations to identify their source.

Important failures include:

- HTTP failures
- Authentication failures
- WebSocket connection failures
- STOMP subscription failures
- Invalid WebSocket messages
- Mapping/rendering failures
- AI Copilot failures
- Document upload/download failures

Diagnostic logging MUST NOT expose credentials, tokens, sensitive tenant data,
or unnecessary personal information.

Verbose development logging SHOULD NOT be left enabled indiscriminately in
production.

Error handling SHOULD distinguish between user-facing feedback and developer
diagnostics.

---

## Feature Boundaries

The frontend repository owns frontend behavior.

A frontend specification SHOULD NOT introduce backend implementation work
unless the desired feature genuinely requires a backend contract change.

When existing backend capabilities already satisfy the feature, the frontend
MUST use those capabilities rather than creating unnecessary backend work.

When a frontend feature genuinely requires backend changes:

1. The required API or event contract MUST be identified.
2. The frontend specification MUST document the dependency.
3. The backend change SHOULD be specified in the backend repository.
4. The two specifications MUST agree on the shared contract.

Frontend agents MUST NOT directly modify a separate backend repository unless
the development workflow explicitly provides access to and authorization for
both repositories.

---

## Development Workflow

Every non-trivial Trackora frontend change SHOULD begin with a clear description
of desired user-visible behavior.

Changes that materially affect architecture, shared state, WebSocket behavior,
API contracts, authentication behavior, or major dependencies MUST have a
specification before implementation.

Specifications SHOULD describe desired behavior before prescribing technical
implementation.

Implementation plans MUST inspect existing Trackora patterns before introducing
new abstractions.

Existing services, models, utilities, components, and design patterns SHOULD be
reused when appropriate.

Bug fixes SHOULD follow:

1. Reproduce or clearly establish the defect.
2. Identify the root cause.
3. Add a regression test when reasonably possible.
4. Implement the smallest correct fix.
5. Run affected tests.
6. Run the complete required frontend quality gates.
7. Verify that related functionality has not regressed.

Refactoring MUST preserve externally observable behavior unless a specification
explicitly changes that behavior.

Large unrelated refactors SHOULD NOT be mixed into feature or bug-fix changes.

Generated implementation plans MUST NOT violate this constitution merely to
reduce implementation effort.

---

## Definition of Done

A Trackora frontend change is complete only when all applicable requirements
have been addressed.

This includes:

- Implementation is complete.
- Components and services respect established responsibilities.
- State is explicitly typed.
- Known domain models retain their intended meaning.
- HTTP communication uses established services.
- WebSocket communication uses established shared infrastructure.
- Partial live events preserve previously known state.
- REST remains capable of recovering authoritative state.
- Live and historical telemetry behavior remain isolated.
- Observable subscriptions and external resources are lifecycle-safe.
- Backend security assumptions have not been moved into the frontend.
- No secrets have been introduced into the browser bundle.
- API contracts are respected.
- Loading, error, and empty states are handled where applicable.
- Regression tests exist for fixed bugs when reasonably possible.
- Applicable Angular tests pass.
- The production Angular build passes.
- Production configuration has been considered.
- Documentation is updated when behavior or configuration changes.
- No unrelated architectural complexity has been introduced.

A change MUST NOT be declared complete while required tests or the production
build are failing.

---

## Architectural Decision Rules

The following changes require explicit specification and architectural
justification before implementation:

- Replacing Angular
- Introducing another frontend framework
- Introducing a new global state-management framework
- Replacing Angular Material as the primary UI library
- Replacing Leaflet
- Introducing a new real-time transport architecture
- Replacing the established STOMP/WebSocket infrastructure
- Introducing another major networking abstraction
- Fundamentally changing authentication handling
- Fundamentally changing live-state synchronization
- Breaking established backend API contracts

The specification MUST explain:

1. The problem being solved.
2. Why the existing frontend architecture cannot reasonably solve it.
3. Alternatives considered.
4. Complexity introduced.
5. Security implications.
6. API/backend implications.
7. Testing strategy.
8. Migration implications.
9. Rollback strategy where applicable.

Convenience alone is not sufficient justification for major architectural
change.

---

## Governance

This constitution defines the engineering constraints for the Trackora frontend.

Specifications, implementation plans, generated code, reviews, bug fixes, and
refactors MUST comply with these principles.

When implementation guidance conflicts with this constitution, the constitution
takes precedence unless it is formally amended.

Amendments MUST be intentional and documented.

An amendment MUST explain:

- What principle is changing
- Why the change is necessary
- What architectural consequences it introduces
- Whether existing code requires migration
- What tests or documentation must change

Convenience alone is not sufficient justification for weakening:

- API contract safety
- Frontend typing
- WebSocket recovery behavior
- Live/historical state separation
- Lifecycle safety
- Test requirements
- Secret management
- Backend-controlled authorization

Architecture SHOULD evolve because Trackora has a demonstrated requirement, not
because a more complex solution is theoretically possible.

**Version**: 1.0.0  
**Ratified**: 2026-09-24  
**Last Amended**: 2026-09-24
