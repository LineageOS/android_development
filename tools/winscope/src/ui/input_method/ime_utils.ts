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
import {FilterFlag} from '@common/filter_flag';
import {Timestamp} from '@common/time/time';
import {WindowType} from '@trace/window_manager/window_type';
import {makeNodeFilter} from '@tree_node/helpers';
import {HierarchyTreeNode} from '@tree_node/hierarchy_tree_node';
import {Item} from '@tree_node/item';
import {PropertyTreeNode} from '@tree_node/property_tree_node';
import {TreeNodeFilter} from '@ui/shared/tree/ui_tree_node_helpers';
import {TextFilter} from '@ui/shared/user_input/text_filter';

import {getFocusedActivity, getFocusedWindow} from './wm_ime_utils';

interface WmStateProperties {
  timestamp: string | undefined;
  focusedApp: string | undefined;
  focusedWindow: string | undefined;
  focusedActivity: string | undefined;
  isInputMethodWindowVisible: boolean;
  imeInputTarget: PropertyTreeNode | undefined;
  imeLayeringTarget: PropertyTreeNode | undefined;
  imeInsetsSourceProvider: PropertyTreeNode | undefined;
  imeControlTarget: PropertyTreeNode | undefined;
}

/**
 * A processed window manager state with a summary of the IME state.
 */
export class ProcessedWindowManagerState implements Item {
  constructor(
    readonly id: string,
    readonly name: string,
    readonly wmStateProperties: WmStateProperties,
    readonly hierarchyTree: HierarchyTreeNode,
  ) {}
}

/**
 * Properties of the IME container.
 */
export interface ImeContainerProperties {
  id: string;
  zOrderRelativeOfId: number;
  z: number;
}

/**
 * Properties of the input method surface.
 */
export interface InputMethodSurfaceProperties {
  id: string;
  isVisible: boolean;
  screenBounds?: PropertyTreeNode;
  rect?: PropertyTreeNode;
}

interface RootImeProperties {
  timestamp: string;
}

interface ImeLayerProperties {
  imeContainer: ImeContainerProperties | undefined;
  inputMethodSurface: InputMethodSurfaceProperties | undefined;
  focusedWindowColor: PropertyTreeNode | undefined;
  root: RootImeProperties | undefined;
}

/**
 * A processed IME layers entry with a summary of the IME layers.
 */
export class ImeLayers implements Item {
  constructor(
    readonly id: string,
    readonly name: string,
    readonly properties: ImeLayerProperties,
    readonly taskLayerOfImeContainer: HierarchyTreeNode | undefined,
    readonly taskLayerOfImeSnapshot: HierarchyTreeNode | undefined,
  ) {}
}

const isInputMethodSurface = makeNodeFilter(
  new TextFilter('InputMethod').getFilterPredicate(),
);
const isImeContainer = makeNodeFilter(
  new TextFilter('ImeContainer').getFilterPredicate(),
);

/**
 * Creates a new ProcessedWindowManagerState object with a summary of the IME state.
 *
 * @param entry The trace entry to process.
 * @param wmEntryTimestamp The timestamp of the trace entry.
 * @return A new ProcessedWindowManagerState object.
 */
export async function processWindowManagerTraceEntry(
  entry: HierarchyTreeNode,
  wmEntryTimestamp: Timestamp | undefined,
): Promise<ProcessedWindowManagerState> {
  const displayContent = entry.getAllChildren()[0];
  const displayContentProperties = assertDefined(
    (await displayContent.getAllProperties()).getChildByName('displayContent'),
  );

  const entryProperties = assertDefined(
    (await entry.getAllProperties()).getChildByName('windowManagerService'),
  );

  const props: WmStateProperties = {
    timestamp: wmEntryTimestamp ? wmEntryTimestamp.format() : undefined,
    focusedApp: entryProperties.getChildByName('focusedApp')?.getValue(),
    focusedWindow: await getFocusedWindowString(entry),
    focusedActivity: await getFocusedActivityString(entry),
    isInputMethodWindowVisible: isInputMethodVisible(displayContent),
    imeInputTarget: getImeInputTargetProperty(displayContentProperties),
    imeLayeringTarget: getImeLayeringTargetProperty(displayContentProperties),
    imeInsetsSourceProvider: displayContentProperties.getChildByName(
      'imeInsetsSourceProvider',
    ),
    imeControlTarget: getImeControlTargetProperty(displayContentProperties),
  };

  return new ProcessedWindowManagerState(entry.id, entry.name, props, entry);
}

/**
 * Creates a new ImeLayers object with a summary of the IME layers.
 *
 * @param entryTree The trace entry to process.
 * @param processedWindowManagerState The processed window manager state.
 * @param sfEntryTimestamp The timestamp of the trace entry.
 * @return A new ImeLayers object, or undefined if no IME layers are found.
 */
export async function getImeLayers(
  entryTree: HierarchyTreeNode,
  processedWindowManagerState: ProcessedWindowManagerState,
  sfEntryTimestamp: Timestamp | undefined,
): Promise<ImeLayers | undefined> {
  const imeContainerLayer = entryTree.findDfs(isImeContainer);
  if (!imeContainerLayer) {
    return undefined;
  }

  const inputMethodSurfaceLayer =
    imeContainerLayer.findDfs(isInputMethodSurface);
  if (!inputMethodSurfaceLayer) {
    return undefined;
  }

  const imeContainerAllProps = await imeContainerLayer.getAllProperties();
  const imeContainerProps: ImeContainerProperties = {
    id: imeContainerLayer.id,
    zOrderRelativeOfId: assertDefined(
      imeContainerAllProps
        .getChildByName('zOrderRelativeOf')
        ?.getValue<number>(),
    ),
    z: assertDefined(
      imeContainerAllProps.getChildByName('z')?.getValue<number>(),
    ),
  };

  const inputMethodSurfaceAllProps =
    await inputMethodSurfaceLayer.getAllProperties();
  const inputMethodSurfaceProps: InputMethodSurfaceProperties = {
    id: inputMethodSurfaceLayer.id,
    isVisible: assertDefined(
      inputMethodSurfaceAllProps
        .getChildByName('isVisible')
        ?.getValue<boolean>(),
    ),
    screenBounds: inputMethodSurfaceAllProps.getChildByName('screenBounds'),
    rect: inputMethodSurfaceAllProps.getChildByName('bounds'),
  };

  let focusedWindowLayer: HierarchyTreeNode | undefined;
  const focusedWindowToken =
    processedWindowManagerState.wmStateProperties.focusedWindow
      ?.split(' ')[0]
      .slice(1);
  if (focusedWindowToken) {
    const isFocusedWindow = makeNodeFilter(
      new TextFilter(focusedWindowToken).getFilterPredicate(),
    );
    focusedWindowLayer = entryTree.findDfs(isFocusedWindow);
  }

  const focusedWindowColor = focusedWindowLayer
    ? (await focusedWindowLayer.getAllProperties()).getChildByName('color')
    : undefined;

  // we want to see both ImeContainer and IME-snapshot if there are
  // cases where both exist
  const taskLayerOfImeContainer = findAncestorTaskLayerOfImeLayer(
    entryTree,
    isImeContainer,
  );

  const taskLayerOfImeSnapshot = findAncestorTaskLayerOfImeLayer(
    entryTree,
    makeNodeFilter(new TextFilter('IME-snapshot').getFilterPredicate()),
  );

  const rootProperties = sfEntryTimestamp
    ? {timestamp: sfEntryTimestamp.format()}
    : undefined;

  return new ImeLayers(
    entryTree.id,
    entryTree.name,
    {
      imeContainer: imeContainerProps,
      inputMethodSurface: inputMethodSurfaceProps,
      focusedWindowColor,
      root: rootProperties,
    },
    taskLayerOfImeContainer,
    taskLayerOfImeSnapshot,
  );
}

async function getFocusedWindowString(
  entry: HierarchyTreeNode,
): Promise<string | undefined> {
  let focusedWindowString;
  const focusedWindow = await getFocusedWindow(entry);
  if (focusedWindow) {
    const containerProperties = await focusedWindow.getAllProperties();
    const focusedWindowProperties = assertDefined(
      containerProperties.getChildByName('window'),
    );
    const token = assertDefined(
      focusedWindow.getEagerPropertyByName('token')?.formattedValue(),
    );
    const windowType = assertDefined(
      containerProperties.getChildByName('windowType')?.getValue<number>(),
    );
    const windowTypeSuffix = getWindowTypeSuffix(windowType);
    const type = assertDefined(
      focusedWindowProperties
        ?.getChildByName('attributes')
        ?.getChildByName('type'),
    ).formattedValue();
    const windowFrames = assertDefined(
      focusedWindowProperties.getChildByName('windowFrames'),
    );
    const containingFrame = assertDefined(
      windowFrames.getChildByName('containingFrame')?.formattedValue(),
    );
    const parentFrame = assertDefined(
      windowFrames.getChildByName('parentFrame')?.formattedValue(),
    );

    focusedWindowString = `{${token} ${focusedWindow.name}${windowTypeSuffix}} type=${type} cf=${containingFrame} pf=${parentFrame}`;
  }
  return focusedWindowString;
}

/**
 * Returns a string representation of the focused activity.
 *
 * @param entry The trace entry to process.
 * @return A string representation of the focused activity.
 */
async function getFocusedActivityString(
  entry: HierarchyTreeNode,
): Promise<string> {
  let focusedActivityString = 'null';
  const focusedActivity = await getFocusedActivity(entry);
  if (focusedActivity) {
    const token = assertDefined(
      focusedActivity.getEagerPropertyByName('token'),
    ).formattedValue();
    const state = assertDefined(
      (await focusedActivity.getAllProperties())
        .getChildByName('activity')
        ?.getChildByName('state'),
    ).getValue();
    const isVisible =
      focusedActivity.getEagerPropertyByName('isVisible')?.getValue() ?? false;

    focusedActivityString = `{${token} ${focusedActivity.name}} state=${state} visible=${isVisible}`;
  }
  return focusedActivityString;
}

function getWindowTypeSuffix(windowType: number): string {
  switch (windowType) {
    case WindowType.STARTING:
      return ' STARTING';
    case WindowType.EXITING:
      return ' EXITING';
    case WindowType.DEBUGGER:
      return ' DEBUGGER';
    default:
      return '';
  }
}

function findAncestorTaskLayerOfImeLayer(
  entryTree: HierarchyTreeNode,
  isTargetImeLayer: TreeNodeFilter,
): HierarchyTreeNode | undefined {
  const imeLayer = entryTree.findDfs(isTargetImeLayer);

  if (!imeLayer) {
    return undefined;
  }

  const isTaskLayer = makeNodeFilter(
    new TextFilter('Task|ImePlaceholder', [
      FilterFlag.USE_REGEX,
    ]).getFilterPredicate(),
  );
  const taskLayer = imeLayer.findAncestor(isTaskLayer);
  if (!taskLayer) {
    return undefined;
  }

  return taskLayer;
}

function getImeControlTargetProperty(
  displayContent: PropertyTreeNode,
): PropertyTreeNode | undefined {
  return displayContent.getChildByName('inputMethodControlTarget');
}

function getImeInputTargetProperty(
  displayContent: PropertyTreeNode,
): PropertyTreeNode | undefined {
  return displayContent.getChildByName('inputMethodInputTarget');
}

function getImeLayeringTargetProperty(
  displayContent: PropertyTreeNode,
): PropertyTreeNode | undefined {
  return displayContent.getChildByName('inputMethodTarget');
}

function isInputMethodVisible(displayContent: HierarchyTreeNode): boolean {
  const inputMethodWindowOrLayer = displayContent.findDfs(isInputMethodSurface);
  return (
    inputMethodWindowOrLayer
      ?.getEagerPropertyByName('isVisible')
      ?.getValue<boolean>() ?? false
  );
}
