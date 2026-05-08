// tree-chart-renderer.js — Diff-based SVG DOM construction

import { SecurityUtils } from '../../utils/security-utils.js';
import { TRANSITION_MS } from './tree-chart-config.js';
import { formatLifespanShort, formatDateValue } from '../../utils/date-value.js';

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
    this._personData = personData;
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

    const sublabel = document.createElementNS(SVG_NS, 'text');
    sublabel.setAttribute('class', 'tc-node-sublabel');
    sublabel.setAttribute('text-anchor', 'middle');
    g.appendChild(sublabel);

    return g;
  }

  _applyNodeAttributes(g, id, n, personData, clanColors) {
    g.setAttribute('transform', `translate(${n.x}, ${n.y})`);
    g.classList.toggle('tc-node--parked', !!n.isParked);

    const ring = g.querySelector('.tc-node-ring');
    const body = g.querySelector('.tc-node-body');
    const label = g.querySelector('.tc-node-label');
    const sublabel = g.querySelector('.tc-node-sublabel');

    body.setAttribute('width', n.width);
    body.setAttribute('height', n.height);
    body.setAttribute('rx', '10');

    ring.setAttribute('x', '-4');
    ring.setAttribute('y', '-4');
    ring.setAttribute('width', n.width + 8);
    ring.setAttribute('height', n.height + 8);
    ring.setAttribute('rx', '14');

    const p = personData.get(id) || {};
    const fullName = [p.name, p.surname].filter(Boolean).join(' ').trim() || p.id || '';
    const locale = (window.i18n?.currentLocale || 'en').slice(0, 2);
    const lifespan = formatLifespanShort(p.birth?.date, p.death?.date, locale);

    // Color class: non-primary clans get a preset palette; primary clan uses gender-based default.
    const clanClass = clanColors.get(n.clanId);
    g.classList.remove('c-purple', 'c-teal', 'c-gray', 'c-coral', 'c-green', 'c-amber');
    if (clanClass) {
      g.classList.add(clanClass);
    } else {
      if (p.gender === 'male') g.classList.add('c-purple');
      else if (p.gender === 'female') g.classList.add('c-teal');
      else g.classList.add('c-gray');
    }

    const cx = n.width / 2;
    SecurityUtils.setTextContent(label, fullName);
    label.setAttribute('x', cx);

    if (lifespan) {
      label.setAttribute('y', n.height / 2 - 2);
      SecurityUtils.setTextContent(sublabel, lifespan);
      sublabel.setAttribute('x', cx);
      sublabel.setAttribute('y', n.height / 2 + 13);
    } else {
      label.setAttribute('y', n.height / 2 + 5);
      SecurityUtils.setTextContent(sublabel, '');
    }

    const genStr = n.generation === null ? 'unassigned' : `generation ${n.generation}`;
    g.setAttribute('aria-label', `${fullName}, ${genStr}, click to highlight lineage, double-click to edit`);
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
        const symBg = el.querySelector('.tc-spouse-symbol-bg');
        symBg.setAttribute('x', e.dotX - 11);
        symBg.setAttribute('y', e.dotY - 10);
        const sym = el.querySelector('.tc-spouse-symbol');
        sym.setAttribute('x', e.dotX);
        sym.setAttribute('y', e.dotY);

        const marriageLabel = el.querySelector('.tc-spouse-date-label');
        if (marriageLabel && this._personData) {
          const locale = (window.i18n?.currentLocale || 'en').slice(0, 2);
          const fromPerson = this._personData.get(e.fromId);
          const toPerson = this._personData.get(e.toId);
          const marriage = (fromPerson?.marriages || []).find((m) => m.spouseId === e.toId)
            || (toPerson?.marriages || []).find((m) => m.spouseId === e.fromId);
          if (marriage?.date?.year) {
            const text = formatDateValue({ year: marriage.date.year, estimated: !!marriage.date.estimated }, locale);
            SecurityUtils.setTextContent(marriageLabel, text);
            marriageLabel.setAttribute('x', e.dotX);
            marriageLabel.setAttribute('y', e.dotY + 24);
          } else {
            SecurityUtils.setTextContent(marriageLabel, '');
          }
        }
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

    const symBg = document.createElementNS(SVG_NS, 'rect');
    symBg.setAttribute('class', 'tc-spouse-symbol-bg');
    symBg.setAttribute('width', '22');
    symBg.setAttribute('height', '20');
    symBg.setAttribute('rx', '3');
    g.appendChild(symBg);

    const sym = document.createElementNS(SVG_NS, 'text');
    sym.setAttribute('class', 'tc-spouse-symbol');
    sym.setAttribute('text-anchor', 'middle');
    sym.setAttribute('dominant-baseline', 'central');
    sym.textContent = '⚭';
    g.appendChild(sym);

    const marriageLabel = document.createElementNS(SVG_NS, 'text');
    marriageLabel.setAttribute('class', 'tc-spouse-date-label');
    marriageLabel.setAttribute('text-anchor', 'middle');
    marriageLabel.setAttribute('dominant-baseline', 'central');
    g.appendChild(marriageLabel);

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
