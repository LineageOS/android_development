import {assertTrue} from 'common/assert';
import {Trace} from 'trace_api/trace';
import {View, ViewType} from 'viewers/viewer';
import {WinscopeEvent, WinscopeEventType} from 'messaging/winscope_event';

export class TabbedViewSwitched implements WinscopeEvent {
  readonly type = WinscopeEventType.TABBED_VIEW_SWITCHED;
  constructor(readonly newFocusedView: View) {
    assertTrue(
      newFocusedView.type === ViewType.TRACE_TAB ||
        newFocusedView.type === ViewType.GLOBAL_SEARCH,
    );
  }
}

export class TabbedViewSwitchRequest implements WinscopeEvent {
  readonly type = WinscopeEventType.TABBED_VIEW_SWITCH_REQUEST;
  constructor(readonly newActiveTrace: Trace<object>) {}
}
