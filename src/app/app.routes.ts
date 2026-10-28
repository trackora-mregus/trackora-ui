import { Routes } from '@angular/router';
import { pilotFeatureGuard } from './core/guards/pilot-feature.guard';
import { authGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    canMatch: [pilotFeatureGuard],
    loadComponent: () =>
      import('./features/welcome/welcome/welcome.component')
        .then(m => m.WelcomeComponent)
  },
  {
    path: 'login',
    loadComponent: () =>
      import('./features/login/login/login.component')
        .then(m => m.LoginComponent)
  },
  {
    path: 'forgot-password',
    loadComponent: () =>
      import('./features/auth/forgot-password/forgot-password.component')
        .then(m => m.ForgotPasswordComponent)
  },
  {
    path: 'reset-password',
    loadComponent: () =>
      import('./features/auth/reset-password/reset-password.component')
        .then(m => m.ResetPasswordComponent)
  },
  {
    path: 'dashboard',
    canMatch: [pilotFeatureGuard],
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/dashboard/dashboard/dashboard.component')
        .then(m => m.DashboardComponent)
  },
  {
    path: 'vehicles/:vehicleId',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/vehicles/vehicle-details/vehicle-details.component')
        .then(m => m.VehicleDetailsComponent)
  },
  {
    path: 'vehicles',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/vehicles/vehicles/vehicles.component')
        .then(m => m.VehiclesComponent)
  },
  {
    path: 'fleets',
    canMatch: [pilotFeatureGuard],
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/fleets/fleets/fleets.component')
        .then(m => m.FleetsComponent)
  },
  {
    path: 'maintenance',
    canMatch: [pilotFeatureGuard],
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/maintenance/maintenance/maintenance.component')
        .then(m => m.MaintenanceComponent)
  },
  {
    path: 'fuel',
    canMatch: [pilotFeatureGuard],
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/fuel/fuel/fuel.component')
        .then(m => m.FuelComponent)
  },
  {
    path: 'alerts',
    canMatch: [pilotFeatureGuard],
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/alerts/alerts/alerts.component')
        .then(m => m.AlertsComponent)
  },
  {
    path: 'admin/geometris-packets',
    canMatch: [pilotFeatureGuard],
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/telematics/telematics/geometris-packets/geometris-packets')
        .then(m => m.GeometrisPackets)
  },
  {
    path: 'fleets/:fleetId/map',
    canMatch: [pilotFeatureGuard],
    loadComponent: () =>
      import('./features/telematics/telematics/fleet-map/fleet-map')
        .then(m => m.FleetMapComponent)
  },
  {
    path: 'admin/servicebus/deadletters',
    canMatch: [pilotFeatureGuard],
    loadComponent: () =>
      import('./features/telematics/telematics/servicebus-deadletters/servicebus-deadletters.component')
        .then(m => m.ServicebusDeadlettersComponent)
  },
  {
    path: 'fleets/:fleetId/safety',
    canMatch: [pilotFeatureGuard],
    loadComponent: () =>
      import('./features/safety/safety/safety-dashboard/safety-dashboard.component')
        .then(m => m.SafetyDashboardComponent)
  },
  {
    path: 'fleets/:fleetId/copilot',
    canMatch: [pilotFeatureGuard],
    loadComponent: () =>
      import('./features/copilot/copilot/fleet-copilot/fleet-copilot.component')
        .then(m => m.FleetCopilotComponent)
  },
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'dashboard'
  },
  {
    path: '**',
    redirectTo: 'dashboard'
  }
];
