  const required = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'NEXT_PUBLIC_GATEWAY_URL',
  ];
    if (!value || value.trim() === '' || value.includes('placeholder')) {
    }
    if (key.endsWith('_URL') && (!value.startsWith('https://') || /localhost|127\.0\.0\.1/.test(value))) {
      throw new Error(`Build validation failed: ${key} must be a non-local HTTPS URL.`);
    }
    : "'self' 'unsafe-inline'";