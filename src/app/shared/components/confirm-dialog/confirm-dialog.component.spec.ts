import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ConfirmDialogComponent } from './confirm-dialog.component';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

describe('ConfirmDialogComponent', () => {
  let component: ConfirmDialogComponent;
  let fixture: ComponentFixture<ConfirmDialogComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ConfirmDialogComponent],
      providers: [
        { provide: MatDialogRef, useValue: { close: () => undefined } },
        { provide: MAT_DIALOG_DATA, useValue: {
          title: 'Confirm', message: 'Continue?', confirmText: 'Confirm', destructive: false
        } }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(ConfirmDialogComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should close the dialog exactly once with true on confirm', () => {
    const close = vi.spyOn(TestBed.inject(MatDialogRef), 'close');

    component.confirm();

    expect(close).toHaveBeenCalledExactlyOnceWith(true);
  });

  it('should close the dialog exactly once with false on cancel', () => {
    const close = vi.spyOn(TestBed.inject(MatDialogRef), 'close');

    component.cancel();

    expect(close).toHaveBeenCalledExactlyOnceWith(false);
  });
});
