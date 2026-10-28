import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { signal } from '@angular/core';
import { App } from './app';
import { PILOT_PRESENTATION } from './core/config/pilot-presentation';
import { AuthService } from './core/auth/auth.service';
import { FleetContextService } from './core/services/fleet-context.service';
import { environment } from '../environments/environment';

const api = environment.apiBaseUrl;

describe('pilot shell', () => {
  let controller: HttpTestingController;
  let pilotMode = true;

  beforeEach(() => {
    pilotMode = true;
    TestBed.configureTestingModule({
      imports: [App],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: PILOT_PRESENTATION, useFactory: () => pilotMode },
        { provide: AuthService, useValue: { isAuthenticated: () => true } },
        { provide: FleetContextService, useValue: { selectedFleetId: signal('fleet-sentinel') } },
      ],
    });
    controller = TestBed.inject(HttpTestingController);
  });
  afterEach(() => {
    controller.verify();
    vi.restoreAllMocks();
  });

  it('renders Vehicles only and suppresses bootstrap/search requests at source', async () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    fixture.componentInstance.onSearchChange('sentinel');
    const links = Array.from(
      fixture.nativeElement.querySelectorAll('nav a') as NodeListOf<HTMLAnchorElement>,
    );
    expect(links.map((link) => link.getAttribute('href'))).toEqual(['/vehicles']);
    expect(fixture.nativeElement.querySelector('.global-search')).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('Trackora Pilot');
    // Wait beyond the existing search debounce; an accidental subscription would issue HTTP.
    await new Promise((resolve) => setTimeout(resolve, 350));
    expect(controller.match(() => true)).toEqual([]);
  });

  it('keeps nonpilot bootstrap requests and navigation', () => {
    pilotMode = false;
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    controller.expectOne({ method: 'GET', url: `${api}/notifications` }).flush([]);
    controller
      .expectOne({ method: 'GET', url: `${api}/notifications/unread-count` })
      .flush({ count: 0 });
    controller.expectOne({ method: 'GET', url: `${api}/fleets/fleet-sentinel/alerts` }).flush([]);
    expect(fixture.nativeElement.querySelector('a[href="/dashboard"]')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.global-search')).not.toBeNull();
  });
});
