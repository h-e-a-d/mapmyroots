import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./tests/setup.js'],
    include: ['tests/unit/**/*.test.js'],
    exclude: ['testing/**', 'tests-examples/**', 'node_modules/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'testing/',
        'tests-examples/',
        '**/*.config.js',
        '**/dist/**'
      ]
    }
  }
});
