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
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import {assertDefined} from '@common/assert';
import {createPersistentStoreProxy} from '@common/store/persistent_store_proxy';
import {Store} from '@common/store/store';
import {Trace} from '@trace_api/trace';
import {TRACE_INFO} from '@trace_api/trace_info';
import {TraceType} from '@trace_api/trace_type';
import {Traces} from '@trace_api/traces';
import {HierarchyTreeNode} from '@tree_node/hierarchy_tree_node';
import {AbstractHierarchyViewerPresenter, NotifyHierarchyViewCallbackType,} from '@ui/shared/hierarchy/abstract_hierarchy_viewer_presenter';
import {HierarchyPresenter, SelectedTree,} from '@ui/shared/hierarchy/hierarchy_presenter';
import {UiHierarchyTreeNode} from '@ui/shared/hierarchy/ui_hierarchy_tree_node';
import {PlaybackPresenter} from '@ui/shared/playback/playback_presenter';
import {PropertiesPresenter} from '@ui/shared/properties/properties_presenter';
import {UiPropertyTreeNode} from '@ui/shared/properties/ui_property_tree_node';
import {DisplayIdentifier} from '@ui/shared/rects/display_identifier';
import {RectLegendFactory, TraceRectType} from '@ui/shared/rects/rect_spec';
import {RectsPresenter} from '@ui/shared/rects/rects_presenter';
import {UiRect} from '@ui/shared/rects/ui_rect';
import {makeUiRects} from '@ui/shared/rects/ui_rect_factory';
import {VISIBLE_CHIP} from '@ui/shared/user_input/chip';
import {TextFilter} from '@ui/shared/user_input/text_filter';
import {UserOptions} from '@ui/shared/user_input/user_options';
import {PropagateHashCodes} from '@ui/window_manager/operations/propagate_hash_codes';

import {UiData} from './ui_data';

export class Presenter extends AbstractHierarchyViewerPresenter<UiData> {
  static readonly DENYLIST_PROPERTY_NAMES = [
    'name',
    'children',
    'dpiX',
    'dpiY',
  ];

  protected override hierarchyPresenter = new HierarchyPresenter(
    createPersistentStoreProxy<UserOptions>(
      'WmHierarchyOptions',
      {
        showDiff: {
          name: 'Show diff',
          enabled: false,
          isUnavailable: false,
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
      },
      this.storage,
    ),
    new TextFilter(),
    Presenter.DENYLIST_PROPERTY_NAMES,
    true,
    false,
    this.getEntryFormattedTimestamp,
  );
  protected override rectsPresenter = new RectsPresenter(
    createPersistentStoreProxy<UserOptions>(
      'WmRectsOptions',
      {
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
      },
      this.storage,
    ),
    (tree: HierarchyTreeNode) => makeUiRects(tree),
    this.getDisplays,
    this.convertRectIdtoContainerName,
  );
  protected override propertiesPresenter = new PropertiesPresenter(
    createPersistentStoreProxy<UserOptions>(
      'WmPropertyOptions',
      {
        showDiff: {
          name: 'Show diff',
          enabled: false,
          isUnavailable: false,
        },
        showDefaults: {
          name: 'Show defaults',
          enabled: false,
          tooltip: `If checked, shows the value of all properties.
Otherwise, hides all properties whose value is
the default for its data type.`,
        },
      },
      this.storage,
    ),
    new TextFilter(),
    Presenter.DENYLIST_PROPERTY_NAMES,
    [new PropagateHashCodes()],
  );
  protected override multiTraceType = undefined;
  protected override playbackPresenter = new PlaybackPresenter(
    (event) => {
      return this.emitWinscopeEvent(event);
    },
    assertDefined(this.traces.getTrace(TraceType.WINDOW_MANAGER)),
  );

  constructor(
    trace: Trace<HierarchyTreeNode>,
    traces: Traces,
    storage: Readonly<Store>,
    notifyViewCallback: NotifyHierarchyViewCallbackType<UiData>,
  ) {
    const uiData = new UiData();
    uiData.rectSpec = {
      type: TraceRectType.WINDOW_STATES,
      icon: TRACE_INFO[TraceType.WINDOW_MANAGER].icon,
      legend: RectLegendFactory.makeLegendForWindowStateRects(),
    };
    super(trace, traces, storage, notifyViewCallback, uiData);
  }

  async onPropagatePropertyClick(node: UiPropertyTreeNode) {
    if (node.name !== 'hashCode') {
      return;
    }
    const token = (node.getValue<number>() ?? 0).toString(16);
    const target = this.uiData.hierarchyNodes?.find((node) =>
      node.node.id.includes(token),
    );
    if (target) {
      await this.onHighlightedNodeChange(target.node as UiHierarchyTreeNode);
    }
  }

  override async onHighlightedNodeChange(item: UiHierarchyTreeNode) {
    await this.applyHighlightedNodeChange(item);
    this.refreshUIData();
  }

  override async onHighlightedIdChange(newId: string) {
    await this.applyHighlightedIdChange(newId);
    this.refreshUIData();
  }

  protected override getOverrideDisplayName(
    selected: SelectedTree,
  ): string | undefined {
    if (!selected.tree.isRoot()) {
      return undefined;
    }
    return this.hierarchyPresenter
      .getCurrentHierarchyTreeNames(selected.trace)
      ?.at(0);
  }

  protected override keepCalculated(_: HierarchyTreeNode): boolean {
    return false;
  }

  protected override refreshUIData() {
    this.refreshHierarchyViewerUiData();
  }

  private getDisplays(rects: UiRect[]): DisplayIdentifier[] {
    const ids: DisplayIdentifier[] = [];
    rects.forEach((rect: UiRect) => {
      if (!rect.isDisplay) return;
      const displayName = rect.label.slice(10, rect.label.length);
      ids.push({
        displayId: rect.id,
        groupId: rect.groupId,
        name: displayName,
        isActive: rect.isActiveDisplay,
      });
    });
    return ids.sort();
  }

  private convertRectIdtoContainerName(id: string) {
    const parts = id.split(' ');
    return parts.slice(2).join(' ');
  }
}
