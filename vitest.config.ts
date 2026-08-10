import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

/**
 * Vitest needs to resolve the `@/*` alias for itself.
 *
 * `tsconfig.json` maps it for the type checker and Metro maps it for the app,
 * but neither of those is in play here: the suite runs under plain Node so
 * the data layer can be driven without a phone. Until now every tested module
 * happened to import only relatively, so the gap did not show. It does the
 * moment a tested file imports through the alias, and it shows as "cannot
 * find package", which reads like a missing dependency rather than a missing
 * alias.
 *
 * The root `AGENTS.md` says imports come through `@/*`, so the fix belongs
 * here rather than in the source.
 */
export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
});
