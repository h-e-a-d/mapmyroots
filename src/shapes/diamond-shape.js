/**
 * DiamondShape - Family tree in a rhombus / diamond outline.
 *
 * w(t) = 1 - |2t - 1|     // linear taper to point at top and bottom
 */

import { EnvelopeShape } from './envelope-shape.js';

const DIAMOND_COLORS = [
    '#0097A7', '#00ACC1', '#00BCD4', '#26C6DA', '#80DEEA',
    '#0288D1', '#039BE5', '#29B6F6', '#4DD0E1', '#00E5FF'
];

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

    getNodeColor(_regionIndex, nodeIndex) {
        return DIAMOND_COLORS[nodeIndex % DIAMOND_COLORS.length];
    }

    static getDisplayName() {
        return 'Diamond';
    }

    static getDescription() {
        return 'Arranges family members in a diamond / rhombus shape.';
    }
}
