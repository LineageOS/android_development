/*
 * Copyright (C) 2024 The Android Open Source Project
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

import {makeRealTimestamp} from '@common/time/testing/test_helpers';
import {TraceBuilder} from '@trace_api/testing/trace_builder';
import {ActiveTraceChanged, ScreenRecordingChange, TracePositionUpdate,} from '@trace_api/trace_events';
import {TracePosition} from '@trace_api/trace_position';
import {TraceType} from '@trace_api/trace_type';
import {CanvasEntry, MediaBasedTraceEntry, VideoEntry,} from '@trace/media_based/media_based_trace_entry';
import {PlaybackStateChangeHandled} from '@ui/shared/playback/events';
import {PlaybackState} from '@ui/shared/playback/playback_state';
import {ExpandedTimelineToggled} from '@ui/timeline/timeline_events';

import {Presenter} from './presenter';
import {UiData} from './ui_data';

describe('PresenterMediaBased', () => {
  const entries = [
    new VideoEntry(new Blob(), 0),
    new VideoEntry(new Blob(), 1),
  ];
  const timestamps = [makeRealTimestamp(10n), makeRealTimestamp(15n)];
  const trace1 = new TraceBuilder<MediaBasedTraceEntry>()
    .setType(TraceType.SCREEN_RECORDING)
    .setDescriptors(['recording 1'])
    .setEntries(entries)
    .setTimestamps(timestamps)
    .build();
  const trace2 = new TraceBuilder<MediaBasedTraceEntry>()
    .setType(TraceType.SCREEN_RECORDING)
    .setDescriptors(['recording 2'])
    .setEntries(entries)
    .setTimestamps(timestamps)
    .build();
  const canvasEntry = new CanvasEntry(
    jasmine.createSpyObj<ImageBitmap>('image', ['close']),
  );
  const prefetchedSrEntry = trace1.createLazyEntry(0, async () => canvasEntry);
  const positionUpdateWithPrefetchedEntry = new TracePositionUpdate(
    TracePosition.fromTimestamp(timestamps[0]),
    undefined,
    {
      screenRecording: prefetchedSrEntry,
      trace: undefined,
      seek: prefetchedSrEntry.getTimestamp(),
    },
  );
  const positionUpdate1 = TracePositionUpdate.fromTimestamp(timestamps[1]);

  const traces = [trace1, trace2];

  let presenter: Presenter;
  let uiData: UiData;

  beforeEach(() => {
    presenter = new Presenter(traces, (newData) => {
      uiData = newData;
    });
  });

  it('initializes titles from trace descriptors', () => {
    expect(uiData.titles).toEqual(['recording 1', 'recording 2']);
  });

  it('processes trace position updates without prefetched entry', async () => {
    const promise = presenter.onAppEvent(positionUpdate1);
    expect(uiData.isFetchingEntries).toBeTrue();
    await promise;
    expect(uiData.isFetchingEntries).toBeFalse();
    expect(uiData.currentTraceEntries).toEqual([entries[1], entries[1]]);

    const positionUpdate0 = TracePositionUpdate.fromTimestamp(timestamps[0]);
    await presenter.onAppEvent(positionUpdate0);
    expect(uiData.currentTraceEntries).toEqual([entries[0], entries[0]]);
  });

  it('processes trace position updates with prefetched entry', async () => {
    await presenter.onAppEvent(positionUpdateWithPrefetchedEntry);
    expect(uiData.currentTraceEntries).toEqual([canvasEntry, entries[0]]);
  });

  it('updates isInPlaybackMode on PlaybackStateChangeHandled event', async () => {
    expect(uiData.isInPlaybackMode).toBeFalse();
    await presenter.onAppEvent(
      new PlaybackStateChangeHandled(PlaybackState.FORWARDS),
    );
    expect(uiData.isInPlaybackMode).toBeTrue();
    await presenter.onAppEvent(
      new PlaybackStateChangeHandled(PlaybackState.BACKWARDS),
    );
    expect(uiData.isInPlaybackMode).toBeTrue();
    await presenter.onAppEvent(
      new PlaybackStateChangeHandled(PlaybackState.PAUSED),
    );
    expect(uiData.isInPlaybackMode).toBeFalse();
  });

  it('updates force minimize state on expanded timeline toggle', async () => {
    expect(uiData.forceMinimize).toBeFalse();
    await presenter.onAppEvent(new ExpandedTimelineToggled(true));
    expect(uiData.forceMinimize).toBeTrue();
    await presenter.onAppEvent(new ExpandedTimelineToggled(false));
    expect(uiData.forceMinimize).toBeFalse();
  });

  it('does not process trace position update if force minimize set', async () => {
    await presenter.onAppEvent(new ExpandedTimelineToggled(true));
    await presenter.onAppEvent(positionUpdate1);
    expect(uiData.currentTraceEntries).toEqual([]);
  });

  it('does not update uiData entries in playback mode if no CanvasEntries present', async () => {
    await presenter.onAppEvent(
      new PlaybackStateChangeHandled(PlaybackState.FORWARDS),
    );
    await presenter.onAppEvent(positionUpdate1);
    expect(uiData.currentTraceEntries).toEqual([]);
  });

  it('updates uiData entries in playback mode if no entries at all present', async () => {
    await presenter.onAppEvent(
      new PlaybackStateChangeHandled(PlaybackState.FORWARDS),
    );
    await presenter.onAppEvent(positionUpdateWithPrefetchedEntry);
    expect(uiData.currentTraceEntries.length).toEqual(2);
    await presenter.onAppEvent(
      new TracePositionUpdate(
        TracePosition.fromTimestamp(makeRealTimestamp(5n)),
      ),
    );
    expect(uiData.currentTraceEntries).toEqual([]);
  });

  it('handles overlay double click', () => {
    const spy = jasmine.createSpy();
    presenter.setEmitEvent(spy);

    presenter.onOverlayDblClick(3);
    expect(spy).not.toHaveBeenCalled();

    presenter.onOverlayDblClick(1);
    expect(spy).toHaveBeenCalledWith(new ActiveTraceChanged(trace2));
  });

  it('handles overlay trace change', () => {
    const spy = jasmine.createSpy();
    presenter.setEmitEvent(spy);

    presenter.onOverlayScreenRecordingChange(2);
    expect(spy).not.toHaveBeenCalled();

    presenter.onOverlayScreenRecordingChange(1);
    expect(spy).toHaveBeenCalledWith(new ScreenRecordingChange(trace2));
  });
});
