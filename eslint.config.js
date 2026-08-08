// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
const prettierConfig = require('eslint-config-prettier/flat');

module.exports = defineConfig([
  expoConfig,
  // Last, so formatting is Prettier's job alone and the two never disagree.
  prettierConfig,
  {
    ignores: ['dist/*', '.expo/*', 'node_modules/*', 'docs/design/*'],
  },
  {
    rules: {
      // AGENTS.md: named exports only. Expo Router is the one exception, since
      // a route file has to default-export its screen.
      'no-restricted-exports': 'off',
      // AGENTS.md: no escape hatches in the type system.
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },
]);
