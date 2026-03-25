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

import {assertDefined} from '@common/assert';
import {waitToBeCalled} from '@common/spy_utils';
import {makeConverterZeroRteOffsets} from '@common/time/testing/test_helpers';
import {Timestamp} from '@common/time/time';
import {TimestampConverter} from '@common/time/timestamp_converter';
import {EmitEvent} from '@messaging/winscope_event_emitter';

import {CrossToolProtocol} from './cross_tool_protocol';
import {MessageTestFailureInfo, MessageType} from './messages';
import {RemoteToolInitialized, RemoteToolTimestampReceived, RemoteToolWaitingForFiles,} from './remote_tool_events';

describe('CrossToolProtocol', () => {
  const FAKE_ORIGIN = 'http://localhost:8081';

  let protocol: CrossToolProtocol;
  let timestampConverter: TimestampConverter;
  let emitSpy: jasmine.Spy<EmitEvent>;

  describe('handles debug info', () => {
    beforeEach(() => {
      setUpTestEnvironment();
      window.dispatchEvent(
        new MessageEvent('message', {
          origin: FAKE_ORIGIN,
          source: window,
          data: {type: MessageType.PING},
        }),
      );
      expect(emitSpy).toHaveBeenCalledOnceWith(new RemoteToolInitialized());
      emitSpy.calls.reset();
    });

    it('handles debug info message and extracts timestamp', () => {
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
      window.dispatchEvent(
        new MessageEvent('message', {
          origin: FAKE_ORIGIN,
          source: window,
          data: message,
        }),
      );
      const emittedEvent = emitSpy.calls.mostRecent().args[0];
      expect(emittedEvent).toBeInstanceOf(RemoteToolTimestampReceived);
      const receivedEvent = emittedEvent as RemoteToolTimestampReceived;
      const timestamp = assertDefined(receivedEvent.deferredTimestamp)();
      expect(timestamp).toBeInstanceOf(Timestamp);
      expect(timestamp?.getValueNs()).toBe(1750932189844553958n);
    });

    it('handles debug info message without timestamp', () => {
      const stackTrace = `
      Where?
        Some other information without a timestamp.
    `;
      const message = new MessageTestFailureInfo(stackTrace);
      window.dispatchEvent(
        new MessageEvent('message', {
          origin: FAKE_ORIGIN,
          source: window,
          data: message,
        }),
      );
      expect(emitSpy).not.toHaveBeenCalled();
    });

    it('handles debug info message with no stacktrace', () => {
      const message = new MessageTestFailureInfo(undefined);
      window.dispatchEvent(
        new MessageEvent('message', {
          origin: FAKE_ORIGIN,
          source: window,
          data: message,
        }),
      );
      expect(emitSpy).not.toHaveBeenCalled();
    });
  });

  describe('timestamp sync', () => {
    beforeEach(() => {
      setUpTestEnvironment();
    });

    it('is allowed timestamp sync based on remote tool origin', () => {
      expect(protocol.isAllowedTimestampSync()).toBeFalse();
      window.dispatchEvent(
        new MessageEvent('message', {
          origin: FAKE_ORIGIN,
          source: window,
          data: {type: MessageType.PING},
        }),
      );
      expect(protocol.isAllowedTimestampSync()).toBeTrue();
    });

    it('is not allowed timestamp sync based on remote tool origin', () => {
      expect(protocol.isAllowedTimestampSync()).toBeFalse();
      window.dispatchEvent(
        new MessageEvent('message', {
          origin: 'http://localhost:8082',
          source: window,
          data: {type: MessageType.PING},
        }),
      );
      expect(protocol.isAllowedTimestampSync()).toBeFalse();
      expect(emitSpy).not.toHaveBeenCalled();
    });

    it('toggles whether timestamp sync is allowed', () => {
      expect(protocol.getAllowTimestampSync()).toBeFalse();
      window.dispatchEvent(
        new MessageEvent('message', {
          origin: FAKE_ORIGIN,
          source: window,
          data: {type: MessageType.PING},
        }),
      );
      expect(protocol.getAllowTimestampSync()).toBeTrue();
      expect(emitSpy).toHaveBeenCalledOnceWith(new RemoteToolInitialized());
      protocol.setAllowTimestampSync(false);
      expect(protocol.getAllowTimestampSync()).toBeFalse();
    });
  });

  describe('request data', () => {
    beforeEach(() => {
      setUpTestEnvironment();
    });

    it('parses request data from URL params', async () => {
      spyOn(URLSearchParams.prototype, 'get')
        .withArgs('request')
        .and.returnValue(btoa(JSON.stringify({openedWithArtifacts: true})));
      window.dispatchEvent(
        new MessageEvent('message', {
          origin: FAKE_ORIGIN,
          source: window,
          data: {type: MessageType.PING},
        }),
      );
      await waitToBeCalled(emitSpy, 2);
      expect(emitSpy).toHaveBeenCalledTimes(2);
      expect(emitSpy.calls.argsFor(0)[0]).toBeInstanceOf(RemoteToolInitialized);
      expect(emitSpy.calls.argsFor(1)[0]).toBeInstanceOf(
        RemoteToolWaitingForFiles,
      );
    });
  });

  function setUpTestEnvironment() {
    timestampConverter = makeConverterZeroRteOffsets();
    protocol = new CrossToolProtocol(timestampConverter);
    emitSpy = jasmine.createSpy();
    protocol.setEmitEvent(emitSpy);
    spyOn(window, 'postMessage');
  }
});
