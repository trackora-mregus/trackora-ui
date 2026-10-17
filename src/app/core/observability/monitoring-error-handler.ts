import { ErrorHandler } from '@angular/core';
import { SentryErrorHandler } from '@sentry/angular';

import { MonitoringGateway } from './monitoring-gateway';

export class MonitoringErrorHandler extends SentryErrorHandler {
  private readonly fallback = new ErrorHandler();

  constructor(private readonly gateway: MonitoringGateway) {
    super({ logErrors: false });
  }

  override handleError(error: unknown): void {
    try {
      if (this.gateway.shouldCapture(error)) super.handleError(error);
    } catch {
      // The normal Angular diagnostic path below remains authoritative.
    } finally {
      this.fallback.handleError(error);
    }
  }
}
