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

import {ClipboardModule} from '@angular/cdk/clipboard';
import {CommonModule} from '@angular/common';
import {ChangeDetectorRef, Component, computed, ElementRef, HostListener, Inject, input, output, signal, viewChild, ViewEncapsulation,} from '@angular/core';
import {AbstractControl, FormControl, FormGroup, ReactiveFormsModule, ValidationErrors, ValidatorFn, Validators,} from '@angular/forms';
import {MatButtonModule} from '@angular/material/button';
import {MatRippleModule} from '@angular/material/core';
import {MatFormFieldModule} from '@angular/material/form-field';
import {MatIconModule} from '@angular/material/icon';
import {MatInputModule} from '@angular/material/input';
import {MatProgressSpinnerModule} from '@angular/material/progress-spinner';
import {MatSelectModule} from '@angular/material/select';
import {MatTooltipModule} from '@angular/material/tooltip';
import {DomSanitizer, SafeUrl} from '@angular/platform-browser';
import {ExpandedTimelineComponent} from '@app/shared/timeline/expanded-timeline/expanded_timeline_component';
import {HoverPositionUpdate, MiniTimelineComponent,} from '@app/shared/timeline/mini-timeline/mini_timeline_component';
import {assertDefined} from '@common/assert';
import {isInputTextField, KeyboardEventKey, KeyboardEventKeyCode,} from '@common/dom';
import {Store} from '@common/store/store';
import {parseBigIntStrippingUnit} from '@common/string_helpers';
import {TimeRange, Timestamp} from '@common/time/time';
import {TIME_UNIT_TO_NANO} from '@common/time/time_units';
import {UserTimestamp} from '@common/time/user_timestamp';
import {getLogger} from '@compat/logging';
import {Analytics} from '@logging/analytics';
import {WinscopeEvent} from '@messaging/winscope_event';
import {EmitEvent, WinscopeEventEmitter,} from '@messaging/winscope_event_emitter';
import {WinscopeEventListener} from '@messaging/winscope_event_listener';
import {PlaybackPrefetchedEntries} from '@trace_api/playback_prefetched_entries';
import {Trace} from '@trace_api/trace';
import {findCorrespondingEntry} from '@trace_api/trace_entry_finder';
import {ActiveTraceChanged, InitializeTraceSearchRequest, ScreenRecordingChange, TraceAddRequest, TracePositionUpdate, TraceRemoveRequest, TraceSearchCompleted, TraceSearchInitialized, TraceSearchRequest,} from '@trace_api/trace_events';
import {TRACE_INFO} from '@trace_api/trace_info';
import {TracePosition} from '@trace_api/trace_position';
import {compareByDisplayOrder, isTraceTypeWithViewer, supportsPlayback, TraceType,} from '@trace_api/trace_type';
import {Traces} from '@trace_api/traces';
import {MediaBasedTraceEntry} from '@trace/media_based/media_based_trace_entry';
import {Thumbnail} from '@trace/media_based/thumbnail';
import {BookmarksChanged, DarkModeToggled} from '@ui/shared/events/misc_events';
import {TabbedViewSwitched} from '@ui/shared/events/tabbed_view_events';
import {PlaybackSpeedChange, PlaybackStateChangeHandled, PlaybackStateChangeRequest,} from '@ui/shared/playback/events';
import {PlaybackState} from '@ui/shared/playback/playback_state';
import {TimelineData} from '@ui/timeline/timeline_data';
import {ExpandedTimelineToggled} from '@ui/timeline/timeline_events';

import {PlaybackControlsComponent} from './playback_component';

/**
 * A component for displaying the timeline view.
 */
@Component({
  selector: 'timeline',
  encapsulation: ViewEncapsulation.None,
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatIconModule,
    ExpandedTimelineComponent,
    MiniTimelineComponent,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatTooltipModule,
    ClipboardModule,
    MatSelectModule,
    MatRippleModule,
    MatProgressSpinnerModule,
    PlaybackControlsComponent,
  ],
  templateUrl: './timeline_component.ng.html',
  styleUrls: ['timeline_component.scss'],
})
export class TimelineComponent
  implements WinscopeEventEmitter, WinscopeEventListener
{
  readonly TOGGLE_BUTTON_CLASS: string = 'button-toggle-expansion';
  readonly MAX_SELECTED_TRACES = 3;
  readonly PlaybackState = PlaybackState;

  timelineData = input.required<TimelineData>();
  allTraces = input.required<Traces>();
  store = input.required<Store>();
  initialTabTraceType = input<TraceType>();

  readonly collapsedTimelineSizeChanged = output<number>();

  private collapsedTimelineRef =
    viewChild<ElementRef<HTMLElement>>('collapsedTimeline');
  miniTimeline = viewChild<MiniTimelineComponent>('miniTimeline');
  private thumbnailVideo =
    viewChild<ElementRef<HTMLCanvasElement>>('thumbnailVideo');
  private frameCanvasElement = viewChild<ElementRef<HTMLCanvasElement>>(
    'frameCanvasElementTimeline',
  );

  readonly selectedTraces = signal<Array<Trace<unknown>>>([]);
  private readonly thumbnail = signal<Thumbnail | undefined>(undefined);
  private readonly currentTabTraceType = signal<TraceType | undefined>(
    undefined,
  );
  private hoverPosition = signal<HoverPositionUpdate | undefined>(undefined);

  readonly getSelectedTracesToShow = computed<Array<Trace<unknown>>>(() => {
    const sortedSelectedTraces = this.selectedTraces()
      .slice()
      .sort((a, b) => compareByDisplayOrder(a.type, b.type));
    return sortedSelectedTraces.length > 8
      ? sortedSelectedTraces.slice(0, 7)
      : sortedSelectedTraces.slice(0, 8);
  });

  readonly thumbnailVideoStyle = computed(() => {
    const thumbnail = this.thumbnail();
    const size = thumbnail?.getBackgroundSize();
    return {
      width: (thumbnail?.getThumbWidth() ?? 0) + 'px',
      height: (thumbnail?.getThumbHeight() ?? 0) + 'px',
      display: thumbnail ? undefined : 'none',
      backgroundImage: thumbnail
        ? `url(${thumbnail.getBackgroundImageUrl()})`
        : undefined,
      backgroundSize: size ? `${size.width}px ${size.height}px` : undefined,
    };
  });

  readonly hasVideoThumbnail = computed(() => this.thumbnail() !== undefined);

  readonly traceSupportsPlayback = computed(() => {
    const currentTabTraceType = this.currentTabTraceType();
    if (currentTabTraceType === undefined) {
      return false;
    }
    return supportsPlayback(currentTabTraceType);
  });

  readonly makeHoverTsValue = computed(() => {
    const ts = this.hoverPosition()?.ts;
    if (ts === undefined) {
      return '';
    }
    const formatted = ts.format();
    const lastPart = ts.format().split(' ').at(-1);
    if (lastPart === 'ns') {
      return formatted;
    }
    return assertDefined(lastPart);
  });

  currentScreenRecordingTrace: Trace<MediaBasedTraceEntry> | undefined;
  videoUrl: SafeUrl | undefined;
  initialZoom: TimeRange | undefined = undefined;
  sortedTraces: Array<Trace<unknown>> = [];
  selectedTracesFormControl = new FormControl<Array<Trace<unknown>>>([]);
  selectedTimeFormControl = new FormControl('undefined');
  selectedNsFormControl = new FormControl(
    'undefined',
    Validators.compose([Validators.required, this.validateNsFormat]),
  );
  timestampForm = new FormGroup({
    selectedTime: this.selectedTimeFormControl,
    selectedNs: this.selectedNsFormControl,
  });
  TRACE_INFO = TRACE_INFO;
  isInputFormFocused = false;
  storeKeyDeselectedTraces = 'miniTimeline.deselectedTraces';
  bookmarks: Timestamp[] = [];
  isDisabled = false;
  playbackState: PlaybackState = PlaybackState.PAUSED;
  disabledMessage: string = 'Timeline disabled due to ongoing search query';

  expanded = false;
  private emitEvent: EmitEvent = () => Promise.resolve();
  expandedTimelineScrollEvent: WheelEvent | undefined;
  expandedTimelineMouseXRatio: number | undefined;
  private seekTracePosition?: TracePosition;
  private isProcessingKeyPress = false;
  private lastPlayState: PlaybackState | undefined;
  frameCanvasEntry: MediaBasedTraceEntry | undefined;

  constructor(
    @Inject(DomSanitizer) private sanitizer: DomSanitizer,
    @Inject(ChangeDetectorRef) private changeDetectorRef: ChangeDetectorRef,
  ) {}

  ngOnInit() {
    const timelineData = this.timelineData();
    this.currentTabTraceType.set(this.initialTabTraceType());
    if (timelineData.hasTimestamps()) {
      this.updateTimeInputValuesToCurrentTimestamp();
    }
    const converter = timelineData.getTimestampConverter();
    const validatorFn: ValidatorFn = (control: AbstractControl) => {
      const valid = converter.validateHumanInput(control.value ?? '');
      return !valid ? {invalidInput: control.value} : null;
    };
    this.selectedTimeFormControl.addValidators(
      assertDefined(Validators.compose([Validators.required, validatorFn])),
    );

    this.updateScreenRecordingVisualization();

    // sorted to be displayed in order corresponding to viewer tabs
    this.sortedTraces =
      this.allTraces()
        .mapTrace((trace) => trace)
        .sort((a, b) => compareByDisplayOrder(a.type, b.type)) ?? [];

    const storedDeselectedTraces = this.getStoredDeselectedTraceTypes();
    const selectedTraces = this.sortedTraces.filter((trace) => {
      return (
        timelineData.hasTrace(trace) &&
        (!storedDeselectedTraces.includes(trace.type) ||
          timelineData.getActiveTrace() === trace ||
          !timelineData.hasMoreThanOneDistinctTimestamp())
      );
    });
    this.selectedTraces.set(selectedTraces);
    this.selectedTracesFormControl = new FormControl<Array<Trace<unknown>>>(
      selectedTraces,
    );

    const initialTraceToCropZoom = selectedTraces.find((trace) => {
      return (
        trace.type !== TraceType.SCREEN_RECORDING &&
        isTraceTypeWithViewer(trace.type) &&
        trace.lengthEntries > 0
      );
    });
    if (initialTraceToCropZoom) {
      this.initialZoom = new TimeRange(
        initialTraceToCropZoom.getEntry(0).getTimestamp(),
        timelineData.getFullTimeRange().to,
      );
    }
  }

  ngAfterViewInit() {
    const height = assertDefined(this.collapsedTimelineRef()).nativeElement
      .offsetHeight;
    this.collapsedTimelineSizeChanged.emit(height);
  }

  setEmitEvent(callback: EmitEvent) {
    this.emitEvent = callback;
  }

  getVideoCurrentTime(): number | undefined {
    const videoCurrTime =
      this.timelineData().searchCorrespondingScreenRecordingTimeSeconds(
        this.getCurrentTracePosition(),
      );
    return videoCurrTime;
  }

  getCurrentTracePosition(): TracePosition {
    if (this.seekTracePosition) {
      return this.seekTracePosition;
    }

    const position = this.timelineData().getCurrentPosition();
    if (position === undefined) {
      throw new Error(
        'A trace position should be available by the time the timeline is loaded',
      );
    }

    return position;
  }

  async onWinscopeEvent(event: WinscopeEvent) {
    switch (event.constructor) {
      case TracePositionUpdate:
        return await this.onTracePositionUpdate(event as TracePositionUpdate);
      case ActiveTraceChanged:
        return await this.onActiveTraceChanged(event as ActiveTraceChanged);
      case DarkModeToggled:
        return await this.onDarkModeToggled();
      case TraceAddRequest:
        return await this.onTraceAddRequest(event as TraceAddRequest);
      case TraceRemoveRequest:
        return await this.onTraceRemoveRequest(event as TraceRemoveRequest);
      case InitializeTraceSearchRequest:
      case TraceSearchRequest:
        return await this.onTraceSearchStart();
      case TraceSearchInitialized:
      case TraceSearchCompleted:
        return await this.onTraceSearchFinish();
      case PlaybackStateChangeHandled:
        return await this.onPlaybackStateChangeHandled(
          event as PlaybackStateChangeHandled,
        );
      case TabbedViewSwitched:
        return await this.onTabbedViewSwitched(event as TabbedViewSwitched);
      case ScreenRecordingChange:
        return await this.updateScreenRecordingVisualization();
      default:
        getLogger('TimelineComponent').trace(
          'Not processing event ' + event.constructor.name,
        );
    }
  }

  async toggleExpand() {
    this.expanded = !this.expanded;
    this.changeDetectorRef.detectChanges();
    this.updateScreenRecordingVisualization();
    this.changeDetectorRef.detectChanges();
    if (this.expanded) {
      Analytics.Navigation.logExpandedTimelineOpened();
    }
    await this.emitEvent(new ExpandedTimelineToggled(this.expanded));
  }

  async updatePosition(position: TracePosition) {
    this.timelineData().setPosition(position);
    await this.updateScreenRecordingVisualization();
    if (this.playbackState !== PlaybackState.PAUSED) {
      this.emitEvent(
        new PlaybackStateChangeRequest(
          assertDefined(this.currentTabTraceType()),
          this.playbackState,
          this.getPlaybackStartingPosition(),
        ),
      );
      return;
    }
    await this.emitEvent(new TracePositionUpdate(position));
  }

  updateSeekTimestamp(timestamp: Timestamp | undefined) {
    if (timestamp) {
      this.seekTracePosition =
        this.timelineData().makePositionFromActiveTrace(timestamp);
    } else {
      this.seekTracePosition = undefined;
    }
    this.updateTimeInputValuesToCurrentTimestamp();
  }

  isOptionDisabled(trace: Trace<unknown>) {
    const timelineData = this.timelineData();
    return (
      !timelineData.hasTrace(trace) || timelineData.getActiveTrace() === trace
    );
  }

  isPrevButtonDisabled() {
    return !this.hasPrevEntry() || this.playbackState !== PlaybackState.PAUSED;
  }

  isNextButtonDisabled() {
    return !this.hasNextEntry() || this.playbackState !== PlaybackState.PAUSED;
  }

  applyNewTraceSelection(clickedTrace: Trace<unknown>) {
    const timelineData = this.timelineData();
    const selectedTraces =
      this.selectedTracesFormControl.value ??
      this.sortedTraces.filter((trace) => {
        return timelineData.hasTrace(trace);
      });
    this.selectedTraces.set(selectedTraces);
    this.updateStoredDeselectedTraceTypes(clickedTrace);
  }

  getTitle(trace: Trace<unknown>): string {
    if (
      trace.type === TraceType.VIEW_CAPTURE ||
      trace.type === TraceType.SEARCH
    ) {
      return TRACE_INFO[trace.type].name + ' ' + trace.getDescriptors()[0];
    }
    return TRACE_INFO[trace.type].name + (trace.isDump() ? ' Dump' : '');
  }

  @HostListener('window:resize', ['$event'])
  onResize(_: Event) {
    if (this.frameCanvasEntry) {
      this.renderFrameInExpandedTimeline(this.frameCanvasEntry);
    }
  }

  @HostListener('document:focusin', ['$event'])
  handleFocusInEvent(event: FocusEvent) {
    if (event.target instanceof HTMLElement && isInputTextField(event.target)) {
      this.isInputFormFocused = true;
    }
  }

  @HostListener('document:focusout', ['$event'])
  handleFocusOutEvent(event: FocusEvent) {
    if (event.target instanceof HTMLElement && isInputTextField(event.target)) {
      this.isInputFormFocused = false;
    }
  }

  @HostListener('document:keydown', ['$event'])
  async handleKeyboardEvent(event: KeyboardEvent) {
    if (
      this.isDisabled ||
      this.isInputFormFocused ||
      !this.timelineData().hasMoreThanOneDistinctTimestamp() ||
      this.isProcessingKeyPress
    ) {
      return;
    }
    if (event.key === KeyboardEventKey.ARROW_LEFT) {
      event.preventDefault();
      this.isProcessingKeyPress = true;
      if (this.playbackState === PlaybackState.PAUSED) {
        await this.moveToPreviousEntry();
      }
      this.isProcessingKeyPress = false;
    } else if (event.key === KeyboardEventKey.ARROW_RIGHT) {
      event.preventDefault();
      this.isProcessingKeyPress = true;
      if (this.playbackState === PlaybackState.PAUSED) {
        await this.moveToNextEntry();
      }
      this.isProcessingKeyPress = false;
    }

    if (!this.traceSupportsPlayback()) {
      return;
    }

    if (
      event.key === KeyboardEventKey.MEDIA_TRACK_PREVIOUS &&
      this.playbackState !== PlaybackState.BACKWARDS
    ) {
      event.preventDefault();
      this.isProcessingKeyPress = true;
      await this.onPlaybackStateChange(PlaybackState.BACKWARDS);
      this.isProcessingKeyPress = false;
      return;
    }

    if (
      event.key === KeyboardEventKey.MEDIA_TRACK_NEXT &&
      this.playbackState !== PlaybackState.FORWARDS
    ) {
      event.preventDefault();
      this.isProcessingKeyPress = true;
      await this.onPlaybackStateChange(PlaybackState.FORWARDS);
      this.isProcessingKeyPress = false;
      return;
    }

    if (event.keyCode === KeyboardEventKeyCode.SPACE) {
      event.preventDefault();
      this.isProcessingKeyPress = true;
      const newState =
        this.playbackState === PlaybackState.PAUSED
          ? (this.lastPlayState ?? PlaybackState.FORWARDS)
          : PlaybackState.PAUSED;
      await this.onPlaybackStateChange(newState);
      this.isProcessingKeyPress = false;
    }
  }

  onPlaybackSpeedChange(selectedScale: number) {
    this.emitEvent(
      new PlaybackSpeedChange(
        assertDefined(this.currentTabTraceType()),
        selectedScale,
      ),
    );
  }

  hasPrevEntry(): boolean {
    const timelineData = this.timelineData();
    const activeTrace = timelineData.getActiveTrace();
    if (!activeTrace) {
      return false;
    }
    return timelineData.getPreviousEntryFor(activeTrace) !== undefined;
  }

  hasNextEntry(): boolean {
    const timelineData = this.timelineData();
    const activeTrace = timelineData.getActiveTrace();
    if (!activeTrace) {
      return false;
    }
    return timelineData.getNextEntryFor(activeTrace) !== undefined;
  }

  async moveToPreviousEntry() {
    const timelineData = this.timelineData();
    const activeTrace = timelineData.getActiveTrace();
    if (!activeTrace) {
      return;
    }
    timelineData.moveToPreviousEntryFor(activeTrace);
    const position = assertDefined(timelineData.getCurrentPosition());
    await this.emitEvent(new TracePositionUpdate(position));
  }

  async moveToNextEntry() {
    const timelineData = this.timelineData();
    const activeTrace = timelineData.getActiveTrace();
    if (!activeTrace) {
      return;
    }
    timelineData.moveToNextEntryFor(activeTrace);
    const position = assertDefined(timelineData.getCurrentPosition());
    await this.emitEvent(new TracePositionUpdate(position));
  }

  async onHumanTimeInputChange(event: Event) {
    if (event.type !== 'change' || !this.selectedTimeFormControl.valid) {
      return;
    }
    const target = event.target as HTMLInputElement;
    let input = new UserTimestamp(target.value);
    // if hh:mm:ss.zz format, append date of current timestamp
    if (input.isRealTimeOnlyFormat()) {
      const date = assertDefined(
        new UserTimestamp(
          this.getCurrentTracePosition().timestamp.format(),
        ).extractDate(),
      );
      input = new UserTimestamp(date + 'T' + input.timestampHuman);
    }
    const timelineData = this.timelineData();
    const timestamp = timelineData
      .getTimestampConverter()
      .makeTimestampFromHuman(input);

    Analytics.Navigation.logTimeInput('human');
    await this.updatePosition(
      timelineData.makePositionFromActiveTrace(timestamp),
    );
    this.updateTimeInputValuesToCurrentTimestamp();
  }

  async onNanosecondsInputTimeChange(event: Event) {
    if (event.type !== 'change' || !this.selectedNsFormControl.valid) {
      return;
    }
    const target = event.target as HTMLInputElement;
    const timelineData = this.timelineData();

    const valueNs = parseBigIntStrippingUnit(target.value);
    const isBoottime = valueNs < TIME_UNIT_TO_NANO.d * 365n * 3n; // ~ 3 years, no Android smartphone had winscope traces back in 1973 yet.

    const timestamp = isBoottime
      ? timelineData
          .getTimestampConverter()
          .makeTimestampFromBootTimeNs(valueNs)
      : timelineData.getTimestampConverter().makeTimestampFromNs(valueNs);

    Analytics.Navigation.logTimeInput('ns');
    await this.updatePosition(
      timelineData.makePositionFromActiveTrace(timestamp),
    );
    this.updateTimeInputValuesToCurrentTimestamp();
  }

  onKeydownEnterTimeInputField(event: KeyboardEvent) {
    if (this.selectedTimeFormControl.valid) {
      (event.target as HTMLInputElement).blur();
    }
  }

  onKeydownEnterNanosecondsTimeInputField(event: KeyboardEvent) {
    if (this.selectedNsFormControl.valid) {
      (event.target as HTMLInputElement).blur();
    }
  }

  updateScrollEvent(event: WheelEvent) {
    this.expandedTimelineScrollEvent = event;
    this.changeDetectorRef.detectChanges();
  }

  updateExpandedTimelineMouseXRatio(mouseXRatio: number | undefined) {
    this.expandedTimelineMouseXRatio = mouseXRatio;
  }

  getCopyPositionTooltip(position: string): string {
    return `Copy current position:\n${position}`;
  }

  getHumanTimeTooltip(): string {
    const [date, time] = this.getCurrentTracePosition()
      .timestamp.format()
      .split(', ');
    return `
      Date: ${date}
      Time: ${time}\xa0\xa0${this.getUTCOffset()}

      Edit field to update position by inputting time as
      "hh:mm:ss.zz", "YYYY-MM-DDThh:mm:ss.zz", or "YYYY-MM-DD, hh:mm:ss.zz"
    `;
  }

  getCopyHumanTimeTooltip(): string {
    return this.getCopyPositionTooltip(this.getHumanTime());
  }

  getHumanTime(): string {
    return this.getCurrentTracePosition().timestamp.format();
  }

  onTimeCopied(type: 'ns' | 'human') {
    Analytics.Navigation.logTimeCopied(type);
  }

  getUTCOffset(): string {
    return this.timelineData().getTimestampConverter().getUTCOffset();
  }

  currentPositionBookmarked(): boolean {
    const currentTimestampNs =
      this.getCurrentTracePosition().timestamp.getValueNs();
    return this.bookmarks.some((bm) => bm.getValueNs() === currentTimestampNs);
  }

  toggleBookmarkCurrentPosition(event: PointerEvent) {
    const currentTimestamp = this.getCurrentTracePosition().timestamp;
    this.toggleBookmarkRange(new TimeRange(currentTimestamp, currentTimestamp));
    event.stopPropagation();
  }

  toggleBookmarkRange(range: TimeRange, rangeContainsBookmark?: boolean) {
    if (rangeContainsBookmark === undefined) {
      rangeContainsBookmark = this.bookmarks.some((bookmark) =>
        range.containsTimestamp(bookmark),
      );
    }
    const clickedNs = (range.startNs + range.endNs) / 2n;
    if (rangeContainsBookmark) {
      const closestBookmark = this.bookmarks.reduce((prev, curr) => {
        if (clickedNs - curr.getValueNs() < 0) return prev;
        return Math.abs(Number(curr.getValueNs() - clickedNs)) <
          Math.abs(Number(prev.getValueNs() - clickedNs))
          ? curr
          : prev;
      });
      this.bookmarks = this.bookmarks.filter(
        (bm) => bm.getValueNs() !== closestBookmark.getValueNs(),
      );
    } else {
      this.bookmarks = this.bookmarks.concat([
        this.timelineData()
          .getTimestampConverter()
          .makeTimestampFromNs(clickedNs),
      ]);
    }
    this.emitEvent(new BookmarksChanged(this.bookmarks));
    Analytics.Navigation.logTimeBookmark();
  }

  removeAllBookmarks() {
    this.bookmarks = [];
    this.emitEvent(new BookmarksChanged(this.bookmarks));
  }

  async onMiniTimelineTraceClicked(eventData: [Trace<unknown>, Timestamp]) {
    const [trace, timestamp] = eventData;
    await this.emitEvent(new ActiveTraceChanged(trace));
    await this.updatePosition(
      this.timelineData().makePositionFromActiveTrace(timestamp),
    );
    this.changeDetectorRef.detectChanges();
  }

  async onExpandedTimelineTraceClicked(trace: Trace<unknown>) {
    await this.emitEvent(new ActiveTraceChanged(trace));
    this.changeDetectorRef.detectChanges();
  }

  getTraceTooltip(trace: Trace<unknown>): string {
    let tooltip = TRACE_INFO[trace.type].name;
    if (trace.type === TraceType.SCREEN_RECORDING) {
      tooltip += ' ' + trace.getDescriptors()[0].split('.')[0];
    }
    if (trace.type === TraceType.VIEW_CAPTURE) {
      tooltip += ' ' + trace.getDescriptors()[0];
    }
    if (trace.type === TraceType.SEARCH) {
      tooltip += ' ' + trace.getDescriptors()[0];
    }
    return tooltip;
  }

  hoverPositionUpdate(update: HoverPositionUpdate | undefined) {
    this.hoverPosition.set(update);
    this.expandedTimelineScrollEvent = undefined;
    this.changeDetectorRef.detectChanges();
    if (update?.ts !== undefined) {
      this.drawThumbnail(update.ts);
    }
  }

  getHoverPreviewStyle(
    navbarWrapper: HTMLElement,
    hoverPreview: HTMLElement,
  ): object {
    const hoverPosition = this.hoverPosition();
    const hasHover = hoverPosition !== undefined;
    return {
      bottom: navbarWrapper.clientHeight + 4 + 'px',
      left: hasHover
        ? `min(${hoverPosition?.posX}px, calc(100vw - ${hoverPreview.clientWidth + 4}px))`
        : '100px',
      display: hasHover ? undefined : 'none',
    };
  }

  private updateSelectedTraces(trace: Trace<unknown> | undefined) {
    if (!trace) {
      return;
    }

    const selectedTraces = this.selectedTraces();
    if (!selectedTraces.includes(trace)) {
      // Create new object to make sure we trigger an update on Mini Timeline child component
      this.selectedTraces.set([...selectedTraces, trace]);
      this.selectedTracesFormControl.setValue(selectedTraces);
    }
  }

  async onPlaybackStateChange(state: PlaybackState) {
    const currentTabTraceType = this.currentTabTraceType();
    if (currentTabTraceType === undefined) {
      return;
    }
    switch (state) {
      case PlaybackState.FORWARDS:
      case PlaybackState.BACKWARDS:
        this.disabledMessage = 'UI disabled due to playback initialization';
        this.setIsDisabled(true);
        this.emitEvent(
          new PlaybackStateChangeRequest(
            currentTabTraceType,
            state,
            this.getPlaybackStartingPosition(),
          ),
        );
        return;

      case PlaybackState.PAUSED:
        this.emitEvent(
          new PlaybackStateChangeRequest(currentTabTraceType, state),
        );
        return;

      default:
        return;
    }
  }

  private getPlaybackStartingPosition(): number | undefined {
    const currentTabTraceType = this.currentTabTraceType();
    if (currentTabTraceType === undefined) {
      return undefined;
    }

    const timelineData = this.timelineData();

    const currentTrace = timelineData.getTraces().getTrace(currentTabTraceType);

    if (!currentTrace) {
      return undefined;
    }

    return timelineData.findCurrentEntryFor(currentTrace)?.getIndex() ?? 0;
  }

  private updateTimeInputValuesToCurrentTimestamp() {
    const currentTimestampNs =
      this.getCurrentTracePosition().timestamp.getValueNs();
    const timelineData = this.timelineData();

    const converter = timelineData.getTimestampConverter();

    const timestamp = converter.makeTimestampFromNs(currentTimestampNs);
    const formattedCurrentTimestamp = timestamp.format(
      converter.canMakeRealTimestamps(),
    );

    this.selectedTimeFormControl.setValue(formattedCurrentTimestamp);
    this.selectedNsFormControl.setValue(`${currentTimestampNs} ns`);
  }

  private getStoredDeselectedTraceTypes(): TraceType[] {
    const storedDeselectedTraces = this.store().get(
      this.storeKeyDeselectedTraces,
    );
    return JSON.parse(storedDeselectedTraces ?? '[]');
  }

  private updateStoredDeselectedTraceTypes(clickedTrace: Trace<unknown>) {
    const store = this.store();

    const selectedTraces = this.selectedTraces();
    let storedDeselected = this.getStoredDeselectedTraceTypes();
    if (
      selectedTraces.includes(clickedTrace) &&
      storedDeselected.includes(clickedTrace.type)
    ) {
      storedDeselected = storedDeselected.filter(
        (stored) => stored !== clickedTrace.type,
      );
    } else if (
      !selectedTraces.includes(clickedTrace) &&
      !storedDeselected.includes(clickedTrace.type)
    ) {
      Analytics.Navigation.logTraceTimelineDeselected(
        TRACE_INFO[clickedTrace.type].name,
      );
      storedDeselected.push(clickedTrace.type);
    }

    store.add(this.storeKeyDeselectedTraces, JSON.stringify(storedDeselected));
  }

  private validateNsFormat(control: FormControl): ValidationErrors | null {
    const valid = new UserTimestamp(control.value ?? '').isNsFormat();
    return !valid ? {invalidInput: control.value} : null;
  }

  private setIsDisabled(value: boolean) {
    this.isDisabled = value;
    this.changeDetectorRef.detectChanges();
  }

  private setPlaybackState(stateToReflect: PlaybackState) {
    if (this.playbackState !== PlaybackState.PAUSED) {
      this.lastPlayState = this.playbackState;
    }
    this.playbackState = stateToReflect;
  }

  private async updateScreenRecordingVisualization(
    prefetched?: PlaybackPrefetchedEntries,
  ) {
    if (prefetched?.screenRecording) {
      this.videoUrl = undefined;
      this.frameCanvasEntry = await prefetched.screenRecording.getValue();
      this.changeDetectorRef.detectChanges();
      this.renderFrameInExpandedTimeline(this.frameCanvasEntry);
      return;
    }

    this.frameCanvasEntry = undefined;

    const lastTrace = this.currentScreenRecordingTrace;
    this.currentScreenRecordingTrace =
      this.timelineData().getCurrentScreenRecordingTrace();
    if (!this.currentScreenRecordingTrace) {
      return;
    }

    const srChanged = this.currentScreenRecordingTrace !== lastTrace;
    const thumbnail = this.thumbnail();

    if (srChanged || !this.videoUrl || !thumbnail) {
      const video = await this.currentScreenRecordingTrace
        .getEntry(0)
        .getValue();
      if (video.frameData !== undefined) {
        this.videoUrl = this.sanitizer.bypassSecurityTrustUrl(
          URL.createObjectURL(video.frameData),
        );
        this.thumbnail.set(video.thumbnail);
        this.changeDetectorRef.detectChanges();
      } else if (thumbnail === undefined && video.thumbnail) {
        this.thumbnail.set(video.thumbnail);
        this.changeDetectorRef.detectChanges();
      }
      return;
    }
  }

  private async onTracePositionUpdate(event: TracePositionUpdate) {
    if (event.prefetchedEntries?.seek !== undefined) {
      this.seekTracePosition = TracePosition.fromTimestamp(
        event.prefetchedEntries.seek,
      );
    } else {
      this.seekTracePosition = undefined;
    }
    this.updateTimeInputValuesToCurrentTimestamp();
    await this.updateScreenRecordingVisualization(event.prefetchedEntries);
  }

  private async onActiveTraceChanged(event: ActiveTraceChanged) {
    await this.miniTimeline()?.drawer?.draw();
    this.updateSelectedTraces(event.trace);
  }

  private async onDarkModeToggled() {
    const activeTrace = this.timelineData().getActiveTrace();
    if (activeTrace === undefined) {
      return;
    }
    await this.miniTimeline()?.drawer?.draw();
  }

  private async onTraceAddRequest(event: TraceAddRequest) {
    this.sortedTraces.unshift(event.trace);
    this.sortedTraces.sort((a, b) => compareByDisplayOrder(a.type, b.type));
    const newSelection = [event.trace].concat(
      this.selectedTracesFormControl.value ?? [],
    );
    this.selectedTracesFormControl.setValue(newSelection);
    this.applyNewTraceSelection(event.trace);
  }

  private async onTraceRemoveRequest(event: TraceRemoveRequest) {
    this.sortedTraces = this.sortedTraces.filter(
      (trace) => trace !== event.trace,
    );
    this.selectedTracesFormControl.setValue(
      this.selectedTracesFormControl.value?.filter(
        (trace) => trace !== event.trace,
      ) ?? [],
    );
    this.applyNewTraceSelection(event.trace);
  }

  private async onTraceSearchStart() {
    this.setIsDisabled(true);
  }

  private async onTraceSearchFinish() {
    this.setIsDisabled(false);
  }

  private async onPlaybackStateChangeHandled(
    event: PlaybackStateChangeHandled,
  ) {
    this.setPlaybackState(event.stateToReflect);
    this.setIsDisabled(false);
    this.disabledMessage = 'Timeline disabled due to ongoing search query';
  }

  private async onTabbedViewSwitched(event: TabbedViewSwitched) {
    await this.onPlaybackStateChange(PlaybackState.PAUSED);
    this.currentTabTraceType.set(event.newFocusedView.getTraces()[0]?.type);
    this.changeDetectorRef.detectChanges();
  }

  private renderFrameInExpandedTimeline(entry: MediaBasedTraceEntry) {
    const frameCanvasElement = this.frameCanvasElement();
    if (!frameCanvasElement || !entry.frame) {
      return;
    }
    this.renderFrame(entry, frameCanvasElement.nativeElement);
  }

  private async drawThumbnail(ts: Timestamp) {
    this.drawScreenRecordingThumbnail(ts);
  }

  private async drawScreenRecordingThumbnail(ts: Timestamp) {
    const thumbnailVideo = this.thumbnailVideo()?.nativeElement;
    const trace = this.timelineData().getCurrentScreenRecordingTrace();
    const thumbnail = this.thumbnail();
    if (!trace || !thumbnailVideo || !thumbnail) {
      return;
    }
    const entry = findCorrespondingEntry(
      trace,
      TracePosition.fromTimestamp(ts),
    );
    if (!entry) {
      return;
    }
    const position = thumbnail.getBackgroundPosition(
      entry.getIndex() / trace.lengthEntries,
    );
    thumbnailVideo.style.backgroundPosition = `${position.x}px ${position.y}px`;
  }

  private renderFrame(entry: MediaBasedTraceEntry, canvas: HTMLCanvasElement) {
    if (!entry.frame) {
      return;
    }
    const container = assertDefined(canvas.parentElement);
    const scaledWidth = entry.frame.size.width / entry.frame.size.height;
    if (scaledWidth > 1) {
      container.style.maxWidth = `min(200px, (calc(${scaledWidth} * 20vh))`;
    } else {
      container.style.maxWidth = `min(150px, (calc(${scaledWidth} * 20vw))`;
    }
    entry.frame.tryDrawOnCanvas(canvas);
  }
}
