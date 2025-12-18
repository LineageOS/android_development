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
import {
  ChangeDetectorRef,
  Component,
  EventEmitter,
  Inject,
  Input,
  NgZone,
  Output,
} from '@angular/core';
import {MatButtonModule} from '@angular/material/button';
import {MatCardModule} from '@angular/material/card';
import {MatCheckboxModule} from '@angular/material/checkbox';
import {MatIconModule} from '@angular/material/icon';
import {MatListModule} from '@angular/material/list';
import {MatTooltipModule} from '@angular/material/tooltip';
import {TracePipeline} from '@app/trace_pipeline';
import {Store} from '@common/store/store';
import {ProgressListener} from '@messaging/progress_listener';
import {AppTraceViewRequest, AppTraceViewRequestHandled} from '@app/app_events';
import {ShowTraceUploadWarning} from '@trace/trace_events';
import {WinscopeEvent} from '@messaging/winscope_event';
import {WinscopeEventListener} from '@messaging/winscope_event_listener';
import {getLogger} from '@compat/logging';
import {Trace} from '@trace_api/trace';
import {TRACE_INFO} from '@trace_api/trace_info';
import {
  isTraceTypeWithViewer,
  getReasonForNoTraceVisualization,
} from '@trace_api/trace_type';
import {LoadProgressComponent} from './load_progress_component';

/**
 * A component for uploading traces.
 */
@Component({
  selector: 'upload-traces',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatButtonModule,
    MatTooltipModule,
    MatCheckboxModule,
    MatIconModule,
    LoadProgressComponent,
    MatListModule,
  ],
  templateUrl: './upload_traces_component.ng.html',
  styleUrls: ['upload_traces_component.css'],
})
export class UploadTracesComponent
  implements WinscopeEventListener, ProgressListener
{
  TRACE_INFO = TRACE_INFO;
  isLoadingFiles = false;
  progressMessage = '';
  progressPercentage?: number;
  lastUiProgressUpdateTimeMs?: number;
  viewersLoading = false;
  warningMessages: string[] = [];
  discardLegacyTraces = false;

  readonly legacyTraceWarningTooltip =
    'This trace has a legacy format. ' +
    'Unless "Discard legacy traces" is selected, this trace will be converted ' +
    'to a Perfetto trace when you click "View traces".';

  @Input() tracePipeline: TracePipeline | undefined;
  @Input() storage: Store | undefined;
  @Output() filesUploaded = new EventEmitter<File[]>();
  @Output() viewTracesButtonClick = new EventEmitter<boolean>();
  @Output() downloadTracesClick = new EventEmitter<void>();
  @Output() clearAllTraces = new EventEmitter<void>();

  private readonly discardLegacyStoreKey = 'discardLegacyTraces';

  constructor(
    @Inject(ChangeDetectorRef) private changeDetectorRef: ChangeDetectorRef,
    @Inject(NgZone) private ngZone: NgZone,
  ) {}

  ngOnInit() {
    if (this.storage) {
      const storedValue = this.storage.get(this.discardLegacyStoreKey);
      this.discardLegacyTraces =
        storedValue === 'true' || storedValue === undefined;
    }
    this.clearAllTraces.emit();
    this.clearAllWarnings();
  }

  updateDiscardLegacyTraces() {
    this.discardLegacyTraces = !this.discardLegacyTraces;
    this.storage?.add(
      this.discardLegacyStoreKey,
      this.discardLegacyTraces.toString(),
    );
  }

  clearAllWarnings() {
    this.warningMessages = [];
  }

  private async onAppTraceViewRequest() {
    this.viewersLoading = true;
  }

  private async onAppTraceViewRequestHandled() {
    this.viewersLoading = false;
  }

  private async onShowTraceUploadWarning(event: ShowTraceUploadWarning) {
    if (event.message && !this.warningMessages.includes(event.message)) {
      this.warningMessages.push(event.message);
    }
    this.changeDetectorRef.detectChanges();
  }

  async onWinscopeEvent(event: WinscopeEvent) {
    switch (event.constructor) {
      case AppTraceViewRequest:
        return await this.onAppTraceViewRequest();
      case AppTraceViewRequestHandled:
        return await this.onAppTraceViewRequestHandled();
      case ShowTraceUploadWarning:
        return await this.onShowTraceUploadWarning(
          event as ShowTraceUploadWarning,
        );
      default:
        getLogger('UploadTracesComponent').trace(
          'Not processing event ' + event.constructor.name,
        );
    }
  }

  onProgressUpdate(
    message: string | undefined,
    progressPercentage: number | undefined,
  ) {
    if (
      !LoadProgressComponent.canUpdateComponent(this.lastUiProgressUpdateTimeMs)
    ) {
      return;
    }
    this.isLoadingFiles = true;
    this.progressMessage = message ? message : 'Loading...';
    this.progressPercentage = progressPercentage;
    this.lastUiProgressUpdateTimeMs = Date.now();
    this.changeDetectorRef.detectChanges();
  }

  onOperationFinished() {
    this.isLoadingFiles = false;
    this.lastUiProgressUpdateTimeMs = undefined;
    this.changeDetectorRef.detectChanges();
  }

  onInputFiles(event: Event) {
    if (this.viewersLoading) {
      return;
    }
    const files = this.getInputFiles(event);
    if (files.length === 0) return;
    this.filesUploaded.emit(files);
  }

  onViewTracesButtonClick() {
    this.viewTracesButtonClick.emit(this.discardLegacyTraces);
  }

  onClearButtonClick() {
    this.clearAllTraces.emit();
    this.clearAllWarnings();
    this.onOperationFinished();
  }

  onFileDragIn(e: DragEvent) {
    e.preventDefault();
    e.stopPropagation();
  }

  onFileDragOut(e: DragEvent) {
    e.preventDefault();
    e.stopPropagation();
  }

  onFileDrop(e: DragEvent) {
    if (this.viewersLoading) {
      return;
    }
    e.preventDefault();
    e.stopPropagation();
    const droppedFiles = e.dataTransfer?.files;
    if (!droppedFiles) return;
    this.filesUploaded.emit(Array.from(droppedFiles));
  }

  onRemoveTrace(event: MouseEvent, trace: Trace<unknown>) {
    event.preventDefault();
    event.stopPropagation();
    this.tracePipeline?.removeTrace(trace);
    this.onOperationFinished();
    if (this.tracePipeline?.getTraces().getSize() === 0) {
      this.clearAllTraces.emit();
    }
  }

  hasLoadedFilesWithViewers(): boolean {
    return this.ngZone.run(() => {
      let hasFilesWithViewers = false;
      this.tracePipeline?.getTraces().forEachTrace((trace) => {
        if (!trace.isCorrupted() && isTraceTypeWithViewer(trace.type)) {
          hasFilesWithViewers = true;
        }
      });

      return hasFilesWithViewers;
    });
  }

  isDiscardLegacyTracesBoxDisabled(): boolean {
    if (this.isViewTracesButtonDisabled()) {
      return true;
    }
    return !this.tracePipeline?.hasConvertibleLegacyTraces();
  }

  isViewTracesButtonDisabled(): boolean {
    return this.viewersLoading || !this.hasLoadedFilesWithViewers();
  }

  canVisualizeTrace(trace: Trace<unknown>): boolean {
    return isTraceTypeWithViewer(trace.type);
  }

  isLegacyTrace(trace: Trace<unknown>): boolean {
    return !trace.isPerfetto() && trace.getParser().canConvertToPerfetto();
  }

  cannotVisualizeTraceTooltip(trace: Trace<unknown>): string {
    return getReasonForNoTraceVisualization(trace.type);
  }

  traceErrorTooltip(trace: Trace<unknown>): string {
    const reason = trace.getCorruptedReason() ?? 'Trace is corrupted.';
    return 'Cannot visualize trace. ' + reason;
  }

  clearWarning(index: number) {
    this.warningMessages.splice(index, 1);
    this.changeDetectorRef.detectChanges(); // Trigger UI update
  }

  private getInputFiles(event: Event): File[] {
    const files: FileList | null = (event?.target as HTMLInputElement)?.files;
    if (!files || !files[0]) {
      return [];
    }
    return Array.from(files);
  }
}
