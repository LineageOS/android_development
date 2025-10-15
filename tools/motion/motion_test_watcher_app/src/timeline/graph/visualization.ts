export interface Visualization {
  render(
    svg: d3.Selection<SVGSVGElement, unknown, null, undefined>,
    data: ValueDataPoint[],
    width: number,
    height: number
  ): void;
}

export interface ValueDataPoint {
  x: number;
  actualValue?: number | string;
  expectedValue?: number | string;
}


export const COLORS = {
  gray: 'rgb(99, 99, 99)',
  green: 'rgb(76, 199, 45)',
  blue: 'rgb(98, 32, 221)',
  red: 'rgb(240, 60, 60)',
  dark_gray: 'rgb(74, 85, 104)'
};
