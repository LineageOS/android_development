import {WinscopeEvent, WinscopeEventType} from 'messaging/winscope_event';
import {Viewer} from 'viewers/viewer';

export class ViewersLoaded implements WinscopeEvent {
  readonly type = WinscopeEventType.VIEWERS_LOADED;
  constructor(readonly viewers: Viewer[]) {}
}

export class ViewersUnloaded implements WinscopeEvent {
  readonly type = WinscopeEventType.VIEWERS_UNLOADED;
}
