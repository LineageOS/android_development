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

import {MockPresenter} from '@app/shared/testing/mock_log_viewer_presenter';
import {assertDefined} from '@common/assert';
import {KeyboardEventKey} from '@common/dom';
import {InMemoryStorage} from '@common/store/in_memory_storage';
import {makeElapsedTimestamp, makeRealTimestamp, makeZeroTimestamp,} from '@common/time/testing/test_helpers';
import {Timer} from '@common/time/timer';
import {SetFormatters} from '@parsers/operations/set_formatters';
import {TraceBuilder} from '@trace_api/testing/trace_builder';
import {makeEmptyTrace} from '@trace_api/testing/trace_test_helpers';
import {Trace} from '@trace_api/trace';
import {ActiveTraceChanged, TracePositionUpdate} from '@trace_api/trace_events';
import {TracePosition} from '@trace_api/trace_position';
import {TraceType} from '@trace_api/trace_type';
import {DEFAULT_PROPERTY_FORMATTER} from '@trace/formatters';
import {HierarchyTreeNode} from '@tree_node/hierarchy_tree_node';
import {PropertySource} from '@tree_node/property_tree_node';
import {HierarchyTreeBuilder} from '@tree_node/testing/hierarchy_tree_builder';
import {DarkModeToggled} from '@ui/shared/events/misc_events';
import {LogSelectFilter, LogTextFilter} from '@ui/shared/log/log_filters';
import {UiDataLog} from '@ui/shared/log/ui_data_log';
import {TextFilter} from '@ui/shared/user_input/text_filter';
import {UserOptions} from '@ui/shared/user_input/user_options';
import {TimestampClickDetail} from '@ui/shared/viewers/viewer_event_details';

describe('AbstractLogViewerPresenter', () => {
  let uiData: UiDataLog;
  let presenter: MockPresenter;
  let trace: Trace<HierarchyTreeNode>;
  let positionUpdate: TracePositionUpdate;
  let secondPositionUpdate: TracePositionUpdate;
  let lastEntryPositionUpdate: TracePositionUpdate;

  beforeAll(async () => {
    const timestamp1 = makeElapsedTimestamp(1n);
    const timestamp2 = makeElapsedTimestamp(2n);
    const timestamp3 = makeElapsedTimestamp(3n);
    const timestamp4 = makeElapsedTimestamp(4n);
    trace = new TraceBuilder<HierarchyTreeNode>()
      .setType(TraceType.TRANSACTIONS)
      .setEntries([
        new HierarchyTreeBuilder()
          .setRootNodeFormatter(new SetFormatters())
          .setId('Test Trace')
          .setName('entry 1')
          .setProperties({
            pass1: 'pass',
            fail1: 'pass',
            fail2: 'fail',
          })
          .addChildProperty({
            name: 'pass2',
            value: 'fail',
            formatter: DEFAULT_PROPERTY_FORMATTER,
            source: PropertySource.DEFAULT,
          })
          .build(),
        new HierarchyTreeBuilder()
          .setRootNodeFormatter(new SetFormatters())
          .setId('Test Trace')
          .setName('entry 2')
          .build(),
        new HierarchyTreeBuilder()
          .setRootNodeFormatter(new SetFormatters())
          .setId('Test Trace')
          .setName('entry 3')
          .build(),
        new HierarchyTreeBuilder()
          .setRootNodeFormatter(new SetFormatters())
          .setId('Test Trace')
          .setName('entry 4')
          .build(),
      ])
      .setTimestamps([timestamp1, timestamp2, timestamp3, timestamp4])
      .build();
    positionUpdate = TracePositionUpdate.fromTraceEntry(trace.getEntry(0));
    secondPositionUpdate = TracePositionUpdate.fromTraceEntry(
      trace.getEntry(1),
    );
    lastEntryPositionUpdate = TracePositionUpdate.fromTraceEntry(
      trace.getEntry(3),
    );
  });

  beforeEach(() => {
    presenter = new MockPresenter(trace, new InMemoryStorage(), (newData) => {
      uiData = newData;
    });
  });

  it('initializes entries and filters with options', async () => {
    expect(uiData.scrollToIndex).toBeUndefined();
    expect(uiData.currentIndex).toBeUndefined();
    expect(uiData.selectedIndex).toBeUndefined();
    expect(uiData.entries.length).toBe(0);
    expect(uiData.propertyNodes).toBeUndefined();
    expect(uiData.headers).toEqual([]);

    await sendPositionUpdate(positionUpdate);

    expect(uiData.scrollToIndex).toBeDefined();
    expect(uiData.currentIndex).toBeDefined();
    expect(uiData.selectedIndex).toBeUndefined();
    expect(uiData.entries.length).toBe(4);
    expect(assertDefined(uiData.propertyNodes?.at(0)).node.id).toEqual(
      (await getPropertiesTree(0)).id,
    );
    expect(uiData.headers.length).toBe(3);
    expect((uiData.headers[0].filter as LogSelectFilter).options).toEqual([
      'stringValue',
      'differentValue',
    ]);
  });

  it('processes trace position update and updates ui data', async () => {
    await sendPositionUpdate(secondPositionUpdate);
    expect(uiData.currentIndex).toBe(1);
    expect(assertDefined(uiData.propertyNodes?.at(0)).node.id).toEqual(
      (await getPropertiesTree(1)).id,
    );
  });

  it('propagates position with next trace entry of different timestamp on right arrow key press', async () => {
    const positionUpdateEntry = assertDefined(positionUpdate.position.entry);
    const trace = positionUpdateEntry.getFullTrace();
    await presenter.onAppEvent(new ActiveTraceChanged(trace));

    const emitEventSpy = jasmine.createSpy();
    presenter.setEmitEvent(emitEventSpy);
    await sendPositionUpdate(positionUpdate);

    await presenter.onPositionChangeByKeyPress(
      makeKeydownEvent(KeyboardEventKey.ARROW_RIGHT),
    );
    const nextEntry = assertDefined(
      uiData.entries.find(
        (entry) =>
          entry.traceEntry.getTimestamp() > positionUpdateEntry.getTimestamp(),
      ),
    );
    expect(emitEventSpy).toHaveBeenCalledWith(
      new TracePositionUpdate(
        TracePosition.fromTraceEntry(nextEntry.traceEntry),
        true,
      ),
    );
  });

  it('does not propagate any position on right arrow key press if on last entry', async () => {
    const trace = assertDefined(
      lastEntryPositionUpdate.position.entry,
    ).getFullTrace();
    await presenter.onAppEvent(new ActiveTraceChanged(trace));

    const emitEventSpy = jasmine.createSpy();
    presenter.setEmitEvent(emitEventSpy);
    await sendPositionUpdate(lastEntryPositionUpdate);

    await presenter.onPositionChangeByKeyPress(
      makeKeydownEvent(KeyboardEventKey.ARROW_RIGHT),
    );
    expect(emitEventSpy).not.toHaveBeenCalled();
  });

  it('propagates position with first prev trace entry with valid timestamp on left arrow key press', async () => {
    const trace = assertDefined(
      lastEntryPositionUpdate.position.entry,
    ).getFullTrace();
    await presenter.onAppEvent(new ActiveTraceChanged(trace));

    const emitEventSpy = jasmine.createSpy();
    presenter.setEmitEvent(emitEventSpy);
    await sendPositionUpdate(lastEntryPositionUpdate);

    const prevIndex = assertDefined(uiData.currentIndex) - 1;
    spyOn(
      uiData.entries[prevIndex].traceEntry,
      'hasValidTimestamp',
    ).and.returnValue(false);
    await presenter.onPositionChangeByKeyPress(
      makeKeydownEvent(KeyboardEventKey.ARROW_LEFT),
    );
    expect(emitEventSpy).toHaveBeenCalledWith(
      new TracePositionUpdate(
        TracePosition.fromTraceEntry(uiData.entries[prevIndex - 1].traceEntry),
        true,
      ),
    );
  });

  it('does not propagate any position on left arrow key press if on first entry', async () => {
    const trace = assertDefined(positionUpdate.position.entry).getFullTrace();
    await presenter.onAppEvent(new ActiveTraceChanged(trace));

    const emitEventSpy = jasmine.createSpy();
    presenter.setEmitEvent(emitEventSpy);
    await sendPositionUpdate(positionUpdate);

    await presenter.onPositionChangeByKeyPress(
      makeKeydownEvent(KeyboardEventKey.ARROW_LEFT),
    );
    expect(emitEventSpy).not.toHaveBeenCalled();
  });

  it('filters entries on select filter change', async () => {
    await sendPositionUpdate(positionUpdate);
    const header = uiData.headers[1];

    await presenter.onSelectFilterChange(header, ['0']);
    expect(
      new Set(uiData.entries.map((entry) => entry.fields[1].value)),
    ).toEqual(new Set([0]));

    await presenter.onSelectFilterChange(header, ['0', '2', '3']);
    expect(
      new Set(uiData.entries.map((entry) => entry.fields[1].value)),
    ).toEqual(new Set([0, 2, 3]));

    await presenter.onSelectFilterChange(header, []);
    expect(
      new Set(uiData.entries.map((entry) => entry.fields[1].value)),
    ).toEqual(new Set([0, 1, 2, 3]));
  });

  it('filters entries on text filter change', async () => {
    await sendPositionUpdate(positionUpdate);
    const header = uiData.headers[0];
    const filter = header.filter as LogTextFilter;

    filter.updateFilterValue(['stringValue']);
    await presenter.onTextFilterChange(header, filter.textFilter);
    expect(
      new Set(uiData.entries.map((entry) => entry.fields[0].value)),
    ).toEqual(new Set(['stringValue']));

    filter.updateFilterValue(['value']);
    await presenter.onTextFilterChange(header, filter.textFilter);
    expect(
      new Set(uiData.entries.map((entry) => entry.fields[0].value)),
    ).toEqual(new Set(['stringValue', 'differentValue']));

    filter.updateFilterValue(['']);
    await presenter.onTextFilterChange(header, filter.textFilter);
    expect(
      new Set(uiData.entries.map((entry) => entry.fields[0].value)),
    ).toEqual(new Set(['stringValue', 'differentValue']));
  });

  it('updates indices when filters change', async () => {
    await sendPositionUpdate(lastEntryPositionUpdate);
    presenter.onLogEntryClick(1);
    expect(uiData.currentIndex).toBe(3);
    expect(uiData.selectedIndex).toBe(1);

    const header = uiData.headers[1];
    await presenter.onSelectFilterChange(header, ['0']);
    expect(uiData.currentIndex).toBe(0);
    expect(uiData.selectedIndex).toBeUndefined();

    await presenter.onSelectFilterChange(header, ['0', '2']);
    expect(uiData.currentIndex).toBe(1);
    expect(uiData.selectedIndex).toBeUndefined();

    await presenter.onSelectFilterChange(header, []);
    expect(uiData.currentIndex).toBe(3);
    expect(uiData.selectedIndex).toBeUndefined();
  });

  it('updates properties tree when entry clicked', async () => {
    await sendPositionUpdate(positionUpdate);

    const expectedId = (await getPropertiesTree(2)).id;

    await presenter.onLogEntryClick(2);
    expect(assertDefined(uiData.propertyNodes?.at(0)).node.id).toEqual(
      expectedId,
    );

    // does not remove selection when entry clicked again
    await presenter.onLogEntryClick(2);
    expect(assertDefined(uiData.propertyNodes?.at(0)).node.id).toEqual(
      expectedId,
    );
  });

  it('updates properties tree when changed by key press', async () => {
    await sendPositionUpdate(positionUpdate);
    await presenter.onLogEntryClick(0);

    await presenter.onArrowDownPress();
    expect(uiData.selectedIndex).toBe(1);
    expect(assertDefined(uiData.propertyNodes?.at(0)).node.id).toEqual(
      (await getPropertiesTree(1)).id,
    );

    const expectedId0 = (await getPropertiesTree(0)).id;

    await presenter.onArrowUpPress();
    expect(uiData.selectedIndex).toBe(0);
    expect(assertDefined(uiData.propertyNodes?.at(0)).node.id).toEqual(
      expectedId0,
    );

    // does not remove selection if index out of range
    await presenter.onArrowUpPress();
    expect(uiData.selectedIndex).toBe(0);
    expect(assertDefined(uiData.propertyNodes?.at(0)).node.id).toEqual(
      expectedId0,
    );

    // does not remove selection if index out of range
    await presenter.onLogEntryClick(3);
    await presenter.onArrowDownPress();
    expect(uiData.selectedIndex).toBe(3);
    expect(assertDefined(uiData.propertyNodes?.at(0)).node.id).toEqual(
      (await getPropertiesTree(3)).id,
    );
  });

  it('emits event on log timestamp click', async () => {
    await sendPositionUpdate(positionUpdate);
    const spy = jasmine.createSpy();
    presenter.setEmitEvent(spy);

    await presenter.onTimestampClick(
      new TimestampClickDetail(uiData.entries[0].traceEntry),
    );
    expect(spy).toHaveBeenCalledWith(
      TracePositionUpdate.fromTraceEntry(uiData.entries[0].traceEntry, true),
    );
  });

  it('emits event on raw timestamp click', async () => {
    await sendPositionUpdate(positionUpdate);
    const spy = jasmine.createSpy();
    presenter.setEmitEvent(spy);

    const ts = makeZeroTimestamp();
    await presenter.onTimestampClick(new TimestampClickDetail(undefined, ts));
    expect(spy).toHaveBeenCalledWith(
      TracePositionUpdate.fromTimestamp(ts, true),
    );
  });

  it('filters properties tree', async () => {
    await sendPositionUpdate(positionUpdate);
    expect(assertDefined(uiData.propertyNodes).length).toBe(4);
    await presenter.onPropertiesFilterChange(new TextFilter('pass'));
    expect(assertDefined(uiData.propertyNodes).length).toBe(3);
  });

  it('shows/hides defaults', async () => {
    await sendPositionUpdate(positionUpdate);
    expect(assertDefined(uiData.propertyNodes).length).toBe(4);
    const userOptions: UserOptions = {
      showDefaults: {
        name: 'Show defaults',
        enabled: true,
      },
    };
    await presenter.onPropertiesUserOptionsChange(userOptions);
    expect(uiData.propertiesUserOptions).toEqual(userOptions);
    expect(assertDefined(uiData.propertyNodes).length).toBe(5);
  });

  it('updates dark mode', async () => {
    expect(uiData.isDarkMode).toBeFalse();
    await presenter.onAppEvent(new DarkModeToggled(true));
    expect(uiData.isDarkMode).toBeTrue();
  });

  it('allows arrow keydown event to propagate if presenter trace not active or current index not defined', async () => {
    await sendPositionUpdate(
      new TracePositionUpdate(
        TracePosition.fromTimestamp(makeElapsedTimestamp(-1n)),
      ),
    );
    expect(uiData.currentIndex).toBeUndefined();

    const event = new KeyboardEvent('keydown', {
      key: KeyboardEventKey.ARROW_RIGHT,
    });
    const spy = spyOn(event, 'stopImmediatePropagation');

    await presenter.onPositionChangeByKeyPress(event);
    expect(spy).not.toHaveBeenCalled();

    await presenter.onAppEvent(
      new ActiveTraceChanged(
        assertDefined(positionUpdate.position.entry).getFullTrace(),
      ),
    );
    await presenter.onPositionChangeByKeyPress(event);
    expect(spy).not.toHaveBeenCalled();

    await sendPositionUpdate(positionUpdate, false);
    await presenter.onPositionChangeByKeyPress(event);
    expect(spy).toHaveBeenCalledTimes(1);

    await presenter.onAppEvent(
      new ActiveTraceChanged(makeEmptyTrace(TraceType.TRANSACTIONS)),
    );
    await presenter.onPositionChangeByKeyPress(event);
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('is robust to empty trace', async () => {
    const trace = makeEmptyTrace<HierarchyTreeNode>(TraceType.CUJS);
    const presenter = new MockPresenter(
      trace,
      new InMemoryStorage(),
      (newData) => (uiData = newData),
    );

    await sendPositionUpdate(
      TracePositionUpdate.fromTimestamp(makeRealTimestamp(0n)),
      true,
      presenter,
    );

    expect(uiData.entries).toEqual([]);
    expect(uiData.selectedIndex).toBeUndefined();
    expect(uiData.scrollToIndex).toBeUndefined();
    expect(uiData.currentIndex).toBeUndefined();
    expect(uiData.headers.length).toBe(3);
    expect(uiData.propertyNodes).toBeUndefined();
    expect(uiData.propertiesUserOptions).toBeDefined();
    expect(uiData.propertiesFilter).toBeDefined();
  });

  it('increments checkScrollViewportCount on active trace change', async () => {
    let copiedUiData: UiDataLog | undefined;
    const presenterWithCopyCallback = new MockPresenter(
      trace,
      new InMemoryStorage(),
      (newData) => {
        copiedUiData = Object.assign({}, newData);
      },
    );
    expect(copiedUiData?.checkScrollViewportCount).toBe(0);
    await presenterWithCopyCallback.onAppEvent(new ActiveTraceChanged(trace));
    expect(copiedUiData?.checkScrollViewportCount).toBe(1);

    // does not increment if different trace set as active
    const newTrace = makeEmptyTrace(TraceType.TRANSACTIONS);
    await presenterWithCopyCallback.onAppEvent(
      new ActiveTraceChanged(newTrace),
    );
    expect(copiedUiData?.checkScrollViewportCount).toBe(1);
  });

  async function sendPositionUpdate(
    update: TracePositionUpdate,
    isFirst = true,
    p = presenter,
  ) {
    await assertDefined(p).onAppEvent(update);
    if (isFirst) {
      expect(uiData.isFetchingData).toBeTrue(); // fetches data asynchronously
      await new Timer().wait(() => !uiData.isFetchingData);
    }
    expect(uiData.isFetchingData).toBeFalse();
  }

  async function getPropertiesTree(index: number) {
    return await assertDefined(uiData.entries[index].getPropertiesTree)();
  }

  function makeKeydownEvent(key: string) {
    return new KeyboardEvent('keydown', {key});
  }
});
