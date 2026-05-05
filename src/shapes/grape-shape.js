/**
 * GrapeShape - Family tree arranged as a classic grape bunch.
 *
 * Visual-first: pure envelope packing, no genealogy logic.
 * Multi-region: thin stem above (centered), vine leaf to the side, main body teardrop.
 *
 * Body silhouette: w(t) = (1 - t)^0.52 · (1 + 0.45·sin(π·t^0.7))
 *   - peaks slightly below the top (~t=0.2) for a realistic grape-bunch profile
 *   - tapers to a single point at t=1 (bottom)
 *
 * Colors: grapes → purple palette, stem → brown, leaf → green.
 */

import { EnvelopeShape } from './envelope-shape.js';

const GRAPE_COLORS = [
    '#5E1A8A', '#6B2D9C', '#7B3FAE', '#8B4FBE', '#9660CC',
    '#A070D4', '#7D2FA0', '#6A1F8C', '#9B5ABF', '#8040B0'
];
const STEM_COLORS = ['#5D3A1A', '#7B4F2E', '#6B4020', '#8B5E3C'];
const LEAF_COLORS = ['#1B6B2F', '#276B35', '#2E8B40', '#3A9E4D', '#4DB862', '#388E3C'];

export class GrapeShape extends EnvelopeShape {
    constructor(treeCore, options = {}) {
        super(treeCore, {
            stemNodes: 2,
            leafNodes: 3,
            decorationThreshold: 8,
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
            silhouette: GrapeShape.bodySilhouette,
            aspectRatio: 1.4,
            weight: 1.0
        }];

        if (stemCount > 0) {
            regions.push({
                silhouette: () => 1.0,
                aspectRatio: Math.max(2, stemCount * 1.4),
                count: stemCount,
                placement: {
                    anchor: 'above',
                    relativeTo: 0,
                    gap: cellW * 0.1,
                    dx: 0
                }
            });
        }

        if (leafCount > 0) {
            regions.push({
                silhouette: GrapeShape.leafSilhouette,
                aspectRatio: 0.9,
                count: leafCount,
                placement: {
                    anchor: 'right',
                    relativeTo: stemCount > 0 ? 1 : 0,
                    gap: cellW * 0.15,
                    dy: cellW * 0.1
                }
            });
        }

        return regions;
    }

    static bodySilhouette(t) {
        const taper = Math.pow(1 - t, 0.52);
        const bulge = 1 + 0.45 * Math.sin(Math.PI * Math.pow(t, 0.7));
        return Math.max(0, taper * bulge);
    }

    static leafSilhouette(t) {
        return Math.sin(Math.PI * t) * (0.7 + 0.3 * (1 - t));
    }

    getNodeColor(regionIndex, nodeIndex) {
        if (regionIndex === 0) return GRAPE_COLORS[nodeIndex % GRAPE_COLORS.length];
        if (regionIndex === 1) return STEM_COLORS[nodeIndex % STEM_COLORS.length];
        if (regionIndex === 2) return LEAF_COLORS[nodeIndex % LEAF_COLORS.length];
        return null;
    }

    getConfigParameters() {
        return {
            ...super.getConfigParameters(),
            stemNodes: {
                type: 'number',
                label: 'Stem Nodes',
                min: 0,
                max: 6,
                default: 2
            },
            leafNodes: {
                type: 'number',
                label: 'Leaf Nodes',
                min: 0,
                max: 8,
                default: 3
            }
        };
    }

    static getDisplayName() {
        return 'Grape Bunch';
    }

    static getDescription() {
        return 'Arranges family members as a grape bunch with stem and leaf. Wide at the top, tapering to a single grape at the bottom.';
    }
}
