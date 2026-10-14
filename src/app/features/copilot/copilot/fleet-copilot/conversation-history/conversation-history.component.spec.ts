import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ConversationHistoryComponent } from './conversation-history.component';

describe('ConversationHistoryComponent', () => {
  let component: ConversationHistoryComponent;
  let fixture: ComponentFixture<ConversationHistoryComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ConversationHistoryComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(ConversationHistoryComponent);
    fixture.componentRef.setInput('conversations', []);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
