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
import {makeConverterNoRteOffsets, makeRealTimestamp, timestampEqualityTester,} from '@common/time/testing/test_helpers';
import {byteStringAsUint8Array, PerfettoClockSnapshot, PerfettoTracePacket, WinscopeExtensionsImpl,} from '@compat/protobuf';
import {setupJspbTesting} from '@compat/test/protobuf';
import {LegacyFileReader} from '@legacy_file_readers/common/legacy_file_reader';
import {convertToPerfettoTrace, LegacyFileReaderProvider,} from '@legacy_file_readers/testing/fixture_utils';
import {TraceType} from '@trace_api/trace_type';

import {FileReaderViewCapture} from './file_reader_view_capture';

describe('FileReaderViewCapture', () => {
  let reader: LegacyFileReader;

  beforeAll(async () => {
    setupJspbTesting();
    jasmine.addCustomEqualityTester(timestampEqualityTester);
    reader = await new LegacyFileReaderProvider([
      FileReaderViewCapture.createInstance,
    ])
      .addFile(
        'traces/elapsed_and_real_timestamp/com.google.android.apps.nexuslauncher_0.vc',
      )
      .get();
    jasmine.DEFAULT_TIMEOUT_INTERVAL = 30000;
  });

  it('has expected trace type', () => {
    expect(reader.getTraceType()).toEqual(TraceType.VIEW_CAPTURE);
  });

  it('has expected descriptors', () => {
    expect(reader.getDescriptors()).toEqual([
      '.Taskbar',
      'com.google.android.apps.nexuslauncher_0.vc',
    ]);
  });

  it('provides timestamps', () => {
    const expected = [
      makeRealTimestamp(1691692936292808460n),
      makeRealTimestamp(1691692936301385080n),
      makeRealTimestamp(1691692936309419870n),
    ];
    expect(reader.getTimestamps().slice(0, 3)).toEqual(expected);
  });

  it('converts to valid perfetto packets', async () => {
    const packets = reader.convertToPerfettoPackets(10, 2, 3);
    expect(packets.length).toBe(2000);
    expect(packets[0].getTrustedPacketSequenceId()).toBe(10);
    expect(packets[0].getTimestamp()?.toString()).toEqual('181114412436130');
    expect(packets[0].getTimestampClockId()).toEqual(
      PerfettoClockSnapshot.Clock.BuiltinClocks.BOOTTIME,
    );
    expect(packets[0].getTrustedUid()).toBe(2);
    expect(packets[0].getTrustedPid()).toBe(3);
    expect(packets[0].getSequenceFlags()).toBe(3);
    expect(packets[1].getSequenceFlags()).toEqual(
      PerfettoTracePacket.SequenceFlags.SEQ_NEEDS_INCREMENTAL_STATE,
    );

    const vcData = assertDefined(
      packets[0]
        .getWinscopeExtensions()
        ?.getExtension(WinscopeExtensionsImpl.viewcapture),
    );
    expect(vcData.getPackageNameIid()).toBe(1);
    expect(vcData.getWindowNameIid()).toBe(1);
    expect(vcData.getViewsList().length).toBe(17);

    const internedData = assertDefined(packets[0].getInternedData());
    const packageNameList = internedData.getViewcapturePackageNameList();

    expect(packageNameList.length).toBe(1);
    expect(packageNameList[0].getIid()?.toString()).toEqual('1');
    expect(byteStringAsUint8Array(packageNameList[0].getStr())).toEqual(
      utf8Encode('com.google.android.apps.nexuslauncher'),
    );

    const windowNameList = internedData.getViewcaptureWindowNameList();
    expect(windowNameList.length).toBe(1);
    expect(windowNameList[0].getIid()?.toString()).toEqual('1');
    expect(byteStringAsUint8Array(windowNameList[0].getStr())).toEqual(
      utf8Encode('.Taskbar'),
    );

    const classNameList = internedData.getViewcaptureClassNameList();
    expect(classNameList.length).toBe(68);
    expect(classNameList[3].getIid()?.toString()).toEqual('3');
    expect(byteStringAsUint8Array(classNameList[3].getStr())).toEqual(
      utf8Encode('com.android.launcher3.views.DoubleShadowBubbleTextView'),
    );

    const viewIdList = internedData.getViewcaptureViewIdList();
    expect(viewIdList.length).toBe(11);
    expect(viewIdList[1].getIid()?.toString()).toEqual('2');
    expect(byteStringAsUint8Array(viewIdList[1].getStr())).toEqual(
      utf8Encode('id/taskbar_view'),
    );

    expect(packets[1].hasInternedData()).toBeFalse();
  });

  it('converts to valid perfetto trace', async () => {
    const perfettoParser = (
      await convertToPerfettoTrace([reader], makeConverterNoRteOffsets())
    )[0];
    expect(perfettoParser.getTimestamps().slice(0, 3)).toEqual([
      makeRealTimestamp(1691692936292808460n),
      makeRealTimestamp(1691692936301385080n),
      makeRealTimestamp(1691692936309419870n),
    ]);

    const entry = await perfettoParser.getEntry(1);
    expect(entry.name).toBe(
      'com.android.launcher3.taskbar.TaskbarDragLayer@265160962',
    );
    expect(entry.getRects().length).toBe(1);
  });
});
