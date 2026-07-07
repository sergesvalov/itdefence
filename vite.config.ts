import { defineConfig } from 'vite';

// ── Build mode ────────────────────────────────────────────────────────────────
// web      → для сервера (base: '/')
// electron → для Electron (base: './', загрузка через file://)
// capacitor→ для Android  (base: './', загрузка из assets на устройстве)
const mode = process.env.VITE_MODE ?? process.env.npm_lifecycle_event ?? 'web';

const isElectron  = mode.includes('electron');
const isCapacitor = mode.includes('cap');
const isRelative  = isElectron || isCapacitor;

export default defineConfig({
  base: isRelative ? './' : (process.env.VITE_BASE_PATH ?? '/'),

  build: {
    outDir:     'dist',
    emptyOutDir: true,
    rollupOptions: {
      output: {
        // Phaser отдельным чанком — быстрее повторный билд и кэш браузера
        manualChunks: {
          phaser: ['phaser'],
        },
      },
    },
    chunkSizeWarningLimit: 1600,
  },
});
