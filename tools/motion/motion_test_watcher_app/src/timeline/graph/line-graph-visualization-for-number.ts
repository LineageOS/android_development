import { Visualization, COLORS, ValueDataPoint } from './visualization';
import * as d3 from 'd3';
import { PreviewService } from '../../service/preview.service';
import { DataSource } from '../../model/golden';
import { LineGraphVisualization } from './line-graph-visualization';

export class LineGraphVisualizationForNumber extends LineGraphVisualization implements Visualization {
  minValue: number;
  maxValue: number;
  yScale = d3.scaleLinear();

  constructor(
    minValue: number,
    maxValue: number,
    graphId: string,
    previewService: PreviewService,
    dataSource: DataSource | null = null
  ) {
    super(
      graphId,
      previewService,
      dataSource,
      minValue - (Math.abs(maxValue - minValue) / 5)
    );
    this.minValue = minValue;
    this.maxValue = maxValue;
  }

  protected override createYScale = (data: ValueDataPoint[]): void => {
    this.yScale = d3
      .scaleLinear()
      .domain([this.minValue, this.maxValue])
      .range([this.chartHeight, 0]);
  }

  protected yScaleFunction = (val: number | string): number => {
    if (typeof val === 'number') {
      return this.yScale(val);
    }
    return -1;
  }

  protected override getYAxis = (): d3.Axis<d3.NumberValue> | d3.Axis<string> => {
    const currentYAxisTicks = this.yScale.ticks().length;
    const newYAxisTicks = Math.max(1, Math.floor(currentYAxisTicks / 2));
    const yAxis = d3.axisLeft(this.yScale)
      .ticks(newYAxisTicks);
    return yAxis;
  }
}
