import 'zone.js';
import './app/chart-config';

import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';
import { readMonitoringConfiguration } from './app/core/observability/monitoring-config';
import { monitoringGateway } from './app/core/observability/monitoring-gateway';

export interface BootstrapMonitoringBoundary {
  captureException(error: unknown): void;
}

export function reportBootstrapFailure(
  error: unknown,
  boundary: BootstrapMonitoringBoundary = monitoringGateway,
): void {
  boundary.captureException(error);
  console.error(error);
}

monitoringGateway.initialize(readMonitoringConfiguration());

bootstrapApplication(App, appConfig).catch((error) => reportBootstrapFailure(error));
