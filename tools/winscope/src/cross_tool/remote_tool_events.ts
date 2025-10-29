import {Timestamp} from 'common/time/time';
import {WinscopeEvent, WinscopeEventType} from 'messaging/winscope_event';

export class RemoteToolDownloadStart implements WinscopeEvent {
  readonly type = WinscopeEventType.REMOTE_TOOL_DOWNLOAD_START;
}

export class RemoteToolFilesReceived implements WinscopeEvent {
  readonly type = WinscopeEventType.REMOTE_TOOL_FILES_RECEIVED;
  constructor(
    readonly files: File[],
    readonly deferredTimestamp?: () => Timestamp | undefined,
  ) {}
}

export class RemoteToolTimestampReceived implements WinscopeEvent {
  readonly type = WinscopeEventType.REMOTE_TOOL_TIMESTAMP_RECEIVED;
  constructor(readonly deferredTimestamp: () => Timestamp | undefined) {}
}
