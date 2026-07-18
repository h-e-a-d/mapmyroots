// canvas-culling.test.js — visible-rect math and the cull predicate.

// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { CanvasRenderer } from '../../src/core/canvas-renderer.js';

describe('viewport culling', () => {
  let renderer;
  afterEach(() => renderer?.destroy());

  it('computes the visible world rect from camera pan and zoom', () => {
    renderer = new CanvasRenderer(document.createElement('div'));
    renderer.camera = { x: -100, y: 50, scale: 2 };
    const view = renderer.getVisibleWorldRect(800, 600);
    expect(view).toEqual({ left: 50, top: -25, right: 450, bottom: 275 });
  });

  it('rectVisible accepts overlapping and rejects disjoint rects', () => {
    const view = { left: 0, top: 0, right: 100, bottom: 100 };
    expect(CanvasRenderer.rectVisible(90, 90, 150, 150, view)).toBe(true);   // corner overlap
    expect(CanvasRenderer.rectVisible(-50, 20, -10, 80, view)).toBe(false);  // fully left
    expect(CanvasRenderer.rectVisible(20, 120, 80, 180, view)).toBe(false);  // fully below
  });
});
