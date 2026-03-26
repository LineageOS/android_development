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

import {assertDefined} from '@common/assert';
import {Rect} from '@common/geometry/rect';
import {TransformMatrix} from '@common/geometry/transform_matrix';
import {InMemoryStorage} from '@common/store/in_memory_storage';
import {Store} from '@common/store/store';
import {TraceGeometryData} from '@parsers/helpers/trace_geometry_data';
import {UserNotifierChecker} from '@services/testing/user_notifier_checker';
import {TracePositionUpdate} from '@trace_api/trace_events';
import {TraceType} from '@trace_api/trace_type';
import {makeNodeFilter} from '@tree_node/helpers';
import {PropertySource} from '@tree_node/property_tree_node';
import {treeNodeEqualityTester} from '@ui/shared/hierarchy/testing/ui_hierarchy_tree_node_test_helpers';
import {PlaybackSpeedChange, PlaybackStateChangeHandled, PlaybackStateChangeRequest,} from '@ui/shared/playback/events';
import {PlaybackPresenter} from '@ui/shared/playback/playback_presenter';
import {PlaybackState} from '@ui/shared/playback/playback_state';
import {RectSpec} from '@ui/shared/rects/rect_spec';
import {Chip} from '@ui/shared/user_input/chip';
import {TextFilter} from '@ui/shared/user_input/text_filter';
import {UserOptions} from '@ui/shared/user_input/user_options';
import {PlaybackStateChangePropagate} from '@ui/timeline/playback_events';

import {AbstractHierarchyViewerPresenter, NotifyHierarchyViewCallbackType,} from './abstract_hierarchy_viewer_presenter';
import {UiDataHierarchy} from './ui_data_hierarchy';
import {UiHierarchyTreeNode} from './ui_hierarchy_tree_node';

export abstract class AbstractHierarchyViewerPresenterTest<
  UiData extends UiDataHierarchy,
> {
  execute() {
    describe('Common tests', () => {
      let uiData: UiDataHierarchy;
      let presenter: AbstractHierarchyViewerPresenter<UiData>;
      let userNotifierChecker: UserNotifierChecker;
      let storage: InMemoryStorage;

      beforeAll(async () => {
        jasmine.addCustomEqualityTester(treeNodeEqualityTester);
        jasmine.addCustomEqualityTester(chipEqualityTester);
        userNotifierChecker = new UserNotifierChecker();
        await this.setUpTestEnvironment();
      });

      beforeEach(() => {
        storage = new InMemoryStorage();
        presenter = this.createPresenter((newData) => {
          uiData = newData;
        }, storage);
      });

      afterEach(() => {
        userNotifierChecker.expectNone();
        userNotifierChecker.reset();
      });

      it('has expected user options', async () => {
        await presenter.onAppEvent(this.getPositionUpdate());
        expect(uiData.hierarchyUserOptions).toEqual(this.expectedHierarchyOpts);
        expect(uiData.propertiesUserOptions).toEqual(
          this.expectedPropertiesOpts,
        );
        expect(uiData.rectsUserOptions).toEqual(this.expectedRectsOpts);
      });

      it('after highlighting a node, updates properties on position update', async () => {
        await presenter.onAppEvent(this.getPositionUpdate());
        const selectedTree = this.getSelectedTreeAfterPositionUpdate();
        await presenter.onHighlightedNodeChange(selectedTree);
        this.executePropertiesChecksAfterPositionUpdate(uiData);

        const secondUpdate = this.getSecondPositionUpdate();
        if (secondUpdate) {
          await presenter.onAppEvent(secondUpdate);
          assertDefined(this.executePropertiesChecksAfterSecondPositionUpdate)(
            uiData,
          );
        }
      });

      it('after highlighting by id, updates properties tree on position update', async () => {
        await presenter.onAppEvent(this.getPositionUpdate());
        await presenter.onHighlightedIdChange(
          this.getSelectedTreeAfterPositionUpdate().id,
        );
        this.executePropertiesChecksAfterPositionUpdate(uiData);

        const secondUpdate = this.getSecondPositionUpdate();
        if (secondUpdate) {
          await presenter.onAppEvent(secondUpdate);
          assertDefined(this.executePropertiesChecksAfterSecondPositionUpdate)(
            uiData,
          );
        }
      });

      it('correctly keeps/discards calculated properties', async () => {
        await presenter.onPropertiesUserOptionsChange({
          showDefaults: {name: '', enabled: true},
        });
        await presenter.onAppEvent(this.getPositionUpdate());
        await presenter.onHighlightedIdChange(
          assertDefined(uiData.hierarchyNodes?.at(0)).node.id,
        );
        const calculatedPropertyInRoot = uiData.propertyNodes?.find(
          (row) => row.node.source === PropertySource.CALCULATED,
        );
        expect(calculatedPropertyInRoot !== undefined).toEqual(
          this.keepCalculatedPropertiesInRoot,
        );

        await presenter.onHighlightedIdChange(
          this.getSelectedTreeAfterPositionUpdate().id,
        );
        const calculatedPropertyInChild = uiData.propertyNodes?.find(
          (row) => row.node.source === PropertySource.CALCULATED,
        );
        expect(calculatedPropertyInChild !== undefined).toEqual(
          this.keepCalculatedPropertiesInChild,
        );
      });

      if (this.shouldExecuteRectTests) {
        it('sets properties tree and associated ui data from rect', async () => {
          await presenter.onAppEvent(this.getPositionUpdate());
          expect(uiData.rectSpec).toEqual(this.expectedInitialRectSpec);

          const rect = assertDefined(uiData.rectsToDraw)[
            assertDefined(this.rectIndex)
          ];
          await presenter.onHighlightedIdChange(rect.id);
          expect(uiData.highlightedItem).toEqual(rect.id);
          const propertiesTree = assertDefined(
            uiData.propertyNodes?.at(0),
          ).node;
          expect(propertiesTree.id).toEqual(rect.id);
          expect(propertiesTree.getAllChildren().length).toBeGreaterThan(0);
          expect(uiData.propertyNodes?.length).toBeGreaterThan(0);
          assertDefined(this.executeSpecializedChecksForPropertiesFromRect)(
            uiData,
          );
          expect(uiData.rectSpec).toEqual(this.expectedInitialRectSpec);

          await presenter.onHighlightedIdChange(rect.id);
          expect(uiData.highlightedItem).toBe('');
        });
      }

      if (this.shouldExecuteSimplifyNamesTest) {
        it('simplifies names in hierarchy tree', async () => {
          const longName = assertDefined(this.treeNodeLongName);
          const shortName = assertDefined(this.treeNodeShortName);
          const userOptions: UserOptions = {
            simplifyNames: {
              name: 'Simplify names',
              enabled: false,
            },
          };

          await presenter.onAppEvent(this.getPositionUpdate());
          const longNameFilter = makeNodeFilter(
            new TextFilter(longName).getFilterPredicate(),
          );
          let nodeWithLongName = assertDefined(
            assertDefined(uiData.hierarchyNodes).find((row) =>
              longNameFilter(row.node),
            ),
          ).node;
          expect(nodeWithLongName.getDisplayName()).toEqual(shortName);
          presenter.onPinnedItemChange(nodeWithLongName);
          expect(uiData.pinnedItems).toEqual([nodeWithLongName]);

          await presenter.onHierarchyUserOptionsChange(userOptions);
          expect(uiData.hierarchyUserOptions).toEqual(userOptions);
          nodeWithLongName = assertDefined(
            assertDefined(uiData.hierarchyNodes).find((row) =>
              longNameFilter(row.node),
            ),
          ).node;
          expect(longName).toContain(nodeWithLongName.getDisplayName());
          expect(uiData.pinnedItems).toEqual([nodeWithLongName]);
        });
      }

      if (this.shouldExecutePlaybackTests) {
        it('sets showDiff button as unavailable during playback', async () => {
          await presenter.onAppEvent(this.getPositionUpdate());
          const selectedId = this.getSelectedTreeAfterPositionUpdate().id;
          await presenter.onHighlightedIdChange(selectedId);

          const playbackPresenter = PlaybackPresenter.prototype;
          expect(playbackPresenter).toBeDefined();

          const isPlayingSpy = spyOn(playbackPresenter, 'isPlaying');
          isPlayingSpy.and.returnValue(true);

          expect(
            uiData.propertiesUserOptions?.['showDiff']?.isUnavailable,
          ).toBeTrue();
        });

        it("doesn't update properties tree onHighlightedIdChange if playback is playing", async () => {
          await presenter.onAppEvent(this.getPositionUpdate());
          const node = this.getSelectedTreeAfterPositionUpdate();
          expect(uiData.propertyNodes).toBeUndefined();
          spyOn(PlaybackPresenter.prototype, 'isPlaying').and.returnValue(true);

          await presenter.onHighlightedIdChange(node.id);
          expect(uiData.propertyNodes).toBeUndefined();
        });

        it("doesn't update properties tree onHighlightedNodeChange if playback is playing", async () => {
          await presenter.onAppEvent(this.getPositionUpdate());
          const node = this.getSelectedTreeAfterPositionUpdate();
          expect(uiData.propertyNodes).toBeUndefined();
          spyOn(PlaybackPresenter.prototype, 'isPlaying').and.returnValue(true);

          await presenter.onHighlightedNodeChange(node);
          expect(uiData.propertyNodes).toBeUndefined();
        });

        it("doesn't update properties tree on trace position update if playback is playing", async () => {
          await presenter.onAppEvent(this.getPositionUpdate());
          const node = this.getSelectedTreeAfterPositionUpdate();
          await presenter.onHighlightedIdChange(node.id);
          expect(uiData.propertyNodes).toBeDefined();
          const prevProperties = uiData.propertyNodes;
          spyOn(PlaybackPresenter.prototype, 'isPlaying').and.returnValue(true);

          await presenter.onAppEvent(
            assertDefined(this.getSecondPositionUpdate()),
          );
          expect(uiData.propertyNodes).toEqual(prevProperties);
        });

        it('initializes playback when a PlaybackStart event is received', async () => {
          const traceGeometryData = new TraceGeometryData(
            new Map([[0n, new Rect(0, 0, 0, 0)]]),
            new Map([[0n, new TransformMatrix(1, 1, 1, 1, 1, 1)]]),
          );
          const playbackPresenterSpy = spyOn(
            PlaybackPresenter.prototype,
            'play',
          ).and.returnValue(Promise.resolve());
          const event = new PlaybackStateChangePropagate(
            PlaybackState.FORWARDS,
            0,
            traceGeometryData,
          );
          await presenter.onAppEvent(event);
          expect(playbackPresenterSpy).toHaveBeenCalled();
          expect(uiData.isPlaybackInitializing).toEqual(true);
        });

        it('changes uiData state on PlaybackHandled', async () => {
          let event = new PlaybackStateChangeHandled(
            PlaybackState.FORWARDS,
            TraceType.SURFACE_FLINGER,
          );
          await presenter.onAppEvent(event);
          expect(uiData.isPlaybackPlaying).toEqual(true);
          expect(uiData.isPlaybackInitializing).toEqual(false);

          event = new PlaybackStateChangeHandled(
            PlaybackState.PAUSED,
            TraceType.SURFACE_FLINGER,
          );
          await presenter.onAppEvent(event);
          expect(uiData.isPlaybackPlaying).toEqual(false);
        });

        it('pauses playback when a PlaybackPause event is received', async () => {
          const playbackPresenterSpy = spyOn(
            PlaybackPresenter.prototype,
            'pause',
          );
          const event = new PlaybackStateChangeRequest(
            TraceType.SURFACE_FLINGER,
            PlaybackState.PAUSED,
          );
          await presenter.onAppEvent(event);
          expect(playbackPresenterSpy).toHaveBeenCalled();
        });

        it('changes playback speed when a PlaybackSpeedChange event is received', async () => {
          const playbackPresenterSpy = spyOn(
            PlaybackPresenter.prototype,
            'changeSpeed',
          );
          const event = new PlaybackSpeedChange(TraceType.SURFACE_FLINGER, 2);
          await presenter.onAppEvent(event);
          expect(playbackPresenterSpy).toHaveBeenCalled();
        });
      }

      function chipEqualityTester(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        first: any,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        second: any,
      ): boolean | undefined {
        if (first instanceof Chip || second instanceof Chip) {
          return (
            first.short === second.short &&
            first.long === second.long &&
            first.type === second.type
          );
        }
        return undefined;
      }
    });

    if (this.executeSpecializedTests) {
      this.executeSpecializedTests();
    }
  }

  abstract readonly shouldExecuteRectTests: boolean;
  abstract readonly shouldExecuteSimplifyNamesTest: boolean;
  abstract readonly keepCalculatedPropertiesInChild: boolean;
  abstract readonly shouldExecutePlaybackTests: boolean;
  abstract readonly keepCalculatedPropertiesInRoot: boolean;
  abstract readonly expectedHierarchyOpts: UserOptions;
  abstract readonly expectedPropertiesOpts: UserOptions;

  readonly rectIndex?: number;
  readonly expectedInitialRectSpec?: RectSpec;
  readonly expectedRectsOpts?: UserOptions;
  readonly treeNodeLongName?: string;
  readonly treeNodeShortName?: string;

  abstract setUpTestEnvironment(): Promise<void>;
  abstract createPresenter(
    callback: NotifyHierarchyViewCallbackType<UiData>,
    storage: Store,
  ): AbstractHierarchyViewerPresenter<UiData>;
  abstract createPresenterWithEmptyTrace(
    callback: NotifyHierarchyViewCallbackType<UiData>,
  ): AbstractHierarchyViewerPresenter<UiData>;
  abstract getPositionUpdate(): TracePositionUpdate;
  abstract getSecondPositionUpdate(): TracePositionUpdate | undefined;
  abstract getSelectedTree(): UiHierarchyTreeNode;
  abstract getSelectedTreeAfterPositionUpdate(): UiHierarchyTreeNode;
  abstract executePropertiesChecksAfterPositionUpdate(
    uiData: UiDataHierarchy,
  ): void;

  executeSpecializedChecksForPropertiesFromRect?(uiData: UiDataHierarchy): void;
  executePropertiesChecksAfterSecondPositionUpdate?(
    uiData: UiDataHierarchy,
  ): void;
  executeSpecializedTests?(): void;
}
