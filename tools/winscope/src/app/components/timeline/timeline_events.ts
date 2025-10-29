import {WinscopeEvent, WinscopeEventType} from 'messaging/winscope_event';

export class ExpandedTimelineToggled implements WinscopeEvent {
  readonly type = WinscopeEventType.EXPANDED_TIMELINE_TOGGLED;
  constructor(readonly isTimelineExpanded: boolean) {}
}
