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

import {OverlayModule} from '@angular/cdk/overlay';
import {CommonModule} from '@angular/common';
import {ChangeDetectorRef, Component, computed, effect, ElementRef, Inject, input, NgZone, signal,} from '@angular/core';
import {FormControl, ReactiveFormsModule, ValidationErrors, Validators,} from '@angular/forms';
import {MatButtonModule} from '@angular/material/button';
import {MatDividerModule} from '@angular/material/divider';
import {MatFormFieldModule} from '@angular/material/form-field';
import {MatIconModule} from '@angular/material/icon';
import {MatInputModule} from '@angular/material/input';
import {MatTabsModule} from '@angular/material/tabs';
import {MatTooltipModule} from '@angular/material/tooltip';
import {FilterPresetApplyRequest, FilterPresetSaveRequest,} from '@app/misc_events';
import {ParsingErrorType} from '@app/parsing_error_type';
import {TabbedViewSwitched, TabbedViewSwitchRequest,} from '@app/tabbed_view_events';
import {assertDefined} from '@common/assert';
import {Store} from '@common/store/store';
import {getLogger} from '@compat/logging';
import {Analytics} from '@logging/analytics';
import {WinscopeEvent} from '@messaging/winscope_event';
import {EmitEvent, WinscopeEventEmitter,} from '@messaging/winscope_event_emitter';
import {WinscopeEventListener} from '@messaging/winscope_event_listener';
import {TRACE_INFO} from '@trace_api/trace_info';
import {TraceType} from '@trace_api/trace_type';
import {View, Viewer, ViewType} from '@viewers/viewer';

interface Tab {
  view: View;
  addedToDom: boolean;
  isTooltipStable: boolean;
}

/**
 * A component for displaying the trace view.
 */
@Component({
  selector: 'trace-view',
  standalone: true,
  imports: [
    CommonModule,
    MatTabsModule,
    MatTooltipModule,
    MatIconModule,
    OverlayModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    ReactiveFormsModule,
    MatDividerModule,
  ],
  templateUrl: './trace_view_component.ng.html',
  styleUrls: ['trace_view_component.css'],
})
export class TraceViewComponent
  implements WinscopeEventEmitter, WinscopeEventListener
{
  viewers = input.required<Viewer[]>();
  store = input.required<Store>();
  traceTypesWithParsingErrors = input<Map<TraceType, ParsingErrorType>>(
    new Map(),
  );

  private allFilterPresets = signal<string[]>([]);
  private currentActiveTab = signal<Tab | undefined>(undefined);

  TRACE_INFO = TRACE_INFO;
  tabs: Tab[] = [];
  isFilterPresetsPanelOpen = false;
  filterPresetNameControl = new FormControl(
    '',
    Validators.compose([
      Validators.required,
      (control: FormControl) =>
        this.validateFilterPresetName(
          control,
          this.allFilterPresets(),
          (input: string) =>
            this.makeFilterPresetName(
              input,
              assertDefined(this.getCurrentTabTraceType()),
            ),
        ),
    ]),
  );

  private getCurrentTabTraceType = computed<TraceType | undefined>(() => {
    return this.currentActiveTab()?.view.traces.at(0)?.type;
  });

  readonly currentTabHasFilterPresets = computed(() => {
    const currentTabTraceType = this.getCurrentTabTraceType();
    return (
      currentTabTraceType !== undefined &&
      [
        TraceType.SURFACE_FLINGER,
        TraceType.WINDOW_MANAGER,
        TraceType.INPUT_METHOD_CLIENTS,
        TraceType.INPUT_METHOD_MANAGER_SERVICE,
        TraceType.INPUT_METHOD_SERVICE,
        TraceType.VIEW_CAPTURE,
      ].includes(currentTabTraceType)
    );
  });

  readonly getCurrentFilterPresets = computed(() => {
    const currentTabTraceType = this.getCurrentTabTraceType();
    if (currentTabTraceType === undefined) return [];
    return this.allFilterPresets().filter((preset) =>
      preset.includes(TRACE_INFO[currentTabTraceType].name),
    );
  });

  private emitAppEvent: EmitEvent = () => Promise.resolve();
  private filterPresetsStoreKey = 'filterPresets';

  traceTypesWithParsingErrorsWarningTooltip: string = '';

  constructor(
    @Inject(ElementRef) private elementRef: ElementRef,
    @Inject(ChangeDetectorRef) private changeDetectorRef: ChangeDetectorRef,
    @Inject(NgZone) private ngZone: NgZone,
  ) {
    const firstViewersChange = effect(() => {
      const viewers = this.viewers();
      this.renderViewsTab(viewers);
      this.renderViewsOverlay(viewers);
      firstViewersChange.destroy();
    });

    const firstStoreChange = effect(() => {
      const store = this.store();
      const storedPresets = store.get(this.filterPresetsStoreKey);
      if (storedPresets) {
        this.allFilterPresets.set(JSON.parse(storedPresets));
      }
      firstStoreChange.destroy();
    });
  }

  getTabIconColor(tab: Tab): string {
    if (tab.view.type === ViewType.GLOBAL_SEARCH) return '';
    const trace = tab.view.traces.at(0);
    if (!trace) return '';
    return TRACE_INFO[trace.type].color;
  }

  getTabIcon(tab: Tab): string {
    if (tab.view.type === ViewType.GLOBAL_SEARCH) {
      return TRACE_INFO[TraceType.SEARCH].icon;
    }
    const trace = tab.view.traces.at(0);
    if (!trace) return '';
    return TRACE_INFO[trace.type].icon;
  }

  onTabHover(event: MouseEvent, tab: Tab) {
    if (tab.isTooltipStable) {
      return;
    }
    this.ngZone.run(() => {
      (event.target as HTMLElement).dispatchEvent(new Event('mouseleave'));
      tab.isTooltipStable = true;
      this.changeDetectorRef.detectChanges();
      (event.target as HTMLElement)?.dispatchEvent(new Event('mouseenter'));
    });
  }

  async onTabClick(tab: Tab) {
    await this.showTab(tab, false);
  }

  async onWinscopeEvent(event: WinscopeEvent) {
    switch (event.constructor) {
      case TabbedViewSwitchRequest:
        return await this.onTabbedViewSwitchRequest(
          event as TabbedViewSwitchRequest,
        );
      default:
        getLogger('TraceViewComponent').trace(
          'Not processing event ' + event.constructor.name,
        );
    }
  }

  setEmitEvent(callback: EmitEvent) {
    this.emitAppEvent = callback;
  }

  isCurrentActiveTab(tab: Tab) {
    return tab === this.currentActiveTab();
  }

  getTabTooltip(view: View): string {
    const desc = new Set();
    view.traces.forEach((trace) =>
      trace.getDescriptors().forEach((d) => desc.add(d)),
    );
    return Array.from(desc).join(', ');
  }

  getTitle(view: View): string {
    const isDump = view.traces.length === 1 && view.traces.at(0)?.isDump();
    return view.title + (isDump ? ' Dump' : '');
  }

  onFilterPresetsClick() {
    this.ngZone.run(() => {
      this.isFilterPresetsPanelOpen = !this.isFilterPresetsPanelOpen;
      this.changeDetectorRef.detectChanges();
    });
  }

  async savePreset() {
    if (this.filterPresetNameControl.invalid) return;
    await this.ngZone.run(async () => {
      const value = assertDefined(this.filterPresetNameControl.value);
      const currentTabTraceType = assertDefined(this.getCurrentTabTraceType());
      const presetName = this.makeFilterPresetName(value, currentTabTraceType);

      this.allFilterPresets.update((presets) => [...presets, presetName]);
      this.store().add(
        this.filterPresetsStoreKey,
        JSON.stringify(this.allFilterPresets()),
      );

      this.filterPresetNameControl.reset();
      this.changeDetectorRef.detectChanges();
      await this.emitAppEvent(
        new FilterPresetSaveRequest(presetName, currentTabTraceType),
      );
    });
  }

  onExistingPresetClick(preset: string) {
    this.emitAppEvent(
      new FilterPresetApplyRequest(
        preset,
        assertDefined(this.getCurrentTabTraceType()),
      ),
    );
  }

  deletePreset(preset: string) {
    this.allFilterPresets.update((presets) =>
      presets.filter((p) => p !== preset),
    );
    const store = this.store();
    store.clear(preset);
    store.add(
      this.filterPresetsStoreKey,
      JSON.stringify(this.allFilterPresets()),
    );
    this.filterPresetNameControl.updateValueAndValidity();
    this.changeDetectorRef.detectChanges();
  }

  showTraceTypesWithParsingErrorsWarning(tab: Tab): boolean {
    const trace = tab.view.traces.at(0);
    const traceType = trace?.type;

    if (traceType !== undefined) {
      const traceTypesWithParsingErrors = this.traceTypesWithParsingErrors();
      if (traceTypesWithParsingErrors.has(traceType)) {
        if (
          traceTypesWithParsingErrors.get(traceType) ===
          ParsingErrorType.DATA_INCORRECT
        ) {
          this.traceTypesWithParsingErrorsWarningTooltip =
            'Trace processor errors occurred - data may be incorrect';
        } else {
          this.traceTypesWithParsingErrorsWarningTooltip =
            'Trace processor errors occurred - data may be incomplete';
        }

        return true;
      }
    }
    return false;
  }

  private async onTabbedViewSwitchRequest(event: TabbedViewSwitchRequest) {
    const tab = this.tabs.find((tab) =>
      tab.view.traces.some((trace) => trace === event.newActiveTrace),
    );
    await this.showTab(assertDefined(tab), false);
  }

  private renderViewsTab(viewers: Viewer[]) {
    this.tabs = viewers
      .map((viewer) => viewer.getViews())
      .flat()
      .filter((view) => view.type !== ViewType.OVERLAY)
      .map((view) => {
        return {
          view,
          addedToDom: false,
          isTooltipStable: false,
        };
      });

    if (this.tabs.length > 0) {
      const tabToShow = assertDefined(
        this.tabs.find((tab) => tab.view.type !== ViewType.GLOBAL_SEARCH),
      );
      this.showTab(tabToShow, true);
    }
  }

  private renderViewsOverlay(viewers: Viewer[]) {
    const views: View[] = viewers
      .map((viewer) => viewer.getViews())
      .flat()
      .filter((view) => view.type === ViewType.OVERLAY);

    if (views.length > 1) {
      throw new Error(
        'Only one overlay view is supported. To allow more overlay views, either create more than' +
          ' one draggable containers in this component or move the cdkDrag directives into the' +
          " overlay view when the new Angular's directive composition API is available" +
          ' (https://github.com/angular/angular/issues/8785).',
      );
    }

    views.forEach((view) => {
      view.htmlElement.style.pointerEvents = 'all';
      const container = assertDefined(
        this.elementRef.nativeElement.querySelector('.overlay-container'),
      );
      container.appendChild(view.htmlElement);
    });
  }

  private async showTab(tab: Tab, firstToRender: boolean) {
    const startTimeMs = Date.now();
    const currentActiveTab = this.currentActiveTab();
    if (currentActiveTab) {
      currentActiveTab.view.htmlElement.style.display = 'none';
    }

    const firstSwitch = !tab.addedToDom;
    if (firstSwitch) {
      // Workaround for b/255966194:
      // make sure that the first time a tab content is rendered
      // (added to the DOM) it has style.display == "". This fixes the
      // initialization/rendering issues with cdk-virtual-scroll-viewport
      // components inside the tab contents.
      const traceViewContent = assertDefined(
        this.elementRef.nativeElement.querySelector('.trace-view-content'),
      );
      traceViewContent.appendChild(tab.view.htmlElement);
      tab.addedToDom = true;
    } else {
      tab.view.htmlElement.style.display = '';
    }

    this.currentActiveTab.set(tab);

    if (!firstToRender) {
      await this.emitAppEvent(new TabbedViewSwitched(tab.view));
      Analytics.Navigation.logTabSwitched(
        tab.view.title,
        Date.now() - startTimeMs,
        firstSwitch,
      );
    }
    if (firstSwitch) {
      Analytics.Memory.logUsage('tab_initialized', {firstSwitch});
    }
  }

  private validateFilterPresetName(
    control: FormControl,
    filterPresets: string[],
    makeFilterPresetName: (input: string) => string,
  ): ValidationErrors | null {
    const valid =
      control.value &&
      !filterPresets.includes(makeFilterPresetName(control.value));
    return !valid ? {invalidInput: control.value} : null;
  }

  private makeFilterPresetName(input: string, traceType: TraceType) {
    return input + '.' + TRACE_INFO[traceType].name;
  }
}
