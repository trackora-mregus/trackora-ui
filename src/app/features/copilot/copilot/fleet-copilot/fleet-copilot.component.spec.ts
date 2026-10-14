import { ComponentFixture, TestBed } from '@angular/core/testing';

import { FleetCopilotComponent } from './fleet-copilot.component';
import { ActivatedRoute } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';

describe('FleetCopilotComponent', () => {
  let component: FleetCopilotComponent;
  let fixture: ComponentFixture<FleetCopilotComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FleetCopilotComponent],
      providers: [
        provideHttpClient(),
        { provide: ActivatedRoute, useValue: {
          snapshot: { paramMap: { get: () => null } }
        } }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(FleetCopilotComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
