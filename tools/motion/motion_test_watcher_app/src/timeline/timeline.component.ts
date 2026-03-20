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
import { forkJoin, of } from 'rxjs';
import { GraphComponent } from './graph/graph.component';
import { MatDialogModule } from '@angular/material/dialog';
import { MatDialog } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { FilterComponent, SelectOption } from '../filter/filter.component';
import { FilterService } from '../service/filter.service';
import { Subscription } from 'rxjs';
import { TestModes } from '../model/test_mode';
import { GoldenActionService } from '../service/golden-action.service';

@Component({
  selector: 'app-timeline',
  imports: [
    NgIf,
    NgFor,
    GraphComponent,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatTooltipModule
  ],
  templateUrl: './timeline.component.html',
  styleUrl: './timeline.component.css',
})
export class TimelineComponent implements OnChanges {
  constructor(
    private goldenService: GoldensService,
    private goldenActionService: GoldenActionService,
    private previewService: PreviewService,
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
      console.log('Selected Golden changed:', this.selectedGolden);
      console.log('DataSource:', this.selectedGolden?.dataSource);
      if (this.selectedGolden?.dataSource === DataSource.GERRIT ||
        this.selectedGolden?.dataSource === DataSource.CODESEARCH ||
        this.selectedGolden?.dataSource === DataSource.USER) {
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

    const observables: any[] = [
      this.goldenService.getActualGoldenData(this.selectedGolden)
    ];

    if (this.selectedGolden.expectedUrl) {
      observables.push(this.goldenService.getExpectedGoldenData(this.selectedGolden));
    } else {
      observables.push(of({}));
    }

    forkJoin(observables).subscribe({
      next: (results: any[]) => {
        const actualData = results[0];
        const expectedData = results.length > 1 ? results[1] : undefined;
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

  updatePageFromData(actualData: MotionGoldenData, expectedData: MotionGoldenData) {
    this.expectedData = expectedData
    this.actualData = actualData
    if (this.actualData) {
      this.previewService.updateFrames(this.actualData.frame_ids)
    }
    this.buildUi();
    this.populateFeatureOptions();
  }

  buildUi() {
    if (!this.selectedGolden) return;
    if (this.actualData
      && Object.keys(this.actualData).length > 0) {
      this.processData(this.actualData)
    }
    if (this.expectedData
      && Object.keys(this.expectedData).length > 0) {
      this.processData(this.expectedData)
    }
    this.featureCount = this.actualData?.features.length ?? this.expectedData?.features?.length ?? 0
  }

  processData(data: MotionGoldenData) {
    data.features = this.flattenFeatures(data.features);
  }

  private flattenFeatures(features: MotionGoldenFeature[]): MotionGoldenFeature[] {
    const result: MotionGoldenFeature[] = [];
    features.forEach(feature => {
      let firstValidObject: any = null;
      for (const point of feature.data_points) {
        if (point && typeof point === 'object' && !isNotFound(point) && !Array.isArray(point) && Object.keys(point).length > 0) {
          firstValidObject = point;
          break;
        }
      }

      if (firstValidObject) {
        const keys = Object.keys(firstValidObject);
        const subFeatures: MotionGoldenFeature[] = keys.map(key => ({
          name: `${feature.name}.${key}`,
          type: feature.type,
          data_points: feature.data_points.map((point: any) =>
            point && typeof point === 'object' && !isNotFound(point) ? point[key] : undefined
          )
        }));
        result.push(...this.flattenFeatures(subFeatures));
      } else {
        result.push(feature);
      }
    });
    return result;
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
    this.goldenActionService.updateGolden(this.selectedGolden).subscribe();
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
    return this.testMode != TestModes.GERRIT
      && this.testMode != TestModes.CODESEARCH
      && this.testMode != TestModes.USER;
  }
}
