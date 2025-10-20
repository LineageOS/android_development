import { CommonModule, NgFor, NgIf } from '@angular/common';
import {
  Component,
  ElementRef,
  EventEmitter,
  HostListener,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
} from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatExpansionModule } from '@angular/material/expansion';
import { FormsModule } from '@angular/forms';
import { MatMenuModule } from '@angular/material/menu';
import { TruncatePipe } from '../app/pipes/truncate.pipe';

@Component({
  selector: 'test-mode-list',
  imports: [
    CommonModule,
    NgIf,
    NgFor,
    FormsModule,
    MatIconModule,
    MatExpansionModule,
    MatMenuModule,
    TruncatePipe
  ],
  templateUrl: './test-mode.component.html',
})
export class TestModeComponent implements OnChanges {
  constructor(private elementRef: ElementRef) { }

  @Input() testModes: string[] = [];
  @Input() testMode: string = "";
  @Output() selectedTestMode = new EventEmitter<string>();


  selectedMode: string = ""
  showDropdown = false

  toggleDropdown(): void {
    this.showDropdown = !this.showDropdown
  }

  @HostListener('document:click', ['$event'])
  onClickOutside(event: MouseEvent) {
    if (!this.elementRef.nativeElement.contains(event.target)) {
      this.showDropdown = false;
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes["testMode"]) {
      this.selectedMode = this.testMode
    }
  }

  onActionSelected(action: string): void {
    if (this.selectedMode !== action) {// Take action only when selected mode changes.
      this.selectedMode = action
      this.switchMode(action)
    }
    this.toggleDropdown()
  }

  switchMode(mode: string) {
    this.selectedTestMode.emit(mode);
  }
}

