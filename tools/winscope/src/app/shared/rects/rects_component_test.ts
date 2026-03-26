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
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {MatButtonModule} from '@angular/material/button';
import {MatButtonToggleModule} from '@angular/material/button-toggle';
import {MatDividerModule} from '@angular/material/divider';
import {MatFormFieldModule} from '@angular/material/form-field';
import {MatIconModule} from '@angular/material/icon';
import {MatIconTestingModule} from '@angular/material/icon/testing';
import {MatSelectModule} from '@angular/material/select';
import {MatSliderModule} from '@angular/material/slider';
import {MatTooltipModule} from '@angular/material/tooltip';
import {BrowserAnimationsModule} from '@angular/platform-browser/animations';
import {CollapsibleSectionTitleComponent} from '@app/shared/collapsible_sections/collapsible_section_title_component';
import {UserOptionsComponent} from '@app/shared/user_options/user_options_component';
import {assertDefined} from '@common/assert';
import {Box3D} from '@common/geometry/box3d';
import {TransformMatrix} from '@common/geometry/transform_matrix';
import {waitToBeCalled} from '@common/spy_utils';
import {InMemoryStorage} from '@common/store/in_memory_storage';
import {Store} from '@common/store/store';
import {checkTooltips, DOMTestHelper} from '@common/testing/dom_test_helpers';
import {TraceType} from '@trace_api/trace_type';
import {Camera} from '@ui/shared/rects/camera';
import {Canvas} from '@ui/shared/rects/canvas';
import {ColorType} from '@ui/shared/rects/color_type';
import {DisplayIdentifier} from '@ui/shared/rects/display_identifier';
import {RectLabel} from '@ui/shared/rects/rect_label';
import {RectLegendOption, TraceRectType} from '@ui/shared/rects/rect_spec';
import {ShadingMode} from '@ui/shared/rects/shading_mode';
import {UiRect} from '@ui/shared/rects/ui_rect';
import {UiRectBuilder} from '@ui/shared/rects/ui_rect_builder';
import {UiRect3D} from '@ui/shared/rects/ui_rect3d';

import {RectsComponent} from './rects_component';

describe('RectsComponent', () => {
  const rectGroup0 = makeRectWithGroupId(0);
  const rectGroup1 = makeRectWithGroupId(1);
  const rectGroup2 = makeRectWithGroupId(2);
  const displayGroup0 = {
    displayId: 0,
    groupId: 0,
    name: 'Display 0',
    isActive: false,
  };
  const displayGroup1 = {
    displayId: 1,
    groupId: 1,
    name: 'Display 1',
    isActive: false,
  };
  const displayGroup2 = {
    displayId: 2,
    groupId: 2,
    name: 'Display 2',
    isActive: false,
  };
  const zoomInSelector = '.zoom-in-button';
  const largeRectsCanvasSelector = '.large-rects-canvas';
  const testTitle = 'TestRectsView';

  let fixture: ComponentFixture<RectsComponent>;
  let component: RectsComponent;
  let dom: DOMTestHelper<RectsComponent>;
  let updateViewPositionSpy: jasmine.Spy<(camera: Camera, box: Box3D) => void>;
  let updateRectsSpy: jasmine.Spy<(rects: UiRect3D[]) => void>;
  let updateLabelsSpy: jasmine.Spy<(labels: RectLabel[]) => void>;
  let renderViewSpy: jasmine.Spy<() => void>;
  let sharedStore: Store;

  beforeEach(async () => {
    updateViewPositionSpy = spyOn(Canvas.prototype, 'updateViewPosition');
    updateRectsSpy = spyOn(Canvas.prototype, 'updateRects');
    updateLabelsSpy = spyOn(Canvas.prototype, 'updateLabels');
    renderViewSpy = spyOn(Canvas.prototype, 'renderView');

    await TestBed.configureTestingModule({
      imports: [
        CommonModule,
        MatDividerModule,
        MatSliderModule,
        MatButtonModule,
        MatTooltipModule,
        MatIconModule,
        MatIconTestingModule,
        MatSelectModule,
        BrowserAnimationsModule,
        MatFormFieldModule,
        MatButtonToggleModule,
        RectsComponent,
        CollapsibleSectionTitleComponent,
        UserOptionsComponent,
      ],
    }).compileComponents();

    sharedStore = new InMemoryStorage();
    resetDom();
    dom.setComponentInput('miniRects', []);
  });

  function resetDom(rects: UiRect[] = [], displays: DisplayIdentifier[] = []) {
    fixture = TestBed.createComponent(RectsComponent);
    component = fixture.componentInstance;
    dom = new DOMTestHelper(fixture, fixture.nativeElement);

    dom.setComponentInput('title', testTitle);
    dom.setComponentInput('store', sharedStore);
    dom.setComponentInput('shadingModes', [
      ShadingMode.GRADIENT,
      ShadingMode.WIRE_FRAME,
      ShadingMode.OPACITY,
    ]);
    dom.setComponentInput('userOptions', {
      showOnlyVisible: {
        name: 'Show only',
        enabled: false,
      },
    });
    dom.setComponentInput('dependencies', [TraceType.SURFACE_FLINGER]);
    dom.setComponentInput('displays', displays);
    dom.setComponentInput('rects', rects);
  }

  it('can be created', () => {
    dom.detectChanges();
    expect(component).toBeTruthy();
  });

  it('renders rotation slider', () => {
    dom.detectChanges();
    expect(dom.find('mat-slider.slider-rotation')).toBeDefined();
  });

  it('renders separation slider', () => {
    dom.detectChanges();
    expect(dom.find('mat-slider.slider-spacing')).toBeDefined();
  });

  it('renders canvas', () => {
    dom.detectChanges();
    expect(dom.find(largeRectsCanvasSelector)).toBeDefined();
  });

  it('draws scene when input data changes', async () => {
    dom.detectChanges();
    const boundingBox = updateViewPositionSpy.calls.mostRecent().args[1];
    resetSpies();

    checkAllSpiesCalled(0);
    setRectAndDisplayGroup0();
    checkAllSpiesCalled(2); // once for rect/display update, once for store update
    const newBoundingBox = updateViewPositionSpy.calls.mostRecent().args[1];
    expect(newBoundingBox).not.toEqual(boundingBox);

    dom.setComponentInput('rects', [rectGroup0]);
    dom.detectChanges();
    checkAllSpiesCalled(3);
    expect(updateViewPositionSpy.calls.mostRecent().args[1]).toEqual(
      newBoundingBox,
    );
  });

  it('draws scene when rotation slider changes', () => {
    dom.detectChanges();
    resetSpies();
    const sliderInput = dom.get('.slider-rotation input');
    sliderInput.updateValue('0.5');

    checkAllSpiesCalled(0);
    sliderInput.dispatchEvent(new Event('input'));
    expect(updateViewPositionSpy).toHaveBeenCalledTimes(1);
    expect(updateRectsSpy).toHaveBeenCalledTimes(0);
    expect(updateLabelsSpy).toHaveBeenCalledTimes(1);
    expect(renderViewSpy).toHaveBeenCalledTimes(1);
  });

  it('draws scene when spacing slider changes', () => {
    dom.detectChanges();
    resetSpies();
    const sliderInput = dom.get('.slider-spacing input');
    sliderInput.updateValue('0.5');

    checkAllSpiesCalled(0);
    sliderInput.dispatchEvent(new Event('input'));
    checkAllSpiesCalled(1);
  });

  it('unfocuses spacing slider on click', () => {
    dom.detectChanges();
    const spacingSlider = dom.get('.slider-spacing');
    checkSliderUnfocusesOnClick(spacingSlider, 1);
  });

  it('unfocuses rotation slider on click', () => {
    dom.detectChanges();
    const rotationSlider = dom.get('.slider-rotation');
    checkSliderUnfocusesOnClick(rotationSlider, 1);
  });

  it('renders display selector', async () => {
    dom.setComponentInput('rects', [rectGroup0]);
    dom.setComponentInput('displays', [
      displayGroup0,
      displayGroup1,
      displayGroup2,
    ]);
    await checkSelectedDisplay([0], [0]);
  });

  it('disables display selector if multiple options not present', async () => {
    setRectAndDisplayGroup0();
    await dom.openMatSelect();
    expect(dom.isMatSelectOpen()).toBeFalse();
  });

  it('handles display change by checkbox', async () => {
    dom.setComponentInput('rects', [rectGroup0, rectGroup1]);
    dom.setComponentInput('displays', [
      displayGroup0,
      displayGroup1,
      displayGroup2,
    ]);
    await checkSelectedDisplay([0], [0]);
    const boundingBox = updateViewPositionSpy.calls.mostRecent().args[1];

    dom.openMatSelect();
    const options = getDisplayOptions();
    options[1].click();
    await checkSelectedDisplay([0, 1], [0, 1], true);
    expect(updateViewPositionSpy.calls.mostRecent().args[1]).not.toEqual(
      boundingBox,
    );

    options[0].click();
    await checkSelectedDisplay([1], [1], true);

    options[1].click();
    await checkSelectedDisplay([], [], true);
    const placeholder = dom.get('.placeholder-text');
    placeholder.checkTextExact('No displays selected.');
  });

  it('handles display change by "only" button', async () => {
    dom.setComponentInput('rects', [rectGroup0, rectGroup1]);
    dom.setComponentInput('displays', [
      displayGroup0,
      displayGroup1,
      displayGroup2,
    ]);
    await checkSelectedDisplay([0], [0]);

    dom.openMatSelect();
    const [display0, display1] = dom
      .getMatSelectPanel()
      .findAll('mat-option .option-only-button');

    // no change
    display0.click();
    await checkSelectedDisplay([0], [0]);

    display1.click();
    await checkSelectedDisplay([1], [1]);

    assertDefined(display0.getHTMLElement().parentElement).click();
    await checkSelectedDisplay([0, 1], [0, 1], true);
    display0.click();
    await checkSelectedDisplay([0], [0], true);
  });

  it('tracks selected display', async () => {
    dom.setComponentInput('displays', [
      {displayId: 10, groupId: 0, name: 'Display 0', isActive: false},
      {displayId: 20, groupId: 1, name: 'Display 1', isActive: false},
    ]);
    dom.setComponentInput('rects', [rectGroup0, rectGroup1]);
    await checkSelectedDisplay([0], [0]);

    dom.setComponentInput('displays', [
      {displayId: 20, groupId: 2, name: 'Display 1', isActive: false},
      {displayId: 10, groupId: 1, name: 'Display 0', isActive: false},
    ]);
    await checkSelectedDisplay([0], [1], false);
  });

  it('updates scene on separation slider change', () => {
    dom.setComponentInput('rects', [rectGroup0, rectGroup0]);
    dom.setComponentInput('displays', [displayGroup0]);
    dom.detectChanges();
    const boundingBox = updateViewPositionSpy.calls.mostRecent().args[1];
    const rectsBefore = assertDefined(updateRectsSpy.calls.first().args[0]);
    expect(rectsBefore[0].topLeft.z).toBe(200);
    resetSpies();

    updateSeparationSlider();

    checkAllSpiesCalled(1);
    expect(updateViewPositionSpy.calls.mostRecent().args[1]).toEqual(
      boundingBox,
    );
    const rectsAfter = assertDefined(updateRectsSpy.calls.mostRecent().args[0]);
    expect(rectsAfter[0].topLeft.z).toBe(12);
  });

  it('updates scene on rotation slider change', () => {
    setRectAndDisplayGroup0();
    const boundingBox = updateViewPositionSpy.calls.mostRecent().args[1];
    const cameraBefore = assertDefined(
      updateViewPositionSpy.calls.first().args[0],
    );
    resetSpies();

    updateRotationSlider();
    expect(updateViewPositionSpy).toHaveBeenCalledTimes(1);
    expect(updateRectsSpy).toHaveBeenCalledTimes(0);
    expect(updateLabelsSpy).toHaveBeenCalledTimes(1);
    expect(renderViewSpy).toHaveBeenCalledTimes(1);
    expect(updateViewPositionSpy.calls.mostRecent().args[1]).toEqual(
      boundingBox,
    );
    const cameraAfter = assertDefined(
      updateViewPositionSpy.calls.mostRecent().args[0],
    );

    expect(cameraAfter.rotationAngleX).toEqual(
      cameraBefore.rotationAngleX * 0.5,
    );
    expect(cameraAfter.rotationAngleY).toEqual(
      cameraBefore.rotationAngleY * 0.5,
    );
  });

  it('updates scene on shading mode change', () => {
    setRectAndDisplayGroup0();

    const rectsGradient = updateRectsSpy.calls.argsFor(0)[0];
    expect(rectsGradient[0].colorType).toEqual(ColorType.VISIBLE);
    expect(rectsGradient[0].darkFactor).toBe(1);

    resetSpies();

    updateShadingMode(ShadingMode.GRADIENT, ShadingMode.WIRE_FRAME);
    expect(updateRectsSpy).toHaveBeenCalledTimes(1);
    expect(renderViewSpy).toHaveBeenCalledTimes(1);

    const rectsWireFrame = updateRectsSpy.calls.argsFor(0)[0];
    expect(rectsWireFrame[0].colorType).toEqual(ColorType.EMPTY);
    expect(rectsWireFrame[0].darkFactor).toBe(1);

    updateShadingMode(ShadingMode.WIRE_FRAME, ShadingMode.OPACITY);
    expect(updateRectsSpy).toHaveBeenCalledTimes(2);
    expect(renderViewSpy).toHaveBeenCalledTimes(2);

    const rectsOpacity = updateRectsSpy.calls.argsFor(1)[0];
    expect(rectsOpacity[0].colorType).toEqual(ColorType.VISIBLE_WITH_OPACITY);
    expect(rectsOpacity[0].darkFactor).toBe(0.5);

    // cycles back to original
    updateShadingMode(ShadingMode.OPACITY, ShadingMode.GRADIENT);
    expect(updateViewPositionSpy).toHaveBeenCalledTimes(0);
    expect(updateLabelsSpy).toHaveBeenCalledTimes(0);
  });

  it('uses stored rects view settings', async () => {
    await dom.detectChangesAndWaitStable();
    updateSeparationSlider();
    updateShadingMode(ShadingMode.GRADIENT, ShadingMode.WIRE_FRAME);

    resetDom();
    await dom.detectChangesAndWaitStable();
    expect(component.getZSpacingFactor()).toBe(0.06);
    expect(component.getShadingMode()).toEqual(ShadingMode.WIRE_FRAME);
  });

  it('uses stored selected displays if present in new trace', async () => {
    const displayId10 = {
      displayId: 10,
      groupId: 0,
      name: 'Display 0',
      isActive: true,
    };
    const displayId20 = {
      displayId: 20,
      groupId: 1,
      name: 'Display 1',
      isActive: true,
    };

    dom.setComponentInput('rects', [rectGroup0, rectGroup1]);
    dom.setComponentInput('displays', [displayId10, displayId20]);
    await checkSelectedDisplay([0], [0]);

    await dom.openMatSelect();
    const options = getDisplayOptions();
    options[1].click();
    await checkSelectedDisplay([0, 1], [0, 1]);

    // selects both display 0 and display 1 from store
    resetDom(component.rects(), component.displays());
    await checkSelectedDisplay([0, 1], [0, 1], false);

    // only display 1 was received so only display 1 is selected from store
    resetDom([rectGroup1], [displayId20]);
    await checkSelectedDisplay([1], [1], false);

    // store ignored as no displays received
    resetDom([rectGroup0, rectGroup1], []);
    await checkSelectedDisplay([], []);

    // selects both display 0 and display 1 from store
    dom.setComponentInput('displays', [displayId10, displayId20]);
    await checkSelectedDisplay([0], [0], false);
  });

  it('defaults initial selection to first active display with rects', async () => {
    dom.setComponentInput('rects', [rectGroup0, rectGroup1]);
    dom.setComponentInput('displays', [
      {displayId: 10, groupId: 1, name: 'Display 0', isActive: false},
      {displayId: 20, groupId: 0, name: 'Display 1', isActive: true},
    ]);
    await checkSelectedDisplay([1], [0]);
  });

  it('defaults initial selection to first display with non-display rects and groupId 0', async () => {
    dom.setComponentInput('rects', [rectGroup0]);
    dom.setComponentInput('displays', [
      {displayId: 10, groupId: 1, name: 'Display 0', isActive: true},
      {displayId: 20, groupId: 0, name: 'Display 1', isActive: false},
    ]);
    await checkSelectedDisplay([1], [0]);
  });

  it('defaults initial selection to first display with non-display rects and groupId non-zero', async () => {
    dom.setComponentInput('rects', [rectGroup1]);
    dom.setComponentInput('displays', [
      {displayId: 10, groupId: 0, name: 'Display 0', isActive: false},
      {displayId: 20, groupId: 1, name: 'Display 1', isActive: false},
    ]);
    await checkSelectedDisplay([1], [1]);
  });

  it('handles change from zero to one display and back to zero', async () => {
    await checkSelectedDisplay([], []);
    const placeholder = dom.get('.placeholder-text');
    placeholder.checkTextExact('No rects found.');

    dom.setComponentInput('rects', [rectGroup0]);
    dom.setComponentInput('displays', [
      {displayId: 10, groupId: 0, name: 'Display 0', isActive: false},
    ]);
    await checkSelectedDisplay([0], [0]);

    dom.setComponentInput('displays', []);
    dom.setComponentInput('rects', []);
    await checkSelectedDisplay([], []);
  });

  it('handles current display group id no longer present', async () => {
    dom.setComponentInput('rects', [rectGroup0]);
    dom.setComponentInput('displays', [
      {displayId: 10, groupId: 0, name: 'Display 0', isActive: false},
    ]);
    await checkSelectedDisplay([0], [0]);

    dom.setComponentInput('rects', [rectGroup1]);
    dom.setComponentInput('displays', [
      {displayId: 20, groupId: 1, name: 'Display 1', isActive: false},
    ]);
    await checkSelectedDisplay([1], [1]);
  });

  it('draws mini rects with non-present group id', () => {
    dom.setComponentInput('displays', [
      {displayId: 10, groupId: 0, name: 'Display 0', isActive: false},
    ]);
    dom.detectChanges();
    dom.setComponentInput('rects', [rectGroup0]);
    dom.setComponentInput('miniRects', [rectGroup2]);
    resetSpies();
    dom.detectChanges();
    checkAllSpiesCalled(2);
    expect(
      updateRectsSpy.calls
        .all()
        .forEach((call) => expect(call.args[0].length).toBe(1)),
    );
  });

  it('draws mini rects with default spacing, rotation and shading mode', () => {
    dom.setComponentInput('displays', [
      {displayId: 10, groupId: 0, name: 'Display 0', isActive: false},
    ]);
    dom.detectChanges();

    updateSeparationSlider();
    updateRotationSlider();
    updateShadingMode(ShadingMode.GRADIENT, ShadingMode.WIRE_FRAME);

    dom.setComponentInput('rects', [rectGroup0, rectGroup0]);
    dom.setComponentInput('miniRects', [rectGroup0, rectGroup0]);
    resetSpies();
    dom.detectChanges();
    checkAllSpiesCalled(2);

    const largeRectsCamera = assertDefined(
      updateViewPositionSpy.calls.first().args[0],
    );
    const miniRectsCamera = assertDefined(
      updateViewPositionSpy.calls.mostRecent().args[0],
    );

    expect(largeRectsCamera.rotationAngleX).toEqual(
      miniRectsCamera.rotationAngleX * 0.5,
    );
    expect(largeRectsCamera.rotationAngleY).toEqual(
      miniRectsCamera.rotationAngleY * 0.5,
    );
    const largeRects = assertDefined(updateRectsSpy.calls.first().args[0]);
    const miniRects = assertDefined(updateRectsSpy.calls.mostRecent().args[0]);

    expect(largeRects[0].colorType).toEqual(ColorType.EMPTY);
    expect(miniRects[0].colorType).toEqual(ColorType.VISIBLE);

    expect(largeRects[0].topLeft.z).toBe(12);
    expect(miniRects[0].topLeft.z).toBe(200);
  });

  it('redraws mini rects on change', () => {
    dom.setComponentInput('miniRects', [rectGroup0, rectGroup0]);
    dom.detectChanges();
    resetSpies();

    dom.setComponentInput('miniRects', [rectGroup0, rectGroup0]);
    dom.detectChanges();
    checkAllSpiesCalled(1);
  });

  it('handles collapse button click', () => {
    dom.detectChanges();
    const spy = spyOn(component.collapseButtonClicked, 'emit');
    dom.findAndClick('collapsible-section-title button');
    expect(spy).toHaveBeenCalled();
  });

  it('updates scene on pinned items change', () => {
    setRectAndDisplayGroup0();
    resetSpies();

    dom.setComponentInput('pinnedIds', [rectGroup0.id]);
    dom.detectChanges();
    expect(updateViewPositionSpy).toHaveBeenCalledTimes(0);
    expect(updateRectsSpy).toHaveBeenCalledTimes(1);
    expect(updateLabelsSpy).toHaveBeenCalledTimes(0);
    expect(renderViewSpy).toHaveBeenCalledTimes(1);
    expect(updateRectsSpy.calls.mostRecent().args[0][0].isPinned).toBeTrue();
  });

  it('emits rect id on rect click', () => {
    setRectAndDisplayGroup0();

    const testString = 'test_id';
    const highlightedIdSpy = spyOn(component.highlightedIdChange, 'emit');

    const spy = spyOn(Canvas.prototype, 'getClickedRectId').and.returnValue(
      undefined,
    );
    dom.findAndClick(largeRectsCanvasSelector);
    expect(highlightedIdSpy).not.toHaveBeenCalled();
    spy.and.returnValue(testString);
    dom.findAndClick(largeRectsCanvasSelector);
    expect(highlightedIdSpy).toHaveBeenCalledOnceWith(testString);
  });

  it('pans view without emitting rect id', () => {
    setRectAndDisplayGroup0();
    const cameraBefore = updateViewPositionSpy.calls.mostRecent().args[0];
    expect(cameraBefore.panScreenDistance.dx).toBe(0);
    expect(cameraBefore.panScreenDistance.dy).toBe(0);
    const boundingBoxBefore = updateViewPositionSpy.calls.mostRecent().args[1];
    resetSpies();

    const testString = 'test_id';
    spyOn(Canvas.prototype, 'getClickedRectId').and.returnValue(testString);
    const highlightedIdSpy = spyOn(component.highlightedIdChange, 'emit');

    panView();
    expect(updateViewPositionSpy).toHaveBeenCalledTimes(1);
    expect(updateRectsSpy).not.toHaveBeenCalled();
    expect(updateLabelsSpy).not.toHaveBeenCalled();
    expect(renderViewSpy).toHaveBeenCalled();

    const [cameraAfter, boundingBoxAfter] =
      updateViewPositionSpy.calls.mostRecent().args;
    expect(cameraAfter.panScreenDistance.dx).toBe(5);
    expect(cameraAfter.panScreenDistance.dy).toBe(10);
    expect(boundingBoxAfter).toEqual(boundingBoxBefore);

    dom.findAndClick(largeRectsCanvasSelector);
    expect(highlightedIdSpy).not.toHaveBeenCalled();

    dom.findAndClick(largeRectsCanvasSelector);
    expect(highlightedIdSpy).toHaveBeenCalledOnceWith(testString);
  });

  it('handles window resize', async () => {
    setRectAndDisplayGroup0();
    const boundingBox = updateViewPositionSpy.calls.mostRecent().args[1];
    resetSpies();

    spyOnProperty(window, 'innerWidth').and.returnValue(window.innerWidth / 2);
    window.dispatchEvent(new Event('resize'));
    await dom.detectChangesAndWaitStable();
    await waitToBeCalled(renderViewSpy, 1);
    expect(updateViewPositionSpy).toHaveBeenCalledTimes(1);
    expect(updateRectsSpy).not.toHaveBeenCalled();
    expect(updateLabelsSpy).not.toHaveBeenCalled();
    expect(updateViewPositionSpy.calls.mostRecent().args[1]).toEqual(
      boundingBox,
    );
  });

  it('handles change in dark mode', async () => {
    dom.setComponentInput('miniRects', [rectGroup0]);
    setRectAndDisplayGroup0();
    resetSpies();

    dom.setComponentInput('isDarkMode', true);
    dom.detectChanges();
    expect(updateRectsSpy).toHaveBeenCalledTimes(2);
    expect(updateLabelsSpy).toHaveBeenCalledTimes(2);
    expect(updateViewPositionSpy).toHaveBeenCalledTimes(1); // only for mini rects
    expect(renderViewSpy).toHaveBeenCalledTimes(2);
  });

  it('handles zoom button clicks', () => {
    setRectAndDisplayGroup0();
    const boundingBox = updateViewPositionSpy.calls.mostRecent().args[1];
    const zoomFactor =
      updateViewPositionSpy.calls.mostRecent().args[0].zoomFactor;
    resetSpies();

    dom.findAndClick(zoomInSelector);
    checkZoomedIn(zoomFactor);
    const zoomedInFactor =
      updateViewPositionSpy.calls.mostRecent().args[0].zoomFactor;
    expect(updateViewPositionSpy.calls.mostRecent().args[1]).toEqual(
      boundingBox,
    );
    resetSpies();

    dom.findAndClick('.zoom-out-button');
    checkZoomedOut(zoomedInFactor);
    expect(updateViewPositionSpy.calls.mostRecent().args[1]).toEqual(
      boundingBox,
    );
  });

  it('handles zoom change via scroll event', () => {
    setRectAndDisplayGroup0();
    const zoomFactor =
      updateViewPositionSpy.calls.mostRecent().args[0].zoomFactor;
    resetSpies();

    const zoomInEvent = new WheelEvent('wheel');
    Object.defineProperty(zoomInEvent, 'target', {
      value: dom.get(largeRectsCanvasSelector).getHTMLElement(),
    });
    Object.defineProperty(zoomInEvent, 'deltaY', {value: 0});
    spyOn(zoomInEvent, 'preventDefault').and.callThrough();
    dom.dispatchEvent(zoomInEvent);
    expect(zoomInEvent.preventDefault).toHaveBeenCalledTimes(1);
    checkZoomedIn(zoomFactor);

    const zoomedInFactor =
      updateViewPositionSpy.calls.mostRecent().args[0].zoomFactor;
    resetSpies();

    const zoomOutEvent = new WheelEvent('wheel');
    Object.defineProperty(zoomOutEvent, 'target', {
      value: dom.get(largeRectsCanvasSelector).getHTMLElement(),
    });
    Object.defineProperty(zoomOutEvent, 'deltaY', {value: 1});
    spyOn(zoomOutEvent, 'preventDefault').and.callThrough();
    dom.dispatchEvent(zoomOutEvent);
    expect(zoomOutEvent.preventDefault).toHaveBeenCalledTimes(1);
    checkZoomedOut(zoomedInFactor);
  });

  it('handles reset button click', () => {
    setRectAndDisplayGroup0();
    const [camera, boundingBox] = updateViewPositionSpy.calls.mostRecent().args;

    updateRotationSlider();
    updateSeparationSlider();
    dom.findAndClick(zoomInSelector);
    panView();
    resetSpies();

    dom.findAndClick('.reset-button');
    checkAllSpiesCalled(1);
    const [newCamera, newBoundingBox] =
      updateViewPositionSpy.calls.mostRecent().args;
    expect(newCamera).toEqual(camera);
    expect(newBoundingBox).toEqual(boundingBox);
  });

  it('handles change in highlighted item', () => {
    setRectAndDisplayGroup0();
    expect(updateRectsSpy.calls.mostRecent().args[0][0].colorType).toEqual(
      ColorType.VISIBLE,
    );
    resetSpies();

    dom.setComponentInput('highlightedItem', rectGroup0.id);
    dom.detectChanges();

    expect(updateViewPositionSpy).not.toHaveBeenCalled();
    expect(updateRectsSpy).toHaveBeenCalledTimes(1);
    expect(updateLabelsSpy).toHaveBeenCalledTimes(1);
    expect(renderViewSpy).toHaveBeenCalledTimes(1);
    expect(updateRectsSpy.calls.mostRecent().args[0][0].colorType).toEqual(
      ColorType.HIGHLIGHTED,
    );
  });

  it('handles rect double click', () => {
    setRectAndDisplayGroup0();
    resetSpies();

    const testString = 'test_id';
    const spy = spyOn(Canvas.prototype, 'getClickedRectId').and.returnValue(
      undefined,
    );
    const rectsDblClickSpy = spyOn(component.rectsDblClick, 'emit');

    const canvas = dom.get(largeRectsCanvasSelector);
    canvas.doubleClick();
    expect(rectsDblClickSpy).not.toHaveBeenCalled();
    spy.and.returnValue(testString);

    canvas.doubleClick();
    expect(rectsDblClickSpy).toHaveBeenCalledOnceWith(testString);
  });

  it('handles mini rect double click', () => {
    setRectAndDisplayGroup0();
    resetSpies();

    const miniRectsDblClickSpy = spyOn(component.miniRectsDblClick, 'emit');

    dom.get('.mini-rects-canvas').doubleClick();
    expect(miniRectsDblClickSpy).toHaveBeenCalledTimes(1);
  });

  it('does not render more that selected label if over 30 rects', () => {
    dom.setComponentInput(
      'rects',
      Array.from({length: 30}, () => rectGroup0),
    );
    dom.setComponentInput('displays', [displayGroup0]);
    dom.detectChanges();
    expect(updateLabelsSpy.calls.mostRecent().args[0].length).toBe(30);

    const newRect = makeRectWithGroupId(0, true, 'new rect');
    dom.setComponentInput('rects', component.rects().concat([newRect]));
    dom.detectChanges();
    expect(updateLabelsSpy.calls.mostRecent().args[0].length).toBe(0);

    dom.setComponentInput('highlightedItem', newRect.id);
    dom.detectChanges();
    expect(updateLabelsSpy.calls.mostRecent().args[0].length).toBe(1);
  });

  it('does not render more that selected label if multiple group ids', async () => {
    dom.setComponentInput('rects', [rectGroup0]);
    dom.setComponentInput('displays', [
      {displayId: 0, groupId: 0, name: 'Display 0', isActive: false},
      {displayId: 1, groupId: 1, name: 'Display 1', isActive: false},
    ]);
    dom.detectChanges();
    await checkSelectedDisplay([0], [0]);
    expect(updateLabelsSpy.calls.mostRecent().args[0].length).toBe(1);

    dom.setComponentInput('rects', component.rects().concat([rectGroup1]));
    dom.detectChanges();
    dom.openMatSelect();
    getDisplayOptions()[1].click();
    await checkSelectedDisplay([0, 1], [0, 1], true);

    expect(updateLabelsSpy.calls.mostRecent().args[0].length).toBe(0);

    dom.setComponentInput('highlightedItem', rectGroup0.id);
    dom.detectChanges();
    expect(updateLabelsSpy.calls.mostRecent().args[0].length).toBe(1);
  });

  it('handles rect type button click', async () => {
    const spy = spyOn(component.rectTypeButtonClick, 'emit');
    expect(dom.find('.rect-type-toggle')).toBeUndefined();

    dom.setComponentInput('rectSpec', {
      type: TraceRectType.LAYERS,
      icon: 'layers',
      legend: [],
    });
    dom.detectChanges();
    expect(dom.find('.rect-type-toggle')).toBeUndefined();

    dom.setComponentInput('allRectSpecs', [
      component.rectSpec(),
      {
        type: TraceRectType.INPUT_WINDOWS,
        icon: 'touch_app',
        legend: [],
      },
    ]);
    dom.detectChanges();
    const buttons = dom.findAll('.rect-type-icon');
    buttons[0].checkTextExact('layers');
    buttons[1].checkTextExact('touch_app');
    await checkTooltips(buttons, ['Show layers', 'Show input windows']);
    buttons[0].click();
    expect(spy).not.toHaveBeenCalled();
    buttons[1].click();
    expect(spy).toHaveBeenCalledOnceWith(TraceRectType.INPUT_WINDOWS);
  });

  it('shows warning for any rect type set after the first', async () => {
    dom.setComponentInput('rectSpec', {
      type: TraceRectType.LAYERS,
      icon: 'layers',
      legend: [],
    });
    dom.detectChanges();
    expect(dom.find('.warning')).toBeUndefined();

    dom.setComponentInput('rectSpec', {
      type: TraceRectType.INPUT_WINDOWS,
      icon: 'touch_app',
      legend: [],
    });
    dom.detectChanges();
    const warning = dom.get('.warning');
    warning
      .get('.warning-message')
      .checkTextExact(
        'Showing input windows - change rect type via toggle above',
      );

    dom.setComponentInput('rectSpec', {
      type: TraceRectType.LAYERS,
      icon: 'layers',
      legend: [],
    });
    dom.detectChanges();
    expect(dom.find('.warning')).toBeUndefined();
  });

  it('provides legend from rect spec', () => {
    expect(dom.find('.rect-legend')).toBeUndefined();
    const legend = [
      {
        fill: 'blue',
        border: 'black',
        desc: 'Option 1',
        showInWireFrameMode: false,
      },
      {
        fill: '',
        border: 'red',
        desc: 'Option 2',
        showInWireFrameMode: true,
      },
      {
        border: 'green',
        desc: 'Option 3',
        showInWireFrameMode: true,
      },
    ];
    dom.setComponentInput('rectSpec', {
      type: TraceRectType.LAYERS,
      icon: 'layers',
      legend,
    });
    dom.detectChanges();
    const legendEl = dom.get('.rect-legend');
    expect(legendEl.find('.rect-legend-expand-button')).toBeUndefined();

    const optionsWrapper = dom.get('.shading-opts');
    optionsWrapper.checkClassName('force-show-all', false);

    let options = optionsWrapper.findAll('.shading-opt');
    expect(options.length).toBe(3);
    options.forEach((option, i) => checkShadingOpt(option, i, legend));

    updateShadingMode(ShadingMode.GRADIENT, ShadingMode.WIRE_FRAME);
    options = optionsWrapper.findAll('.shading-opt');
    expect(options.length).toBe(2);
    options.forEach((option, i) => checkShadingOpt(option, i + 1, legend));

    const wrapperEl = optionsWrapper.getHTMLElement();
    wrapperEl.style.width = wrapperEl.clientWidth / 2 + 'px';
    dom.detectChanges(); // halve wrapper width so options no longer all it
    const expandButton = legendEl.get('.rect-legend-expand-button');
    expandButton.checkTextExact('more_horiz');
    expandButton.click();
    optionsWrapper.checkClassName('force-show-all', true);
    expandButton.checkTextExact('expand_circle_down');

    expandButton.click();
    expandButton.checkTextExact('more_horiz');
    optionsWrapper.checkClassName('force-show-all', false);

    expandButton.click(); // click again to show expanded view

    wrapperEl.style.width = '';
    dom.detectChanges(); // button disappears now that options all fit in available space
    expect(legendEl.find('.rect-legend-expand-button')).toBeUndefined();
  });

  it('handles change in user options', () => {
    const userOptions = assertDefined(
      dom.findByDirective(UserOptionsComponent),
    );
    const spy = spyOn(component.optionsChange, 'emit');
    const options = {opt: {name: 'opt', enabled: true}};
    userOptions.optionsChange.emit(options);
    expect(spy).toHaveBeenCalledOnceWith(options);
  });

  function resetSpies() {
    [
      updateViewPositionSpy,
      updateRectsSpy,
      updateLabelsSpy,
      renderViewSpy,
    ].forEach((spy) => spy.calls.reset());
  }

  function setRectAndDisplayGroup0() {
    dom.setComponentInput('rects', [rectGroup0]);
    dom.setComponentInput('displays', [displayGroup0]);
    dom.detectChanges();
  }

  async function checkSelectedDisplay(
    displayNumbers: number[],
    testIds: number[],
    changeInBoundingBox?: boolean,
  ) {
    await dom.detectChangesAndWaitStable();
    dom.detectChanges();
    const displaySelect = dom.get('.displays-select');
    displaySelect.checkTextExact(
      displayNumbers
        .map((displayNumber) => `Display ${displayNumber}`)
        .join(', '),
    );
    const drawnRects = updateRectsSpy.calls.mostRecent().args[0];
    expect(drawnRects.length).toEqual(displayNumbers.length);
    drawnRects.forEach((rect, index) => {
      expect(rect.id).toEqual(`test-id ${testIds[index]}`);
      if (index > 0) expect(rect.transform.ty).toBeGreaterThan(0);
    });
    if (changeInBoundingBox) {
      expect(updateViewPositionSpy.calls.mostRecent().args[1]).not.toEqual(
        updateViewPositionSpy.calls.argsFor(
          updateViewPositionSpy.calls.count() - 2,
        )[1],
      );
    }
  }

  function checkSliderUnfocusesOnClick(
    slider: DOMTestHelper<RectsComponent>,
    expectedValue: number,
  ) {
    slider.dispatchEvent(new MouseEvent('mousedown'));
    slider.dispatchEvent(new MouseEvent('mouseup'));
    expect(component.getZSpacingFactor()).toBe(expectedValue);
    dom.keydownArrowRight();
    expect(component.getZSpacingFactor()).toBe(expectedValue);
    dom.keydownArrowLeft();
    expect(component.getZSpacingFactor()).toBe(expectedValue);
  }

  function updateSeparationSlider() {
    expect(component.getZSpacingFactor()).toBe(1);
    component.onSeparationSliderChange(0.06);
    dom.detectChanges();
    expect(component.getZSpacingFactor()).toBe(0.06);
  }

  function updateRotationSlider() {
    component.onRotationSliderChange(0.5);
    dom.detectChanges();
  }

  function updateShadingMode(before: ShadingMode, after: ShadingMode) {
    expect(component.getShadingMode()).toEqual(before);
    dom.findAndClick('.right-btn-container button.shading-mode');
    expect(component.getShadingMode()).toEqual(after);
  }

  function makeRectWithGroupId(
    groupId: number,
    isVisible = true,
    id?: string,
  ): UiRect {
    return new UiRectBuilder()
      .setX(0)
      .setY(0)
      .setWidth(1)
      .setHeight(1)
      .setLabel('rectangle1')
      .setTransform(
        TransformMatrix.from({
          dsdx: 1,
          dsdy: 0,
          dtdx: 0,
          dtdy: 1,
          tx: 0,
          ty: 0,
        }),
      )
      .setIsVisible(isVisible)
      .setIsDisplay(false)
      .setIsActiveDisplay(false)
      .setId(id ?? 'test-id ' + groupId)
      .setGroupId(groupId)
      .setIsClickable(true)
      .setDepth(0)
      .setOpacity(0.5)
      .build();
  }

  function panView() {
    const canvas = dom.get(largeRectsCanvasSelector);
    canvas.dispatchEvent(new MouseEvent('mousedown'));
    const mouseMoveEvent = new MouseEvent('mousemove');
    Object.defineProperty(mouseMoveEvent, 'movementX', {value: 5});
    Object.defineProperty(mouseMoveEvent, 'movementY', {value: 10});
    dom.dispatchEventInDocument(mouseMoveEvent);
    dom.dispatchEventInDocument(new MouseEvent('mouseup'));
  }

  function checkZoomedIn(oldZoomFactor: number) {
    expect(updateRectsSpy).toHaveBeenCalledTimes(0);
    expect(updateLabelsSpy).toHaveBeenCalledTimes(1);
    expect(updateViewPositionSpy).toHaveBeenCalledTimes(1);
    expect(renderViewSpy).toHaveBeenCalledTimes(1);
    expect(
      updateViewPositionSpy.calls.mostRecent().args[0].zoomFactor,
    ).toBeGreaterThan(oldZoomFactor);
  }

  function checkZoomedOut(oldZoomFactor: number) {
    expect(updateRectsSpy).toHaveBeenCalledTimes(0);
    expect(updateLabelsSpy).toHaveBeenCalledTimes(1);
    expect(updateViewPositionSpy).toHaveBeenCalledTimes(1);
    expect(renderViewSpy).toHaveBeenCalledTimes(1);
    expect(
      updateViewPositionSpy.calls.mostRecent().args[0].zoomFactor,
    ).toBeLessThan(oldZoomFactor);
  }

  function getDisplayOptions() {
    return dom.getMatSelectPanel().findAll('mat-option');
  }

  function checkAllSpiesCalled(times: number) {
    [
      updateViewPositionSpy,
      updateRectsSpy,
      updateLabelsSpy,
      renderViewSpy,
    ].forEach((spy) => expect(spy).toHaveBeenCalledTimes(times));
  }

  function checkShadingOpt(
    option: DOMTestHelper<RectsComponent>,
    i: number,
    l: RectLegendOption[],
  ) {
    const square = option.get('.square').getHTMLElement();
    expect(square.style.backgroundColor).toEqual(l[i].fill ?? '');
    expect(square.style.borderColor).toEqual(l[i].border);
    option.checkTextExact(
      l[i].fill !== undefined ? l[i].desc : 'question_mark' + l[i].desc,
    );
  }
});
