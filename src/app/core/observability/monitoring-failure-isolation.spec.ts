import { describe, expect, it, vi } from 'vitest';

import { parseMonitoringConfiguration } from './monitoring-config';
import { MonitoringGateway, type MonitoringSdk } from './monitoring-gateway';
import { createBeforeSend } from './monitoring-policy';

const enabled = {
  state: 'enabled' as const,
  dsn: 'https://public@example.ingest.sentry.io/123',
  environment: 'preview' as const,
  release: `trackora-ui@${'a'.repeat(40)}`,
  dist: 'trk-aaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  sampleRate: 1,
};

function sdk(overrides: Partial<MonitoringSdk> = {}): MonitoringSdk {
  return {
    init: vi.fn(() => ({})),
    captureException: vi.fn(),
    ...overrides,
  };
}

describe('monitoring failure isolation matrix', () => {
  it.each([
    ['absent', parseMonitoringConfiguration({})],
    ['disabled', parseMonitoringConfiguration({ enabled: 'false' })],
    ['malformed', parseMonitoringConfiguration({ enabled: 'true', dsn: 'secret' })],
  ])('%s configuration is a nonthrowing no-op', (_name, configuration) => {
    const adapter = sdk();
    const gateway = new MonitoringGateway(adapter);
    expect(() => gateway.initialize(configuration)).not.toThrow();
    expect(() => gateway.captureException(new Error('application'))).not.toThrow();
    expect(adapter.captureException).not.toHaveBeenCalled();
  });

  it('enabled capture cannot propagate a blocked provider or transport failure', () => {
    const gateway = new MonitoringGateway(
      sdk({
        captureException: vi.fn(() => {
          throw new Error('blocked');
        }),
      }),
    );
    gateway.initialize(enabled);
    expect(() => gateway.captureException(new Error('application'))).not.toThrow();
  });

  it('initialization failure disables later capture without recursion', () => {
    const adapter = sdk({
      init: vi.fn(() => {
        throw new Error('initialization');
      }),
    });
    const gateway = new MonitoringGateway(adapter);
    expect(() => gateway.initialize(enabled)).not.toThrow();
    gateway.captureException(new Error('application'));
    expect(adapter.captureException).not.toHaveBeenCalled();
  });

  it('classification failure is contained and fails closed', () => {
    const gateway = new MonitoringGateway(sdk());
    gateway.initialize(enabled);
    const hostile = new Proxy(
      {},
      {
        getPrototypeOf: () => {
          throw new Error('classification failed');
        },
      },
    );
    expect(() => gateway.captureException(hostile)).not.toThrow();
  });

  it('hostile sanitizer input is dropped without invoking getters or leaking raw values', () => {
    const hostile = {
      type: undefined,
      exception: {
        values: [
          { type: 'Error', stacktrace: { frames: [{ filename: 'https://example.test/main.js' }] } },
        ],
      },
    };
    Object.defineProperty(hostile, 'user', {
      get: () => {
        throw new Error('CANARY_GETTER');
      },
    });
    const result = createBeforeSend({
      environment: 'preview',
      release: enabled.release,
      dist: enabled.dist,
    })(hostile, {});
    expect(result).not.toBeNull();
    expect(JSON.stringify(result)).not.toContain('CANARY_GETTER');
  });
});
