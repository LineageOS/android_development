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
import {Component} from '@angular/core';
import {TestBed} from '@angular/core/testing';
import {MatButtonModule} from '@angular/material/button';
import {MatDividerModule} from '@angular/material/divider';
import {MatIconModule} from '@angular/material/icon';
import {MatTooltipModule} from '@angular/material/tooltip';
import {DOMTestHelper} from 'test/unit/dom_test_helpers';
import {
  makeHierarchyNode,
  makePropertyNode,
} from 'test/unit/tree_node_test_helpers';
import {ImeAdditionalProperties} from 'viewers/common/ime_additional_properties';
import {ViewerEvents} from 'viewers/common/viewer_events';
import {CollapsibleSectionTitleComponent} from './collapsible_section_title_component';
import {CoordinatesTableComponent} from './coordinates_table_component';
import {ImeAdditionalPropertiesComponent} from './ime_additional_properties_component';

describe('ImeAdditionalPropertiesComponent', () => {
  let component: TestHostComponent;
  let dom: DOMTestHelper<TestHostComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        MatDividerModule,
        MatIconModule,
        MatButtonModule,
        MatTooltipModule,
        ImeAdditionalPropertiesComponent,
        TestHostComponent,
        CollapsibleSectionTitleComponent,
        CoordinatesTableComponent,
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(TestHostComponent);
    component = fixture.componentInstance;
    dom = new DOMTestHelper(fixture, fixture.nativeElement);
    dom.addEventListener(
      ViewerEvents.HighlightedNodeChange,
      component.onHighlightedNodeChange,
    );
    dom.addEventListener(
      ViewerEvents.HighlightedIdChange,
      component.onHighlightedIdChange,
    );
    dom.addEventListener(
      ViewerEvents.AdditionalPropertySelected,
      component.onAdditionalPropertySelectedChange,
    );
    dom.detectChanges();
  });

  it('can be created', () => {
    expect(component).toBeTruthy();
  });

  it('shows client or service sf properties', () => {
    expect(dom.find('.ime-container')).toBeDefined();
    expect(dom.find('.input-method-surface')).toBeDefined();
  });

  it('renders placeholder text', () => {
    component.additionalProperties = undefined;
    dom.detectChanges();
    dom.get('.placeholder-text').checkTextExact('No IME entry found.');
  });

  it('emits update additional property tree event on wm state button click', () => {
    const button = dom.get('.wm-state-button');
    button.checkClassName('selected', false);
    button.click();
    expect(component.additionalPropertieTreeName).toEqual(
      'Window Manager State',
    );
    button.checkClassName('selected', true);
  });

  it('propagates new ime container layer on button click', () => {
    const button = dom.get('.ime-container-button');
    button.checkClassName('selected', false);
    button.click();
    expect(component.highlightedItem).toBe('123');
    button.checkClassName('selected', true);
  });

  it('propagates new input method surface layer on button click', () => {
    const button = dom.get('.input-method-surface-button');
    button.checkClassName('selected', false);
    button.click();
    expect(component.highlightedItem).toBe('456');
    button.checkClassName('selected', true);
  });

  it('shows ime manager service wm properties', () => {
    component.isImeManagerService = true;
    dom.detectChanges();
    const imeManagerService = dom.get('.ime-manager-service');
    imeManagerService
      .get('.wm-state')
      .checkTextExact('1970-01-01, 00:00:00.000000000');
    expect(dom.find('.ime-control-target-button')).toBeDefined();
  });

  it('propagates new property tree node window on button click', () => {
    component.isImeManagerService = true;
    dom.detectChanges();
    const button = dom.get('.ime-control-target-button');
    button.checkClassName('selected', false);
    button.click();
    expect(component.additionalPropertieTreeName).toBe('Ime Control Target');
    button.checkClassName('selected', true);
  });

  it('handles collapse button click', () => {
    expect(component.collapseButtonClicked).toBeFalse();
    dom.findAndClick('collapsible-section-title button');
    expect(component.collapseButtonClicked).toBeTrue();
  });

  @Component({
    imports: [ImeAdditionalPropertiesComponent],
    selector: 'host-component',
    template: `
      <ime-additional-properties
        [highlightedItem]="highlightedItem"
        [isImeManagerService]="isImeManagerService"
        [additionalProperties]="additionalProperties"
        (collapseButtonClicked)="onCollapseButtonClick()"></ime-additional-properties>
    `,
  })
  class TestHostComponent {
    isImeManagerService = false;

    additionalProperties: ImeAdditionalProperties | undefined =
      new ImeAdditionalProperties(
        {
          id: 'wmStateId',
          name: 'wmState',
          wmStateProperties: {
            timestamp: '1970-01-01, 00:00:00.000000000',
            focusedApp: 'exampleFocusedApp',
            focusedWindow: undefined,
            focusedActivity: undefined,
            isInputMethodWindowVisible: false,
            imeControlTarget: makePropertyNode(
              'DisplayContent.inputMethodControlTarget',
              'inputMethodControlTarget',
              undefined,
            ),
            imeInputTarget: undefined,
            imeLayeringTarget: undefined,
            imeInsetsSourceProvider: undefined,
          },
          hierarchyTree: makeHierarchyNode({
            name: 'wmStateProto',
          }),
        },
        {
          id: 'ime',
          name: 'imeLayers',
          properties: {
            imeContainer: {
              id: '123',
              zOrderRelativeOfId: -1,
              z: 0,
            },
            inputMethodSurface: {
              id: '456',
              isVisible: false,
            },
            focusedWindowColor: undefined,
            root: undefined,
          },
          taskLayerOfImeContainer: undefined,
          taskLayerOfImeSnapshot: undefined,
        },
      );
    highlightedItem = '';
    additionalPropertieTreeName: string | undefined;
    collapseButtonClicked = false;

    onHighlightedNodeChange = (event: Event) => {
      this.highlightedItem = (event as CustomEvent).detail.node.id;
    };
    onHighlightedIdChange = (event: Event) => {
      this.highlightedItem = (event as CustomEvent).detail.id;
    };
    onAdditionalPropertySelectedChange = (event: Event) => {
      this.highlightedItem = (
        event as CustomEvent
      ).detail.selectedItem.treeNode.id;
      this.additionalPropertieTreeName = (
        event as CustomEvent
      ).detail.selectedItem.name;
    };

    onCollapseButtonClick() {
      this.collapseButtonClicked = true;
    }
  }
});
