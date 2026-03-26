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
import {ApplicationRef, ChangeDetectorRef, Component, computed, createComponent, effect, ElementRef, Inject, input, NgZone, signal,} from '@angular/core';
import {FormControl, ReactiveFormsModule, ValidationErrors, Validators,} from '@angular/forms';
import {MatButtonModule} from '@angular/material/button';
import {MatDividerModule} from '@angular/material/divider';
import {MatFormFieldModule} from '@angular/material/form-field';
import {MatIconModule} from '@angular/material/icon';
import {MatInputModule} from '@angular/material/input';
import {MatTabsModule} from '@angular/material/tabs';
import {MatTooltipModule} from '@angular/material/tooltip';
import {AngularViewer} from '@app/shared/angular_viewer';
import {assertDefined} from '@common/assert';
import {Store} from '@common/store/store';
import {getLogger} from '@compat/logging';
import {Analytics} from '@logging/analytics';
import {WinscopeEvent} from '@messaging/winscope_event';
import {EmitEvent, WinscopeEventEmitter,} from '@messaging/winscope_event_emitter';
import {WinscopeEventListener} from '@messaging/winscope_event_listener';
import {ActiveTraceChanged} from '@trace_api/trace_events';
import {TRACE_INFO} from '@trace_api/trace_info';
import {TraceType} from '@trace_api/trace_type';
import {FilterPresetApplyRequest, FilterPresetSaveRequest,} from '@ui/shared/events/misc_events';
import {TabbedViewSwitched, TabbedViewSwitchRequest,} from '@ui/shared/events/tabbed_view_events';
import {ViewType} from '@ui/shared/viewers/viewer';
import {ParsingErrorType} from '@ui/trace_loading/parsing_error_type';

interface Tab {
  addedToDom: boolean;
  isTooltipStable: boolean;
  viewer: AngularViewer;
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
  styleUrls: ['trace_view_component.scss'],
})
export class TraceViewComponent
  implements WinscopeEventEmitter, WinscopeEventListener
{
  viewers = input.required<AngularViewer[]>();
  store = input.required<Store>();
  traceTypesWithParsingErrors = input<Map<TraceType, ParsingErrorType>>(
    new Map(),
  );

  private allFilterPresets = signal<string[]>([]);
  private currentActiveTab = signal<Tab | undefined>(undefined);
  private viewInitialized = signal(false);

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
    return this.currentActiveTab()?.viewer.getTraces().at(0)?.type;
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
    @Inject(ElementRef) private readonly elementRef: ElementRef,
    @Inject(ChangeDetectorRef)
    private readonly changeDetectorRef: ChangeDetectorRef,
    @Inject(NgZone) private readonly ngZone: NgZone,
    @Inject(ApplicationRef) private readonly applicationRef: ApplicationRef,
  ) {
    const firstViewersChange = effect(() => {
      if (!this.viewInitialized()) {
        return;
      }
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

  ngAfterViewInit() {
    this.viewInitialized.set(true);
  }

  getTabIconColor(tab: Tab): string {
    if (tab.viewer.getViewType() === ViewType.GLOBAL_SEARCH) return '';
    const trace = tab.viewer.getTraces().at(0);
    if (!trace) {
      return '';
    }
    return TRACE_INFO[trace.type].color;
  }

  getTabIcon(tab: Tab): string {
    if (tab.viewer.getViewType() === ViewType.GLOBAL_SEARCH) {
      return TRACE_INFO[TraceType.SEARCH].icon;
    }
    const trace = tab.viewer.getTraces().at(0);
    if (!trace) {
      return '';
    }
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

  getTabTooltip(viewer: AngularViewer): string {
    const desc = new Set();
    viewer
      .getTraces()
      .forEach((trace) => trace.getDescriptors().forEach((d) => desc.add(d)));
    return Array.from(desc).join(', ');
  }

  getTitle(viewer: AngularViewer): string {
    const traces = viewer.getTraces();
    const isDump = traces.length === 1 && traces.at(0)?.isDump();
    return viewer.getTitle() + (isDump ? ' Dump' : '');
  }

  onFilterPresetsClick() {
    this.ngZone.run(() => {
      this.isFilterPresetsPanelOpen = !this.isFilterPresetsPanelOpen;
      this.changeDetectorRef.detectChanges();
    });
  }

  async savePreset() {
    if (this.filterPresetNameControl.invalid) {
      return;
    }
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
    const trace = tab.viewer.getTraces().at(0);
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
      tab.viewer.getTraces().some((trace) => trace === event.newActiveTrace),
    );
    await this.showTab(assertDefined(tab), false, event.metadata);
  }

  private renderViewsTab(viewers: AngularViewer[]) {
    this.tabs = viewers
      .filter((viewer) => viewer.getViewType() !== ViewType.OVERLAY)
      .map((viewer) => {
        return {
          viewer,
          addedToDom: false,
          isTooltipStable: false,
        };
      });

    if (this.tabs.length > 0) {
      const tabToShow = assertDefined(
        this.tabs.find(
          (tab) => tab.viewer.getViewType() !== ViewType.GLOBAL_SEARCH,
        ),
      );
      this.showTab(tabToShow, true);
    }
  }

  private renderViewsOverlay(viewers: AngularViewer[]) {
    const overlayViewers: AngularViewer[] = viewers.filter(
      (viewer) => viewer.getViewType() === ViewType.OVERLAY,
    );

    if (overlayViewers.length > 1) {
      throw new Error(
        'Only one overlay view is supported. To allow more overlay views, either create more than' +
          ' one draggable containers in this component or move the cdkDrag directives into the' +
          " overlay view when the new Angular's directive composition API is available" +
          ' (https://github.com/angular/angular/issues/8785).',
      );
    }

    overlayViewers.forEach((viewer) => {
      const container = assertDefined(
        this.elementRef.nativeElement.querySelector('.overlay-container'),
      );
      this.injectComponent(viewer, container);
    });
  }

  private async showTab(tab: Tab, firstToRender: boolean, metadata?: unknown) {
    const startTimeMs = Date.now();
    const currentActiveTab = this.currentActiveTab();
    if (tab === currentActiveTab) {
      const trace = tab.viewer.getTraces().at(0);
      if (trace) {
        await this.emitAppEvent(new ActiveTraceChanged(trace));
      }
      return;
    }
    if (currentActiveTab) {
      currentActiveTab.viewer.onHide();
    }

    const firstSwitch = !tab.addedToDom;
    if (firstSwitch) {
      const traceViewContent = assertDefined(
        this.elementRef.nativeElement.querySelector('.trace-view-content'),
      );
      this.injectComponent(tab.viewer, traceViewContent);
      tab.addedToDom = true;
    } else {
      tab.viewer.onShow();
    }

    this.currentActiveTab.set(tab);

    if (!firstToRender) {
      await this.emitAppEvent(new TabbedViewSwitched(tab.viewer, metadata));
      Analytics.Navigation.logTabSwitched(
        tab.viewer.getTitle(),
        Date.now() - startTimeMs,
        firstSwitch,
      );
    }
    if (firstSwitch) {
      Analytics.Memory.logUsage('tab_initialized', {firstSwitch});
    }
  }

  private injectComponent(viewer: AngularViewer, container: HTMLElement) {
    const environmentInjector = this.applicationRef.injector;
    const componentRef = createComponent(viewer.getComponentType(), {
      environmentInjector,
    });
    this.applicationRef.attachView(componentRef.hostView);
    viewer.setComponentRef(componentRef);
    container.appendChild(componentRef.location.nativeElement);
    viewer.onShow();
    componentRef.changeDetectorRef.detectChanges();
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
