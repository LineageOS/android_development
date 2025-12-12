import {WinscopeEvent} from '@messaging/winscope_event';
import {Viewer} from '@viewers/viewer';

export class ViewersLoaded implements WinscopeEvent {
  constructor(readonly viewers: Viewer[]) {}
}

export class ViewersUnloaded implements WinscopeEvent {}
