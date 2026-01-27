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
import Long from 'long';
import {TracePacket, ClockSnapshot} from '@compat/perfetto';
import {
  getTimestampConverter,
  makeRealTimestamp,
  timestampEqualityTester,
} from '@common/time/test_helpers';
import {TraceType} from '@trace_api/trace_type';
import {LegacyFileReader} from '@legacy_file_readers/common/legacy_file_reader';
import {
  convertToPerfettoTrace,
  LegacyFileReaderProvider,
} from '@test/unit/fixture_utils';

describe('FileReaderViewCapture', () => {
  let reader: LegacyFileReader;

  beforeAll(async () => {
    jasmine.addCustomEqualityTester(timestampEqualityTester);
    reader = await new LegacyFileReaderProvider()
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
    expect(packets[0].trustedPacketSequenceId).toBe(10);
    expect(packets[0].timestamp).toEqual(
      Long.fromString(BigInt(181114412436130).toString()),
    );
    expect(packets[0].timestampClockId).toEqual(
      ClockSnapshot.Clock.BuiltinClocks.BOOTTIME,
    );
    expect(packets[0].trustedUid).toBe(2);
    expect(packets[0].trustedPid).toBe(3);
    expect(packets[0].sequenceFlags).toBe(3);
    expect(packets[1].sequenceFlags).toEqual(
      TracePacket.SequenceFlags.SEQ_NEEDS_INCREMENTAL_STATE,
    );

    const vcData = assertDefined(
      packets[0].winscopeExtensions?.[
        '.perfetto.protos.WinscopeExtensionsImpl.viewcapture'
      ],
    );
    expect(vcData.packageNameIid).toBe(1);
    expect(vcData.windowNameIid).toBe(1);
    expect(vcData.views?.length).toBe(17);

    const internedData = assertDefined(packets[0].internedData);

    expect(internedData.viewcapturePackageName?.length).toBe(1);
    expect(internedData.viewcapturePackageName?.[0].iid).toEqual(
      Long.fromNumber(1, true),
    );
    expect(internedData.viewcapturePackageName?.[0].str).toEqual(
      utf8Encode('com.google.android.apps.nexuslauncher'),
    );

    expect(internedData.viewcaptureWindowName?.length).toBe(1);
    expect(internedData.viewcaptureWindowName?.[0].iid).toEqual(
      Long.fromNumber(1, true),
    );
    expect(internedData.viewcaptureWindowName?.[0].str).toEqual(
      utf8Encode('.Taskbar'),
    );

    expect(internedData.viewcaptureClassName?.length).toBe(68);
    expect(internedData.viewcaptureClassName?.[3].iid).toEqual(
      Long.fromNumber(3, true),
    );
    expect(internedData.viewcaptureClassName?.[3].str).toEqual(
      utf8Encode('com.android.launcher3.views.DoubleShadowBubbleTextView'),
    );

    expect(internedData.viewcaptureViewId?.length).toBe(11);
    expect(internedData.viewcaptureViewId?.[1].iid).toEqual(
      Long.fromNumber(2, true),
    );
    expect(internedData.viewcaptureViewId?.[1].str).toEqual(
      utf8Encode('id/taskbar_view'),
    );

    expect(packets[1].internedData).toBeNull();
  });

  it('converts to valid perfetto trace', async () => {
    const perfettoParser = (
      await convertToPerfettoTrace([reader], getTimestampConverter())
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
