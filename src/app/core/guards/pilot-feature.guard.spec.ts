import { Client } from '@stomp/stompjs';
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter, Router, Routes } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { routes } from '../../app.routes';
import { AuthService } from '../auth/auth.service';
import { PILOT_PRESENTATION } from '../config/pilot-presentation';

@Component({ template: 'Included destination' })
class Destination {}

// Real route definitions/guards, with only the final included destination stubbed.
const includedDestinations: Routes = routes.map((route) =>
  route.path === 'vehicles' || route.path === 'vehicles/:vehicleId' || route.path === 'login'
    ? { ...route, loadComponent: () => Destination }
    : route,
);

describe('pilot direct navigation', () => {
  let controller: HttpTestingController;
  let authenticated = true;
  const excluded = [
    '/dashboard',
    '/fleets',
    '/maintenance',
    '/fuel',
    '/alerts',
    '/admin/geometris-packets',
    '/fleets/fleet-sentinel/map',
    '/admin/servicebus/deadletters',
    '/fleets/fleet-sentinel/safety',
    '/fleets/fleet-sentinel/copilot',
    '/',
    '/unknown',
  ];

  beforeEach(() => {
    authenticated = true;
    vi.spyOn(Client.prototype, 'activate').mockImplementation(() => {});
    vi.stubGlobal(
      'WebSocket',
      vi.fn(function () {
        throw new Error('Unexpected WebSocket');
      }),
    );
    TestBed.configureTestingModule({
      providers: [
        provideRouter(includedDestinations),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: PILOT_PRESENTATION, useValue: true },
        { provide: AuthService, useValue: { isAuthenticated: () => authenticated } },
      ],
    });
    controller = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    controller.verify();
    expect(Client.prototype.activate).not.toHaveBeenCalled();
    expect(WebSocket).not.toHaveBeenCalled();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it.each(excluded)('redirects %s before creating excluded features', async (url) => {
    await RouterTestingHarness.create(url);
    expect(TestBed.inject(Router).url).toBe('/vehicles');
    expect(controller.match(() => true)).toEqual([]);
  });

  it.each(['/vehicles', '/vehicles/vehicle-sentinel'])('retains included route %s', async (url) => {
    await RouterTestingHarness.create(url);
    expect(TestBed.inject(Router).url).toBe(url);
  });

  it('keeps authentication on redirected and included routes', async () => {
    authenticated = false;
    await RouterTestingHarness.create('/fleets/fleet-sentinel/map');
    expect(TestBed.inject(Router).url).toBe('/login');
  });

  it('preserves nonpilot route loading and auth behavior', async () => {
    TestBed.resetTestingModule();
    const loadDashboard = vi.fn(() => Destination);
    TestBed.configureTestingModule({
      providers: [
        provideRouter(
          routes.map((route) =>
            route.path === 'dashboard' ? { ...route, loadComponent: loadDashboard } : route,
          ),
        ),
        { provide: PILOT_PRESENTATION, useValue: false },
        { provide: AuthService, useValue: { isAuthenticated: () => true } },
      ],
    });
    await RouterTestingHarness.create('/dashboard');
    expect(loadDashboard).toHaveBeenCalledOnce();
    expect(TestBed.inject(Router).url).toBe('/dashboard');
  });
});
