import { describe, it, expect } from 'vitest';
import { EnvelopeShape } from '../../../src/shapes/envelope-shape.js';
import { GrapeShape } from '../../../src/shapes/grape-shape.js';
import { AppleShape } from '../../../src/shapes/apple-shape.js';
import { HeartShape } from '../../../src/shapes/heart-shape.js';
import { EggShape } from '../../../src/shapes/egg-shape.js';
import { DiamondShape } from '../../../src/shapes/diamond-shape.js';
import { TriangleShape } from '../../../src/shapes/triangle-shape.js';

const makePeople = (n) =>
    Array.from({ length: n }, (_, i) => ({ id: `p${String(i).padStart(4, '0')}` }));

const makeTreeCore = (people) => ({
    getPeople: () => people
});

const minDistance = (positions, nodeRadius) => {
    const arr = [...positions.values()];
    let min = Infinity;
    for (let i = 0; i < arr.length; i++) {
        for (let j = i + 1; j < arr.length; j++) {
            const dx = arr[i].x - arr[j].x;
            const dy = arr[i].y - arr[j].y;
            const d = Math.sqrt(dx * dx + dy * dy);
            if (d < min) min = d;
        }
    }
    return min;
};

const boundingBox = (positions) => {
    const arr = [...positions.values()];
    const xs = arr.map(p => p.x);
    const ys = arr.map(p => p.y);
    return {
        minX: Math.min(...xs),
        maxX: Math.max(...xs),
        minY: Math.min(...ys),
        maxY: Math.max(...ys),
        width: Math.max(...xs) - Math.min(...xs),
        height: Math.max(...ys) - Math.min(...ys)
    };
};

describe('EnvelopeShape — generic packer', () => {
    it('returns no positions for empty input', async () => {
        const shape = new EnvelopeShape({ getPeople: () => [] });
        const pos = await shape.calculatePositions([]);
        expect(pos.size).toBe(0);
    });

    it('places a single node at the centerpoint', async () => {
        const shape = new EnvelopeShape({ getPeople: () => [] });
        const pos = await shape.calculatePositions(makePeople(1));
        expect(pos.size).toBe(1);
        const p = [...pos.values()][0];
        expect(p.x).toBeCloseTo(0, 5);
        expect(p.y).toBeCloseTo(0, 5);
    });

    it('packs many nodes without overlap (default oval silhouette)', async () => {
        const people = makePeople(60);
        const shape = new EnvelopeShape(makeTreeCore(people));
        const pos = await shape.calculatePositions(people);

        expect(pos.size).toBe(60);

        const r = shape.options.nodeRadius;
        const minDist = minDistance(pos, r);
        // Hex spacing means minimum distance >= 2r (touching). Allow small slack.
        expect(minDist).toBeGreaterThan(2 * r * 0.85);
    });

    it('produces deterministic output for same input', async () => {
        const people = makePeople(40);

        const shape1 = new EnvelopeShape(makeTreeCore(people));
        const shape2 = new EnvelopeShape(makeTreeCore(people));

        const pos1 = await shape1.calculatePositions(people);
        const pos2 = await shape2.calculatePositions(people);

        for (const [id, p] of pos1) {
            const q = pos2.get(id);
            expect(q.x).toBeCloseTo(p.x, 6);
            expect(q.y).toBeCloseTo(p.y, 6);
        }
    });

    it('scales gracefully across a wide range of node counts', async () => {
        for (const n of [1, 5, 25, 100, 500]) {
            const people = makePeople(n);
            const shape = new EnvelopeShape(makeTreeCore(people));
            const pos = await shape.calculatePositions(people);
            expect(pos.size).toBe(n);

            if (n > 1) {
                const r = shape.options.nodeRadius;
                expect(minDistance(pos, r)).toBeGreaterThanOrEqual(2 * r);
            }
        }
    });
});

describe('GrapeShape', () => {
    it('respects body silhouette: width(0) > width(1)', () => {
        expect(GrapeShape.bodySilhouette(0)).toBeGreaterThan(GrapeShape.bodySilhouette(1));
        expect(GrapeShape.bodySilhouette(1)).toBeCloseTo(0, 5);
        expect(GrapeShape.bodySilhouette(0)).toBeCloseTo(1, 5);
    });

    it('places body nodes top-to-bottom by id', async () => {
        const people = makePeople(30);
        const shape = new GrapeShape(makeTreeCore(people));
        const pos = await shape.calculatePositions(people);

        // Body gets first (30 - stemNodes - leafNodes) people.
        // p0000 goes to body row 0 (top), last body person goes to bottom.
        // Stem/leaf decorations live ABOVE the body, but among body-only
        // nodes the ordering should be top-down.
        const bodyCount = 30 - shape.options.stemNodes - shape.options.leafNodes;
        const firstBody = pos.get('p0000');
        const lastBody = pos.get(`p${String(bodyCount - 1).padStart(4, '0')}`);
        expect(firstBody.y).toBeLessThan(lastBody.y);
    });

    it('omits stem/leaf decoration for very small trees', async () => {
        const people = makePeople(5);
        const shape = new GrapeShape(makeTreeCore(people));
        const pos = await shape.calculatePositions(people);

        expect(pos.size).toBe(5);
        // With < decorationThreshold (8) people, stem/leaf are skipped.
        // All nodes should fit in body — bounding box should be close to grape body aspect ratio (~1.35:1 height:width).
        const bb = boundingBox(pos);
        if (bb.width > 0) {
            expect(bb.height / bb.width).toBeGreaterThan(0.5);
        }
    });

    it('handles 100 nodes without overlap', async () => {
        const people = makePeople(100);
        const shape = new GrapeShape(makeTreeCore(people));
        const pos = await shape.calculatePositions(people);

        expect(pos.size).toBe(100);
        const r = shape.options.nodeRadius;
        expect(minDistance(pos, r)).toBeGreaterThanOrEqual(2 * r);
    });

    it('produces a tall-but-not-infinite bounding box (taper, not vertical line)', async () => {
        const people = makePeople(60);
        const shape = new GrapeShape(makeTreeCore(people));
        const pos = await shape.calculatePositions(people);

        const bb = boundingBox(pos);
        expect(bb.width).toBeGreaterThan(0);
        // Aspect ratio (height / width) should be in a sane grape range, NOT a vertical line.
        const ratio = bb.height / bb.width;
        expect(ratio).toBeGreaterThan(1.0);
        expect(ratio).toBeLessThan(6.0);
    });
});

describe('Other envelope shapes — basic sanity', () => {
    const cases = [
        { name: 'Apple', cls: AppleShape, n: 50 },
        { name: 'Heart', cls: HeartShape, n: 40 },
        { name: 'Egg', cls: EggShape, n: 40 },
        { name: 'Diamond', cls: DiamondShape, n: 40 },
        { name: 'Triangle', cls: TriangleShape, n: 40 }
    ];

    for (const { name, cls, n } of cases) {
        it(`${name}: places all nodes without overlap`, async () => {
            const people = makePeople(n);
            const shape = new cls(makeTreeCore(people));
            const pos = await shape.calculatePositions(people);
            expect(pos.size).toBe(n);

            const r = shape.options.nodeRadius;
            expect(minDistance(pos, r)).toBeGreaterThanOrEqual(2 * r);
        });

        it(`${name}: bounding box has finite width and height`, async () => {
            const people = makePeople(n);
            const shape = new cls(makeTreeCore(people));
            const pos = await shape.calculatePositions(people);

            const bb = boundingBox(pos);
            expect(bb.width).toBeGreaterThan(0);
            expect(bb.height).toBeGreaterThan(0);
            expect(Number.isFinite(bb.width)).toBe(true);
            expect(Number.isFinite(bb.height)).toBe(true);
        });
    }
});
