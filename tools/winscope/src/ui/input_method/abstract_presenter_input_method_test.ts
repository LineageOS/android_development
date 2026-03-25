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
 * limitations under the License.d
 */

import {assertDefined} from '@common/assert';
import {InMemoryStorage} from '@common/store/in_memory_storage';
import {Store} from '@common/store/store';
import {UserNotifierChecker} from '@services/testing/user_notifier_checker';
import {TraceBuilder} from '@trace_api/testing/trace_builder';
import {makeEmptyTrace} from '@trace_api/testing/trace_test_helpers';
import {TracePositionUpdate} from '@trace_api/trace_events';
import {ImeTraceType, TraceType} from '@trace_api/trace_type';
import {Traces} from '@trace_api/traces';
import {HierarchyTreeNode} from '@tree_node/hierarchy_tree_node';
import {PropertyTreeNode} from '@tree_node/property_tree_node';
import {PresenterInputMethodClients} from '@ui/input_method/clients/presenter_input_method_clients';
import {PresenterInputMethodManagerService} from '@ui/input_method/imms/presenter_input_method_manager_service';
import {PresenterInputMethodService} from '@ui/input_method/ims/presenter_input_method_service';
import {getImeTraceEntries} from '@ui/input_method/testing/fixture_utils';
import {NotifyHierarchyViewCallbackType} from '@ui/shared/hierarchy/abstract_hierarchy_viewer_presenter';
import {AbstractHierarchyViewerPresenterTest} from '@ui/shared/hierarchy/abstract_hierarchy_viewer_presenter_test';
import {treeNodeEqualityTester} from '@ui/shared/hierarchy/testing/ui_hierarchy_tree_node_test_helpers';
import {UiDataHierarchy} from '@ui/shared/hierarchy/ui_data_hierarchy';
import {UiHierarchyTreeNode} from '@ui/shared/hierarchy/ui_hierarchy_tree_node';
import {UiPropertyTreeNode} from '@ui/shared/properties/ui_property_tree_node';
import {VISIBLE_CHIP} from '@ui/shared/user_input/chip';

import {AbstractPresenterInputMethod} from './abstract_presenter_input_method';
import {ImeUiData} from './ime_ui_data';

export abstract class AbstractPresenterInputMethodTest extends AbstractHierarchyViewerPresenterTest<ImeUiData> {
  private traces: Traces | undefined;
  private positionUpdate: TracePositionUpdate | undefined;
  private secondPositionUpdate: TracePositionUpdate | undefined;
  private selectedTree: UiHierarchyTreeNode | undefined;
  private entries: Map<TraceType, HierarchyTreeNode> | undefined;

  override readonly shouldExecuteRectTests = false;
  override readonly shouldExecuteSimplifyNamesTest = false;
  override readonly shouldExecutePlaybackTests = false;
  override readonly keepCalculatedPropertiesInChild = false;
  override readonly keepCalculatedPropertiesInRoot = false;
  override readonly expectedHierarchyOpts = {
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
    showDefaults: {
      name: 'Show defaults',
      enabled: false,
      tooltip: `If checked, shows the value of all properties.
Otherwise, hides all properties whose value is
the default for its data type.`,
    },
  };

  override async setUpTestEnvironment(): Promise<void> {
    let secondEntries: Map<TraceType, HierarchyTreeNode>;
    [this.entries, secondEntries] = await getImeTraceEntries();
    this.traces = new Traces();
    const traceEntries = [assertDefined(this.entries.get(this.imeTraceType))];
    const secondEntry = secondEntries.get(this.imeTraceType);
    if (secondEntry) {
      traceEntries.push(secondEntry);
    }

    const trace = new TraceBuilder<HierarchyTreeNode>()
      .setType(this.imeTraceType)
      .setEntries(traceEntries)
      .setFrame(0, 0)
      .build();
    this.traces.addTrace(trace);

    const sfEntry = this.entries.get(TraceType.SURFACE_FLINGER);
    if (sfEntry) {
      this.traces.addTrace(
        new TraceBuilder<HierarchyTreeNode>()
          .setType(TraceType.SURFACE_FLINGER)
          .setEntries([sfEntry])
          .setFrame(0, 0)
          .build(),
      );
    }

    const wmEntry = this.entries.get(TraceType.WINDOW_MANAGER);
    if (wmEntry) {
      this.traces.addTrace(
        new TraceBuilder<HierarchyTreeNode>()
          .setType(TraceType.WINDOW_MANAGER)
          .setEntries([wmEntry])
          .setFrame(0, 0)
          .build(),
      );
    }

    const entry = trace.getEntry(0);
    this.positionUpdate = TracePositionUpdate.fromTraceEntry(entry);
    this.secondPositionUpdate = secondEntry
      ? TracePositionUpdate.fromTraceEntry(trace.getEntry(1))
      : undefined;

    this.selectedTree = UiHierarchyTreeNode.from(this.getSelectedNode());
  }

  override createPresenterWithEmptyTrace(
    callback: NotifyHierarchyViewCallbackType<ImeUiData>,
  ): AbstractPresenterInputMethod {
    const trace = makeEmptyTrace<HierarchyTreeNode>(this.imeTraceType);
    const traces = new Traces();
    traces.addTrace(trace);
    return new this.PresenterInputMethod(
      trace,
      traces,
      new InMemoryStorage(),
      callback,
    );
  }

  override createPresenter(
    callback: NotifyHierarchyViewCallbackType<ImeUiData>,
    storage: Store,
  ): AbstractPresenterInputMethod {
    const traces = assertDefined(this.traces);
    const trace = assertDefined(
      traces.getTrace<HierarchyTreeNode>(this.imeTraceType),
    );
    return new this.PresenterInputMethod(trace, traces, storage, callback);
  }

  override getPositionUpdate(): TracePositionUpdate {
    return assertDefined(this.positionUpdate);
  }

  override getSecondPositionUpdate(): TracePositionUpdate | undefined {
    return this.secondPositionUpdate;
  }

  override getSelectedTree(): UiHierarchyTreeNode {
    return assertDefined(this.selectedTree);
  }

  override getSelectedTreeAfterPositionUpdate(): UiHierarchyTreeNode {
    return assertDefined(this.selectedTree);
  }

  override executePropertiesChecksAfterPositionUpdate(uiData: UiDataHierarchy) {
    const trees = assertDefined(uiData.hierarchyNodes).filter(
      (t) => t.depth === 0,
    );
    expect(trees.length).toBe(this.numberOfNestedChildren);
  }

  override executePropertiesChecksAfterSecondPositionUpdate(
    uiData: UiDataHierarchy,
  ) {
    const trees = assertDefined(uiData.hierarchyNodes).filter(
      (t) => t.depth === 0,
    );
    expect(trees.length).toBe(1);
  }

  override executeSpecializedTests() {
    describe('AbstractPresenterInputMethod', () => {
      let presenter: AbstractPresenterInputMethod;
      let uiData: ImeUiData;
      let traces: Traces;
      let entries: Map<TraceType, HierarchyTreeNode>;
      let Presenter:
        | typeof PresenterInputMethodClients
        | typeof PresenterInputMethodService
        | typeof PresenterInputMethodManagerService;
      let imeTraceType: ImeTraceType;
      let userNotifierChecker: UserNotifierChecker;

      beforeAll(async () => {
        jasmine.addCustomEqualityTester(treeNodeEqualityTester);
        userNotifierChecker = new UserNotifierChecker();
        Presenter = this.PresenterInputMethod;
        imeTraceType = this.imeTraceType;
        await this.setUpTestEnvironment();
        traces = new Traces();
        entries = assertDefined(this.entries);
      });

      afterEach(() => {
        userNotifierChecker.expectNone();
        userNotifierChecker.reset();
      });

      it('is robust to traces without SF', async () => {
        setUpPresenter([imeTraceType, TraceType.WINDOW_MANAGER]);
        await presenter.onAppEvent(this.getPositionUpdate());
        expect(uiData.hierarchyUserOptions).toBeTruthy();
        expect(uiData.propertiesUserOptions).toBeTruthy();
        expect(uiData.hierarchyNodes?.length).toBeGreaterThan(0);
      });

      it('is robust to traces without WM', async () => {
        setUpPresenter([imeTraceType, TraceType.SURFACE_FLINGER]);
        await presenter.onAppEvent(this.getPositionUpdate());
        expect(uiData.hierarchyUserOptions).toBeTruthy();
        expect(uiData.propertiesUserOptions).toBeTruthy();
        expect(uiData.hierarchyNodes?.length).toBeGreaterThan(0);
      });

      it('is robust to traces without WM and SF', async () => {
        setUpPresenter([imeTraceType]);
        await presenter.onAppEvent(this.getPositionUpdate());
        expect(uiData.hierarchyUserOptions).toBeTruthy();
        expect(uiData.propertiesUserOptions).toBeTruthy();
        expect(uiData.hierarchyNodes?.length).toBeGreaterThan(0);
      });

      it('can set new additional properties tree and associated ui data from hierarchy tree node', async () => {
        setUpPresenter([imeTraceType, TraceType.WINDOW_MANAGER]);
        expect(uiData.propertyNodes).toBeUndefined();
        await presenter.onAppEvent(this.getPositionUpdate());
        await presenter.onAdditionalPropertySelected({
          name: 'Test Tree',
          treeNode: this.getSelectedTree(),
        });
        expect(
          assertDefined(uiData.propertyNodes?.at(0)).node.getDisplayName(),
        ).toEqual('Test Tree');
        expect(uiData.highlightedItem).toEqual(this.getSelectedTree().id);
      });

      it('can set new properties tree and associated ui data from id', async () => {
        setUpPresenter([imeTraceType, TraceType.WINDOW_MANAGER]);
        expect(uiData.propertyNodes).toBeUndefined();
        await presenter.onAppEvent(this.getPositionUpdate());

        const selectedTree = this.getSelectedTree();
        await presenter.onHighlightedIdChange(selectedTree.id);
        const propertiesTree = assertDefined(uiData.propertyNodes?.at(0)).node;
        expect(propertiesTree.getDisplayName()).toEqual(selectedTree.name);
        expect(uiData.highlightedItem).toEqual(this.getSelectedTree().id);

        await presenter.onHighlightedIdChange(selectedTree.id);
        expect(uiData.propertyNodes?.at(0)?.node).toEqual(propertiesTree);
        expect(uiData.highlightedItem).toBe('');
      });

      if (this.getPropertiesTree) {
        it('can set new additional properties tree and associated ui data from property tree node', async () => {
          const selectedPropertyTree = assertDefined(this.getPropertiesTree)();
          if (!selectedPropertyTree) {
            return;
          }
          setUpPresenter([imeTraceType]);
          expect(uiData.propertyNodes).toBeUndefined();
          await presenter.onAppEvent(this.getPositionUpdate());
          await presenter.onAdditionalPropertySelected({
            name: 'Additional Properties Tree',
            treeNode: selectedPropertyTree,
          });
          const propertiesTree = assertDefined(
            uiData.propertyNodes?.at(0),
          ).node;
          expect(propertiesTree.getDisplayName()).toEqual(
            'Additional Properties Tree',
          );
          expect(propertiesTree).toEqual(
            UiPropertyTreeNode.from(selectedPropertyTree),
          );
          expect(uiData.highlightedItem).toEqual(selectedPropertyTree.id);

          // clears additional property tree selection
          const selectedTree = this.getSelectedTree();
          await presenter.onHighlightedIdChange(selectedTree.id);
          expect(uiData.propertyNodes?.at(0)?.node.getDisplayName()).toEqual(
            selectedTree.name,
          );
        });
      }

      function setUpPresenter(traceTypes: TraceType[]) {
        traceTypes.forEach((traceType) => {
          const trace = new TraceBuilder<HierarchyTreeNode>()
            .setType(traceType)
            .setEntries([assertDefined(entries.get(traceType))])
            .setFrame(0, 0)
            .build();

          assertDefined(traces).addTrace(trace);
        });
        presenter = createPresenter(traces);
      }

      function createPresenter(traces: Traces): AbstractPresenterInputMethod {
        const callback = (newData: ImeUiData) => {
          uiData = newData;
        };
        const trace = assertDefined(
          traces.getTrace<HierarchyTreeNode>(imeTraceType),
        );
        return new Presenter(
          trace,
          traces,
          new InMemoryStorage(),
          callback as NotifyHierarchyViewCallbackType<ImeUiData>,
        );
      }
    });
  }

  protected getPropertiesTree?(): PropertyTreeNode;
  protected abstract getSelectedNode(): HierarchyTreeNode;

  protected abstract readonly numberOfNestedChildren: number;
  protected abstract readonly PresenterInputMethod:
    | typeof PresenterInputMethodClients
    | typeof PresenterInputMethodService
    | typeof PresenterInputMethodManagerService;
  protected abstract readonly imeTraceType: ImeTraceType;
}
