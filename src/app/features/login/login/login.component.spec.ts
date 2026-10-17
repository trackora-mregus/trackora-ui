import { ComponentFixture, TestBed } from '@angular/core/testing';

import { LoginComponent } from './login.component';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { runMonitoringBoundaryMatrix } from '../../../../testing/monitoring-boundary-fixtures.spec-helper';

describe('LoginComponent', () => {
  let component: LoginComponent;
  let fixture: ComponentFixture<LoginComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LoginComponent],
      providers: [provideRouter([]), provideHttpClient()]
    }).compileComponents();

    fixture = TestBed.createComponent(LoginComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('preserves login validation across every monitoring boundary state', async () => {
    await runMonitoringBoundaryMatrix(() => {
      component.form.controls.email.setValue('invalid');
      component.login();
      expect(component.form.invalid).toBe(true);
      expect(component.loading()).toBe(false);
    });
  });
});
