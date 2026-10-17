import { createTransport, type Envelope, type Transport } from '@sentry/core';

export interface CapturedMonitoringEnvelope {
  serialized: string;
}

export function createInMemoryMonitoringTransport(
  store: CapturedMonitoringEnvelope[],
): () => Transport {
  return () =>
    createTransport({ recordDroppedEvent: () => undefined }, (request) => {
      store.push({
        serialized:
          typeof request.body === 'string' ? request.body : new TextDecoder().decode(request.body),
      });
      return Promise.resolve({ statusCode: 200 });
    });
}

export function serializeEnvelopeForAssertion(envelope: Envelope): string {
  return JSON.stringify(envelope);
}
