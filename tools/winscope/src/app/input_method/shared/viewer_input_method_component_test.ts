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

import {AbstractHierarchyViewerComponentTest} from '@app/shared/testing/abstract_hierarchy_viewer_component_test';
import {assertDefined} from '@common/assert';
import {DOMTestHelper} from '@common/testing/dom_test_helpers';
import {makePropertyNode} from '@tree_node/testing/tree_node_test_helpers';
import {ImeUiData} from '@ui/input_method/ime_ui_data';
import {AdditionalPropertySelectedDetail} from '@ui/shared/viewers/viewer_event_details';

import {ImeAdditionalPropertiesComponent} from './ime_additional_properties_component';
import {ViewerInputMethodComponent} from './viewer_input_method_component';

class ViewerInputMethodComponentTest extends AbstractHierarchyViewerComponentTest<
  ImeUiData,
  ViewerInputMethodComponent
> {
  protected override readonly testRects = false;
  protected override readonly canPropagateProperties = false;
  protected override readonly supportsPlayback = false;
  protected override readonly hierarchyTitle = 'HIERARCHY';
  protected override readonly propertiesTitle = 'PROPERTIES';

  protected override executeSpecializedTests() {
    describe('Specialized tests', () => {
      let dom: DOMTestHelper<ViewerInputMethodComponent>;
      let component: ViewerInputMethodComponent;

      beforeEach(async () => {
        [dom, component] = await this.setUpTestEnvironment();
      });

      it('creates additional properties view', () => {
        expect(dom.find('.ime-additional-properties')).toBeDefined();
      });

      it('binds ime additional properties view events to output signals', () => {
        const imeAdditionalProperties = assertDefined(
          dom.findByDirective(ImeAdditionalPropertiesComponent),
        );

        const highlightedSpy = spyOn(component.onHighlightedIdChange, 'emit');
        const id = 'test';
        imeAdditionalProperties.highlightedIdChange.emit(id);
        expect(highlightedSpy).toHaveBeenCalledOnceWith(id);

        const additionalPropertySpy = spyOn(
          component.onAdditionalPropertySelected,
          'emit',
        );
        const node = makePropertyNode('id', 'name', 'value');
        const detail = new AdditionalPropertySelectedDetail('', node);
        imeAdditionalProperties.additionalPropertySelected.emit(detail);
        expect(additionalPropertySpy).toHaveBeenCalledOnceWith(detail);
      });

      it('handles ime additional properties section collapse/expand', () => {
        dom.checkSectionCollapseAndExpand(
          '.ime-additional-properties',
          'WM & SF PROPERTIES',
        );
      });
    });
  }

  protected override async setUpTestEnvironment(): Promise<
    [DOMTestHelper<ViewerInputMethodComponent>, ViewerInputMethodComponent]
  > {
    return this.initializeTestEnvironment(ViewerInputMethodComponent, [
      ImeAdditionalPropertiesComponent,
    ]);
  }
}

describe('ViewerInputMethodComponent', () => {
  new ViewerInputMethodComponentTest().execute();
});
