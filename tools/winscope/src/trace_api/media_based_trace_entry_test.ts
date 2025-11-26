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

import {CanvasEntry, VideoEntry} from './media_based_trace_entry';

describe('MediaBasedTraceEntry', () => {
  let canvas: jasmine.SpyObj<HTMLCanvasElement>;
  let ctx: jasmine.SpyObj<CanvasRenderingContext2D>;

  beforeEach(() => {
    ctx = jasmine.createSpyObj<CanvasRenderingContext2D>('ctx', [
      'rotate',
      'drawImage',
      'resetTransform',
    ]);
    canvas = jasmine.createSpyObj<HTMLCanvasElement>('canvas', ['getContext']);
    canvas.getContext.withArgs('2d').and.returnValue(ctx);
  });

  it('VideoEntry throws error on tryDrawOnCanvas', () => {
    const entry = new VideoEntry(new Blob(), 0);
    expect(() => entry.tryDrawOnCanvas(canvas)).toThrow();
  });

  it('draws video frame for rotation angle 0 degrees', () => {
    const frame = jasmine.createSpyObj<ImageBitmap>('frame', [], {
      width: 4,
      height: 10,
    });
    const entry = new CanvasEntry(frame, 0);

    entry.tryDrawOnCanvas(canvas);
    expect(ctx.rotate).toHaveBeenCalledOnceWith(0);
    expect(ctx.drawImage as jasmine.Spy).toHaveBeenCalledOnceWith(
      frame,
      0,
      0,
      4,
      10,
    );
    expect(ctx.resetTransform).toHaveBeenCalledTimes(1);

    expect(canvas.width).toEqual(4);
    expect(canvas.height).toEqual(10);
  });

  it('draws video frame for rotation angle 90 degrees', () => {
    const frame = jasmine.createSpyObj<ImageBitmap>('frame', [], {
      width: 4,
      height: 10,
    });
    const entry = new CanvasEntry(frame, 90);

    entry.tryDrawOnCanvas(canvas);
    expect(ctx.rotate).toHaveBeenCalledOnceWith(Math.PI / 2);
    expect(ctx.drawImage as jasmine.Spy).toHaveBeenCalledOnceWith(
      frame,
      0,
      -10,
      4,
      10,
    );
    expect(ctx.resetTransform).toHaveBeenCalledTimes(1);

    expect(canvas.width).toEqual(10);
    expect(canvas.height).toEqual(4);
  });

  it('draws video frame for rotation angle 180 degrees', () => {
    const frame = jasmine.createSpyObj<ImageBitmap>('frame', [], {
      width: 4,
      height: 10,
    });
    const entry = new CanvasEntry(frame, 180);

    entry.tryDrawOnCanvas(canvas);
    expect(ctx.rotate).toHaveBeenCalledOnceWith(Math.PI);
    expect(ctx.drawImage as jasmine.Spy).toHaveBeenCalledOnceWith(
      frame,
      -4,
      -10,
      4,
      10,
    );
    expect(ctx.resetTransform).toHaveBeenCalledTimes(1);

    expect(canvas.width).toEqual(4);
    expect(canvas.height).toEqual(10);
  });

  it('draws video frame for rotation angle 270 degrees', () => {
    const frame = jasmine.createSpyObj<ImageBitmap>('frame', [], {
      width: 4,
      height: 10,
    });
    const entry = new CanvasEntry(frame, 270);

    entry.tryDrawOnCanvas(canvas);
    expect(ctx.rotate).toHaveBeenCalledOnceWith((Math.PI * 3) / 2);
    expect(ctx.drawImage as jasmine.Spy).toHaveBeenCalledOnceWith(
      frame,
      -4,
      0,
      4,
      10,
    );
    expect(ctx.resetTransform).toHaveBeenCalledTimes(1);

    expect(canvas.width).toEqual(10);
    expect(canvas.height).toEqual(4);
  });
});
