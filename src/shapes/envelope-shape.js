/**
 * EnvelopeShape - Generic envelope-based circle packer.
 *
 * Subclasses define the silhouette as either:
 *   - getSilhouette(t): single-region shape, w(t) ∈ [0,1] for t ∈ [0,1]
 *   - getRegions(): multi-region shape, returns array of region descriptors
 *
 * The packer:
 *   1. Sorts people deterministically by id.
 *   2. Allocates nodes to regions (by absolute count or proportional weight).
 *   3. For each region, runs hex-pack horizontal row packing inside the silhouette.
 *   4. Centers the whole formation around (centerX, centerY).
 *
 * Pure visual layout — does NOT use genealogy. For genealogy-based shapes
 * (Solar System, Tree Branches), use BaseShape directly.
 */

import { BaseShape } from './base-shape.js';

const SIMPSON_INTERVALS = 32;
// cellH = cellW (square pitch). True hex packing (sqrt(3)/2) gives a denser
// look but breaks down when adjacent rows have different node counts —
// independently-centered rows can leave two circles vertically aligned at
// distance cellW * sqrt(3)/2 ≈ 0.866·cellW, which is < 2·radius. Square pitch
// guarantees min center distance = cellW = 2r + padding, which never overlaps.
const ROW_PITCH_FACTOR = 1.0;
const TAPER_THRESHOLD = 0.04;
const PACK_EFFICIENCY = 0.78;

export class EnvelopeShape extends BaseShape {
    constructor(treeCore, options = {}) {
        super(treeCore, {
            nodeRadius: 50,
            nodePadding: 8,
            sizeScale: 1.0,
            ...options
        });
    }

    /**
     * Subclasses MAY override to provide multi-region layout.
     * Default: single region using getSilhouette() and getAspectRatio().
     */
    getRegions() {
        return [{
            silhouette: (t) => this.getSilhouette(t),
            aspectRatio: this.getAspectRatio(),
            weight: 1.0,
            offset: { x: 0, y: 0 }
        }];
    }

    /**
     * Width of shape at relative height t ∈ [0,1]. Returns value in [0,1].
     * Default: simple oval (sin curve).
     */
    getSilhouette(t) {
        return Math.sin(Math.PI * t);
    }

    /**
     * Height / width ratio of the shape's bounding box.
     */
    getAspectRatio() {
        return 1.0;
    }

    async calculatePositions(people) {
        const positions = new Map();
        if (people.length === 0) return positions;

        const sorted = [...people].sort((a, b) =>
            String(a.id).localeCompare(String(b.id))
        );

        const regions = this.getRegions();
        const allocations = this._allocateNodesToRegions(sorted.length, regions);

        const regionData = regions.map((region, i) => ({
            region,
            slots: this._packRegion(allocations[i], region)
        }));

        const bboxes = regionData.map(rd => this._slotsBbox(rd.slots));
        const offsets = this._resolveRegionOffsets(regions, bboxes);

        let personIndex = 0;
        regionData.forEach((rd, i) => {
            const slots = rd.slots;
            const offset = offsets[i];
            const regionPeople = sorted.slice(personIndex, personIndex + slots.length);
            personIndex += slots.length;

            regionPeople.forEach((person, j) => {
                const slot = slots[j] || { x: 0, y: 0 };
                const entry = {
                    x: slot.x + offset.x,
                    y: slot.y + offset.y,
                    regionIndex: i,
                    nodeIndex: j
                };
                const color = this.getNodeColor(i, j);
                if (color !== null) entry.color = color;
                positions.set(person.id, entry);
            });
        });

        this.centerPositions(positions, this.options.centerX, this.options.centerY);
        return positions;
    }

    _slotsBbox(slots) {
        if (slots.length === 0) {
            return { minX: 0, maxX: 0, minY: 0, maxY: 0 };
        }
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        for (const s of slots) {
            if (s.x < minX) minX = s.x;
            if (s.x > maxX) maxX = s.x;
            if (s.y < minY) minY = s.y;
            if (s.y > maxY) maxY = s.y;
        }
        return { minX, maxX, minY, maxY };
    }

    /**
     * For each region, resolve a final {x, y} offset.
     *
     * A region may specify:
     *   - offset: {x, y}             → absolute placement (rare)
     *   - placement: {anchor: 'above'|'below'|'left'|'right',
     *                 relativeTo: <region index>,
     *                 gap: <pixels>,
     *                 dx, dy: <perpendicular nudge>}
     *   - neither                    → centered at origin (0,0)
     */
    _resolveRegionOffsets(regions, bboxes) {
        const offsets = regions.map(() => ({ x: 0, y: 0 }));

        // Minimum guaranteed separation between any two slots across regions.
        // Slot bboxes only track centers, not radii, so we offset by cellW to
        // ensure at least one cell of clearance between nearest pairs.
        const cellW = 2 * this.options.nodeRadius + this.options.nodePadding;

        regions.forEach((region, i) => {
            if (region.offset) {
                offsets[i] = { x: region.offset.x, y: region.offset.y };
                return;
            }
            if (!region.placement) return;

            const placement = region.placement;
            const refIdx = placement.relativeTo ?? 0;
            const refBox = bboxes[refIdx];
            const refOff = offsets[refIdx];
            const ownBox = bboxes[i];
            const gap = placement.gap ?? 0;
            const dx = placement.dx ?? 0;
            const dy = placement.dy ?? 0;

            const ownCenterX = (ownBox.minX + ownBox.maxX) / 2;
            const ownCenterY = (ownBox.minY + ownBox.maxY) / 2;
            const refCenterX = (refBox.minX + refBox.maxX) / 2;
            const refCenterY = (refBox.minY + refBox.maxY) / 2;

            switch (placement.anchor) {
                case 'above':
                    offsets[i].x = refOff.x + refCenterX + dx - ownCenterX;
                    offsets[i].y = refOff.y + refBox.minY - ownBox.maxY - cellW - gap + dy;
                    break;
                case 'below':
                    offsets[i].x = refOff.x + refCenterX + dx - ownCenterX;
                    offsets[i].y = refOff.y + refBox.maxY - ownBox.minY + cellW + gap + dy;
                    break;
                case 'left':
                    offsets[i].x = refOff.x + refBox.minX - ownBox.maxX - cellW - gap + dx;
                    offsets[i].y = refOff.y + refCenterY + dy - ownCenterY;
                    break;
                case 'right':
                    offsets[i].x = refOff.x + refBox.maxX - ownBox.minX + cellW + gap + dx;
                    offsets[i].y = refOff.y + refCenterY + dy - ownCenterY;
                    break;
            }
        });

        return offsets;
    }

    /**
     * Allocate N nodes to regions. Each region declares either an absolute
     * `count` (preferred) or a proportional `weight`. Absolute counts are
     * deducted first, remainder distributed by weight.
     */
    _allocateNodesToRegions(N, regions) {
        const allocations = new Array(regions.length).fill(0);
        let remaining = N;

        regions.forEach((region, i) => {
            if (Number.isFinite(region.count) && region.count > 0) {
                const take = Math.min(region.count, remaining);
                allocations[i] = take;
                remaining -= take;
            }
        });

        const weighted = regions
            .map((region, i) => ({ i, weight: region.count ? 0 : (region.weight || 0) }))
            .filter(r => r.weight > 0);

        if (weighted.length === 0 || remaining === 0) return allocations;

        const totalWeight = weighted.reduce((s, r) => s + r.weight, 0);
        const fractions = weighted.map(r => ({
            i: r.i,
            exact: remaining * r.weight / totalWeight
        }));
        fractions.forEach(f => {
            allocations[f.i] = Math.floor(f.exact);
        });

        let leftover = remaining - fractions.reduce((s, f) => s + Math.floor(f.exact), 0);
        const sortedByFrac = [...fractions].sort((a, b) =>
            (b.exact - Math.floor(b.exact)) - (a.exact - Math.floor(a.exact))
        );
        let idx = 0;
        while (leftover > 0 && sortedByFrac.length > 0) {
            allocations[sortedByFrac[idx % sortedByFrac.length].i]++;
            leftover--;
            idx++;
        }

        return allocations;
    }

    /**
     * Pack `count` nodes into a region using hex row packing inside the silhouette.
     */
    _packRegion(count, region) {
        if (count === 0) return [];

        const r = this.options.nodeRadius;
        const p = this.options.nodePadding;
        const cellW = 2 * r + p;
        const cellH = cellW * ROW_PITCH_FACTOR;
        const aspectRatio = region.aspectRatio || 1.0;
        const scale = this.options.sizeScale;
        const silhouette = region.silhouette;

        const integral = this._integrateSilhouette(silhouette);
        if (integral <= 0) return [];

        const targetArea = count * cellW * cellW / PACK_EFFICIENCY;
        let W = Math.sqrt(targetArea / (integral * aspectRatio)) * scale;
        let H = W * aspectRatio;
        let R = Math.max(1, Math.round(H / cellH));

        let rowCaps = [];
        for (let attempt = 0; attempt < 24; attempt++) {
            rowCaps = this._computeRowCaps(W, R, cellW, silhouette);
            const totalCap = rowCaps.reduce((s, c) => s + c, 0);

            if (totalCap >= count && totalCap <= count * 1.5) break;

            const ratio = totalCap > 0 ? count / totalCap : 2;
            W *= Math.sqrt(ratio) * (totalCap < count ? 1.04 : 0.98);
            H = W * aspectRatio;
            R = Math.max(1, Math.round(H / cellH));
        }

        rowCaps = this._computeRowCaps(W, R, cellW, silhouette);
        const rowCounts = this._distributeNodesAcrossRows(count, rowCaps);

        const slots = [];
        const totalH = R * cellH;

        for (let i = 0; i < R; i++) {
            const n = rowCounts[i];
            if (n === 0) continue;

            const xStep = cellW;
            const span = (n - 1) * xStep;
            const hexOffset = (n > 1 && i % 2 === 1) ? xStep / 2 : 0;
            const startX = -span / 2 + hexOffset;
            const y = i * cellH - totalH / 2;

            for (let k = 0; k < n; k++) {
                slots.push({ x: startX + k * xStep, y });
            }
        }

        // Center slots so the region's natural bbox is at (0, 0).
        // This makes placement math (above/below/left/right) consistent
        // even when not all rows ended up with nodes.
        if (slots.length > 0) {
            let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
            for (const s of slots) {
                if (s.x < minX) minX = s.x;
                if (s.x > maxX) maxX = s.x;
                if (s.y < minY) minY = s.y;
                if (s.y > maxY) maxY = s.y;
            }
            const cx = (minX + maxX) / 2;
            const cy = (minY + maxY) / 2;
            for (const s of slots) { s.x -= cx; s.y -= cy; }
        }

        return slots;
    }

    _computeRowCaps(W, R, cellW, silhouette) {
        const caps = [];
        for (let i = 0; i < R; i++) {
            const t = R === 1 ? 0.5 : i / (R - 1);
            const sw = silhouette(t);
            const rawCap = Math.floor(W * sw / cellW);
            const cap = sw > TAPER_THRESHOLD ? Math.max(1, rawCap) : 0;
            caps.push(cap);
        }
        return caps;
    }

    /**
     * Distribute N nodes across rows proportional to row capacities.
     * Overflow (N > total capacity) goes to the widest rows so the shape
     * still looks correct, just denser.
     */
    _distributeNodesAcrossRows(N, rowCaps) {
        const totalCap = rowCaps.reduce((s, c) => s + c, 0);
        if (totalCap === 0) return rowCaps.map(() => 0);

        const exact = rowCaps.map(c => N * c / totalCap);
        const counts = exact.map(e => Math.floor(e));
        let remaining = N - counts.reduce((s, c) => s + c, 0);

        const fracs = exact
            .map((e, i) => ({ i, frac: e - Math.floor(e), cap: rowCaps[i] }))
            .sort((a, b) => b.frac - a.frac);

        let idx = 0;
        while (remaining > 0 && idx < fracs.length * 4) {
            const slot = fracs[idx % fracs.length];
            if (counts[slot.i] < slot.cap) {
                counts[slot.i]++;
                remaining--;
            }
            idx++;
        }

        while (remaining > 0) {
            let widest = 0;
            for (let i = 1; i < rowCaps.length; i++) {
                if (rowCaps[i] > rowCaps[widest]) widest = i;
            }
            counts[widest]++;
            remaining--;
        }

        return counts;
    }

    _integrateSilhouette(fn) {
        const n = SIMPSON_INTERVALS;
        const h = 1 / n;
        let sum = fn(0) + fn(1);
        for (let i = 1; i < n; i++) {
            sum += (i % 2 === 0 ? 2 : 4) * fn(i * h);
        }
        return Math.max(0, sum * h / 3);
    }

    /**
     * Return a color string for a node in the given region, or null to leave unchanged.
     * Subclasses override to implement per-shape color themes.
     */
    getNodeColor(_regionIndex, _nodeIndex) {
        return null;
    }

    getConfigParameters() {
        return {
            nodeRadius: {
                type: 'number',
                label: 'Node Radius',
                min: 20,
                max: 120,
                default: 50
            },
            nodePadding: {
                type: 'number',
                label: 'Node Padding',
                min: 0,
                max: 30,
                default: 8
            },
            sizeScale: {
                type: 'number',
                label: 'Size Scale',
                min: 1,
                max: 5,
                default: 1
            }
        };
    }
}
