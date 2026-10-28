import { TestBed } from '@angular/core/testing';
import { environment } from '../../../environments/environment';
import { environment as productionEnvironment } from '../../../environments/environment.prod';
import { isPilotPresentation, PILOT_PRESENTATION } from './pilot-presentation';

describe('pilot presentation configuration', () => {
  it.each([
    {},
    { pilotPresentation: false },
    { pilotPresentation: 'true' },
    { pilotPresentation: 1 },
    { pilotPresentation: null },
    { role: 'OWNER' },
  ])('is disabled for %j', (config) => expect(isPilotPresentation(config)).toBe(false));

  it('requires explicit boolean true', () => {
    expect(isPilotPresentation({ pilotPresentation: true })).toBe(true);
  });

  it('reads an explicitly configured environment through the real token factory', () => {
    const configured = environment as typeof environment & { pilotPresentation?: boolean };
    configured.pilotPresentation = true;
    try {
      expect(TestBed.inject(PILOT_PRESENTATION)).toBe(true);
    } finally {
      delete configured.pilotPresentation;
    }
  });

  it('leaves both existing environments and the default provider disabled', () => {
    expect(isPilotPresentation(environment)).toBe(false);
    expect(isPilotPresentation(productionEnvironment)).toBe(false);
    expect(TestBed.inject(PILOT_PRESENTATION)).toBe(false);
  });
});
