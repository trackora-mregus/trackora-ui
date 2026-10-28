import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter, Router } from '@angular/router';
import { PILOT_PRESENTATION } from '../../../core/config/pilot-presentation';
import { LoginComponent } from './login.component';
import { environment } from '../../../../environments/environment';

// Synthetic credentials; no request leaves HttpTestingController.
describe('pilot login', () => {
  let controller: HttpTestingController;
  let pilotMode = true;
  beforeEach(() => {
    pilotMode = true;
    TestBed.configureTestingModule({
      imports: [LoginComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: PILOT_PRESENTATION, useFactory: () => pilotMode },
      ],
    });
    controller = TestBed.inject(HttpTestingController);
  });
  afterEach(() => {
    controller.verify();
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it.each([
    [true, 'OWNER'],
    [true, 'VIEWER'],
    [false, 'OWNER'],
  ] as const)('routes successful login with pilot=%s and role=%s', (pilot, role) => {
    pilotMode = pilot;
    const fixture = TestBed.createComponent(LoginComponent);
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    const component = fixture.componentInstance;
    component.form.setValue({ email: 'sentinel@example.invalid', password: 'synthetic-password' });
    component.login();
    const request = controller.expectOne({
      method: 'POST',
      url: `${environment.apiBaseUrl}/auth/login`,
    });
    expect(request.request.body).toEqual(component.form.getRawValue());
    request.flush({
      token: 'synthetic-token',
      userId: 'user-sentinel',
      role,
      email: 'sentinel@example.invalid',
      firstName: 'Test',
      lastName: 'Sentinel',
    });
    expect(navigate).toHaveBeenCalledWith([pilot ? '/vehicles' : '/dashboard']);
    expect(component.loading()).toBe(false);
    controller.expectNone(`${environment.apiBaseUrl}/auth/me`);
  });

  it('retains failed-login feedback without navigation or extra requests', () => {
    const component = TestBed.createComponent(LoginComponent).componentInstance;
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate');
    component.form.setValue({ email: 'sentinel@example.invalid', password: 'synthetic-password' });
    component.login();
    controller
      .expectOne(`${environment.apiBaseUrl}/auth/login`)
      .flush({}, { status: 401, statusText: 'Unauthorized' });
    expect(component.loading()).toBe(false);
    expect(component.errorMessage()).toBe('Invalid email or password.');
    expect(navigate).not.toHaveBeenCalled();
  });
});
