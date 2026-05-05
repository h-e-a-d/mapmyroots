/**
 * TriangleShape - Family tree as an inverted triangle (point at top, wide at bottom)
 * or upright (set inverted: true for point-down).
 *
 * w(t) = t                 // upright: narrow at top, wide at bottom (default)
 * w(t) = 1 - t             // inverted
 */

import { EnvelopeShape } from './envelope-shape.js';

const TRIANGLE_COLORS = [
    '#E65100', '#EF6C00', '#F57C00', '#FF8F00', '#FFA000',
    '#FF8C00', '#FF7043', '#FF6F00', '#BF360C', '#F44336'
];

export class TriangleShape extends EnvelopeShape {
    constructor(treeCore, options = {}) {
        super(treeCore, {
            inverted: false,
            ...options
        });
    }

    getSilhouette(t) {
        return this.options.inverted ? Math.max(0, 1 - t) : Math.max(0, t);
    }

    getAspectRatio() {
        return 1.0;
    }

    getNodeColor(_regionIndex, nodeIndex) {
        return TRIANGLE_COLORS[nodeIndex % TRIANGLE_COLORS.length];
    }

    getConfigParameters() {
        return {
            ...super.getConfigParameters(),
            inverted: {
                type: 'boolean',
                label: 'Inverted',
                default: false
            }
        };
    }

    static getDisplayName() {
        return 'Triangle';
    }

    static getDescription() {
        return 'Arranges family members in a triangle, narrow at top widening downward.';
    }
}
