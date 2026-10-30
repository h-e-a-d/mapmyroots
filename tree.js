// tree.js - Enhanced with improved architecture, security, and error handling

import { appContext, EVENTS } from './src/utils/event-bus.js';
import { RetryManager, GlobalErrorHandler } from './src/utils/error-handling.js';
import { AccessibilityManager } from './src/features/accessibility/accessibility.js';
import { CONFIG } from './src/config/config.js';
import analyticsService from './src/analytics/analytics-service.js';
import AnalyticsIntegration from './src/analytics/analytics-integration.js';
import { migrateLocalStorageToIndexedDb } from './src/data/migrations/localstorage-to-indexeddb.js';
import { familyTreeSearch } from './src/features/search/search.js';
import { shortcutLetter } from './src/utils/shortcut-keys.js';

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

// Keyboard shortcuts. The debounce only starts once a shortcut fires: the modifier keydowns
// themselves used to start it, which swallowed a P or G pressed within 100 ms of Cmd/Ctrl.
let shortcutCooldown = null;
document.addEventListener('keydown', (e) => {
  if (!(e.ctrlKey || e.metaKey) || e.repeat || shortcutCooldown) return;

  let action = null;
  if (e.shiftKey) {
    const letter = shortcutLetter(e);
    if (letter === 'g') action = (module) => module?.exportGEDCOM?.();
    if (letter === 'p') action = (module) => module?.exportCanvasPDF?.();
  }

  if (action) {
    e.preventDefault();
    lazyLoadModule(() => import('./src/features/export/exporter.js')).then(action);
  } else if (e.key === '/') {
    e.preventDefault();
    familyTreeSearch.focusSearch();
  } else {
    return;
  }

  shortcutCooldown = setTimeout(() => {
    shortcutCooldown = null;
  }, 100);
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
