import { TestBed } from '@angular/core/testing';
import {
  HttpClient,
  HttpContext,
  HttpErrorResponse,
  HttpRequest,
  provideHttpClient,
  withInterceptors,
} from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { throwError } from 'rxjs';
import { errorInterceptor } from './error.interceptor';
import { LOCAL_FAILURE_FEEDBACK } from '../http/http-failure';
import { NotificationService } from '../services/notification.service';

describe('error feedback ownership', () => {
  const notifications = { error: vi.fn() };
  let http: HttpTestingController;
  beforeEach(() => {
    notifications.error.mockClear();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([errorInterceptor])),
        provideHttpClientTesting(),
        { provide: NotificationService, useValue: notifications },
      ],
    });
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());
  it.each([0, 400, 401, 403, 413, 415, 429, 500])(
    'retains %s error propagation with one unmarked notification',
    (status) => {
      const receive = vi.fn();
      TestBed.inject(HttpClient).get('/synthetic').subscribe({ error: receive });
      const req = http.expectOne('/synthetic');
      if (status === 0) req.error(new ProgressEvent('error'));
      else req.flush({ message: 'Readable server error' }, { status, statusText: 'Synthetic' });
      expect(receive).toHaveBeenCalledOnce();
      expect(receive.mock.calls[0][0].status).toBe(status);
      expect(notifications.error).toHaveBeenCalledOnce();
      if (status) expect(notifications.error).toHaveBeenCalledWith('Readable server error');
    },
  );
  it('suppresses only marked feedback while preserving the same error object', () => {
    const receive = vi.fn();
    TestBed.inject(HttpClient)
      .post('/synthetic', {}, { context: new HttpContext().set(LOCAL_FAILURE_FEEDBACK, true) })
      .subscribe({ error: receive });
    http
      .expectOne('/synthetic')
      .flush({ message: 'Readable rejection' }, { status: 401, statusText: 'Synthetic' });
    expect(receive).toHaveBeenCalledOnce();
    expect(receive.mock.calls[0][0].error).toEqual({ message: 'Readable rejection' });
    expect(notifications.error).not.toHaveBeenCalled();
  });
  it.each([
    { feedback: 'locally', locallyHandled: true },
    { feedback: 'globally', locallyHandled: false },
  ])('preserves error identity when handled $feedback', ({ locallyHandled }) => {
    const originalError = new HttpErrorResponse({
      error: { message: 'Readable rejection' },
      status: 401,
      statusText: 'Synthetic',
    });
    const request = new HttpRequest('GET', '/synthetic', {
      context: new HttpContext().set(LOCAL_FAILURE_FEEDBACK, locallyHandled),
    });
    const receive = vi.fn();

    TestBed.runInInjectionContext(() =>
      errorInterceptor(request, () => throwError(() => originalError)),
    ).subscribe({ error: receive });

    expect(receive).toHaveBeenCalledOnce();
    expect(receive.mock.calls[0][0]).toBe(originalError);
    if (locallyHandled) {
      expect(notifications.error).not.toHaveBeenCalled();
    } else {
      expect(notifications.error).toHaveBeenCalledOnce();
      expect(notifications.error).toHaveBeenCalledWith('Readable rejection');
    }
  });
});
