import {Timestamp} from 'common/time/time';
import {TraceType} from 'trace_api/trace_type';
import {WinscopeEvent, WinscopeEventType} from 'messaging/winscope_event';

export class DarkModeToggled implements WinscopeEvent {
  readonly type = WinscopeEventType.DARK_MODE_TOGGLED;
  constructor(readonly isDarkMode: boolean) {}
}

export class NoTraceTargetsSelectedEvent implements WinscopeEvent {
  readonly type = WinscopeEventType.NO_TRACE_TARGETS_SELECTED;
}

export class FilterPresetSaveRequest implements WinscopeEvent {
  readonly type = WinscopeEventType.FILTER_PRESET_SAVE_REQUEST;
  constructor(
    readonly name: string,
    readonly traceType: TraceType,
  ) {}
}

export class FilterPresetApplyRequest implements WinscopeEvent {
  readonly type = WinscopeEventType.FILTER_PRESET_APPLY_REQUEST;
  constructor(
    readonly name: string,
    readonly traceType: TraceType,
  ) {}
}

export class BugreportFileSelected implements WinscopeEvent {
  readonly type = WinscopeEventType.BUGREPORT_FILE_SELECTED;
  constructor(readonly filename: string | undefined) {}
}

export class BugreportFileSelectionRequest implements WinscopeEvent {
  readonly type = WinscopeEventType.BUGREPORT_FILE_SELECTION_REQUEST;
  constructor(readonly filenames: string[]) {}
}

export class ActiveSearchQueriesUpdate implements WinscopeEvent {
  readonly type = WinscopeEventType.ACTIVE_SEARCH_QUERIES_UPDATE;
  constructor(readonly queries: string[]) {}
}

export class BookmarksChanged implements WinscopeEvent {
  readonly type = WinscopeEventType.BOOKMARKS_CHANGED;
  constructor(readonly bookmarks: Timestamp[]) {}
}
