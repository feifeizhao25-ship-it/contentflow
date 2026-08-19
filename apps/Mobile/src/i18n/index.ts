i18n.use(initReactI18next).init({
  resources,
  lng: defaultLng,
  fallbackLng,
  parseMissingKeyHandler: key => {
    if (IS_CN) {
      return key;
    }

    // INTL builds must never expose Chinese source keys when a translation is missing.
    return 'Missing copy';
  },
  interpolation: {
    escapeValue: false,
  },