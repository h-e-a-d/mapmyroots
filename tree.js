// tree.js - Enhanced with improved architecture, security, and error handling

import { appContext, EVENTS } from './src/utils/event-bus.js';
import { RetryManager, GlobalErrorHandler } from './src/utils/error-handling.js';
import { AccessibilityManager } from './src/features/accessibility/accessibility.js';
import { CONFIG } from './src/config/config.js';
import analyticsService from './src/analytics/analytics-service.js';
import AnalyticsIntegration from './src/analytics/analytics-integration.js';
import { migrateLocalStorageToIndexedDb } from './src/data/migrations/localstorage-to-indexeddb.js';
import { familyTreeSearch } from './src/features/search/search.js';

// Load debug helper in development
if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
  import('./src/analytics/debug-helper.js').then(module => {
    console.log('📊 Analytics debug helper loaded. Run: analyticsDebug.runAll()');
  });
}

// Enhanced module loader with retry mechanism.
// Takes a thunk so the dynamic `import('./literal-path.js')` lives at the
// call site — Vite/Astro can only rewrite import specifiers when they are
// string literals in the source, not when passed in as a variable.
const lazyLoadModule = async (loader) => {
  return RetryManager.retryModuleLoad(loader);
};

// Initialize core functionality immediately
document.addEventListener('DOMContentLoaded', async () => {
  try {
    // Run IDB migration before any tree init so the cache reads see migrated data.
    // Moved here from builder.astro's inline script — top-level await in that
    // module caused DCL to fire before listeners registered in newer WebKit.
    await migrateLocalStorageToIndexedDb().catch((err) => console.error('[migration] failed:', err));

    // Initialize analytics integration with event bus
    const eventBus = appContext.getEventBus();
    const analyticsIntegration = new AnalyticsIntegration(eventBus);
    analyticsIntegration.init();

    // Make analytics globally accessible for debugging
    window.analyticsService = analyticsService;
    window.analyticsIntegration = analyticsIntegration;

    // Load core tree functionality
    const { TreeCoreCanvas } = await import('./src/core/tree-engine.js');

    // Initialize tree core
    const treeCore = new TreeCoreCanvas();
    await treeCore.initialize();

  } catch (error) {
    console.error('Failed to initialize tree application:', error);
  }
});

// Keyboard shortcuts with debouncing
let keyPressTimeout;
document.addEventListener('keydown', (e) => {
  if (keyPressTimeout) return; // Prevent rapid key presses
  
  keyPressTimeout = setTimeout(() => {
    keyPressTimeout = null;
  }, 100);
  
  // Export shortcuts
  if ((e.ctrlKey || e.metaKey) && e.shiftKey) {
    switch (e.key) {
      case 'G':
        e.preventDefault();
        lazyLoadModule(() => import('./src/features/export/exporter.js')).then(module => {
          if (module && module.exportGEDCOM) module.exportGEDCOM();
        });
        break;
      case 'P':
        e.preventDefault();
        lazyLoadModule(() => import('./src/features/export/exporter.js')).then(module => {
          if (module && module.exportCanvasPDF) module.exportCanvasPDF();
        });
        break;
    }
  }

  // Search shortcut
  if ((e.ctrlKey || e.metaKey) && e.key === '/') {
    e.preventDefault();
    familyTreeSearch.focusSearch();
  }
});

// Public API using service locator pattern (replaces window globals)
class FamilyTreeAPI {
  constructor() {
    this.appContext = appContext;
  }
  
  async search(query) {
    try {
      return familyTreeSearch.searchFor(String(query));
    } catch (error) {
      console.error('Search failed:', error);
      return null;
    }
  }

  async exportGEDCOM() {
    try {
      appContext.getEventBus().emit(EVENTS.DATA_EXPORT_STARTED, { format: 'gedcom' });
      const exportModule = await lazyLoadModule(() => import('./src/features/export/exporter.js'));
      const result = exportModule ? await exportModule.exportGEDCOM() : null;
      if (result) {
        appContext.getEventBus().emit(EVENTS.DATA_EXPORT_COMPLETED, { format: 'gedcom' });
      }
      return result;
    } catch (error) {
      console.error('GEDCOM export failed:', error);
      appContext.getEventBus().emit(EVENTS.ERROR_OCCURRED, { error, context: { operation: 'export_gedcom' } });
      return null;
    }
  }
  
  getTreeStats() {
    try {
      const treeCore = appContext.getService('treeCore');
      if (!treeCore || !treeCore.renderer) {
        return null;
      }
      
      const totalPeople = treeCore.renderer.nodes.size;
      let relationshipCount = 0;
      
      if (treeCore.personData) {
        for (const [id, data] of treeCore.personData) {
          if (data.motherId || data.fatherId || data.spouseId) {
            relationshipCount++;
          }
        }
      }
      
      return {
        totalPeople,
        connections: treeCore.renderer.connections.length,
        relationships: relationshipCount,
        version: CONFIG.APP.VERSION
      };
    } catch (error) {
      console.error('Failed to get tree stats:', error);
      return null;
    }
  }
}

// Export API for external use
window.familyTreeAPI = new FamilyTreeAPI();
