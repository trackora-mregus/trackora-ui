import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';
import { classifyHttpFailure, failureText } from '../../../core/http/http-failure';
import { PILOT_PRESENTATION } from '../../../core/config/pilot-presentation';
import { Component, DestroyRef, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

import { AuthService } from '../../../core/auth/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatProgressSpinnerModule,
    RouterLink,
  ],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css',
})
export class LoginComponent {
  readonly pilotPresentation = inject(PILOT_PRESENTATION);
  private readonly destroyRef = inject(DestroyRef);
  private retryAt = 0;
  loading = signal(false);
  errorMessage = signal<string | null>(null);

  form;

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router,
  ) {
    this.form = this.fb.nonNullable.group({
      email: ['demo@fleetwise.com', [Validators.required, Validators.email]],
      password: ['Password123!', [Validators.required]],
    });
  }

  login(): void {
    if (this.loading() || Date.now() < this.retryAt) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.loading.set(true);
    this.errorMessage.set(null);

    this.authService
      .login(this.form.getRawValue())
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.loading.set(false)),
      )
      .subscribe({
        next: () => {
          this.router.navigate([this.pilotPresentation ? '/vehicles' : '/dashboard']);
        },
        error: (error: unknown) => {
          const failure = classifyHttpFailure(error, 'login');
          this.retryAt = Date.now() + (failure.retryAfterMs ?? 0);
          this.errorMessage.set(failureText(failure));
        },
      });
  }
}
