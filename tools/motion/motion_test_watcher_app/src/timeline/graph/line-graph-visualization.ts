import { COLORS, ValueDataPoint, Visualization } from './visualization';
import * as d3 from 'd3';
import { PreviewService } from '../../service/preview.service';
import { DataSource } from '../../model/golden';

export abstract class LineGraphVisualization implements Visualization {

  graphId: string;
  valueOfUndefinedNumber: number;
  dataSource: DataSource | null = null;
  viewSelectedCurrentFrame: number = 0;
  // TODO Can't seem to select the graph with id while updating the marker.
  // Using a global variable of type `any` is ofc a bad idea for this. Using this
  // as temp fix. Hope I don't still see this here in 6 months
  graph: d3.Selection<SVGGElement, unknown, null, undefined> | any;

  margin = { top: 20, right: 20, bottom: 30, left: 50 };
  chartWidth = 0;
  chartHeight = 0;
  legendMarginBottom = 50;
  xScale = d3.scaleLinear();
  solidLineLegend: string = '';
  dottedLineLegend: string = '';
  undefinedExpectedLegend: string = "Undefined Expected";
  undefinedActualLegend: string = "Undefined Actual";
  firstValidDataPoint: number = 0;
  currentShowMarkerState: boolean = true;

  abstract yScale: d3.ScalePoint<string> | d3.ScaleLinear<number, number>;
  protected abstract createYScale(data: ValueDataPoint[]): void;
  protected abstract yScaleFunction: (val: number | string) => number;
  protected abstract getYAxis(): d3.Axis<d3.NumberValue> | d3.Axis<string>;

  constructor(
    graphId: string,
    protected previewService: PreviewService,
    dataSource: DataSource | null = null,
    valueOfUndefinedNumber: number
  ) {
    this.valueOfUndefinedNumber = valueOfUndefinedNumber;
    this.graphId = graphId;
    this.dataSource = dataSource;
    this.previewService.currentFrameFromView$.subscribe((frame) => {
      if (this.viewSelectedCurrentFrame === frame) return;
      this.viewSelectedCurrentFrame = frame ? frame : 0;
      this.updateMarker();
    });
    this.previewService.showMarker$.subscribe((showMarker) => {
      this.currentShowMarkerState = showMarker;
      this.graph.selectAll('.currentFrameLine').remove();
      if (!showMarker) return;
      this.addMarker(this.graph, this.xScale(this.firstValidDataPoint));
    });
  }

  render(
    svg: d3.Selection<SVGSVGElement, unknown, null, undefined>,
    data: ValueDataPoint[],
    width: number,
    height: number
  ): void {
    this.chartWidth = width - this.margin.left - this.margin.right;
    this.chartHeight = height - this.margin.top - this.margin.bottom - this.legendMarginBottom;

    this.xScale = d3
      .scaleLinear()
      .domain(d3.extent(data, (d) => d.x) as [number, number])
      .range([0, this.chartWidth]);

    this.createYScale(data);

    const g = svg
      .append('g')
      .attr('id', this.graphId)
      .attr('transform', `translate(${this.margin.left},${this.margin.top})`);

    this.graph = g;

    // The x-value for the first playable video frame, derived from data[1].
    // data[0] represents a 'before' state with no corresponding video frame.
    this.firstValidDataPoint = data[1]?.x ?? 0;

    this.drawAxes(g);
    this.drawExpected(g, data, this.yScaleFunction);
    this.drawActual(g, data, this.yScaleFunction);
    this.drawLegend(g);
    this.drawHover(g, data, this.yScaleFunction);
    if (this.currentShowMarkerState) {
      this.addMarker(g, this.xScale(this.firstValidDataPoint));
    }
  }

  protected drawAxes(g: d3.Selection<SVGGElement, unknown, null, undefined>) {
    const xAxis = d3.axisBottom(this.xScale);
    const xAxisGroup = g.append('g')
      .attr('class', 'x axis')
      .attr('transform', `translate(0, ${this.chartHeight})`)
      .call(xAxis);

    // Apply X-Axis Styling
    xAxisGroup.selectAll('path').attr('stroke', COLORS.gray);
    xAxisGroup.selectAll('line').attr('stroke', COLORS.gray);
    xAxisGroup.selectAll('text').attr('fill', COLORS.gray);

    const yAxis = this.getYAxis();
    const yAxisGroup = g.append('g')
      .attr('class', 'y axis')
      .call(yAxis);

    // Apply Y-Axis Styling
    yAxisGroup.selectAll('path').attr('stroke', COLORS.gray);
    yAxisGroup.selectAll('line').attr('stroke', COLORS.gray);
    yAxisGroup.selectAll('text').attr('fill', COLORS.gray);
  }

  protected drawExpected(
    g: d3.Selection<SVGGElement, unknown, null, undefined>,
    data: ValueDataPoint[],
    yScaleFunc: (x: string | number) => number
  ) {
    const expectedLine = d3
      .line<ValueDataPoint>()
      .x((d) => this.xScale(d.x))
      .y((d) => yScaleFunc(d.expectedValue as number | string))
      .defined(d => d.expectedValue != null &&
        (typeof d.expectedValue === 'number' || typeof d.expectedValue === 'string'))

    g.append('path')
      .datum(data)
      .attr('fill', 'none')
      .attr('stroke', COLORS.green)
      .attr('stroke-width', 2.4)
      .attr('stroke-dasharray', '10, 5')
      .attr('d', expectedLine);

    g.selectAll('.dot-expected')
      .data(data)
      .enter()
      .append('circle')
      .attr('class', 'dot-expected')
      .attr('cx', (d) => this.xScale(d.x))
      .attr('cy', (d) => yScaleFunc(d.expectedValue ?? this.valueOfUndefinedNumber))
      .attr('r', 5)
      .attr('fill', 'none')
      .attr('stroke', (d) => d.expectedValue != undefined ? COLORS.green : COLORS.dark_gray)
      .attr('stroke-width', 2);
  }

  protected drawActual(
    g: d3.Selection<SVGGElement, unknown, null, undefined>,
    data: ValueDataPoint[],
    yScaleFunc: (x: string | number) => number
  ) {
    const isActualDifferentFromExpected = (d: ValueDataPoint): boolean => {
      if (d.actualValue == null && d.expectedValue == null) {
        return false;
      }
      if (d.actualValue == null || d.expectedValue == null) {
        return true;
      }
      return d.actualValue !== d.expectedValue;
    };
    for (let i = 0; i < data.length - 1; i++) {
      const p1 = data[i];
      const p2 = data[i + 1];
      if (p1.actualValue == null || p2.actualValue == null) {
        continue;
      }
      const segmentColor =
        isActualDifferentFromExpected(p1) || isActualDifferentFromExpected(p2) ? COLORS.red : COLORS.blue;

      g.append('line')
        .attr('x1', this.xScale(p1.x))
        .attr('y1', yScaleFunc(p1.actualValue ?? this.valueOfUndefinedNumber))
        .attr('x2', this.xScale(p2.x))
        .attr('y2', yScaleFunc(p2.actualValue ?? this.valueOfUndefinedNumber))
        .attr('stroke', segmentColor)
        .attr('stroke-width', 2.5)
    }
    g.selectAll('.dot-actual')
      .data(data)
      .enter()
      .append('circle')
      .attr('class', 'dot-actual')
      .attr('cx', (d) => this.xScale(d.x))
      .attr('cy', (d) => yScaleFunc(d.actualValue ?? this.valueOfUndefinedNumber))
      .attr('r', (d) => { return isActualDifferentFromExpected(d) ? 4 : 3 })
      .attr('fill', (d) => {
        if (d.actualValue != undefined) {
          return isActualDifferentFromExpected(d) ? COLORS.red : COLORS.blue;
        }
        return COLORS.dark_gray;
      })
  }

  protected drawLegend(g: d3.Selection<SVGGElement, unknown, null, undefined>) {
    this.updateLegend();
    const legend = g
      .append('g')
      .attr('class', 'legend')
      .attr(
        'transform',
        `translate(0, ${this.chartHeight + this.legendMarginBottom})`
      );

    legend
      .append('line')
      .attr('x1', 0)
      .attr('y1', 0)
      .attr('x2', 10)
      .attr('y2', 0)
      .attr('stroke', COLORS.blue)
      .attr('stroke-width', 2.5);

    legend
      .append('line')
      .attr('x1', 10)
      .attr('y1', 0)
      .attr('x2', 20)
      .attr('y2', 0)
      .attr('stroke', COLORS.red)
      .attr('stroke-width', 2.5);

    legend
      .append('text')
      .attr('x', 25)
      .attr('y', 0)
      .text(this.solidLineLegend)
      .attr('alignment-baseline', 'middle');

    legend
      .append('line')
      .attr('x1', 85)
      .attr('y1', 0)
      .attr('x2', 105)
      .attr('y2', 0)
      .attr('stroke', COLORS.green)
      .attr('stroke-dasharray', '8, 3')
      .attr('stroke-width', 2.5);

    legend
      .append('text')
      .attr('x', 110)
      .attr('y', 0)
      .text(this.dottedLineLegend)
      .attr('alignment-baseline', 'middle');

    legend
      .append('circle')
      .attr('r', 5)
      .attr('cx', 195)
      .attr('cy', 0)
      .attr('fill', 'none')
      .attr('stroke', COLORS.dark_gray)
      .attr('stroke-width', 2);

    legend
      .append('text')
      .attr('x', 205)
      .attr('y', 0)
      .text(this.undefinedExpectedLegend)
      .attr('alignment-baseline', 'middle');

    legend
      .append('circle')
      .attr('r', 4)
      .attr('cx', 365)
      .attr('cy', 0)
      .attr('fill', COLORS.dark_gray)

    legend
      .append('text')
      .attr('x', 375)
      .attr('y', 0)
      .text(this.undefinedActualLegend)
      .attr('alignment-baseline', 'middle');
  }

  protected drawHover(
    g: d3.Selection<SVGGElement, unknown, null, undefined>,
    data: ValueDataPoint[],
    yScaleFunc: (x: string | number) => number
  ) {
    const YmarkerLine = g
      .append('line')
      .attr('class', 'marker-line vertical')
      .attr('y1', 0)
      .attr('y2', this.chartHeight)
      .attr('stroke', 'lightblue')
      .attr('stroke-width', 1)
      .style('opacity', 0);

    const XmarkerLine = g
      .append('line')
      .attr('class', 'marker-line horizontal')
      .attr('x1', 0)
      .attr('x2', this.chartWidth)
      .attr('stroke', 'lightblue')
      .attr('stroke-width', 1)
      .style('opacity', 0);

    const tooltip = g
      .append('g')
      .attr('class', 'tooltip')
      .style('display', 'none');

    const tooltipRect = tooltip
      .append('rect')
      .attr('fill', 'white')
      .attr('stroke', 'black')
      .attr('rx', 5);

    const tooltipText = tooltip.append('text').attr('fill', 'black');

    g.append('rect')
      .attr('class', 'overlay')
      .attr('width', this.chartWidth)
      .attr('height', this.chartHeight)
      .attr('fill', 'none')
      .attr('pointer-events', 'all')
      .on('mouseover', () => {
        YmarkerLine.style('opacity', 1);
        XmarkerLine.style('opacity', 1);
        tooltip.style('opacity', 1);
      })
      .on('mouseout', () => {
        YmarkerLine.style('opacity', 0);
        XmarkerLine.style('opacity', 0);
        tooltip.style('opacity', 0);
      })
      .on('mousemove', (event: MouseEvent) => {
        const xPos = d3.pointer(event, g.node())[0];
        const yPos = d3.pointer(event, g.node())[1];
        XmarkerLine.attr('y1', yPos).attr('y2', yPos);
        const dataPoint = this.getDataPointAtX(xPos, data);
        if (dataPoint) {
          const snappedXPos = this.xScale(dataPoint.x);
          YmarkerLine.attr('x1', snappedXPos).attr('x2', snappedXPos);

          tooltipText
            .text(`${this.solidLineLegend}: ${dataPoint.actualValue}`)
            .append('tspan')
            .attr('x', 0)
            .attr('dy', '1.2em')
            .text(`${this.dottedLineLegend}: ${dataPoint.expectedValue}`);
          const textBBox = (tooltipText.node() as SVGTextElement).getBBox();
          tooltipRect
            .attr('x', textBBox.x - 5)
            .attr('y', textBBox.y - 5)
            .attr('width', textBBox.width + 10)
            .attr('height', textBBox.height + 10);

          let tooltipX = snappedXPos + 10;
          const tooltipWidth = textBBox.width + 10;
          if (tooltipX + tooltipWidth > this.chartWidth) {
            tooltipX = snappedXPos - tooltipWidth - 10;
          }

          tooltip.attr(
            'transform',
            `translate(${tooltipX},${yScaleFunc(dataPoint.actualValue ?? this.valueOfUndefinedNumber)})`
          );

          tooltip.style('display', 'block');
        } else {
          tooltip.style('display', 'none');
        }
      });
  }

  protected getDataPointAtX(x: number, data: ValueDataPoint[]): ValueDataPoint | null {
    const xValue = this.xScale.invert(x);
    let closestDataPoint = null;
    let minDistance = Infinity;

    for (const dataPoint of data) {
      const distance = Math.abs(dataPoint.x - xValue);
      if (distance < minDistance) {
        minDistance = distance;
        closestDataPoint = dataPoint;
      }
    }
    return closestDataPoint;
  }

  protected addMarker(
    g: d3.Selection<SVGGElement, unknown, null, undefined>,
    xPos: number
  ): void {
    g.append('line')
      .attr('class', 'currentFrameLine')
      .attr('x1', xPos)
      .attr('y1', -400)
      .attr('x2', xPos)
      .attr('y2', this.chartHeight)
      .attr('stroke', COLORS.red)
      .attr('stroke-width', 1)
      .attr('stroke-linecap', 'butt')
  }

  protected updateMarker(): void {
    if (!this.graph) return;
    this.graph.selectAll('.currentFrameLine').remove();
    const xPos = this.xScale(this.viewSelectedCurrentFrame);
    if (xPos >= 0 && xPos <= this.chartWidth) {
      this.addMarker(this.graph, xPos);
    }
  }

  protected updateLegend(): void {
    switch (this.dataSource) {
      case DataSource.GERRIT:
        this.solidLineLegend = 'Right';
        this.dottedLineLegend = 'Left';
        break;
      default:
        this.solidLineLegend = 'Actual';
        this.dottedLineLegend = 'Expected';
        break;
    }
  }
}
