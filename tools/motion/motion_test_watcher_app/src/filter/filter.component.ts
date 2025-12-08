import { Component, OnInit, OnDestroy, HostListener, ElementRef, Inject } from '@angular/core';
import { NgFor, NgIf } from '@angular/common';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { debounceTime, distinctUntilChanged, takeUntil } from 'rxjs/operators';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { FormControl, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { Subject, Subscription } from 'rxjs';
import { MatSnackBar } from '@angular/material/snack-bar';
import { FilterService } from '../service/filter.service';
export interface SelectOption {
  id: any;
  name: string;
  selected?: boolean;
  passing?: boolean;
}

@Component({
  selector: 'app-filter',
  imports: [
    FormsModule,
    ReactiveFormsModule,
    NgIf,
    NgFor,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
    MatButtonModule
  ],
  templateUrl: './filter.component.html',
  styleUrl: './filter.component.css'
})
export class FilterComponent implements OnInit, OnDestroy {

  availableOptions: SelectOption[] = [];
  private dataSubscription: Subscription | undefined;
  private destroy$ = new Subject<void>();

  isDropdownOpen: boolean = false;
  searchControl = new FormControl('');
  filteredOptions: SelectOption[] = [];
  selectedItems: SelectOption[] = [];
  TempselectedItems: SelectOption[] = [];

  constructor(
    private elementRef: ElementRef,
    public dialogRef: MatDialogRef<FilterComponent>,
    private filterService: FilterService,
    private snackBar: MatSnackBar,
    @Inject(MAT_DIALOG_DATA) public data: { allAvailableOptions: SelectOption[] }
  ) { }

  ngOnInit(): void {
    if (this.data && this.data.allAvailableOptions) {
      this.availableOptions = [...this.data.allAvailableOptions];
    } else {
      this.dataSubscription = this.filterService.motionData$
        .pipe(takeUntil(this.destroy$))
        .subscribe(options => {
          this.availableOptions = options;
          this.initializeSelectionStates();
        });
    }
    this.initializeSelectionStates();
    this.searchControl.valueChanges
      .pipe(
        debounceTime(200),
        distinctUntilChanged(),
        takeUntil(this.destroy$)
      )
      .subscribe(searchTerm => {
        this.filterOptions(searchTerm || '');
      });

    this.dialogRef.backdropClick()
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.cancelFilters();
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private initializeSelectionStates(): void {
    this.selectedItems = this.availableOptions.filter(option => option.selected);
    this.TempselectedItems = [...this.selectedItems];
  }

  toggleDropdown(): void {
    this.isDropdownOpen = !this.isDropdownOpen;
    if (this.isDropdownOpen) {
      this.searchControl.setValue('');
      this.filteredOptions = [...this.availableOptions];
    }
  }

  filterOptions(searchTerm: string): void {
    const lowerCaseSearchTerm = searchTerm.toLowerCase();
    this.filteredOptions = this.availableOptions.filter(option =>
      option.name.toLowerCase().includes(lowerCaseSearchTerm)
    );
  }

  onCheckboxChange(option: SelectOption, event: Event): void {
    const isChecked = (event.target as HTMLInputElement).checked;
    const affectedOption = this.availableOptions.find(item => item.id === option.id);
    if (affectedOption) {
      affectedOption.selected = isChecked;
    }

    if (isChecked) {
      this.TempselectedItems.push({ ...option });
    } else {
      this.TempselectedItems = this.TempselectedItems.filter(item => item.id !== option.id);
    }
  }

  isOptionSelected(option: SelectOption): boolean {
    return this.TempselectedItems.some(item => item.id === option.id);
  }

  get selectedDisplayNames(): string {
    if (this.TempselectedItems.length === 0) {
      return 'Select items...';
    }
    const names = this.TempselectedItems.map(item => item.name);
    if (names.length > 3) {
      return `${names.slice(0, 3).join(', ')} (+${names.length - 3} more)`;
    }
    return names.join(', ');
  }

  @HostListener('document:click', ['$event'])
  onClickOutside(event: Event): void {
    if (!this.elementRef.nativeElement.contains(event.target)) {
      this.isDropdownOpen = false;
    }
  }

  applyFilters(): void {
    if (this.TempselectedItems.length === 0) {
      this.snackBar.open(
        'Please select at least one option!',
        'Dismiss',
        {
          duration: 3000,
          horizontalPosition: 'center',
          verticalPosition: 'top',
          panelClass: ['snackbar-error-message']
        }
      );
    }
    else {
      this.selectedItems = [...this.TempselectedItems];
      this.availableOptions.forEach(option => {
        option.selected = this.selectedItems.some(selected => selected.id === option.id);
      });
      this.filterService.sendSelectedOptions(this.selectedItems);
      this.dialogRef.close(this.selectedItems.map(item => item.id));
    }
  }

  selectFailing(): void {
    this.TempselectedItems = [{id: -1, name: "Failing features", selected: true, passing: false }]
  }

  cancelFilters(): void {
    this.TempselectedItems = [...this.selectedItems];
    this.availableOptions.forEach(option => {
      option.selected = this.selectedItems.some(selected => selected.id === option.id);
    });
    this.dialogRef.close();
  }

  selectAll(): void {
    this.TempselectedItems = [...this.availableOptions];
  }

  selectNone(): void {
    this.TempselectedItems = [];
  }
}
