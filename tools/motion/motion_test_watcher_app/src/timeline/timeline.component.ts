import { Component, Input, OnChanges, SimpleChanges, Inject } from '@angular/core';
import {
  MotionGolden,
  MotionGoldenData,
  MotionGoldenFeature,
  isNotFound,
  DataSource,
  DataPoint,
} from '../model/golden';
import { GoldensService } from '../service/goldens.service';
import { PreviewService } from '../service/preview.service';
import { NgFor, NgIf } from '@angular/common';
import { forkJoin } from 'rxjs';
import { GraphComponent } from './graph/graph.component';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatDialogModule } from '@angular/material/dialog';
import { MatDialog } from '@angular/material/dialog';
import { FilterComponent, SelectOption } from '../filter/filter.component';
import { FilterService } from '../service/filter.service';
import { Subscription } from 'rxjs';
import { TestModes } from '../model/test_mode';

@Component({
  selector: 'app-timeline',
  imports: [
    NgIf,
    NgFor,
    GraphComponent,
    MatDialogModule],
  templateUrl: './timeline.component.html',
  styleUrl: './timeline.component.css',
})
export class TimelineComponent implements OnChanges {
  constructor(
    private goldenService: GoldensService,
    private snackBar: MatSnackBar,
    private preivewService: PreviewService,
    private dialog: MatDialog,
    private filterService: FilterService
  ) { }

  @Input() selectedGolden: MotionGolden | null = null;
  @Input() showTestList: boolean = false;
  @Input() testMode: string = "";

  actualData: MotionGoldenData | undefined;
  expectedData: MotionGoldenData | undefined;
  loading: boolean = false;
  featureCount = 0;
  expandedGraphIdx: number = -1;
  availableOptions: SelectOption[] = [];
  displayedData: SelectOption[] = [];

  receivedSelectedOptions: SelectOption[] = [];
  private selectedOptionsSubscription: Subscription | undefined;

  ngOnInit(): void {
    this.selectedOptionsSubscription = this.filterService.selectedOptions$
      .subscribe((options: SelectOption[]) => {
        this.receivedSelectedOptions = options;
        this.applyReceivedFilter(this.receivedSelectedOptions);
      });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['selectedGolden']) {
      this.receivedSelectedOptions = [];
      if(this.selectedGolden?.dataSource === DataSource.GERRIT){
        this.updatePageFromData(
          this.selectedGolden.actualData,
          this.selectedGolden.expectedData
        );
      } else {
        this.updatePage();
      }
    }
  }

  applyReceivedFilter(options: SelectOption[]): void {
    this.displayedData = [...this.receivedSelectedOptions];

  }

  openFilter() {
    this.dialog.open(FilterComponent, {
      panelClass: ['w-1/2', 'h-1/2', 'rounded-none', 'shadow-lg']
    })
  }

  updatePage() {
    if (!this.selectedGolden) return;
    this.loading = true;

    forkJoin([
      this.goldenService.getActualGoldenData(this.selectedGolden),
      this.goldenService.getExpectedGoldenData(this.selectedGolden),
    ]).subscribe({
      next: ([actualData, expectedData]) => {
        this.loading = false;
        this.updatePageFromData(actualData, expectedData)
      },
      error: (err) => {
        this.loading = false;
        this.expectedData = undefined;
        this.actualData = undefined;
      },
    });
  }

  updatePageFromData(actualData: MotionGoldenData, expectedData: MotionGoldenData){
    this.expectedData = expectedData
    this.actualData = actualData
    this.preivewService.updateFrames(this.actualData.frame_ids)
    this.buildUi();
    this.populateFeatureOptions();
  }

  buildUi() {
    if (!this.selectedGolden) return;
    if(this.actualData
      && Object.keys(this.actualData).length > 0) {
        this.processData(this.actualData)
      }
    if(this.expectedData
      && Object.keys(this.expectedData).length > 0) {
        this.processData(this.expectedData)
      }
    this.featureCount = this.actualData?.features.length ?? this.expectedData?.features?.length ?? 0
  }

  processData(data: MotionGoldenData) {
    const newFeatures: MotionGoldenFeature[] = [];

    data.features.forEach((feature) => {
      if (
        feature.data_points &&
        Array.isArray(feature.data_points) &&
        feature.data_points.length > 0
      ) {
        let firstValidDataPoint: any = null;
        for (const dataPoint of feature.data_points) {
          if (typeof dataPoint === 'object' && !isNotFound(dataPoint)) {
            firstValidDataPoint = dataPoint;
            break;
          }
        }

        if (firstValidDataPoint) {
          const keys = Object.keys(firstValidDataPoint);
          keys.forEach((key) => {
            newFeatures.push({
              name: `${feature.name}.${key}`,
              type: feature.type,
              data_points: feature.data_points.map((point: any) =>
                point && typeof point === 'object' ? point[key] : undefined
              ),
            });
          });
        } else {
          newFeatures.push(feature);
        }
      } else {
        newFeatures.push(feature);
      }
    });
    data.features = newFeatures;
  }

  toggleGraph(name: string) {
    console.log("Toggling " + name)
    const index = this.actualData?.features.findIndex(
      (feature) => feature.name === name
    );
    if (index !== undefined && index !== this.expandedGraphIdx) {
      this.expandedGraphIdx = index;
    } else {
      this.expandedGraphIdx = -1;
    }
  }

  onNext() {
    this.expandedGraphIdx = (this.expandedGraphIdx + 1) % this.featureCount;
  }

  onPrevious() {
    this.expandedGraphIdx =
      (this.expandedGraphIdx - 1 + this.featureCount) % this.featureCount;
  }

  updateGolden() {
    if (!this.selectedGolden) return;
    this.selectedGolden.status = 'UPDATING';
    this.goldenService.updateGolden(this.selectedGolden).subscribe({
      next: (rawResult: Record<string, string>) => {
        const statusString = Object.values(rawResult)[0];
        if (this.selectedGolden) {
          if (statusString == 'Updated') {
            this.selectedGolden.status = 'PASSED_UPDATE';
            this.selectedGolden.error = undefined;
            this.snackBar.open(`Golden updated successfully!`, 'Close', {
              duration: 3000,
              panelClass: 'success-snackbar'
            });
          }
          else {
            this.selectedGolden.status = 'FAILED_UPDATE';
            const match = statusString.match(/Failed with exception: (.+)/);
            this.selectedGolden.error = match ? match[1] : statusString;
            this.snackBar.open(`Retry failed. Error: ${this.selectedGolden.error || ''}`, 'Close', {
              duration: 5000,
              panelClass: 'error-snackbar'
            });
          }
        }
      },
      error: (err) => {
        console.error(err);
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

  getSelectedFeatureName(): string | undefined {
    if (this.actualData && this.expandedGraphIdx !== undefined) {
      return this.actualData.features[this.expandedGraphIdx]?.name;
    }
    return undefined;
  }

  getFeatureName(index: number): string | undefined {
    if (this.actualData) {
      return this.actualData.features[index]?.name;
    }
    return undefined;
  }

  openModal(): void {
    const dialogRef = this.dialog.open(FilterComponent, {
      width: '60%',
      height: '400px'
    });
  }

  areArraysEqual(arr1?: DataPoint[], arr2?: DataPoint[]): boolean {
    if (arr1?.length !== arr2?.length) {
      return false;
    }
    return arr1?.every((value, index) => value === arr2![index]) ?? true;
  }

  populateFeatureOptions(): void {
    this.availableOptions = [];
    if (this.actualData && this.actualData.features) {
      let nextId = 1;
      this.actualData.features.forEach((feature) => {
        const featureName = feature.name;
        const expectedDataPoints = this.expectedData?.features.find(
         (f) => f.name === featureName
        )?.data_points;
        const actualDataPoints = feature.data_points;
        const isFeaturePassing = this.areArraysEqual(actualDataPoints, expectedDataPoints);
        if (featureName) {
          this.availableOptions.push({
            id: nextId++,
            name: featureName,
            selected: true,
            passing: isFeaturePassing
          });
        }
      });
      this.displayedData = [...this.availableOptions];
    }
    this.filterService.sendSelectOption(this.availableOptions);
  }

  shouldDisplayGraph(featureName: string): boolean {
    if (this.receivedSelectedOptions.length === 0) {
      return true;
    }
    const isFilteringByFailing = this.receivedSelectedOptions.length === 1 && this.receivedSelectedOptions[0].name === "Failing features";
    if (isFilteringByFailing) {
      return this.availableOptions.some((option) => option.name === featureName && !option.passing);
    }
    return this.receivedSelectedOptions.some(selectedOption =>
      selectedOption.name === featureName
    )
  }

  get showUpdateButton(): boolean {
    return this.testMode != TestModes.PRESUBMIT
      && this.testMode != TestModes.GERRIT;
  }
}
