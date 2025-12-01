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
import {DragDropModule} from '@angular/cdk/drag-drop';
import {CommonModule} from '@angular/common';
import {
  ChangeDetectorRef,
  Component,
  ElementRef,
  HostListener,
  Inject,
  Input,
  NgZone,
  SimpleChanges,
  ViewChild,
} from '@angular/core';
import {MatButtonModule} from '@angular/material/button';
import {MatCardModule} from '@angular/material/card';
import {MatIconModule} from '@angular/material/icon';
import {MatSelectChange, MatSelectModule} from '@angular/material/select';
import {MatTooltipModule} from '@angular/material/tooltip';
import {DomSanitizer, SafeUrl} from '@angular/platform-browser';
import {assertDefined} from 'common/assert';
import {Size} from 'common/geometry/size';
import {Timer} from 'common/time/timer';
import {MediaBasedTraceEntry} from 'trace_api/media_based_trace_entry';
import {ViewerEvents} from 'viewers/common/viewer_events';

@Component({
  selector: 'viewer-media-based',
  standalone: true,
  imports: [
    CommonModule,
    DragDropModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatSelectModule,
    MatTooltipModule,
  ],
  template: `
    <div class="overlay">
      <mat-card
        class="container"
        cdkDrag
        cdkDragBoundary=".overlay"
        (dblclick)="onOverlayDblClick()">
        <mat-card-title class="header">
          <button mat-button class="button-drag draggable" cdkDragHandle>
            <mat-icon class="drag-icon">drag_indicator</mat-icon>
          </button>
          @if (titles.length <= 1) {
            <span
              #titleText
              cdkDragHandle
              class="mat-body-2 overlay-title text-no-overflow draggable"
              [matTooltip]="titles.at(index)"
              matTooltipPosition="above"
              [matTooltipShowDelay]="300">
              {{ titles.at(0)?.split(".")[0].split(" ")[0] ?? 'Screen recording'}}
            </span>
          } @else {
            <mat-select
              class="overlay-title text-no-overflow select-title"
              [matTooltip]="titles.at(index)"
              matTooltipPosition="above"
              [matTooltipShowDelay]="300"
              (selectionChange)="onSelectChange($event)"
              [value]="index"
              [disabled]="isInPlaybackMode">
              @for (title of titles; track $index; let i = $index) {
                <mat-option
                  [value]="i">
                  {{ titles[i].split(".")[0] }}
                </mat-option>
              }
            </mat-select>
          }

          <span class="header-end">
            @if (enableDoubleClick) {
              <mat-icon
                class="info-icon material-symbols-outlined"
                matTooltip="Double click overlay when not in playback mode to change active trace to this screen recording"
                matTooltipPosition="above">
                info
              </mat-icon>
            }

            <button
              mat-button
              class="button-minimize"
              [disabled]="forceMinimize"
              (click)="onMinimizeButtonClick()">
              <mat-icon>
                {{ isMinimized() ? 'maximize' : 'minimize' }}
              </mat-icon>
            </button>
          </span>
        </mat-card-title>
        <div
          class="video-container"
          cdkDragHandle
          [style.height]="isMinimized() ? '0px' : ''">
          @if (showFetchingEntriesMessage) {
            <div class="mat-body-1 fetching-entries-message user-notification">
              Loading queued frame...
            </div>
          }
          @let currentTime = getCurrentTime();
          @if (hasImageToShow()) {
            <canvas
              id="frameCanvasElementOverlay"
              [class.reduce-opacity]="showFetchingEntriesMessage"
              #frameCanvasElementOverlay></canvas>
          } @else if (safeUrl !== undefined && currentTime !== undefined) {
            <video
              [currentTime]="currentTime"
              [src]="safeUrl"
              preload="auto"
              #videoElement></video>
          } @else {
            <div class="no-video">
              <p class="mat-body-2">No frame to show.</p>
            </div>
          }
        </div>
      </mat-card>
    </div>
  `,
  styles: [
    `
      .overlay {
        z-index: 30;
        position: fixed;
        top: 0px;
        left: 0px;
        width: 100%;
        height: 100%;
        pointer-events: none;
      }

      .container {
        pointer-events: all;
        width: max(250px, 15vw);
        min-width: 200px;
        resize: horizontal;
        overflow: hidden;
        display: flex;
        flex-direction: column;
        padding: 0;
        left: 80vw;
        top: 20vh;
      }

      .header {
        display: flex;
        flex-direction: row;
        margin: 0px;
        border: 1px solid var(--border-color);
        border-radius: 4px;
        justify-content: space-between;
        align-items: center;
      }

      .draggable {
        cursor: grab;
      }

      .button-drag {
        padding: 2px;
        min-width: fit-content;
      }

      .overlay-title {
        font-size: 14px;
        width: unset;
      }

      .select-title {
        display: flex;
        align-items: center;
      }

      .header-end {
        display: flex;
        flex-direction: row;
        align-items: center;
      }

      .info-icon {
        transform: scale(0.75);
        cursor: pointer;
      }

      .button-minimize {
        flex-grow: 0;
        padding: 2px;
        min-width: 24px;
      }

      .video-container, canvas, video {
        border: 1px solid var(--default-border);
        width: 100%;
        height: auto;
        cursor: grab;
        overflow: hidden;
      }

      .no-video {
        padding: 1rem;
        text-align: center;
      }

      .fetching-entries-message {
        text-align: center;
        position: absolute;
        z-index: 100;
        width: calc(100% - 52px);
      }

      .reduce-opacity {
        opacity: 90%;
      }
    `,
  ],
})
export class ViewerMediaBasedComponent {
  safeUrl: SafeUrl | undefined = undefined;
  showFetchingEntriesMessage = false;
  shouldMinimize = false;
  index = 0;

  @ViewChild('videoElement') private videoElement:
    | ElementRef<HTMLVideoElement>
    | undefined;

  @ViewChild('frameCanvasElementOverlay') private canvasElement:
    | ElementRef<HTMLCanvasElement>
    | undefined;

  constructor(
    @Inject(DomSanitizer) private sanitizer: DomSanitizer,
    @Inject(ElementRef) private elementRef: ElementRef<HTMLElement>,
    @Inject(ChangeDetectorRef) private changeDetectorRef: ChangeDetectorRef,
    @Inject(NgZone) private ngZone: NgZone,
  ) {}

  @Input() currentTraceEntries: MediaBasedTraceEntry[] = [];
  @Input() titles: string[] = [];
  @Input() forceMinimize = false;
  @Input() enableDoubleClick = false;
  @Input() isFetchingEntries = false;
  @Input() isInPlaybackMode = false;

  private frameSize: Size = {width: 720, height: 1280}; // default for Flicker
  private frameSizeWorker: number | undefined;

  private calls = 0;

  ngOnChanges(changes: SimpleChanges) {
    this.calls++;
    const currCall = this.calls;

    if (changes['isFetchingEntries']) {
      if (changes['isFetchingEntries'].currentValue) {
        this.ngZone.run(() => {
          new Timer(1000).sleepMs().then(() => {
            if (!this.isFetchingEntries || currCall !== this.calls) {
              return;
            }
            this.showFetchingEntriesMessage = true;
            this.changeDetectorRef.detectChanges();
          });
        });
      } else {
        this.showFetchingEntriesMessage = false;
        this.changeDetectorRef.detectChanges();
      }
      if (Object.keys(changes).length === 1) {
        // Do not trigger change detection if isFetchingEntries is the
        // only input to have changed.
        return;
      }
    }

    this.changeDetectorRef.detectChanges();

    if (
      !changes['currentTraceEntries'] ||
      this.currentTraceEntries.length === 0
    ) {
      return;
    }

    if (this.safeUrl === undefined) {
      this.tryUpdateSafeUrl();
    }

    this.tryUpdateRenderedFrame();
  }

  ngAfterViewInit() {
    this.resetFrameSizeWorker();
    this.updateMaxContainerSize();
  }

  ngOnDestroy() {
    this.clearFrameSizeWorker();
  }

  @HostListener('window:resize', ['$event'])
  onResize(event: Event) {
    this.updateMaxContainerSize();
  }

  onMinimizeButtonClick() {
    this.shouldMinimize = !this.shouldMinimize;
  }

  isMinimized() {
    return this.forceMinimize || this.shouldMinimize;
  }

  hasImageToShow() {
    const curr = this.currentTraceEntries.at(this.index);
    return curr !== undefined && curr.image !== undefined;
  }

  getCurrentTime(): number | undefined {
    return this.currentTraceEntries.at(this.index)?.videoTimeSeconds;
  }

  onSelectChange(event: MatSelectChange) {
    this.index = event.value;
    this.tryUpdateSafeUrl();
    this.tryUpdateRenderedFrame();
    this.updateFrameSize();
    event.source.close();
    const screenIndexChangeEvent = new CustomEvent(
      ViewerEvents.OverlayMediaBasedTraceChange,
      {
        detail: this.index,
        bubbles: true,
      },
    );
    this.elementRef.nativeElement.dispatchEvent(screenIndexChangeEvent);
  }

  onOverlayDblClick() {
    if (this.enableDoubleClick && !this.isInPlaybackMode) {
      const event = new CustomEvent(ViewerEvents.OverlayDblClick, {
        detail: this.index,
        bubbles: true,
      });
      this.elementRef.nativeElement.dispatchEvent(event);
    }
  }

  private tryUpdateRenderedFrame() {
    const entry = this.currentTraceEntries.at(this.index);
    if (!entry?.image) {
      return;
    }
    const canvas = assertDefined(this.canvasElement?.nativeElement);
    entry.tryDrawOnCanvas(canvas);
  }

  private resetFrameSizeWorker() {
    if (this.frameSizeWorker === undefined) {
      this.frameSizeWorker = window.setInterval(
        () => this.updateFrameSize(),
        50,
      );
    }
  }

  private updateFrameSize() {
    const video = this.videoElement?.nativeElement;
    if (video && video.readyState > 0) {
      this.frameSize = {
        width: video.videoWidth,
        height: video.videoHeight,
      };
      this.clearFrameSizeWorker();
      this.updateMaxContainerSize();
      return;
    }
    const canvas = this.canvasElement?.nativeElement;
    if (canvas) {
      this.frameSize = {
        width: canvas.width,
        height: canvas.height,
      };
      this.clearFrameSizeWorker();
      this.updateMaxContainerSize();
      return;
    }
  }

  private updateMaxContainerSize() {
    this.ngZone.run(() => {
      const container = assertDefined(
        this.elementRef.nativeElement.querySelector<HTMLElement>('.container'),
      );
      const maxHeight = window.innerHeight - 140;
      const headerHeight =
        this.elementRef.nativeElement.querySelector('.header')?.clientHeight ??
        0;
      const maxWidth = Math.min(
        ((maxHeight - headerHeight) * this.frameSize.width) /
          this.frameSize.height,
        window.innerWidth,
      );
      container.style.maxWidth = `${maxWidth}px`;
      this.changeDetectorRef.detectChanges();
    });
  }

  private clearFrameSizeWorker() {
    window.clearInterval(this.frameSizeWorker);
    this.frameSizeWorker = undefined;
  }

  private tryUpdateSafeUrl() {
    const curr = this.currentTraceEntries.at(this.index);
    if (curr !== undefined && curr.frameData !== undefined) {
      this.safeUrl = this.sanitizer.bypassSecurityTrustUrl(
        URL.createObjectURL(curr.frameData),
      );
      this.changeDetectorRef.detectChanges();
      this.resetFrameSizeWorker();
    }
  }
}
