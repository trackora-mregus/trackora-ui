# UI #10: bounded pilot maintenance-document discovery

Base: `58217883dc178950586136f5bc5a7b85d64ff8d3`.
Issue: https://github.com/trackora-mregus/trackora-ui/issues/10.
This is an uncommitted local candidate; independent review belongs to Othello.

## Behavior and requirements

R1. Pilot history loads no document lists automatically, for any history size.
Users explicitly load one row's list, refresh a successful list or retry a failed
list. Rows distinguish not loaded, loading, empty, success and error. Existing
successful documents survive refresh failure or another row's failure.

R2. A browser-root list gate permits one maintenance-document GET in flight and
at least 11 seconds between starts, including failed/cancelled attempts. There is
no queue and no automatic retry. At most six starts fit in any 60-second window,
including across vehicle changes or component recreation. Charge one hypothetical
OPTIONS per GET: at most 12 general requests and six OPTIONS for list discovery,
reserving 48 of 60 general and 24 of 30 OPTIONS slots for bootstrap, upload,
download and other activity. This is a conservative local policy, not a reservation
or guarantee of shared server capacity. Other tabs/callers can still cause rejection.

R3. Readable 429 and status-0 list failures pause new lists for at least 60 seconds.
A readable valid Retry-After on 429 extends that minimum, using seconds or an HTTP
date. Missing/invalid/inaccessible headers use the minimum. Expiry never sends a
request: another deliberate click is required. Status 0 is ambiguous; do not claim
it proves a server limit or change CORS/authentication.

R4. Overlapping triggers for one row coalesce by refusal while its operation is
active; cached lists require an explicit refresh. Upload/list overlap on that row
is refused rather than queued. Uploads remain deliberate and at most one per
workspace; no automatic upload retry or post-upload fan-out. Uploaded metadata is
merged without losing existing documents; a first upload does not imply a complete
list. Downloads and manual uploads use existing endpoints and the reserved budget,
not the list gate. No claim is made that all user actions are globally rate-limited.

R5. Selected-vehicle changes and destruction cancel list/upload subscriptions and
all pilot detail reads; no delayed response or notification may update the new
vehicle. Pending downloads/vehicle uploads are cancelled on that lifecycle too.
Client cancellation does not promise rollback of a server-side upload.

R6. Preserve normal nonpilot eager loading and existing allowed HTTP contracts,
bearer scope, tenant enforcement, upload validation and download behavior. No new
backend endpoint, dependency, batch API, CORS/limit change or excluded pilot call.

## Acceptance

Focused synthetic HTTP/virtual-time tests cover empty/one/large histories,
concurrency and modeled rolling/preflight counts, repeat triggers, preserved rows,
429/status 0, readable/unreadable Retry-After, cancellation, rapid route changes,
upload/list refresh overlap, included methods/paths and nonpilot/excluded-call
regression. Mocked timing cannot establish browser preflight behavior or hosted
admission. Full suite, production build, live services/browser and API security
acceptance remain separate gates; none are authorized by this task.
