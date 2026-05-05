/**
 * HeartShape - Family tree in a heart silhouette.
 *
 * Two-region: left lobe + right lobe combined into a continuous w(t) that
 * accounts for the V-notch at the top and the point at the bottom.
 *
 * w(t) is derived from the heart curve: x² + (y - cbrt(x²))² = 1
 * but discretized for horizontal slicing.
 */

import { EnvelopeShape } from './envelope-shape.js';

export class HeartShape extends EnvelopeShape {
    constructor(treeCore, options = {}) {
        super(treeCore, options);
    }

    getSilhouette(t) {
        // Top zone (V-notch): two lobes peak at sides.
        // We approximate with a function that:
        //  - rises sharply from 0 at t=0 (center of V) to ~1.0 at t≈0.18 (lobe peak)
        //  - peaks just below t=0.3 at the widest point
        //  - tapers to 0 at t=1 (heart's bottom point)
        if (t <= 0.04) return Math.max(0, t / 0.04 * 0.5);

        const lobeRise = Math.min(1, t / 0.18);
        const lobeShape = Math.pow(lobeRise, 0.7);

        const taper = Math.pow(1 - Math.max(0, (t - 0.25) / 0.75), 0.6);

        return Math.max(0, lobeShape * taper);
    }

    getAspectRatio() {
        return 0.95;
    }

    static getDisplayName() {
        return 'Heart';
    }

    static getDescription() {
        return 'Arranges family members in a heart shape.';
    }
}
