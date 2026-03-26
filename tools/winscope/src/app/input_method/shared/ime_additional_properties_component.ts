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
import {CommonModule} from '@angular/common';
import {Component, computed, input, output} from '@angular/core';
import {MatButtonModule} from '@angular/material/button';
import {CollapsibleSectionTitleComponent} from '@app/shared/collapsible_sections/collapsible_section_title_component';
import {EMPTY_OBJ_STRING} from '@trace/formatters';
import {HierarchyTreeNode} from '@tree_node/hierarchy_tree_node';
import {PropertyTreeNode} from '@tree_node/property_tree_node';
import {TreeNode} from '@tree_node/tree_node';
import {ImeAdditionalProperties} from '@ui/input_method/ime_additional_properties';
import {ImeContainerProperties, InputMethodSurfaceProperties,} from '@ui/input_method/ime_utils';
import {AdditionalPropertySelectedDetail} from '@ui/shared/viewers/viewer_event_details';

import {CoordinatesTableComponent} from './coordinates_table_component';

@Component({
  selector: 'ime-additional-properties',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    CollapsibleSectionTitleComponent,
    CoordinatesTableComponent,
  ],
  templateUrl: './ime_additional_properties_component.ng.html',
  styleUrls: ['./ime_additional_properties_component.scss'],
})
export class ImeAdditionalPropertiesComponent {
  additionalProperties = input<ImeAdditionalProperties>();
  isImeManagerService = input<boolean>(false);
  highlightedItem = input<string>('');

  collapseButtonClicked = output();
  readonly highlightedIdChange = output<string>();
  readonly additionalPropertySelected =
    output<AdditionalPropertySelectedDetail>();

  readonly formattedWindowColor = computed<string>(() => {
    const color =
      this.additionalProperties()?.sf?.properties.focusedWindowColor;
    if (!color) return EMPTY_OBJ_STRING;
    return color.formattedValue();
  });

  readonly sfRootLabel = computed<string>(() => {
    const props = this.additionalProperties();
    const rootProps = props?.sf?.properties.root;
    if (!rootProps) {
      return props?.sf?.name ?? 'root';
    }

    return rootProps.timestamp;
  });

  isHighlighted(
    item:
      | TreeNode
      | ImeContainerProperties
      | InputMethodSurfaceProperties
      | undefined,
  ): boolean {
    return item ? item.id === this.highlightedItem() : false;
  }

  getButtonColor(node: TreeNode | undefined) {
    return this.isHighlighted(node) ? undefined : 'primary';
  }

  readonly wmRootLabel = computed<string>(() => {
    const props = this.additionalProperties();
    const timestamp = props?.wm?.wmStateProperties.timestamp;
    if (!timestamp) {
      return props?.wm?.name ?? 'root';
    }
    return timestamp;
  });

  readonly wmHierarchyTree = computed<HierarchyTreeNode | undefined>(() => {
    return this.additionalProperties()?.wm?.hierarchyTree;
  });

  readonly wmInsetsSourceProvider = computed<PropertyTreeNode | undefined>(
    () => {
      return this.additionalProperties()?.wm?.wmStateProperties
        .imeInsetsSourceProvider;
    },
  );

  readonly wmControlTargetFrame = computed<PropertyTreeNode | undefined>(() => {
    return this.additionalProperties()
      ?.wm?.wmStateProperties.imeInsetsSourceProvider?.getChildByName(
        'insetsSourceProvider',
      )
      ?.getChildByName('controlTarget')
      ?.getChildByName('windowFrames')
      ?.getChildByName('frame');
  });

  readonly wmInsetsSourceProviderPosition = computed<string>(() => {
    return (
      this.additionalProperties()
        ?.wm?.wmStateProperties.imeInsetsSourceProvider?.getChildByName(
          'insetsSourceProvider',
        )
        ?.getChildByName('control')
        ?.getChildByName('position')
        ?.formattedValue() ?? 'null'
    );
  });

  readonly wmInsetsSourceProviderIsLeashReady = computed<string>(() => {
    return (
      this.additionalProperties()
        ?.wm?.wmStateProperties.imeInsetsSourceProvider?.getChildByName(
          'insetsSourceProvider',
        )
        ?.getChildByName('isLeashReadyForDispatching')
        ?.formattedValue() ?? 'null'
    );
  });

  readonly wmInsetsSourceProviderControllable = computed<string>(() => {
    return (
      this.additionalProperties()
        ?.wm?.wmStateProperties.imeInsetsSourceProvider?.getChildByName(
          'insetsSourceProvider',
        )
        ?.getChildByName('controllable')
        ?.formattedValue() ?? 'null'
    );
  });

  readonly wmInsetsSourceProviderSourceFrame = computed<
    PropertyTreeNode | undefined
  >(() => {
    return this.additionalProperties()
      ?.wm?.wmStateProperties.imeInsetsSourceProvider?.getChildByName('source')
      ?.getChildByName('frame');
  });

  readonly wmInsetsSourceProviderSourceVisible = computed<string>(() => {
    return (
      this.additionalProperties()
        ?.wm?.wmStateProperties.imeInsetsSourceProvider?.getChildByName(
          'source',
        )
        ?.getChildByName('visible')
        ?.formattedValue() ?? 'null'
    );
  });

  readonly wmInsetsSourceProviderSourceVisibleFrame = computed<
    PropertyTreeNode | undefined
  >(() => {
    return this.additionalProperties()
      ?.wm?.wmStateProperties.imeInsetsSourceProvider?.getChildByName('source')
      ?.getChildByName('visibleFrame');
  });

  readonly wmImeControlTarget = computed<PropertyTreeNode | undefined>(() => {
    return this.additionalProperties()?.wm?.wmStateProperties.imeControlTarget;
  });

  readonly wmImeControlTargetTitle = computed<string | undefined>(() => {
    return this.additionalProperties()
      ?.wm?.wmStateProperties.imeControlTarget?.getChildByName(
        'windowContainer',
      )
      ?.getChildByName('identifier')
      ?.getChildByName('title')
      ?.formattedValue();
  });

  readonly wmImeInputTarget = computed<PropertyTreeNode | undefined>(() => {
    return this.additionalProperties()?.wm?.wmStateProperties.imeInputTarget;
  });

  readonly wmImeInputTargetTitle = computed<string | undefined>(() => {
    return this.additionalProperties()
      ?.wm?.wmStateProperties.imeInputTarget?.getChildByName('windowContainer')
      ?.getChildByName('identifier')
      ?.getChildByName('title')
      ?.formattedValue();
  });

  readonly wmImeLayeringTarget = computed<PropertyTreeNode | undefined>(() => {
    return this.additionalProperties()?.wm?.wmStateProperties.imeLayeringTarget;
  });

  readonly wmImeLayeringTargetTitle = computed<string | undefined>(() => {
    return this.additionalProperties()
      ?.wm?.wmStateProperties.imeLayeringTarget?.getChildByName(
        'windowContainer',
      )
      ?.getChildByName('identifier')
      ?.getChildByName('title')
      ?.formattedValue();
  });

  readonly sfImeContainerScreenBounds = computed<PropertyTreeNode | undefined>(
    () => {
      return this.additionalProperties()?.sf?.properties.inputMethodSurface
        ?.screenBounds;
    },
  );

  readonly sfImeContainerRect = computed<PropertyTreeNode | undefined>(() => {
    return this.additionalProperties()?.sf?.properties.inputMethodSurface?.rect;
  });

  readonly isAllPropertiesUndefined = computed<boolean>(() => {
    const props = this.additionalProperties();
    if (this.isImeManagerService()) {
      return !props?.wm;
    } else {
      return !(props?.wm || props?.sf);
    }
  });

  onClickShowInPropertiesPanelWm(item: TreeNode | undefined, name: string) {
    if (!item) {
      return;
    }
    this.updateAdditionalPropertySelected(item, name);
  }

  onClickShowInPropertiesPanelSf(
    item: ImeContainerProperties | InputMethodSurfaceProperties,
  ) {
    this.updateHighlightedItem(item.id);
  }

  private updateHighlightedItem(newId: string) {
    this.highlightedIdChange.emit(newId);
  }

  private updateAdditionalPropertySelected(item: TreeNode, name: string) {
    this.additionalPropertySelected.emit(
      new AdditionalPropertySelectedDetail(name, item),
    );
  }
}
