export const DEFAULT_MONITORING_SAMPLE_RATES = {
  'local-verification': 0,
  preview: 1,
  production: 0.25,
} as const;

export type MonitoringEnvironment = keyof typeof DEFAULT_MONITORING_SAMPLE_RATES;
export type MonitoringDisabledReason =
  | 'not-enabled'
  | 'invalid-dsn'
  | 'invalid-environment'
  | 'invalid-release'
  | 'invalid-dist'
  | 'invalid-sample-rate'
  | 'initialization-failed';

export interface RawMonitoringConfiguration {
  enabled?: string;
  dsn?: string;
  environment?: string;
  release?: string;
  dist?: string;
  sampleRate?: string;
}

export type MonitoringConfiguration =
  | { state: 'disabled'; reason: MonitoringDisabledReason }
  | {
      state: 'enabled';
      dsn: string;
      environment: MonitoringEnvironment;
      release: string;
      dist: string;
      sampleRate: number;
    };

const RELEASE_PATTERN = /^trackora-ui@[0-9a-f]{40}$/;
const DIST_PATTERN = /^(?!dpl_)[A-Za-z0-9_-]{1,32}$/;

function isSentryDsn(value: string | undefined): value is string {
  if (!value) return false;
  try {
    const url = new URL(value);
    return (
      url.protocol === 'https:' &&
      /(^|\.)ingest(?:\.[a-z0-9-]+)?\.sentry\.io$/i.test(url.hostname) &&
      /^\/\d+\/?$/.test(url.pathname)
    );
  } catch {
    return false;
  }
}

export function parseMonitoringConfiguration(
  raw: RawMonitoringConfiguration,
): MonitoringConfiguration {
  try {
    if (raw.enabled !== 'true') return { state: 'disabled', reason: 'not-enabled' };
    if (!isSentryDsn(raw.dsn)) return { state: 'disabled', reason: 'invalid-dsn' };
    if (!raw.environment || !(raw.environment in DEFAULT_MONITORING_SAMPLE_RATES)) {
      return { state: 'disabled', reason: 'invalid-environment' };
    }
    if (!raw.release || !RELEASE_PATTERN.test(raw.release))
      return { state: 'disabled', reason: 'invalid-release' };
    if (!raw.dist || !DIST_PATTERN.test(raw.dist))
      return { state: 'disabled', reason: 'invalid-dist' };

    const environment = raw.environment as MonitoringEnvironment;
    const sampleRate =
      raw.sampleRate === undefined
        ? DEFAULT_MONITORING_SAMPLE_RATES[environment]
        : Number(raw.sampleRate);
    if (!Number.isFinite(sampleRate) || sampleRate < 0 || sampleRate > 1) {
      return { state: 'disabled', reason: 'invalid-sample-rate' };
    }
    return {
      state: 'enabled',
      dsn: raw.dsn,
      environment,
      release: raw.release,
      dist: raw.dist,
      sampleRate,
    };
  } catch {
    return { state: 'disabled', reason: 'not-enabled' };
  }
}

function compileTimeValue(
  name: 'enabled' | 'dsn' | 'environment' | 'release' | 'dist' | 'sampleRate',
): string | undefined {
  switch (name) {
    case 'enabled':
      return typeof TRACKORA_SENTRY_ENABLED === 'undefined' ? undefined : TRACKORA_SENTRY_ENABLED;
    case 'dsn':
      return typeof TRACKORA_SENTRY_DSN === 'undefined' ? undefined : TRACKORA_SENTRY_DSN;
    case 'environment':
      return typeof TRACKORA_SENTRY_ENVIRONMENT === 'undefined'
        ? undefined
        : TRACKORA_SENTRY_ENVIRONMENT;
    case 'release':
      return typeof TRACKORA_SENTRY_RELEASE === 'undefined' ? undefined : TRACKORA_SENTRY_RELEASE;
    case 'dist':
      return typeof TRACKORA_SENTRY_DIST === 'undefined' ? undefined : TRACKORA_SENTRY_DIST;
    case 'sampleRate':
      return typeof TRACKORA_SENTRY_SAMPLE_RATE === 'undefined'
        ? undefined
        : TRACKORA_SENTRY_SAMPLE_RATE;
  }
}

export function readMonitoringConfiguration(): MonitoringConfiguration {
  return parseMonitoringConfiguration({
    enabled: compileTimeValue('enabled'),
    dsn: compileTimeValue('dsn'),
    environment: compileTimeValue('environment'),
    release: compileTimeValue('release'),
    dist: compileTimeValue('dist'),
    sampleRate: compileTimeValue('sampleRate'),
  });
}
