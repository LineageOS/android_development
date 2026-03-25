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
import {TraceRectType} from '@ui/shared/rects/rect_spec';
import {UiData} from '@ui/surface_flinger/ui_data';

import {SurfaceFlingerPropertyGroupsComponent} from './surface_flinger_property_groups_component';
import {ViewerSurfaceFlingerComponent} from './viewer_surface_flinger_component';

class ViewerSurfaceFlingerComponentTest extends AbstractHierarchyViewerComponentTest<
  UiData,
  ViewerSurfaceFlingerComponent
> {
  protected override readonly testRects = true;
  protected override readonly canPropagateProperties = true;
  protected override readonly supportsPlayback = true;
  protected override readonly hierarchyTitle = 'HIERARCHY';
  protected override readonly propertiesTitle = 'PROTO DUMP';
  protected override readonly rectsTitle = 'LAYERS';

  protected override executeSpecializedTests() {
    describe('Specialized tests', () => {
      let dom: DOMTestHelper<ViewerSurfaceFlingerComponent>;
      let component: ViewerSurfaceFlingerComponent;

      beforeEach(async () => {
        [dom, component] = await this.setUpTestEnvironment();
      });

      it('creates property groups view', () => {
        expect(dom.find('.property-groups')).toBeDefined();
      });

      it('handles property groups section collapse/expand', () => {
        dom.checkSectionCollapseAndExpand('.property-groups', 'PROPERTIES');
      });

      it('binds rects view events to output signals', () => {
        const rects = assertDefined(dom.findByDirective(RectsComponent));

        const rectsDblClickSpy = spyOn(component.onRectsDblClick, 'emit');
        const id = 'test';
        rects.rectsDblClick.emit(id);
        expect(rectsDblClickSpy).toHaveBeenCalledOnceWith(id);

        const rectTypeClickSpy = spyOn(component.onRectTypeButtonClick, 'emit');
        const type = TraceRectType.LAYERS;
        rects.rectTypeButtonClick.emit(type);
        expect(rectTypeClickSpy).toHaveBeenCalledOnceWith(type);
      });

      it('binds highlighted id event to output signal from property groups', () => {
        const propertyGroups = assertDefined(
          dom.findByDirective(SurfaceFlingerPropertyGroupsComponent),
        );
        const spy = spyOn(component.onHighlightedIdChange, 'emit');
        const id = 'test';
        propertyGroups.highlightedIdChange.emit(id);
        expect(spy).toHaveBeenCalledOnceWith(id);
      });

      it('handles rect type change in input', () => {
        let uiData = new UiData(undefined);
        uiData.rectSpec = {
          type: TraceRectType.LAYERS,
          icon: '',
          legend: [],
        };
        dom.setComponentInput('inputData', uiData);
        dom.detectChanges();

        dom.checkSectionCollapseAndExpand(
          '.rects-view',
          TraceRectType.LAYERS.toUpperCase(),
        );

        uiData = new UiData(undefined);
        uiData.rectSpec = {
          type: TraceRectType.INPUT_WINDOWS,
          icon: '',
          legend: [],
        };
        dom.setComponentInput('inputData', uiData);
        dom.detectChanges();
        dom.checkSectionCollapseAndExpand(
          '.rects-view',
          TraceRectType.INPUT_WINDOWS.toUpperCase(),
        );
      });
    });
  }

  protected override async setUpTestEnvironment(): Promise<
    [
      DOMTestHelper<ViewerSurfaceFlingerComponent>,
      ViewerSurfaceFlingerComponent,
    ]
  > {
    return this.initializeTestEnvironment(ViewerSurfaceFlingerComponent, [
      ViewerSurfaceFlingerComponent,
      SurfaceFlingerPropertyGroupsComponent,
    ]);
  }

  protected override getUiDataForPlaybackTests(): UiData {
    return new UiData(undefined);
  }
}

describe('ViewerSurfaceFlingerComponent', () => {
  new ViewerSurfaceFlingerComponentTest().execute();
});
