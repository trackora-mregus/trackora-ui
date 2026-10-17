import { describe, expect, it, vi } from 'vitest';
import * as Sentry from '@sentry/angular';
import type { Envelope } from '@sentry/core';
import { HttpErrorResponse } from '@angular/common/http';

import { createSentryOptions, MonitoringGateway, type MonitoringSdk } from './monitoring-gateway';
import {
  createInMemoryMonitoringTransport,
  serializeEnvelopeForAssertion,
} from './monitoring-test-transport';

const enabled = {
  state: 'enabled' as const,
  dsn: 'https://public@example.ingest.sentry.io/123',
  environment: 'preview' as const,
  release: `trackora-ui@${'a'.repeat(40)}`,
  dist: 'trk-aaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  sampleRate: 1,
};

describe('MonitoringGateway', () => {
  it('verifies the pinned 11.8.0 default integration names before applying the allowlist', () => {
    expect(Sentry.getDefaultIntegrations({}).map((integration) => integration.name)).toEqual([
      'EventFilters',
      'FunctionToString',
      'ConversationId',
      'Breadcrumbs',
      'Console',
      'GlobalHandlers',
      'LinkedErrors',
      'Dedupe',
      'HttpContext',
      'CultureContext',
      'BrowserSession',
    ]);
  });
  it('uses only EventFilters and Dedupe with all ambient collection disabled', () => {
    const integrations = [
      { name: 'GlobalHandlers' },
      { name: 'EventFilters' },
      { name: 'Dedupe' },
      { name: 'Breadcrumbs' },
    ];
    const options = createSentryOptions(enabled);
    expect(
      (options.integrations as (values: { name: string }[]) => { name: string }[])(
        integrations,
      ).map((value) => value.name),
    ).toEqual(['EventFilters', 'Dedupe']);
    expect(options).toMatchObject({
      attachStacktrace: true,
      sendClientReports: false,
      maxBreadcrumbs: 0,
      enhanceFetchErrorMessages: false,
      tracesSampleRate: undefined,
      sampleRate: 1,
      dataCollection: {
        userInfo: false,
        cookies: false,
        httpHeaders: false,
        httpBodies: [],
        urlQueryParams: false,
        graphQL: { document: false, variables: false },
        genAI: { inputs: false, outputs: false },
        databaseQueryData: false,
        queues: false,
        stackFrameVariables: false,
        frameContextLines: 0,
      },
    });
  });

  it('does not initialize or capture while disabled', () => {
    const sdk: MonitoringSdk = { init: vi.fn(), captureException: vi.fn() };
    const gateway = new MonitoringGateway(sdk);
    gateway.initialize({ state: 'disabled', reason: 'not-enabled' });
    gateway.captureException(new Error('ignored'));
    expect(sdk.init).not.toHaveBeenCalled();
    expect(sdk.captureException).not.toHaveBeenCalled();
  });

  it('contains initialization and capture failures', () => {
    const sdk: MonitoringSdk = {
      init: vi.fn(() => {
        throw new Error('provider failed');
      }),
      captureException: vi.fn(() => {
        throw new Error('transport failed');
      }),
    };
    const gateway = new MonitoringGateway(sdk);
    expect(() => gateway.initialize(enabled)).not.toThrow();
    expect(() => gateway.captureException(new Error('application failure'))).not.toThrow();
  });

  it('classifies expected errors before the SDK sampling and transport boundary', () => {
    const captureException = vi.fn();
    const gateway = new MonitoringGateway({ init: vi.fn(() => ({})), captureException });
    gateway.initialize(enabled);
    gateway.captureException(new HttpErrorResponse({ status: 403, error: 'CANARY_BODY' }));
    expect(captureException).not.toHaveBeenCalled();
    expect(createSentryOptions(enabled).sampleRate).toBe(1);
    expect(
      createSentryOptions({ ...enabled, environment: 'production', sampleRate: 0.25 }).sampleRate,
    ).toBe(0.25);
  });

  it('serializes deterministic in-memory transport envelopes without network access', async () => {
    const stored: { serialized: string }[] = [];
    const transport = createInMemoryMonitoringTransport(stored)();
    const envelope = [
      { event_id: '0123456789abcdef0123456789abcdef' },
      [[{ type: 'event' }, { type: undefined, level: 'error' }]],
    ] as unknown as Envelope;
    await transport.send(envelope);
    expect(stored).toHaveLength(1);
    expect(stored[0].serialized).toContain('0123456789abcdef0123456789abcdef');
    expect(serializeEnvelopeForAssertion(envelope)).toContain('error');
  });
});
