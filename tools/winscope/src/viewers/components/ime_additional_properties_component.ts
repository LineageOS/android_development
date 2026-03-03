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
import {Component, ElementRef, Inject, input, output} from '@angular/core';
import {MatButtonModule} from '@angular/material/button';
import {EMPTY_OBJ_STRING} from '@trace/formatters';
import {HierarchyTreeNode} from '@tree_node/hierarchy_tree_node';
import {PropertyTreeNode} from '@tree_node/property_tree_node';
import {TreeNode} from '@tree_node/tree_node';
import {ImeAdditionalProperties} from '@viewers/common/ime_additional_properties';
import {
  ImeContainerProperties,
  InputMethodSurfaceProperties,
} from '@viewers/common/ime_utils';
import {
  AdditionalPropertySelectedDetail,
  ViewerEvents,
} from '@viewers/common/viewer_events';
import {CollapsibleSectionTitleComponent} from './collapsible_section_title_component';
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
  styleUrls: ['./ime_additional_properties_component.css'],
})
export class ImeAdditionalPropertiesComponent {
  additionalProperties = input<ImeAdditionalProperties>();
  isImeManagerService = input<boolean>(false);
  highlightedItem = input<string>('');

  collapseButtonClicked = output();

  constructor(@Inject(ElementRef) private elementRef: ElementRef) {}

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

  formattedWindowColor(): string {
    const color =
      this.additionalProperties()?.sf?.properties.focusedWindowColor;
    if (!color) return EMPTY_OBJ_STRING;
    return color.formattedValue();
  }

  sfRootLabel(): string {
    const props = this.additionalProperties();
    const rootProps = props?.sf?.properties.root;
    if (!rootProps) {
      return props?.sf?.name ?? 'root';
    }

    return rootProps.timestamp;
  }

  wmRootLabel(): string {
    const props = this.additionalProperties();
    const timestamp = props?.wm?.wmStateProperties.timestamp;
    if (!timestamp) {
      return props?.wm?.name ?? 'root';
    }
    return timestamp;
  }

  wmHierarchyTree(): HierarchyTreeNode | undefined {
    return this.additionalProperties()?.wm?.hierarchyTree;
  }

  wmInsetsSourceProvider(): PropertyTreeNode | undefined {
    return this.additionalProperties()?.wm?.wmStateProperties
      .imeInsetsSourceProvider;
  }

  wmControlTargetFrame(): PropertyTreeNode | undefined {
    return this.additionalProperties()
      ?.wm?.wmStateProperties.imeInsetsSourceProvider?.getChildByName(
        'insetsSourceProvider',
      )
      ?.getChildByName('controlTarget')
      ?.getChildByName('windowFrames')
      ?.getChildByName('frame');
  }

  wmInsetsSourceProviderPosition(): string {
    return (
      this.additionalProperties()
        ?.wm?.wmStateProperties.imeInsetsSourceProvider?.getChildByName(
          'insetsSourceProvider',
        )
        ?.getChildByName('control')
        ?.getChildByName('position')
        ?.formattedValue() ?? 'null'
    );
  }

  wmInsetsSourceProviderIsLeashReady(): string {
    return (
      this.additionalProperties()
        ?.wm?.wmStateProperties.imeInsetsSourceProvider?.getChildByName(
          'insetsSourceProvider',
        )
        ?.getChildByName('isLeashReadyForDispatching')
        ?.formattedValue() ?? 'null'
    );
  }

  wmInsetsSourceProviderControllable(): string {
    return (
      this.additionalProperties()
        ?.wm?.wmStateProperties.imeInsetsSourceProvider?.getChildByName(
          'insetsSourceProvider',
        )
        ?.getChildByName('controllable')
        ?.formattedValue() ?? 'null'
    );
  }

  wmInsetsSourceProviderSourceFrame(): PropertyTreeNode | undefined {
    return this.additionalProperties()
      ?.wm?.wmStateProperties.imeInsetsSourceProvider?.getChildByName('source')
      ?.getChildByName('frame');
  }

  wmInsetsSourceProviderSourceVisible(): string {
    return (
      this.additionalProperties()
        ?.wm?.wmStateProperties.imeInsetsSourceProvider?.getChildByName(
          'source',
        )
        ?.getChildByName('visible')
        ?.formattedValue() ?? 'null'
    );
  }

  wmInsetsSourceProviderSourceVisibleFrame(): PropertyTreeNode | undefined {
    return this.additionalProperties()
      ?.wm?.wmStateProperties.imeInsetsSourceProvider?.getChildByName('source')
      ?.getChildByName('visibleFrame');
  }

  wmImeControlTarget(): PropertyTreeNode | undefined {
    return this.additionalProperties()?.wm?.wmStateProperties.imeControlTarget;
  }

  wmImeControlTargetTitle(): string | undefined {
    return (
      this.additionalProperties()
        ?.wm?.wmStateProperties.imeControlTarget?.getChildByName(
          'windowContainer',
        )
        ?.getChildByName('identifier')
        ?.getChildByName('title')
        ?.formattedValue() ?? undefined
    );
  }

  wmImeInputTarget(): PropertyTreeNode | undefined {
    return this.additionalProperties()?.wm?.wmStateProperties.imeInputTarget;
  }

  wmImeInputTargetTitle(): string | undefined {
    return (
      this.additionalProperties()
        ?.wm?.wmStateProperties.imeInputTarget?.getChildByName(
          'windowContainer',
        )
        ?.getChildByName('identifier')
        ?.getChildByName('title')
        ?.formattedValue() ?? undefined
    );
  }

  wmImeLayeringTarget(): PropertyTreeNode | undefined {
    return this.additionalProperties()?.wm?.wmStateProperties.imeLayeringTarget;
  }

  wmImeLayeringTargetTitle(): string | undefined {
    return (
      this.additionalProperties()
        ?.wm?.wmStateProperties.imeLayeringTarget?.getChildByName(
          'windowContainer',
        )
        ?.getChildByName('identifier')
        ?.getChildByName('title')
        ?.formattedValue() ?? undefined
    );
  }

  sfImeContainerScreenBounds(): PropertyTreeNode | undefined {
    return (
      this.additionalProperties()?.sf?.properties.inputMethodSurface
        ?.screenBounds ?? undefined
    );
  }

  sfImeContainerRect(): PropertyTreeNode | undefined {
    return (
      this.additionalProperties()?.sf?.properties.inputMethodSurface?.rect ??
      undefined
    );
  }

  isAllPropertiesUndefined(): boolean {
    const props = this.additionalProperties();
    if (this.isImeManagerService()) {
      return !props?.wm;
    } else {
      return !(props?.wm || props?.sf);
    }
  }

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
    const event: CustomEvent = new CustomEvent(
      ViewerEvents.HighlightedIdChange,
      {
        bubbles: true,
        detail: {id: newId},
      },
    );
    this.elementRef.nativeElement.dispatchEvent(event);
  }

  private updateAdditionalPropertySelected(item: TreeNode, name: string) {
    const detail = new AdditionalPropertySelectedDetail(name, item);
    const event: CustomEvent = new CustomEvent(
      ViewerEvents.AdditionalPropertySelected,
      {
        bubbles: true,
        detail,
      },
    );
    this.elementRef.nativeElement.dispatchEvent(event);
  }
}
