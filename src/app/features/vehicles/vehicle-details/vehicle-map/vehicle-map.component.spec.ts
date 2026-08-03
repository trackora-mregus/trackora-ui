import { ComponentFixture, TestBed } from '@angular/core/testing';

import { VehicleMapComponent } from './vehicle-map.component';

describe('VehicleMapComponent', () => {
  let component: VehicleMapComponent;
  let fixture: ComponentFixture<VehicleMapComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [VehicleMapComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(VehicleMapComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
