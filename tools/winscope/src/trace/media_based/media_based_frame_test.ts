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

import {MediaBasedFrame} from './media_based_frame';

describe('MediaBasedFrame', () => {
  const imageBitmap = jasmine.createSpyObj<ImageBitmap>('frame', [], {
    width: 4,
    height: 10,
  });
  const frame = jasmine.createSpyObj<VideoFrame>('frame', [], {
    codedWidth: 4,
    codedHeight: 10,
  });
  let htmlCanvas: jasmine.SpyObj<HTMLCanvasElement>;
  let htmlCtx: jasmine.SpyObj<CanvasRenderingContext2D>;
  let offscreenCanvas: jasmine.SpyObj<OffscreenCanvas>;
  let offscreenCtx: jasmine.SpyObj<OffscreenCanvasRenderingContext2D>;

  beforeEach(() => {
    htmlCtx = jasmine.createSpyObj<CanvasRenderingContext2D>('ctx', [
      'translate',
      'rotate',
      'drawImage',
      'resetTransform',
    ]);
    htmlCanvas = jasmine.createSpyObj<HTMLCanvasElement>('canvas', [
      'getContext',
    ]);
    (htmlCanvas.getContext as jasmine.Spy)
      .withArgs('2d')
      .and.returnValue(htmlCtx);

    offscreenCtx = jasmine.createSpyObj<OffscreenCanvasRenderingContext2D>(
      'ctx',
      ['translate', 'rotate', 'drawImage', 'resetTransform'],
    );
    offscreenCanvas = jasmine.createSpyObj<OffscreenCanvas>('canvas', [
      'getContext',
    ]);
    (offscreenCanvas.getContext as jasmine.Spy)
      .withArgs('2d')
      .and.returnValue(offscreenCtx);
  });

  it('MediaBasedFrame draws ImageBitmap for rotation angle 0 degrees', () => {
    checkDrawZeroDegree(imageBitmap, htmlCanvas, htmlCtx);
    checkDrawZeroDegree(imageBitmap, offscreenCanvas, offscreenCtx);
  });

  it('MediaBasedFrame draws VideoFrame for rotation angle 0 degrees', () => {
    checkDrawZeroDegree(frame, htmlCanvas, htmlCtx);
    checkDrawZeroDegree(frame, offscreenCanvas, offscreenCtx);
  });

  it('MediaBasedFrame draws ImageBitmap for rotation angle 90 degrees', () => {
    checkDraw90Degree(imageBitmap, htmlCanvas, htmlCtx);
    checkDraw90Degree(imageBitmap, offscreenCanvas, offscreenCtx);
  });

  it('MediaBasedFrame draws VideoFrame for rotation angle 90 degrees', () => {
    checkDraw90Degree(frame, htmlCanvas, htmlCtx);
    checkDraw90Degree(frame, offscreenCanvas, offscreenCtx);
  });

  it('MediaBasedFrame draws ImageBitmap for rotation angle 180 degrees', () => {
    checkDraw180Degree(imageBitmap, htmlCanvas, htmlCtx);
    checkDraw180Degree(imageBitmap, offscreenCanvas, offscreenCtx);
  });

  it('MediaBasedFrame draws VideoFrame for rotation angle 180 degrees', () => {
    checkDraw180Degree(frame, htmlCanvas, htmlCtx);
    checkDraw180Degree(frame, offscreenCanvas, offscreenCtx);
  });

  it('MediaBasedFrame draws ImageBitmap for rotation angle 270 degrees', () => {
    checkDraw270Degree(imageBitmap, htmlCanvas, htmlCtx);
    checkDraw270Degree(imageBitmap, offscreenCanvas, offscreenCtx);
  });

  it('MediaBasedFrame draws VideoFrame for rotation angle 270 degrees', () => {
    checkDraw270Degree(frame, htmlCanvas, htmlCtx);
    checkDraw270Degree(frame, offscreenCanvas, offscreenCtx);
  });

  it('MediaBasedFrame does not update canvas dimensions', () => {
    checkCanvasDimensionsNotUpdated(htmlCanvas);
    checkCanvasDimensionsNotUpdated(offscreenCanvas);
  });

  it('MediaBasedFrame applies translation', () => {
    checkTranslationApplied(htmlCanvas, htmlCtx);
    checkTranslationApplied(offscreenCanvas, offscreenCtx);
  });

  it('MediaBasedFrame uses size provided in constructor', () => {
    checkUsesSizeFromConstructor(htmlCanvas, htmlCtx);
    checkUsesSizeFromConstructor(offscreenCanvas, offscreenCtx);
  });

  function checkDrawZeroDegree(img: Image, canvas: Canvas, ctx: CtxSpy) {
    const entry = new MediaBasedFrame(img, 0);
    entry.tryDrawOnCanvas(canvas);
    expect(ctx.translate).not.toHaveBeenCalled();
    expect(ctx.rotate).toHaveBeenCalledOnceWith(0);
    expect(ctx.drawImage as jasmine.Spy).toHaveBeenCalledOnceWith(
      img,
      0,
      0,
      4,
      10,
    );
    expect(ctx.resetTransform).toHaveBeenCalledTimes(1);
    expect(canvas.width).toEqual(4);
    expect(canvas.height).toEqual(10);
  }

  function checkDraw90Degree(img: Image, canvas: Canvas, ctx: CtxSpy) {
    const entry = new MediaBasedFrame(img, 90);
    entry.tryDrawOnCanvas(canvas);
    expect(ctx.translate).not.toHaveBeenCalled();
    expect(ctx.rotate).toHaveBeenCalledOnceWith(Math.PI / 2);
    expect(ctx.drawImage as jasmine.Spy).toHaveBeenCalledOnceWith(
      img,
      0,
      -10,
      4,
      10,
    );
    expect(ctx.resetTransform).toHaveBeenCalledTimes(1);
    expect(canvas.width).toEqual(10);
    expect(canvas.height).toEqual(4);
  }

  function checkDraw180Degree(img: Image, canvas: Canvas, ctx: CtxSpy) {
    const entry = new MediaBasedFrame(img, 180);
    entry.tryDrawOnCanvas(canvas);
    expect(ctx.translate).not.toHaveBeenCalled();
    expect(ctx.rotate).toHaveBeenCalledOnceWith(Math.PI);
    expect(ctx.drawImage as jasmine.Spy).toHaveBeenCalledOnceWith(
      img,
      -4,
      -10,
      4,
      10,
    );
    expect(ctx.resetTransform).toHaveBeenCalledTimes(1);
    expect(canvas.width).toEqual(4);
    expect(canvas.height).toEqual(10);
  }

  function checkDraw270Degree(img: Image, canvas: Canvas, ctx: CtxSpy) {
    const entry = new MediaBasedFrame(img, 270);
    entry.tryDrawOnCanvas(canvas);
    expect(ctx.translate).not.toHaveBeenCalled();
    expect(ctx.rotate).toHaveBeenCalledOnceWith((Math.PI * 3) / 2);
    expect(ctx.drawImage as jasmine.Spy).toHaveBeenCalledOnceWith(
      img,
      -4,
      0,
      4,
      10,
    );
    expect(ctx.resetTransform).toHaveBeenCalledTimes(1);
    expect(canvas.width).toEqual(10);
    expect(canvas.height).toEqual(4);
  }

  function checkCanvasDimensionsNotUpdated(canvas: Canvas) {
    canvas.width = 15;
    canvas.height = 20;
    const entry = new MediaBasedFrame(imageBitmap, 0);
    entry.tryDrawOnCanvas(canvas, false);
    expect(canvas.width).toEqual(15);
    expect(canvas.height).toEqual(20);
  }

  function checkTranslationApplied(canvas: Canvas, ctx: CtxSpy) {
    const entry = new MediaBasedFrame(imageBitmap, 0, {x: 10, y: 20});
    entry.tryDrawOnCanvas(canvas, true);
    expect(ctx.translate).toHaveBeenCalledOnceWith(10, 20);
    expect(ctx.drawImage as jasmine.Spy).toHaveBeenCalledOnceWith(
      imageBitmap,
      0,
      0,
      4,
      10,
    );
    expect(ctx.resetTransform).toHaveBeenCalledTimes(1);
  }

  function checkUsesSizeFromConstructor(canvas: Canvas, ctx: CtxSpy) {
    const entry = new MediaBasedFrame(imageBitmap, 0, undefined, {
      width: 15,
      height: 20,
    });
    entry.tryDrawOnCanvas(canvas);
    expect(ctx.drawImage as jasmine.Spy).toHaveBeenCalledOnceWith(
      imageBitmap,
      0,
      0,
      15,
      20,
    );
    expect(ctx.resetTransform).toHaveBeenCalledTimes(1);
    expect(canvas.width).toEqual(15);
    expect(canvas.height).toEqual(20);
  }
});

type Image = ImageBitmap | VideoFrame;
type Canvas = HTMLCanvasElement | OffscreenCanvas;
type CtxSpy =
  | jasmine.SpyObj<OffscreenCanvasRenderingContext2D>
  | jasmine.SpyObj<CanvasRenderingContext2D>;
