import { Client } from '@stomp/stompjs';
import { describe, expect, it, vi } from 'vitest';

import { FleetLiveLocationService } from '../services/fleet-live-location.service';

class LifecycleClient {
  onConnect?: () => void;
  onStompError?: (frame: { headers: Record<string, string>; body: string }) => void;
  onWebSocketError?: (error: unknown) => void;
  readonly deactivate = vi.fn(async () => undefined);
  readonly subscribe = vi.fn(
    (_destination: string, callback: (message: { body: string }) => void) => {
      callback({
        body: JSON.stringify({
          vehicleId: 'vehicle-1',
          fleetId: 'fleet-1',
          recordedAt: '2026-01-01T00:00:00Z',
        }),
      });
    },
  );
  constructor(readonly options: ConstructorParameters<typeof Client>[0]) {}
  activate(): void {
    this.onConnect?.();
  }
}

class LifecycleService extends FleetLiveLocationService {
  client?: LifecycleClient;
  protected override createClient(options: ConstructorParameters<typeof Client>[0]): Client {
    this.client = new LifecycleClient(options);
    return this.client as unknown as Client;
  }
}

describe('WebSocket monitoring isolation', () => {
  it('retains connect, callback, five-second reconnect, and disconnect behavior without a monitoring call', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const service = new LifecycleService();
    const capture = vi.fn();
    const next = vi.fn();
    const subscription = service.connectToFleet('fleet-1').subscribe(next);
    expect(service.client?.options?.reconnectDelay).toBe(5000);
    expect(service.client?.subscribe).toHaveBeenCalledWith(
      '/topic/fleets/fleet-1',
      expect.any(Function),
    );
    expect(next).toHaveBeenCalledOnce();
    service.client?.onStompError?.({ headers: { message: 'routine reconnect' }, body: '' });
    service.client?.onWebSocketError?.(new Event('close'));
    expect(capture).not.toHaveBeenCalled();
    subscription.unsubscribe();
    expect(service.client?.deactivate).toHaveBeenCalledOnce();
    consoleError.mockRestore();
  });
});
