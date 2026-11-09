import { defineConfig } from 'vitest/config';

// Firestore security-rules tests. They need the emulator running:
//   pnpm emulators   (or firebase emulators:exec in CI)
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['rules-tests/**/*.test.ts'],
    testTimeout: 20_000,
    hookTimeout: 20_000,
  },
});
