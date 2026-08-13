import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  server: {
    host: true,
    port: 5173
  },
  build: {
    sourcemap: true,
    chunkSizeWarningLimit: 200,
    assetsDir: 'assets'
  },
  resolve: {
    alias: {
      '@': '/src',
      '@engine': '/src/engine',
      '@player': '/src/player',
      '@weapons': '/src/weapons',
      '@ui': '/src/ui',
      '@ai': '/src/ai',
      '@maps': '/src/maps',
      '@net': '/src/net',
      '@game': '/src/game',
      '@config': '/src/config'
    }
  }
});
