/**
 * DiamondShape - Family tree in a rhombus / diamond outline.
 *
 * w(t) = 1 - |2t - 1|     // linear taper to point at top and bottom
 */

import { EnvelopeShape } from './envelope-shape.js';

export class DiamondShape extends EnvelopeShape {
    constructor(treeCore, options = {}) {
        super(treeCore, options);
    }

    getSilhouette(t) {
        return Math.max(0, 1 - Math.abs(2 * t - 1));
    }

    getAspectRatio() {
        return 1.2;
    }

    static getDisplayName() {
        return 'Diamond';
    }

    static getDescription() {
        return 'Arranges family members in a diamond / rhombus shape.';
    }
}
