// Lint, including the module dependency rules of REQUIREMENTS §8.2 (NFR-M-02).
import js from '@eslint/js';
import boundaries from 'eslint-plugin-boundaries';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

/** Packages core/ must never import (§8.2). */
const NOT_IN_CORE = ['react', 'react-dom', 'react-konva', 'konva', 'zustand', 'idb', 'lucide-react', '@capacitor/*'];

export default tseslint.config(
  { ignores: ['dist', 'android', 'node_modules', 'coverage'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: { globals: globals.browser },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
  {
    files: ['src/core/**/*.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'error', // NFR-M-01
    },
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    plugins: { boundaries },
    settings: {
      'import/resolver': { node: { extensions: ['.ts', '.tsx', '.js'] } },
      'boundaries/elements': [
        { type: 'core', pattern: 'src/core/**' },
        { type: 'render', pattern: 'src/render/**' },
        { type: 'export', pattern: 'src/export/**' },
        { type: 'tools', pattern: 'src/tools/**' },
        { type: 'state', pattern: 'src/state/**' },
        { type: 'ui', pattern: 'src/ui/**' },
        { type: 'platform', pattern: 'src/platform/**' },
        { type: 'theme', pattern: 'src/theme/**' },
        { type: 'suite', pattern: 'src/suite/**' },
        { type: 'app', pattern: 'src/*.{ts,tsx}', partialMatch: false },
      ],
    },
    rules: {
      'boundaries/dependencies': [
        2,
        {
          default: 'disallow',
          checkAllOrigins: true,
          policies: [
            // Every element may import its own files.
            { from: { element: { type: 'core' } }, allow: { to: { element: { type: 'core' } } } },
            // ui ─▶ tools ─▶ state ─▶ core; ui ─▶ render ─▶ core (types); export ─▶ core.
            {
              from: { element: { type: 'ui' } },
              allow: {
                to: { element: { types: { anyOf: ['ui', 'tools', 'state', 'render', 'export', 'core', 'platform', 'app', 'theme'] } } },
              },
            },
            {
              from: { element: { type: 'tools' } },
              allow: { to: { element: { types: { anyOf: ['tools', 'state', 'core', 'platform'] } } } },
            },
            { from: { element: { type: 'state' } }, allow: { to: { element: { types: { anyOf: ['state', 'core'] } } } } },
            { from: { element: { type: 'render' } }, allow: { to: { element: { types: { anyOf: ['render', 'core', 'theme'] } } } } },
            { from: { element: { type: 'theme' } }, allow: { to: { element: { types: { anyOf: ['theme', 'core'] } } } } },
            { from: { element: { type: 'export' } }, allow: { to: { element: { types: { anyOf: ['export', 'core', 'theme'] } } } } },
            { from: { element: { type: 'platform' } }, allow: { to: { element: { type: 'platform' } } } },
            { from: { element: { type: 'app' } }, allow: { to: { element: { types: { anyOf: ['app', 'ui', 'state', 'core', 'platform', 'suite'] } } } } },
            // The suite shell (SUITE.md): its own files, UI state to open a module.
            { from: { element: { type: 'suite' } }, allow: { to: { element: { types: { anyOf: ['suite', 'state', 'platform', 'theme'] } } } } },
            // External packages: allowed everywhere except the core list above.
            { allow: { to: { module: { origin: 'external' } } } },
            {
              from: { element: { type: 'core' } },
              disallow: { to: { module: { origin: 'external', source: NOT_IN_CORE } } },
            },
          ],
        },
      ],
    },
  },
  {
    // render/ receives the render model only; it may not reach into the perspective solver (§8.2).
    files: ['src/render/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': ['error', { patterns: [{ group: ['**/core/perspective/**', '**/core/perspective'], message: 'render/ gets the RenderModel, not the camera (§8.2).' }] }],
    },
  },
  {
    // core/ is pure: no DOM (§8.2).
    files: ['src/core/**/*.ts'],
    languageOptions: { globals: {} },
  },
);
