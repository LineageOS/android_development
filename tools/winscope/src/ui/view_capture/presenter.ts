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

import {assertDefined, assertTrue} from '@common/assert';
import {createPersistentStoreProxy} from '@common/store/persistent_store_proxy';
import {Store} from '@common/store/store';
import {WinscopeEvent} from '@messaging/winscope_event';
import {CustomQueryType} from '@trace_api/custom_query';
import {Trace} from '@trace_api/trace';
import {findCorrespondingEntry} from '@trace_api/trace_entry_finder';
import {ActiveTraceChanged, TracePositionUpdate} from '@trace_api/trace_events';
import {TRACE_INFO} from '@trace_api/trace_info';
import {TraceType} from '@trace_api/trace_type';
import {Traces} from '@trace_api/traces';
import {HierarchyTreeNode} from '@tree_node/hierarchy_tree_node';
import {PropertyTreeNode} from '@tree_node/property_tree_node';
import {TabbedViewSwitchRequest} from '@ui/shared/events/tabbed_view_events';
import {AbstractHierarchyViewerPresenter, NotifyHierarchyViewCallbackType,} from '@ui/shared/hierarchy/abstract_hierarchy_viewer_presenter';
import {HierarchyPresenter} from '@ui/shared/hierarchy/hierarchy_presenter';
import {UiHierarchyTreeNode} from '@ui/shared/hierarchy/ui_hierarchy_tree_node';
import {VcCuratedProperties} from '@ui/shared/properties/curated_properties';
import {PropertiesPresenter} from '@ui/shared/properties/properties_presenter';
import {DisplayIdentifier} from '@ui/shared/rects/display_identifier';
import {RectLegendFactory, TraceRectType} from '@ui/shared/rects/rect_spec';
import {RectsPresenter} from '@ui/shared/rects/rects_presenter';
import {UiRect} from '@ui/shared/rects/ui_rect';
import {makeUiRects, makeVcUiRects} from '@ui/shared/rects/ui_rect_factory';
import {VISIBLE_CHIP} from '@ui/shared/user_input/chip';
import {TextFilter} from '@ui/shared/user_input/text_filter';
import {UserOptions} from '@ui/shared/user_input/user_options';

import {SimplifyNamesVc} from './operations/simplify_names';
import {UiData} from './ui_data';

export class Presenter extends AbstractHierarchyViewerPresenter<UiData> {
  static readonly DENYLIST_PROPERTY_NAMES = ['children', 'isComputedVisible'];

  private windowNames: string[] = [];
  protected override hierarchyPresenter = new HierarchyPresenter(
    createPersistentStoreProxy<UserOptions>(
      'VcHierarchyOptions',
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
      },
      this.storage,
    ),
    new TextFilter(),
    Presenter.DENYLIST_PROPERTY_NAMES,
    false,
    true,
    undefined,
    undefined,
    new SimplifyNamesVc(),
  );
  protected override rectsPresenter = new RectsPresenter(
    createPersistentStoreProxy<UserOptions>(
      'VcRectsOptions',
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
    (tree: HierarchyTreeNode, trace: Trace<HierarchyTreeNode>) =>
      makeVcUiRects(tree, this.getIdFromViewCaptureTrace(trace)),
    undefined,
  );
  protected override propertiesPresenter = new PropertiesPresenter(
    createPersistentStoreProxy<UserOptions>(
      'VcPropertyOptions',
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
  );
  protected override readonly multiTraceType = TraceType.VIEW_CAPTURE;

  private readonly surfaceFlingerTrace: Trace<HierarchyTreeNode> | undefined;
  private readonly viewCaptureTraces: Array<Trace<HierarchyTreeNode>>;

  private viewCapturePackageNames: string[] = [];
  private sfRects: UiRect[] | undefined;
  private sfClickedRectId: string | undefined;
  private curatedProperties: VcCuratedProperties | undefined;

  constructor(
    traces: Traces,
    storage: Readonly<Store>,
    notifyViewCallback: NotifyHierarchyViewCallbackType<UiData>,
  ) {
    const uiData = new UiData();
    uiData.rectSpec = {
      type: TraceRectType.VIEWS,
      icon: TRACE_INFO[TraceType.VIEW_CAPTURE].icon,
      legend: RectLegendFactory.makeLegendForViewRects(),
    };
    super(undefined, traces, storage, notifyViewCallback, uiData);
    this.viewCaptureTraces = traces.getTraces(TraceType.VIEW_CAPTURE);
    this.surfaceFlingerTrace = traces.getTrace(TraceType.SURFACE_FLINGER);
  }

  async onMiniRectsDoubleClick() {
    if (!this.surfaceFlingerTrace) {
      return;
    }
    await this.emitWinscopeEvent(
      new TabbedViewSwitchRequest(this.surfaceFlingerTrace),
    );
  }

  protected override async onViewerSpecificWinscopeEvent(event: WinscopeEvent) {
    switch (event.constructor) {
      case ActiveTraceChanged:
        return await this.onActiveTraceChanged(event as ActiveTraceChanged);
      default:
        this.logger.trace('Not processing event ' + event.constructor.name);
    }
  }

  getTraces(): Array<Trace<HierarchyTreeNode>> {
    return this.viewCaptureTraces;
  }

  override async onHighlightedNodeChange(node: UiHierarchyTreeNode) {
    await this.applyHighlightedNodeChange(node);
    this.updateCuratedProperties();
    this.refreshUIData();
  }

  override async onHighlightedIdChange(newId: string) {
    await this.applyHighlightedIdChange(newId);
    this.updateCuratedProperties();
    this.refreshUIData();
  }

  protected override getOverrideDisplayName(): undefined {
    return undefined;
  }

  protected override keepCalculated(node: UiHierarchyTreeNode): boolean {
    return node.isRoot();
  }

  protected override async initializeIfNeeded() {
    await this.initializePackageNamesIfNeeded();
    await this.initializeWindowsIfNeeded();
  }

  protected override async processDataAfterPositionUpdate(
    event: TracePositionUpdate,
  ): Promise<void> {
    if (this.uiData && this.surfaceFlingerTrace) {
      const surfaceFlingerEntry = (await findCorrespondingEntry(
        this.surfaceFlingerTrace,
        event.position,
      )?.getValue()) as HierarchyTreeNode;
      if (surfaceFlingerEntry) {
        const sfRects = makeUiRects(
          surfaceFlingerEntry,
          this.viewCapturePackageNames,
        );
        const clickedRect = sfRects.find(
          (rect) => rect.id === this.sfClickedRectId,
        );
        if (clickedRect) {
          this.sfRects = sfRects.filter(
            (r) => r.groupId === clickedRect.groupId,
          );
        } else {
          this.sfRects = sfRects;
        }
      }
    }
    this.updateCuratedProperties();
  }

  protected override refreshUIData() {
    this.uiData.sfRects = this.sfRects;
    this.uiData.curatedProperties = this.curatedProperties;
    this.refreshHierarchyViewerUiData();
  }

  private async initializePackageNamesIfNeeded() {
    if (this.viewCapturePackageNames.length > 0) {
      return;
    }

    const promisesPackageName = this.viewCaptureTraces.map(async (trace) => {
      const packageAndWindow = await trace.customQuery(
        CustomQueryType.VIEW_CAPTURE_METADATA,
      );
      return packageAndWindow.packageName;
    });

    this.viewCapturePackageNames = await Promise.all(promisesPackageName);
  }

  private async initializeWindowsIfNeeded() {
    if (this.rectsPresenter.getDisplays().length > 0) {
      return;
    }

    const shortenAndCapitalizeWindowName = (name: string) => {
      const lastDot = name.lastIndexOf('.');
      if (lastDot !== -1) {
        name = name.substring(lastDot + 1);
      }
      if (name.length > 0) {
        name = name[0].toUpperCase() + name.slice(1);
      }
      return name;
    };

    const promisesWindowName = this.viewCaptureTraces.map(async (trace) => {
      const packageAndWindow = await trace.customQuery(
        CustomQueryType.VIEW_CAPTURE_METADATA,
      );
      return shortenAndCapitalizeWindowName(packageAndWindow.windowName);
    });
    this.windowNames = await Promise.all(promisesWindowName);
    this.rectsPresenter.setDisplays(this.getWindows(this.windowNames));
  }

  private getWindows(windowNames: string[]): DisplayIdentifier[] {
    return this.viewCaptureTraces.map((trace, i) => {
      const traceId = this.getIdFromViewCaptureTrace(trace);
      return {
        displayId: traceId,
        groupId: traceId,
        name: windowNames[i],
        isActive: true,
      };
    });
  }

  private updateCuratedProperties() {
    const propertiesTree = this.propertiesPresenter.getPropertiesTree();
    if (propertiesTree) {
      this.curatedProperties = this.getCuratedProperties(propertiesTree);
    } else {
      this.curatedProperties = undefined;
    }
  }

  private getCuratedProperties(tree: PropertyTreeNode): VcCuratedProperties {
    const curated: VcCuratedProperties = {
      className: tree.name,
      hashcode: assertDefined(tree.getChildByName('hashcode')).formattedValue(),
      viewId: assertDefined(tree.getChildByName('viewId')).formattedValue(),
      contentDescription:
        tree.getChildByName('contentDescription')?.formattedValue() ?? 'null',
      text: tree.getChildByName('text')?.formattedValue() ?? 'null',
      left: assertDefined(tree.getChildByName('left')).formattedValue(),
      top: assertDefined(tree.getChildByName('top')).formattedValue(),
      elevation: assertDefined(
        tree.getChildByName('elevation'),
      ).formattedValue(),
      height: assertDefined(tree.getChildByName('height')).formattedValue(),
      width: assertDefined(tree.getChildByName('width')).formattedValue(),
      translationX: assertDefined(
        tree.getChildByName('translationX'),
      ).formattedValue(),
      translationY: assertDefined(
        tree.getChildByName('translationY'),
      ).formattedValue(),
      scrollX: assertDefined(tree.getChildByName('scrollX')).formattedValue(),
      scrollY: assertDefined(tree.getChildByName('scrollY')).formattedValue(),
      scaleX: assertDefined(tree.getChildByName('scaleX')).formattedValue(),
      scaleY: assertDefined(tree.getChildByName('scaleY')).formattedValue(),
      visibility: assertDefined(
        tree.getChildByName('visibility'),
      ).formattedValue(),
      alpha: assertDefined(tree.getChildByName('alpha')).formattedValue(),
      willNotDraw: assertDefined(
        tree.getChildByName('willNotDraw'),
      ).formattedValue(),
      clipChildren: assertDefined(
        tree.getChildByName('clipChildren'),
      ).formattedValue(),
    };
    return curated;
  }

  private getIdFromViewCaptureTrace(trace: Trace<HierarchyTreeNode>): number {
    const index = this.viewCaptureTraces.indexOf(trace);
    assertTrue(index !== -1);
    return index;
  }

  private async onActiveTraceChanged(event: ActiveTraceChanged) {
    const metadata = event.metadata as ActiveTraceMetadata | undefined;
    if (metadata?.sfRectId) {
      this.sfClickedRectId = metadata.sfRectId;
    }
  }
}

interface ActiveTraceMetadata {
  sfRectId: string;
}
