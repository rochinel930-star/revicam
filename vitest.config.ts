import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

// Config vitest — Phase P1. Résout l'alias `@/` vers ./src (comme tsconfig).
export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.spec.ts'],
    reporters: 'default',
  },
});
