/*
 * Copyright (C) 2022 The Android Open Source Project
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import {assertDefined, assertUnreachable} from '@common/assert';
import {Timestamp} from '@common/time/time';
import {RemoteToolTimestampConverter} from '@common/time/timestamp_converter';
import {getLogger, Logger} from '@compat/logging';
import {WinscopeEvent} from '@messaging/winscope_event';
import {EmitEvent, WinscopeEventEmitter,} from '@messaging/winscope_event_emitter';
import {WinscopeEventListener} from '@messaging/winscope_event_listener';
import {TracePositionUpdate} from '@trace_api/trace_events';
import {AppResetRequest} from '@ui/shared/events/app_events';

import {Message, MessageBugReport, MessageFiles, MessagePong, MessageTestFailureInfo, MessageTimestamp, MessageType, TimestampType,} from './messages';
import {isAllowed, isOriginAllowedTimestampSync, isUnauthorizedOriginExpected,} from './origin_allow_list';
import {RemoteToolFilesReceived, RemoteToolInitialized, RemoteToolTimestampReceived, RemoteToolWaitingForFiles,} from './remote_tool_events';

class RemoteTool {
  timestampType?: TimestampType;

  constructor(
    readonly window: Window,
    readonly origin: string,
  ) {}
}

/**
 * A protocol for communication between Winscope and other tools.
 */
export class CrossToolProtocol
  implements WinscopeEventEmitter, WinscopeEventListener
{
  private remoteTool?: RemoteTool;
  private emitEvent: EmitEvent = () => Promise.resolve();
  private timestampConverter: RemoteToolTimestampConverter;
  private allowTimestampSync = false;

  constructor(
    timestampConverter: RemoteToolTimestampConverter,
    private readonly logger: Logger = getLogger('CrossToolProtocol'),
  ) {
    this.timestampConverter = timestampConverter;

    window.addEventListener('message', async (event) => {
      await this.onMessageReceived(event);
    });
  }

  setEmitEvent(callback: EmitEvent) {
    this.emitEvent = callback;
  }

  updateTimestampConverter(value: RemoteToolTimestampConverter) {
    this.timestampConverter = value;
  }

  private async onTracePositionUpdate(event: TracePositionUpdate) {
    if (
      !this.remoteTool ||
      !this.remoteTool.timestampType ||
      !this.isAllowedTimestampSync() ||
      !this.allowTimestampSync
    ) {
      return;
    }

    const timestampNs = this.getTimestampNsForRemoteTool(
      event.position.timestamp,
    );
    if (timestampNs === undefined) {
      return;
    }

    const message = new MessageTimestamp(
      timestampNs,
      this.remoteTool.timestampType,
    );
    this.remoteTool.window.postMessage(message, this.remoteTool.origin);
    this.logger.trace('Cross-tool protocol sent timestamp message:', message);
  }

  async onWinscopeEvent(event: WinscopeEvent) {
    switch (event.constructor) {
      case TracePositionUpdate:
        return await this.onTracePositionUpdate(event as TracePositionUpdate);
      default:
        this.logger.trace('Not processing event ' + event.constructor.name);
    }
  }

  isAllowedTimestampSync() {
    return (
      this.remoteTool !== undefined &&
      isOriginAllowedTimestampSync(this.remoteTool.origin)
    );
  }

  setAllowTimestampSync(value: boolean) {
    this.allowTimestampSync = value;
  }

  getAllowTimestampSync() {
    return this.allowTimestampSync;
  }

  private async onMessageReceived(event: MessageEvent) {
    if (!isAllowed(event.origin)) {
      if (!isUnauthorizedOriginExpected(event.origin)) {
        this.logger.warn(
          'Cross-tool protocol received message from unauthorized origin:',
          event.origin,
        );
      }
      return;
    }

    const message = event.data as Message;
    if (message.type === undefined) {
      return;
    }

    if (!this.remoteTool) {
      this.remoteTool = new RemoteTool(event.source as Window, event.origin);
      this.allowTimestampSync = isOriginAllowedTimestampSync(event.origin);
      await this.emitEvent(new RemoteToolInitialized());

      const urlParams = new URLSearchParams(window.location.search);
      const request = urlParams.get('request');
      if (request) {
        const decodedRequest = JSON.parse(atob(request));
        if (decodedRequest.openedWithArtifacts) {
          await this.emitEvent(new RemoteToolWaitingForFiles());
        }
      }
    }

    switch (message.type) {
      case MessageType.PING:
        this.logger.trace(
          'Cross-tool protocol received ping message:',
          message,
        );
        (event.source as Window).postMessage(new MessagePong(), event.origin);
        break;
      case MessageType.PONG:
        this.logger.warn(
          'Cross-tool protocol received unexpected pong message:',
          message,
        );
        break;
      case MessageType.BUGREPORT:
        this.logger.trace(
          'Cross-tool protocol received bugreport message:',
          message,
        );
        await this.onMessageBugreportReceived(message as MessageBugReport);
        this.logger.trace(
          'Cross-tool protocol processed bugreport message:',
          message,
        );
        break;
      case MessageType.TIMESTAMP:
        this.logger.trace(
          'Cross-tool protocol received timestamp message:',
          message,
        );
        await this.onMessageTimestampReceived(message as MessageTimestamp);
        this.logger.trace(
          'Cross-tool protocol processed timestamp message:',
          message,
        );
        break;
      case MessageType.FILES:
        this.logger.trace(
          'Cross-tool protocol received files message:',
          message,
        );
        await this.onMessageFilesReceived(message as MessageFiles);
        this.logger.trace(
          'Cross-tool protocol processed files message:',
          message,
        );
        break;
      case MessageType.TEST_FAILURE_INFO:
        this.logger.trace(
          'Cross-tool protocol received debug info message:',
          message,
        );
        await this.onMessageDebugInfoReceived(
          message as MessageTestFailureInfo,
        );
        this.logger.trace(
          'Cross-tool protocol processed debug info message:',
          message,
        );
        break;
      default:
        this.logger.warn(
          'Cross-tool protocol received unsupported message type:',
          message,
        );
        break;
    }
  }

  private async onMessageBugreportReceived(message: MessageBugReport) {
    this.setRemoteToolTimestampTypeIfNeeded(message.timestampType);
    const deferredTimestamp = this.makeDeferredTimestampForWinscope(
      message.timestampNs,
    );
    await this.emitEvent(new AppResetRequest());
    await this.emitEvent(
      new RemoteToolFilesReceived([message.file], deferredTimestamp),
    );
  }

  private async onMessageFilesReceived(message: MessageFiles) {
    this.setRemoteToolTimestampTypeIfNeeded(message.timestampType);
    const deferredTimestamp = this.makeDeferredTimestampForWinscope(
      message.timestampNs,
    );
    await this.emitEvent(new AppResetRequest());
    await this.emitEvent(
      new RemoteToolFilesReceived(message.files, deferredTimestamp),
    );
  }

  private async onMessageTimestampReceived(message: MessageTimestamp) {
    if (!this.allowTimestampSync || !this.isAllowedTimestampSync()) {
      return;
    }
    this.setRemoteToolTimestampTypeIfNeeded(message.timestampType);
    const deferredTimestamp = this.makeDeferredTimestampForWinscope(
      message.timestampNs,
    );
    await this.emitEvent(
      new RemoteToolTimestampReceived(assertDefined(deferredTimestamp)),
    );
  }

  private async onMessageDebugInfoReceived(message: MessageTestFailureInfo) {
    if (message.stackTrace) {
      const timestampNs = this.extractUnixTimestampFromStacktrace(
        message.stackTrace,
      );

      if (timestampNs === undefined) {
        return;
      }

      const deferredTimestamp = this.makeDeferredTimestampForWinscope(
        timestampNs,
        TimestampType.CLOCK_REALTIME,
      );
      await this.emitEvent(
        new RemoteToolTimestampReceived(assertDefined(deferredTimestamp)),
      );
    }
  }

  private extractUnixTimestampFromStacktrace(
    stackTrace: string,
  ): bigint | undefined {
    const whereMatch = stackTrace.match(/Where\?\r?\n?\s*(.*)/);
    if (!whereMatch) {
      return undefined;
    }
    const whereSection = whereMatch[1];
    const timestampMatch = whereSection.match(
      /Timestamp\(UNIX=\d+-\d+-\d+T\d+:\d+:\d+\.\d+\((\d+)ns\),/,
    );
    return timestampMatch ? BigInt(timestampMatch[1]) : undefined;
  }

  private setRemoteToolTimestampTypeIfNeeded(type: TimestampType | undefined) {
    const remoteTool = assertDefined(this.remoteTool);

    if (remoteTool.timestampType !== undefined) {
      return;
    }

    // Default to CLOCK_REALTIME for backward compatibility.
    // The initial protocol's version didn't provide an explicit timestamp type
    // and all timestamps were supposed to be CLOCK_REALTIME.
    remoteTool.timestampType = type ?? TimestampType.CLOCK_REALTIME;
  }

  private getTimestampNsForRemoteTool(
    timestamp: Timestamp,
  ): bigint | undefined {
    const timestampType = this.remoteTool?.timestampType;
    switch (timestampType) {
      case undefined:
        return undefined;
      case TimestampType.UNKNOWN:
        return undefined;
      case TimestampType.CLOCK_BOOTTIME:
        return this.timestampConverter.tryGetBootTimeNs(timestamp);
      case TimestampType.CLOCK_REALTIME:
        return this.timestampConverter.tryGetRealTimeNs(timestamp);
      default:
        assertUnreachable(timestampType);
    }
  }

  // Make a deferred timestamp: a lambda meant to be executed at a later point to create a
  // timestamp. The lambda is needed to defer timestamp creation to the point where traces
  // are loaded into LoadedFileData and TimestampConverter is properly initialized and ready
  // to instantiate timestamps.
  private makeDeferredTimestampForWinscope(
    timestampNs: bigint | undefined,
    timestampType?: TimestampType | undefined,
  ): (() => Timestamp | undefined) | undefined {
    timestampType =
      timestampType ?? assertDefined(this.remoteTool?.timestampType);

    if (timestampNs === undefined || timestampType === undefined) {
      return undefined;
    }

    switch (timestampType) {
      case TimestampType.UNKNOWN:
        return undefined;
      case TimestampType.CLOCK_BOOTTIME:
        return () => {
          try {
            return this.timestampConverter.makeTimestampFromBootTimeNs(
              timestampNs,
            );
          } catch {
            return undefined;
          }
        };
      case TimestampType.CLOCK_REALTIME:
        return () => {
          try {
            return this.timestampConverter.makeTimestampFromRealNs(timestampNs);
          } catch {
            return undefined;
          }
        };
      default:
        assertUnreachable(timestampType);
    }
  }
}
