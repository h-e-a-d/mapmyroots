import { describe, it, expect, vi } from 'vitest';
import { clampTransform, applyZoom, applyPan, DEFAULT_TRANSFORM, mountCropper } from '../../../../src/features/photos/avatar-cropper.js';

describe('clampTransform', () => {
  it('keeps default transform untouched', () => {
    const t = clampTransform(DEFAULT_TRANSFORM, { width: 1000, height: 1000 });
    expect(t).toEqual(DEFAULT_TRANSFORM);
  });

  it('clamps scale below 1.0 up to 1.0', () => {
    const t = clampTransform({ x: 0.5, y: 0.5, scale: 0.5 }, { width: 1000, height: 1000 });
    expect(t.scale).toBe(1.0);
  });

  it('clamps scale above 4.0 down to 4.0', () => {
    const t = clampTransform({ x: 0.5, y: 0.5, scale: 10 }, { width: 1000, height: 1000 });
    expect(t.scale).toBe(4.0);
  });

  it('clamps x/y so image always covers the circle (no gaps)', () => {
    // At scale 1 the image just covers; pan to x=0 (extreme left edge of image at center) leaves a gap
    const t = clampTransform({ x: 0, y: 0.5, scale: 1 }, { width: 1000, height: 1000 });
    // At scale 1 with square image and square viewport, x must be 0.5 exactly
    expect(t.x).toBe(0.5);
  });

  it('allows pan when zoomed in past cover', () => {
    const t = clampTransform({ x: 0.3, y: 0.5, scale: 2 }, { width: 1000, height: 1000 });
    expect(t.x).toBeCloseTo(0.3, 5);
  });
});

describe('applyZoom', () => {
  it('zooms in around the cursor anchor', () => {
    const before = { x: 0.5, y: 0.5, scale: 1 };
    const after = applyZoom(before, 1.5, { x: 0.5, y: 0.5 }, { width: 1000, height: 1000 });
    expect(after.scale).toBe(1.5);
    expect(after.x).toBeCloseTo(0.5, 5);
  });

  it('clamps zoom output', () => {
    const t = applyZoom({ x: 0.5, y: 0.5, scale: 1 }, 100, { x: 0.5, y: 0.5 }, { width: 1000, height: 1000 });
    expect(t.scale).toBe(4.0);
  });
});

describe('applyPan', () => {
  it('translates x/y by normalized delta', () => {
    const t = applyPan({ x: 0.5, y: 0.5, scale: 2 }, { dx: 0.1, dy: 0.0 }, { width: 1000, height: 1000 });
    expect(t.x).toBeCloseTo(0.6, 5);
    expect(t.y).toBeCloseTo(0.5, 5);
  });
});

describe('mountCropper', () => {
  function setupContainer() {
    const c = document.createElement('div');
    document.body.appendChild(c);
    return c;
  }

  it('mounts a canvas inside the container', () => {
    const handle = mountCropper({
      container: setupContainer(),
      blob: new Blob(['x'], { type: 'image/jpeg' }),
      transform: DEFAULT_TRANSFORM,
      onChange: () => {}
    });
    expect(handle.canvas).toBeInstanceOf(HTMLCanvasElement);
    expect(handle.canvas.width).toBe(400);
    handle.destroy();
  });

  it('returns the current transform via getTransform()', () => {
    const handle = mountCropper({
      container: setupContainer(),
      blob: new Blob(['x'], { type: 'image/jpeg' }),
      transform: { x: 0.3, y: 0.4, scale: 2 },
      onChange: () => {}
    });
    expect(handle.getTransform()).toEqual({ x: 0.3, y: 0.4, scale: 2 });
    handle.destroy();
  });

  it('destroy() removes the canvas', () => {
    const container = setupContainer();
    const handle = mountCropper({
      container, blob: new Blob(['x']), transform: DEFAULT_TRANSFORM, onChange: () => {}
    });
    handle.destroy();
    expect(container.querySelector('canvas')).toBeNull();
  });

  it('reset() restores DEFAULT_TRANSFORM and fires onChange', () => {
    const onChange = vi.fn();
    const handle = mountCropper({
      container: setupContainer(),
      blob: new Blob(['x']),
      transform: { x: 0.1, y: 0.1, scale: 3 },
      onChange
    });
    handle.reset();
    expect(handle.getTransform()).toEqual(DEFAULT_TRANSFORM);
    expect(onChange).toHaveBeenCalledWith(DEFAULT_TRANSFORM);
    handle.destroy();
  });
});
