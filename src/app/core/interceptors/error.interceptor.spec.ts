import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { NotificationService } from '../services/notification.service';
import { errorInterceptor } from './error.interceptor';

describe('errorInterceptor expected HTTP outcomes', () => {
  let http: import('@angular/common/http').HttpClient;
  let controller: HttpTestingController;
  const notifications = { error: vi.fn() };

  beforeEach(() => {
    notifications.error.mockClear();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([errorInterceptor])),
        provideHttpClientTesting(),
        { provide: NotificationService, useValue: notifications },
      ],
    });
    http = TestBed.inject(HttpClient);
    controller = TestBed.inject(HttpTestingController);
  });

  afterEach(() => controller?.verify());

  it.each([400, 401, 403, 404, 409, 422, 429])(
    'preserves notification and rethrow semantics for HTTP %i',
    (status) => {
      let observed: unknown;
      http.get('/expected').subscribe({ error: (error) => (observed = error) });
      controller
        .expectOne('/expected')
        .flush('CANARY_RESPONSE_BODY', { status, statusText: 'Expected' });
      expect((observed as { status: number }).status).toBe(status);
      expect(notifications.error).toHaveBeenCalledTimes(1);
      expect(JSON.stringify(notifications.error.mock.calls)).not.toContain('CANARY_RESPONSE_BODY');
    },
  );
});
