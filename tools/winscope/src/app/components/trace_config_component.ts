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
import {
  ChangeDetectorRef,
  Component,
  ElementRef,
  EventEmitter,
  Inject,
  Input,
  NgZone,
  Output,
} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {MatButtonModule} from '@angular/material/button';
import {MatCheckboxModule} from '@angular/material/checkbox';
import {MatOption} from '@angular/material/core';
import {MatFormFieldModule} from '@angular/material/form-field';
import {MatIconModule} from '@angular/material/icon';
import {MatInputModule} from '@angular/material/input';
import {
  MatSelect,
  MatSelectChange,
  MatSelectModule,
} from '@angular/material/select';
import {MatTooltipModule} from '@angular/material/tooltip';
import {overlayPanelStyles} from 'app/styles/overlay_panel.styles';
import {assertDefined} from 'common/assert';
import {isElementOverflowing} from 'common/dom';
import {globalConfig} from 'common/global_config';
import {Store} from 'common/store/store';
import {
  AdvancedConfiguration,
  SelectionConfiguration,
  SelectionOption,
  TraceConfigurationMap,
  updateConfigsFromStore,
} from 'trace_collection/ui/ui_trace_configuration';
import {AbstractSelectComponent} from 'viewers/components/abstract_select_component';
import {userOptionStyle} from 'viewers/components/styles/user_option.styles';

/**
 * A component for displaying and editing trace configurations.
 */
@Component({
  selector: 'trace-config',
  standalone: true,
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
  template: `
    <h3 class="mat-subtitle-1">{{title}}</h3>

    <div class="checkboxes" [style.height]="getTraceCheckboxContainerHeight()">
      @for (traceKey of getSortedTraceKeys(); track traceKey) {
        <mat-checkbox
          color="primary"
          class="trace-checkbox"
          [disabled]="!traceConfig[traceKey].available"
          [(ngModel)]="traceConfig[traceKey].config.enabled"
          (ngModelChange)="onTraceConfigChange()">
            <span>{{ traceConfig[traceKey].name }}</span>
            @if (hasAdvancedConfig(traceKey)) {
<button
              mat-icon-button
              class="advanced-settings-button"
              [disabled]="!traceConfig[traceKey].config.enabled"
              cdkOverlayOrigin
              #settingsTrigger="cdkOverlayOrigin"
              (click)="onSettingsOverlayTriggerClick(traceKey, settingsTrigger)">
                <mat-icon>settings</mat-icon>
            </button>
}

            <ng-template
              cdkConnectedOverlay
              [cdkConnectedOverlayOrigin]="advancedSettingsTrigger"
              [cdkConnectedOverlayOpen]="traceKey === advancedSettingsKey"
              [cdkConnectedOverlayHasBackdrop]="true"
              cdkConnectedOverlayBackdropClass="cdk-overlay-transparent-backdrop"
              (backdropClick)="onSettingsOverlayTriggerClick(traceKey, advancedSettingsTrigger)">
                <div class="config-section overlay-panel">
                  <h3 class="mat-subtitle-1 config-title">{{ traceConfig[advancedSettingsKey].name }} configuration</h3>

                  <div class="overlay-panel-content">
                    @if (traceConfig[advancedSettingsKey].config.checkboxConfigs.length > 0) {
<div
                      class="enable-config-opt overlay-panel-section mat-body-1">
                      @for (checkboxConfig of getSortedConfigs(traceConfig[advancedSettingsKey].config.checkboxConfigs); track checkboxConfig.key) {
<mat-checkbox
                        color="primary"
                        class="enable-config"
                        [disabled]="checkboxConfig.disabled"
                        [(ngModel)]="checkboxConfig.enabled"
                        (ngModelChange)="onTraceConfigChange()">{{ checkboxConfig.name }}</mat-checkbox>
}
                    </div>
}

                    @if (traceConfig[advancedSettingsKey].config.selectionConfigs.length > 0) {
<div
                      class="selection-config-opt overlay-panel-section mat-body-1">
                      @for (selectionConfig of getSortedConfigs(traceConfig[advancedSettingsKey].config.selectionConfigs); track selectionConfig.key) {
                        <mat-form-field
                          class="config-selection"
                          subscriptSizing="dynamic"
                          [class.wide-field]="selectionConfig.wideField"
                          appearance="fill">
                          <mat-label>{{ selectionConfig.name }}</mat-label>

                          <mat-select
                            #matSelect
                            [multiple]="isMultipleSelect(selectionConfig)"
                            disableOptionCentering
                            class="selected-value"
                            [attr.label]="advancedSettingsKey + selectionConfig.name"
                            [value]="selectionConfig.value"
                            [disabled]="selectionConfig.options.length === 0"
                            (opened)="handleSelectOpened(matSelect, selectionConfig)"
                            (selectionChange)="onSelectChange($event, selectionConfig)">

                            <mat-select-trigger>{{ getSelectTriggerValue(matSelect) }}</mat-select-trigger>

                            @if (selectionConfig.filterString !== undefined) {
<mat-form-field
                              class="select-config-filter mat-form-field-appearance-none"
                              subscriptSizing="dynamic">
                                <mat-label>Filter options</mat-label>
                                <input matInput [(ngModel)]="selectionConfig.filterString" />
                            </mat-form-field>
}

                            @if (matSelect.multiple || selectionConfig.optional) {
<span class="mat-mdc-option">
                              @if (matSelect.multiple) {
<button
                                mat-flat-button
                                class="user-option"
                                [color]="matSelect.value.length === selectionConfig.options.length ? 'primary' : undefined"
                                [class.not-enabled]="matSelect.value.length !== selectionConfig.options.length"
                                (click)="onAllButtonClick(matSelect, selectionConfig)">All</button>
}

                              @if (selectionConfig.optional && !matSelect.multiple) {
<button
                                mat-flat-button
                                class="user-option"
                                [color]="matSelect.value.length === 0 ? 'primary' : undefined"
                                [class.not-enabled]="matSelect.value.length > 0"
                                (click)="onNoneButtonClick(matSelect, selectionConfig)"> None </button>
}
                            </span>
}

                            @for (option of selectionConfig.options; track option; let i = $index) {
<mat-option
                              #matOption
                              class="option"
                              [class.hidden-option]="hideOption(option.value, selectionConfig.filterString ?? '')"
                              (click)="onOptionClick($event, matSelect, matOption, i, selectionConfig)"
                              [value]="option.value"
                              matTooltipPosition="right"
                              [matTooltip]="option.value"
                              [matTooltipDisabled]="disableOptionTooltip(optionEl)">
                                <span class="option-with-chip">
                                  <span
                                    class="option-value text-no-overflow"
                                    #optionEl> {{ option.value }} </span>
                                  @if (option.chip) {
<button
                                    mat-flat-button
                                    class="user-option"
                                    [disabled]="!selectionConfig.value.includes(option.value)"
                                    [color]="option.chip.enabled ? 'primary' : undefined"
                                    [class.not-enabled]="!option.chip.enabled"
                                    (click)="onChipClick($event, option)">{{option.chip.name}}</button>
}
                                </span>
                            </mat-option>
}

                          </mat-select>
                        </mat-form-field>
                      }
                    </div>
}

                    @if (traceConfig[advancedSettingsKey].config.desc) {
<span
                      class="config-desc mat-body-1 overlay-panel-section">
                        {{traceConfig[advancedSettingsKey].config.desc}}
                    </span>
}

                  </div>
                </div>

            </ng-template>
        </mat-checkbox>
      }
    </div>
  `,
  styles: [
    `
      .checkboxes {
        display: flex;
        flex-direction: column;
        flex-wrap: wrap;
      }
      .config-section {
        display: flex;
        flex-direction: column;
        width: 50vw;
      }
      .enable-config-opt,
      .selection-config-opt {
        display: flex;
        flex-direction: row;
        flex-wrap: wrap;
      }
      .selection-config-opt {
        gap: 10px;
      }
      .wide-field {
        width: 46vw;
      }
      .config-title {
        margin: 15px 15px 0px 15px;
      }
      .overlay-panel-content {
        margin-top: 0px;
      }
      .option-with-chip {
        justify-content: space-between;
        display: flex;
        align-items: center;
        width: 100%;
      }
      .option-with-chip .user-option {
        margin-inline-end: 0px;
      }
      .hidden-option {
        display: none;
      }
      .select-config-filter {
        padding-left: 10px;
        width: 80%;
      }
      .advanced-settings-button, .advanced-settings-button .mat-icon {
        height: 16px;
        width: 16px;
        line-height: 16px;
        font-size: 16px;
        min-width: fit-content;
      }
      .advanced-settings-button {
        padding: 0 4px;
      }
    `,
    userOptionStyle,
    overlayPanelStyles,
  ],
})
export class TraceConfigComponent extends AbstractSelectComponent<SelectionConfiguration> {
  changeDetectionWorker: number | undefined;
  advancedSettingsTrigger: ElementRef | undefined;
  advancedSettingsKey: string | undefined;

  @Input() title: string | undefined;
  @Input() traceConfigStoreKey: string | undefined;
  @Input() traceConfig: TraceConfigurationMap | undefined;
  @Input() storage: Store | undefined;
  @Output() readonly traceConfigChange =
    new EventEmitter<TraceConfigurationMap>();

  private lastClickedIndex = new Map<string, number>();

  constructor(
    @Inject(ChangeDetectorRef) private changeDetectorRef: ChangeDetectorRef,
    @Inject(NgZone) private ngZone: NgZone,
  ) {
    super();
  }

  ngOnInit() {
    this.traceConfig = updateConfigsFromStore(
      assertDefined(
        JSON.parse(JSON.stringify(assertDefined(this.traceConfig))),
        () => 'component initialized without config',
      ),
      assertDefined(this.storage),
      assertDefined(this.traceConfigStoreKey),
    );
    if (globalConfig.MODE !== 'KARMA_TEST') {
      this.changeDetectionWorker = window.setInterval(
        () => this.changeDetectorRef.detectChanges(),
        200,
      );
    }
    this.onTraceConfigChange();
  }

  ngOnDestroy() {
    window.clearInterval(this.changeDetectionWorker);
  }

  getTraceCheckboxContainerHeight(): string {
    const config = assertDefined(this.traceConfig);
    return Math.ceil(Object.keys(config).length / 3) * 36 + 'px';
  }

  getSortedTraceKeys(): string[] {
    const config = assertDefined(this.traceConfig);
    return Object.keys(config).sort((a, b) => {
      return config[a].name < config[b].name ? -1 : 1;
    });
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
    if (config.value.length !== config.options.length) {
      config.value = config.options.map((o) => o.value);
      select.value = config.options;
    } else {
      config.value = [];
      select.value = [];
    }
    this.onTraceConfigChange();
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
    const config = assertDefined(this.traceConfig?.[traceKey]?.config);
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

  onSettingsOverlayTriggerClick(traceKey: string, trigger: ElementRef) {
    this.ngZone.run(() => {
      if (this.advancedSettingsKey === traceKey) {
        this.advancedSettingsTrigger = undefined;
        this.advancedSettingsKey = undefined;
      } else {
        this.advancedSettingsTrigger = trigger;
        this.advancedSettingsKey = traceKey;
      }
      this.changeDetectorRef.detectChanges();
    });
  }

  onTraceConfigChange() {
    this.traceConfigChange.emit(this.traceConfig);
  }

  isMultipleSelect(config: SelectionConfiguration): boolean {
    return Array.isArray(config.value);
  }

  protected override onKeydownCtrlA(
    select: MatSelect,
    selectionConfig: SelectionConfiguration,
  ) {
    const allOpts = selectionConfig.options.map((o) => {
      return o.value;
    });

    this.handleKeydownCtrlA(
      select,
      allOpts,
      selectionConfig.filterString ?? '',
    );

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
