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
import {TestBed} from '@angular/core/testing';
import {FormsModule, ReactiveFormsModule} from '@angular/forms';
import {MatButtonModule} from '@angular/material/button';
import {MatCheckboxModule} from '@angular/material/checkbox';
import {MatDividerModule} from '@angular/material/divider';
import {MatFormFieldModule} from '@angular/material/form-field';
import {MatIconModule} from '@angular/material/icon';
import {MatInputModule} from '@angular/material/input';
import {MatSelectModule} from '@angular/material/select';
import {MatTooltipModule} from '@angular/material/tooltip';
import {
  BrowserAnimationsModule,
  NoopAnimationsModule,
} from '@angular/platform-browser/animations';
import {assertDefined} from 'common/assert';
import {KeyboardEventCode} from 'common/dom';
import {InMemoryStorage} from 'common/store/in_memory_storage';
import {Store} from 'common/store/store';
import {checkTooltips, DOMTestHelper} from 'test/unit/dom_test_helpers';
import {TraceType} from 'trace_api/trace_type';
import {ConfigurationOptions} from 'trace_collection/ui/ui_trace_configuration';
import {TraceConfigComponent} from './trace_config_component';

describe('TraceConfigComponent', () => {
  const storeKey = 'TestConfigSettings';
  const advancedSettingsButton = '.advanced-settings-button';
  const layersTraceKey = 'layers_trace';
  const windowTraceKey = 'window_trace';
  const optMultSelectKey = 'optional_multiple_selection_trace';
  const optSelectKey = 'optional_selection_trace';
  const multSelectKey = 'multiple_selection_trace';
  const filterInputField = '.select-config-filter';
  let component: TraceConfigComponent;
  let dom: DOMTestHelper<TraceConfigComponent>;
  let configChangeSpy: jasmine.Spy;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        NoopAnimationsModule,
        CommonModule,
        MatCheckboxModule,
        MatDividerModule,
        MatFormFieldModule,
        MatInputModule,
        MatSelectModule,
        BrowserAnimationsModule,
        FormsModule,
        ReactiveFormsModule,
        MatTooltipModule,
        MatButtonModule,
        OverlayModule,
        MatIconModule,
        TraceConfigComponent,
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(TraceConfigComponent);
    component = fixture.componentInstance;
    dom = new DOMTestHelper(fixture, fixture.nativeElement);
    configChangeSpy = spyOn(component.traceConfigChange, 'emit');
    await setComponentInputs(component);
  });

  it('can be created', () => {
    expect(component).toBeTruthy();
  });

  it('displays config alphabetically by name', async () => {
    const boxes = dom.findAll('.trace-checkbox');
    const iconText = 'settings';
    expect(boxes.map((box) => box.getText())).toEqual([
      'disabled_checkbox_trace' + iconText,
      layersTraceKey + iconText,
      multSelectKey + iconText,
      optMultSelectKey + iconText,
      optSelectKey + iconText,
      'unavailable_trace',
      windowTraceKey + iconText,
    ]);
    for (const box of boxes) {
      const boxText = assertDefined(box.getText());
      if (boxText === 'unavailable_trace') {
        expect(box.find(advancedSettingsButton)).toBeUndefined();
      } else if (boxText.startsWith(windowTraceKey)) {
        box.get(advancedSettingsButton).checkDisabled(true);
      } else {
        box.findAndClick(advancedSettingsButton);
        const expectedTitle =
          boxText?.slice(0, boxText.length - 8) + ' configuration';
        dom.getInDocument('.config-title').checkText(expectedTitle);
        dom.clickBackdrop();
      }
    }
  });

  it('applies stored config and emits event on init', async () => {
    const traceConfig = assertDefined(component.traceConfig);
    traceConfig[windowTraceKey].config.enabled = true;
    dom.detectChanges();

    getCheckboxConfigSectionForKey(windowTraceKey).findAndClick('input');
    expect(traceConfig[windowTraceKey].config.checkboxConfigs).toEqual([
      {name: 'extra', key: 'extra', enabled: true},
    ]);

    // remove layers_trace checkbox configs from storage
    const commonStorage = new InMemoryStorage();
    commonStorage.add(
      storeKey + windowTraceKey,
      assertDefined(component.storage?.get(storeKey + windowTraceKey)),
    );
    const layersConfig: ConfigurationOptions = JSON.parse(
      assertDefined(component.storage?.get(storeKey + layersTraceKey)),
    );
    layersConfig.checkboxConfigs = [];
    commonStorage.add(storeKey + layersTraceKey, JSON.stringify(layersConfig));

    const newFixture = TestBed.createComponent(TraceConfigComponent);
    const newComponent = newFixture.componentInstance;
    const newDom = new DOMTestHelper(newFixture, newFixture.nativeElement);
    const spy = spyOn(newComponent.traceConfigChange, 'emit');
    await setComponentInputs(newComponent, newDom, commonStorage);
    expect(spy).toHaveBeenCalledTimes(1);

    const newConfig = assertDefined(newComponent.traceConfig);
    // window_trace extra set to true from storage
    expect(newConfig[windowTraceKey].config.checkboxConfigs).toEqual([
      {name: 'extra', key: 'extra', enabled: true},
    ]);
    // layers_trace checkbox configs retained during merge even though they are no longer in storage
    expect(newConfig[layersTraceKey].config.checkboxConfigs).toEqual([
      {name: 'trace buffers', key: 'tracebuffers', enabled: true},
    ]);
  });

  it('handles proxy object for initial trace config', async () => {
    const newFixture = TestBed.createComponent(TraceConfigComponent);
    const newComponent = newFixture.componentInstance;
    const newDom = new DOMTestHelper(newFixture, newFixture.nativeElement);
    const spy = spyOn(newComponent.traceConfigChange, 'emit');

    newComponent.title = 'Targets';
    newComponent.traceConfig = component.traceConfig;
    newComponent.traceConfigStoreKey = 'TestConfigSettings';
    newComponent.storage = component.storage;
    await detectNgModelChanges(newDom);
    newDom.detectChanges();
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('trace checkbox enabled by default', () => {
    const traceKey = layersTraceKey;
    configChangeSpy.calls.reset();
    const config = assertDefined(component.traceConfig);

    const box = getTraceBoxForKey(layersTraceKey);
    const input = box.get('input');
    const inputElement = input.getHTMLElement<HTMLInputElement>();

    box.checkText(traceKey);
    expect(inputElement.checked).toBeTrue();
    expect(config[traceKey].config.enabled).toBeTrue();

    input.click();
    expect(inputElement.checked).toBeFalse();
    expect(config[traceKey].config.enabled).toBeFalse();
    expect(configChangeSpy).toHaveBeenCalledTimes(1);
  });

  it('trace checkbox not enabled by default', () => {
    const traceKey = windowTraceKey;
    configChangeSpy.calls.reset();
    const config = assertDefined(component.traceConfig);

    const box = getTraceBoxForKey(traceKey);
    const input = box.get('input');
    const inputElement = input.getHTMLElement<HTMLInputElement>();

    box.checkText(traceKey);
    expect(inputElement.checked).toBeFalse();
    expect(config[traceKey].config.enabled).toBeFalse();

    input.click();
    expect(inputElement.checked).toBeTrue();
    expect(config[traceKey].config.enabled).toBeTrue();
    expect(configChangeSpy).toHaveBeenCalledTimes(1);
  });

  it('disables checkbox for unavailable trace', () => {
    const traceKey = 'unavailable_trace';
    const box = getTraceBoxForKey(traceKey);
    box.get('input').checkDisabled(true);
    box.checkText(traceKey);
  });

  it('disables checkbox for disabled checkbox config', () => {
    const traceKey = 'disabled_checkbox_trace';
    const box = getTraceBoxForKey(traceKey);
    box.get('input').checkDisabled(true);
    box.checkText(traceKey);
  });

  it('checkbox and select configs show', () => {
    const panel = getAdvancedSettingsPanelForKey(layersTraceKey);
    const checkboxConfigSection = panel.get('.enable-config-opt');
    checkboxConfigSection.checkInnerHTML('trace buffers');
    checkboxConfigSection.checkInnerHTML('tracing level', false);

    const selectionConfigSection = panel.get('.selection-config-opt');
    selectionConfigSection.checkInnerHTML('trace buffers', false);
    selectionConfigSection.checkInnerHTML('tracing level');
  });

  it('changing checkbox config model value causes box to change', async () => {
    const inputElement = getCheckboxConfigSectionForKey(layersTraceKey)
      .get('input')
      .getHTMLElement<HTMLInputElement>();
    assertDefined(
      assertDefined(component.traceConfig)[layersTraceKey].config,
    ).checkboxConfigs[0].enabled = false;
    await detectNgModelChanges();
    expect(inputElement.checked).toBeFalse();

    assertDefined(
      assertDefined(component.traceConfig)[layersTraceKey].config,
    ).checkboxConfigs[0].enabled = true;
    await detectNgModelChanges();
    expect(inputElement.checked).toBeTrue();
  });

  it('changing checkbox config by DOM interaction emits event', async () => {
    configChangeSpy.calls.reset();
    getTraceBoxForKey(layersTraceKey).findAndClick('input');
    expect(configChangeSpy).toHaveBeenCalledTimes(1);
  });

  it('changing selected config causes select to change', async () => {
    configChangeSpy.calls.reset();
    const settingsPanel = getAdvancedSettingsPanelForKey(layersTraceKey);
    await settingsPanel.openMatSelect();
    const panel = dom.getMatSelectPanel();
    dom.clickMatOption();
    expect(panel.find('.user-option')).toBeUndefined();
    expect(configChangeSpy).toHaveBeenCalledTimes(1);
  });

  it('clicking None button clears optional single selection config value', async () => {
    configChangeSpy.calls.reset();
    const settingsPanel = getAdvancedSettingsPanelForKey(optSelectKey);
    await settingsPanel.openMatSelect();

    dom.clickMatOption();
    expect(configChangeSpy).toHaveBeenCalledTimes(1);
    checkSelectionConfigValue(optSelectKey, '12345');

    const panel = dom.getMatSelectPanel();
    panel.findAndClick('.user-option');
    expect(configChangeSpy).toHaveBeenCalledTimes(2);
    checkSelectionConfigValue(optSelectKey, '');
  });

  it('clicking All button selects or clears all options for multiple selection config', async () => {
    configChangeSpy.calls.reset();
    const settingsPanel = getAdvancedSettingsPanelForKey(multSelectKey);
    await settingsPanel.openMatSelect();

    const panel = dom.getMatSelectPanel();
    const allButton = panel.findAndClick('.user-option');
    expect(configChangeSpy).toHaveBeenCalledTimes(1);
    checkSelectionConfigValue(multSelectKey, ['12345', '67890']);

    allButton.click();
    expect(configChangeSpy).toHaveBeenCalledTimes(2);
    checkSelectionConfigValue(multSelectKey, []);
  });

  it('shows tooltip', async () => {
    const settingsPanel = getAdvancedSettingsPanelForKey(optSelectKey);
    await settingsPanel.openMatSelect();

    const panel = dom.getMatSelectPanel();
    const options = panel.findAll('mat-option');
    const longOption = options[1];

    const longOptionEl = longOption.get('.option-value').getHTMLElement();
    spyOnProperty(longOptionEl, 'scrollWidth').and.returnValue(
      longOptionEl.clientWidth * 2,
    );

    await checkTooltips(options, [undefined, options[1].getText()]);
  });

  it('disables selection field if no options', async () => {
    assertDefined(
      component.traceConfig?.[optSelectKey].config,
    ).selectionConfigs[0].options = [];
    await detectNgModelChanges();

    const panel = getAdvancedSettingsPanelForKey(optSelectKey);
    await panel.openMatSelect();
    expect(dom.isMatSelectOpen()).toBeFalse();
  });

  it('shows config desc', () => {
    const panel = getAdvancedSettingsPanelForKey(layersTraceKey);
    const configDesc = panel.get('.config-desc');
    expect(configDesc.getText()).toBe('Layers trace config description');
  });

  it('applies chip configuration changes', async () => {
    const settingsPanel = getAdvancedSettingsPanelForKey(layersTraceKey);
    await settingsPanel.openMatSelect();
    const panel = dom.getMatSelectPanel();
    expect(panel.get('.option').find('.user-option')).toBeUndefined();

    const selectionConfig = assertDefined(
      component.traceConfig?.[layersTraceKey].config,
    ).selectionConfigs[0];
    selectionConfig.options[0] = {
      value: 'verbose',
      chip: {name: 'chip 1', key: 'chip1', enabled: false},
    };
    dom.detectChanges();

    const option = panel.get('.option');
    const chip = option.get('.user-option');
    chip.checkText('chip 1');
    chip.checkDisabled(true);

    option.click();
    chip.checkDisabled(false);
    chip.checkClassName('not-enabled', true);
    chip.checkClassName('mat-primary', false);

    chip.click();
    chip.checkClassName('not-enabled', false);
    chip.checkClassName('mat-primary', true);
    expect(selectionConfig.options[0].chip?.enabled).toBeTrue();
  });

  it('applies filter inside select correctly', async () => {
    const settingsPanel = getAdvancedSettingsPanelForKey(optMultSelectKey);
    await settingsPanel.openMatSelect();

    const hiddenCss = 'hidden-option';
    const allOptions = dom.getMatSelectPanel().findAll('.option');
    expect(allOptions.length).toBe(3);
    allOptions.forEach((opt) => opt.checkClassName(hiddenCss, false));

    const panel = dom.getMatSelectPanel();
    const input = panel.findAndDispatchInput(filterInputField, '45');
    dom.detectChanges();
    allOptions.forEach((opt, i) => opt.checkClassName(hiddenCss, i === 2));

    input.dispatchInput('');
    allOptions.forEach((opt) => opt.checkClassName(hiddenCss, false));
  });

  it('handles shift+click', async () => {
    configChangeSpy.calls.reset();
    const settingsPanel = getAdvancedSettingsPanelForKey(optMultSelectKey);
    await settingsPanel.openMatSelect();
    const allOptions = dom.getMatSelectPanel().findAll('.option');

    allOptions[0].shiftAndClick();
    expect(configChangeSpy).toHaveBeenCalledTimes(1);
    allOptions[1].shiftAndClick();
    expect(configChangeSpy).toHaveBeenCalledTimes(2);

    allOptions[1].click();
    allOptions[0].click();
    allOptions[0].click();
    configChangeSpy.calls.reset();

    allOptions[2].shiftAndClick();
    expect(configChangeSpy).toHaveBeenCalledTimes(2);
    checkSelectionConfigValue(optMultSelectKey, ['12345', '67890', '45678']);
  });

  it('calls default select keydown handler', async () => {
    configChangeSpy.calls.reset();
    const settingsPanel = getAdvancedSettingsPanelForKey(optMultSelectKey);
    await settingsPanel.openMatSelect();
    await dom.whenRenderingDone();
    dom.getMatSelectPanel().keydownSpace();
    checkSelectionConfigValue(optMultSelectKey, ['12345']);
    expect(configChangeSpy).toHaveBeenCalledTimes(1);
  });

  it('calls custom select keydown handler for CTRL+A', async () => {
    configChangeSpy.calls.reset();
    const settingsPanel = getAdvancedSettingsPanelForKey(optMultSelectKey);
    await settingsPanel.openMatSelect();
    await dom.whenRenderingDone();

    const panel = dom.getMatSelectPanel();
    const keydownCtrlA = new KeyboardEvent('keydown', {
      code: KeyboardEventCode.A,
      ctrlKey: true,
    });
    panel.dispatchEvent(keydownCtrlA);
    checkSelectionConfigValue(optMultSelectKey, ['12345', '45678', '67890']);
    expect(configChangeSpy).toHaveBeenCalledTimes(1);

    panel.findAndDispatchInput(filterInputField, '45');
    panel.dispatchEvent(keydownCtrlA);
    checkSelectionConfigValue(optMultSelectKey, ['67890']);
    expect(configChangeSpy).toHaveBeenCalledTimes(2);
  });

  async function setComponentInputs(
    c: TraceConfigComponent,
    d: DOMTestHelper<TraceConfigComponent> = dom,
    storage: Store = new InMemoryStorage(),
  ) {
    c.title = 'Targets';
    c.traceConfig = {
      layers_trace: {
        name: layersTraceKey,
        available: true,
        types: [TraceType.SURFACE_FLINGER],
        config: {
          enabled: true,
          checkboxConfigs: [
            {
              name: 'trace buffers',
              key: 'tracebuffers',
              enabled: true,
            },
          ],
          selectionConfigs: [
            {
              key: 'tracinglevel',
              name: 'tracing level',
              options: [
                {value: 'verbose', chip: undefined},
                {value: 'debug'},
                {value: 'critical'},
              ],
              value: 'debug',
            },
          ],
          desc: 'Layers trace config description',
        },
      },
      window_trace: {
        name: windowTraceKey,
        available: true,
        types: [TraceType.WINDOW_MANAGER],
        config: {
          enabled: false,
          checkboxConfigs: [
            {
              name: 'extra',
              key: 'extra',
              enabled: false,
            },
          ],
          selectionConfigs: [],
        },
      },
      unavailable_trace: {
        name: 'unavailable_trace',
        available: false,
        types: [TraceType.TEST_TRACE_STRING],
        config: {
          enabled: false,
          checkboxConfigs: [],
          selectionConfigs: [],
        },
      },
      disabled_checkbox_trace: {
        name: 'disabled_checkbox_trace',
        available: true,
        types: [TraceType.TEST_TRACE_STRING],
        config: {
          enabled: true,
          checkboxConfigs: [
            {
              name: 'extra',
              key: 'extra',
              enabled: true,
              disabled: true,
            },
          ],
          selectionConfigs: [],
        },
      },
      optional_selection_trace: {
        name: optSelectKey,
        available: true,
        types: [TraceType.TEST_TRACE_STRING],
        config: {
          enabled: true,
          checkboxConfigs: [],
          selectionConfigs: [
            {
              key: 'displays',
              name: 'displays',
              options: [{value: '12345'}, {value: 'long_option'.repeat(100)}],
              value: '',
              optional: true,
            },
          ],
        },
      },
      multiple_selection_trace: {
        name: multSelectKey,
        available: true,
        types: [TraceType.TEST_TRACE_STRING],
        config: {
          enabled: true,
          checkboxConfigs: [],
          selectionConfigs: [
            {
              key: 'displays',
              name: 'displays',
              options: [{value: '12345'}, {value: '67890'}],
              value: [],
            },
          ],
        },
      },
      optional_multiple_selection_trace: {
        name: optMultSelectKey,
        available: true,
        types: [TraceType.TEST_TRACE_STRING],
        config: {
          enabled: true,
          checkboxConfigs: [],
          selectionConfigs: [
            {
              key: 'displays',
              name: 'displays',
              options: [{value: '12345'}, {value: '45678'}, {value: '67890'}],
              value: [],
              optional: true,
              filterString: '',
            },
          ],
        },
      },
    };
    c.traceConfigStoreKey = storeKey;
    c.storage = storage;
    await detectNgModelChanges(d);
    d.detectChanges();
  }

  async function detectNgModelChanges(
    d: DOMTestHelper<TraceConfigComponent> = dom,
  ) {
    await d.detectChangesAndWaitStable();
    d.detectChanges();
  }

  function getTraceBoxForKey(
    traceKey: string,
  ): DOMTestHelper<TraceConfigComponent> {
    const index = component
      .getSortedTraceKeys()
      .findIndex((key) => key === traceKey);
    return dom.findAll('.trace-checkbox')[index];
  }

  function getAdvancedSettingsPanelForKey(
    configKey: string,
  ): DOMTestHelper<TraceConfigComponent> {
    const index = component
      .getSortedTraceKeys()
      .findIndex((key) => key === configKey);
    dom.findAll('.trace-checkbox')[index].findAndClick(advancedSettingsButton);
    return dom.getInDocument('.overlay-panel');
  }

  function getCheckboxConfigSectionForKey(
    configKey: string,
  ): DOMTestHelper<TraceConfigComponent> {
    const panel = getAdvancedSettingsPanelForKey(configKey);
    return panel.get('.enable-config-opt');
  }

  function checkSelectionConfigValue(
    traceKey: string,
    expected: string | string[],
  ) {
    expect(
      configChangeSpy.calls.mostRecent().args[0][traceKey].config
        .selectionConfigs[0].value,
    ).toEqual(expected);
  }
});
