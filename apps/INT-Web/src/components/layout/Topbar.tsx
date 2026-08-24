    <header className="h-14 flex items-center justify-between gap-2 px-3 md:px-6 sticky top-0 z-30 bg-background/85 backdrop-blur-xl">
      <Link href="/home" className="lg:hidden flex items-center gap-2 shrink-0">
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary-container text-on-primary shadow-lg shadow-primary/20">
          <Icon name="magic_button" className="text-xl" />
        </span>
        <span className="hidden sm:inline font-['Manrope'] text-sm font-extrabold text-primary">ContentFlow</span>
      </Link>

      {/* Search */}
      <div className="flex-1 max-w-md min-w-0">
        <div className="relative group">
      <div className="flex items-center gap-1.5 md:gap-3 shrink-0">
        <div className="hidden sm:block">
          <TierBadge plan={profile?.plan} />
        </div>

        <button className="hidden md:block px-4 py-1.5 text-xs font-semibold text-primary border border-primary/30 rounded-lg hover:bg-primary/10 transition-all">
          {t('topbar.upgrade')}
        </button>

        <Link
          href="/create"
          className="flex items-center gap-1.5 md:gap-2 px-3 md:px-4 py-2 bg-primary text-on-primary text-sm font-semibold rounded-xl hover:bg-primary-fixed-dim transition-all active:scale-[0.98] shadow-lg shadow-primary/20"
        >
          <Icon name="add" className="text-sm" />
          <span className="hidden sm:inline">{t('topbar.createContent')}</span>
        </Link>
        <button className="hidden sm:block p-2 text-on-surface-variant/60 hover:text-on-surface hover:bg-surface-container rounded-xl transition-all">
          <Icon name="settings" className="text-xl" />
        </button>

        <button className="hidden sm:block w-9 h-9 rounded-full overflow-hidden border-2 border-outline-variant hover:border-primary transition-all">
