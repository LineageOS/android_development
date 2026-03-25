/*
 * Copyright (C) 2023 The Android Open Source Project
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
import {ChangeDetectionStrategy} from '@angular/core';
import {discardPeriodicTasks, fakeAsync, TestBed} from '@angular/core/testing';
import {FormsModule, ReactiveFormsModule} from '@angular/forms';
import {MatButtonModule} from '@angular/material/button';
import {MatFormFieldModule} from '@angular/material/form-field';
import {MatIconModule} from '@angular/material/icon';
import {MatInputModule} from '@angular/material/input';
import {MatSelectModule} from '@angular/material/select';
import {MatTooltipModule} from '@angular/material/tooltip';
import {BrowserAnimationsModule, NoopAnimationsModule,} from '@angular/platform-browser/animations';
import {assertDefined} from '@common/assert';
import {DOMTestHelper} from '@common/testing/dom_test_helpers';
import {makeConverterZeroRteOffsets} from '@common/time/testing/test_helpers';
import {TimeRange} from '@common/time/time';
import {TracePosition} from '@trace_api/trace_position';

import {MIN_SLIDER_WIDTH, SliderComponent} from './slider_component';

describe('SliderComponent', () => {
  let component: SliderComponent;
  let dom: DOMTestHelper<SliderComponent>;
  const leftCropperSelector = '.slider .cropper.left';
  const rightCropperSelector = '.slider .cropper.right';
  const converter = makeConverterZeroRteOffsets();
  const time100 = converter.makeTimestampFromRealNs(100n);
  const time125 = converter.makeTimestampFromRealNs(125n);
  const time126 = converter.makeTimestampFromRealNs(126n);
  const time150 = converter.makeTimestampFromRealNs(150n);
  const time175 = converter.makeTimestampFromRealNs(175n);
  const time200 = converter.makeTimestampFromRealNs(200n);

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        NoopAnimationsModule,
        FormsModule,
        MatButtonModule,
        MatFormFieldModule,
        MatInputModule,
        MatIconModule,
        MatSelectModule,
        MatTooltipModule,
        ReactiveFormsModule,
        BrowserAnimationsModule,
        DragDropModule,
        SliderComponent,
      ],
    })
      .overrideComponent(SliderComponent, {
        set: {changeDetection: ChangeDetectionStrategy.Default},
      })
      .compileComponents();
    const fixture = TestBed.createComponent(SliderComponent);
    component = fixture.componentInstance;
    dom = new DOMTestHelper(fixture, fixture.nativeElement);
    dom.setComponentInput('fullRange', new TimeRange(time100, time200));
    dom.setComponentInput('zoomRange', new TimeRange(time125, time175));
    dom.setComponentInput(
      'currentPosition',
      TracePosition.fromTimestamp(time150),
    );
    dom.setComponentInput('timestampConverter', converter);
    dom.detectChanges();
  });

  it('can be created', () => {
    expect(component).toBeTruthy();
  });

  it('reposition properly on zoom', () => {
    const sliderWidth = component.sliderBox().nativeElement.offsetWidth;
    expect(component.sliderWidth).toEqual(sliderWidth / 2);
    expect(component.dragPosition.x).toEqual(sliderWidth / 4);
  });

  it('has min width', () => {
    dom.getHTMLElement().style.width = '1600px';
    dom.setComponentInput('fullRange', new TimeRange(time100, time200));
    dom.setComponentInput('zoomRange', new TimeRange(time125, time126));
    dom.detectChanges();

    const sliderWidth = component.sliderBox().nativeElement.offsetWidth;
    expect(component.sliderWidth).toEqual(MIN_SLIDER_WIDTH);
    expect(component.dragPosition.x).toEqual(
      sliderWidth / 4 - MIN_SLIDER_WIDTH / 2,
    );
  });

  it('repositions slider on resize', () => {
    const slider = dom.get('.slider').getHTMLElement();
    const cursor = dom.get('.cursor').getHTMLElement();
    dom.detectChanges();
    const initialSliderXPos = slider.getBoundingClientRect().left;
    const initialCursorXPos = cursor.getBoundingClientRect().left;

    const box = component.sliderBox();
    spyOnProperty(box.nativeElement, 'offsetWidth', 'get').and.returnValue(100);
    expect(box.nativeElement.offsetWidth).toBe(100);

    slider.style.width = '587px';
    window.dispatchEvent(new Event('resize'));
    dom.detectChanges();
    expect(initialSliderXPos).not.toEqual(slider.getBoundingClientRect().left);
    expect(initialCursorXPos).not.toEqual(cursor.getBoundingClientRect().left);
  });

  it('draws current position cursor', () => {
    const sliderBox = dom.get('#timeline-slider-box').getHTMLElement();
    const cursor = dom.get('.cursor').getHTMLElement();
    const sliderBoxRect = sliderBox.getBoundingClientRect();
    expect(cursor.getBoundingClientRect().left).toBeCloseTo(
      (sliderBoxRect.left + sliderBoxRect.right) / 2,
      0,
    );
  });

  it('moving slider around updates zoom', () => {
    dom.detectChanges();
    const initialZoom = component.zoomRange();

    let lastZoomUpdate: TimeRange | undefined;
    const zoomChangedSpy = spyOn(component.onZoomChanged, 'emit').and.callFake(
      (zoom) => {
        lastZoomUpdate = zoom;
      },
    );

    const slider = dom.get('.slider .handle');
    checkVisible(slider.getHTMLElement());

    slider.dragElement(100, 8);
    expect(zoomChangedSpy).toHaveBeenCalled();
    const finalZoom = assertDefined(lastZoomUpdate);
    expect(finalZoom.from).not.toEqual(initialZoom.from);
    expect(finalZoom.to).not.toEqual(initialZoom.to);
    expect(finalZoom.to.minus(finalZoom.from).getValueNs()).toEqual(
      initialZoom.to.minus(initialZoom.from).getValueNs(),
    );
  });

  it('moving slider left pointer around updates zoom', fakeAsync(() => {
    dom.detectChanges();
    const initialZoom = component.zoomRange();

    let lastZoomUpdate: TimeRange | undefined;
    const zoomChangedSpy = spyOn(component.onZoomChanged, 'emit').and.callFake(
      (zoom) => {
        lastZoomUpdate = zoom;
      },
    );

    const leftCropper = dom.get(leftCropperSelector);
    checkVisible(leftCropper.getHTMLElement());

    leftCropper.dragElement(5, 0);
    expect(zoomChangedSpy).toHaveBeenCalled();

    const finalZoom = assertDefined(lastZoomUpdate);
    expect(finalZoom.from).not.toBe(initialZoom.from);
    expect(finalZoom.to).toBe(initialZoom.to);
    discardPeriodicTasks();
  }));

  it('moving slider right pointer around updates zoom', fakeAsync(async () => {
    dom.detectChanges();
    const initialZoom = component.zoomRange();

    let lastZoomUpdate: TimeRange | undefined;
    const zoomChangedSpy = spyOn(component.onZoomChanged, 'emit').and.callFake(
      (zoom) => {
        lastZoomUpdate = zoom;
      },
    );

    const rightCropper = dom.get(rightCropperSelector);
    checkVisible(rightCropper.getHTMLElement());

    rightCropper.dragElement(5, 0);
    expect(zoomChangedSpy).toHaveBeenCalled();

    const finalZoom = assertDefined(lastZoomUpdate);
    expect(finalZoom.from).toBe(initialZoom.from);
    expect(finalZoom.to).not.toBe(initialZoom.to);
    discardPeriodicTasks();
  }));

  it('cannot slide left cropper past edges', fakeAsync(() => {
    component.zoomRange = component.fullRange;
    dom.detectChanges();
    const initialZoom = component.zoomRange();

    let lastZoomUpdate: TimeRange | undefined;
    const zoomChangedSpy = spyOn(component.onZoomChanged, 'emit').and.callFake(
      (zoom) => {
        lastZoomUpdate = zoom;
      },
    );

    const leftCropper = dom.get(leftCropperSelector);
    checkVisible(leftCropper.getHTMLElement());

    leftCropper.dragElement(-5, 0);
    expect(zoomChangedSpy).toHaveBeenCalled();

    const finalZoom = assertDefined(lastZoomUpdate);
    expect(finalZoom.startNs).toEqual(initialZoom.startNs);
    expect(finalZoom.endNs).toEqual(initialZoom.endNs);
    discardPeriodicTasks();
  }));

  it('cannot slide right cropper past edges', fakeAsync(() => {
    component.zoomRange = component.fullRange;
    dom.detectChanges();
    const initialZoom = component.zoomRange();

    let lastZoomUpdate: TimeRange | undefined;
    const zoomChangedSpy = spyOn(component.onZoomChanged, 'emit').and.callFake(
      (zoom) => {
        lastZoomUpdate = zoom;
      },
    );

    const rightCropper = dom.get(rightCropperSelector);
    checkVisible(rightCropper.getHTMLElement());

    rightCropper.dragElement(5, 0);
    expect(zoomChangedSpy).toHaveBeenCalled();

    const finalZoom = assertDefined(lastZoomUpdate);
    expect(finalZoom.startNs).toEqual(initialZoom.startNs);
    expect(finalZoom.endNs).toEqual(initialZoom.endNs);
    discardPeriodicTasks();
  }));

  it('cannot slide left cropper past right cropper', fakeAsync(() => {
    dom.setComponentInput('zoomRange', new TimeRange(time125, time125));
    dom.detectChanges();
    const initialZoom = component.zoomRange();

    let lastZoomUpdate: TimeRange | undefined;
    const zoomChangedSpy = spyOn(component.onZoomChanged, 'emit').and.callFake(
      (zoom) => {
        lastZoomUpdate = zoom;
      },
    );

    const leftCropper = dom.get(leftCropperSelector);
    checkVisible(leftCropper.getHTMLElement());

    leftCropper.dragElement(100, 0);
    expect(zoomChangedSpy).toHaveBeenCalled();

    const finalZoom = assertDefined(lastZoomUpdate);
    expect(finalZoom.startNs).toEqual(initialZoom.startNs);
    expect(finalZoom.endNs).toEqual(initialZoom.endNs);
    discardPeriodicTasks();
  }));

  it('cannot slide right cropper past left cropper', fakeAsync(() => {
    dom.setComponentInput('zoomRange', new TimeRange(time125, time125));
    dom.detectChanges();
    const initialZoom = component.zoomRange();

    let lastZoomUpdate: TimeRange | undefined;
    const zoomChangedSpy = spyOn(component.onZoomChanged, 'emit').and.callFake(
      (zoom) => {
        lastZoomUpdate = zoom;
      },
    );

    const rightCropper = dom.get(rightCropperSelector);
    checkVisible(rightCropper.getHTMLElement());

    rightCropper.dragElement(-100, 0);
    expect(zoomChangedSpy).toHaveBeenCalled();

    const finalZoom = assertDefined(lastZoomUpdate);
    expect(finalZoom.startNs).toEqual(initialZoom.startNs);
    expect(finalZoom.endNs).toEqual(initialZoom.endNs);
    discardPeriodicTasks();
  }));

  it('cannot move slider past edges', () => {
    dom.setComponentInput('zoomRange', component.fullRange());
    dom.detectChanges();
    const initialZoom = component.zoomRange();

    let lastZoomUpdate: TimeRange | undefined;
    const zoomChangedSpy = spyOn(component.onZoomChanged, 'emit').and.callFake(
      (zoom) => {
        lastZoomUpdate = zoom;
      },
    );

    const slider = dom.get('.slider .handle');
    checkVisible(slider.getHTMLElement());

    slider.dragElement(100, 8);
    expect(zoomChangedSpy).toHaveBeenCalled();

    const finalZoom = assertDefined(lastZoomUpdate);
    expect(finalZoom.startNs).toEqual(initialZoom.startNs);
    expect(finalZoom.endNs).toEqual(initialZoom.endNs);
  });

  function checkVisible(element: HTMLElement) {
    expect(window.getComputedStyle(element).visibility).toBe('visible');
  }
});
