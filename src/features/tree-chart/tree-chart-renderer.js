// tree-chart-renderer.js — Diff-based SVG DOM construction

import { SecurityUtils } from '../../utils/security-utils.js';
import { TRANSITION_MS } from './tree-chart-config.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

export class TreeChartRenderer {
  constructor(svgElement) {
    this.svg = svgElement;
    this.svg.setAttribute('xmlns', SVG_NS);
    this.svg.setAttribute('class', 'tc-svg');

    this.edgeLayer = this._g('tc-edges');
    this.nodeLayer = this._g('tc-nodes');
    this.parkingDivider = this._g('tc-parking-divider');
    this.svg.appendChild(this.edgeLayer);
    this.svg.appendChild(this.parkingDivider);
    this.svg.appendChild(this.nodeLayer);

    this._nodeEls = new Map();
    this._edgeEls = new Map();
  }

  _g(className) {
    const g = document.createElementNS(SVG_NS, 'g');
    g.setAttribute('class', className);
    return g;
  }

  render(layout, personData, clanColors, parkingLabel) {
    this._updateViewBox(layout.bounds);
    this._updateNodes(layout.nodes, personData, clanColors);
    this._updateEdges(layout.edges);
    this._updateParkingDivider(layout, parkingLabel);
  }

  _updateViewBox(bounds) {
    const pad = 60;
    const w = Math.max(bounds.maxX - bounds.minX + pad * 2, 1);
    const h = Math.max(bounds.maxY - bounds.minY + pad * 2, 1);
    this.svg.setAttribute('viewBox', `${bounds.minX - pad} ${bounds.minY - pad} ${w} ${h}`);
    this.svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
  }

  _updateNodes(nodes, personData, clanColors) {
    const seen = new Set();

    for (const [id, n] of nodes) {
      seen.add(id);
      let g = this._nodeEls.get(id);
      if (!g) {
        g = this._buildNodeElement(id);
        this.nodeLayer.appendChild(g);
        this._nodeEls.set(id, g);
      }
      this._applyNodeAttributes(g, id, n, personData, clanColors);
    }

    for (const [id, el] of this._nodeEls) {
      if (!seen.has(id)) {
        el.remove();
        this._nodeEls.delete(id);
      }
    }
  }

  _buildNodeElement(personId) {
    const g = document.createElementNS(SVG_NS, 'g');
    g.setAttribute('class', 'tc-node');
    g.setAttribute('tabindex', '0');
    g.setAttribute('role', 'button');
    g.dataset.personId = personId;
    g.style.transition = `transform ${TRANSITION_MS}ms ease-out`;

    const ring = document.createElementNS(SVG_NS, 'rect');
    ring.setAttribute('class', 'tc-node-ring');
    g.appendChild(ring);

    const body = document.createElementNS(SVG_NS, 'rect');
    body.setAttribute('class', 'tc-node-body');
    g.appendChild(body);

    const label = document.createElementNS(SVG_NS, 'text');
    label.setAttribute('class', 'tc-node-label');
    label.setAttribute('text-anchor', 'middle');
    g.appendChild(label);

    return g;
  }

  _applyNodeAttributes(g, id, n, personData, clanColors) {
    g.setAttribute('transform', `translate(${n.x}, ${n.y})`);
    g.classList.toggle('tc-node--parked', !!n.isParked);

    const ring = g.querySelector('.tc-node-ring');
    const body = g.querySelector('.tc-node-body');
    const label = g.querySelector('.tc-node-label');

    body.setAttribute('width', n.width);
    body.setAttribute('height', n.height);
    body.setAttribute('rx', '8');

    ring.setAttribute('x', '-4');
    ring.setAttribute('y', '-4');
    ring.setAttribute('width', n.width + 8);
    ring.setAttribute('height', n.height + 8);
    ring.setAttribute('rx', '12');

    if (n.clanId !== null && clanColors.has(n.clanId)) {
      g.dataset.clan = String(n.clanId);
      g.style.setProperty('--clan-color', clanColors.get(n.clanId));
    } else {
      delete g.dataset.clan;
      g.style.removeProperty('--clan-color');
    }

    const p = personData.get(id) || {};
    const fullName = [p.name, p.surname].filter(Boolean).join(' ').trim() || p.id || '';
    SecurityUtils.setTextContent(label, fullName);
    label.setAttribute('x', n.width / 2);
    label.setAttribute('y', n.height / 2 + 4);

    const genStr = n.generation === null ? 'unassigned' : `generation ${n.generation}`;
    g.setAttribute('aria-label', `${fullName}, ${genStr}, click to highlight lineage`);
  }

  _updateEdges(edges) {
    const seen = new Set();
    for (const e of edges) {
      const key = `${e.fromId}|${e.toId}|${e.type}`;
      seen.add(key);
      let el = this._edgeEls.get(key);
      if (!el) {
        el = e.type === 'spouse' ? this._buildSpouseEdge(e) : this._buildPathEdge(e);
        this.edgeLayer.appendChild(el);
        this._edgeEls.set(key, el);
      }
      if (e.type === 'spouse') {
        el.querySelector('path').setAttribute('d', e.path);
        const dot = el.querySelector('circle');
        dot.setAttribute('cx', e.dotX);
        dot.setAttribute('cy', e.dotY);
      } else {
        el.setAttribute('d', e.path);
      }
    }
    for (const [key, el] of this._edgeEls) {
      if (!seen.has(key)) {
        el.remove();
        this._edgeEls.delete(key);
      }
    }
  }

  _buildPathEdge(e) {
    const path = document.createElementNS(SVG_NS, 'path');
    const edgeClass = e.type === 'familyDrop' ? 'parent' : e.type;
    path.setAttribute('class', `tc-edge tc-edge--${edgeClass}`);
    path.setAttribute('fill', 'none');
    path.dataset.fromId = e.fromId;
    if (e.fromId2) path.dataset.fromId2 = e.fromId2;
    path.dataset.toId = e.toId;
    return path;
  }

  _buildSpouseEdge(e) {
    const g = document.createElementNS(SVG_NS, 'g');
    g.setAttribute('class', 'tc-edge tc-edge--spouse');
    g.dataset.fromId = e.fromId;
    g.dataset.toId = e.toId;

    const path = document.createElementNS(SVG_NS, 'path');
    path.setAttribute('fill', 'none');
    g.appendChild(path);

    const circle = document.createElementNS(SVG_NS, 'circle');
    circle.setAttribute('class', 'tc-spouse-dot');
    circle.setAttribute('r', '5');
    g.appendChild(circle);

    return g;
  }

  _updateParkingDivider(layout, parkingLabel) {
    while (this.parkingDivider.firstChild) {
      this.parkingDivider.removeChild(this.parkingDivider.firstChild);
    }
    if (!layout.parking) return;

    const y = layout.parking.y - 30;
    const line = document.createElementNS(SVG_NS, 'line');
    line.setAttribute('class', 'tc-parking-line');
    line.setAttribute('x1', layout.bounds.minX);
    line.setAttribute('x2', layout.bounds.maxX);
    line.setAttribute('y1', y);
    line.setAttribute('y2', y);
    this.parkingDivider.appendChild(line);

    const text = document.createElementNS(SVG_NS, 'text');
    text.setAttribute('class', 'tc-parking-label');
    text.setAttribute('x', layout.bounds.minX);
    text.setAttribute('y', y - 8);
    SecurityUtils.setTextContent(text, parkingLabel);
    this.parkingDivider.appendChild(text);
  }

  applyHighlight(bloodLine) {
    if (!bloodLine) {
      this.svg.classList.remove('tc-has-highlight');
      for (const [, el] of this._nodeEls) el.classList.remove('tc-on-line');
      for (const [, el] of this._edgeEls) el.classList.remove('tc-on-line');
      return;
    }
    this.svg.classList.add('tc-has-highlight');
    for (const [id, el] of this._nodeEls) {
      el.classList.toggle('tc-on-line', bloodLine.has(id));
    }
    for (const [, el] of this._edgeEls) {
      const fromOk = bloodLine.has(el.dataset.fromId) ||
        !!(el.dataset.fromId2 && bloodLine.has(el.dataset.fromId2));
      const toOk = bloodLine.has(el.dataset.toId);
      el.classList.toggle('tc-on-line', fromOk && toOk);
    }
  }
}
