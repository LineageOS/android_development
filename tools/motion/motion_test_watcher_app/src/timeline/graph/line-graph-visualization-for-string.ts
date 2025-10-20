import { Visualization, ValueDataPoint } from './visualization';
import * as d3 from 'd3';
import { PreviewService } from '../../service/preview.service';
import { DataSource } from '../../model/golden';
import { LineGraphVisualization } from './line-graph-visualization';

export class LineGraphVisualizationForString extends LineGraphVisualization implements Visualization {
    yScale = d3.scalePoint();
    domain = new Set<string>();

    constructor(
        graphId: string,
        previewService: PreviewService,
        dataSource: DataSource | null = null
    ) {
        const valueOfUndefinedBoolean: number = 0;
        super(
            graphId,
            previewService,
            dataSource,
            valueOfUndefinedBoolean
        );
    }

    protected yScaleFunction = (val: number | string): number => {
        if (typeof val === 'string') {
            return this.yScale(val) ?? this.valueOfUndefinedNumber;
        }
        return this.yScale("undefined") ?? this.valueOfUndefinedNumber;
    }

    protected createYScale = (data: ValueDataPoint[]): void => {
        this.domain = new Set<string>(["undefined"]);

        data.forEach(d => {
            if (d.actualValue !== undefined) {
                this.domain.add(d.actualValue as string);
            }
            if (d.expectedValue !== undefined) {
                this.domain.add(d.expectedValue as string);
            }
        });

        this.yScale = d3
            .scalePoint<string>()
            .domain(this.domain)
            .range([this.chartHeight, 0]);
    }

    protected override getYAxis = (): d3.Axis<d3.NumberValue> | d3.Axis<string> => {
        const newYAxisTicks = this.domain.size - 1;
        const yAxis = d3.axisLeft(this.yScale)
            .ticks(newYAxisTicks);
        return yAxis;
    }
}
