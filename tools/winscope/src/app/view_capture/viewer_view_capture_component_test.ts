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

import {RectsComponent} from '@app/shared/rects/rects_component';
import {AbstractHierarchyViewerComponentTest} from '@app/shared/testing/abstract_hierarchy_viewer_component_test';
import {assertDefined} from '@common/assert';
import {DOMTestHelper} from '@common/testing/dom_test_helpers';
import {VcCuratedProperties} from '@ui/shared/properties/curated_properties';
import {UiData} from '@ui/view_capture/ui_data';

import {ViewerViewCaptureComponent} from './viewer_view_capture_component';

class ViewerViewCaptureComponentTest extends AbstractHierarchyViewerComponentTest<
  UiData,
  ViewerViewCaptureComponent
> {
  protected override readonly testRects = true;
  protected override readonly canPropagateProperties = true;
  protected override readonly supportsPlayback = false;
  protected override readonly hierarchyTitle = 'HIERARCHY';
  protected override readonly propertiesTitle = 'PROPERTIES';
  protected override readonly rectsTitle = 'SKETCH';

  protected override executeSpecializedTests() {
    describe('Specialized tests', () => {
      let dom: DOMTestHelper<ViewerViewCaptureComponent>;
      let component: ViewerViewCaptureComponent;

      beforeEach(async () => {
        [dom, component] = await this.setUpTestEnvironment();
      });

      it('binds rects view events to output signals', () => {
        const rects = assertDefined(dom.findByDirective(RectsComponent));
        const miniRectSpy = spyOn(component.onMiniRectsDblClick, 'emit');
        rects.miniRectsDblClick.emit();
        expect(miniRectSpy).toHaveBeenCalledTimes(1);
      });

      it('injects curated view into properties component', async () => {
        const curatedProperties = jasmine.createSpyObj<VcCuratedProperties>(
          'curatedProperties',
          [],
          {className: 'test class'},
        );
        const uiData = new UiData(undefined, curatedProperties);
        dom.setComponentInput('inputData', uiData);
        dom.detectChanges();
        expect(
          dom.find('.properties-view view-capture-property-groups'),
        ).toBeDefined();
      });
    });
  }

  protected override async setUpTestEnvironment(): Promise<
    [DOMTestHelper<ViewerViewCaptureComponent>, ViewerViewCaptureComponent]
  > {
    return this.initializeTestEnvironment(ViewerViewCaptureComponent);
  }
}

describe('ViewerViewCaptureComponent', () => {
  new ViewerViewCaptureComponentTest().execute();
});
