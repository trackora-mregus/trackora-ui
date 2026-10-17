import * as Sentry from '@sentry/angular';
import type { BrowserOptions } from '@sentry/browser';

import type { MonitoringConfiguration } from './monitoring-config';
import { classifyMonitoringCandidate, createBeforeSend, eventContext } from './monitoring-policy';

export interface MonitoringSdk {
  init(options: BrowserOptions): unknown;
  captureException(exception: unknown): unknown;
}

const sentrySdk: MonitoringSdk = {
  init: (options) => Sentry.init(options),
  captureException: (exception) => Sentry.captureException(exception),
};

export function createSentryOptions(
  configuration: Extract<MonitoringConfiguration, { state: 'enabled' }>,
): BrowserOptions {
  return {
    dsn: configuration.dsn,
    environment: configuration.environment,
    release: configuration.release,
    dist: configuration.dist,
    sampleRate: configuration.sampleRate,
    attachStacktrace: true,
    sendClientReports: false,
    maxBreadcrumbs: 0,
    enhanceFetchErrorMessages: false,
    tracesSampleRate: undefined,
    tracesSampler: undefined,
    profileSessionSampleRate: undefined,
    integrations: (defaultIntegrations) =>
      defaultIntegrations.filter(
        (integration) => integration.name === 'EventFilters' || integration.name === 'Dedupe',
      ),
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
    beforeSend: createBeforeSend(eventContext(configuration)),
  };
}

export class MonitoringGateway {
  private enabled = false;
  private readonly seen = new WeakSet<object>();

  constructor(private readonly sdk: MonitoringSdk = sentrySdk) {}

  initialize(configuration: MonitoringConfiguration): void {
    this.enabled = false;
    if (configuration.state !== 'enabled') return;
    try {
      const options = createSentryOptions(configuration);
      const client = this.sdk.init(options);
      if (!client) return;
      this.enabled = true;
    } catch {
      this.enabled = false;
    }
  }

  shouldCapture(candidate: unknown): boolean {
    try {
      if (!this.enabled || !classifyMonitoringCandidate(candidate).capture) return false;
      if (
        candidate !== null &&
        (typeof candidate === 'object' || typeof candidate === 'function')
      ) {
        const reference = candidate as object;
        if (this.seen.has(reference)) return false;
        this.seen.add(reference);
      }
      return true;
    } catch {
      return false;
    }
  }

  captureException(candidate: unknown): void {
    if (!this.shouldCapture(candidate)) return;
    try {
      this.sdk.captureException(candidate);
    } catch {
      // Monitoring must never interrupt application behavior.
    }
  }
}

export const monitoringGateway = new MonitoringGateway();
