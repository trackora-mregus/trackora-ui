import { vi } from 'vitest';

import {
  parseMonitoringConfiguration,
  type MonitoringConfiguration,
} from '../app/core/observability/monitoring-config';
import {
  MonitoringGateway,
  type MonitoringSdk,
} from '../app/core/observability/monitoring-gateway';

const enabled: MonitoringConfiguration = {
  state: 'enabled',
  dsn: 'https://public@example.ingest.sentry.io/123',
  environment: 'preview',
  release: `trackora-ui@${'a'.repeat(40)}`,
  dist: 'trk-aaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  sampleRate: 1,
};

export const MONITORING_BOUNDARY_STATES = [
  'absent',
  'disabled',
  'malformed',
  'enabled',
  'blocked',
  'failing',
] as const;

function boundary(state: (typeof MONITORING_BOUNDARY_STATES)[number]): MonitoringGateway {
  const sdk: MonitoringSdk = {
    init: vi.fn(() =>
      state === 'failing'
        ? (() => {
            throw new Error('controlled initialization failure');
          })()
        : {},
    ),
    captureException: vi.fn(() =>
      state === 'blocked'
        ? (() => {
            throw new Error('controlled transport failure');
          })()
        : undefined,
    ),
  };
  const gateway = new MonitoringGateway(sdk);
  const configuration =
    state === 'absent'
      ? parseMonitoringConfiguration({})
      : state === 'disabled'
        ? parseMonitoringConfiguration({ enabled: 'false' })
        : state === 'malformed'
          ? parseMonitoringConfiguration({ enabled: 'true', dsn: 'malformed' })
          : enabled;
  gateway.initialize(configuration);
  if (state === 'blocked') gateway.captureException(new Error('boundary probe'));
  return gateway;
}

export async function runMonitoringBoundaryMatrix(
  assertWorkflow: (state: (typeof MONITORING_BOUNDARY_STATES)[number]) => void | Promise<void>,
): Promise<void> {
  for (const state of MONITORING_BOUNDARY_STATES) {
    boundary(state);
    await assertWorkflow(state);
  }
}
