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
import {ChangeDetectorRef, Component, ElementRef, HostListener, Inject, Input, NgZone, SimpleChanges, ViewChild,} from '@angular/core';
import {MatButtonModule} from '@angular/material/button';
import {MatCardModule} from '@angular/material/card';
import {MatIconModule} from '@angular/material/icon';
import {MatSelectChange, MatSelectModule} from '@angular/material/select';
import {MatTooltipModule} from '@angular/material/tooltip';
import {DomSanitizer, SafeUrl} from '@angular/platform-browser';
import {assertDefined} from '@common/assert';
import {Size} from '@common/geometry/size';
import {Timer} from '@common/time/timer';
import {MediaBasedTraceEntry} from '@trace/media_based/media_based_trace_entry';
import {ViewerEvents} from '@viewers/common/viewer_events';

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
  templateUrl: './viewer_media_based_component.ng.html',
  styleUrls: ['viewer_media_based_component.css'],
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
  onResize(_: Event) {
    this.updateMaxContainerSize();
  }

  onMinimizeButtonClick() {
    this.shouldMinimize = !this.shouldMinimize;
  }

  isMinimized(): boolean {
    return this.forceMinimize || this.shouldMinimize;
  }

  hasImageToShow(): boolean {
    const curr = this.currentTraceEntries.at(this.index);
    return curr !== undefined && curr.frame !== undefined;
  }

  hasOneOrLessTitles(): boolean {
    return this.titles.length <= 1;
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
    if (!entry?.frame) {
      return;
    }
    const canvas = assertDefined(this.canvasElement?.nativeElement);
    entry.frame.tryDrawOnCanvas(canvas);
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
