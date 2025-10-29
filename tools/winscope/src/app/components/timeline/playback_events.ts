import {TraceType} from 'trace_api/trace_type';
import {PlaybackState} from 'viewers/common/playback/playback_state';
import {WinscopeEvent, WinscopeEventType} from 'messaging/winscope_event';
import {TraceGeometryData} from 'parsers/trace_geometry_data';

export class PlaybackStateChangeRequest implements WinscopeEvent {
  readonly type = WinscopeEventType.PLAYBACK_STATE_CHANGE_REQUEST;
  constructor(
    readonly traceType: TraceType,
    readonly state: PlaybackState,
    readonly currentTraceIndex?: number,
  ) {}
}

export class PlaybackStateChangeHandled implements WinscopeEvent {
  readonly type = WinscopeEventType.PLAYBACK_STATE_CHANGE_HANDLED;
  constructor(
    readonly stateToReflect: PlaybackState,
    readonly traceType?: TraceType,
  ) {
    this.stateToReflect = stateToReflect;
    this.traceType = traceType;
  }
}

export class PlaybackSpeedChange implements WinscopeEvent {
  readonly type = WinscopeEventType.PLAYBACK_SPEED_CHANGE;
  constructor(
    readonly traceType: TraceType,
    readonly speedValue: number,
  ) {}
}

export class PlaybackStateChangePropagate implements WinscopeEvent {
  readonly type = WinscopeEventType.PLAYBACK_STATE_CHANGE_PROPAGATE;
  constructor(
    readonly state: PlaybackState,
    readonly currentTraceIndex: number,
    readonly traceGeometryData: TraceGeometryData,
  ) {}
}
