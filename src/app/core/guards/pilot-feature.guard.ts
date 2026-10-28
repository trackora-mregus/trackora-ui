import { inject } from '@angular/core';
import { CanMatchFn, Router } from '@angular/router';
import { PILOT_PRESENTATION } from '../config/pilot-presentation';

/** Avoid creating excluded features, including their HTTP and live-data children. */
export const pilotFeatureGuard: CanMatchFn = () =>
  inject(PILOT_PRESENTATION) ? inject(Router).createUrlTree(['/vehicles']) : true;
