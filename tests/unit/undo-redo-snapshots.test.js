// undo-redo-snapshots.test.js
// Snapshots must be isolated from in-place mutation of live data (both directions).

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { UndoRedoManager } from '../../src/data/cache/core-undoRedo.js';

function makeTreeCore() {
  const personData = new Map([
    ['p1', { id: 'p1', name: 'Anna', marriages: [{ id: 'm1', spouseId: 'p2' }] }],
    ['p2', { id: 'p2', name: 'Boris', marriages: [{ id: 'm1', spouseId: 'p1' }] }]
  ]);
  const rendererNodes = new Map([
    ['p1', { id: 'p1', x: 100, y: 100, marriages: [{ id: 'm1', spouseId: 'p2' }] }],
    ['p2', { id: 'p2', x: 300, y: 100, marriages: [{ id: 'm1', spouseId: 'p1' }] }]
  ]);
  return {
    personData,
    hiddenConnections: new Set(),
    lineOnlyConnections: new Set(),
    displayPreferences: { showMaidenName: true },
    nodeStyle: 'circle',
    nodeRadius: 50,
    defaultColor: '#3498db',
    fontFamily: 'Inter',
    fontSize: 11,
    nameColor: '#ffffff',
    dateColor: '#f0f0f0',
    enhancedCacheIndicator: null,
    autoSave: vi.fn(),
    updateRendererSettings: vi.fn(),
    regenerateConnections: vi.fn(),
    clearSelection: vi.fn(),
    renderer: {
      nodes: rendererNodes,
      settings: {},
      getCamera: () => ({ x: 0, y: 0, scale: 1 }),
      setCamera: vi.fn(),
      setNode(id, data) { rendererNodes.set(id, data); }
    }
  };
}

describe('UndoRedoManager snapshot isolation', () => {
  let tc, mgr;

  beforeEach(() => {
    // restoreState writes .value on these style inputs without null checks
    document.body.textContent = '';
    for (const id of ['nodeColorPicker', 'nodeSizeInput', 'fontSelect',
                      'fontSizeInput', 'nameColorPicker', 'dateColorPicker']) {
      const el = document.createElement(id === 'fontSelect' ? 'select' : 'input');
      el.id = id;
      document.body.appendChild(el);
    }
    tc = makeTreeCore();
    mgr = new UndoRedoManager(tc, { info: vi.fn() });
  });

  it('in-place mutation of a person after push does not alter the snapshot', () => {
    mgr.pushUndoState();
    const spouse = tc.personData.get('p2');
    spouse.marriages = [{ id: 'm9', spouseId: 'p3' }]; // the marriage-sync mutation path
    const snap = mgr.undoStack[0];
    expect(snap.personData.get('p2').marriages).toEqual([{ id: 'm1', spouseId: 'p1' }]);
  });

  it('mutating live data after restore does not alter the stored snapshot', () => {
    mgr.pushUndoState();               // state A
    tc.personData.get('p1').name = 'Anna Edited';
    mgr.pushUndoState();               // state B
    mgr.undo();                        // live data now restored from state A
    tc.personData.get('p1').name = 'Corrupted';
    const stateA = mgr.undoStack[0];
    expect(stateA.personData.get('p1').name).toBe('Anna');
  });

  it('renderer node snapshots are isolated from nested mutation', () => {
    mgr.pushUndoState();
    tc.renderer.nodes.get('p1').marriages[0].spouseId = 'p9';
    expect(mgr.undoStack[0].nodes.get('p1').marriages[0].spouseId).toBe('p2');
  });
});
