import { defineConfig } from 'vite';
import { resolve } from 'node:path';

// Relative base so the built site can be hosted from a sub-path without reconfig.
// Change to '/' if deploying at domain root and you want absolute asset paths.
export default defineConfig({
  root: '.',
  base: './',
  publicDir: 'public',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        editor: resolve(__dirname, 'tools/path-editor/index.html'),
      },
    },
  },
  server: {
    host: true,
    port: 5173,
  },
});
