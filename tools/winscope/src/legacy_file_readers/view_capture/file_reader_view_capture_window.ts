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
import {NOT_IMPLEMENTED_ERROR} from '@common/errors';
import {utf8Encode} from '@common/string_helpers';
import {Timestamp} from '@common/time/time';
import {ParserTimestampConverter} from '@common/time/timestamp_converter';
import {FrameDataUdc, PerfettoClockSnapshot, PerfettoInternedData, PerfettoInternedString, PerfettoTracePacket, PerfettoViewCapture, ViewNodeUdc, WinscopeExtensions, WinscopeExtensionsImpl,} from '@compat/protobuf';
import {LegacyFileReader} from '@legacy_file_readers/common/legacy_file_reader';
import {TraceFile} from '@trace_api/trace_file';
import {TraceType} from '@trace_api/trace_type';

/**
 * A file reader for a single window in a legacy ViewCapture trace.
 */
export class FileReaderViewCaptureWindow implements LegacyFileReader {
  private static readonly PACKAGE_OR_WINDOW_IID = 1;

  private timestamps: Timestamp[] | undefined;
  private viewIdToIid = new Map<string, number>();

  constructor(
    private readonly traceFile: TraceFile,
    private readonly frameData: readonly FrameDataUdc[],
    private readonly realToBootTimeOffsetNs: bigint,
    private readonly packageName: string,
    private readonly windowName: string,
    private readonly classNames: readonly string[],
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
  ): PerfettoTracePacket[] {
    if (this.frameData.length === 0) {
      return [];
    }
    const packets = this.frameData.map((frame, index) => {
      const packet = new PerfettoTracePacket();
      packet.setTrustedPacketSequenceId(sequenceId);
      packet.setTimestamp(assertDefined(frame.getTimestamp()));
      packet.setTimestampClockId(
        PerfettoClockSnapshot.Clock.BuiltinClocks.BOOTTIME,
      );
      packet.setTrustedUid(trustedUid);
      packet.setTrustedPid(trustedPid);
      packet.setSequenceFlags(
        index === 0
          ? 3
          : PerfettoTracePacket.SequenceFlags.SEQ_NEEDS_INCREMENTAL_STATE,
      );

      const winscopeExtensions = new WinscopeExtensions();
      winscopeExtensions.setExtension(
        WinscopeExtensionsImpl.viewcapture,
        this.convertToPerfettoViewCapture(frame),
      );
      packet.setWinscopeExtensions(winscopeExtensions);

      return packet;
    });
    packets[0].setInternedData(this.makeInternedData());
    return packets;
  }

  private decodeTimestamps(): Timestamp[] {
    return this.frameData.map((entry) =>
      this.timestampConverter.makeTimestampFromBootTimeNs(
        BigInt(assertDefined(entry.getTimestamp())),
      ),
    );
  }

  private convertToPerfettoView(
    node: ViewNodeUdc,
    parentId: number,
    perfettoViews: PerfettoViewCapture.View[],
  ) {
    const nodeIdString = node.getId();
    if (nodeIdString && !this.viewIdToIid.has(nodeIdString)) {
      this.viewIdToIid.set(nodeIdString, this.viewIdToIid.size + 1);
    }
    const nodeId = perfettoViews.length;
    const perfettoView = new PerfettoViewCapture.View();
    perfettoView.setId(nodeId);
    perfettoView.setParentId(parentId);
    perfettoView.setHashcode(node.getHashcode() ?? 0);
    if (nodeIdString) {
      perfettoView.setViewIdIid(this.viewIdToIid.get(nodeIdString) ?? 0);
    }
    perfettoView.setClassNameIid(node.getClassnameIndex() ?? 0);
    perfettoView.setLeft(node.getLeft() ?? 0);
    perfettoView.setTop(node.getTop() ?? 0);
    perfettoView.setWidth(node.getWidth() ?? 0);
    perfettoView.setHeight(node.getHeight() ?? 0);
    perfettoView.setScrollX(node.getScrollx() ?? 0);
    perfettoView.setScrollY(node.getScrolly() ?? 0);
    perfettoView.setTranslationX(node.getTranslationx() ?? 0);
    perfettoView.setTranslationY(node.getTranslationy() ?? 0);
    perfettoView.setScaleX(node.getScalex() ?? 0);
    perfettoView.setScaleY(node.getScaley() ?? 0);
    perfettoView.setAlpha(node.getAlpha() ?? 0);
    perfettoView.setWillNotDraw(node.getWillnotdraw() ?? false);
    perfettoView.setClipChildren(node.getClipchildren() ?? false);
    perfettoView.setVisibility(node.getVisibility() ?? 0);
    perfettoView.setElevation(node.getElevation() ?? 0);

    perfettoViews.push(perfettoView);

    node.getChildrenList().forEach((child: ViewNodeUdc) => {
      this.convertToPerfettoView(child, nodeId, perfettoViews);
    });
  }

  private convertToPerfettoViewCapture(
    frame: FrameDataUdc,
  ): PerfettoViewCapture {
    const perfettoViews: PerfettoViewCapture.View[] = [];
    this.convertToPerfettoView(
      assertDefined(frame.getNode()),
      -1,
      perfettoViews,
    );
    const viewCapture = new PerfettoViewCapture();
    viewCapture.setPackageNameIid(
      FileReaderViewCaptureWindow.PACKAGE_OR_WINDOW_IID,
    );
    viewCapture.setWindowNameIid(
      FileReaderViewCaptureWindow.PACKAGE_OR_WINDOW_IID,
    );
    viewCapture.setViewsList(perfettoViews);
    return viewCapture;
  }

  private makeInternedData(): PerfettoInternedData {
    const makeInternedString = (iid: number, str: string) => {
      const internedString = new PerfettoInternedString();
      internedString.setIid(iid);
      internedString.setStr(utf8Encode(str));
      return internedString;
    };

    const internedWindowNames: PerfettoInternedString[] = [
      makeInternedString(
        FileReaderViewCaptureWindow.PACKAGE_OR_WINDOW_IID,
        this.windowName,
      ),
    ];

    const internedClassNames: PerfettoInternedString[] = this.classNames.map(
      (className, index) => makeInternedString(index, className),
    );

    const internedPackageNames: PerfettoInternedString[] = [
      makeInternedString(
        FileReaderViewCaptureWindow.PACKAGE_OR_WINDOW_IID,
        this.packageName,
      ),
    ];

    const internedViewIds: PerfettoInternedString[] = [];
    assertDefined(this.viewIdToIid).forEach((iid, viewId) => {
      internedViewIds.push(makeInternedString(iid, viewId));
    });

    const internedData = new PerfettoInternedData();
    internedData.setViewcaptureWindowNameList(internedWindowNames);
    internedData.setViewcaptureClassNameList(internedClassNames);
    internedData.setViewcapturePackageNameList(internedPackageNames);
    internedData.setViewcaptureViewIdList(internedViewIds);

    return internedData;
  }
}
