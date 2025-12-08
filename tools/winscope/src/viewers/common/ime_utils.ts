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
import {assertDefined} from 'common/assert';
import {FilterFlag} from 'common/filter_flag';
import {Timestamp} from 'common/time/time';
import {WindowType} from 'trace/window_manager/window_type';
import {HierarchyTreeNode} from 'tree_node/hierarchy_tree_node';
import {Item} from 'tree_node/item';
import {PropertyTreeNode} from 'tree_node/property_tree_node';
import {TextFilter} from 'viewers/common/text_filter';
import {
  getFocusedActivity,
  getFocusedWindow,
} from 'viewers/common/wm_ime_utils';
import {makeNodeFilter, TreeNodeFilter} from './ui_tree_utils';

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

class ImeAdditionalPropertiesUtils {
  private isInputMethodSurface = makeNodeFilter(
    new TextFilter('InputMethod').getFilterPredicate(),
  );
  private isImeContainer = makeNodeFilter(
    new TextFilter('ImeContainer').getFilterPredicate(),
  );

  /**
   * Creates a new ProcessedWindowManagerState object with a summary of the IME state.
   *
   * @param entry The trace entry to process.
   * @param wmEntryTimestamp The timestamp of the trace entry.
   * @return A new ProcessedWindowManagerState object.
   */
  processWindowManagerTraceEntry(
    entry: HierarchyTreeNode,
    wmEntryTimestamp: Timestamp | undefined,
  ): ProcessedWindowManagerState {
    const displayContent = entry.getAllChildren()[0];

    const props: WmStateProperties = {
      timestamp: wmEntryTimestamp ? wmEntryTimestamp.format() : undefined,
      focusedApp: entry.getEagerPropertyByName('focusedApp')?.getValue(),
      focusedWindow: this.getFocusedWindowString(entry),
      focusedActivity: this.getFocusedActivityString(entry),
      isInputMethodWindowVisible: this.isInputMethodVisible(displayContent),
      imeInputTarget: this.getImeInputTargetProperty(displayContent),
      imeLayeringTarget: this.getImeLayeringTargetProperty(displayContent),
      imeInsetsSourceProvider: displayContent.getEagerPropertyByName(
        'imeInsetsSourceProvider',
      ),
      imeControlTarget: this.getImeControlTargetProperty(displayContent),
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
  async getImeLayers(
    entryTree: HierarchyTreeNode,
    processedWindowManagerState: ProcessedWindowManagerState,
    sfEntryTimestamp: Timestamp | undefined,
  ): Promise<ImeLayers | undefined> {
    const imeContainerLayer = entryTree.findDfs(this.isImeContainer);
    if (!imeContainerLayer) {
      return undefined;
    }

    const inputMethodSurfaceLayer = imeContainerLayer.findDfs(
      this.isInputMethodSurface,
    );
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
    const taskLayerOfImeContainer = this.findAncestorTaskLayerOfImeLayer(
      entryTree,
      this.isImeContainer,
    );

    const taskLayerOfImeSnapshot = this.findAncestorTaskLayerOfImeLayer(
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

  private getFocusedWindowString(entry: HierarchyTreeNode): string | undefined {
    let focusedWindowString = undefined;
    const focusedWindow = getFocusedWindow(entry);
    if (focusedWindow) {
      const token = assertDefined(
        focusedWindow.getEagerPropertyByName('token')?.getValue<string>(),
      );
      const windowTypeSuffix = this.getWindowTypeSuffix(
        assertDefined(
          focusedWindow
            .getEagerPropertyByName('windowType')
            ?.getValue<number>(),
        ),
      );
      const type = assertDefined(
        focusedWindow
          .getEagerPropertyByName('attributes')
          ?.getChildByName('type'),
      ).formattedValue();
      const windowFrames = assertDefined(
        focusedWindow.getEagerPropertyByName('windowFrames'),
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
  private getFocusedActivityString(entry: HierarchyTreeNode): string {
    let focusedActivityString = 'null';
    const focusedActivity = getFocusedActivity(entry);
    if (focusedActivity) {
      const token = assertDefined(
        focusedActivity.getEagerPropertyByName('token'),
      ).getValue();
      const state = assertDefined(
        focusedActivity.getEagerPropertyByName('state'),
      ).getValue();
      const isVisible =
        focusedActivity
          .getEagerPropertyByName('isComputedVisible')
          ?.getValue() ?? false;

      focusedActivityString = `{${token} ${focusedActivity.name}} state=${state} visible=${isVisible}`;
    }
    return focusedActivityString;
  }

  private getWindowTypeSuffix(windowType: number): string {
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

  private findAncestorTaskLayerOfImeLayer(
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

  private getImeControlTargetProperty(
    displayContent: HierarchyTreeNode,
  ): PropertyTreeNode | undefined {
    return displayContent.getEagerPropertyByName('inputMethodControlTarget');
  }

  private getImeInputTargetProperty(
    displayContent: HierarchyTreeNode,
  ): PropertyTreeNode | undefined {
    return displayContent.getEagerPropertyByName('inputMethodInputTarget');
  }

  private getImeLayeringTargetProperty(
    displayContent: HierarchyTreeNode,
  ): PropertyTreeNode | undefined {
    return displayContent.getEagerPropertyByName('inputMethodTarget');
  }

  private isInputMethodVisible(displayContent: HierarchyTreeNode): boolean {
    const inputMethodWindowOrLayer = displayContent.findDfs(
      this.isInputMethodSurface,
    );
    return (
      inputMethodWindowOrLayer
        ?.getEagerPropertyByName('isComputedVisible')
        ?.getValue<boolean>() ?? false
    );
  }
}

export const ImeUtils = new ImeAdditionalPropertiesUtils();
