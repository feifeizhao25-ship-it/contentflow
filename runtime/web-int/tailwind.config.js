      colors: {
        // Legacy app aliases still used across dashboards and forms.
        brand: {
          50: 'var(--brand-50)',
          100: 'var(--brand-100)',
          200: '#a5b4fc',
          300: '#818cf8',
          400: '#6366f1',
          500: 'var(--brand-500)',
          600: 'var(--brand-600)',
          700: 'var(--brand-700)',
          900: 'var(--brand-900)',
        },

        // Base/Surface Hierarchy
        'background': 'var(--background)',
        'surface': 'var(--surface)',
        'surface-low': '#091328',
        'surface-container': 'var(--surface-container)',
        'surface-container-lowest': 'var(--surface-container-lowest)',
        'surface-container-low': 'var(--surface-container-low)',
        'surface-container-high': 'var(--surface-container-high)',
        'surface-container-highest': 'var(--surface-container-highest)',
        'surface-variant': 'var(--surface-variant)',
        'surface-high': '#141f38',
        'surface-highest': '#1a2744',
        'surface-lowest': '#000000',

        // Semantic Colors
        'primary': {
          DEFAULT: 'var(--primary)',
          100: '#e0e7ff',
          400: '#818cf8',
          500: 'var(--brand-500)',
          600: 'var(--brand-600)',
          dim: 'var(--primary-dim)',
        },
        'primary-container': 'var(--primary-container)',
        'primary-fixed-dim': 'var(--primary-fixed-dim)',
        'on-primary-container': 'var(--on-primary-container)',
        'secondary': 'var(--secondary)',
        'error': 'var(--error)',

        // Text Colors
        'on-surface': 'var(--on-surface)',
        'on-surface-variant': 'var(--on-surface-variant)',
        'on-primary': 'var(--on-primary)',
        'outline': 'var(--outline)',
        'outline-variant': 'var(--outline-variant)',
      fontFamily: {
        // Headlines
        display: ['Manrope', ...defaultTheme.fontFamily.sans],
        headline: ['Manrope', ...defaultTheme.fontFamily.sans],
        plus: ['Manrope', ...defaultTheme.fontFamily.sans],
        // Body/Data
        body: ['Inter', ...defaultTheme.fontFamily.sans],
        'xl': '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
        '2xl': '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        'card': '0 18px 50px rgba(0, 0, 0, 0.22)',
        'card-inset': 'inset 0 1px 0 rgba(255, 255, 255, 0.08), 0 18px 50px rgba(0, 0, 0, 0.22)',
        // Glassmorphism glow
        'glow': '0 0 20px rgba(163, 166, 255, 0.3)',
