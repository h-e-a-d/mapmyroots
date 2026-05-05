/// <reference types="astro/client" />

// Make this file a module so `declare global` is valid.
export {};

declare global {
  interface Window {
    // Runtime objects attached by tree.js, i18n.js, and feature scripts.
    treeCore: any; // eslint-disable-line @typescript-eslint/no-explicit-any
    i18n: any; // eslint-disable-line @typescript-eslint/no-explicit-any
    __gedcomImport: any; // eslint-disable-line @typescript-eslint/no-explicit-any
    __SecurityUtils: any; // eslint-disable-line @typescript-eslint/no-explicit-any
    enhancedCacheIndicator: any; // eslint-disable-line @typescript-eslint/no-explicit-any
  }
}
