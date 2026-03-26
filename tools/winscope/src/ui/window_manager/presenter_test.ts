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
 * WITHOUT WARRANTIES OR CONDITIONS OF ANYf KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import {assertDefined} from '@common/assert';
import {InMemoryStorage} from '@common/store/in_memory_storage';
import {Store} from '@common/store/store';
import {parseAndConvertToPerfettoTrace} from '@legacy_file_readers/testing/fixture_utils';
import {FileReaderWindowManager} from '@legacy_file_readers/window_manager/file_reader_window_manager';
import {TraceBuilder} from '@trace_api/testing/trace_builder';
import {makeEmptyTrace} from '@trace_api/testing/trace_test_helpers';
import {Trace} from '@trace_api/trace';
import {TracePositionUpdate} from '@trace_api/trace_events';
import {TRACE_INFO} from '@trace_api/trace_info';
import {TraceType} from '@trace_api/trace_type';
import {Traces} from '@trace_api/traces';
import {makeNodeFilter} from '@tree_node/helpers';
import {HierarchyTreeNode} from '@tree_node/hierarchy_tree_node';
import {NotifyHierarchyViewCallbackType} from '@ui/shared/hierarchy/abstract_hierarchy_viewer_presenter';
import {AbstractHierarchyViewerPresenterTest} from '@ui/shared/hierarchy/abstract_hierarchy_viewer_presenter_test';
import {UiHierarchyTreeNode} from '@ui/shared/hierarchy/ui_hierarchy_tree_node';
import {makeUiPropertyNode} from '@ui/shared/properties/testing/ui_property_tree_node_test_helpers';
import {UiPropertyTreeNode} from '@ui/shared/properties/ui_property_tree_node';
import {TraceRectType} from '@ui/shared/rects/rect_spec';
import {VISIBLE_CHIP} from '@ui/shared/user_input/chip';
import {TextFilter} from '@ui/shared/user_input/text_filter';

import {Presenter} from './presenter';
import {UiData} from './ui_data';

class PresenterWindowManagerTest extends AbstractHierarchyViewerPresenterTest<UiData> {
  private trace: Trace<HierarchyTreeNode> | undefined;
  private positionUpdate: TracePositionUpdate | undefined;
  private secondPositionUpdate: TracePositionUpdate | undefined;
  private selectedTree: UiHierarchyTreeNode | undefined;
  private selectedTreeAfterPositionUpdate: UiHierarchyTreeNode | undefined;

  override readonly shouldExecuteRectTests = true;
  override readonly shouldExecuteSimplifyNamesTest = true;
  override readonly shouldExecutePlaybackTests = true;
  override readonly keepCalculatedPropertiesInChild = false;
  override readonly keepCalculatedPropertiesInRoot = false;
  override readonly expectedHierarchyOpts = {
    showDiff: {
      name: 'Show diff',
      enabled: false,
      isUnavailable: true,
    },
    showOnlyVisible: {
      name: 'Show only',
      chip: VISIBLE_CHIP,
      enabled: false,
    },
    simplifyNames: {
      name: 'Simplify names',
      enabled: true,
    },
    flat: {
      name: 'Flat',
      enabled: false,
    },
  };
  override readonly expectedPropertiesOpts = {
    showDiff: {
      name: 'Show diff',
      enabled: false,
      isUnavailable: true,
    },
    showDefaults: {
      name: 'Show defaults',
      enabled: false,
      tooltip: `If checked, shows the value of all properties.
Otherwise, hides all properties whose value is
the default for its data type.`,
    },
  };
  override readonly expectedRectsOpts = {
    ignoreRectShowState: {
      name: 'Ignore',
      icon: 'visibility',
      enabled: false,
    },
    showOnlyVisible: {
      name: 'Show only',
      chip: VISIBLE_CHIP,
      enabled: false,
    },
  };

  override readonly rectIndex = 2;
  override readonly expectedInitialRectSpec = {
    type: TraceRectType.WINDOW_STATES,
    icon: TRACE_INFO[TraceType.WINDOW_MANAGER].icon,
    legend: [
      {
        fill: '#c8e8b7',
        desc: 'Visible',
        border: 'var(--default-text-color)',
        showInWireFrameMode: false,
      },
      {
        fill: '#dcdcdc',
        desc: 'Not visible',
        border: 'var(--default-text-color)',
        showInWireFrameMode: false,
      },
      {
        fill: 'var(--selected-element-color)',
        desc: 'Selected',
        border: 'var(--default-text-color)',
        showInWireFrameMode: true,
      },
      {border: '#ffc24b', desc: 'Pinned', showInWireFrameMode: true},
      {border: '#b34a24', desc: 'Pinned', showInWireFrameMode: true},
    ],
  };
  override readonly treeNodeLongName =
    'f7092ed com.google.android.apps.nexuslauncher/.NexusLauncherActivity';
  override readonly treeNodeShortName =
    'com.google.(...).NexusLauncherActivity';

  override async setUpTestEnvironment(): Promise<void> {
    const parser = await parseAndConvertToPerfettoTrace(
      'traces/elapsed_and_real_timestamp/WindowManager.pb',
      [FileReaderWindowManager.createInstance],
    );

    this.trace = new TraceBuilder<HierarchyTreeNode>()
      .setType(TraceType.WINDOW_MANAGER)
      .setEntries([await parser.getEntry(0), await parser.getEntry(1)])
      .build();

    const firstEntry = this.trace.getEntry(0);
    this.positionUpdate = TracePositionUpdate.fromTraceEntry(firstEntry);
    this.secondPositionUpdate = TracePositionUpdate.fromTraceEntry(
      this.trace.getEntry(1),
    );

    const firstEntryDataTree = await firstEntry.getValue();
    this.selectedTree = UiHierarchyTreeNode.from(
      assertDefined(
        firstEntryDataTree.findDfs(
          makeNodeFilter(new TextFilter('93d3f3c').getFilterPredicate()),
        ),
      ),
    );
    this.selectedTreeAfterPositionUpdate = UiHierarchyTreeNode.from(
      assertDefined(
        firstEntryDataTree.findDfs(
          makeNodeFilter(new TextFilter('f7092ed').getFilterPredicate()),
        ),
      ),
    );
  }

  override createPresenterWithEmptyTrace(
    callback: NotifyHierarchyViewCallbackType<UiData>,
  ): Presenter {
    const trace = makeEmptyTrace<HierarchyTreeNode>(TraceType.WINDOW_MANAGER);
    const traces = new Traces();
    traces.addTrace(trace);
    return new Presenter(trace, traces, new InMemoryStorage(), callback);
  }

  override createPresenter(
    callback: NotifyHierarchyViewCallbackType<UiData>,
    storage: Store,
  ): Presenter {
    const traces = new Traces();
    const trace = assertDefined(this.trace);
    traces.addTrace(trace);
    return new Presenter(trace, traces, storage, callback);
  }

  override getPositionUpdate(): TracePositionUpdate {
    return assertDefined(this.positionUpdate);
  }

  override getSecondPositionUpdate(): TracePositionUpdate {
    return assertDefined(this.secondPositionUpdate);
  }

  override getSelectedTree(): UiHierarchyTreeNode {
    return assertDefined(this.selectedTree);
  }

  override getSelectedTreeAfterPositionUpdate(): UiHierarchyTreeNode {
    return assertDefined(this.selectedTreeAfterPositionUpdate);
  }

  override executePropertiesChecksAfterPositionUpdate(uiData: UiData) {
    const propertyNodes = assertDefined(uiData.propertyNodes);
    expect(
      propertyNodes.find((r) => r.node.name === 'state')?.node.formattedValue(),
    ).toBe('STOPPED');
    expect(
      propertyNodes
        .find((r) => r.node.name === 'hashCode')
        ?.node.formattedValue(),
    ).toBe('0xf7092ed');
    expect(uiData.displays).toEqual([
      {
        displayId: 'DisplayContent 1f3454e Built-in Screen',
        groupId: 0,
        name: 'Built-in Screen',
        isActive: true,
      },
    ]);
  }

  override executeSpecializedChecksForPropertiesFromRect(uiData: UiData) {
    const propertyNodes = assertDefined(uiData.propertyNodes);
    expect(propertyNodes.length).toBe(37);
  }

  override executePropertiesChecksAfterSecondPositionUpdate(uiData: UiData) {
    const propertyNodes = assertDefined(uiData.propertyNodes);
    expect(
      propertyNodes.find((r) => r.node.name === 'state')?.node.formattedValue(),
    ).toBe('RESUMED');
  }

  override executeSpecializedTests(): void {
    const invalidNode = UiPropertyTreeNode.from(makeUiPropertyNode('', '', 0));

    describe('Specialized tests', () => {
      let presenter: Presenter;
      let uiData: UiData;

      beforeAll(async () => {
        await this.setUpTestEnvironment();
      });

      beforeEach(() => {
        const notifyViewCallback = (newData: UiData) => {
          uiData = newData;
        };
        presenter = this.createPresenter(
          notifyViewCallback as NotifyHierarchyViewCallbackType<UiData>,
          new InMemoryStorage(),
        );
      });

      it('does not propagate hashcode if name does not match', async () => {
        await presenter.onPropagatePropertyClick(invalidNode);
        expect(uiData.highlightedItem).toBe('');
      });

      it('does not propagate hashcode if matching node not found', async () => {
        const missingHashcode = UiPropertyTreeNode.from(
          makeUiPropertyNode('', 'hashCode', 0),
        );
        await presenter.onPropagatePropertyClick(missingHashcode);
        expect(uiData.highlightedItem).toBe('');
      });

      it('propagates node with matching hashcode', async () => {
        const validHashcode = UiPropertyTreeNode.from(
          makeUiPropertyNode('', 'hashCode', 32720206),
        );
        await presenter.onAppEvent(this.getPositionUpdate());
        await presenter.onPropagatePropertyClick(validHashcode);
        expect(uiData.highlightedItem).toEqual(
          'DisplayContent 1f3454e Built-in Screen',
        );
      });
    });
  }
}

describe('PresenterWindowManager', () => {
  new PresenterWindowManagerTest().execute();
});
