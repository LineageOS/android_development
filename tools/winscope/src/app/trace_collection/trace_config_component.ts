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
import {CdkOverlayOrigin, OverlayModule} from '@angular/cdk/overlay';
import {CommonModule} from '@angular/common';
import {ChangeDetectionStrategy, ChangeDetectorRef, Component, computed, ElementRef, Inject, input, model, NgZone,} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {MatButtonModule} from '@angular/material/button';
import {MatCheckboxModule} from '@angular/material/checkbox';
import {MatOption} from '@angular/material/core';
import {MatFormFieldModule} from '@angular/material/form-field';
import {MatIconModule} from '@angular/material/icon';
import {MatInputModule} from '@angular/material/input';
import {MatSelect, MatSelectChange, MatSelectModule,} from '@angular/material/select';
import {MatTooltipModule} from '@angular/material/tooltip';
import {AbstractSelectComponent} from '@app/shared/user_input/abstract_select_component';
import {assertDefined} from '@common/assert';
import {isElementOverflowing} from '@common/dom';
import {Store} from '@common/store/store';
import {AdvancedConfiguration, CheckboxConfiguration, SelectionConfiguration, SelectionOption, TraceConfigurationMap, updateConfigsFromStore,} from '@trace_collection/ui/ui_trace_configuration';

/**
 * A component for displaying and editing trace configurations.
 */
@Component({
  selector: 'trace-config',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    MatCheckboxModule,
    FormsModule,
    MatButtonModule,
    OverlayModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatTooltipModule,
  ],
  templateUrl: './trace_config_component.ng.html',
  styleUrls: ['trace_config_component.scss'],
})
export class TraceConfigComponent extends AbstractSelectComponent<SelectionConfiguration> {
  advancedSettingsTrigger: CdkOverlayOrigin | undefined;
  advancedSettingsKey: string | undefined;

  title = input.required<string>();
  traceConfigStoreKey = input.required<string>();
  store = input.required<Store>();
  traceConfig = model.required<TraceConfigurationMap>();

  readonly getSortedTraceKeys = computed<string[]>(() => {
    const config = this.traceConfig();
    return Object.keys(config).sort((a, b) => {
      return config[a].name < config[b].name ? -1 : 1;
    });
  });

  private lastClickedIndex = new Map<string, number>();
  private readonly observer = new ResizeObserver((_) => {
    this.changeDetectorRef.detectChanges();
  });

  constructor(
    @Inject(ChangeDetectorRef) private changeDetectorRef: ChangeDetectorRef,
    @Inject(NgZone) private ngZone: NgZone,
    @Inject(ElementRef) private elementRef: ElementRef,
  ) {
    super();
  }

  ngOnInit() {
    const config = updateConfigsFromStore(
      JSON.parse(JSON.stringify(this.traceConfig())),
      this.store(),
      this.traceConfigStoreKey(),
    );
    this.traceConfig.set(config);
    this.onTraceConfigChange();
  }

  ngAfterViewInit() {
    this.observer.observe(this.elementRef.nativeElement);
  }

  ngOnDestroy() {
    this.observer.disconnect();
  }

  getTraceCheckboxContainerHeight(): string {
    const config = this.traceConfig();
    const columns = Math.min(
      3,
      Math.floor(this.elementRef.nativeElement.clientWidth / 160),
    );
    return Math.ceil(Object.keys(config).length / columns) * 36 + 'px';
  }

  getSortedConfigs(configs: AdvancedConfiguration[]): AdvancedConfiguration[] {
    return configs.sort((a, b) => {
      return a.name < b.name ? -1 : 1;
    });
  }

  getSelectTriggerValue(select: MatSelect) {
    return select.multiple ? select.value?.join(', ') : select.value;
  }

  disableOptionTooltip(optionText: HTMLElement): boolean {
    return !isElementOverflowing(optionText);
  }

  onSelectChange(event: MatSelectChange, config: SelectionConfiguration) {
    config.value = event.value;
    if (!event.source.multiple) {
      event.source.close();
    }
    this.onTraceConfigChange();
  }

  onNoneButtonClick(select: MatSelect, config: SelectionConfiguration) {
    if (config.value.length > 0) {
      select.value = '';
      config.value = '';
      this.onTraceConfigChange();
    }
  }

  onAllButtonClick(select: MatSelect, config: SelectionConfiguration) {
    this.onToggleAll(select, config);
  }

  allOptionsSelected(
    select: MatSelect,
    config: SelectionConfiguration,
  ): boolean {
    return (
      config.options.filter((option) => {
        return !this.hideOption(option.value, config.filterString ?? '');
      }).length === (select.value?.length ?? 0)
    );
  }

  onOptionClick(
    event: MouseEvent,
    select: MatSelect,
    option: MatOption,
    i: number,
    selectionConfig: SelectionConfiguration,
  ) {
    if (!select.multiple) {
      return;
    }
    const selectLabel = this.advancedSettingsKey + selectionConfig.name;
    const lastClickedIndex = this.lastClickedIndex.get(selectLabel);
    const allOptions = selectionConfig.options.map((o) => o.value);

    const selectValueChanged = this.handleOptionClick({
      event,
      i,
      select,
      option,
      lastClickedIndex,
      options: allOptions,
      filterString: selectionConfig.filterString ?? '',
    });
    if (selectValueChanged) {
      selectionConfig.value = select.value;
      this.onTraceConfigChange();
    }

    this.lastClickedIndex.set(selectLabel, i);
    this.blurSelectIfNotMultiple(select, option, selectLabel);
  }

  hasAdvancedConfig(traceKey: string): boolean {
    const config = assertDefined(this.traceConfig()[traceKey]?.config);
    return (
      config.checkboxConfigs.length > 0 || config.selectionConfigs.length > 0
    );
  }

  onChipClick(event: MouseEvent, option: SelectionOption) {
    event.stopPropagation();
    const chip = assertDefined(option.chip);
    chip.enabled = !chip.enabled;
    this.onTraceConfigChange();
  }

  onSettingsOverlayTriggerClick(traceKey: string, trigger?: CdkOverlayOrigin) {
    this.ngZone.run(() => {
      if (this.advancedSettingsKey === traceKey) {
        this.advancedSettingsKey = undefined;
      } else {
        this.advancedSettingsTrigger = trigger;
        this.advancedSettingsKey = traceKey;
      }
      this.changeDetectorRef.detectChanges();
    });
  }

  onTraceConfigChange() {
    this.changeDetectorRef.detectChanges();
  }

  isMultipleSelect(config: SelectionConfiguration): boolean {
    return Array.isArray(config.value);
  }

  asSelectionConfiguration(
    config: AdvancedConfiguration,
  ): SelectionConfiguration {
    return config as SelectionConfiguration;
  }

  asCheckboxConfiguration(
    config: AdvancedConfiguration,
  ): CheckboxConfiguration {
    return config as CheckboxConfiguration;
  }

  protected override onToggleAll(
    select: MatSelect,
    selectionConfig: SelectionConfiguration,
  ) {
    const allOpts = selectionConfig.options.map((o) => {
      return o.value;
    });

    this.handleToggleAll(select, allOpts, selectionConfig.filterString ?? '');

    selectionConfig.value = select.value;
    this.onTraceConfigChange();
  }

  private blurSelectIfNotMultiple(
    select: MatSelect,
    option: MatOption,
    selectLabel: string,
  ) {
    if (select.value === option.value) {
      const selectElement = assertDefined(
        document.querySelector<HTMLElement>(
          `mat-select[label="${selectLabel}"]`,
        ),
      );
      selectElement.blur();
    }
  }
}
