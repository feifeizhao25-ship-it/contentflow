export default function CookieConsent() {
  const { t } = useI18n();
  const tc = (key: string) => t(`cookieConsent.${key}`);
  const [visible, setVisible] = useState(false);
        onClick={withdraw}
        className="fixed bottom-4 right-4 z-40 px-4 py-2 text-xs font-medium text-white bg-gray-900/80 hover:bg-gray-900 rounded-full shadow-lg backdrop-blur-sm"
        aria-label={tc('withdrawAriaLabel')}
      >
        {tc('manageCookies')}
      </button>
    );
  }
          <div className="text-sm text-gray-300 flex-1">
            <p className="font-medium text-white mb-1">{tc('title')}</p>
            <p className="leading-relaxed">
              {tc('description')}{' '}
              <Link href="/legal/privacy" className="text-primary hover:text-primary/80 underline underline-offset-2">
                {tc('privacyLink')}
              </Link>
              {tc('cookiePolicyLink') && (
                <>
                  {' '}
                  <Link href="/legal/cookie" className="text-primary hover:text-primary/80 underline underline-offset-2">
                    {tc('cookiePolicyLink')}
                  </Link>
                </>
              )}
              onClick={() => setShowPreferences((s) => !s)}
              className="px-4 py-2 text-sm font-medium text-gray-300 hover:text-white transition-colors"
            >
              {tc('preferences')}
            </button>
            >
              {tc('reject')}
            </button>
            >
              {tc('acceptAll')}
            </button>
              <input type="checkbox" checked disabled className="mt-1" />
              <span>
                <strong className="text-white">{tc('necessaryLabel')}</strong>
                <span className="block text-gray-400">{tc('necessaryDescription')}</span>
              </span>
            </label>
              />
              <span>
                <strong className="text-white">{tc('analyticsLabel')}</strong>
                <span className="block text-gray-400">{tc('analyticsDescription')}</span>
              </span>
            </label>
              />
              <span>
                <strong className="text-white">{tc('marketingLabel')}</strong>
                <span className="block text-gray-400">{tc('marketingDescription')}</span>
              </span>
            </label>
              >
                {tc('savePreferences')}
              </button>
