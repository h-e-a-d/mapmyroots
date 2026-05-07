// tree-chart-view.js — Init entry point, lifecycle, EventBus glue

import { appContext, EVENTS } from '../../utils/event-bus.js';
import { runLayout } from './tree-chart-layout.js';
import { detectClans, assignClanColors } from './tree-chart-clans.js';
import { computeBloodLine } from './tree-chart-highlight.js';
import { TreeChartRenderer } from './tree-chart-renderer.js';
import { DEBOUNCE_MS } from './tree-chart-config.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

export function initTreeChartView(containerEl) {
  if (!containerEl) {
    console.error('[tree-chart] container element missing');
    return null;
  }

  const svg = document.createElementNS(SVG_NS, 'svg');
  containerEl.appendChild(svg);
  const renderer = new TreeChartRenderer(svg);

  const state = {
    dirty: true,
    visible: !containerEl.classList.contains('hidden'),
    debounceTimer: null,
    highlightedId: null,
    isPanning: false,
    panStart: null,
    baseVbWidth: null
  };

  function getPersonData() {
    return window.treeCore?.personData || new Map();
  }

  function getLineOnlyConnections() {
    const conns = window.treeCore?.renderer?.connections || [];
    return conns.filter(c => c.type === 'lineOnly');
  }

  function getParkingLabel() {
    return getI18nText('builder.tree_chart.parking_area', 'No relation defined');
  }

  function getI18nText(key, fallback) {
    if (typeof window.t === 'function') {
      try { return window.t(key) || fallback; } catch { /* */ }
    }
    return fallback;
  }

  function rebuild() {
    state.dirty = false;
    const personData = getPersonData();
    const clans = detectClans(personData);
    const clanColors = assignClanColors(clans.clanSizes);
    const lineOnlyConnections = getLineOnlyConnections();
    const layout = runLayout(personData, {
      hasLineOnly: new Set(lineOnlyConnections.flatMap(c => [c.from, c.to])),
      clanData: clans,
      lineOnlyConnections
    });
    renderer.render(layout, personData, clanColors, getParkingLabel());
    state.baseVbWidth = svg.viewBox.baseVal.width || null;

    if (state.highlightedId && personData.has(state.highlightedId)) {
      renderer.applyHighlight(computeBloodLine(state.highlightedId, personData));
    } else {
      state.highlightedId = null;
      renderer.applyHighlight(null);
    }
  }

  function scheduleRebuild() {
    if (!state.visible) {
      state.dirty = true;
      return;
    }
    if (state.debounceTimer) clearTimeout(state.debounceTimer);
    state.debounceTimer = setTimeout(rebuild, DEBOUNCE_MS);
  }

  // EventBus subscriptions — use actual event names from event-bus.js
  const bus = appContext.getEventBus();
  const dataEvents = [
    EVENTS.TREE_PERSON_ADDED,
    EVENTS.TREE_PERSON_UPDATED,
    EVENTS.TREE_PERSON_DELETED,
    EVENTS.TREE_RELATIONSHIP_ADDED,
    EVENTS.TREE_RELATIONSHIP_REMOVED,
    EVENTS.TREE_LOADED
  ].filter(Boolean);
  for (const e of dataEvents) bus.on(e, scheduleRebuild);

  // Visibility tracking via custom event from setView in builder.astro
  document.addEventListener('view:changed', (ev) => {
    const { name } = ev.detail || {};
    state.visible = (name === 'treeChart');
    if (state.visible && state.dirty) rebuild();
  });

  // ARIA-live announcer
  const liveRegion = document.createElement('div');
  liveRegion.setAttribute('aria-live', 'polite');
  liveRegion.setAttribute('class', 'tc-live-region');
  containerEl.appendChild(liveRegion);

  function announceHighlight(personId, line) {
    if (!personId) {
      liveRegion.textContent = getI18nText('builder.tree_chart.highlight_cleared', 'Highlight cleared');
      return;
    }
    const personData = getPersonData();
    const p = personData.get(personId);
    if (!p) return;
    const ancestors = countAncestors(personId, personData);
    const descendants = line.size - ancestors - 1;
    const fullName = [p.name, p.surname].filter(Boolean).join(' ').trim() || p.id;
    const template = getI18nText('builder.tree_chart.lineage_announce',
      "Showing {name}'s lineage: {ancestors} ancestors, {descendants} descendants");
    liveRegion.textContent = template
      .replace('{name}', fullName)
      .replace('{ancestors}', String(ancestors))
      .replace('{descendants}', String(descendants));
  }

  function countAncestors(personId, personData) {
    const seen = new Set();
    const stack = [personId];
    while (stack.length) {
      const id = stack.pop();
      const p = personData.get(id);
      if (!p) continue;
      for (const parentId of [p.fatherId, p.motherId]) {
        if (parentId && personData.has(parentId) && !seen.has(parentId)) {
          seen.add(parentId);
          stack.push(parentId);
        }
      }
    }
    return seen.size;
  }

  // Click handlers
  svg.addEventListener('click', (ev) => {
    const nodeEl = ev.target.closest('.tc-node');
    if (nodeEl) {
      const personId = nodeEl.dataset.personId;
      if (state.highlightedId === personId) {
        state.highlightedId = null;
        renderer.applyHighlight(null);
        announceHighlight(null);
      } else {
        state.highlightedId = personId;
        const line = computeBloodLine(personId, getPersonData());
        renderer.applyHighlight(line);
        announceHighlight(personId, line);
      }
    } else {
      if (state.highlightedId) {
        state.highlightedId = null;
        renderer.applyHighlight(null);
        announceHighlight(null);
      }
    }
  });

  svg.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape' && state.highlightedId) {
      state.highlightedId = null;
      renderer.applyHighlight(null);
      announceHighlight(null);
      return;
    }
    if (ev.key === 'Enter' || ev.key === ' ') {
      const nodeEl = ev.target.closest && ev.target.closest('.tc-node');
      if (nodeEl) {
        ev.preventDefault();
        nodeEl.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      }
    }
  });

  // Pan via drag
  svg.addEventListener('mousedown', (ev) => {
    if (ev.target.closest('.tc-node')) return;
    state.isPanning = true;
    // Copy primitives — svg.viewBox.baseVal is a live SVGRect that mutates on setAttribute
    const b = svg.viewBox.baseVal;
    state.panStart = { x: ev.clientX, y: ev.clientY, vbX: b.x, vbY: b.y, vbW: b.width, vbH: b.height };
  });
  window.addEventListener('mousemove', (ev) => {
    if (!state.isPanning) return;
    const { vbX, vbY, vbW, vbH } = state.panStart;
    const rect = svg.getBoundingClientRect();
    // preserveAspectRatio="meet" uses min(rect.w/vbW, rect.h/vbH) as the render scale,
    // so both axes must use the same SVG-to-screen ratio (the max) to avoid asymmetric panning.
    const s = Math.max(vbW / rect.width, vbH / rect.height);
    const dx = (ev.clientX - state.panStart.x) * s;
    const dy = (ev.clientY - state.panStart.y) * s;
    svg.setAttribute('viewBox', `${vbX - dx} ${vbY - dy} ${vbW} ${vbH}`);
  });
  window.addEventListener('mouseup', () => { state.isPanning = false; });

  // Smooth zoom — accumulate log-scale delta, drain 20% per rAF frame (exponential ease-out)
  let zoomLogAccum = 0;
  let zoomOriginX = 0, zoomOriginY = 0; // SVG-space coordinates of zoom focus point
  let zoomRaf = null;

  function applyZoomFrame() {
    zoomRaf = null;
    if (Math.abs(zoomLogAccum) < 0.0005) { zoomLogAccum = 0; return; }
    const step = zoomLogAccum * 0.25;
    zoomLogAccum -= step;
    const factor = Math.exp(step);
    const vb = svg.viewBox.baseVal;
    const newW = vb.width * factor;
    const newH = vb.height * factor;
    const newX = zoomOriginX - (zoomOriginX - vb.x) * factor;
    const newY = zoomOriginY - (zoomOriginY - vb.y) * factor;
    svg.setAttribute('viewBox', `${newX} ${newY} ${newW} ${newH}`);
    zoomRaf = requestAnimationFrame(applyZoomFrame);
  }

  svg.addEventListener('wheel', (ev) => {
    ev.preventDefault();
    const normalized = ev.deltaMode === 1 ? ev.deltaY * 20 :
                       ev.deltaMode === 2 ? ev.deltaY * 400 : ev.deltaY;
    // SVG viewBox: larger = zoomed out, so sign is opposite to canvas scale
    zoomLogAccum = Math.max(-2, Math.min(2, zoomLogAccum + normalized * 0.005));
    const rect = svg.getBoundingClientRect();
    const vb = svg.viewBox.baseVal;
    zoomOriginX = vb.x + ((ev.clientX - rect.left) / rect.width) * vb.width;
    zoomOriginY = vb.y + ((ev.clientY - rect.top) / rect.height) * vb.height;
    if (!zoomRaf) zoomRaf = requestAnimationFrame(applyZoomFrame);
  }, { passive: false });

  function zoom(direction) {
    const vb = svg.viewBox.baseVal;
    if (!vb.width) return;
    zoomOriginX = vb.x + vb.width / 2;
    zoomOriginY = vb.y + vb.height / 2;
    // direction: -1 = zoom in (shrink viewBox), +1 = zoom out (grow viewBox)
    zoomLogAccum = Math.max(-2, Math.min(2, zoomLogAccum + direction * 0.5));
    if (!zoomRaf) zoomRaf = requestAnimationFrame(applyZoomFrame);
  }

  function getZoomPercent() {
    const currentW = svg.viewBox.baseVal.width;
    if (!state.baseVbWidth || !currentW) return 100;
    return Math.round(state.baseVbWidth / currentW * 100);
  }

  if (state.visible) rebuild();

  const api = { rebuild, zoom, getZoomPercent };
  window._treeChartView = api;
  return api;
}
