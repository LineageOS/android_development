/*
 * Copyright (C) 2025 The Android Open Source Project
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

import {assertDefined} from 'common/assert';
import {Timestamp, TimezoneInfo} from 'common/time/time';
import {TimestampConverter} from 'common/time/timestamp_converter';
import {
  RemoteToolTimestampReceived,
  WinscopeEvent,
} from 'messaging/winscope_event';
import {CrossToolProtocol} from './cross_tool_protocol';
import {MessageTestFailureInfo, TimestampType} from './messages';

describe('CrossToolProtocol', () => {
  let protocol: CrossToolProtocol;
  let timestampConverter: TimestampConverter;
  let emittedEvent: WinscopeEvent | undefined;

  const FAKE_ORIGIN = 'http://localhost:8080';
  const FAKE_WINDOW = {
    postMessage: () => {},
  } as unknown as Window;

  beforeEach(() => {
    emittedEvent = undefined;

    const timezoneInfo: TimezoneInfo = {
      timezone: 'UTC',
      locale: 'en-US',
    };
    timestampConverter = new TimestampConverter(timezoneInfo, 0n);
    protocol = new CrossToolProtocol(timestampConverter);
    protocol.setEmitEvent(async (event) => {
      emittedEvent = event;
    });

    // @ts-expect-error(remoteTool is private but needs to be mocked in this test)
    protocol.remoteTool = {
      window: FAKE_WINDOW,
      origin: FAKE_ORIGIN,
      timestampType: TimestampType.CLOCK_REALTIME,
    };
  });

  it('handles debug info message and extracts timestamp', async () => {
    const stackTrace = `
android.tools.flicker.subject.exceptions.IncorrectVisibilityException: com.android.server.wm.flicker.testapp/com.android.server.wm.flicker.testapp.SimpleActivity# should be visible

Where?
	Timestamp(UNIX=2025-06-26T10:03:09.844553958(1750932189844553958ns), UPTIME=19h41m2s397ms713046ns(70862397713046ns), ELAPSED=0ns)

What?
	Expected: com.android.server.wm.flicker.testapp/com.android.server.wm.flicker.testapp.SimpleActivity#
	Actual: [b4d2b3d com.android.server.wm.flicker.testapp/com.android.server.wm.flicker.testapp.SimpleActivity#1802: Flag is hidden, Buffer is empty, Alpha is 0, Visible region calculated by Composition Engine is empty]

Other information
	WINSCOPE_ZIP Artifact: FAIL__OpenAppFromIconColdTest_ROTATION_0_3_BUTTON_NAV.winscope.zip
	SCREEN_RECORDING Artifact: FAIL__OpenAppFromIconColdTest_ROTATION_0_3_BUTTON_NAV_transition.winscope.mp4

Check the test run artifacts for trace files

	at android.tools.flicker.subject.layers.LayerTraceEntrySubject.isVisible(LayerTraceEntrySubject.kt:192)
	at android.tools.flicker.subject.layers.LayersTraceSubject$isVisible$1$1.verify(LayersTraceSubject.kt:155)
	at android.tools.flicker.subject.layers.LayersTraceSubject$isVisible$1$1.verify(LayersTraceSubject.kt:154)
	at android.tools.flicker.assertions.NamedAssertion.invoke(NamedAssertion.kt:34)
	at android.tools.flicker.assertions.CompoundAssertion.invoke(CompoundAssertion.kt:45)
	at android.tools.flicker.assertions.AssertionsChecker.test(AssertionsChecker.kt:80)
	at android.tools.flicker.subject.FlickerTraceSubject.forAllEntries(FlickerTraceSubject.kt:60)
	at android.tools.flicker.assertions.AssertionDataFactory.createTraceAssertion$lambda$1(AssertionDataFactory.kt:46)
	at android.tools.flicker.assertions.AssertionDataFactory.$r8$lambda$IF0Pq8wKFyHjysoKsEsWG4VBnt4(Unknown Source:0)
	at android.tools.flicker.assertions.AssertionDataFactory$$ExternalSyntheticLambda0.invoke(D8$$SyntheticClass:0)
	at android.tools.flicker.assertions.AssertionDataImpl.checkAssertion(AssertionDataImpl.kt:33)
	at android.tools.flicker.assertions.ReaderAssertionRunner$doRunAssertion$1.invoke(ReaderAssertionRunner.kt:37)
	at android.tools.flicker.assertions.ReaderAssertionRunner$doRunAssertion$1.invoke(ReaderAssertionRunner.kt:35)
	at android.tools.ExtensionsKt.withTracing(Extensions.kt:28)
	at android.tools.flicker.assertions.ReaderAssertionRunner.doRunAssertion(ReaderAssertionRunner.kt:35)
	at android.tools.flicker.assertions.ReaderAssertionRunner.access$doRunAssertion(ReaderAssertionRunner.kt:25)
	at android.tools.flicker.assertions.ReaderAssertionRunner$runAssertion$1.invoke(ReaderAssertionRunner.kt:31)
	at android.tools.flicker.assertions.ReaderAssertionRunner$runAssertion$1.invoke(ReaderAssertionRunner.kt:30)
	at android.tools.ExtensionsKt.withTracing(Extensions.kt:28)
	at android.tools.flicker.assertions.ReaderAssertionRunner.runAssertion(ReaderAssertionRunner.kt:30)
	at android.tools.flicker.assertions.BaseAssertionRunner.runAssertion(BaseAssertionRunner.kt:36)
	at android.tools.flicker.legacy.LegacyFlickerTest.doProcess(LegacyFlickerTest.kt:58)
	at android.tools.flicker.assertions.BaseFlickerTest$assertLayers$1.invoke(BaseFlickerTest.kt:89)
	at android.tools.flicker.assertions.BaseFlickerTest$assertLayers$1.invoke(BaseFlickerTest.kt:87)
	at android.tools.ExtensionsKt.withTracing(Extensions.kt:28)
	at android.tools.flicker.assertions.BaseFlickerTest.assertLayers(BaseFlickerTest.kt:87)
	at com.android.server.wm.flicker.launch.OpenAppFromIconColdTest.appLayerBecomesVisible(OpenAppFromIconColdTest.kt:100)
    `;
    const message = new MessageTestFailureInfo(stackTrace);

    // @ts-expect-error(onMessageDebugInfoReceived is private but needs to be mocked in this test)
    await protocol.onMessageDebugInfoReceived(message);

    expect(emittedEvent).toBeInstanceOf(RemoteToolTimestampReceived);
    const receivedEvent = emittedEvent as RemoteToolTimestampReceived;
    const timestamp = assertDefined(receivedEvent.deferredTimestamp)();
    expect(timestamp).toBeInstanceOf(Timestamp);
    expect(timestamp?.getValueNs()).toBe(1750932189844553958n);
  });

  it('handles debug info message without timestamp', async () => {
    const stackTrace = `
      Where?
        Some other information without a timestamp.
    `;
    const message = new MessageTestFailureInfo(stackTrace);

    // @ts-expect-error(onMessageDebugInfoReceived is private but needs to be mocked in this test)
    await protocol.onMessageDebugInfoReceived(message);
    expect(emittedEvent).toBeUndefined();
  });

  it('handles debug info message with no stacktrace', async () => {
    const message = new MessageTestFailureInfo(undefined);
    // @ts-expect-error(onMessageDebugInfoReceived is private but needs to be mocked in this test)
    await protocol.onMessageDebugInfoReceived(message);
    expect(emittedEvent).toBeUndefined();
  });
});
