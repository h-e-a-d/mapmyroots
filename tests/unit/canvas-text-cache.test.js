// canvas-text-cache.test.js — text wrapping must not re-measure on every frame.

// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { CanvasRenderer } from '../../src/core/canvas-renderer.js';

function mockCtx() {
  return {
    measureText: vi.fn(() => ({ width: 40 })),
    fillText: vi.fn(),
    font: '', fillStyle: '', textAlign: '', textBaseline: ''
  };
}

describe('drawNodeText layout cache', () => {
  let renderer;
  afterEach(() => renderer?.destroy());

  it('re-renders a stable node without re-measuring text', () => {
    renderer = new CanvasRenderer(document.createElement('div'));
    const node = { id: 'p1', name: 'Anna Maria Theresia', surname: 'Keller', x: 0, y: 0 };
    const ctx = mockCtx();
    renderer.drawNodeText(ctx, 'p1', node, 90);
    const measured = ctx.measureText.mock.calls.length;
    expect(measured).toBeGreaterThan(0);
    renderer.drawNodeText(ctx, 'p1', node, 90);
    renderer.drawNodeText(ctx, 'p1', node, 90);
    expect(ctx.measureText.mock.calls.length).toBe(measured); // no growth
  });

  it('recomputes when the name changes', () => {
    renderer = new CanvasRenderer(document.createElement('div'));
    const node = { id: 'p1', name: 'Anna', surname: 'Keller', x: 0, y: 0 };
    const ctx = mockCtx();
    renderer.drawNodeText(ctx, 'p1', node, 90);
    const measured = ctx.measureText.mock.calls.length;
    node.name = 'Anna-Louise';
    renderer.drawNodeText(ctx, 'p1', node, 90);
    expect(ctx.measureText.mock.calls.length).toBeGreaterThan(measured);
  });
});
