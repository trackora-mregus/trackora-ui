import { HttpContextToken, HttpErrorResponse } from '@angular/common/http';

/** Only the marked request's caller owns user feedback; errors still propagate. */
export const LOCAL_FAILURE_FEEDBACK = new HttpContextToken<boolean>(() => false);

export type FailureContext = 'login' | 'upload' | 'request';
export type FailureKind =
  | 'transport'
  | 'credentials'
  | 'authentication'
  | 'permission'
  | 'validation'
  | 'size'
  | 'type'
  | 'rate-limit'
  | 'server'
  | 'unknown';
export interface HttpFailure {
  kind: FailureKind;
  message: string;
  guidance: string | null;
  retryAfterMs: number | null;
}

function readableMessage(body: unknown): string | null {
  const value: unknown =
    typeof body === 'string'
      ? body
      : body && typeof body === 'object' && !Array.isArray(body) && 'message' in body
        ? body.message
        : null;
  if (typeof value !== 'string' || !value.trim() || value.length > 1000) return null;
  // A serialized object is not a user-facing string message. Do not dump debug payloads.
  if (/^\s*[\[{]/.test(value)) {
    try {
      const parsed: unknown = JSON.parse(value);
      if (parsed && typeof parsed === 'object') return null;
    } catch {
      /* A normal message may begin with brackets; preserve it below. */
    }
  }
  // Do not render recognizable secrets/internal diagnostics.
  if (
    /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value) ||
    /\b(?:password|passwd|token|secret|api[_-]?key|authorization)\s*["']?\s*[:=]\s*\S/i.test(
      value,
    ) ||
    /\bbearer\s+\S|\beyJ[\w-]+\.[\w-]+\.[\w-]+|-----BEGIN [\w ]*PRIVATE KEY-----/i.test(value) ||
    /\b\w+:\/\/[^\s/@]+:[^\s/@]+@/i.test(value) ||
    /(?:\bat\s+[\w.$]+\([^)]*\.java:\d+\)|\b(?:SQLException|SQLSTATE|stacktrace|java\.[\w.$]+Exception)\b)/i.test(
      value,
    ) ||
    /\bSELECT\s+[*\w,. ]+\s+FROM\s+\w/.test(value) ||
    /(?:\/(?:Users|home|var|private|etc|opt)\/|[A-Z]:\\)/.test(value)
  )
    return null;
  return value;
}

export function readableRetryAfter(error: HttpErrorResponse, now = Date.now()): number | null {
  if (error.status !== 429) return null;
  const value = error.headers.get('Retry-After')?.trim();
  if (!value) return null;
  if (/^\d+$/.test(value)) {
    const ms = Number(value) * 1000;
    return Number.isSafeInteger(ms) ? ms : null;
  }
  if (
    !/^(Mon|Tue|Wed|Thu|Fri|Sat|Sun), \d{2} (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) \d{4} \d{2}:\d{2}:\d{2} GMT$/.test(
      value,
    )
  )
    return null;
  const date = Date.parse(value);
  return Number.isFinite(date) && new Date(date).toUTCString() === value
    ? Math.max(0, date - now)
    : null;
}

export function classifyHttpFailure(
  error: unknown,
  context: FailureContext = 'request',
): HttpFailure {
  const response = error instanceof HttpErrorResponse ? error : null;
  const status = response?.status ?? 0;
  const readable = status > 0 ? readableMessage(response?.error) : null;
  const retryAfterMs = response ? readableRetryAfter(response) : null;
  let kind: FailureKind = 'unknown';
  let fallback = 'The request could not be completed.';
  if (!response) {
    fallback =
      context === 'login'
        ? 'Sign-in could not be confirmed.'
        : context === 'upload'
          ? 'The upload outcome could not be confirmed.'
          : 'The request outcome could not be confirmed.';
  } else if (status === 0) {
    kind = 'transport';
    fallback =
      context === 'login'
        ? 'Sign-in could not be confirmed because of a transport failure.'
        : context === 'upload'
          ? 'The upload outcome could not be confirmed because of a transport failure.'
          : 'The request outcome could not be confirmed because of a transport failure.';
  } else if (status === 401) {
    // Verified backend response; it can also conceal pilot ineligibility. Bare 401 is insufficient.
    kind =
      context === 'login' && readable !== null && /^Invalid email or password\.?$/.test(readable)
        ? 'credentials'
        : 'authentication';
    fallback =
      context === 'login'
        ? 'Sign-in was not accepted. Check your details or contact support.'
        : 'Authentication required. Please log in again.';
  } else if (status === 403) {
    kind = 'permission';
    fallback = 'You do not have permission to perform this action.';
  } else if (status === 400) {
    kind = 'validation';
    fallback = 'Invalid request.';
  } else if (status === 413) {
    kind = 'size';
    fallback = 'The file exceeds the upload size limit.';
  } else if (status === 415) {
    kind = 'type';
    fallback = 'This file type is not supported.';
  } else if (status === 429) {
    kind = 'rate-limit';
    fallback = 'The request was limited. Wait before trying again.';
  } else if (status >= 500) {
    kind = 'server';
    fallback = 'Unexpected server error.';
  } else if (status === 404) {
    fallback = 'Requested resource was not found.';
  }
  let guidance: string | null =
    context === 'upload'
      ? status === 0 || status >= 500
        ? 'The server may have received the file. Check the document list before selecting it again.'
        : 'Select the file again if you choose to retry.'
      : null;
  if (retryAfterMs !== null) {
    const wait = `Wait at least ${Math.ceil(retryAfterMs / 1000)} seconds before trying again.`;
    guidance = guidance ? `${guidance} ${wait}` : wait;
  }
  return { kind, message: readable ?? fallback, guidance, retryAfterMs };
}

/** Render with text interpolation only, never innerHTML. */
export function failureText(failure: HttpFailure): string {
  return failure.guidance ? `${failure.message} ${failure.guidance}` : failure.message;
}
