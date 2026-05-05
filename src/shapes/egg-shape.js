/**
 * EggShape - Asymmetric oval, slightly wider at the bottom than the top.
 *
 * w(t) = sin(π·t)^0.55 · (1 + 0.18·sin(π·t)·(2t - 1))
 *   - top-bottom symmetric oval base (sin^0.55)
 *   - asymmetry term tilts the widest point toward the bottom (~t=0.6)
 */

import { EnvelopeShape } from './envelope-shape.js';

export class EggShape extends EnvelopeShape {
    constructor(treeCore, options = {}) {
        super(treeCore, options);
    }

    getSilhouette(t) {
        const base = Math.pow(Math.sin(Math.PI * t), 0.55);
        const skew = 1 + 0.18 * Math.sin(Math.PI * t) * (2 * t - 1);
        return Math.max(0, base * skew);
    }

    getAspectRatio() {
        return 1.35;
    }

    static getDisplayName() {
        return 'Egg';
    }

    static getDescription() {
        return 'Arranges family members in a classic egg / ovate shape.';
    }
}
