// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
const prettierConfig = require('eslint-config-prettier/flat');

// The rules below turn the prose in AGENTS.md "## Rules" into checks the
// machine runs, so a convention is caught at commit time instead of in review.
// Each block names the rule it enforces. Rules that cannot be linted (pure
// functions, explicit result values over throwing, honest failure copy) stay
// the reviewer's job.
module.exports = defineConfig([
  expoConfig,
  // Last, so formatting is Prettier's job alone and the two never disagree.
  prettierConfig,
  {
    ignores: ['dist/*', '.expo/*', 'node_modules/*', 'docs/design/*'],
  },
  {
    rules: {
      // AGENTS.md: named exports only, no default exports. The two exceptions
      // below re-allow it exactly where a tool demands it.
      'import/no-default-export': 'error',

      // AGENTS.md: data is immutable, never mutate in place, no shared mutable
      // state. `no-var` already comes from the Expo config.
      'prefer-const': ['error', { destructuring: 'all' }],
      'no-param-reassign': ['error', { props: true }],

      // Health numbers reach people who act on them, so a stray debug log is
      // noise in a release build. `warn` and `error` stay, they are real
      // reporting.
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },
  {
    // AGENTS.md: types are strict, no escape hatches, no untyped values.
    // Scoped to TypeScript, because the Expo config only loads the
    // `@typescript-eslint` plugin for these files. Naming its rules anywhere
    // wider makes ESLint fail outright on a plain `.js` file.
    files: ['**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-non-null-assertion': 'error',
      '@typescript-eslint/ban-ts-comment': [
        'error',
        {
          'ts-ignore': true,
          'ts-nocheck': true,
          // An escape hatch you have to justify in writing is a different thing
          // from one you can reach for silently.
          'ts-expect-error': 'allow-with-description',
          minimumDescriptionLength: 10,
        },
      ],
    },
  },
  {
    // Expo Router builds the navigation tree from the file system, and every
    // route file has to default-export its screen. This is the framework's
    // contract, not a style choice.
    files: ['src/app/**/*.{ts,tsx}'],
    rules: {
      'import/no-default-export': 'off',
    },
  },
  {
    // Expo reads the app config off the default export.
    files: ['app.config.ts'],
    rules: {
      'import/no-default-export': 'off',
    },
  },
  {
    // The check scripts are command line tools that run outside the app and
    // never ship in a build. Printing their results to stdout is the whole
    // job, so the no-console rule has nothing to protect here.
    files: ['scripts/**/*.ts'],
    rules: {
      'no-console': 'off',
    },
  },
]);
