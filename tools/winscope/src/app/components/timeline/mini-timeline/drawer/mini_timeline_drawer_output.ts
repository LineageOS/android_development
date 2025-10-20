import {TimeRange, Timestamp} from 'common/time/time';

/**
 * Output data from the mini timeline drawer.
 */
export class MiniTimelineDrawerOutput {
  constructor(
    public selectedPosition: Timestamp,
    public selection: TimeRange,
  ) {}
}
