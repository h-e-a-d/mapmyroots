// canvas-grid.test.js — grid must draw in two batched strokes, and skip entirely at low zoom.

// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { CanvasRenderer } from '../../src/core/canvas-renderer.js';

function mockCtx() {
  return {
    beginPath: vi.fn(), moveTo: vi.fn(), lineTo: vi.fn(),
    stroke: vi.fn(), setLineDash: vi.fn(),
    strokeStyle: '', lineWidth: 0
  };
}

describe('CanvasRenderer.drawGrid', () => {
  let renderer;
  afterEach(() => renderer?.destroy());

  it('skips the grid entirely below the zoom threshold', () => {
    renderer = new CanvasRenderer(document.createElement('div'));
    renderer.camera = { x: 0, y: 0, scale: 0.2 };
    const ctx = mockCtx();
    renderer.drawGrid(ctx, 800, 600);
    expect(ctx.stroke).not.toHaveBeenCalled();
  });

  it('draws the whole grid in exactly two strokes (minor + major)', () => {
    renderer = new CanvasRenderer(document.createElement('div'));
    renderer.camera = { x: 0, y: 0, scale: 1 };
    const ctx = mockCtx();
    renderer.drawGrid(ctx, 800, 600);
    expect(ctx.stroke).toHaveBeenCalledTimes(2);
    expect(ctx.moveTo.mock.calls.length).toBeGreaterThan(4); // still drew many lines
  });
});
