import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter, Router } from '@angular/router';
import { LoginComponent } from './login.component';
import { PILOT_PRESENTATION } from '../../../core/config/pilot-presentation';
import { errorInterceptor } from '../../../core/interceptors/error.interceptor';
import { authInterceptor } from '../../../core/interceptors/auth.interceptor';
import { NotificationService } from '../../../core/services/notification.service';
import { AuthService } from '../../../core/auth/auth.service';
import { environment } from '../../../../environments/environment';

const api = environment.apiBaseUrl;
describe.each([true, false])('login failure ownership pilot=%s', (pilot) => {
  let fixture: ComponentFixture<LoginComponent>;
  let component: LoginComponent;
  let http: HttpTestingController;
  const notices = { error: vi.fn(), success: vi.fn() };
  beforeEach(() => {
    notices.error.mockClear();
    notices.success.mockClear();
    TestBed.configureTestingModule({
      imports: [LoginComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([authInterceptor, errorInterceptor])),
        provideHttpClientTesting(),
        { provide: NotificationService, useValue: notices },
        { provide: PILOT_PRESENTATION, useValue: pilot },
      ],
    });
    fixture = TestBed.createComponent(LoginComponent);
    component = fixture.componentInstance;
    component.form.setValue({ email: 'synthetic@example.invalid', password: 'synthetic-input' });
    http = TestBed.inject(HttpTestingController);
    vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
  });
  afterEach(() => {
    http.verify();
    localStorage.clear();
    vi.restoreAllMocks();
  });
  it.each([400, 401, 403, 413, 415, 429, 500, 503])(
    'preserves readable %s once, form values and session; clears loading',
    async (status) => {
      localStorage.setItem('fleetwise_token', 'synthetic-existing-session');
      component.login();
      component.login();
      const req = http.expectOne({ method: 'POST', url: `${api}/auth/login` });
      expect(req.request.body).toEqual(component.form.getRawValue());
      req.flush({ message: 'Readable server explanation' }, { status, statusText: 'Synthetic' });
      expect(component.loading()).toBe(false);
      expect(component.errorMessage()).toBe('Readable server explanation');
      expect(component.form.getRawValue().password).toBe('synthetic-input');
      expect(TestBed.inject(AuthService).getToken()).toBe('synthetic-existing-session');
      expect(TestBed.inject(AuthService).currentUser()).toBeNull();
      expect(TestBed.inject(Router).navigate).not.toHaveBeenCalled();
      fixture.detectChanges();
      await fixture.whenStable();
      expect(fixture.nativeElement.querySelectorAll('[role="alert"]').length).toBe(1);
      expect(notices.error).not.toHaveBeenCalled();
      expect(notices.success).not.toHaveBeenCalled();
      http.expectNone(() => true);
    },
  );
  it('reports status 0 as uncertain and allows only intentional new submissions', () => {
    component.login();
    http.expectOne(`${api}/auth/login`).error(new ProgressEvent('error'));
    expect(component.errorMessage()).toContain('transport failure');
    expect(component.errorMessage()).not.toMatch(/invalid|offline|CORS|rate.limit|unreachable/i);
    http.expectNone(() => true);
    component.login();
    http.expectOne(`${api}/auth/login`).flush({}, { status: 401, statusText: 'Synthetic' });
    expect(component.errorMessage()).not.toMatch(/invalid.*password/i);
  });
  it('keeps literal server markup as text and never renders HTML', async () => {
    component.login();
    http
      .expectOne(`${api}/auth/login`)
      .flush({ message: '<img src=x onerror=alert(1)>' }, { status: 400, statusText: 'Synthetic' });
    fixture.detectChanges();
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('[role="alert"]').textContent).toContain('<img');
    expect(fixture.nativeElement.querySelector('[role="alert"] img')).toBeNull();
  });
  it('honors readable Retry-After without timers, rejects unsafe bodies and cancels at destroy', () => {
    let now = 100000;
    vi.spyOn(Date, 'now').mockImplementation(() => now);
    component.login();
    http
      .expectOne(`${api}/auth/login`)
      .flush(
        { message: {} },
        { status: 429, statusText: 'Synthetic', headers: { 'Retry-After': '10' } },
      );
    expect(component.errorMessage()).toContain('Wait at least 10 seconds');
    component.login();
    http.expectNone(() => true);
    now += 10000;
    http.expectNone(() => true);
    component.login();
    const pending = http.expectOne(`${api}/auth/login`);
    fixture.destroy();
    expect(pending.cancelled).toBe(true);
    expect(component.loading()).toBe(false);
  });
  it('retains successful auth contract and pilot/nonpilot navigation', () => {
    component.login();
    http.expectOne(`${api}/auth/login`).flush({
      token: 'synthetic-new-session',
      userId: 'synthetic-user',
      email: 'synthetic@example.invalid',
      firstName: 'Synthetic',
      lastName: 'Test',
      role: 'OWNER',
    });
    expect(TestBed.inject(Router).navigate).toHaveBeenCalledWith([
      pilot ? '/vehicles' : '/dashboard',
    ]);
    expect(TestBed.inject(AuthService).getToken()).toBe('synthetic-new-session');
    expect(TestBed.inject(AuthService).currentUser()?.role).toBe('OWNER');
    expect(component.loading()).toBe(false);
    expect(component.errorMessage()).toBeNull();
    http.expectNone(() => true);
  });
});
