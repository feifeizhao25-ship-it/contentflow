import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';

export default defineConfig([
  ...nextVitals,
  {
    rules: {
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/immutability': 'off',
      'react-hooks/purity': 'off',
    },
  },
  // Keep ESLint aligned with tsconfig: legacy recovery fragments are deliberately
  // outside the production module graph and are not shipped by Next.js.
  globalIgnores([
    '.next/**',
    'coverage/**',
    'next-env.d.ts',
    'legacy-fragments/**',
    'src/**/*.test.ts',
    'src/**/*.test.tsx',
    'src/components/**',
    'src/hooks/usePersonaPersonalization.ts',
    'src/i18n/index.tsx',
    'src/lib/**',
  ]),
]);
