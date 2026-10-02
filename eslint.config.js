import tseslint from 'typescript-eslint';

// TypeScript's strict mode already covers types and unused code; lint adds the checks a
// compiler does not make. Legacy 1.x files (repo root js/, css/, *.html) are not linted.
export default tseslint.config(
    { ignores: ['dist/**', 'dist-e2e/**', 'node_modules/**', 'archive/**', 'e2e/_*.mjs'] },
    ...tseslint.configs.recommended,
    {
        rules: {
            eqeqeq: 'error',
            'no-console': ['error', { allow: ['warn', 'error'] }],
            'prefer-const': 'error',
            '@typescript-eslint/no-non-null-assertion': 'off',
            '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
        },
    },
    {
        // Tests poke at deliberately malformed data; test and build scripts print their results.
        files: ['**/*.test.ts', 'e2e/**', 'scripts/**'],
        rules: { '@typescript-eslint/no-explicit-any': 'off', 'no-console': 'off' },
    },
);

