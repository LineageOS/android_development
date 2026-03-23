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
import {ChangeDetectorRef, Component, computed, effect, ElementRef, HostListener, Inject, input, NgZone, output, viewChild,} from '@angular/core';
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
  styleUrls: ['viewer_media_based_component.scss'],
})
export class ViewerMediaBasedComponent {
  safeUrl: SafeUrl | undefined = undefined;
  showFetchingEntriesMessage = false;
  shouldMinimize = false;
  index = 0;
  keepCanvasAlive = false;

  readonly onOverlayMediaBasedTraceChange = output<number>();
  readonly onOverlayDblClick = output<number>();

  private videoElement =
    viewChild<ElementRef<HTMLVideoElement>>('videoElement');
  private canvasElement = viewChild<ElementRef<HTMLCanvasElement>>(
    'frameCanvasElementOverlay',
  );

  constructor(
    @Inject(DomSanitizer) private sanitizer: DomSanitizer,
    @Inject(ElementRef) readonly elementRef: ElementRef<HTMLElement>,
    @Inject(ChangeDetectorRef) private changeDetectorRef: ChangeDetectorRef,
    @Inject(NgZone) private ngZone: NgZone,
  ) {
    effect(() => {
      this.calls++;
      const currCall = this.calls;
      const isFetchingEntries = this.isFetchingEntries();
      if (isFetchingEntries) {
        new Timer(1000).sleepMs().then(() => {
          if (!this.isFetchingEntries() || currCall !== this.calls) {
            return;
          }
          this.showFetchingEntriesMessage = true;
          this.changeDetectorRef.detectChanges();
        });
      } else {
        this.showFetchingEntriesMessage = false;
        this.changeDetectorRef.detectChanges();
      }
    });

    effect(() => {
      const currentTraceEntries = this.currentTraceEntries();
      if (currentTraceEntries.length === 0) {
        this.keepCanvasAlive = false;
        return;
      }
      if (this.safeUrl === undefined) {
        this.tryUpdateSafeUrl();
      }
      this.tryUpdateRenderedFrame();
    });
  }

  currentTraceEntries = input<MediaBasedTraceEntry[]>([]);
  titles = input<string[]>([]);
  forceMinimize = input<boolean>(false);
  enableDoubleClick = input<boolean>(false);
  isFetchingEntries = input<boolean>(false);
  isInPlaybackMode = input<boolean>(false);

  readonly hasOneOrLessTitles = computed(() => {
    return this.titles().length <= 1;
  });

  private frameSize: Size = {width: 720, height: 1280}; // default for Flicker
  private frameSizeWorker: number | undefined;

  private calls = 0;

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
    return this.forceMinimize() || this.shouldMinimize;
  }

  hasImageToShow(): boolean {
    if (this.keepCanvasAlive) {
      return true;
    }
    const curr = this.currentTraceEntries().at(this.index);
    return curr !== undefined && curr.frame !== undefined;
  }

  hasVideoToShow(): boolean {
    const curr = this.currentTraceEntries().at(this.index);
    return (
      this.safeUrl !== undefined &&
      curr !== undefined &&
      curr.frameData !== undefined
    );
  }

  getCurrentTime(): number | undefined {
    return this.currentTraceEntries().at(this.index)?.videoTimeSeconds;
  }

  onSelectChange(event: MatSelectChange) {
    this.index = event.value;
    this.keepCanvasAlive = false;
    this.tryUpdateSafeUrl();
    this.tryUpdateRenderedFrame();
    this.updateFrameSize();
    event.source.close();
    this.onOverlayMediaBasedTraceChange.emit(this.index);
  }

  onOverlayDoubleClicked() {
    if (this.enableDoubleClick() && !this.isInPlaybackMode()) {
      this.onOverlayDblClick.emit(this.index);
    }
  }

  onVideoSeeked() {
    this.keepCanvasAlive = false;
    this.changeDetectorRef.detectChanges();
  }

  private tryUpdateRenderedFrame() {
    const canvasElement = this.canvasElement();
    if (!canvasElement) {
      return;
    }
    const entry = this.currentTraceEntries().at(this.index);
    if (!entry?.frame) {
      return;
    }
    const canvas = canvasElement.nativeElement;
    entry.frame.tryDrawOnCanvas(canvas);
    this.keepCanvasAlive = true;
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
    const video = this.videoElement()?.nativeElement;
    if (video && video.readyState > 0) {
      this.frameSize = {
        width: video.videoWidth,
        height: video.videoHeight,
      };
      this.clearFrameSizeWorker();
      this.updateMaxContainerSize();
      return;
    }
    const canvas = this.canvasElement()?.nativeElement;
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
    const curr = this.currentTraceEntries().at(this.index);
    if (curr !== undefined && curr.frameData !== undefined) {
      this.safeUrl = this.sanitizer.bypassSecurityTrustUrl(
        URL.createObjectURL(curr.frameData),
      );
      this.changeDetectorRef.detectChanges();
      this.resetFrameSizeWorker();
    }
  }
}
