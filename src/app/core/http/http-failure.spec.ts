import { HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { classifyHttpFailure, failureText, readableRetryAfter } from './http-failure';

const failure = (status: number, error: unknown, header?: string) =>
  new HttpErrorResponse({
    status,
    error,
    headers: new HttpHeaders(header === undefined ? {} : { 'Retry-After': header }),
  });
describe('typed HTTP failure presentation', () => {
  it.each([400, 401, 403, 413, 415, 429, 500, 503])(
    'preserves readable %s server messages verbatim',
    (status) => {
      const message = '  Please use a PDF file. <b>Keep this as text</b>  ';
      expect(classifyHttpFailure(failure(status, { message })).message).toBe(message);
      expect(classifyHttpFailure(failure(status, message)).message).toBe(message);
    },
  );
  it.each([
    null,
    {},
    [],
    { message: {} },
    { message: ['nested'] },
    { message: 8 },
    { message: '' },
    { message: '   ' },
  ])('does not stringify malformed body %j', (body) => {
    expect(classifyHttpFailure(failure(400, body)).message).toBe('Invalid request.');
  });
  it.each([
    'password=synthetic-sensitive-value',
    'token: synthetic-sensitive-value',
    'Authorization: Bearer synthetic-sensitive-value',
    'Bearer synthetic-sensitive-value',
    'eyJsynthetic.payload.signature',
    '-----BEGIN PRIVATE KEY-----',
    'https://synthetic:synthetic@example.invalid',
    'at test.Sample.method(Sample.java:12)',
    'java.lang.IllegalStateException: internal detail',
    'SQLSTATE 08001',
    'SELECT secret FROM settings',
    '/home/synthetic/internal',
    'C:\\synthetic\\internal',
    'control\u0001character',
    'x'.repeat(1001),
    '{"message":"debug object"}',
  ])('excludes narrowly unsafe text %s', (message) => {
    expect(classifyHttpFailure(failure(500, { message })).message).toBe('Unexpected server error.');
  });
  it('preserves harmless references to credentials and literal markup', () => {
    const message = '[Validation] Select a file from your computer.';
    expect(classifyHttpFailure(failure(400, { message })).message).toBe(message);
    expect(classifyHttpFailure(failure(400, { message: 'Password is required.' })).message).toBe(
      'Password is required.',
    );
    expect(
      classifyHttpFailure(failure(400, { message: '<img src=x onerror=alert(1)>' })).message,
    ).toBe('<img src=x onerror=alert(1)>');
  });
  it('only classifies the verified readable login rejection as credentials', () => {
    expect(
      classifyHttpFailure(failure(401, { message: 'Invalid email or password' }), 'login').kind,
    ).toBe('credentials');
    expect(classifyHttpFailure(failure(401, {}), 'login').kind).toBe('authentication');
    expect(classifyHttpFailure(failure(401, {}), 'login').message).not.toMatch(
      /invalid.*password/i,
    );
    expect(classifyHttpFailure(failure(401, { message: 'Session expired' }), 'login').message).toBe(
      'Session expired',
    );
  });
  it('ignores status-0 body/header claims and reports an uncertain upload outcome', () => {
    const classified = classifyHttpFailure(
      failure(0, { message: 'Invalid email or password' }, '30'),
      'upload',
    );
    expect(classified.kind).toBe('transport');
    expect(classified.retryAfterMs).toBeNull();
    expect(failureText(classified)).toContain('may have received the file');
    expect(failureText(classified)).not.toMatch(/offline|CORS|rate.limit|unreachable/);
    expect(classifyHttpFailure(new Error('internal details'), 'login').message).toContain(
      'could not be confirmed',
    );
  });
  it.each(['0', '12', ' 60 '])('uses readable Retry-After seconds %s', (header) => {
    expect(readableRetryAfter(failure(429, {}, header))).toBe(Number(header) * 1000);
  });
  it('uses a valid readable HTTP-date and rejects an impossible date', () => {
    const now = Date.parse('Sat, 07 Nov 2026 01:00:00 GMT');
    expect(readableRetryAfter(failure(429, {}, 'Sat, 07 Nov 2026 01:01:00 GMT'), now)).toBe(60000);
    expect(readableRetryAfter(failure(429, {}, 'Tue, 31 Feb 2026 01:00:00 GMT'), now)).toBeNull();
  });
  it.each([undefined, '', '-1', '1.5', 'later', 'Infinity', '999999999999999999', '2026-11-07'])(
    'does not invent Retry-After from %s',
    (header) => {
      expect(readableRetryAfter(failure(429, {}, header))).toBeNull();
    },
  );
});
