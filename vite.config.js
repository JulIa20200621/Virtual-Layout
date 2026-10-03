import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    // three.js alone is ~600 kB; that's expected for this app.
    chunkSizeWarningLimit: 1000,
  },
});
