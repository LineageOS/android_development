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
import {Store} from '@common/store/store';
import {ProgressListener} from '@messaging/progress_listener';
import {AppTraceViewRequest, AppTraceViewRequestHandled} from '@app/app_events';
import {ShowTraceUploadWarning} from '@trace/trace_events';
import {WinscopeEvent} from '@messaging/winscope_event';
import {WinscopeEventListener} from '@messaging/winscope_event_listener';
import {getLogger} from '@compat/logging';
import {TRACE_INFO} from '@trace_api/trace_info';
import {
  isTraceTypeWithViewer,
  getReasonForNoTraceVisualization,
  TraceType,
} from '@trace_api/trace_type';
import {LoadProgressComponent} from './load_progress_component';
import {FileReader} from '@trace_api/file_reader';
import {LegacyFileReader} from '@legacy_file_readers/common/legacy_file_reader';

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
  discardLegacyFiles = false;

  readonly legacyTraceWarningTooltip =
    'This trace has a legacy format. ' +
    'Unless "Discard legacy traces" is selected, this trace will be converted ' +
    'to a Perfetto trace when you click "View traces".';

  @Input() loadedFileReaders: FileReader[] | undefined;
  @Input() storage: Store | undefined;
  @Output() filesUploaded = new EventEmitter<File[]>();
  @Output() viewTracesButtonClick = new EventEmitter<boolean>();
  @Output() downloadTracesClick = new EventEmitter<void>();
  @Output() removeTrace = new EventEmitter<FileReader>();
  @Output() removeAllTraces = new EventEmitter<void>();

  private readonly discardLegacyStoreKey = 'discardLegacyFiles';

  constructor(
    @Inject(ChangeDetectorRef) private changeDetectorRef: ChangeDetectorRef,
    @Inject(NgZone) private ngZone: NgZone,
  ) {}

  ngOnInit() {
    if (this.storage) {
      const storedValue = this.storage.get(this.discardLegacyStoreKey);
      this.discardLegacyFiles =
        storedValue === 'true' || storedValue === undefined;
    }
    this.removeAllTraces.emit();
    this.clearAllWarnings();
  }

  hasLoadedFiles(): boolean {
    return (this.loadedFileReaders?.length ?? 0) > 0;
  }

  updateDiscardLegacyTraces() {
    this.discardLegacyFiles = !this.discardLegacyFiles;
    this.storage?.add(
      this.discardLegacyStoreKey,
      this.discardLegacyFiles.toString(),
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
    this.viewTracesButtonClick.emit(this.discardLegacyFiles);
  }

  onClearButtonClick() {
    this.removeAllTraces.emit();
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

  onRemoveTrace(event: MouseEvent, reader: FileReader) {
    event.preventDefault();
    event.stopPropagation();
    this.removeTrace.emit(reader);
    this.onOperationFinished();
  }

  hasLoadedFilesWithViewers(): boolean {
    return this.ngZone.run(() => {
      return (
        this.loadedFileReaders?.some((reader) => {
          return isTraceTypeWithViewer(reader.getTraceType());
        }) ?? false
      );
    });
  }

  isDiscardLegacyTracesBoxDisabled(): boolean {
    if (this.isViewTracesButtonDisabled()) {
      return true;
    }
    const isDisabled = !this.loadedFileReaders?.some((reader) => {
      return this.isLegacyTrace(reader);
    });
    return isDisabled;
  }

  isViewTracesButtonDisabled(): boolean {
    return this.viewersLoading || !this.hasLoadedFilesWithViewers();
  }

  canVisualizeTrace(traceType: TraceType): boolean {
    return isTraceTypeWithViewer(traceType);
  }

  isLegacyTrace(reader: FileReader): boolean {
    return (reader as LegacyFileReader).convertToPerfettoPackets !== undefined;
  }

  cannotVisualizeTraceTooltip(traceType: TraceType): string {
    return getReasonForNoTraceVisualization(traceType);
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
