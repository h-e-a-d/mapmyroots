/**
 * AppleShape - Family tree as a round apple with stem and leaf.
 *
 * Body silhouette: a near-circle with very slight indent at top and bottom,
 *   matching the classic apple silhouette.
 *   w(t) = sqrt(1 - (2t - 1)^2) · (1 - 0.06·sin(2π·t))
 */

import { EnvelopeShape } from './envelope-shape.js';

const APPLE_BODY_COLORS = [
    '#C0392B', '#D32F2F', '#B71C1C', '#E53935', '#EF5350',
    '#C62828', '#E74C3C', '#BF360C', '#F44336', '#D50000'
];
const APPLE_STEM_COLORS = ['#5D3A1A', '#7B4F2E', '#6B4020', '#8B5E3C'];
const APPLE_LEAF_COLORS = ['#1B6B2F', '#2E7D32', '#388E3C', '#43A047', '#1B5E20'];

export class AppleShape extends EnvelopeShape {
    constructor(treeCore, options = {}) {
        super(treeCore, {
            stemNodes: 2,
            leafNodes: 2,
            decorationThreshold: 10,
            ...options
        });
    }

    getRegions() {
        const r = this.options.nodeRadius;
        const p = this.options.nodePadding;
        const cellW = 2 * r + p;

        const peopleCount = this.treeCore?.getPeople?.()?.length || 0;
        const useDecoration = peopleCount >= this.options.decorationThreshold;
        const stemCount = useDecoration ? this.options.stemNodes : 0;
        const leafCount = useDecoration ? this.options.leafNodes : 0;

        const regions = [{
            silhouette: AppleShape.bodySilhouette,
            aspectRatio: 0.95,
            weight: 1.0
        }];

        if (stemCount > 0) {
            regions.push({
                silhouette: () => 1.0,
                aspectRatio: Math.max(2, stemCount * 1.5),
                count: stemCount,
                placement: {
                    anchor: 'above',
                    relativeTo: 0,
                    gap: 0,
                    dx: 0
                }
            });
        }

        if (leafCount > 0) {
            regions.push({
                silhouette: AppleShape.leafSilhouette,
                aspectRatio: 0.7,
                count: leafCount,
                placement: {
                    anchor: 'right',
                    relativeTo: stemCount > 0 ? 1 : 0,
                    gap: cellW * 0.2,
                    dy: cellW * 0.1
                }
            });
        }

        return regions;
    }

    static bodySilhouette(t) {
        const ellipse = Math.sqrt(Math.max(0, 1 - Math.pow(2 * t - 1, 2)));
        const indent = 1 - 0.06 * Math.sin(2 * Math.PI * t);
        return Math.max(0, ellipse * indent);
    }

    static leafSilhouette(t) {
        return Math.sin(Math.PI * t) * (0.7 + 0.3 * Math.sin(Math.PI * t));
    }

    getNodeColor(regionIndex, nodeIndex) {
        if (regionIndex === 0) return APPLE_BODY_COLORS[nodeIndex % APPLE_BODY_COLORS.length];
        if (regionIndex === 1) return APPLE_STEM_COLORS[nodeIndex % APPLE_STEM_COLORS.length];
        if (regionIndex === 2) return APPLE_LEAF_COLORS[nodeIndex % APPLE_LEAF_COLORS.length];
        return null;
    }

    getConfigParameters() {
        return {
            ...super.getConfigParameters(),
            stemNodes: {
                type: 'number',
                label: 'Stem Nodes',
                min: 0,
                max: 5,
                default: 2
            },
            leafNodes: {
                type: 'number',
                label: 'Leaf Nodes',
                min: 0,
                max: 6,
                default: 2
            }
        };
    }

    static getDisplayName() {
        return 'Apple';
    }

    static getDescription() {
        return 'Arranges family members in an apple shape with stem and leaf.';
    }
}
