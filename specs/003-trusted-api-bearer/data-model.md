# Data model (#6)

No new domain model, persistence, token format, or state transition.

- **Destination**: immutable request URL including params, resolved against the
  current browser document base; trusted only by the boundary contract.
- **Credential**: existing AuthService token; tests use only a synthetic sentinel.
- **Request**: immutable Angular request; clone only to add Authorization when
  absent and destination trusted. Body, params, context, and other options persist.
