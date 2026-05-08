import { describe, it, expect, vi, beforeEach } from 'vitest';

const { emitMock, onMock } = vi.hoisted(() => ({
  emitMock: vi.fn(),
  onMock: vi.fn()
}));

vi.mock('../../../src/utils/event-bus.js', () => ({
  appContext: {
    getEventBus: () => ({ emit: emitMock, on: onMock })
  },
  EVENTS: {
    TREE_PERSON_ADDED: 'tree:person:added',
    TREE_PERSON_UPDATED: 'tree:person:updated',
    TREE_PERSON_DELETED: 'tree:person:deleted',
    TREE_RELATIONSHIP_ADDED: 'tree:relationship:added',
    TREE_RELATIONSHIP_REMOVED: 'tree:relationship:removed',
    TREE_LOADED: 'tree:loaded',
    TREE_NODE_EDIT_REQUESTED: 'tree:node:edit:requested'
  }
}));

vi.mock('../../../src/features/tree-chart/tree-chart-renderer.js', () => ({
  TreeChartRenderer: vi.fn().mockImplementation(() => ({
    render: vi.fn(),
    applyHighlight: vi.fn()
  }))
}));
vi.mock('../../../src/features/tree-chart/tree-chart-layout.js', () => ({
  runLayout: vi.fn().mockReturnValue({ nodes: [], edges: [] })
}));
vi.mock('../../../src/features/tree-chart/tree-chart-clans.js', () => ({
  detectClans: vi.fn().mockReturnValue({ clanSizes: new Map() }),
  assignClanColors: vi.fn().mockReturnValue(new Map())
}));
vi.mock('../../../src/features/tree-chart/tree-chart-highlight.js', () => ({
  computeBloodLine: vi.fn().mockReturnValue(new Set())
}));
vi.mock('../../../src/features/tree-chart/tree-chart-config.js', () => ({
  DEBOUNCE_MS: 0
}));

import { initTreeChartView } from '../../../src/features/tree-chart/tree-chart-view.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

describe('tree-chart-view dblclick', () => {
  let container;
  let svg;

  beforeEach(() => {
    emitMock.mockClear();
    onMock.mockClear();
    container = document.createElement('div');
    container.classList.add('hidden');
    document.body.appendChild(container);
    initTreeChartView(container);
    svg = container.querySelector('svg');
  });

  it('emits TREE_NODE_EDIT_REQUESTED with personId when a node is double-clicked', () => {
    const node = document.createElementNS(SVG_NS, 'g');
    node.classList.add('tc-node');
    node.dataset.personId = 'person-abc';
    svg.appendChild(node);

    node.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));

    expect(emitMock).toHaveBeenCalledWith(
      'tree:node:edit:requested',
      { personId: 'person-abc' }
    );
  });

  it('does not emit TREE_NODE_EDIT_REQUESTED when SVG background is double-clicked', () => {
    svg.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));

    const editCalls = emitMock.mock.calls.filter(
      ([name]) => name === 'tree:node:edit:requested'
    );
    expect(editCalls).toHaveLength(0);
  });
});
