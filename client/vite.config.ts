import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
  },
  build: {
    // The lazily loaded PDF chunk (pdfkit + embedded fonts) is ~1.5 MB by design.
    chunkSizeWarningLimit: 1600,
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    // Needs the local Supabase stack; run with `npm run test:db`.
    exclude: ['**/node_modules/**', '**/*.integration.test.ts'],
  },
});
