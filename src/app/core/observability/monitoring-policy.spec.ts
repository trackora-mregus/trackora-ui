import { HttpErrorResponse } from '@angular/common/http';
import { describe, expect, it } from 'vitest';

import {
  ExpectedApplicationOutcome,
  classifyMonitoringCandidate,
  createBeforeSend,
  type MonitoringEventContext,
} from './monitoring-policy';

const context: MonitoringEventContext = {
  environment: 'preview',
  release: `trackora-ui@${'a'.repeat(40)}`,
  dist: 'trk-aaaaaaaaaaaaaaaaaaaaaaaaaaaa',
};

describe('monitoring policy', () => {
  it.each([
    [400, 'validation-failure'],
    [401, 'authentication-expiry'],
    [403, 'authorization-denial'],
    [404, 'http-4xx'],
    [409, 'handled-outcome'],
    [422, 'validation-failure'],
    [429, 'http-4xx'],
  ] as const)('classifies HTTP %i as %s and never captures its body', (status, reason) => {
    const candidate = new HttpErrorResponse({ status, error: 'CANARY_BODY_TOKEN' });
    expect(classifyMonitoringCandidate(candidate)).toEqual({ capture: false, reason });
  });

  it('classifies cancellation and explicitly handled/reconnect outcomes', () => {
    expect(classifyMonitoringCandidate(new DOMException('cancelled', 'AbortError'))).toEqual({
      capture: false,
      reason: 'cancellation',
    });
    expect(
      classifyMonitoringCandidate(new ExpectedApplicationOutcome('routine-reconnect')),
    ).toEqual({ capture: false, reason: 'routine-reconnect' });
    expect(classifyMonitoringCandidate(new ExpectedApplicationOutcome('handled-outcome'))).toEqual({
      capture: false,
      reason: 'handled-outcome',
    });
  });

  it('reconstructs an event from an allowlist and removes every hostile value', () => {
    const canaries = [
      'password=CANARY_PASSWORD',
      'Bearer CANARY_JWT',
      'cookie=CANARY_COOKIE',
      'lat=40.7128&lng=-74.0060',
      'fleet-123',
      'vehicle-456',
      'device-789',
      'user@example.com',
      'https://trackora.test/vehicles/vehicle-456?token=CANARY#gps',
    ];
    const circular: Record<string, unknown> = {};
    circular['self'] = circular;
    Object.defineProperty(circular, 'danger', {
      get: () => {
        throw new Error('CANARY_GETTER');
      },
    });

    const sanitized = createBeforeSend(context)(
      {
        type: undefined,
        event_id: '0123456789abcdef0123456789abcdef',
        timestamp: 1,
        level: 'error',
        message: canaries.join(' '),
        request: { url: canaries[8], data: circular, headers: { authorization: canaries[1] } },
        user: { email: canaries[7] },
        tags: { fleetId: canaries[5] },
        extra: { cause: new Error('CANARY_CAUSE'), long: `CANARY_LONG_${'x'.repeat(10_000)}` },
        breadcrumbs: [{ message: canaries[0] }],
        exception: {
          values: [
            {
              type: 'TypeError',
              value: canaries.join(' '),
              stacktrace: {
                frames: [
                  {
                    filename: 'https://trackora.test/main-ABC.js?token=CANARY',
                    function: 'App.safeFn',
                    lineno: 12,
                    colno: 3,
                    in_app: true,
                  },
                ],
              },
            },
          ],
        },
      },
      { originalException: new Error('CANARY_PASSWORD') },
    );

    const serialized = JSON.stringify(sanitized);
    for (const canary of canaries) expect(serialized).not.toContain(canary);
    expect(serialized).not.toContain('CANARY_GETTER');
    expect(serialized).not.toContain('CANARY_CAUSE');
    expect(serialized).not.toContain('CANARY_LONG');
    expect(sanitized).toMatchObject({
      environment: 'preview',
      release: context.release,
      dist: context.dist,
    });
    expect(sanitized?.exception?.values?.[0]?.stacktrace?.frames?.[0]?.filename).toBe(
      '/main-ABC.js',
    );
  });

  it('fails closed when no useful sanitized stack remains', () => {
    const beforeSend = createBeforeSend(context);
    expect(beforeSend({ type: undefined, message: 'raw-only' }, {})).toBeNull();
    expect(
      beforeSend({ type: undefined, exception: { values: [{ type: 'Error', value: 'x' }] } }, {}),
    ).toBeNull();
  });

  it('keeps equivalent failures groupable while differentiating type or top frame', () => {
    const sanitize = createBeforeSend(context);
    const event = (type: string, filename: string, lineno: number) =>
      sanitize(
        {
          type: undefined,
          exception: {
            values: [
              {
                type,
                value: 'sensitive message',
                stacktrace: { frames: [{ filename, lineno, colno: 2, in_app: true }] },
              },
            ],
          },
        },
        {},
      );
    expect(event('TypeError', 'https://preview.example/a/main.js?vehicle=one', 10)).toEqual(
      event('TypeError', 'https://other.example/b/main.js?vehicle=two', 10),
    );
    expect(event('TypeError', 'https://preview.example/main.js', 10)).not.toEqual(
      event('RangeError', 'https://preview.example/main.js', 10),
    );
    expect(event('TypeError', 'https://preview.example/main.js', 10)).not.toEqual(
      event('TypeError', 'https://preview.example/chunk.js', 11),
    );
  });
});
