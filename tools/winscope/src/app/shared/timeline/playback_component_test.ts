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

import {TestBed} from '@angular/core/testing';
import {NoopAnimationsModule} from '@angular/platform-browser/animations';
import {DOMTestHelper} from '@common/testing/dom_test_helpers';
import {PlaybackState} from '@ui/shared/playback/playback_state';

import {PlaybackControlsComponent} from './playback_component';

describe('PlaybackControlsComponent', () => {
  let component: PlaybackControlsComponent;
  let dom: DOMTestHelper<PlaybackControlsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PlaybackControlsComponent, NoopAnimationsModule],
    }).compileComponents();

    const fixture = TestBed.createComponent(PlaybackControlsComponent);
    component = fixture.componentInstance;
    dom = new DOMTestHelper(fixture, fixture.nativeElement);
    dom.setComponentInput('currentState', PlaybackState.PAUSED);
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
    expect(component).toBeTruthy();
  });

  it('should have default speed selected', () => {
    expect(component.selectedScale).toBe(1);
  });

  it('should emit PlaybackState.FORWARDS when play forwards button is clicked', () => {
    expect(component.currentState()).toEqual(PlaybackState.PAUSED);
    const spy = spyOn(component.playbackStateChange, 'emit');
    dom.findAndClick('#start-playback-button');
    expect(spy).toHaveBeenCalledOnceWith(PlaybackState.FORWARDS);
  });

  it('should emit PlaybackState.BACKWARDS when play backwards button is clicked', () => {
    const spy = spyOn(component.playbackStateChange, 'emit');
    dom.findAndClick('#start-reverse-playback-button');
    expect(spy).toHaveBeenCalledOnceWith(PlaybackState.BACKWARDS);
  });

  it('should emit PlaybackState.PAUSED when pause button is clicked', () => {
    dom.setComponentInput('currentState', PlaybackState.FORWARDS);
    dom.detectChanges();
    const spy = spyOn(component.playbackStateChange, 'emit');

    const pauseButton = dom.get('#pause-playback-button');
    pauseButton.checkDisabled(false);

    pauseButton.click();
    expect(spy).toHaveBeenCalledOnceWith(PlaybackState.PAUSED);
  });

  it('should disable pause button when currentState is PAUSED', () => {
    const pauseButton = dom.get('#pause-playback-button');
    pauseButton.checkDisabled(true);
  });

  it('should enable pause button when currentState is not PAUSED', () => {
    dom.setComponentInput('currentState', PlaybackState.FORWARDS);
    dom.detectChanges();
    const pauseButton = dom.get('#pause-playback-button');
    pauseButton.checkDisabled(false);

    dom.setComponentInput('currentState', PlaybackState.BACKWARDS);
    dom.detectChanges();
    pauseButton.checkDisabled(false);
  });

  it('should emit speedChange event when speed selection changes', async () => {
    const spy = spyOn(component.speedChange, 'emit');
    await dom.clickAndWaitStable(
      '.playback-speed-selector .mat-mdc-select-trigger',
    );

    const selectPanel = dom.getMatSelectPanel();
    const options = selectPanel.findAll('mat-option');
    expect(options.length).toBe(component.playbackSpeedSelection.length);

    options[3].click();
    await dom.detectChangesAndWaitStable();

    expect(spy).toHaveBeenCalledOnceWith(2);
    expect(component.selectedScale).toBe(2);

    dom.get('.mat-mdc-select-value-text').checkText('2');
  });
});
