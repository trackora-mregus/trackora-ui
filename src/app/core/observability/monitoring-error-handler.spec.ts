import { HttpErrorResponse } from '@angular/common/http';
import { describe, expect, it, vi } from 'vitest';

import { MonitoringErrorHandler } from './monitoring-error-handler';
import { MonitoringGateway, type MonitoringSdk } from './monitoring-gateway';

function enabledGateway(): { gateway: MonitoringGateway; sdk: MonitoringSdk } {
  const sdk: MonitoringSdk = {
    init: vi.fn(() => ({})),
    captureException: vi.fn(),
  };
  const gateway = new MonitoringGateway(sdk);
  gateway.initialize({
    state: 'enabled',
    dsn: 'https://public@example.ingest.sentry.io/123',
    environment: 'preview',
    release: `trackora-ui@${'a'.repeat(40)}`,
    dist: 'trk-aaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    sampleRate: 1,
  });
  return { gateway, sdk };
}

describe('MonitoringErrorHandler', () => {
  it('always preserves the Angular console fallback', () => {
    const { gateway } = enabledGateway();
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const error = new Error('unexpected');
    new MonitoringErrorHandler(gateway).handleError(error);
    expect(consoleError).toHaveBeenCalledTimes(1);
    expect(consoleError).toHaveBeenCalledWith('ERROR', error);
    consoleError.mockRestore();
  });

  it('deduplicates the same object but permits distinct failures', () => {
    const { gateway } = enabledGateway();
    const first = new Error('same group');
    expect(gateway.shouldCapture(first)).toBe(true);
    expect(gateway.shouldCapture(first)).toBe(false);
    expect(gateway.shouldCapture(new Error('same group'))).toBe(true);
  });

  it('preserves fallback exactly once for an excluded expected HTTP error', () => {
    const { gateway } = enabledGateway();
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const error = new HttpErrorResponse({ status: 401, error: 'CANARY_BODY' });
    expect(() => new MonitoringErrorHandler(gateway).handleError(error)).not.toThrow();
    expect(consoleError).toHaveBeenCalledTimes(1);
    consoleError.mockRestore();
  });

  it('handles browser-forwarded Error values and primitive rejection reasons through one boundary', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { gateway } = enabledGateway();
    const handler = new MonitoringErrorHandler(gateway);
    const browserError = new Error('browser failure');
    handler.handleError(browserError);
    handler.handleError('primitive rejection');
    expect(consoleError).toHaveBeenCalledWith('ERROR', browserError);
    expect(consoleError).toHaveBeenCalledWith('ERROR', 'primitive rejection');
    consoleError.mockRestore();
  });
});
