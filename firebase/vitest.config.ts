import { defineConfig } from 'vitest/config';

/** Rules tests only. They need the Firestore emulator; `npm run test:rules` starts it around them. */
export default defineConfig({
    test: {
        environment: 'node',
        include: ['firebase/**/*.test.ts'],
        testTimeout: 30_000,
        hookTimeout: 60_000,
        // One emulator, one database: files and tests run one after another.
        fileParallelism: false,
    },
});
