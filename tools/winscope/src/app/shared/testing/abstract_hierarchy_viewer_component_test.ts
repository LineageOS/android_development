/*
 * Copyright (C) 2025 The Android Open Source Project
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
import {provideHttpClient, withInterceptorsFromDi} from '@angular/common/http';
import {Type} from '@angular/core';
import {ComponentFixtureAutoDetect, TestBed} from '@angular/core/testing';
import {FormsModule} from '@angular/forms';
import {MatButtonModule} from '@angular/material/button';
import {MatCheckboxModule} from '@angular/material/checkbox';
import {MatDividerModule} from '@angular/material/divider';
import {MatFormFieldModule} from '@angular/material/form-field';
import {MatIconModule} from '@angular/material/icon';
import {MatInputModule} from '@angular/material/input';
import {MatSelectModule} from '@angular/material/select';
import {MatSliderModule} from '@angular/material/slider';
import {MatTooltipModule} from '@angular/material/tooltip';
import {BrowserAnimationsModule} from '@angular/platform-browser/animations';
import {HierarchyComponent} from '@app/shared/hierarchy/hierarchy_component';
import {HierarchyViewerComponent} from '@app/shared/hierarchy/hierarchy_viewer_component';
import {PropertiesComponent} from '@app/shared/properties/properties_component';
import {RectsComponent} from '@app/shared/rects/rects_component';
import {assertDefined} from '@common/assert';
import {DOMTestHelper} from '@common/testing/dom_test_helpers';
import {makeElapsedTimestamp} from '@common/time/testing/test_helpers';
import {makeUiHierarchyNode} from '@ui/shared/hierarchy/testing/ui_hierarchy_tree_node_test_helpers';
import {UiDataHierarchy} from '@ui/shared/hierarchy/ui_data_hierarchy';
import {makeUiPropertyNode} from '@ui/shared/properties/testing/ui_property_tree_node_test_helpers';
import {RectShowState} from '@ui/shared/rects/rect_show_state';
import {TextFilter} from '@ui/shared/user_input/text_filter';
import {RectShowStateChangeDetail, TimestampClickDetail,} from '@ui/shared/viewers/viewer_event_details';

export abstract class AbstractHierarchyViewerComponentTest<
  U extends UiDataHierarchy,
  T extends HierarchyViewerComponent<U>,
> {
  execute() {
    describe('Hierarchy viewer component', () => {
      let dom: DOMTestHelper<T>;

      let component: T;

      beforeEach(async () => {
        [dom, component] = await this.setUpTestEnvironment();
      });

      it('creates hierarchy view', () => {
        expect(dom.find('.hierarchy-view')).toBeDefined();
      });

      it('binds hierarchy view events to output signals', () => {
        const hierarchy = assertDefined(
          dom.findByDirective(HierarchyComponent),
        );

        const filterChangeSpy = spyOn(
          component.onHierarchyFilterChange,
          'emit',
        );
        const filter = new TextFilter();
        hierarchy.filterChange.emit(filter);
        expect(filterChangeSpy).toHaveBeenCalledOnceWith(filter);

        const nodeChangeSpy = spyOn(component.onHighlightedNodeChange, 'emit');
        const node = makeUiHierarchyNode({name: 'test'});
        hierarchy.highlightedNodeChange.emit(node);
        expect(nodeChangeSpy).toHaveBeenCalledOnceWith(node);

        const pinnedChangeSpy = spyOn(
          component.onHierarchyPinnedChange,
          'emit',
        );
        hierarchy.pinnedItemChange.emit(node);
        expect(pinnedChangeSpy).toHaveBeenCalledOnceWith(node);

        const optionsChangeSpy = spyOn(
          component.onHierarchyUserOptionsChange,
          'emit',
        );
        const options = {opt: {name: 'opt', enabled: true}};
        hierarchy.optionsChange.emit(options);
        expect(optionsChangeSpy).toHaveBeenCalledOnceWith(options);

        const rectChangeSpy = spyOn(component.onRectShowStateChange, 'emit');
        const detail = new RectShowStateChangeDetail('', RectShowState.HIDE);
        hierarchy.rectShowStateChange.emit(detail);
        if (this.testRects) {
          expect(rectChangeSpy).toHaveBeenCalledOnceWith(detail);
        } else {
          expect(rectChangeSpy).not.toHaveBeenCalled();
        }
      });

      it('creates properties view', () => {
        expect(dom.find('.properties-view')).toBeDefined();
      });

      it('binds properties view events to output signals', () => {
        const properties = assertDefined(
          dom.findByDirective(PropertiesComponent),
        );

        const filterChangeSpy = spyOn(
          component.onPropertiesFilterChange,
          'emit',
        );
        const filter = new TextFilter();
        properties.filterChange.emit(filter);
        expect(filterChangeSpy).toHaveBeenCalledOnceWith(filter);

        const optionsChangeSpy = spyOn(
          component.onPropertiesUserOptionsChange,
          'emit',
        );
        const options = {opt: {name: 'opt', enabled: true}};
        properties.optionsChange.emit(options);
        expect(optionsChangeSpy).toHaveBeenCalledOnceWith(options);

        const highlightedPropertyChangeSpy = spyOn(
          component.onHighlightedPropertyChange,
          'emit',
        );
        properties.highlightedPropertyChange.emit('test');
        expect(highlightedPropertyChangeSpy).toHaveBeenCalledOnceWith('test');

        const timestampClickSpy = spyOn(component.onTimestampClick, 'emit');
        const detail = new TimestampClickDetail(
          undefined,
          makeElapsedTimestamp(2n),
        );
        properties.timestampClick.emit(detail);
        expect(timestampClickSpy).toHaveBeenCalledOnceWith(detail);

        const propagatePropertyClickSpy = spyOn(
          component.onPropagatePropertyClick,
          'emit',
        );
        const node = makeUiPropertyNode('id', 'name', false);
        properties.propagatePropertyClick.emit(node);

        if (this.canPropagateProperties) {
          expect(propagatePropertyClickSpy).toHaveBeenCalledOnceWith(node);
        } else {
          expect(propagatePropertyClickSpy).not.toHaveBeenCalled();
        }
      });

      it('creates collapsed sections with no buttons', () => {
        dom.checkNoCollapsedSectionButtons();
      });

      it('handles hierarchy section collapse/expand', () => {
        dom.checkSectionCollapseAndExpand(
          '.hierarchy-view',
          this.hierarchyTitle,
        );
      });

      it('handles properties section collapse/expand', () => {
        dom.checkSectionCollapseAndExpand(
          this.propertiesSelector,
          this.propertiesTitle,
        );
      });

      if (this.testRects) {
        it('creates rects view', () => {
          expect(dom.find('.rects-view')).toBeDefined();
        });

        it('handles rects section collapse/expand', () => {
          dom.checkSectionCollapseAndExpand(
            '.rects-view',
            assertDefined(this.rectsTitle),
          );
        });

        it('binds rects view events to output signals', () => {
          const rects = assertDefined(dom.findByDirective(RectsComponent));

          const highlightedIdChangeSpy = spyOn(
            component.onHighlightedIdChange,
            'emit',
          );
          const id = 'test';
          rects.highlightedIdChange.emit(id);
          expect(highlightedIdChangeSpy).toHaveBeenCalledOnceWith(id);

          const optionsChangeSpy = spyOn(
            component.onRectsUserOptionsChange,
            'emit',
          );
          const options = {opt: {name: 'opt', enabled: true}};
          rects.optionsChange.emit(options);
          expect(optionsChangeSpy).toHaveBeenCalledOnceWith(options);
        });
      }

      if (this.supportsPlayback) {
        it('disables properties while playback is playing', async () => {
          let inputData = assertDefined(this.getUiDataForPlaybackTests?.());
          inputData.isPlaybackPlaying = true;
          dom.setComponentInput('inputData', inputData);
          dom.detectChanges();
          const properties = dom.find('.properties');
          expect(properties).toBeDefined();
          assertDefined(properties).checkClassName('disabled-component');

          inputData = assertDefined(this.getUiDataForPlaybackTests?.());
          inputData.isPlaybackPlaying = false;
          dom.setComponentInput('inputData', inputData);
          dom.detectChanges();
          expect(properties).toBeDefined();
          assertDefined(properties).checkClassName('disabled-component', false);
        });

        it('disables UI while playback is initializing', async () => {
          let uiData = assertDefined(this.getUiDataForPlaybackTests?.());
          uiData.isPlaybackPlaying = false;
          uiData.isPlaybackInitializing = true;
          dom.setComponentInput('inputData', uiData);
          dom.detectChanges();

          const properties = dom.get('.properties');
          properties.checkClassName('disabled-component');

          const hierarchy = dom.get('.hierarchy-view');
          hierarchy.checkClassName('disabled-component');

          const rects = dom.get('.rects-view');
          rects.checkClassName('disabled-component');

          uiData = assertDefined(this.getUiDataForPlaybackTests?.());
          uiData.isPlaybackPlaying = true;
          uiData.isPlaybackInitializing = false;
          dom.setComponentInput('inputData', uiData);
          dom.detectChanges();

          properties.checkClassName('disabled-component', true);
          hierarchy.checkClassName('disabled-component', false);
          rects.checkClassName('disabled-component', false);
        });
      }
    });

    if (this.executeSpecializedTests) {
      this.executeSpecializedTests();
    }
  }

  protected async initializeTestEnvironment<U extends T>(
    typeofViewer: Type<U>,
    _addedDeclarations: object[] = [],
  ): Promise<[DOMTestHelper<U>, U]> {
    await TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptorsFromDi()),
        {provide: ComponentFixtureAutoDetect, useValue: true},
      ],
      imports: [
        CommonModule,
        MatIconModule,
        MatDividerModule,
        MatCheckboxModule,
        MatSliderModule,
        MatFormFieldModule,
        MatInputModule,
        BrowserAnimationsModule,
        FormsModule,
        MatTooltipModule,
        MatButtonModule,
        MatSelectModule,
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent<U>(typeofViewer);
    const component = fixture.componentInstance;
    const dom = new DOMTestHelper(fixture, fixture.nativeElement);
    dom.detectChanges();
    return [dom, component];
  }

  protected abstract readonly testRects: boolean;
  protected abstract readonly canPropagateProperties: boolean;
  protected abstract readonly supportsPlayback: boolean;
  protected abstract readonly hierarchyTitle: string;
  protected abstract readonly propertiesTitle: string;
  protected readonly rectsTitle?: string;
  protected readonly propertiesSelector: string = '.properties-view';

  protected abstract setUpTestEnvironment(): Promise<[DOMTestHelper<T>, T]>;
  protected executeSpecializedTests?(): void;
  protected getUiDataForPlaybackTests?(): U;
}
