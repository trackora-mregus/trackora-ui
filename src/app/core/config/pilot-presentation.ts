import { InjectionToken } from '@angular/core';
import { environment } from '../../../environments/environment';

/** Public presentation configuration only; backend permissions remain authoritative. */
export function isPilotPresentation(config: object): boolean {
  return 'pilotPresentation' in config && config.pilotPresentation === true;
}

/** Opt in only in a separately configured pilot environment; absent means disabled. */
export const PILOT_PRESENTATION = new InjectionToken<boolean>('pilot presentation', {
  providedIn: 'root',
  factory: () => isPilotPresentation(environment),
});
