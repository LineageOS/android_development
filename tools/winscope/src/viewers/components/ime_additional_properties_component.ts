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
import {
  Component,
  ElementRef,
  EventEmitter,
  Inject,
  Input,
  Output,
} from '@angular/core';
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
import {ViewerEvents} from '@viewers/common/viewer_events';
import {CollapsibleSectionTitleComponent} from './collapsible_section_title_component';
import {CoordinatesTableComponent} from './coordinates_table_component';
import {selectedElementStyle} from './styles/selected_element.styles';
import {viewerCardInnerStyle} from './styles/viewer_card.styles';

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
  styles: [
    `
      :host collapsible-section-title {
        padding-bottom: 8px;
      }

      .additional-properties-content {
        height: 0;
        flex-grow: 1;
        overflow-y: auto;
      }

      .group {
        padding: 8px;
        display: flex;
        flex-direction: row;
        border-bottom: 1px solid var(--border-color);
      }

      .mat-body-1 {
        overflow-wrap: anywhere;
      }

      .group-header {
        height: 100%;
        width: 80px;
        padding: 0;
        text-align: center;
        line-height: normal;
        white-space: normal;
      }

      p.group-header {
        color: gray;
      }

      .left-column {
        flex: 1;
        padding: 0 5px;
      }

      .right-column {
        flex: 1;
        padding: 0 5px;
      }
    `,
    selectedElementStyle,
    viewerCardInnerStyle,
  ],
})
export class ImeAdditionalPropertiesComponent {
  @Input() additionalProperties: ImeAdditionalProperties | undefined;
  @Input() isImeManagerService: boolean | undefined;
  @Input() highlightedItem: string = '';

  @Output() collapseButtonClicked = new EventEmitter();

  constructor(@Inject(ElementRef) private elementRef: ElementRef) {}

  isHighlighted(
    item:
      | TreeNode
      | ImeContainerProperties
      | InputMethodSurfaceProperties
      | undefined,
  ): boolean {
    return item ? item.id === this.highlightedItem : false;
  }

  getButtonColor(node: TreeNode | undefined) {
    return this.isHighlighted(node) ? undefined : 'primary';
  }

  formattedWindowColor(): string {
    const color = this.additionalProperties?.sf?.properties.focusedWindowColor;
    if (!color) return EMPTY_OBJ_STRING;
    return color.formattedValue();
  }

  sfRootLabel(): string {
    const rootProps = this.additionalProperties?.sf?.properties.root;
    if (!rootProps) {
      return this.additionalProperties?.sf?.name ?? 'root';
    }

    return rootProps.timestamp;
  }

  wmRootLabel(): string {
    const timestamp =
      this.additionalProperties?.wm?.wmStateProperties.timestamp;
    if (!timestamp) {
      return this.additionalProperties?.wm?.name ?? 'root';
    }
    return timestamp;
  }

  wmHierarchyTree(): HierarchyTreeNode | undefined {
    return this.additionalProperties?.wm?.hierarchyTree;
  }

  wmInsetsSourceProvider(): PropertyTreeNode | undefined {
    return this.additionalProperties?.wm?.wmStateProperties
      .imeInsetsSourceProvider;
  }

  wmControlTargetFrame(): PropertyTreeNode | undefined {
    return this.additionalProperties?.wm?.wmStateProperties.imeInsetsSourceProvider
      ?.getChildByName('insetsSourceProvider')
      ?.getChildByName('controlTarget')
      ?.getChildByName('windowFrames')
      ?.getChildByName('frame');
  }

  wmInsetsSourceProviderPosition(): string {
    return (
      this.additionalProperties?.wm?.wmStateProperties.imeInsetsSourceProvider
        ?.getChildByName('insetsSourceProvider')
        ?.getChildByName('control')
        ?.getChildByName('position')
        ?.formattedValue() ?? 'null'
    );
  }

  wmInsetsSourceProviderIsLeashReady(): string {
    return (
      this.additionalProperties?.wm?.wmStateProperties.imeInsetsSourceProvider
        ?.getChildByName('insetsSourceProvider')
        ?.getChildByName('isLeashReadyForDispatching')
        ?.formattedValue() ?? 'null'
    );
  }

  wmInsetsSourceProviderControllable(): string {
    return (
      this.additionalProperties?.wm?.wmStateProperties.imeInsetsSourceProvider
        ?.getChildByName('insetsSourceProvider')
        ?.getChildByName('controllable')
        ?.formattedValue() ?? 'null'
    );
  }

  wmInsetsSourceProviderSourceFrame(): PropertyTreeNode | undefined {
    return this.additionalProperties?.wm?.wmStateProperties.imeInsetsSourceProvider
      ?.getChildByName('source')
      ?.getChildByName('frame');
  }

  wmInsetsSourceProviderSourceVisible(): string {
    return (
      this.additionalProperties?.wm?.wmStateProperties.imeInsetsSourceProvider
        ?.getChildByName('source')
        ?.getChildByName('visible')
        ?.formattedValue() ?? 'null'
    );
  }

  wmInsetsSourceProviderSourceVisibleFrame(): PropertyTreeNode | undefined {
    return this.additionalProperties?.wm?.wmStateProperties.imeInsetsSourceProvider
      ?.getChildByName('source')
      ?.getChildByName('visibleFrame');
  }

  wmImeControlTarget(): PropertyTreeNode | undefined {
    return this.additionalProperties?.wm?.wmStateProperties.imeControlTarget;
  }

  wmImeControlTargetTitle(): string | undefined {
    return (
      this.additionalProperties?.wm?.wmStateProperties.imeControlTarget
        ?.getChildByName('windowContainer')
        ?.getChildByName('identifier')
        ?.getChildByName('title')
        ?.formattedValue() ?? undefined
    );
  }

  wmImeInputTarget(): PropertyTreeNode | undefined {
    return this.additionalProperties?.wm?.wmStateProperties.imeInputTarget;
  }

  wmImeInputTargetTitle(): string | undefined {
    return (
      this.additionalProperties?.wm?.wmStateProperties.imeInputTarget
        ?.getChildByName('windowContainer')
        ?.getChildByName('identifier')
        ?.getChildByName('title')
        ?.formattedValue() ?? undefined
    );
  }

  wmImeLayeringTarget(): PropertyTreeNode | undefined {
    return this.additionalProperties?.wm?.wmStateProperties.imeLayeringTarget;
  }

  wmImeLayeringTargetTitle(): string | undefined {
    return (
      this.additionalProperties?.wm?.wmStateProperties.imeLayeringTarget
        ?.getChildByName('windowContainer')
        ?.getChildByName('identifier')
        ?.getChildByName('title')
        ?.formattedValue() ?? undefined
    );
  }

  sfImeContainerScreenBounds(): PropertyTreeNode | undefined {
    return (
      this.additionalProperties?.sf?.properties.inputMethodSurface
        ?.screenBounds ?? undefined
    );
  }

  sfImeContainerRect(): PropertyTreeNode | undefined {
    return (
      this.additionalProperties?.sf?.properties.inputMethodSurface?.rect ??
      undefined
    );
  }

  isAllPropertiesUndefined(): boolean {
    if (this.isImeManagerService) {
      return !this.additionalProperties?.wm;
    } else {
      return !(this.additionalProperties?.wm || this.additionalProperties?.sf);
    }
  }

  onClickShowInPropertiesPanelWm(item: TreeNode, name: string) {
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
    const itemWrapper = {
      name,
      treeNode: item,
    };
    const event: CustomEvent = new CustomEvent(
      ViewerEvents.AdditionalPropertySelected,
      {
        bubbles: true,
        detail: {selectedItem: itemWrapper},
      },
    );
    this.elementRef.nativeElement.dispatchEvent(event);
  }
}
