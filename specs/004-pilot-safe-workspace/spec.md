# Pilot-safe vehicle and document workspace

Issue: https://github.com/trackora-mregus/trackora-ui/issues/8
Branch: `feature/8-pilot-safe-workspace`
Base: `6d4aaf0697e7b28556484baa2882cb6798b8c328`
Status: local implementation; independent review pending.

## User stories and acceptance

- US1 (P1): An invited pilot user signs in and selects an authorized fleet in
  Vehicles. Successful login and excluded direct URLs lead to Vehicles. An
  unauthenticated user still reaches login. OWNER is never an eligibility signal.
- US2 (P1): The user reads vehicle detail and assigned devices, discovers existing
  maintenance records, and lists/uploads/downloads vehicle and maintenance
  documents. Existing server errors and upload validation remain visible.
- US3 (P1): With configuration absent or false, existing login, routes, controls,
  requests and map lifecycle behave as before.

## Requirements and success criteria

- FR1: Pilot presentation requires the literal boolean `pilotPresentation: true`
  in an explicitly selected environment (or an explicit DI provider). The current
  environment files remain unchanged; omission/false/malformed values disable it.
- FR2: Pilot entry is Vehicles. Existing auth guard remains authoritative for the
  frontend login redirect; backend authorization and bearer scoping stay intact.
- FR3: Pilot shell and detail issue no notifications, alerts, fuel, AI, search,
  current/history telemetry, map tile or WebSocket work. Excluded direct routes
  must be rejected before routed component creation.
- FR4: Keep GET fleets, fleet vehicles, vehicle detail, assigned devices,
  maintenance discovery and both document list/upload/download paths unchanged.
- FR5: Hide and guard vehicle create/edit/status, VIN decode, document deletion,
  and excluded routes/actions. Fleet selection remains on Vehicles. Maintenance
  discovery/documents remain inside detail; the standalone editing route is excluded.
- FR6: No backend, auth contracts, dependencies or production configuration changes.
- SC1: Focused mocked tests assert exact methods/paths, no leftover HTTP requests,
  no map child or WebSocket activity, navigation, errors and nonpilot regression.
- SC2: Application TypeScript and changed-file formatting checks pass locally.

## Boundaries and edge cases

Use synthetic sentinels only. Empty fleet/device/document lists retain existing
empty states. Saved fleet identifiers are selected only from returned fleets.
Document validation/errors and server denial remain unchanged. This is a fixed
presentation configuration, not runtime invitation detection or a security gate.
No API additions, feature framework, live backend/browser acceptance, production
build, downloads, push, commit, remote PR, merge, hosting or spending are authorized.
The frozen reference package is not replaced. Production remains NO-GO.
