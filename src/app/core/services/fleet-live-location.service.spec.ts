import { Client } from '@stomp/stompjs';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { FleetLiveLocationService } from './fleet-live-location.service';
import { runMonitoringBoundaryMatrix } from '../../../testing/monitoring-boundary-fixtures.spec-helper';

class MockClient {
  onConnect?: () => void;
  onStompError?: (frame: { headers: Record<string, string>; body: string }) => void;
  onWebSocketError?: (error: unknown) => void;
  readonly deactivate = vi.fn(async () => undefined);
  readonly subscriptions: Array<(message: { body: string }) => void> = [];

  constructor(readonly options: ConstructorParameters<typeof Client>[0]) {}

  activate(): void {
    this.onConnect?.();
  }
  subscribe(_destination: string, callback: (message: { body: string }) => void): void {
    this.subscriptions.push(callback);
  }
  emit(value: unknown): void {
    this.subscriptions[0]?.({ body: JSON.stringify(value) });
  }
  emitRaw(body: string): void {
    this.subscriptions[0]?.({ body });
  }
}

class TestFleetLiveLocationService extends FleetLiveLocationService {
  readonly clients: MockClient[] = [];

  protected override createClient(options: ConstructorParameters<typeof Client>[0]): Client {
    const client = new MockClient(options);
    this.clients.push(client);
    return client as unknown as Client;
  }
}

describe('FleetLiveLocationService', () => {
  afterEach(() => vi.restoreAllMocks());

  it('shares one client and keeps the remaining subscriber active', () => {
    const service = new TestFleetLiveLocationService();
    const stream = service.connectToFleet('fleet-1');
    const first = vi.fn();
    const second = vi.fn();
    const subscription1 = stream.subscribe(first);
    const subscription2 = stream.subscribe(second);
    expect(service.clients).toHaveLength(1);
    expect(service.clients[0].options?.reconnectDelay).toBe(5000);

    service.clients[0].emit({
      vehicleId: 'vehicle-1',
      fleetId: 'fleet-1',
      recordedAt: '2026-09-25T12:00:00Z',
    });
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);
    subscription1.unsubscribe();
    expect(service.clients[0].deactivate).not.toHaveBeenCalled();
    service.clients[0].emit({
      vehicleId: 'vehicle-1',
      fleetId: 'fleet-1',
      recordedAt: '2026-09-25T12:01:00Z',
    });
    expect(second).toHaveBeenCalledTimes(2);
    subscription2.unsubscribe();
    expect(service.clients[0].deactivate).toHaveBeenCalledTimes(1);
  });

  it('creates a fresh client after final teardown', () => {
    const service = new TestFleetLiveLocationService();
    const stream = service.connectToFleet('fleet-1');
    const first = stream.subscribe();
    first.unsubscribe();
    const second = stream.subscribe();
    expect(service.clients).toHaveLength(2);
    second.unsubscribe();
  });

  it('isolates malformed messages and delivers later valid messages', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const service = new TestFleetLiveLocationService();
    const next = vi.fn();
    const subscription = service.connectToFleet('fleet-1').subscribe(next);
    service.clients[0].emitRaw('{bad json');
    service.clients[0].emit({
      vehicleId: 'vehicle-1',
      fleetId: 'fleet-1',
      recordedAt: '2026-09-25T12:00:00Z',
    });
    expect(next).toHaveBeenCalledTimes(1);
    subscription.unsubscribe();
  });

  it('preserves shared-consumer and teardown behavior across every monitoring boundary state', async () => {
    await runMonitoringBoundaryMatrix(() => {
      const service = new TestFleetLiveLocationService();
      const stream = service.connectToFleet('fleet-1');
      const first = stream.subscribe();
      const second = stream.subscribe();
      expect(service.clients).toHaveLength(1);
      first.unsubscribe();
      expect(service.clients[0].deactivate).not.toHaveBeenCalled();
      second.unsubscribe();
      expect(service.clients[0].deactivate).toHaveBeenCalledOnce();
    });
  });
});
