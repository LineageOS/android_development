import { PreviewService } from './../../service/preview.service';
import {
  AfterViewInit,
  Component,
  Input,
  ViewChild,
  OnChanges,
  SimpleChanges,
  ElementRef,
  Output,
  EventEmitter,
} from '@angular/core';
import { MotionGoldenData, MotionGoldenFeature, DataSource } from '../../model/golden';
import { Visualization, DataPoint } from './visualization';
import { LineGraphVisualization } from './line-graph-visualization';
import * as d3 from 'd3';
import { NgIf } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-graph',
  imports: [NgIf, MatIconModule],
  templateUrl: './graph.component.html',
  styleUrl: './graph.component.css',
})
export class GraphComponent implements AfterViewInit, OnChanges {
  constructor(private previewService: PreviewService) { }

  @Input() expectedData: MotionGoldenData | undefined;
  @Input() actualData: MotionGoldenData | undefined;
  @Input() featureName: string | undefined;
  @Input() isExpanded: boolean = false;
  @Input() showTestList: boolean = false;
  @Input() dataSource: DataSource | null = null;
  @Output() expand = new EventEmitter<string>();

  @ViewChild('chartContainer', { static: true })
  chartContainer!: ElementRef<HTMLDivElement>;
  graphId: string = '';

  private svg!: d3.Selection<SVGSVGElement, unknown, null, undefined>;
  private width!: number;
  private height!: number;
  private data: DataPoint[] = [];
  private visualization!: Visualization;
  private resizeObserver: ResizeObserver | null = null;

  ngAfterViewInit(): void {
    this.graphId = `graph-${this.featureName}-${Date.now()}`;
    this.width = this.chartContainer.nativeElement.offsetWidth;
    this.height = this.chartContainer.nativeElement.offsetHeight;
    this.createChart();
    this.setupResizeObserver();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (
      changes['actualData'] ||
      changes['expectedData'] ||
      changes['featureName']
    ) {
      this.graphId = `graph-${this.featureName}-${Date.now()}`;
      this.updateData();
      this.createChart();
    }
  }

  private setupResizeObserver(): void {
    if (this.chartContainer && this.chartContainer.nativeElement) {
      this.resizeObserver = new ResizeObserver(entries => {
        for (const entry of entries) {
          const newWidth = entry.contentRect.width;
          if (this.width !== newWidth) {
            this.width = newWidth;
            this.createChart();
          }
        }
      });
      this.resizeObserver.observe(this.chartContainer.nativeElement);
    }
  }

  ngOnDestroy(): void {
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }
  }

  private updateData(): void {
    if (!this.featureName) {
      console.log("No feature name provided")
      return
    }
    this.data = [];
    const actualFeature = this.actualData?.features?.find(
      (f) => f.name === this.featureName
    )
    const expectedFeature = this.expectedData?.features?.find(
      (f) => f.name === this.featureName
    )
    this.visualization = this.createVisualization(actualFeature, expectedFeature);
    if (this.visualization instanceof LineGraphVisualization) {
      this.createLineChartData(actualFeature, expectedFeature);
    } else {
    }
  }

  private createLineChartData(
    actualFeature: MotionGoldenFeature | undefined,
    expectedFeature: MotionGoldenFeature | undefined
  ) {

    const actualDataPoints = actualFeature?.data_points ?? [];
    const expectedDataPoints = expectedFeature?.data_points ?? [];

    const combinedLength = Math.max(
      actualDataPoints.length,
      expectedDataPoints.length
    );

    const frameIdSource =
      (actualDataPoints.length >= expectedDataPoints.length)
        ? this.actualData
        : this.expectedData;

    if (!frameIdSource?.frame_ids)
      return;

    for (let i = 0; i < combinedLength; i++) {
      const actualDataPoint = actualDataPoints[i];
      const expectedDataPoint = expectedDataPoints[i];

      let x = -1;
      if (frameIdSource?.frame_ids[i] === 'after') {
        x = (frameIdSource?.frame_ids[i - 1] as number) + 50;
      } else if (frameIdSource?.frame_ids[i] === 'before') {
        x = (frameIdSource?.frame_ids[i + 1] as number) - 50;
      } else {
        x = frameIdSource?.frame_ids[i] as number;
      }

      const newPoint: DataPoint = { x };
      if (typeof actualDataPoint === 'number') {
        newPoint.actualValue = actualDataPoint;
      }
      if (typeof expectedDataPoint === 'number') {
        newPoint.expectedValue = expectedDataPoint;
      }
      this.data.push(newPoint);
    }
  }

  private createVisualization(
    actualFeature: MotionGoldenFeature | undefined,
    expectedFeature: MotionGoldenFeature | undefined = undefined
  ): Visualization {
    const name = actualFeature?.name;
    const type = actualFeature?.type;

    let numericValues: number[] = [];
    if (actualFeature?.data_points) {
      numericValues = numericValues.concat(actualFeature.data_points.filter(
        (it): it is number => typeof it === 'number'
      ))
    };
    if (expectedFeature?.data_points) {
      numericValues = numericValues.concat(expectedFeature.data_points.filter(
        (it): it is number => typeof it === 'number'
      ))
    };

    let minValue = Math.min(...numericValues) ?? 0;
    let maxValue = Math.max(...numericValues) ?? 1;

    if (minValue === maxValue) {
      maxValue += 1;
    }
    if (minValue !== 0) {
      minValue -= (maxValue - minValue) / 10;
    }

    return new LineGraphVisualization(
      minValue,
      maxValue,
      this.graphId,
      this.previewService,
      this.dataSource
    );
  }

  private createChart(): void {
    this.chartContainer.nativeElement.innerHTML = '';
    this.svg = d3
      .select(this.chartContainer.nativeElement)
      .append('svg')
      .attr('width', this.width)
      .attr('height', this.height);
    this.visualization.render(this.svg, this.data, this.width, this.height);
  }
}
