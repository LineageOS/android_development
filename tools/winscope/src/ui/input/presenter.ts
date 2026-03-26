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

import {assertBigInt, assertDefined, assertStringOrUndefined,} from '@common/assert';
import {createPersistentStoreProxy} from '@common/store/persistent_store_proxy';
import {Store} from '@common/store/store';
import {Analytics} from '@logging/analytics';
import {CustomQueryType} from '@trace_api/custom_query';
import {Trace, TraceEntry, TraceEntryLazy} from '@trace_api/trace';
import {TRACE_INFO} from '@trace_api/trace_info';
import {TraceType} from '@trace_api/trace_type';
import {Traces} from '@trace_api/traces';
import {InputColumnType} from '@trace/input/input_column_type';
import {InputEventType} from '@trace/input/input_event_type';
import {HierarchyTreeNode} from '@tree_node/hierarchy_tree_node';
import {PropertyTreeNode} from '@tree_node/property_tree_node';
import {FormatDispatchEntry} from '@ui/input/operations/format_dispatch_entry';
import {TabbedViewSwitchRequest} from '@ui/shared/events/tabbed_view_events';
import {AbstractLogViewerPresenter, NotifyLogViewCallbackType,} from '@ui/shared/log/abstract_log_viewer_presenter';
import {LogSelectFilter} from '@ui/shared/log/log_filters';
import {LogPresenter} from '@ui/shared/log/log_presenter';
import {ClickableProperty, ColumnSpec, LogEntry, LogField, LogHeader,} from '@ui/shared/log/ui_data_log';
import {PropertiesPresenter} from '@ui/shared/properties/properties_presenter';
import {RectLegendFactory, TraceRectType} from '@ui/shared/rects/rect_spec';
import {RectsPresenter} from '@ui/shared/rects/rects_presenter';
import {makeInputRects} from '@ui/shared/rects/ui_rect_factory';
import {VISIBLE_CHIP} from '@ui/shared/user_input/chip';
import {TextFilter} from '@ui/shared/user_input/text_filter';
import {UserOptions} from '@ui/shared/user_input/user_options';
import {convertRectIdToLayerorDisplayName, makeDisplayIdentifiers,} from '@ui/surface_flinger/presenter';

import {InputEntry, UiData} from './ui_data';

export class Presenter extends AbstractLogViewerPresenter<
  UiData,
  HierarchyTreeNode
> {
  private static readonly COLUMNS = {
    type: {
      name: 'Type',
      cssClass: 'input-type inline',
      columnType: InputColumnType.EVENT_TYPE,
      canFilterBySingleOption: true,
    },
    source: {
      name: 'Source',
      cssClass: 'input-source',
      columnType: InputColumnType.SOURCE,
      canFilterBySingleOption: true,
    },
    action: {
      name: 'Action',
      cssClass: 'input-action',
      columnType: InputColumnType.ACTION,
      canFilterBySingleOption: true,
    },
    deviceId: {
      name: 'Device',
      cssClass: 'input-device-id right-align',
      columnType: InputColumnType.DEVICE_ID,
      canFilterBySingleOption: true,
    },
    displayId: {
      name: 'Display',
      cssClass: 'input-display-id right-align',
      columnType: InputColumnType.DISPLAY_ID,
      canFilterBySingleOption: true,
    },
    details: {
      name: 'Details',
      cssClass: 'input-details',
    },
    dispatchWindows: {
      name: 'Target Windows',
      cssClass: 'input-windows',
      columnType: InputColumnType.WINDOWS,
    },
  };
  private static readonly DENYLIST_DISPATCH_PROPERTIES = ['eventId'];

  private readonly traces: Traces;
  private readonly surfaceFlingerTrace: Trace<HierarchyTreeNode> | undefined;

  private readonly layerIdToName = new Map<number, string>();
  private readonly allInputLayerIds = new Set<number>();

  protected override logPresenter = new LogPresenter<InputEntry>();
  protected override propertiesPresenter = new PropertiesPresenter(
    {
      showDefaults: {
        name: 'Show defaults',
        enabled: true,
      },
    },
    new TextFilter(),
    [],
  );
  protected dispatchPropertiesPresenter = new PropertiesPresenter(
    {
      showDefaults: {
        name: 'Show defaults',
        enabled: true,
      },
    },
    new TextFilter(),
    Presenter.DENYLIST_DISPATCH_PROPERTIES,
    [new FormatDispatchEntry(this.layerIdToName)],
  );
  protected override keepCalculated = true;
  private readonly currentTargetWindowIds = new Set<string>();
  private currDispatchProperties: PropertyTreeNode | undefined;
  private lastClickedId: bigint | undefined;
  private lastClickedName: string | undefined;
  private shouldHandleSpecificClicks = false;
  private shouldHandleWindowPropertyHighlight = false;

  private readonly rectsPresenter: RectsPresenter;

  constructor(
    traces: Traces,
    mergedInputEventTrace: Trace<HierarchyTreeNode>,
    private readonly storage: Store,
    readonly notifyInputViewCallback: NotifyLogViewCallbackType<UiData>,
  ) {
    const uiData = UiData.createEmpty();
    uiData.isDarkMode = storage.get('dark-mode') === 'true';
    uiData.rectSpec = {
      type: TraceRectType.INPUT_WINDOWS,
      icon: TRACE_INFO[TraceType.INPUT_EVENT_MERGED].icon,
      legend: RectLegendFactory.makeLegendForInputWindowRects(false),
    };
    super(
      mergedInputEventTrace,
      (uiData) => notifyInputViewCallback(uiData as UiData),
      uiData,
    );
    this.traces = traces;
    this.surfaceFlingerTrace = this.traces.getTrace(TraceType.SURFACE_FLINGER);
    this.rectsPresenter = new RectsPresenter(
      createPersistentStoreProxy<UserOptions>(
        'InputWindowRectsOptions',
        {
          showOnlyWithContent: {
            name: 'Has input',
            icon: 'pan_tool_alt',
            enabled: false,
          },
          showOnlyVisible: {
            name: 'Show only',
            chip: VISIBLE_CHIP,
            enabled: true,
          },
        },
        this.storage,
      ),
      (tree: HierarchyTreeNode) => {
        return makeInputRects(
          tree,
          (id) => this.currentTargetWindowIds.has(id.split(' ')[0]),
          this.currDispatchProperties,
        );
      },
      makeDisplayIdentifiers,
      convertRectIdToLayerorDisplayName,
    );
  }

  async onDispatchPropertiesFilterChange(textFilter: TextFilter) {
    this.dispatchPropertiesPresenter.applyPropertiesFilterChange(textFilter);
    await this.updateDispatchPropertiesTree();
    this.uiData.dispatchPropertiesFilter = textFilter;
    this.notifyViewChanged();
  }

  onHighlightedPropertyChange(
    id: string,
    shouldHandleWindowPropertyHighlight: boolean,
  ) {
    this.shouldHandleWindowPropertyHighlight =
      shouldHandleWindowPropertyHighlight;
    if (
      this.uiData.highlightedProperty === id &&
      this.shouldHandleWindowPropertyHighlight
    ) {
      return;
    }
    this.propertiesPresenter.applyHighlightedPropertyChange(id);
    this.dispatchPropertiesPresenter.applyHighlightedPropertyChange(id);
    this.uiData.highlightedProperty =
      id === this.uiData.highlightedProperty ? '' : id;
    this.notifyViewChanged();
  }

  onTargetWindowClicked(windowId: bigint, windowName: string | undefined) {
    if (this.lastClickedId !== windowId) {
      this.lastClickedId = windowId;
      this.lastClickedName = windowName;
      this.shouldHandleSpecificClicks = true;
      this.shouldHandleWindowPropertyHighlight = true;
    }
  }

  async onHighlightedIdChange(id: string) {
    if (this.uiData.highlightedRect === id && this.shouldHandleSpecificClicks) {
      return;
    }
    this.uiData.highlightedRect = id === this.uiData.highlightedRect ? '' : id;
    await this.updateRects();
    this.notifyViewChanged();
  }

  async onRectsUserOptionsChange(userOptions: UserOptions) {
    this.rectsPresenter.applyRectsUserOptionsChange(userOptions);
    await this.updateRects();
    this.notifyViewChanged();
  }

  async onRectDoubleClick() {
    await this.emitAppEvent(
      new TabbedViewSwitchRequest(assertDefined(this.surfaceFlingerTrace)),
    );
  }

  protected override async initializeTraceSpecificData() {
    if (this.surfaceFlingerTrace !== undefined) {
      const layerMappings = await this.surfaceFlingerTrace.customQuery(
        CustomQueryType.SF_LAYERS_ID_AND_NAME,
      );
      layerMappings.forEach(({id, name}) => this.layerIdToName.set(id, name));
    }
  }

  protected override async handleSpecificEntryClicks() {
    if (!this.shouldHandleSpecificClicks) {
      return;
    }
    const id =
      assertStringOrUndefined(this.lastClickedId?.toString()) +
      ' ' +
      this.lastClickedName;
    this.onHighlightedIdChange(id);
    this.shouldHandleSpecificClicks = false;
  }

  protected override makeHeaders(): LogHeader[] {
    return [
      new LogHeader(
        Presenter.COLUMNS.type,
        new LogSelectFilter([], false, '80'),
      ),
      new LogHeader(
        Presenter.COLUMNS.source,
        new LogSelectFilter([], false, '200'),
      ),
      new LogHeader(
        Presenter.COLUMNS.action,
        new LogSelectFilter([], false, '100'),
      ),
      new LogHeader(
        Presenter.COLUMNS.deviceId,
        new LogSelectFilter([], false, '80'),
      ),
      new LogHeader(
        Presenter.COLUMNS.displayId,
        new LogSelectFilter([], false, '80'),
      ),
      new LogHeader(Presenter.COLUMNS.details),
      new LogHeader(
        Presenter.COLUMNS.dispatchWindows,
        new LogSelectFilter([], true, '300'),
      ),
    ];
  }

  protected override async updateFiltersInHeaders(
    headers: LogHeader[],
    entries: LogEntry[],
  ) {
    const uniqueFieldValues = Presenter.getUniqueFieldValues(headers, entries);
    headers.forEach((header) => {
      if (!(header.filter instanceof LogSelectFilter)) {
        return;
      }
      if (header.spec === Presenter.COLUMNS.dispatchWindows) {
        header.filter.options = [...this.allInputLayerIds.values()].map(
          (layerId) => {
            return this.getLayerDisplayName(layerId);
          },
        );
        return;
      }
      header.filter.options = Array.from(
        assertDefined(uniqueFieldValues.get(header.spec)),
      );
      header.filter.options.sort();
    });
  }

  protected override async makeUiDataEntries(): Promise<InputEntry[]> {
    const entries: InputEntry[] = [];
    const trees = await this.trace.getAllEntryValues();
    for (let i = 0; i < trees.length; i++) {
      const wrapperTree = trees[i];
      if (wrapperTree === undefined) {
        continue;
      }
      const traceEntry = assertDefined(this.trace.getEntry(i));
      const entry = this.makeInputEntry(traceEntry, wrapperTree);
      entries.push(entry);
    }
    return entries;
  }

  protected override async updatePropertiesTree() {
    await super.updatePropertiesTree();
    await this.updateDispatchPropertiesTree();
    if (this.shouldHandleWindowPropertyHighlight) {
      this.handleWindowPropertyHighlight();
    }
    await this.updateRects();
  }

  private async updateDispatchPropertiesTree() {
    const inputEntry = this.getCurrentEntry();
    const tree = inputEntry?.getDispatchPropertiesTree
      ? await inputEntry.getDispatchPropertiesTree()
      : undefined;
    this.dispatchPropertiesPresenter.setPropertiesTree(tree);
    await this.dispatchPropertiesPresenter.formatPropertiesTree(
      undefined,
      undefined,
      this.keepCalculated ?? false,
      this.trace.type,
    );
    this.uiData.dispatchPropertyNodes = this.flattenProperties(
      this.dispatchPropertiesPresenter.getFormattedTree(),
    );
  }

  private async handleWindowPropertyHighlight() {
    const inputEntry = this.getCurrentEntry();
    const dispatchProperties = await inputEntry?.getDispatchPropertiesTree?.();
    if (dispatchProperties) {
      let foundMatch = false;
      for (const dispatchEntry of dispatchProperties.getAllChildren()) {
        const winId = dispatchEntry.getChildByName('windowId');
        if (
          winId !== undefined &&
          winId.getValue<number>() === Number(this.lastClickedId)
        ) {
          foundMatch = true;
          this.onHighlightedPropertyChange(
            winId.id,
            this.shouldHandleWindowPropertyHighlight,
          );
          break;
        }
      }
      if (!foundMatch) {
        this.onHighlightedPropertyChange(
          '',
          this.shouldHandleWindowPropertyHighlight,
        );
      }
    }
  }

  private makeInputEntry(
    traceEntry: TraceEntryLazy<HierarchyTreeNode>,
    wrapperTree: HierarchyTreeNode,
  ): InputEntry {
    const type = assertDefined(wrapperTree.getEagerPropertyByName('type'));

    const getPropertiesTree = async () => {
      const properties = await wrapperTree.getAllProperties();
      const event = assertDefined(properties.getChildByName('event'));
      event.setIsRoot(true);
      return event;
    };
    const getDispatchPropertiesTree = async () => {
      const properties = await wrapperTree.getAllProperties();
      const dispatchTree = assertDefined(
        properties.getChildByName('dispatchEvents'),
      );
      dispatchTree.setIsRoot(true);
      return dispatchTree;
    };

    const windows = assertDefined(wrapperTree.getEagerPropertyByName('windows'))
      .getAllChildren()
      .map((window) => {
        const windowId = Number(window?.getValue<bigint>() ?? -1);
        this.allInputLayerIds.add(windowId);
        return windowId;
      });

    let sfEntry: TraceEntry<HierarchyTreeNode> | undefined;
    if (this.surfaceFlingerTrace !== undefined && this.trace.hasFrameInfo()) {
      const frame = traceEntry.getFramesRange()?.start;
      if (frame !== undefined) {
        const sfFrame = this.surfaceFlingerTrace.getFrame(frame);
        if (sfFrame.lengthEntries > 0) {
          sfEntry = sfFrame.getEntry(0);
        }
      }
    }

    const onWindowClicked = (id: bigint) =>
      this.onTargetWindowClicked(id, this.layerIdToName.get(Number(id)));

    return new InputEntry(
      traceEntry,
      [
        new LogField(
          Presenter.COLUMNS.type,
          type.formattedValue(),
          undefined,
          undefined,
          true,
        ),
        new LogField(
          Presenter.COLUMNS.source,
          assertDefined(wrapperTree.getEagerPropertyByName('source'))
            .formattedValue()
            .replace('SOURCE_', ''),
        ),
        new LogField(
          Presenter.COLUMNS.action,
          Presenter.getInputAction(wrapperTree),
        ),
        new LogField(
          Presenter.COLUMNS.deviceId,
          Number(
            assertBigInt(
              wrapperTree.getEagerPropertyByName('deviceId')?.getValue(),
            ),
          ),
        ),
        new LogField(
          Presenter.COLUMNS.displayId,
          Number(
            assertBigInt(
              wrapperTree.getEagerPropertyByName('displayId')?.getValue(),
            ),
          ),
        ),
        new LogField(
          Presenter.COLUMNS.details,
          type.getValue() === InputEventType.KEY
            ? Presenter.extractKeyDetails(
                wrapperTree,
                (id) => this.getLayerName(id),
                onWindowClicked,
              )
            : Presenter.createDispatchArray(
                wrapperTree,
                (id) => this.getLayerName(id),
                onWindowClicked,
              ),
        ),
        new LogField(
          Presenter.COLUMNS.dispatchWindows,
          windows
            ?.map((window) => {
              return this.getLayerDisplayName(window);
            })
            .join(', '),
        ),
      ],
      getPropertiesTree,
      getDispatchPropertiesTree,
      sfEntry,
    );
  }

  private getLayerDisplayName(layerId: number): string {
    return this.wrapLayerName(
      this.layerIdToName.get(layerId) ?? layerId.toString(),
    );
  }

  private getLayerName(layerId: number): string | undefined {
    const name = this.layerIdToName.get(layerId);
    if (!name) {
      return undefined;
    }
    return this.wrapLayerName(name);
  }

  private wrapLayerName(layerName: string): string {
    // Surround the name using the invisible zero-width non-joiner character to ensure
    // the full string is matched while filtering.
    return `\u{200C}${layerName}\u{200C}`;
  }

  private async updateRects() {
    if (this.surfaceFlingerTrace === undefined) {
      return;
    }
    const inputEntry = this.getCurrentEntry();

    this.currentTargetWindowIds.clear();
    this.currDispatchProperties = undefined;

    const dispatchProperties = await inputEntry?.getDispatchPropertiesTree?.();
    if (dispatchProperties) {
      dispatchProperties.getAllChildren()?.forEach((dispatchEntry) => {
        const windowId = dispatchEntry.getChildByName('windowId');
        if (windowId !== undefined) {
          this.currentTargetWindowIds.add(`${windowId.getValue<number>()}`);
        }
      });
    }

    if (inputEntry?.surfaceFlingerEntry !== undefined) {
      const startTimeMs = Date.now();
      const node = await inputEntry.surfaceFlingerEntry.getValue();
      this.currDispatchProperties = dispatchProperties;
      this.rectsPresenter.applyHierarchyTreesChange([
        {trace: this.surfaceFlingerTrace, trees: [node]},
      ]);
      Analytics.Navigation.logFetchComponentDataTime(
        'rects',
        TRACE_INFO[TraceType.INPUT_EVENT_MERGED].name,
        false,
        Date.now() - startTimeMs,
      );

      this.uiData.rectsToDraw = this.rectsPresenter.getRectsToDraw();
      this.uiData.rectIdToShowState =
        this.rectsPresenter.getRectIdToShowState();
    } else {
      this.uiData.rectsToDraw = [];
      this.uiData.rectIdToShowState = undefined;
    }
    this.uiData.rectsUserOptions = this.rectsPresenter.getUserOptions();
    this.uiData.displays = this.rectsPresenter.getDisplays();
  }

  private getCurrentEntry(): InputEntry | undefined {
    const entries = this.logPresenter.getFilteredEntries();
    const selectedIndex = this.logPresenter.getSelectedIndex();
    const currentIndex = this.logPresenter.getCurrentIndex();
    const index = selectedIndex ?? currentIndex;
    if (index === undefined) {
      return undefined;
    }
    return entries[index];
  }

  private static getInputAction(tree: HierarchyTreeNode): string {
    const actionNode = assertDefined(tree.getEagerPropertyByName('action'));
    const action = Number(actionNode.getValue());
    const actionMasked = action & 0xff;
    const pointerIndex = action >> 8;
    switch (actionMasked) {
      case 5:
        return `POINTER_DOWN(${pointerIndex})`;
      case 6:
        return `POINTER_UP(${pointerIndex})`;
      default:
        return actionNode.formattedValue().replace('ACTION_', '');
    }
  }

  private static extractKeyDetails(
    wrapperTree: HierarchyTreeNode,
    displayNameGetter: (id: number) => string | undefined,
    onWindowClick: (windowId: bigint, windowName: string) => void,
  ): Array<string | ClickableProperty> {
    const keyDetails =
      'Keycode: ' +
      (wrapperTree
        .getEagerPropertyByName('keyCode')
        ?.formattedValue()
        ?.replace(/^KEYCODE_/, '') ?? '<?>');
    const windows = Presenter.createDispatchArray(
      wrapperTree,
      displayNameGetter,
      onWindowClick,
    );
    return [keyDetails, ' ', ...windows];
  }

  private static createDispatchArray(
    wrapperTree: HierarchyTreeNode,
    displayNameGetter: (id: number) => string | undefined,
    onWindowClick: (windowId: bigint, windowName: string) => void,
  ): Array<string | ClickableProperty> {
    const windows = Presenter.extractDispatchDetails(
      wrapperTree,
      displayNameGetter,
      onWindowClick,
    );
    const finalArray: Array<string | ClickableProperty> = ['['];
    windows.forEach((window, index) => {
      finalArray.push(window);
      if (index < windows.length - 1) {
        finalArray.push(', ');
      }
    });

    finalArray.push(']');
    return finalArray;
  }

  private static extractDispatchDetails(
    wrapperTree: HierarchyTreeNode,
    displayNameGetter: (id: number) => string | undefined,
    onWindowClick: (windowId: bigint, windowName: string) => void,
  ): ClickableProperty[] {
    const windows =
      wrapperTree.getEagerPropertyByName('windows')?.getAllChildren() ?? [];
    return windows
      .filter((window) => window.formattedValue() !== '0')
      .map((window) => {
        const windowId = assertBigInt(window.getValue<bigint>());
        return {
          propertyValue: windowId.toString(),
          tooltip: displayNameGetter(Number(windowId)),
          onClick: () => onWindowClick(windowId, windowId.toString()),
        };
      });
  }

  private static getUniqueFieldValues(
    headers: LogHeader[],
    entries: LogEntry[],
  ): Map<ColumnSpec, Set<string>> {
    const uniqueFieldValues = new Map<ColumnSpec, Set<string>>();
    headers.forEach((header) => {
      if (!header.filter || header.spec === Presenter.COLUMNS.dispatchWindows) {
        return;
      }
      uniqueFieldValues.set(header.spec, new Set());
    });
    entries.forEach((entry) => {
      entry.fields.forEach((field) => {
        uniqueFieldValues.get(field.spec)?.add(field.value.toString());
      });
    });
    return uniqueFieldValues;
  }
}
