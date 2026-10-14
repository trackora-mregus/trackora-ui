import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SafetyDashboardComponent } from './safety-dashboard.component';
import { ActivatedRoute } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';

describe('SafetyDashboardComponent', () => {
  let component: SafetyDashboardComponent;
  let fixture: ComponentFixture<SafetyDashboardComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SafetyDashboardComponent],
      providers: [
        provideHttpClient(),
        { provide: ActivatedRoute, useValue: {
          snapshot: { paramMap: { get: () => null } }
        } }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(SafetyDashboardComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
