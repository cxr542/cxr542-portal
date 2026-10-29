import { defineConfig } from 'vitest/config';

// Run the repository's tests, never archived deployment copies or local QA bundles.
export default defineConfig({ test: { include: ['tests/**/*.test.{js,jsx,mjs}'] } });
