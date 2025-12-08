/*
 * Copyright (C) 2025 The Android Open Source Project
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

import {Component, ViewChild} from '@angular/core';
import {TestBed} from '@angular/core/testing';
import {NoopAnimationsModule} from '@angular/platform-browser/animations';
import {DOMTestHelper} from 'test/unit/dom_test_helpers';
import {PlaybackControlsComponent} from './playback_component';
import {PlaybackState} from 'viewers/common/playback/playback_state';

describe('PlaybackControlsComponent', () => {
  let hostComponent: TestHostComponent;
  let dom: DOMTestHelper<TestHostComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TestHostComponent, NoopAnimationsModule],
    }).compileComponents();

    const fixture = TestBed.createComponent(TestHostComponent);
    hostComponent = fixture.componentInstance;
    dom = new DOMTestHelper(fixture, fixture.nativeElement);
    dom.detectChanges();
  });

  afterEach(() => {
    const overlayContainers = document.querySelectorAll(
      '.cdk-overlay-container',
    );
    overlayContainers.forEach((container) => {
      container.remove();
    });
  });

  it('should create the component', () => {
    expect(hostComponent.component).toBeTruthy();
  });

  it('should have default speed selected', () => {
    expect(hostComponent.component.selectedScale).toBe(1);
  });

  it('should emit PlaybackState.FORWARDS when play forwards button is clicked', () => {
    hostComponent.currentState = PlaybackState.PAUSED;
    dom.detectChanges();
    dom.findAndClick('#play_playback_button');
    expect(hostComponent.onPlaybackStateChange).toHaveBeenCalledOnceWith(
      PlaybackState.FORWARDS,
    );
  });

  it('should emit PlaybackState.BACKWARDS when play backwards button is clicked', () => {
    hostComponent.currentState = PlaybackState.PAUSED;
    dom.detectChanges();
    dom.findAndClick('#play_reverse_playback_button');
    expect(hostComponent.onPlaybackStateChange).toHaveBeenCalledOnceWith(
      PlaybackState.BACKWARDS,
    );
  });

  it('should emit PlaybackState.PAUSED when pause button is clicked', () => {
    hostComponent.currentState = PlaybackState.FORWARDS;
    dom.detectChanges();

    const pauseButton = dom.get('#pause_playback_button');
    pauseButton.checkDisabled(false);
    pauseButton.click();
    expect(hostComponent.onPlaybackStateChange).toHaveBeenCalledOnceWith(
      PlaybackState.PAUSED,
    );
  });

  it('should disable pause button when currentState is PAUSED', () => {
    hostComponent.currentState = PlaybackState.PAUSED;
    dom.detectChanges();
    const pauseButton = dom.get('#pause_playback_button');
    pauseButton.checkDisabled(true);
  });

  it('should enable pause button when currentState is not PAUSED', () => {
    hostComponent.currentState = PlaybackState.FORWARDS;
    dom.detectChanges();
    const pauseButton = dom.get('#pause_playback_button');
    pauseButton.checkDisabled(false);

    hostComponent.currentState = PlaybackState.BACKWARDS;
    dom.detectChanges();
    pauseButton.checkDisabled(false);
  });

  it('should emit speedChange event when speed selection changes', async () => {
    await dom.clickAndWaitStable(
      '.playback-speed-selector .mat-mdc-select-trigger',
    );

    const selectPanel = dom.getMatSelectPanel();
    const options = selectPanel.findAll('mat-option');
    expect(options.length).toBe(
      hostComponent.component.playbackSpeedSelection.length,
    );

    options[3].click();
    await dom.detectChangesAndWaitStable();

    expect(hostComponent.onSpeedChange).toHaveBeenCalledTimes(1);
    expect(hostComponent.onSpeedChange).toHaveBeenCalledWith(2);
    expect(hostComponent.component.selectedScale).toBe(2);

    dom.get('.mat-mdc-select-value-text').checkText('2');
  });

  @Component({
    selector: 'test-host-component',
    template: `
        <playback-controls
        [currentState]="currentState"
        (playbackStateChange)="onPlaybackStateChange($event)"
        (speedChange)="onSpeedChange($event)">
        </playback-controls>
  `,
    standalone: true,
    imports: [PlaybackControlsComponent],
  })
  class TestHostComponent {
    @ViewChild(PlaybackControlsComponent) component!: PlaybackControlsComponent;

    currentState: PlaybackState = PlaybackState.PAUSED;

    onPlaybackStateChange = jasmine.createSpy('onPlaybackStateChange');
    onSpeedChange = jasmine.createSpy('onSpeedChange');
  }
});
