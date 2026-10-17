import { HttpErrorResponse } from '@angular/common/http';
import type { ErrorEvent, EventHint, Exception, StackFrame } from '@sentry/core';

import type { MonitoringConfiguration } from './monitoring-config';

export type ExpectedMonitoringReason =
  | 'http-4xx'
  | 'cancellation'
  | 'authentication-expiry'
  | 'authorization-denial'
  | 'validation-failure'
  | 'handled-outcome'
  | 'routine-reconnect';

export class ExpectedApplicationOutcome extends Error {
  constructor(readonly monitoringReason: 'handled-outcome' | 'routine-reconnect') {
    super('Expected application outcome');
    this.name = 'ExpectedApplicationOutcome';
  }
}

export type MonitoringClassification =
  | { capture: true }
  | { capture: false; reason: ExpectedMonitoringReason };

export interface MonitoringEventContext {
  environment: 'production' | 'preview' | 'local-verification';
  release: string;
  dist: string;
}

export function classifyMonitoringCandidate(candidate: unknown): MonitoringClassification {
  if (candidate instanceof ExpectedApplicationOutcome) {
    return { capture: false, reason: candidate.monitoringReason };
  }
  if (candidate instanceof DOMException && candidate.name === 'AbortError') {
    return { capture: false, reason: 'cancellation' };
  }
  if (candidate instanceof HttpErrorResponse) {
    if (candidate.status === 401) return { capture: false, reason: 'authentication-expiry' };
    if (candidate.status === 403) return { capture: false, reason: 'authorization-denial' };
    if (candidate.status === 400 || candidate.status === 422)
      return { capture: false, reason: 'validation-failure' };
    if (candidate.status === 409) return { capture: false, reason: 'handled-outcome' };
    if (candidate.status >= 400 && candidate.status < 500)
      return { capture: false, reason: 'http-4xx' };
  }
  return { capture: true };
}

const SAFE_EXCEPTION_TYPES = new Set([
  'Error',
  'TypeError',
  'RangeError',
  'ReferenceError',
  'SyntaxError',
  'URIError',
  'EvalError',
  'DOMException',
  'UnhandledRejection',
  'ErrorEvent',
]);
const SAFE_CODE_PATH = /\.(?:[cm]?js|ts)$/i;

function sanitizeCodePath(value: unknown): string | undefined {
  if (typeof value !== 'string' || value.length > 2048) return undefined;
  try {
    const url = new URL(value, 'https://trackora.invalid');
    const path = decodeURI(url.pathname);
    const basename = path.split('/').filter(Boolean).at(-1);
    if (!basename || !SAFE_CODE_PATH.test(basename)) return undefined;
    return `/${basename}`;
  } catch {
    return undefined;
  }
}

function sanitizeFrame(frame: StackFrame): StackFrame | undefined {
  const filename = sanitizeCodePath(frame.filename);
  if (!filename) return undefined;
  const sanitized: StackFrame = { filename };
  if (Number.isSafeInteger(frame.lineno) && (frame.lineno ?? 0) > 0)
    sanitized.lineno = frame.lineno;
  if (Number.isSafeInteger(frame.colno) && (frame.colno ?? 0) > 0) sanitized.colno = frame.colno;
  if (typeof frame.in_app === 'boolean') sanitized.in_app = frame.in_app;
  return sanitized;
}

function sanitizeException(exception: Exception): Exception | undefined {
  const frames = exception.stacktrace?.frames
    ?.map(sanitizeFrame)
    .filter((frame): frame is StackFrame => frame !== undefined);
  if (!frames?.length) return undefined;
  const type =
    typeof exception.type === 'string' && SAFE_EXCEPTION_TYPES.has(exception.type)
      ? exception.type
      : 'Error';
  return { type, value: `[redacted ${type}]`, stacktrace: { frames } };
}

function sanitizeDebugMeta(event: ErrorEvent): ErrorEvent['debug_meta'] | undefined {
  const images = event.debug_meta?.images?.flatMap((image) => {
    if (image.type !== 'sourcemap') return [];
    const codeFile = sanitizeCodePath(image.code_file);
    const debugId =
      typeof image.debug_id === 'string' && /^[0-9a-f-]{32,36}$/i.test(image.debug_id)
        ? image.debug_id
        : undefined;
    return codeFile && debugId
      ? [{ type: image.type, code_file: codeFile, debug_id: debugId }]
      : [];
  });
  return images?.length ? { images } : undefined;
}

export function createBeforeSend(
  context: MonitoringEventContext,
): (event: ErrorEvent, hint: EventHint) => ErrorEvent | null {
  return (event: ErrorEvent): ErrorEvent | null => {
    try {
      const values = event.exception?.values
        ?.map(sanitizeException)
        .filter((value): value is Exception => value !== undefined);
      if (!values?.length) return null;
      const sanitized: ErrorEvent = {
        type: undefined,
        level: 'error',
        platform: 'javascript',
        environment: context.environment,
        release: context.release,
        dist: context.dist,
        exception: { values },
      };
      if (typeof event.event_id === 'string' && /^[0-9a-f]{32}$/i.test(event.event_id))
        sanitized.event_id = event.event_id;
      if (typeof event.timestamp === 'number' && Number.isFinite(event.timestamp))
        sanitized.timestamp = event.timestamp;
      if (
        event.sdk?.name === 'sentry.javascript.angular' &&
        typeof event.sdk.version === 'string' &&
        /^11\.8\.0(?:\b|$)/.test(event.sdk.version)
      ) {
        sanitized.sdk = {
          name: event.sdk.name.slice(0, 80),
          version: event.sdk.version.slice(0, 40),
        };
      }
      const debugMeta = sanitizeDebugMeta(event);
      if (debugMeta) sanitized.debug_meta = debugMeta;
      return sanitized;
    } catch {
      return null;
    }
  };
}

export function eventContext(
  configuration: Extract<MonitoringConfiguration, { state: 'enabled' }>,
): MonitoringEventContext {
  return {
    environment: configuration.environment,
    release: configuration.release,
    dist: configuration.dist,
  };
}
