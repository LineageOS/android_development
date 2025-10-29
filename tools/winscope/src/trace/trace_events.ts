import {Timestamp} from 'common/time/time';
import {Trace, TraceEntry, TraceEntryEager} from 'trace_api/trace';
import {TracePosition} from 'trace_api/trace_position';
import {WinscopeEvent, WinscopeEventType} from 'messaging/winscope_event';
import {MediaBasedTraceEntry} from 'trace_api/media_based_trace_entry';

export class TracePositionUpdate implements WinscopeEvent {
  readonly type = WinscopeEventType.TRACE_POSITION_UPDATE;
  constructor(
    readonly position: TracePosition,
    readonly updateTimeline = false,
    readonly prefetchedEntry?: TraceEntryEager<object, object>,
  ) {}

  static fromTimestamp(
    timestamp: Timestamp,
    updateTimeline = false,
  ): TracePositionUpdate {
    const position = TracePosition.fromTimestamp(timestamp);
    return new TracePositionUpdate(position, updateTimeline);
  }

  static fromTraceEntry(
    entry: TraceEntry<{}>,
    updateTimeline = false,
  ): TracePositionUpdate {
    const position = TracePosition.fromTraceEntry(entry);
    return new TracePositionUpdate(position, updateTimeline);
  }
}

export class TraceSearchRequest implements WinscopeEvent {
  readonly type = WinscopeEventType.TRACE_SEARCH_REQUEST;
  constructor(readonly query: string) {}
}

export class TraceSearchFailed implements WinscopeEvent {
  readonly type = WinscopeEventType.TRACE_SEARCH_FAILED;
}

export class TraceAddRequest implements WinscopeEvent {
  readonly type = WinscopeEventType.TRACE_ADD_REQUEST;
  constructor(readonly trace: Trace<object>) {}
}

export class TraceRemoveRequest implements WinscopeEvent {
  readonly type = WinscopeEventType.TRACE_REMOVE_REQUEST;
  constructor(readonly trace: Trace<object>) {}
}

export class InitializeTraceSearchRequest implements WinscopeEvent {
  readonly type = WinscopeEventType.INITIALIZE_TRACE_SEARCH_REQUEST;
}

export class TraceSearchInitialized implements WinscopeEvent {
  readonly type = WinscopeEventType.TRACE_SEARCH_INITIALIZED;
  constructor(readonly views: string[]) {}
}

export class TraceSearchCompleted implements WinscopeEvent {
  readonly type = WinscopeEventType.TRACE_SEARCH_COMPLETED;
}

export class ShowTraceUploadWarning implements WinscopeEvent {
  readonly type = WinscopeEventType.SHOW_TRACE_UPLOAD_WARNING;
  constructor(readonly message: string) {}
}

export class ActiveTraceChanged implements WinscopeEvent {
  readonly type = WinscopeEventType.ACTIVE_TRACE_CHANGED;
  constructor(readonly trace: Trace<object>) {}
}

export class ScreenRecordingChange implements WinscopeEvent {
  readonly type = WinscopeEventType.SCREEN_RECORDING_CHANGE;
  constructor(readonly trace: Trace<MediaBasedTraceEntry>) {}
}
