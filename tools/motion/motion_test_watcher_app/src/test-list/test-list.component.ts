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
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { TestModes } from '../model/test_mode';
import { GoldenActionService } from '../service/golden-action.service';
import { GoldenStatus, TestResult } from '../model/enums';

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
    MatCheckboxModule
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

  // Expose Enums to template
  public GoldenStatus = GoldenStatus;
  public TestResult = TestResult;

  constructor(
    private goldenService: GoldensService,
    private goldenActionService: GoldenActionService,
  ) { }


  filterStatus: 'all' | 'pass' | 'fail' = 'all';
  searchTerm: string = '';
  filteredPresubmitTests: PresubmitTest[] = [];

  totalTestCount = 0;
  passingTestCount = 0;
  failingTestCount = 0;

  ngOnChanges(changes: SimpleChanges): void {
    let shouldUpdateGoldens = false;
    if (changes['goldens']) {
      this.totalTestCount = this.goldens.length;
      this.failingTestCount = this.goldens.filter(
        (golden) => golden.result !== TestResult.Passed
      ).length;
      this.passingTestCount = this.totalTestCount - this.failingTestCount;
      shouldUpdateGoldens = true;
    }

    if (shouldUpdateGoldens || changes['presubmitTests']) {
      console.log('TestListComponent: Updating goldens. Mode:', this.testMode, 'Count:', this.goldens.length);
      this.updateAndGroupGoldens();
      this.filterPresubmitTests();
    }
  }

  onFilterStatusChange(): void {
    this.updateAndGroupGoldens();
    this.filterPresubmitTests();;
  }

  onSearchTermChange(): void {
    this.updateAndGroupGoldens();
    this.filterPresubmitTests();
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
      filteredGoldens = this.goldens.filter((golden) => golden.result === TestResult.Passed);
    } else {
      filteredGoldens = this.goldens.filter((golden) => golden.result !== TestResult.Passed);
    }

    if (this.searchTerm && this.searchTerm.trim() !== '') {
      const lowerSearchTerm = this.searchTerm.toLowerCase();
      filteredGoldens = filteredGoldens.filter(golden =>
        golden.testMethodName.toLowerCase().includes(lowerSearchTerm) ||
        golden.testClassName.toLowerCase().includes(lowerSearchTerm)
      );
    }
    this.sortGoldensBasedOnFetchTime(filteredGoldens)
    this.filteredGoldens = this.groupGoldensByTime(filteredGoldens);
    console.log('TestListComponent: Filtered goldens:', this.filteredGoldens);
  }

  ngOnInit(): void {
    this.updateAndGroupGoldens();
    this.filterPresubmitTests();;
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
    switch (golden.result) {
      case TestResult.MissingReference:
        return 'border-l-4 border-yellow-500';
      case TestResult.Failed:
        return 'border-l-4 border-red-500';
      case TestResult.Passed:
        return 'border-l-4 border-green-500';
      default:
        return '';
    }
  }

  isGoldenSelected(golden: MotionGolden): boolean {
    return this.selectedGoldenIds.has(golden.id);
  }

  toggleGoldenSelection(golden: MotionGolden, event: any): void {
    const isChecked = event.checked;
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

  toggleAllBoxesSelection(event: any): void {
    const isChecked = event.target.checked;
    if (isChecked) {
      this.selectedGoldenIds = new Set(this.filteredGoldens.flatMap((item) => item.value.map((golden) => golden.id)));
    } else {
      this.selectedGoldenIds.clear();
    }
  }

  updateSelectedGoldens(): void {
    const goldensToUpdate = this.goldens.filter(g => this.selectedGoldenIds.has(g.id));
    if (goldensToUpdate.length === 0) {
      this.goldenActionService.updateSelectedGoldens([]).subscribe();
      return;
    }

    this.isUpdating = true;
    this.goldenActionService.updateSelectedGoldens(goldensToUpdate).subscribe({
      complete: () => {
        this.isUpdating = false;
        this.selectedGoldenIds.clear();
        this.showCheckBoxes = false;
        this.showCheckBoxesChange.emit(this.showCheckBoxes);
      }
    });
  }

  retryGolden(goldenId: string): void {
    const goldenToRetry = this.goldens.find(g => g.id === goldenId);
    if (goldenToRetry) {
      this.goldenActionService.updateGolden(goldenToRetry).subscribe();
    }
  }

  get shouldShowRefreshButton(): boolean {
    return this.testMode !== TestModes.GERRIT
      && this.testMode !== TestModes.PRESUBMIT;
  }

  filterPresubmitTests(): void {
    if (!this.searchTerm) {
      this.filteredPresubmitTests = [...this.presubmitTests];
      return;
    }
    const lowerSearchTerm = this.searchTerm.toLowerCase();
    this.filteredPresubmitTests = this.presubmitTests.filter(test =>
      test.testname.toLowerCase().includes(lowerSearchTerm)
    );
  }
  get isSimpleMode(): boolean {
    return this.testMode === TestModes.CODESEARCH || this.testMode === TestModes.USER;
  }

  get showStandardList(): boolean {
    return this.totalTestCount > 0 && !this.isSimpleMode;
  }

  get showSimpleList(): boolean {
    return this.isSimpleMode && this.goldens.length > 0;
  }
}
