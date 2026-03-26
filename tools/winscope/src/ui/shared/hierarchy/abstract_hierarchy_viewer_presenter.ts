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
import {parseMap, stringifyMap} from '@common/store/persistent_store_proxy';
import {Store} from '@common/store/store';
import {getLogger, Logger} from '@compat/logging';
import {Analytics} from '@logging/analytics';
import {WinscopeEvent} from '@messaging/winscope_event';
import {EmitEvent} from '@messaging/winscope_event_emitter';
import {TraceGeometryData} from '@parsers/helpers/trace_geometry_data';
import {Trace, TraceEntry} from '@trace_api/trace';
import {findCorrespondingEntry} from '@trace_api/trace_entry_finder';
import {ScreenRecordingChange, TracePositionUpdate,} from '@trace_api/trace_events';
import {TRACE_INFO} from '@trace_api/trace_info';
import {TraceType} from '@trace_api/trace_type';
import {Traces} from '@trace_api/traces';
import {MediaBasedTraceEntry} from '@trace/media_based/media_based_trace_entry';
import {DataHierarchyTreeNode, HierarchyTreeNode,} from '@tree_node/hierarchy_tree_node';
import {PropertyTreeNode} from '@tree_node/property_tree_node';
import {DarkModeToggled, FilterPresetApplyRequest, FilterPresetSaveRequest,} from '@ui/shared/events/misc_events';
import {PlaybackSpeedChange, PlaybackStateChangeHandled, PlaybackStateChangeRequest,} from '@ui/shared/playback/events';
import {PlaybackPresenter} from '@ui/shared/playback/playback_presenter';
import {PlaybackState} from '@ui/shared/playback/playback_state';
import {PropertiesPresenter} from '@ui/shared/properties/properties_presenter';
import {UiPropertyTreeNode} from '@ui/shared/properties/ui_property_tree_node';
import {RectShowState} from '@ui/shared/rects/rect_show_state';
import {RectsPresenter} from '@ui/shared/rects/rects_presenter';
import {FlattenedTreeRow} from '@ui/shared/tree/flattened_tree_row';
import {flattenNodesToRows} from '@ui/shared/tree/ui_tree_node_helpers';
import {TextFilter} from '@ui/shared/user_input/text_filter';
import {UserOption, UserOptions} from '@ui/shared/user_input/user_options';
import {PlaybackStateChangePropagate} from '@ui/timeline/playback_events';

import {HierarchyPresenter, HierarchyTraceEntry, SelectedTree,} from './hierarchy_presenter';
import {PresetHierarchy, TextFilterValues} from './preset_hierarchy';
import {UiDataHierarchy} from './ui_data_hierarchy';
import {UiHierarchyTreeNode} from './ui_hierarchy_tree_node';

export type NotifyHierarchyViewCallbackType<UiData> = (uiData: UiData) => void;

export abstract class AbstractHierarchyViewerPresenter<
  UiData extends UiDataHierarchy,
> {
  protected emitWinscopeEvent: EmitEvent = () => Promise.resolve();
  protected overridePropertiesTree: PropertyTreeNode | undefined;
  protected overridePropertiesTreeName: string | undefined;
  protected playbackPresenter?: PlaybackPresenter;
  protected rectsPresenter?: RectsPresenter;
  protected abstract hierarchyPresenter: HierarchyPresenter;
  protected abstract propertiesPresenter: PropertiesPresenter;
  protected abstract readonly multiTraceType?: TraceType;
  private highlightedItem = '';
  private screenRecordingTrace?: Trace<MediaBasedTraceEntry>;
  protected readonly logger: Logger;

  constructor(
    private readonly trace: Trace<HierarchyTreeNode> | undefined,
    protected readonly traces: Traces,
    protected readonly storage: Readonly<Store>,
    private readonly notifyViewCallback: NotifyHierarchyViewCallbackType<UiData>,
    protected readonly uiData: UiData,
  ) {
    this.logger = getLogger('AbstractHierarchyViewerPresenter');
    uiData.isDarkMode = storage.get('dark-mode') === 'true';
    this.notifyViewChanged();
  }

  onDestroy() {
    this.playbackPresenter?.onDestroy();
  }

  setEmitEvent(callback: EmitEvent) {
    this.emitWinscopeEvent = callback;
  }

  notifyViewChanged() {
    // Create a shallow copy of the data, otherwise the Angular OnPush change detection strategy
    // won't detect the new input
    const copy = Object.assign({}, this.uiData);
    this.notifyViewCallback(copy);
  }

  onPinnedItemChange(pinnedItem: UiHierarchyTreeNode) {
    this.hierarchyPresenter.applyPinnedItemChange(pinnedItem);
    this.uiData.pinnedItems = this.hierarchyPresenter.getPinnedItems();
    this.notifyViewChanged();
  }

  onHighlightedPropertyChange(id: string) {
    this.propertiesPresenter.applyHighlightedPropertyChange(id);
    this.uiData.highlightedProperty =
      this.propertiesPresenter.getHighlightedProperty();
    this.notifyViewChanged();
  }

  onRectsUserOptionsChange(userOptions: UserOptions) {
    if (!this.rectsPresenter) {
      return;
    }
    this.rectsPresenter.applyRectsUserOptionsChange(userOptions);

    this.uiData.rectsUserOptions = this.rectsPresenter.getUserOptions();
    this.uiData.rectsToDraw = this.rectsPresenter.getRectsToDraw();
    this.uiData.rectIdToShowState = this.rectsPresenter.getRectIdToShowState();

    this.notifyViewChanged();
  }

  async onHierarchyUserOptionsChange(userOptions: UserOptions) {
    await this.hierarchyPresenter.applyHierarchyUserOptionsChange(userOptions);
    this.uiData.hierarchyUserOptions = this.hierarchyPresenter.getUserOptions();
    this.uiData.hierarchyNodes = this.flattenHierarchies();
    this.uiData.pinnedItems = this.hierarchyPresenter.getPinnedItems();
    this.notifyViewChanged();
  }

  async onHierarchyFilterChange(textFilter: TextFilter) {
    await this.hierarchyPresenter.applyHierarchyFilterChange(textFilter);
    this.uiData.hierarchyNodes = this.flattenHierarchies();
    this.uiData.pinnedItems = this.hierarchyPresenter.getPinnedItems();
    this.notifyViewChanged();
  }

  async onPropertiesUserOptionsChange(userOptions: UserOptions) {
    this.propertiesPresenter.applyPropertiesUserOptionsChange(userOptions);
    await this.updatePropertiesTree();
    this.uiData.propertiesUserOptions =
      this.propertiesPresenter.getUserOptions();
    this.uiData.propertyNodes = this.flattenProperties();
    this.notifyViewChanged();
  }

  async onPropertiesFilterChange(textFilter: TextFilter) {
    this.propertiesPresenter.applyPropertiesFilterChange(textFilter);
    await this.updatePropertiesTree();
    this.uiData.propertyNodes = this.flattenProperties();
    this.notifyViewChanged();
  }

  async onRectShowStateChange(id: string, newShowState: RectShowState) {
    if (!this.rectsPresenter) {
      return;
    }
    this.rectsPresenter.applyRectShowStateChange(id, newShowState);

    this.uiData.rectsToDraw = this.rectsPresenter.getRectsToDraw();
    this.uiData.rectIdToShowState = this.rectsPresenter.getRectIdToShowState();
    this.notifyViewChanged();
  }

  private async onTracePositionUpdate(event: TracePositionUpdate) {
    if (this.initializeIfNeeded) await this.initializeIfNeeded(event);
    await this.applyTracePositionUpdate(event);
    if (this.processDataAfterPositionUpdate) {
      await this.processDataAfterPositionUpdate(event);
    }
    this.refreshUIData();
  }

  private async onFilterPresetSaveRequest(event: FilterPresetSaveRequest) {
    this.saveConfigAsPreset(event.name);
  }

  private async onDarkModeToggled(event: DarkModeToggled) {
    this.uiData.isDarkMode = event.isDarkMode;
    this.notifyViewChanged();
  }

  private async onFilterPresetApplyRequest(event: FilterPresetApplyRequest) {
    const filterPresetName = event.name;
    await this.applyPresetConfig(filterPresetName);
    this.refreshUIData();
  }

  private async onPlaybackStateChangeRequest(
    event: PlaybackStateChangeRequest,
  ) {
    if (!this.trace) {
      return;
    }
    if (!this.screenRecordingTrace) {
      this.screenRecordingTrace = this.traces.getTrace(
        TraceType.SCREEN_RECORDING,
      );
    }

    switch (event.state) {
      case PlaybackState.PAUSED:
        if (this.playbackPresenter !== undefined) {
          await this.pausePlayback();
        }
        return;
      default:
        return;
    }
  }

  private async onPlaybackStateChangePropagate(
    event: PlaybackStateChangePropagate,
  ) {
    if (!this.trace || !this.playbackPresenter) {
      return;
    }
    if (!this.screenRecordingTrace) {
      this.screenRecordingTrace = this.traces.getTrace(
        TraceType.SCREEN_RECORDING,
      );
    }
    this.uiData.isPlaybackInitializing = true;
    this.refreshHierarchyViewerUiData();
    await this.playPlayback(
      assertDefined(event.currentTraceIndex),
      event.state,
      event.traceGeometryData,
      this.screenRecordingTrace,
    );
  }

  private async onPlaybackStateChangeHandled(
    event: PlaybackStateChangeHandled,
  ) {
    if (event.stateToReflect === PlaybackState.PAUSED) {
      this.uiData.isPlaybackPlaying = false;
    } else {
      this.uiData.isPlaybackPlaying = true;
    }
    this.uiData.isPlaybackInitializing = false;

    this.refreshHierarchyViewerUiData();
  }

  private async onPlaybackSpeedChange(event: PlaybackSpeedChange) {
    if (this.playbackPresenter && this.trace) {
      this.playbackPresenter.changeSpeed(event.speedValue);
    }
  }

  private async onScreenRecordingChange(event: ScreenRecordingChange) {
    this.screenRecordingTrace = event.trace;
  }

  async onAppEvent(event: WinscopeEvent) {
    switch (event.constructor) {
      case TracePositionUpdate:
        return await this.onTracePositionUpdate(event as TracePositionUpdate);
      case FilterPresetSaveRequest:
        return await this.onFilterPresetSaveRequest(
          event as FilterPresetSaveRequest,
        );
      case DarkModeToggled:
        return await this.onDarkModeToggled(event as DarkModeToggled);
      case FilterPresetApplyRequest:
        return await this.onFilterPresetApplyRequest(
          event as FilterPresetApplyRequest,
        );
      case PlaybackStateChangeRequest:
        return await this.onPlaybackStateChangeRequest(
          event as PlaybackStateChangeRequest,
        );
      case PlaybackStateChangePropagate:
        return await this.onPlaybackStateChangePropagate(
          event as PlaybackStateChangePropagate,
        );
      case PlaybackStateChangeHandled:
        return await this.onPlaybackStateChangeHandled(
          event as PlaybackStateChangeHandled,
        );
      case PlaybackSpeedChange:
        return await this.onPlaybackSpeedChange(event as PlaybackSpeedChange);
      case ScreenRecordingChange:
        return await this.onScreenRecordingChange(
          event as ScreenRecordingChange,
        );
      default:
        this.logger.trace('Not processing event ' + event.constructor.name);
    }

    await this.onViewerSpecificWinscopeEvent(event);
  }

  protected async onViewerSpecificWinscopeEvent(_: WinscopeEvent) {
    // do nothing
  }

  protected saveConfigAsPreset(storeKey: string) {
    const preset: PresetHierarchy = {
      hierarchyUserOptions: this.uiData.hierarchyUserOptions,
      hierarchyFilter: TextFilterValues.fromTextFilter(
        this.uiData.hierarchyFilter,
      ),
      propertiesUserOptions: this.uiData.propertiesUserOptions,
      propertiesFilter: TextFilterValues.fromTextFilter(
        this.uiData.propertiesFilter,
      ),
      rectsUserOptions: this.uiData.rectsUserOptions,
      rectIdToShowState: this.uiData.rectIdToShowState,
    };
    this.storage.add(storeKey, JSON.stringify(preset, stringifyMap));
  }

  protected async applyPresetConfig(storeKey: string) {
    const preset = this.storage.get(storeKey);
    if (preset) {
      const parsedPreset: PresetHierarchy = JSON.parse(preset, parseMap);
      await this.hierarchyPresenter.applyHierarchyUserOptionsChange(
        parsedPreset.hierarchyUserOptions,
      );
      await this.hierarchyPresenter.applyHierarchyFilterChange(
        new TextFilter(
          parsedPreset.hierarchyFilter.filterString,
          parsedPreset.hierarchyFilter.flags,
        ),
      );

      this.propertiesPresenter.applyPropertiesUserOptionsChange(
        parsedPreset.propertiesUserOptions,
      );
      this.propertiesPresenter.applyPropertiesFilterChange(
        new TextFilter(
          parsedPreset.propertiesFilter.filterString,
          parsedPreset.propertiesFilter.flags,
        ),
      );
      await this.updatePropertiesTree();

      if (this.rectsPresenter) {
        this.rectsPresenter?.applyRectsUserOptionsChange(
          assertDefined(parsedPreset.rectsUserOptions),
        );
        this.rectsPresenter?.updateRectShowStates(
          parsedPreset.rectIdToShowState,
        );
      }
      this.refreshHierarchyViewerUiData();
    }
  }

  protected async applyTracePositionUpdate(event: TracePositionUpdate) {
    const hierarchyStartTime = Date.now();

    let entries: HierarchyTraceEntry[] = [];
    if (event.prefetchedEntries?.trace) {
      entries = [event.prefetchedEntries.trace];
    } else if (this.multiTraceType !== undefined) {
      entries = this.traces
        .getTraces(this.multiTraceType)
        .map((trace) => {
          return findCorrespondingEntry(trace, event.position) as
            | TraceEntry<HierarchyTreeNode>
            | undefined;
        })
        .filter((entry) => entry !== undefined);
    } else {
      const entry = findCorrespondingEntry(
        assertDefined(this.trace),
        event.position,
      );
      if (entry) entries.push(entry);
    }

    try {
      await this.hierarchyPresenter.applyTracePositionUpdate(
        entries,
        this.highlightedItem,
      );
      const showDiff = this.hierarchyPresenter.getUserOptions()['showDiff'];
      this.logFetchComponentData(hierarchyStartTime, 'hierarchy', showDiff);
    } catch (e) {
      this.hierarchyPresenter.clear();
      this.rectsPresenter?.clear();
      this.propertiesPresenter.clear();
      this.refreshHierarchyViewerUiData();
      throw e;
    }

    const propertiesOpts = this.propertiesPresenter.getUserOptions();
    const hasPreviousEntry = entries.some((e) => e.getIndex() > 0);
    if (
      propertiesOpts['showDiff']?.isUnavailable !== undefined &&
      !this.playbackPresenter?.isPlaying()
    ) {
      propertiesOpts['showDiff'].isUnavailable = !hasPreviousEntry;
    }

    const currentHierarchyTrees =
      this.hierarchyPresenter.getAllCurrentHierarchyTrees();

    const rectStartTime = Date.now();
    this.rectsPresenter?.applyHierarchyTreesChange(currentHierarchyTrees ?? []);
    this.logFetchComponentData(rectStartTime, 'rects');

    await this.updatePropertiesTree();
  }

  protected async applyHighlightedNodeChange(node: UiHierarchyTreeNode) {
    this.updateHighlightedItem(node.id);
    this.hierarchyPresenter.applyHighlightedNodeChange(node);
    await this.updatePropertiesTree();
  }

  protected async applyHighlightedIdChange(newId: string) {
    this.updateHighlightedItem(newId);
    this.hierarchyPresenter.applyHighlightedIdChange(newId);
    await this.updatePropertiesTree();
  }

  protected async updatePropertiesTree() {
    if (this.playbackPresenter?.isPlaying()) {
      return;
    }
    const showDiff = this.propertiesPresenter.getUserOptions()['showDiff'];
    const propertiesStartTime = Date.now();

    if (this.overridePropertiesTree) {
      this.propertiesPresenter.setPropertiesTree(this.overridePropertiesTree);
      await this.propertiesPresenter.formatPropertiesTree(
        undefined,
        this.overridePropertiesTreeName,
        false,
      );
      this.logFetchComponentData(propertiesStartTime, 'properties', showDiff);
      return;
    }
    const selected = this.hierarchyPresenter.getSelectedTree();
    if (selected) {
      const {trace, tree: selectedTree} = selected;
      const propertiesTree = await selectedTree.getAllProperties();
      if (
        showDiff?.enabled &&
        !this.hierarchyPresenter.getPreviousHierarchyTreeForTrace(trace)
      ) {
        await this.hierarchyPresenter.updatePreviousHierarchyTrees();
      }
      const previousTree =
        this.hierarchyPresenter.getPreviousHierarchyTreeForTrace(trace);
      this.propertiesPresenter.setPropertiesTree(propertiesTree);
      await this.propertiesPresenter.formatPropertiesTree(
        previousTree,
        this.getOverrideDisplayName(selected),
        this.keepCalculated(selectedTree),
        trace.type,
      );
      this.logFetchComponentData(propertiesStartTime, 'properties', showDiff);
    } else {
      this.propertiesPresenter.clear();
    }
  }

  protected updateHighlightedItem(id: string) {
    if (this.highlightedItem === id) {
      this.highlightedItem = '';
    } else {
      this.highlightedItem = id;
    }
  }

  protected refreshHierarchyViewerUiData() {
    this.uiData.highlightedItem = this.highlightedItem;
    this.uiData.pinnedItems = this.hierarchyPresenter.getPinnedItems();
    this.uiData.hierarchyUserOptions = this.hierarchyPresenter.getUserOptions();
    this.uiData.hierarchyNodes = this.flattenHierarchies();
    this.uiData.hierarchyFilter = this.hierarchyPresenter.getTextFilter();

    if (!this.playbackPresenter || !this.playbackPresenter.isPlaying()) {
      this.uiData.propertiesUserOptions =
        this.propertiesPresenter.getUserOptions();
      this.uiData.propertyNodes = this.flattenProperties();
      this.uiData.highlightedProperty =
        this.propertiesPresenter.getHighlightedProperty();
      this.uiData.propertiesFilter = assertDefined(
        this.propertiesPresenter.getTextFilter(),
      );
    }

    if (this.rectsPresenter) {
      this.uiData.rectsToDraw = this.rectsPresenter?.getRectsToDraw();
      this.uiData.rectIdToShowState =
        this.rectsPresenter.getRectIdToShowState();
      this.uiData.displays = this.rectsPresenter.getDisplays();
      this.uiData.rectsUserOptions = this.rectsPresenter.getUserOptions();
    }

    this.notifyViewChanged();
  }

  protected getHighlightedItem(): string | undefined {
    return this.highlightedItem;
  }

  protected getEntryFormattedTimestamp(entry: HierarchyTraceEntry): string {
    if (entry.getFullTrace().isDumpWithoutTimestamp()) {
      return 'Dump';
    }
    return entry.getTimestamp().format();
  }

  private logFetchComponentData(
    startTimeMs: number,
    component: 'hierarchy' | 'properties' | 'rects',
    showDiffs?: UserOption,
  ) {
    const traceName =
      TRACE_INFO[this.trace?.type ?? assertDefined(this.multiTraceType)].name;
    Analytics.Navigation.logFetchComponentDataTime(
      component,
      traceName,
      showDiffs !== undefined && showDiffs.enabled && !showDiffs.isUnavailable,
      Date.now() - startTimeMs,
    );
  }

  private async playPlayback(
    currentPosition: number,
    requestedState: PlaybackState,
    traceGeometryData: TraceGeometryData,
    screenRecordingTrace: Trace<MediaBasedTraceEntry> | undefined,
  ) {
    this.hierarchyPresenter.setShowDiffAvailability(false);
    const playbackPresenter = assertDefined(this.playbackPresenter);
    playbackPresenter.setTraceGeometryData(traceGeometryData);
    playbackPresenter
      .play(currentPosition, requestedState, screenRecordingTrace)
      .catch((error) => {
        Analytics.Error.logPlaybackError(error.message);
      });
  }

  private async pausePlayback(): Promise<void> {
    this.hierarchyPresenter.setShowDiffAvailability(true);
    assertDefined(this.playbackPresenter).pause();
  }

  private flattenHierarchies():
    | Array<FlattenedTreeRow<UiHierarchyTreeNode>>
    | undefined {
    const trees = this.hierarchyPresenter.getAllFormattedTrees();
    if (!trees) {
      return undefined;
    }

    const addGutter =
      (this.rectsPresenter?.getRectIdToShowState()?.size ?? 0) > 0;
    return flattenNodesToRows(
      trees,
      !this.uiData.hierarchyUserOptions['flat']?.enabled,
      addGutter,
      this.highlightedItem,
    );
  }

  private flattenProperties():
    | Array<FlattenedTreeRow<UiPropertyTreeNode>>
    | undefined {
    const tree = this.propertiesPresenter.getFormattedTree();
    if (!tree) {
      return undefined;
    }
    return flattenNodesToRows(
      [tree],
      true,
      false,
      this.propertiesPresenter.getHighlightedProperty(),
    );
  }

  abstract onHighlightedNodeChange(node: UiHierarchyTreeNode): Promise<void>;
  abstract onHighlightedIdChange(id: string): Promise<void>;
  protected abstract keepCalculated(tree: DataHierarchyTreeNode): boolean;
  protected abstract getOverrideDisplayName(
    selected: SelectedTree,
  ): string | undefined;
  protected abstract refreshUIData(): void;
  protected initializeIfNeeded?(event: TracePositionUpdate): Promise<void>;
  protected processDataAfterPositionUpdate?(
    event: TracePositionUpdate,
  ): Promise<void>;
}
