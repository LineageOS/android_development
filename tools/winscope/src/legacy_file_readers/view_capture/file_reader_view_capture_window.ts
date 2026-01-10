/*
 * Copyright (C) 2023 The Android Open Source Project
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

import {assertDefined} from '@common/assert';
import {utf8Encode} from '@common/string_helpers';
import {Timestamp} from '@common/time/time';
import {ParserTimestampConverter} from '@common/time/timestamp_converter';
import Long from 'long';
import {ViewCapture} from '@compat/winscope_protos';
import {
  ClockSnapshot,
  InternedData,
  InternedString,
  TracePacket,
} from '@compat/perfetto';
import {com} from 'protos/viewcapture/udc/static';

import {TraceType} from '@trace_api/trace_type';
import {LegacyFileReader} from '@legacy_file_readers/common/legacy_file_reader';
import {TraceFile} from '@trace/trace_file';
import {NOT_IMPLEMENTED_ERROR} from '@common/errors';

/**
 * A file reader for a single window in a legacy ViewCapture trace.
 */
export class FileReaderViewCaptureWindow implements LegacyFileReader {
  private static readonly PACKAGE_OR_WINDOW_IID = 1;

  private timestamps: Timestamp[] | undefined;
  private viewIdToIid = new Map<string, number>();

  constructor(
    private readonly traceFile: TraceFile,
    private readonly frameData: FrameData[],
    private readonly realToBootTimeOffsetNs: bigint,
    private readonly packageName: string,
    private readonly windowName: string,
    private readonly classNames: string[],
    private readonly timestampConverter: ParserTimestampConverter,
  ) {}

  getTraceType(): TraceType {
    return TraceType.VIEW_CAPTURE;
  }

  getFiles(): TraceFile[] {
    return [this.traceFile];
  }

  getDescriptors(): string[] {
    return [this.windowName, this.traceFile.getDescriptor()];
  }

  getLengthEntries(): number {
    return this.frameData.length;
  }

  getRealToMonotonicTimeOffsetNs(): bigint | undefined {
    return undefined;
  }

  getRealToBootTimeOffsetNs(): bigint | undefined {
    return this.realToBootTimeOffsetNs;
  }

  createTimestamps() {
    this.timestamps = this.decodeTimestamps();
  }

  getTimestamps(): Timestamp[] {
    if (!this.timestamps) {
      throw NOT_IMPLEMENTED_ERROR;
    }
    return this.timestamps;
  }

  convertToPerfettoPackets(
    sequenceId: number,
    trustedUid = 1,
    trustedPid = 1,
  ): TracePacket[] {
    if (this.frameData.length === 0) {
      return [];
    }
    const packets = this.frameData.map((frame, index) => {
      const packet = new TracePacket();
      packet.trustedPacketSequenceId = sequenceId;
      packet.timestamp = assertDefined(frame.timestamp);
      packet.timestampClockId = ClockSnapshot.Clock.BuiltinClocks.BOOTTIME;
      packet.trustedUid = trustedUid;
      packet.trustedPid = trustedPid;
      packet.sequenceFlags =
        index === 0 ? 3 : TracePacket.SequenceFlags.SEQ_NEEDS_INCREMENTAL_STATE;
      packet.winscopeExtensions = {
        '.perfetto.protos.WinscopeExtensionsImpl.viewcapture':
          this.convertToPerfettoViewCapture(frame),
      };
      return packet;
    });
    packets[0].internedData = this.makeInternedData();
    return packets;
  }

  private decodeTimestamps(): Timestamp[] {
    return this.frameData.map((entry) =>
      this.timestampConverter.makeTimestampFromBootTimeNs(
        BigInt(assertDefined(entry.timestamp).toString()),
      ),
    );
  }

  private convertToPerfettoView(
    node: ViewNode,
    parentId: number,
    perfettoViews: ViewCapture.IView[],
  ) {
    if (node.id && !this.viewIdToIid.has(node.id)) {
      this.viewIdToIid.set(node.id, this.viewIdToIid.size + 1);
    }
    const nodeId = perfettoViews.length;
    const perfettoView: ViewCapture.IView = {
      id: nodeId,
      parentId,
      hashcode: node.hashcode,
      viewIdIid: node.id ? this.viewIdToIid.get(node.id) : undefined,
      classNameIid: node.classnameIndex,
      left: node.left,
      top: node.top,
      width: node.width,
      height: node.height,
      scrollX: node.scrollX,
      scrollY: node.scrollY,
      translationX: node.translationX,
      translationY: node.translationY,
      scaleX: node.scaleX,
      scaleY: node.scaleY,
      alpha: node.alpha,
      willNotDraw: node.willNotDraw,
      clipChildren: node.clipChildren,
      visibility: node.visibility,
      elevation: node.elevation,
    };
    perfettoViews.push(perfettoView);

    node.children?.forEach((child) => {
      this.convertToPerfettoView(child, nodeId, perfettoViews);
    });
  }

  private convertToPerfettoViewCapture(frame: FrameData): ViewCapture {
    const perfettoViews: ViewCapture.IView[] = [];
    this.convertToPerfettoView(assertDefined(frame.node), -1, perfettoViews);
    return ViewCapture.fromObject({
      packageNameIid: FileReaderViewCaptureWindow.PACKAGE_OR_WINDOW_IID,
      windowNameIid: FileReaderViewCaptureWindow.PACKAGE_OR_WINDOW_IID,
      views: perfettoViews,
    });
  }

  private makeInternedData(): InternedData {
    const internedWindowNames: InternedString[] = [
      InternedString.fromObject({
        iid: Long.fromNumber(FileReaderViewCaptureWindow.PACKAGE_OR_WINDOW_IID),
        str: utf8Encode(this.windowName),
      }),
    ];

    const internedClassNames: InternedString[] = this.classNames.map(
      (className, index) => {
        return InternedString.fromObject({
          iid: Long.fromNumber(index),
          str: utf8Encode(className),
        });
      },
    );

    const internedPackageNames: InternedString[] = [
      InternedString.fromObject({
        iid: Long.fromNumber(FileReaderViewCaptureWindow.PACKAGE_OR_WINDOW_IID),
        str: utf8Encode(this.packageName),
      }),
    ];

    const internedViewIds: InternedString[] = [];
    assertDefined(this.viewIdToIid).forEach((iid, viewId) => {
      internedViewIds.push(
        InternedString.fromObject({
          iid: Long.fromNumber(iid),
          str: utf8Encode(viewId),
        }),
      );
    });

    return InternedData.fromObject({
      viewcaptureWindowName: internedWindowNames,
      viewcaptureClassName: internedClassNames,
      viewcapturePackageName: internedPackageNames,
      viewcaptureViewId: internedViewIds,
    });
  }
}

type FrameData = com.android.app.viewcapture.data.IFrameData;
type ViewNode = com.android.app.viewcapture.data.IViewNode;
