module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: {
    project: './tsconfig.json',
    tsconfigRootDir: __dirname,
    sourceType: 'module',
  },
  plugins: ['@typescript-eslint'],
  extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended', 'prettier'],
  env: { node: true, jest: true },
  ignorePatterns: ['dist/**', 'node_modules/**', '**/*.spec.ts'],
  rules: {
    '@typescript-eslint/no-explicit-any': 'off',
    // The production build is type-checked by tsc. Adapter interfaces intentionally
    // retain several currently-unused parameters, so they must not break the gate.
    '@typescript-eslint/no-unused-vars': 'off',
    'prefer-const': 'off',
  },
};
