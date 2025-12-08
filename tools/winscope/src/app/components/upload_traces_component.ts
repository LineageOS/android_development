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
import {TracePipeline} from 'app/trace_pipeline';
import {Store} from 'common/store/store';
import {ProgressListener} from 'messaging/progress_listener';
import {
  ShowTraceUploadWarning,
  WinscopeEvent,
  WinscopeEventType,
} from 'messaging/winscope_event';
import {WinscopeEventListener} from 'messaging/winscope_event_listener';
import {Trace} from 'trace_api/trace';
import {TRACE_INFO} from 'trace_api/trace_info';
import {TraceTypeUtils} from 'trace_api/trace_type';
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
  template: `
    <mat-card class="upload-card">
      <mat-card-header class="card-header">
        <mat-card-title class="title">Upload Traces</mat-card-title>
        @if (!isLoadingFiles && tracePipeline.getTraces().getSize() > 0) {
          <div
            class="trace-actions-container">
            <div class="trace-action-buttons trace-action-buttons-top">
              <button
                class="clear-all-btn"
                color="primary"
                mat-stroked-button
                [disabled]="viewersLoading"
                (click)="onClearButtonClick()">
                Clear all
              </button>

              <button
                class="download-btn"
                color="primary"
                mat-stroked-button
                (click)="downloadTracesClick.emit()">Download all</button>

              <button
                class="upload-btn"
                color="primary"
                mat-stroked-button
                for="fileDropRef"
                [disabled]="viewersLoading"
                (click)="fileDropRef.click()">
                Upload another file
              </button>
            </div>
            <div class="trace-action-buttons trace-action-buttons-bottom">
              <button
                color="primary"
                mat-raised-button
                class="load-btn"
                matTooltip="Upload trace with an associated viewer to visualize"
                [matTooltipDisabled]="hasLoadedFilesWithViewers()"
                [disabled]="isViewTracesButtonDisabled()"
                (click)="onViewTracesButtonClick()">
                View traces
              </button>
              <mat-checkbox
                class="discard-legacy-traces wrapped-checkbox"
                color="primary"
                [checked]="!isDiscardLegacyTracesBoxDisabled() && discardLegacyTraces"
                [disabled]="isDiscardLegacyTracesBoxDisabled()"
                matTooltip="Discard legacy traces instead of converting to Perfetto to reduce loading time"
                (change)="updateDiscardLegacyTraces()">
                Discard legacy traces
              </mat-checkbox>
            </div>
          </div>
        }
      </mat-card-header>

      @for (message of warningMessages; track message; let i = $index) {
        <div class="warning-banner">
          <div class="warning-content">
            <mat-icon class="warning-icon">warning</mat-icon>
            <span class="warn-message mat-body-1">{{ message }}</span>
          </div>
           <button
              mat-icon-button
              (click)="clearWarning(i)"
              [attr.aria-label]="'Dismiss warning: ' + message">
              <mat-icon>close</mat-icon>
          </button>
        </div>
      }

      <mat-card-content class="upload-card-content">
        <div
          class="drop-box"
          ref="drop-box"
          (dragleave)="onFileDragOut($event)"
          (dragover)="onFileDragIn($event)"
          (drop)="onFileDrop($event)"
          (click)="fileDropRef.click()">
          <input
            id="fileDropRef"
            hidden
            type="file"
            multiple
            onclick="this.value = null"
            #fileDropRef
            (change)="onInputFiles($event)" />

          @if (isLoadingFiles) {
            <load-progress
              [progressPercentage]="progressPercentage"
              [message]="progressMessage">
            </load-progress>
          }

          @if (!isLoadingFiles && tracePipeline.getTraces().getSize() > 0) {
            <mat-list
              class="uploaded-files">
              @for (trace of tracePipeline.getTraces(); track trace) {
                <mat-list-item
                  [class.no-visualization]="!canVisualizeTrace(trace)"
                  [class.trace-error]="trace.isCorrupted()">
                  <mat-icon
                    matListItemIcon
                    [style.color]="TRACE_INFO[trace.type].color">
                    {{ TRACE_INFO[trace.type].icon }}
                  </mat-icon>

                  <p matListItemTitle>{{ TRACE_INFO[trace.type].name }}</p>
                  @for (descriptor of trace.getDescriptors(); track $index; let i = $index) {
                    <p
                      matListItemLine
                      [style.margin-bottom]="i < trace.getDescriptors().length - 1 ? '0' : undefined">{{ descriptor }}</p>
                  }

                  <div matListItemMeta [style.margin-top]="'9px'">
                    @if (!canVisualizeTrace(trace)) {
                      <mat-icon
                        class="warning-icon"
                        [matTooltip]="cannotVisualizeTraceTooltip(trace)">warning</mat-icon>
                    }
                    @if (trace.isCorrupted()) {
                      <mat-icon
                        class="error-icon"
                        [matTooltip]="traceErrorTooltip(trace)">error</mat-icon>
                    }
                    <button
                      class="clear-icon"
                      mat-icon-button
                      (click)="onRemoveTrace($event, trace)"
                      [disabled]="viewersLoading">
                      <mat-icon>close</mat-icon>
                    </button>
                  </div>
                </mat-list-item>
              }
            </mat-list>
          }

          @if (!isLoadingFiles && tracePipeline.getTraces().getSize() === 0) {
            <div
              class="drop-info">
              <p class="icon">
                <mat-icon inline fontIcon="upload"></mat-icon>
              </p>
              <p class="drop-info-text mat-subtitle-2">Drag your Winscope file(s) or click to upload</p>
            </div>
          }
        </div>
      </mat-card-content>
    </mat-card>
  `,
  styles: [
    `
      .upload-card {
        height: 100%;
        display: flex;
        flex-direction: column;
        overflow: auto;
        margin: 10px;
        padding-top: 0px;
      }
      .card-header {
        justify-content: space-between;
        align-items: start;
        display: flex;
        flex-direction: row;
      }
      .title {
        padding-top: 16px;
        text-align: start;
      }
      .trace-actions-container {
        display: flex;
        flex-direction: column;
      }
      .trace-action-buttons {
        display: flex;
        flex-direction: row-reverse;
        flex-wrap: wrap;
        gap: 10px;
      }
      .trace-action-buttons-top {
        padding-bottom: 4px;
      }
      .trace-action-buttons-bottom {
        padding: 4px 0;
      }
      .upload-card-content {
        display: flex;
        flex-direction: column;
        overflow: auto;
        padding-top: 10px;
      }
      .drop-box {
        display: flex;
        flex-direction: column;
        overflow: auto;
        border: 2px dashed var(--border-color);
        cursor: pointer;
        height: 100%;
      }
      .uploaded-files {
        flex: 400px;
        padding: 0;
      }
      .drop-info {
        flex: 400px;
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        pointer-events: none;
        text-align: center;
      }
      .drop-info p {
        opacity: 0.6;
      }
      .drop-info .drop-info-text {
        padding: 0 4px;
      }
      .drop-info .icon {
        font-size: 48px;
        margin: 0;
      }
      .div-progress {
        display: flex;
        height: 100%;
        flex-direction: column;
        justify-content: center;
        align-content: center;
        align-items: center;
      }
      .div-progress p {
        opacity: 0.6;
      }
      .div-progress mat-icon {
        font-size: 3rem;
        width: unset;
        height: unset;
      }
      .div-progress mat-progress-bar {
        max-width: 250px;
      }
      mat-mdc-card-content {
        flex-grow: 1;
      }
      .no-visualization {
        background-color: var(--warning-background-color);
      }
      .trace-error {
        background-color: var(--error-background-color);
      }
      .warning-banner {
        background-color: var(--warning-background-color);
        padding: 8px 8px 8px 16px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        margin: 10px 16px;
        border-radius: 4px;
        box-shadow: 0px 3px 1px -2px rgba(0, 0, 0, 0.2),0px 2px 2px 0px rgba(0, 0, 0, 0.14),0px 1px 5px 0px rgba(0, 0, 0, 0.12);
      }
      .warning-banner .warning-content {
         display: flex;
         align-items: center;
         gap: 8px;
         flex-grow: 1;
         text-align: left;
      }
      .warning-banner .warning-icon {
         flex-shrink: 0;
      }
      .warning-banner .warn-message {
        padding: 0;
        margin: 0;
        white-space: pre-line;
      }
      .clear-icon {
        color: var(--default-text-color);
      }
      .discard-legacy-traces {
        font-size: 14px;
        display: flex;
        align-items: center;
        justify-content: end;
      }
    `,
  ],
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

  @Input() tracePipeline: TracePipeline | undefined;
  @Input() storage: Store | undefined;
  @Output() filesUploaded = new EventEmitter<File[]>();
  @Output() viewTracesButtonClick = new EventEmitter<boolean>();
  @Output() downloadTracesClick = new EventEmitter<void>();

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
    this.tracePipeline?.clear();
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

  async onWinscopeEvent(event: WinscopeEvent) {
    await event.visit(WinscopeEventType.APP_TRACE_VIEW_REQUEST, async () => {
      this.viewersLoading = true;
    });
    await event.visit(
      WinscopeEventType.APP_TRACE_VIEW_REQUEST_HANDLED,
      async () => {
        this.viewersLoading = false;
      },
    );
    await event.visit(
      WinscopeEventType.SHOW_TRACE_UPLOAD_WARNING,
      async (e: ShowTraceUploadWarning) => {
        if (e.message && !this.warningMessages.includes(e.message)) {
          this.warningMessages.push(e.message);
        }
        this.changeDetectorRef.detectChanges();
      },
    );
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
    this.tracePipeline?.clear();
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

  onRemoveTrace(event: MouseEvent, trace: Trace<object>) {
    event.preventDefault();
    event.stopPropagation();
    this.tracePipeline?.removeTrace(trace);
    this.onOperationFinished();
  }

  hasLoadedFilesWithViewers(): boolean {
    return this.ngZone.run(() => {
      let hasFilesWithViewers = false;
      this.tracePipeline?.getTraces().forEachTrace((trace) => {
        if (
          !trace.isCorrupted() &&
          TraceTypeUtils.isTraceTypeWithViewer(trace.type)
        ) {
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

  canVisualizeTrace(trace: Trace<object>): boolean {
    return TraceTypeUtils.isTraceTypeWithViewer(trace.type);
  }

  cannotVisualizeTraceTooltip(trace: Trace<object>): string {
    return TraceTypeUtils.getReasonForNoTraceVisualization(trace.type);
  }

  traceErrorTooltip(trace: Trace<object>): string {
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
