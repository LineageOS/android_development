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

import {ClipboardModule} from '@angular/cdk/clipboard';
import {CdkVirtualScrollViewport, ScrollingModule,} from '@angular/cdk/scrolling';
import {provideHttpClient, withInterceptorsFromDi} from '@angular/common/http';
import {Type} from '@angular/core';
import {ComponentFixtureAutoDetect, fakeAsync, TestBed, tick,} from '@angular/core/testing';
import {FormsModule} from '@angular/forms';
import {MatButtonModule} from '@angular/material/button';
import {MatDividerModule} from '@angular/material/divider';
import {MatFormFieldModule} from '@angular/material/form-field';
import {MatIconModule} from '@angular/material/icon';
import {MatIconTestingModule} from '@angular/material/icon/testing';
import {MatInputModule} from '@angular/material/input';
import {MatProgressSpinnerModule} from '@angular/material/progress-spinner';
import {MatSelectModule} from '@angular/material/select';
import {MatSliderModule} from '@angular/material/slider';
import {MatTooltipModule} from '@angular/material/tooltip';
import {NoopAnimationsModule} from '@angular/platform-browser/animations';
import {ViewerInputComponent} from '@app/input/viewer_input_component';
import {ViewerJankCujsComponent} from '@app/jank_cujs/viewer_jank_cujs_component';
import {ViewerProtologComponent} from '@app/protolog/viewer_protolog_component';
import {CollapsedSectionsComponent} from '@app/shared/collapsible_sections/collapsed_sections_component';
import {CollapsibleSectionTitleComponent} from '@app/shared/collapsible_sections/collapsible_section_title_component';
import {LogComponent} from '@app/shared/log_view/log_component';
import {SelectWithFilterComponent} from '@app/shared/log_view/select_with_filter_component';
import {PropertiesComponent} from '@app/shared/properties/properties_component';
import {PropertyTreeNodeDataViewComponent} from '@app/shared/properties/property_tree_node_data_view_component';
import {VirtualRow, VirtualScrollViewportComponent,} from '@app/shared/scroll/virtual_scroll_viewport_component';
import {SearchBoxComponent} from '@app/shared/search_box/search_box_component';
import {TreeComponent} from '@app/shared/tree/tree_component';
import {TreeNodeComponent} from '@app/shared/tree/tree_node_component';
import {ViewerTransactionsComponent} from '@app/transactions/viewer_transactions_component';
import {ViewerTransitionsComponent} from '@app/transitions/viewer_transitions_component';
import {assertDefined} from '@common/assert';
import {DOMTestHelper} from '@common/testing/dom_test_helpers';
import {makeElapsedTimestamp} from '@common/time/testing/test_helpers';
import {ColumnSpec, LogField, LogHeader, UiDataLog,} from '@ui/shared/log/ui_data_log';
import {TextFilter} from '@ui/shared/user_input/text_filter';
import {LogFilterChangeDetail, TimestampClickDetail,} from '@ui/shared/viewers/viewer_event_details';

type LogViewerComponent =
  | ViewerProtologComponent
  | ViewerTransactionsComponent
  | ViewerTransitionsComponent
  | ViewerInputComponent
  | ViewerJankCujsComponent;

export abstract class AbstractLogViewerComponentTest<
  T extends LogViewerComponent,
> {
  protected readonly testSpec: ColumnSpec = {
    name: 'Test Column',
    cssClass: 'test-class',
  };
  protected readonly testField = new LogField(this.testSpec, 'VALUE');

  execute() {
    describe('Log viewer component', () => {
      describe('common', () => {
        let dom: DOMTestHelper<T>;
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        let viewport: VirtualScrollViewportComponent;
        let component: T;

        beforeEach(async () => {
          [dom, viewport, component] = await this.setUpTestEnvironment();
        });

        it('can be created', () => {
          expect(component).toBeTruthy();
        });

        it('renders log component', () => {
          expect(dom.find('.log-view')).toBeDefined();
        });

        it('binds log viewer events to output signals', () => {
          const logComponent = assertDefined(component.logComponent());

          const logFilterSpy = spyOn(component.onLogFilterChange, 'emit');
          const filterDetail = new LogFilterChangeDetail(
            new LogHeader(this.testSpec),
            [],
          );
          logComponent.logFilterChange.emit(filterDetail);
          if (this.hasFilters) {
            expect(logFilterSpy).toHaveBeenCalledOnceWith(filterDetail);
          } else {
            expect(logFilterSpy).not.toHaveBeenCalled();
          }

          const clickSpy = spyOn(component.onLogEntryClick, 'emit');
          logComponent.logEntryClick.emit(0);
          expect(clickSpy).toHaveBeenCalledOnceWith(0);

          const timestampClickSpy = spyOn(component.onTimestampClick, 'emit');
          const ts = makeElapsedTimestamp(2n);
          const tsDetail = new TimestampClickDetail(undefined, ts);
          logComponent.timestampClick.emit(tsDetail);
          expect(timestampClickSpy).toHaveBeenCalledOnceWith(tsDetail);

          const arrowDownSpy = spyOn(component.onArrowDownPress, 'emit');
          logComponent.arrowDownPress.emit();
          expect(arrowDownSpy).toHaveBeenCalledOnceWith();

          const arrowUpSpy = spyOn(component.onArrowUpPress, 'emit');
          logComponent.arrowUpPress.emit();
          expect(arrowUpSpy).toHaveBeenCalledOnceWith();
        });

        it('render headers as filters', () => {
          const selector = `.headers .filter.${
            this.testSpec.cssClass.split(' ')[0]
          }`;
          expect(dom.find(selector) !== undefined).toEqual(this.hasFilters);
        });

        it('renders entries with field values', () => {
          const entry = dom.get(
            `.scroll .entry .${this.testSpec.cssClass.split(' ')[0]}`,
          );
          entry.checkText('VALUE');
          this.checkTimestampInTable(dom);
        });

        it('handles go to current time button', () => {
          expect(
            dom.find('.time-controls') !== undefined ||
              dom.find('.time-controls-trigger') !== undefined,
          ).toEqual(this.hasTimeControls);
        });

        it('passes data to log component', () => {
          const logComponent = assertDefined(component.logComponent());
          expect(logComponent.isFetchingData()).toBeFalse();
          expect(logComponent.checkScrollViewportCount()).toBe(0);
          expect(logComponent.selectedIndex()).not.toBe(10);
          expect(logComponent.scrollToIndex()).not.toBe(20);
          expect(logComponent.currentIndex()).not.toBe(30);

          const inputData = assertDefined(component.inputData());
          inputData.checkScrollViewportCount = 1;
          inputData.isFetchingData = true;
          inputData.selectedIndex = 10;
          inputData.scrollToIndex = 20;
          inputData.currentIndex = 30;
          dom.detectChanges();

          expect(logComponent.isFetchingData()).toBeTrue();
          expect(logComponent.checkScrollViewportCount()).toBe(1);
          expect(logComponent.selectedIndex()).toBe(10);
          expect(logComponent.scrollToIndex()).toBe(20);
          expect(logComponent.currentIndex()).toBe(30);
        });

        if (this.testProperties) {
          it('renders properties', () => {
            expect(dom.find('.properties-view')).toBeDefined();
          });

          it('binds properties events to output signals', () => {
            const propertiesComponent = assertDefined(
              dom.findByDirective(PropertiesComponent),
            );
            const filterSpy = spyOn(component.onPropertiesFilterChange, 'emit');
            const filter = new TextFilter('');
            propertiesComponent.filterChange.emit(filter);
            expect(filterSpy).toHaveBeenCalledOnceWith(filter);

            const optionsSpy = spyOn(
              component.onPropertiesUserOptionsChange,
              'emit',
            );
            const options = {opt: {name: 'opt', enabled: true}};
            propertiesComponent.optionsChange.emit(options);
            expect(optionsSpy).toHaveBeenCalledOnceWith(options);
          });

          it('creates collapsed sections with no buttons', () => {
            dom.checkNoCollapsedSectionButtons();
          });

          it('handles properties section collapse/expand', () => {
            dom.checkSectionCollapseAndExpand(
              '.properties-view',
              assertDefined(this.propertiesSectionTitle),
            );
          });

          it('shows message when no entry is selected', () => {
            const data = assertDefined(component.inputData());
            (data as UiDataLog).propertyNodes = undefined;
            dom.detectChanges();
            dom
              .get('.properties-view .placeholder-text')
              .checkTextExact(assertDefined(this.propertiesPlaceholder));
          });
        }
      });

      if (this.testScroll) {
        describe('scroll', () => {
          let dom: DOMTestHelper<T>;
          let component: T;

          beforeEach(async () => {
            const res = this.setUpTestEnvironmentForScroll
              ? await this.setUpTestEnvironmentForScroll()
              : await this.setUpTestEnvironment();
            dom = res[0];
            component = res[2];
          });

          it('renders initial state', () => {
            expect(dom.findAll('.entry').length).toEqual(
              assertDefined(this.initialEntries),
            );
          });

          it('should scroll to index in large jumps', fakeAsync(() => {
            component
              .logComponent()
              ?.virtualScrollViewport()
              .checkViewportSize();
            dom.whenStable();
            dom.whenRenderingDone();
            tick(100);

            expect(dom.find(`.entry[item-id="25"]`)).toBeUndefined();
            checkScrollToIndex(25);
            tick(100);
            expect(dom.find(`.entry[item-id="25"]`)).toBeDefined();

            expect(dom.find(`.entry[item-id="70"]`)).toBeUndefined();
            checkScrollToIndex(70);
            tick(100);
            expect(dom.find(`.entry[item-id="70"]`)).toBeDefined();
          }));

          async function checkScrollToIndex(i: number): Promise<void> {
            const uiData = assertDefined(component.inputData());
            uiData.scrollToIndex = i;
            dom.setComponentInput('inputData', uiData);
            dom.detectChanges();
            await dom.whenStable();
            await dom.whenRenderingDone();
          }
        });
      }
    });

    if (this.executeSpecializedTests) {
      this.executeSpecializedTests();
    }
  }

  protected async initializeTestEnvironment<U extends T>(
    initialUiData: UiDataLog,
    typeofViewer: Type<U>,
    addedImports: object[] = [],
  ): Promise<[DOMTestHelper<U>, VirtualScrollViewportComponent, U]> {
    const imports: object[] = [
      typeofViewer,
      VirtualRow,
      VirtualScrollViewportComponent,
      TreeComponent,
      TreeNodeComponent,
      PropertyTreeNodeDataViewComponent,
      SelectWithFilterComponent,
      CdkVirtualScrollViewport,
      SearchBoxComponent,
      LogComponent,
      MatDividerModule,
      ScrollingModule,
      MatIconModule,
      ClipboardModule,
      MatFormFieldModule,
      MatButtonModule,
      MatInputModule,
      NoopAnimationsModule,
      FormsModule,
      MatSelectModule,
      MatTooltipModule,
      MatSliderModule,
      MatProgressSpinnerModule,
      MatIconTestingModule,
    ];
    if (addedImports) {
      imports.push(...addedImports);
    }
    if (this.testProperties) {
      imports.push(
        ...[
          CollapsedSectionsComponent,
          CollapsibleSectionTitleComponent,
          PropertiesComponent,
        ],
      );
    }
    await TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptorsFromDi()),
        {provide: ComponentFixtureAutoDetect, useValue: true},
      ],
      imports,
    }).compileComponents();

    const fixture = TestBed.createComponent<U>(typeofViewer);
    const component = fixture.componentInstance;
    const dom = new DOMTestHelper(fixture, fixture.nativeElement);
    dom.setComponentInput('inputData', initialUiData);
    dom.detectChanges();
    const scrollElement = dom.get('.scroll').getHTMLElement();
    scrollElement.style.minHeight = '360px';
    scrollElement.style.maxHeight = '360px';
    scrollElement.style.minWidth = '1440px';
    scrollElement.style.maxWidth = '1440px';
    const logElement = dom.get('.entries').getHTMLElement();
    logElement.style.minHeight = '360px';
    logElement.style.maxHeight = '360px';
    logElement.style.minWidth = '1440px';
    logElement.style.maxWidth = '1440px';
    dom.detectChanges();
    const viewport = assertDefined(
      component.logComponent()?.virtualScrollViewport(),
    );
    viewport.checkViewportSize();
    dom.detectChanges();
    return [dom, viewport, component];
  }

  protected abstract readonly testProperties: boolean;
  protected abstract readonly hasTimeControls: boolean;
  protected abstract readonly testScroll: boolean;
  protected readonly hasFilters: boolean = true;
  protected readonly propertiesSectionTitle?: string;
  protected readonly propertiesPlaceholder?: string;
  protected readonly initialEntries?: number;

  protected abstract setUpTestEnvironment(): Promise<
    [DOMTestHelper<T>, VirtualScrollViewportComponent, T]
  >;
  protected abstract checkTimestampInTable(dom: DOMTestHelper<T>): void;
  protected setUpTestEnvironmentForScroll?(): Promise<
    [DOMTestHelper<T>, VirtualScrollViewportComponent, T]
  >;
  protected executeSpecializedTests?(): void;
}
