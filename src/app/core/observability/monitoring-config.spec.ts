import { describe, expect, it } from 'vitest';

import { DEFAULT_MONITORING_SAMPLE_RATES, parseMonitoringConfiguration } from './monitoring-config';

const valid = {
  enabled: 'true',
  dsn: 'https://public@example.ingest.sentry.io/123',
  environment: 'preview',
  release: `trackora-ui@${'a'.repeat(40)}`,
  dist: 'trk-aaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  sampleRate: '1',
} as const;

describe('parseMonitoringConfiguration', () => {
  it('stays disabled unless monitoring is explicitly and completely enabled', () => {
    expect(parseMonitoringConfiguration({}).state).toBe('disabled');
    expect(parseMonitoringConfiguration({ ...valid, enabled: 'false' }).state).toBe('disabled');
    expect(parseMonitoringConfiguration({ ...valid, dsn: undefined }).state).toBe('disabled');
  });

  it('accepts the immutable Vercel release and deployment identity', () => {
    expect(parseMonitoringConfiguration(valid)).toEqual({
      state: 'enabled',
      dsn: valid.dsn,
      environment: 'preview',
      release: valid.release,
      dist: valid.dist,
      sampleRate: 1,
    });
  });

  it.each(['http://example.ingest.sentry.io/1', 'https://example.com/1', 'not-a-url'])(
    'rejects unsafe DSN %s',
    (dsn) => {
      expect(parseMonitoringConfiguration({ ...valid, dsn })).toMatchObject({
        state: 'disabled',
        reason: 'invalid-dsn',
      });
    },
  );

  it.each(['NaN', 'Infinity', '-0.01', '1.01', 'oops'])(
    'rejects malformed sample rate %s',
    (sampleRate) => {
      expect(parseMonitoringConfiguration({ ...valid, sampleRate })).toMatchObject({
        state: 'disabled',
        reason: 'invalid-sample-rate',
      });
    },
  );

  it('uses conservative environment defaults', () => {
    expect(DEFAULT_MONITORING_SAMPLE_RATES).toEqual({
      'local-verification': 0,
      preview: 1,
      production: 0.25,
    });
    expect(
      parseMonitoringConfiguration({ ...valid, environment: 'production', sampleRate: undefined }),
    ).toMatchObject({ sampleRate: 0.25 });
    expect(
      parseMonitoringConfiguration({
        ...valid,
        environment: 'local-verification',
        sampleRate: undefined,
      }),
    ).toMatchObject({ sampleRate: 0 });
  });

  it('returns only fixed diagnostic reason codes', () => {
    const result = parseMonitoringConfiguration({ ...valid, release: 'secret-value' });
    expect(result).toEqual({ state: 'disabled', reason: 'invalid-release' });
    expect(JSON.stringify(result)).not.toContain('secret-value');
  });

  it.each(['dpl_internal-record', 'trk.invalid', 'trk-invalid/value', `trk-${'a'.repeat(29)}`])(
    'rejects unsupported custom Build Output deployment ID %s',
    (dist) => {
      expect(parseMonitoringConfiguration({ ...valid, dist })).toEqual({
        state: 'disabled',
        reason: 'invalid-dist',
      });
    },
  );

  it.each(['0', '0.25', '1'])('accepts inclusive sampling value %s', (sampleRate) => {
    expect(parseMonitoringConfiguration({ ...valid, sampleRate })).toMatchObject({
      state: 'enabled',
      sampleRate: Number(sampleRate),
    });
  });
});
