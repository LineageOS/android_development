import { CommonModule, NgFor, NgIf } from '@angular/common';
import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
} from '@angular/core';
import { MotionGolden, PresubmitTest } from '../model/golden';
import { MatIconModule } from '@angular/material/icon';
import { MatExpansionModule } from '@angular/material/expansion';
import { FormsModule } from '@angular/forms';
import { GoldensService } from '../service/goldens.service';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TestModes } from '../model/test_mode';

@Component({
  selector: 'app-test-list',
  imports: [
    CommonModule,
    NgIf,
    NgFor,
    FormsModule,
    MatIconModule,
    MatExpansionModule,
    MatButtonModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
  ],
  templateUrl: './test-list.component.html',
  styleUrl: './test-list.component.css',
})
export class TestListComponent implements OnChanges {
  @Input() goldens: MotionGolden[] = [];
  @Input() presubmitTests: PresubmitTest[] = [];
  @Input() showCheckBoxes: boolean = false;
  @Input() isRefreshing: boolean = false;
  @Input() testMode: string = "";
  @Output() showCheckBoxesChange = new EventEmitter<boolean>();
  @Output() selectedTestNameChange = new EventEmitter<PresubmitTest>();
  @Output() refreshRequest = new EventEmitter<boolean>();
  @Output() selectedGoldenChange = new EventEmitter<MotionGolden>();
  selectedGolden: MotionGolden | null = null;
  selectedPresubmitTest: PresubmitTest | null = null;
  selectedGoldenIds: Set<string> = new Set<string>();
  isUpdating: boolean = false;

  constructor(
    private goldenService: GoldensService,
    private snackBar: MatSnackBar,
  ) { }


  filterStatus: 'all' | 'pass' | 'fail' = 'all';

  totalTestCount = 0;
  passingTestCount = 0;
  failingTestCount = 0;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['goldens']) {
      this.totalTestCount = this.goldens.length;
      this.failingTestCount = this.goldens.filter(
        (golden) => golden.result !== 'PASSED'
      ).length;
      this.passingTestCount = this.totalTestCount - this.failingTestCount;
      this.updateAndGroupGoldens()
    }
  }

  onFilterStatusChange(): void {
    this.updateAndGroupGoldens();
  }

  triggerRefresh(clear: boolean): void {
    this.refreshRequest.emit(clear);
  }

  panelOpened(golden: MotionGolden): void {
    this.selectedGolden = golden;
    this.selectedGoldenChange.emit(golden);
  }

  panelClosed(golden: MotionGolden): void {
    if (this.selectedGolden && this.selectedGolden.id === golden.id) {
      this.selectedGolden = null;
      this.selectedGoldenChange.emit(undefined);
    }
  }

  extractLastPart(path: string): string {
    return path.split('/').pop() || '';
  }

  calculateGoldenFetchedTime(timestamp: string): string {
    const fetchedDate = new Date(timestamp)
    const millisecondsDiff = new Date().getTime() - fetchedDate.getTime();
    const minutesDiff = Math.round(millisecondsDiff / (60 * 1000));
    if (minutesDiff == 0) {
      return "Fetched just now"
    }
    const hrs = Math.floor(minutesDiff / 60)
    if (hrs > 0) {
      return `Fetched ${hrs} hour ${minutesDiff % 60} mins ago`
    } else {
      return `Fetched ${minutesDiff} mins ago`;
    }
  }

  presubmitTestOpened(presubmitTest: PresubmitTest): void {
    console.log(`testName clicked : ${presubmitTest.testname}`)
    this.selectedPresubmitTest = presubmitTest;
    this.selectedTestNameChange.emit(this.selectedPresubmitTest);
  }

  private updateAndGroupGoldens(): void {
    let filteredGoldens: MotionGolden[];
    if (this.filterStatus === 'all') {
      filteredGoldens = this.goldens;
    } else if (this.filterStatus === 'pass') {
      filteredGoldens = this.goldens.filter((golden) => golden.result === 'PASSED');
    } else {
      filteredGoldens = this.goldens.filter((golden) => golden.result !== 'PASSED');
    }
    this.sortGoldensBasedOnFetchTime(filteredGoldens)
    this.filteredGoldens = this.groupGoldensByTime(filteredGoldens);
  }

  ngOnInit(): void {
    this.updateAndGroupGoldens();
  }

  private sortGoldensBasedOnFetchTime(goldens: MotionGolden[]): void {
    goldens.sort((a, b) => {
      const dateA = new Date(a.testTime);
      const dateB = new Date(b.testTime);
      return dateB.getTime() - dateA.getTime();
    })
  }

  // Goldens grouped by their test fetch time
  filteredGoldens: { key: string; value: MotionGolden[] }[] = []

  private groupGoldensByTime(objectsList: MotionGolden[]): { key: string; value: MotionGolden[] }[] {
    const groupedDataMap = new Map<string, MotionGolden[]>();
    for (const obj of objectsList) {
      const timeKey = this.calculateGoldenFetchedTime(obj.testTime);
      if (groupedDataMap.has(timeKey)) {
        groupedDataMap.get(timeKey)!.push(obj);
      } else {
        groupedDataMap.set(timeKey, [obj]);
      }
    }
    return Array.from(groupedDataMap.entries()).map(([key, value]) => ({ key, value }));
  }

  getResultClass(golden: MotionGolden): string {
    const result = golden.result.trim().toUpperCase();
    if (result === 'MISSING_REFERENCE') {
      return 'border-l-4 border-yellow-500';
    } else if (result === 'FAILED') {
      return 'border-l-4 border-red-500';
    } else if (result === 'PASSED') {
      return 'border-l-4 border-green-500';
    } else {
      return '';
    }
  }

  isGoldenSelected(golden: MotionGolden): boolean {
    return this.selectedGoldenIds.has(golden.id);
  }

  toggleGoldenSelection(golden: MotionGolden, event: Event): void {
    const isChecked = (event.target as HTMLInputElement).checked;
    if (isChecked) {
      if (!this.isGoldenSelected(golden)) {
        this.selectedGoldenIds.add(golden.id);
      }
    }
    else {
      this.selectedGoldenIds.delete(golden.id)
    }
  }

  areAllBoxesSelected(): boolean {
    const visibleGoldens: MotionGolden[] = this.filteredGoldens.flatMap(item => item.value);
    if (visibleGoldens.length === 0) {
      return false;
    }
    return visibleGoldens.every(golden => this.isGoldenSelected(golden));
  }

  toggleAllBoxesSelection(event: Event): void {
    const isChecked = (event.target as HTMLInputElement).checked;
    if (isChecked) {
      this.selectedGoldenIds = new Set(this.filteredGoldens.flatMap((item) => item.value.map((golden) => golden.id)));
    } else {
      this.selectedGoldenIds.clear();
    }
  }

  updateSelectedGoldens(): void {
    if (this.selectedGoldenIds.size === 0) {
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
      return;
    }
    this.isUpdating = true;
    const idsToUpdate = [...this.selectedGoldenIds];
    idsToUpdate.forEach(id => {
      const golden = this.goldens.find(g => g.id === id);
      if (golden) {
        golden.status = 'UPDATING';
      }
    });
    this.goldenService.updateSelectedGoldens(idsToUpdate).subscribe({
      next: (rawResults: Record<string, string>) => {
        const { passedCount, failedCount } = this.updateGoldenStatuses(rawResults);
        const totalCount = passedCount + failedCount;
        if (failedCount > 0) {
          let message = `${passedCount} golden(s) updated successfully.`;
          message += ` ${failedCount} golden(s) failed to update.`;
          this.snackBar.open(message, 'Close', {
            duration: 8000,
            panelClass: 'warning-snackbar',
          });
        } else {
          this.snackBar.open(
            `${totalCount} golden(s) updated successfully!`,
            'Close',
            {
              duration: 3000,
              panelClass: 'success-snackbar',
            }
          );
        }
      },
      error: (err) => {
        console.error('Error updating goldens:', err);
        idsToUpdate.forEach(id => {
          const golden = this.goldens.find(g => g.id === id);
          if (golden) {
            golden.status = 'IDLE';
          }
        });
        this.snackBar.open(
          'Error updating golden. See console for details.',
          'Close',
          {
            duration: 5000,
            panelClass: 'error-snackbar',
          }
        );
      },
      complete: () => {
        this.isUpdating = false;
        this.selectedGoldenIds.clear();
        this.showCheckBoxes = false;
        this.showCheckBoxesChange.emit(this.showCheckBoxes);
      }
    });
  }

  private updateGoldenStatuses(results: Record<string, string>): { passedCount: number, failedCount: number } {
    let passedCount = 0;
    let failedCount = 0;
    Object.entries(results).forEach(([goldenId, statusString]) => {
      const golden = this.goldens.find(g => g.id === goldenId);
      if (golden) {
        if (statusString == 'Updated') {
          golden.status = 'PASSED_UPDATE';
          golden.error = undefined;
          passedCount++;
        }
        else {
          golden.status = 'FAILED_UPDATE';
          const match = statusString.match(/Failed with exception: (.+)/);
          golden.error = match ? match[1] : statusString;
          failedCount++
        }
      }
    });
    return { passedCount, failedCount };
  }

  retryGolden(goldenId: string): void {
    const goldenToRetry = this.goldens.find(g => g.id === goldenId);
    if (goldenToRetry) {
      goldenToRetry.status = 'UPDATING';
      this.goldenService.updateGolden(goldenToRetry).subscribe({
        next: (rawResult: Record<string, string>) => {
          const statusString = Object.values(rawResult)[0];
          if (goldenToRetry) {
            if (statusString == 'Updated') {
              goldenToRetry.status = 'PASSED_UPDATE';
              goldenToRetry.error = undefined;
              this.snackBar.open(`Golden updated successfully!`, 'Close', {
                duration: 3000,
                panelClass: 'success-snackbar'
              });
            }
            else {
              goldenToRetry.status = 'FAILED_UPDATE';
              const match = statusString.match(/Failed with exception: (.+)/);
              goldenToRetry.error = match ? match[1] : statusString;
              this.snackBar.open(`Retry failed. Error: ${goldenToRetry.error || ''}`, 'Close', {
                duration: 5000,
                panelClass: 'error-snackbar'
              });
            }
          }
        },
        error: (err) => {
          console.error(err);
          if (goldenToRetry) {
            goldenToRetry.status = 'FAILED_UPDATE';
          }
          this.snackBar.open(
            'Error updating golden. See console for details.',
            'Close',
            {
              duration: 5000,
              panelClass: 'error-snackbar',
            }
          );
        },
      });
    }
  }

  get shouldShowRefreshButton(): boolean {
    return this.testMode !== TestModes.GERRIT
      && this.testMode !== TestModes.PRESUBMIT;
  }
}

