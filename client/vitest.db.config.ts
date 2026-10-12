import { defineConfig } from 'vitest/config';

// Database permission tests against the local Supabase stack (`npx supabase start`).
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/db/**/*.integration.test.ts'],
    testTimeout: 30_000,
    fileParallelism: false,
  },
});
