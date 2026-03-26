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

import {CommonModule} from '@angular/common';
import {ChangeDetectorRef, Component, computed, Inject, input, NgZone, output, signal, ViewEncapsulation,} from '@angular/core';
import {MatButtonModule} from '@angular/material/button';
import {MatCardModule} from '@angular/material/card';
import {MatDialog} from '@angular/material/dialog';
import {MatFormFieldModule} from '@angular/material/form-field';
import {MatIconModule} from '@angular/material/icon';
import {MatListModule} from '@angular/material/list';
import {MatSelectModule} from '@angular/material/select';
import {MatTabsModule} from '@angular/material/tabs';
import {MatTooltipModule} from '@angular/material/tooltip';
import {LoadProgressComponent} from '@app/trace_loading/load_progress_component';
import {assertDefined, assertTrue, assertUnreachable} from '@common/assert';
import {Store} from '@common/store/store';
import {equal} from '@common/typed_array';
import {getLogger} from '@compat/logging';
import {Analytics} from '@logging/analytics';
import {ProgressListener} from '@messaging/progress_listener';
import {WinscopeEvent} from '@messaging/winscope_event';
import {EmitEvent, WinscopeEventEmitter,} from '@messaging/winscope_event_emitter';
import {WinscopeEventListener} from '@messaging/winscope_event_listener';
import {UserNotifier} from '@services/user_notifier';
import {AdbConnectionType} from '@trace_collection/adb_connection_type';
import {AdbDeviceConnection, AdbDeviceState,} from '@trace_collection/adb_device_connection';
import {AdbFiles, RequestedTraceTypes} from '@trace_collection/adb_files';
import {ConnectionState} from '@trace_collection/connection_state';
import {ConnectionStateListener} from '@trace_collection/connection_state_listener';
import {TraceCollectionController} from '@trace_collection/controller/trace_collection_controller';
import {UiTraceTarget} from '@trace_collection/ui_trace_target';
import {CheckboxConfiguration, makeDefaultDumpConfigMap, makeDefaultTraceConfigMap, makeProtologGroupOptions, makeScreenRecordingSelectionConfigs, SelectionConfiguration, TraceConfigurationMap, updateConfigsFromStore,} from '@trace_collection/ui/ui_trace_configuration';
import {UserRequest, UserRequestConfig} from '@trace_collection/user_request';
import {AppRefreshDumpsRequest} from '@ui/shared/events/app_events';
import {NoTraceTargetsSelectedEvent} from '@ui/shared/events/misc_events';
import {makeWarningProxyTraceTimeout} from '@ui/trace_loading/warnings';

import {TraceConfigComponent} from './trace_config_component';
import {WarningDialogComponent, WarningDialogData, WarningDialogResult,} from './warning_dialog_component';
import {WdpSetupComponent} from './wdp_setup_component';
import {WinscopeProxySetupComponent} from './winscope_proxy_setup_component';

/**
 * A component for collecting traces from an Android device.
 */
@Component({
  selector: 'collect-traces',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatFormFieldModule,
    MatSelectModule,
    MatButtonModule,
    MatTooltipModule,
    MatIconModule,
    WinscopeProxySetupComponent,
    WdpSetupComponent,
    MatListModule,
    MatTabsModule,
    TraceConfigComponent,
    LoadProgressComponent,
  ],
  templateUrl: './collect_traces_component.ng.html',
  styleUrls: ['collect_traces_component.scss'],
  encapsulation: ViewEncapsulation.None,
})
export class CollectTracesComponent
  implements
    ProgressListener,
    WinscopeEventListener,
    WinscopeEventEmitter,
    ConnectionStateListener
{
  objectKeys = Object.keys;
  AdbConnectionType = AdbConnectionType;
  AdbDeviceState = AdbDeviceState;
  ConnectionState = ConnectionState;
  progressMessage = 'Fetching...';
  progressIcon = 'sync';
  progressPercentage: number | undefined;
  lastUiProgressUpdateTimeMs?: number;
  targetTabIndex = 0;
  connectionTabIndex = 0;
  traceConfig = signal<TraceConfigurationMap>(makeDefaultTraceConfigMap());
  dumpConfig = signal<TraceConfigurationMap>(makeDefaultDumpConfigMap());
  requestedTraceTypes: RequestedTraceTypes[] = [];
  controller: TraceCollectionController | undefined;
  errorText = '';

  refreshDumps = signal<boolean>(false);
  state = signal<ConnectionState>(ConnectionState.CONNECTING);
  isChangingConnection = signal<boolean>(false);
  private isExternalOperationInProgress = signal<boolean>(false);

  readonly storeKeyPrefixTraceConfig = 'TraceSettings.';
  readonly storeKeyPrefixDumpConfig = 'DumpSettings.';
  private readonly storeKeyImeWarning = 'doNotShowImeWarningDialog';
  private readonly storeKeyLastDevice = 'adb.lastDevice';
  private readonly storeKeyAdbConnectionType = 'adbConnectionType';

  private selectedDevice: AdbDeviceConnection | undefined;
  private emitEvent: EmitEvent = () => Promise.resolve();

  private readonly notConnected = [
    ConnectionState.CONNECTING,
    ConnectionState.NOT_FOUND,
    ConnectionState.UNAUTH,
    ConnectionState.INVALID_VERSION,
  ];
  private readonly tracingSessionStates = [
    ConnectionState.STARTING_TRACE,
    ConnectionState.TRACING,
    ConnectionState.ENDING_TRACE,
    ConnectionState.DUMPING_STATE,
  ];

  store = input.required<Store>();
  readonly filesCollected = output<AdbFiles>();

  readonly isLoadOperationInProgress = computed<boolean>(() => {
    return (
      this.state() === ConnectionState.LOADING_DATA ||
      this.isExternalOperationInProgress()
    );
  });

  readonly isTracing = computed<boolean>(() => {
    return this.tracingSessionStates.includes(this.state());
  });

  readonly isTracingOrLoading = computed<boolean>(() => {
    return this.isTracing() || this.isLoadOperationInProgress();
  });

  readonly isDumpingState = computed<boolean>(() => {
    return (
      this.refreshDumps() ||
      this.state() === ConnectionState.DUMPING_STATE ||
      this.isLoadOperationInProgress()
    );
  });

  readonly disableTraceSection = computed<boolean>(() => {
    return this.isTracingOrLoading() || this.refreshDumps();
  });

  readonly adbSuccess = computed<boolean>(() => {
    return (
      this.isChangingConnection() || !this.notConnected.includes(this.state())
    );
  });

  constructor(
    @Inject(ChangeDetectorRef) private changeDetectorRef: ChangeDetectorRef,
    @Inject(MatDialog) private dialog: MatDialog,
    @Inject(NgZone) private ngZone: NgZone,
  ) {}

  async ngOnInit() {
    const adbConnectionType = this.store().get(this.storeKeyAdbConnectionType);
    if (adbConnectionType !== undefined) {
      await this.changeHostConnection(adbConnectionType);
    } else {
      await this.changeHostConnection(AdbConnectionType.WDP);
    }
  }

  getConnectionType(): AdbConnectionType | undefined {
    return this.controller?.getConnectionType();
  }

  ngOnDestroy() {
    const selectedDevice = this.selectedDevice;
    if (selectedDevice) {
      this.controller?.onDestroy(selectedDevice);
    }
  }

  setEmitEvent(callback: EmitEvent) {
    this.emitEvent = callback;
  }

  async onConnectionChange(adbConnectionType: string) {
    this.isChangingConnection.set(true);
    this.changeDetectorRef.detectChanges();
    await this.changeHostConnection(adbConnectionType);
  }

  onConnectionTabAnimationDone() {
    this.isChangingConnection.set(false);
    this.changeDetectorRef.detectChanges();
  }

  showTraceCollectionConfig(): boolean {
    if (this.selectedDevice === undefined) {
      return false;
    }
    return this.state() === ConnectionState.IDLE || this.isTracingOrLoading();
  }

  selectedDeviceName(): string | undefined {
    const selectedDevice = this.selectedDevice;
    return selectedDevice ? this.getDeviceName(selectedDevice) : undefined;
  }

  onDeviceClick(device: AdbDeviceConnection) {
    if (this.deviceNeedsAuthFromWinscope(device)) {
      device.tryAuthorize();
      return;
    }
    if (device.getState() !== AdbDeviceState.AVAILABLE) {
      return;
    }
    this.selectedDevice = device;
    this.onDevicesChange(assertDefined(this.controller).getDevices());
    this.store().add(this.storeKeyLastDevice, device.id);
    this.changeDetectorRef.detectChanges();
  }

  onAuthorizeButtonClick(event: MouseEvent, device: AdbDeviceConnection) {
    event.stopPropagation();
    device.tryAuthorize();
  }

  async onWinscopeEvent(event: WinscopeEvent) {
    switch (event.constructor) {
      case AppRefreshDumpsRequest:
        return await this.onAppRefreshDumpsRequest();
      default:
        getLogger('CollectTracesComponent').trace(
          'Not processing event ' + event.constructor.name,
        );
    }
  }

  onProgressUpdate(message: string, progressPercentage: number | undefined) {
    if (
      !LoadProgressComponent.canUpdateComponent(this.lastUiProgressUpdateTimeMs)
    ) {
      return;
    }
    this.isExternalOperationInProgress.set(true);
    this.progressMessage = message;
    this.progressPercentage = progressPercentage;
    this.lastUiProgressUpdateTimeMs = Date.now();
    this.changeDetectorRef.detectChanges();
  }

  onOperationFinished(success: boolean) {
    this.isExternalOperationInProgress.set(false);
    this.lastUiProgressUpdateTimeMs = undefined;
    if (!success) {
      this.controller?.restartConnection();
    }
    this.changeDetectorRef.detectChanges();
  }

  async onRetryConnection(token?: string) {
    const controller = assertDefined(this.controller);
    if (token !== undefined) {
      controller.setSecurityToken(token);
    }
    await controller.restartConnection();
  }

  showAllDevices(): boolean {
    const controller = assertDefined(this.controller);
    if (this.state() !== ConnectionState.IDLE) {
      return false;
    }

    const devices = controller.getDevices();
    const lastId = this.store().get(this.storeKeyLastDevice) ?? undefined;

    const selectedDevice = this.selectedDevice;
    if (selectedDevice) {
      const newDevice = devices.find((d) => d.id === selectedDevice.id);
      if (newDevice && newDevice.getState() === AdbDeviceState.AVAILABLE) {
        this.selectedDevice = newDevice;
      } else {
        this.selectedDevice = undefined;
      }
    }

    if (this.selectedDevice === undefined && lastId !== undefined) {
      const device = devices.find((d) => d.id === lastId);
      if (device && device.getState() === AdbDeviceState.AVAILABLE) {
        this.selectedDevice = device;
        this.onDevicesChange(devices);
        this.store().add(this.storeKeyLastDevice, device.id);
        return false;
      }
    }

    return this.selectedDevice === undefined;
  }

  async onChangeDeviceButton() {
    this.store().add(this.storeKeyLastDevice, '');
    this.selectedDevice = undefined;
    await this.controller?.restartConnection();
  }

  async onRetryButton() {
    await assertDefined(this.controller).restartConnection();
  }

  async startTracing() {
    const requestedTraces = this.getRequests(this.traceConfig());
    const imeReq = requestedTraces.includes(UiTraceTarget.IME);
    const doNotShowDialog = !!this.store().get(this.storeKeyImeWarning);

    if (!imeReq || doNotShowDialog) {
      await this.requestTraces(requestedTraces);
      return;
    }

    const sfReq = requestedTraces.includes(UiTraceTarget.SURFACE_FLINGER_TRACE);
    const transactionsReq = requestedTraces.includes(
      UiTraceTarget.TRANSACTIONS,
    );
    const wmReq = requestedTraces.includes(UiTraceTarget.WINDOW_MANAGER_TRACE);
    const imeValidFrameMapping = sfReq && transactionsReq && wmReq;

    if (imeValidFrameMapping) {
      await this.requestTraces(requestedTraces);
      return;
    }

    this.ngZone.run(() => {
      const closeText = 'Collect traces anyway';
      const optionText = 'Do not show again';
      const data: WarningDialogData = {
        message: `Cannot build frame mapping for IME with selected traces - some Winscope features may not work properly.

        Consider the following selection for valid frame mapping:
        Surface Flinger, Transactions, Window Manager, IME`,
        actions: ['Go back'],
        options: [optionText],
        closeText,
      };
      const dialogRef = this.dialog.open(WarningDialogComponent, {
        data,
        disableClose: true,
        panelClass: 'warning-panel',
      });
      dialogRef
        .beforeClosed()
        .subscribe((result: WarningDialogResult | undefined) => {
          if (result?.selectedOptions.includes(optionText)) {
            this.store().add(this.storeKeyImeWarning, 'true');
          }
          if (result?.closeActionText === closeText) {
            this.requestTraces(requestedTraces);
          }
        });
    });
  }

  async dumpState() {
    const dumpConfig = this.dumpConfig();
    const requestedDumps = this.getRequests(dumpConfig);
    if (requestedDumps.length === 0) {
      this.emitEvent(new NoTraceTargetsSelectedEvent());
      return;
    }

    const requestedTraceTypes = requestedDumps.map((req) => {
      return {
        name: dumpConfig[req].name,
        types: dumpConfig[req].types,
      };
    });
    Analytics.Tracing.logCollectDumps(
      requestedTraceTypes.map((t) => t.name),
      this.getConnectionType(),
    );

    const requestedDumpsWithConfig: UserRequest[] = requestedDumps.map(
      (target) => {
        const enabledConfig = this.requestedEnabledConfig(target, dumpConfig);
        const selectedConfig = this.requestedSelectedConfig(target, dumpConfig);
        return {
          target,
          config: enabledConfig.concat(selectedConfig),
        };
      },
    );

    const controller = assertDefined(this.controller);
    const device = assertDefined(this.selectedDevice);
    await this.setState(ConnectionState.DUMPING_STATE);
    await controller.dumpState(device, requestedDumpsWithConfig);
    this.refreshDumps.set(false);
    this.changeDetectorRef.detectChanges();
    if (this.state() === ConnectionState.DUMPING_STATE) {
      this.filesCollected.emit({
        requested: requestedTraceTypes,
        collected: await this.fetchLastSessionData(),
      });
    }
  }

  async endTrace() {
    const selectedDevice = this.selectedDevice;
    if (!selectedDevice) {
      return;
    }
    const controller = assertDefined(this.controller);
    await this.setState(ConnectionState.ENDING_TRACE);
    await controller.endTrace(selectedDevice);
    if (this.state() === ConnectionState.ENDING_TRACE) {
      this.filesCollected.emit({
        requested: this.requestedTraceTypes,
        collected: await this.fetchLastSessionData(),
      });
    }
  }

  getDeviceName(device: AdbDeviceConnection): string {
    return device.getFormattedName();
  }

  deviceNeedsAuthFromWinscope(device: AdbDeviceConnection): boolean {
    return (
      device.getState() === AdbDeviceState.UNAUTHORIZED &&
      this.getConnectionType() === AdbConnectionType.WDP
    );
  }

  getDeviceStateIcon(state: AdbDeviceState): string {
    switch (state) {
      case AdbDeviceState.AVAILABLE:
        return 'smartphone';
      case AdbDeviceState.UNAUTHORIZED:
        return 'screen_lock_portrait';
      case AdbDeviceState.OFFLINE:
        return 'mobile_off';
      default:
        assertUnreachable(state);
    }
  }

  async fetchExistingTraces() {
    const controller = assertDefined(this.controller);
    const files = await this.fetchLastSessionData();
    this.filesCollected.emit({
      requested: [],
      collected: files,
    });
    if (files.length === 0) {
      await controller.restartConnection();
    }
  }

  onAvailableTracesChange(
    newTraces: UiTraceTarget[],
    removedTraces: UiTraceTarget[],
  ) {
    const traceConfig = this.traceConfig();
    newTraces.forEach((trace) => {
      const config = traceConfig[trace];
      config.available = true;
    });
    removedTraces.forEach((trace) => {
      const config = traceConfig[trace];
      config.available = false;
    });
  }

  onDevicesChange(devices: AdbDeviceConnection[]) {
    const selectedDevice = this.selectedDevice;
    if (!selectedDevice) {
      return;
    }
    const device = devices.find((d) => d.id === selectedDevice.id);
    if (!device) {
      return;
    }
    this.updateMediaBasedConfig(device);
    this.updateProtologConfig(device);
    this.changeDetectorRef.detectChanges();
  }

  async onError(errorText: string) {
    await this.setState(ConnectionState.ERROR, errorText);
  }

  async onConnectionStateChange(newState: ConnectionState): Promise<void> {
    switch (newState) {
      case ConnectionState.IDLE:
        if (this.state() === ConnectionState.CONNECTING) {
          await this.setState(newState);
        }
        return;
      case ConnectionState.CONNECTING:
        await this.setState(newState);
        return;
      default:
        if (newState !== this.state()) {
          await this.setState(newState);
        }
    }
  }

  private async onAppRefreshDumpsRequest() {
    this.targetTabIndex = 1;
    this.dumpConfig.set(
      updateConfigsFromStore(
        JSON.parse(JSON.stringify(this.dumpConfig())),
        this.store(),
        this.storeKeyPrefixDumpConfig,
      ),
    );
    this.refreshDumps.set(true);
    this.changeDetectorRef.detectChanges();
  }

  private async changeHostConnection(adbConnectionType: string) {
    const selectedDevice = this.selectedDevice;
    if (selectedDevice) {
      await this.controller?.onDestroy(selectedDevice);
    }
    this.controller = new TraceCollectionController(adbConnectionType, this);
    this.connectionTabIndex =
      adbConnectionType === AdbConnectionType.WINSCOPE_PROXY ? 1 : 0;
    this.changeDetectorRef.detectChanges();
    this.store().add(this.storeKeyAdbConnectionType, adbConnectionType);
    await this.controller.restartConnection();
  }

  private async requestTraces(requestedTraces: UiTraceTarget[]) {
    const traceConfig = this.traceConfig();
    this.requestedTraceTypes = requestedTraces.map((req) => {
      return {
        name: traceConfig[req].name,
        types: traceConfig[req].types,
      };
    });
    Analytics.Tracing.logCollectTraces(
      this.requestedTraceTypes.map((t) => t.name),
      this.getConnectionType(),
    );

    if (requestedTraces.length === 0) {
      this.emitEvent(new NoTraceTargetsSelectedEvent());
      return;
    }

    const requestedTracesWithConfig: UserRequest[] = requestedTraces.map(
      (target) => {
        const enabledConfig = this.requestedEnabledConfig(target, traceConfig);
        const selectedConfig = this.requestedSelectedConfig(
          target,
          traceConfig,
        );
        return {
          target,
          config: enabledConfig.concat(selectedConfig),
        };
      },
    );
    const startTimeMs = Date.now();
    await this.setState(ConnectionState.STARTING_TRACE);
    await assertDefined(this.controller).startTrace(
      assertDefined(this.selectedDevice),
      requestedTracesWithConfig,
    );
    if (this.state() === ConnectionState.STARTING_TRACE) {
      Analytics.Tracing.logStartTime(Date.now() - startTimeMs);
      await this.setState(ConnectionState.TRACING);
    }
  }

  private async fetchLastSessionData() {
    await this.setState(ConnectionState.LOADING_DATA);
    const startTimeMs = Date.now();
    const files = await assertDefined(this.controller).fetchLastSessionData(
      assertDefined(this.selectedDevice),
    );
    if (files.length === 0) {
      Analytics.Proxy.logNoFilesFound();
    }
    const size = files.reduce((total, file) => (total += file.size), 0);
    Analytics.Loading.logFileExtractionTime(
      'device',
      Date.now() - startTimeMs,
      size,
    );
    return files;
  }

  private getRequests(configMap: TraceConfigurationMap): UiTraceTarget[] {
    return Object.keys(configMap)
      .filter((dumpKey: string) => {
        return configMap[dumpKey].config.enabled && dumpKey in UiTraceTarget;
      })
      .map((key) => Number(key)) as UiTraceTarget[];
  }

  private requestedEnabledConfig(
    target: UiTraceTarget,
    configMap: TraceConfigurationMap,
  ): UserRequestConfig[] {
    const trace = configMap[target];
    assertTrue(trace?.config.enabled ?? false);
    const req: UserRequestConfig[] = [];
    trace.config.checkboxConfigs.forEach((con: CheckboxConfiguration) => {
      if (con.enabled && !con.disabled) {
        req.push({key: con.key});
      }
    });
    return req;
  }

  private requestedSelectedConfig(
    target: UiTraceTarget,
    configMap: TraceConfigurationMap,
  ): UserRequestConfig[] {
    const trace = configMap[target];
    assertTrue(trace?.config.enabled ?? false);
    return trace.config.selectionConfigs.flatMap(
      (con: SelectionConfiguration) => {
        if (
          !Array.isArray(con.value) ||
          con.options.every((opt) => opt.chip === undefined)
        ) {
          return {key: con.key, value: con.value};
        }

        const subRequests = con.value.map((val) => {
          const config: UserRequestConfig = {
            key: val,
            value: undefined,
          };
          const chip = assertDefined(
            con.options.find((o) => o.value === val),
          ).chip;
          if (chip?.enabled) {
            config.value = chip.key;
          }
          return config;
        });
        return {key: con.key, subRequests};
      },
    );
  }

  private updateMediaBasedConfig(device: AdbDeviceConnection) {
    const traceConfig = this.traceConfig();
    const screenRecordingConfig =
      traceConfig[UiTraceTarget.SCREEN_RECORDING].config;
    const displaysConfig = assertDefined(
      screenRecordingConfig.selectionConfigs.find((c) => c.key === 'displays'),
    );
    const multiDisplay = device.hasMultiDisplayScreenRecording();
    const displayOptions = device.getDisplays().map((d) => {
      return {value: d};
    });

    if (multiDisplay && !Array.isArray(displaysConfig.value)) {
      screenRecordingConfig.selectionConfigs =
        makeScreenRecordingSelectionConfigs(displayOptions, []);
    } else if (!multiDisplay && Array.isArray(displaysConfig.value)) {
      screenRecordingConfig.selectionConfigs =
        makeScreenRecordingSelectionConfigs(displayOptions, '');
    } else {
      screenRecordingConfig.selectionConfigs[0].options = displayOptions;
    }

    const dumpConfig = this.dumpConfig();
    const screenshotConfig = dumpConfig[UiTraceTarget.SCREENSHOT].config;
    assertDefined(
      screenshotConfig.selectionConfigs.find((c) => c.key === 'displays'),
    ).options = displayOptions;
  }

  private updateProtologConfig(device: AdbDeviceConnection) {
    const traceConfig = this.traceConfig();
    const config = traceConfig[UiTraceTarget.PROTO_LOG].config.selectionConfigs;
    const groupsConfig = assertDefined(config?.find((c) => c.key === 'groups'));
    const groups = device.getProtologGroups();
    const currentOptions = groupsConfig.options.map((opt) => opt.value);
    if (equal(currentOptions, groups)) {
      return;
    }
    groupsConfig.options = makeProtologGroupOptions(groups);
  }

  private async setState(newState: ConnectionState, errorText = '') {
    this.updateProgressMessage(newState);

    const controller = assertDefined(this.controller);

    this.state.set(newState);
    this.errorText = errorText;
    this.changeDetectorRef.detectChanges();

    const maybeRefreshDumps =
      this.refreshDumps() &&
      newState !== ConnectionState.LOADING_DATA &&
      newState !== ConnectionState.CONNECTING;
    if (
      maybeRefreshDumps &&
      newState === ConnectionState.IDLE &&
      this.selectedDevice
    ) {
      await this.dumpState();
    } else if (maybeRefreshDumps) {
      // device is not connected or proxy is not started/invalid/in error state
      // so cannot refresh dump automatically
      this.refreshDumps.set(false);
      this.changeDetectorRef.detectChanges();
    }

    const deviceRequestStates = [
      ConnectionState.IDLE,
      ConnectionState.CONNECTING,
    ];
    if (!deviceRequestStates.includes(newState)) {
      controller.cancelDeviceRequests();
    }

    switch (newState) {
      case ConnectionState.TRACE_TIMEOUT:
        UserNotifier.add(makeWarningProxyTraceTimeout());
        await this.endTrace();
        return;
      case ConnectionState.NOT_FOUND:
        Analytics.Proxy.logServerNotFound(controller.getConnectionType());
        return;

      case ConnectionState.ERROR:
        Analytics.Error.logProxyError(this.errorText);
        return;

      case ConnectionState.CONNECTING:
        await controller.requestDevices();
        return;

      case ConnectionState.IDLE: {
        await this.selectedDevice?.updateAvailableTraces();
        return;
      }
      default:
      // do nothing
    }
  }

  private updateProgressMessage(newState: ConnectionState) {
    switch (newState) {
      case ConnectionState.STARTING_TRACE:
        this.progressMessage = 'Starting trace...';
        this.progressIcon = 'cable';
        this.progressPercentage = undefined;
        break;
      case ConnectionState.TRACING:
        this.progressMessage = 'Tracing...';
        this.progressIcon = 'cable';
        this.progressPercentage = undefined;
        break;
      case ConnectionState.ENDING_TRACE:
        this.progressMessage = 'Ending trace...';
        this.progressIcon = 'cable';
        break;
      case ConnectionState.DUMPING_STATE:
        this.progressMessage = 'Dumping state...';
        this.progressIcon = 'cable';
        break;
      default:
        this.progressIcon = 'sync';
    }
  }
}
