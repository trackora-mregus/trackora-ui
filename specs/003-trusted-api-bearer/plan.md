# Implementation Plan: Trusted API bearer boundary

**Branch**: `security/6-trusted-api-bearer` | **Date**: 2026-10-23
**Spec**: [spec.md](spec.md) | **Issue**: #6

## Summary

Restrict the existing functional interceptor to the configured parsed API origin
and path boundary. Preserve explicit Authorization. Reject ambiguous raw paths
before URL normalization can hide traversal. Keep changes to the interceptor,
its colocated tests, and these issue-linked artifacts.

## Technical Context

- TypeScript 5.9 / Angular 21 standalone frontend; existing URL and DOCUMENT APIs.
- Existing Angular unit-test builder, Vitest, jsdom, HttpTestingController.
- No new dependencies, storage, backend contracts, or environment changes.
- Development trust: `http://localhost:8080/api`.
- Production trust: `https://trackora-api-cxjn.onrender.com/api`.
- One active environment only; compare normalized origin including effective port.
- Browser HTTP transport; constant work per request apart from linear URL parsing.

## Constitution Check

Before and after design: PASS. Existing integration ownership and typed request
contracts remain intact; backend authorization is unchanged. No tenant data,
logging, telemetry, UI, lifecycle, framework, configuration, or deployment changes.
Regression tests and local gates are required; known unavailable hosted evidence
will be recorded without claiming end-to-end rollout completion.

## Research and Design

See [research.md](research.md), [data-model.md](data-model.md), and
[contracts/bearer-boundary.md](contracts/bearer-boundary.md). No unresolved design
questions. No backend work or new abstraction is necessary.

## Project Structure

- `src/app/core/interceptors/auth.interceptor.ts`: destination predicate and clone.
- `src/app/core/interceptors/auth.interceptor.spec.ts`: intercepted regression matrix.
- `specs/003-trusted-api-bearer/`: bounded specification and verification evidence.

## Verification and Release

Run the [quickstart](quickstart.md) locally. Never contact NHTSA or the API in tests.
No deployment or Preview is authorized. Later rollout must verify supported
browser transports and approved authenticated workflows with interception, map
the committed candidate to CI and deployed build, and assess exposure separately.
Rollback must retain this boundary; never silently restore the unsafe interceptor.
If no safe prior build exists, the owner decides containment before rollback.
