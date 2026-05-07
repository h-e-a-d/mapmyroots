import { describe, it, expect, vi } from 'vitest';

// Mock all heavy imports that TreeEngine pulls in
vi.mock('../../../../src/core/canvas-renderer.js', () => ({ CanvasRenderer: vi.fn() }));
vi.mock('../../../../src/ui/modals/modal.js', () => ({
  openModalForEdit: vi.fn(), closeModal: vi.fn(), getSelectedGender: vi.fn()
}));
vi.mock('../../../../src/utils/marriage-sync.js', () => ({
  syncMarriages: vi.fn(), makeMarriageId: vi.fn()
}));
vi.mock('../../../../src/data/migrations/v2.2-rich-events.js', () => ({ migrateToV22: vi.fn() }));
vi.mock('../../../../src/ui/components/table.js', () => ({ rebuildTableView: vi.fn() }));
vi.mock('../../../../src/features/export/exporter.js', () => ({
  exportTree: vi.fn(), exportGEDCOM: vi.fn(), exportCanvasPDF: vi.fn()
}));
vi.mock('../../../../src/ui/components/notifications.js', () => ({ notifications: { info: vi.fn(), error: vi.fn() } }));
vi.mock('../../../../src/data/cache/core-undoRedo.js', () => ({ UndoRedoManager: vi.fn() }));
vi.mock('../../../../src/data/cache/core-cache.js', () => ({ CacheManager: vi.fn() }));
vi.mock('../../../../src/ui/components/ui-buttons.js', () => ({ setupButtons: vi.fn() }));
vi.mock('../../../../src/ui/components/ui-settings.js', () => ({ setupSettings: vi.fn() }));
vi.mock('../../../../src/ui/components/ui-modals.js', () => ({ setupModals: vi.fn() }));
vi.mock('../../../../src/data/core-export.js', () => ({ setupExport: vi.fn() }));
vi.mock('../../../../src/utils/event-bus.js', () => ({ appContext: { getEventBus: vi.fn(() => ({ on: vi.fn(), emit: vi.fn() })) } }));
vi.mock('../../../../src/utils/generation-calculator.js', () => ({ GenerationCalculator: vi.fn() }));

import { TreeEngine } from '../../../../src/core/tree-engine.js';

describe('TreeEngine displayPreferences', () => {
  it('includes showPhotos: true by default', () => {
    const engine = new TreeEngine();
    expect(engine.displayPreferences.showPhotos).toBe(true);
  });

  it('includes all existing display preference keys', () => {
    const engine = new TreeEngine();
    expect(engine.displayPreferences).toMatchObject({
      showMaidenName: true,
      showDateOfBirth: true,
      showFatherName: true,
      showPhotos: true
    });
  });
});
