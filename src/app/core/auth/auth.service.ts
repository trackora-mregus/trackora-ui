import { LOCAL_FAILURE_FEEDBACK } from '../http/http-failure';
import { Injectable, signal } from '@angular/core';
import { HttpClient, HttpContext } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  AuthResponse,
  LoginRequest,
  MeResponse,
  RegisterRequest,
} from '../../shared/models/auth.models';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private readonly tokenKey = 'fleetwise_token';

  currentUser = signal<MeResponse | null>(null);

  constructor(private http: HttpClient) {}

  login(request: LoginRequest): Observable<AuthResponse> {
    return this.http
      .post<AuthResponse>(`${environment.apiBaseUrl}/auth/login`, request, {
        context: new HttpContext().set(LOCAL_FAILURE_FEEDBACK, true),
      })
      .pipe(
        tap((response) => {
          localStorage.setItem(this.tokenKey, response.token);
          this.currentUser.set({
            userId: response.userId,
            email: response.email,
            firstName: response.firstName,
            lastName: response.lastName,
            role: response.role,
          });
        }),
      );
  }

  register(request: RegisterRequest): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${environment.apiBaseUrl}/auth/register`, request).pipe(
      tap((response) => {
        localStorage.setItem(this.tokenKey, response.token);
      }),
    );
  }

  me(): Observable<MeResponse> {
    return this.http
      .get<MeResponse>(`${environment.apiBaseUrl}/auth/me`)
      .pipe(tap((user) => this.currentUser.set(user)));
  }

  logout(): void {
    localStorage.removeItem(this.tokenKey);
    this.currentUser.set(null);
  }

  getToken(): string | null {
    return localStorage.getItem(this.tokenKey);
  }

  isAuthenticated(): boolean {
    return !!this.getToken();
  }

  canWrite(): boolean {
    const role = this.currentUser()?.role;

    return role === 'OWNER' || role === 'MANAGER';
  }

  forgotPassword(email: string) {
    return this.http.post<{ message: string }>(`${environment.apiBaseUrl}/auth/forgot-password`, {
      email,
    });
  }

  resetPassword(token: string, newPassword: string) {
    return this.http.post<{ message: string }>(`${environment.apiBaseUrl}/auth/reset-password`, {
      token,
      newPassword,
    });
  }

  isViewer(): boolean {
    const role = this.currentUser()?.role;
    return role === 'VIEWER';
  }

  isOwner(): boolean {
    const role = this.currentUser()?.role;
    return role === 'OWNER';
  }
}
