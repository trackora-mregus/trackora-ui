import { DOCUMENT } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  HttpClient,
  HttpContext,
  HttpContextToken,
  HttpErrorResponse,
  HttpHeaders,
  HttpParams,
  HttpRequest,
  HttpResponse,
  provideHttpClient,
  withInterceptors,
} from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { environment } from '../../../environments/environment';
import { environment as productionEnvironment } from '../../../environments/environment.prod';
import { AuthService } from '../auth/auth.service';
import { VehicleService } from '../services/vehicle.service';
import { VehicleDocumentService } from '../services/vehicle-document.service';
import { NotificationService } from '../services/notification.service';
import { authInterceptor } from './auth.interceptor';
import { errorInterceptor } from './error.interceptor';

// Synthetic only. Every HttpClient request terminates at HttpTestingController.
const SENTINEL = 'synthetic-trackora-issue-6-sentinel';
const originalApiBase = environment.apiBaseUrl;

describe.each([originalApiBase, productionEnvironment.apiBaseUrl])(
  'authInterceptor with API %s',
  (apiBase) => {
    const trusted = new URL(apiBase);
    const origin = trusted.origin;
    let http: HttpClient;
    let controller: HttpTestingController;
    let base: HTMLBaseElement;
    const getToken = vi.fn<() => string | null>();
    const notifyError = vi.fn();

    beforeEach(() => {
      environment.apiBaseUrl = apiBase;
      getToken.mockReset().mockReturnValue(SENTINEL);
      notifyError.mockReset();
      // A real <base> element exercises document.baseURI, rather than API-relative resolution.
      base = document.createElement('base');
      base.href = 'https://ui.example.invalid/vehicles/';
      document.head.prepend(base);
      TestBed.configureTestingModule({
        providers: [
          provideHttpClient(withInterceptors([authInterceptor, errorInterceptor])),
          provideHttpClientTesting(),
          { provide: AuthService, useValue: { getToken } },
          { provide: NotificationService, useValue: { error: notifyError } },
        ],
      });
      http = TestBed.inject(HttpClient);
      controller = TestBed.inject(HttpTestingController);
    });

    afterEach(() => {
      controller.verify();
      base.remove();
      environment.apiBaseUrl = originalApiBase;
      vi.restoreAllMocks();
    });

    function expectBearer(url: string, attached: boolean): void {
      http.get(url).subscribe();
      const request = controller.expectOne(url);
      expect(request.request.headers.getAll('Authorization')).toEqual(
        attached ? [`Bearer ${SENTINEL}`] : null,
      );
      expect(request.request.url).toBe(url);
      request.flush({});
    }

    it.each([
      '',
      '/',
      '/vehicles/synthetic-vehicle',
      '/vehicles/synthetic-vehicle/documents',
      '/vehicle-documents/synthetic-document/download',
      '/documents/synthetic%20file.pdf',
      '/documents/synthetic%2Dfile.pdf',
      '/documents/%E2%9C%93.pdf',
      '/vehicles?returnTo=https://outside.invalid/api',
      '/vehicles#https://outside.invalid/api',
      '/vehicles?encoded=%2f%2e%2e%252f',
    ])('attaches exactly one bearer to the allowed path suffix %s', (suffix) => {
      expectBearer(`${apiBase}${suffix}`, true);
    });

    it('uses normalized host casing and the effective default port', () => {
      const port = trusted.port || (trusted.protocol === 'https:' ? '443' : '80');
      expectBearer(
        `${trusted.protocol}//${trusted.hostname.toUpperCase()}:${port}/api/vehicles`,
        true,
      );
    });

    const wrongScheme = trusted.protocol === 'https:' ? 'http:' : 'https:';
    const rejected = [
      'https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVin/SYNTHETICVIN000001?format=json',
      'https://outside.invalid/api/vehicles',
      `${trusted.protocol}//${trusted.hostname}.outside.invalid${trusted.port ? `:${trusted.port}` : ''}/api`,
      `${trusted.protocol}//sub.${trusted.host}/api`,
      `${trusted.protocol}//${trusted.hostname}.:${trusted.port || '443'}/api`,
      `${trusted.protocol}//${trusted.hostname}:9999/api`,
      `${wrongScheme}//${trusted.host}/api`,
      `ftp://${trusted.host}/api`,
      `ws://${trusted.host}/api`,
      `javascript:${apiBase}`,
      `data:text/plain,${apiBase}`,
      `blob:${apiBase}`,
      `${trusted.protocol}//user@${trusted.host}/api`,
      `${trusted.protocol}//user:pass@${trusted.host}/api`,
      `${trusted.protocol}//@${trusted.host}/api`,
      `${trusted.protocol}//${trusted.host}@outside.invalid/api`,
      apiBase === originalApiBase ? productionEnvironment.apiBaseUrl : originalApiBase,
      `${origin}/apievil`,
      `${origin}/api-v2/vehicles`,
      `${origin}/API/vehicles`,
      `${origin}/api;other/vehicles`,
      `${origin}/outside?next=${apiBase}`,
      `${origin}/outside#${apiBase}`,
      `https://outside.invalid/?next=${apiBase}`,
      `${apiBase}/../auth`,
      `${apiBase}/../api/vehicles`,
      `${origin}/outside/../api/vehicles`,
      `${apiBase}/./vehicles`,
      `${apiBase}/%2e/vehicles`,
      `${apiBase}/%2E%2e/api/vehicles`,
      `${apiBase}/.%2e/api/vehicles`,
      `${apiBase}/%2e./api/vehicles`,
      `${apiBase}/%2foutside`,
      `${apiBase}/%5Coutside`,
      `${origin}/api%2fvehicles`,
      `${origin}/%61pi/vehicles`,
      `${apiBase}/%252e%252e/outside`,
      `${apiBase}/%25252foutside`,
      `${apiBase}/%00`,
      `${apiBase}/%0d%0a`,
      `${apiBase}/%`,
      `${apiBase}/%GG`,
      `${apiBase}/%C0%AF`,
      `${apiBase}\\outside`,
      `${trusted.protocol}\\\\${trusted.host}/api`,
      `${trusted.protocol}${trusted.host}/api`,
      `${trusted.protocol}///${trusted.host}/api`,
      `///${trusted.host}/api`,
      `${trusted.protocol}//`,
      'https://[invalid/api',
      'http://localhost:not-a-port/api',
      ` ${apiBase}`,
      `${apiBase} `,
      `${apiBase}/line\nbreak`,
      `${apiBase}/tab\tsegment`,
      '',
    ];

    it.each(rejected)('does not inject a Trackora credential into %s', (url) => {
      expectBearer(url, false);
    });

    it.each([`${apiBase}/vehicles`, 'https://outside.invalid/api'])(
      'leaves requests without a stored token unchanged: %s',
      (url) => {
        getToken.mockReturnValue(null);
        expectBearer(url, false);
        getToken.mockReturnValue('');
        expectBearer(url, false);
      },
    );

    it.each([`${apiBase}/vehicles`, 'https://outside.invalid/api'])(
      'preserves caller Authorization (including empty and multiple values): %s',
      (url) => {
        for (const values of [
          ['Basic synthetic-third-party'],
          [''],
          ['Bearer synthetic-caller'],
          ['one', 'two'],
        ]) {
          http.get(url, { headers: new HttpHeaders({ aUtHoRiZaTiOn: values }) }).subscribe();
          const request = controller.expectOne(url);
          expect(request.request.headers.getAll('Authorization')).toEqual(values);
          request.flush({});
        }
      },
    );

    it.each(['/api/vehicles', 'api/vehicles', 'vehicles', `//${trusted.host}/api/vehicles`])(
      'uses the UI browser base for relative reference %s',
      (url) => {
        expect(TestBed.inject(DOCUMENT).baseURI).toBe(base.href);
        const resolved = new URL(url, document.baseURI);
        expectBearer(url, resolved.origin === origin && resolved.pathname.startsWith('/api/'));
      },
    );

    it('uses current browser base and its scheme for relative and protocol-relative URLs', () => {
      base.href = `${apiBase}/`;
      for (const url of [
        '/api/vehicles',
        'vehicles',
        `//${trusted.host}/api/vehicles`,
        '?synthetic=1',
      ]) {
        expectBearer(url, true);
      }
      for (const url of ['../api/vehicles', '%2e%2e/api/vehicles', '/apievil']) {
        expectBearer(url, false);
      }
      base.href = 'https://ui.example.invalid/vehicles/';
      expectBearer('/api/vehicles', false);
    });

    it('does not trust unrelated paths even when the browser base shares the API origin', () => {
      base.href = `${origin}/outside/`;
      expectBearer('vehicles', false);
      expectBearer('/api/vehicles', true);
    });

    it('does not read the stored token for external destinations', () => {
      expectBearer('https://outside.invalid/api', false);
      expect(getToken).not.toHaveBeenCalled();
    });

    it('fails closed for a relative URL with an unusable browser base', () => {
      vi.spyOn(TestBed.inject(DOCUMENT), 'baseURI', 'get').mockReturnValue('about:blank');
      expectBearer('/api/vehicles', false);
      expectBearer(`${apiBase}/vehicles`, true);
    });

    it('preserves body, params, headers, context, and response behavior when cloning', () => {
      const marker = new HttpContextToken(() => 'default');
      const context = new HttpContext().set(marker, 'synthetic-context');
      const body = { synthetic: true };
      const params = new HttpParams().set('page', 2).set('q', 'test value');
      const original = new HttpRequest('POST', `${apiBase}/vehicles`, body, {
        params,
        headers: new HttpHeaders({ 'X-Synthetic': 'preserved' }),
        context,
        reportProgress: true,
        withCredentials: true,
        responseType: 'text',
      });
      const response = new HttpResponse({ body: 'synthetic response' });
      const next = vi.fn((request: HttpRequest<unknown>) => {
        expect(request).not.toBe(original);
        expect(request.body).toBe(body);
        expect(request.params).toBe(params);
        expect(request.urlWithParams).toBe(original.urlWithParams);
        expect(request.context).toBe(context);
        expect(request.headers.get('X-Synthetic')).toBe('preserved');
        expect(request.headers.getAll('Authorization')).toEqual([`Bearer ${SENTINEL}`]);
        expect(request.method).toBe('POST');
        expect(request.responseType).toBe('text');
        expect(request.reportProgress).toBe(true);
        expect(request.withCredentials).toBe(true);
        return of(response);
      });
      const received = vi.fn();
      TestBed.runInInjectionContext(() => authInterceptor(original, next)).subscribe(received);
      expect(next).toHaveBeenCalledTimes(1);
      expect(original.headers.has('Authorization')).toBe(false);
      expect(received).toHaveBeenCalledWith(response);
    });

    it('passes untrusted and explicitly authenticated requests to next by identity', () => {
      for (const original of [
        new HttpRequest('POST', 'https://outside.invalid/api', { synthetic: true }),
        new HttpRequest('GET', `${apiBase}/vehicles`, {
          headers: new HttpHeaders({ Authorization: 'Basic synthetic-caller' }),
        }),
      ]) {
        const next = vi.fn(() => of(new HttpResponse({ body: {} })));
        TestBed.runInInjectionContext(() => authInterceptor(original, next)).subscribe();
        expect(next).toHaveBeenCalledExactlyOnceWith(original);
      }
    });

    it('retains the actual vehicle read service path and response', () => {
      const received = vi.fn();
      TestBed.inject(VehicleService).getFleetVehicles('synthetic-fleet').subscribe(received);
      const request = controller.expectOne(`${apiBase}/fleets/synthetic-fleet/vehicles`);
      expect(request.request.headers.getAll('Authorization')).toEqual([`Bearer ${SENTINEL}`]);
      request.flush([]);
      expect(received).toHaveBeenCalledWith([]);
    });

    it('preserves login, stored-token use, me, and logout with synthetic storage only', () => {
      const stored = new Map<string, string>();
      vi.spyOn(Storage.prototype, 'getItem').mockImplementation((key) => stored.get(key) ?? null);
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation((key, value) => {
        stored.set(key, value);
      });
      vi.spyOn(Storage.prototype, 'removeItem').mockImplementation((key) => {
        stored.delete(key);
      });
      const auth = new AuthService(http);
      getToken.mockImplementation(() => auth.getToken());
      const user = {
        userId: 'synthetic-user',
        email: 'synthetic@example.invalid',
        firstName: 'Synthetic',
        lastName: 'User',
        role: 'OWNER',
      };
      auth.login({ email: user.email, password: 'synthetic-test-only' }).subscribe();
      const login = controller.expectOne(`${apiBase}/auth/login`);
      expect(login.request.headers.has('Authorization')).toBe(false);
      login.flush({ ...user, token: SENTINEL });
      expect(auth.getToken()).toBe(SENTINEL);
      expect(auth.currentUser()).toEqual(user);
      expect(auth.isAuthenticated()).toBe(true);

      auth.me().subscribe();
      const me = controller.expectOne(`${apiBase}/auth/me`);
      expect(me.request.headers.getAll('Authorization')).toEqual([`Bearer ${SENTINEL}`]);
      me.flush(user);
      auth.logout();
      expect(auth.currentUser()).toBeNull();
      expect(auth.isAuthenticated()).toBe(false);
      expectBearer(`${apiBase}/vehicles`, false);
    });

    it('retains the actual multipart upload and blob download service contracts', () => {
      const service = TestBed.inject(VehicleDocumentService);
      const file = new File(['synthetic document'], 'synthetic.txt', { type: 'text/plain' });
      service.uploadDocument('synthetic-vehicle', file, 'OTHER').subscribe();
      const upload = controller.expectOne(`${apiBase}/vehicles/synthetic-vehicle/documents`);
      expect(upload.request.headers.getAll('Authorization')).toEqual([`Bearer ${SENTINEL}`]);
      expect(upload.request.body).toBeInstanceOf(FormData);
      expect(upload.request.body.get('file')).toBe(file);
      expect(upload.request.body.get('documentType')).toBe('OTHER');
      expect(upload.request.headers.has('Content-Type')).toBe(false);
      upload.flush({});

      const received = vi.fn();
      service.downloadDocument('synthetic-document').subscribe(received);
      const download = controller.expectOne(
        `${apiBase}/vehicle-documents/synthetic-document/download`,
      );
      expect(download.request.headers.getAll('Authorization')).toEqual([`Bearer ${SENTINEL}`]);
      expect(download.request.responseType).toBe('blob');
      const blob = new Blob(['synthetic download']);
      download.flush(blob, {
        headers: { 'Content-Disposition': 'attachment; filename=synthetic.txt' },
      });
      expect(received.mock.calls[0][0].body).toBe(blob);
      expect(received.mock.calls[0][0].headers.get('Content-Disposition')).toContain(
        'synthetic.txt',
      );
    });

    it('runs the actual VIN service with no Trackora header and preserves decoding', () => {
      const received = vi.fn();
      const vin = 'SYNTHETICVIN000001';
      TestBed.inject(VehicleService).decodeVin(vin).subscribe(received);
      const request = controller.expectOne(
        `https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVin/${vin}?format=json`,
      );
      expect(request.request.headers.has('Authorization')).toBe(false);
      request.flush({
        Results: [
          { Variable: 'Error Code', Value: '0' },
          { Variable: 'Make', Value: 'Synthetic make' },
          { Variable: 'Model', Value: 'Synthetic model' },
          { Variable: 'Model Year', Value: '2026' },
        ],
      });
      expect(received).toHaveBeenCalledWith({
        vin,
        make: 'Synthetic make',
        model: 'Synthetic model',
        year: 2026,
      });
    });

    it('preserves invalid VIN response errors without contacting NHTSA', () => {
      const received = vi.fn();
      TestBed.inject(VehicleService).decodeVin('SYNTHETICVIN000001').subscribe({ error: received });
      const request = controller.expectOne((req) =>
        req.url.startsWith('https://vpic.nhtsa.dot.gov/'),
      );
      expect(request.request.headers.has('Authorization')).toBe(false);
      request.flush({
        Results: [
          { Variable: 'Error Code', Value: '1' },
          { Variable: 'Error Text', Value: 'Synthetic invalid VIN' },
        ],
      });
      expect(received.mock.calls[0][0].message).toBe('Synthetic invalid VIN');
    });

    it.each([401, 403, 500])(
      'preserves HTTP %s and existing error notification behavior',
      (status) => {
        const received = vi.fn();
        http.get(`${apiBase}/vehicles`).subscribe({ error: received });
        const request = controller.expectOne(`${apiBase}/vehicles`);
        request.flush({ message: 'Synthetic failure' }, { status, statusText: 'Synthetic error' });
        expect(received.mock.calls[0][0]).toBeInstanceOf(HttpErrorResponse);
        expect(received.mock.calls[0][0].status).toBe(status);
        expect(notifyError).toHaveBeenCalledTimes(1);
      },
    );

    it('passes simulated redirected responses through; does not validate native redirect hops', () => {
      const original = new HttpRequest('GET', `${apiBase}/vehicles`);
      const redirectedResponse = new HttpResponse({
        body: { synthetic: true },
        url: 'https://outside.invalid/redirected',
        redirected: true,
      });
      const next = vi.fn(() => of(redirectedResponse));
      const received = vi.fn();
      TestBed.runInInjectionContext(() => authInterceptor(original, next)).subscribe(received);
      expect(next).toHaveBeenCalledTimes(1);
      expect(received).toHaveBeenCalledWith(redirectedResponse);
    });
  },
);
