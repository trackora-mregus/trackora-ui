import { ApplicationConfig, ErrorHandler, provideBrowserGlobalErrorListeners, provideZoneChangeDetection } from '@angular/core';
import {PreloadAllModules, provideRouter, withPreloading} from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';

import { routes } from './app.routes';
import { authInterceptor } from './core/interceptors/auth.interceptor';
import { errorInterceptor } from './core/interceptors/error.interceptor';
import {
  provideCharts,
  withDefaultRegisterables
} from 'ng2-charts';
import { MonitoringErrorHandler } from './core/observability/monitoring-error-handler';
import { MonitoringGateway, monitoringGateway } from './core/observability/monitoring-gateway';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    {provide: MonitoringGateway, useValue: monitoringGateway},
    {
      provide: ErrorHandler,
      useFactory: (gateway: MonitoringGateway) => new MonitoringErrorHandler(gateway),
      deps: [MonitoringGateway]
    },
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes, withPreloading(PreloadAllModules)),
    provideHttpClient(
      withInterceptors([
        authInterceptor,
        errorInterceptor
      ])
    ),
    provideCharts(withDefaultRegisterables())
  ]
};
