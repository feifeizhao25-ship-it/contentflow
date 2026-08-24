import { cn } from '@/lib/utils/cn';
import { Icon } from '@/components/ui/Icon';

const TRUST_MARKERS = ['Draft-first publishing', 'Global platform playbooks', 'Source-aware AI outputs'];
const PLATFORM_SIGNALS = ['TikTok', 'YouTube', 'Instagram', 'LinkedIn', 'X', 'Reddit'];
const OPS_CARDS = [
  { label: 'Review Queue', value: '128', detail: 'items staged for approval' },
  { label: 'Markets', value: '14', detail: 'localized content lanes' },
  { label: 'Quality Gate', value: '96%', detail: 'policy checks passed' },
];

export default function GlobalLoginPage() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-[#07111f] px-5 py-6 text-white sm:px-8 lg:px-10">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_14%,rgba(45,212,191,0.24),transparent_28%),radial-gradient(circle_at_78%_8%,rgba(250,204,21,0.14),transparent_26%),linear-gradient(135deg,#07111f_0%,#0d1c2b_52%,#122012_100%)]" />
      <div className="absolute left-1/2 top-0 h-[48rem] w-[48rem] -translate-x-1/2 rounded-full border border-white/10 bg-white/[0.02] blur-3xl" />

      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, ease: 'easeOut' }}
        className="relative z-10 mx-auto grid min-h-[calc(100vh-3rem)] w-full max-w-7xl items-center gap-8 lg:grid-cols-[1.08fr_0.92fr]"
      >
        <section className="order-2 space-y-8 lg:order-1">
          <div className="inline-flex items-center gap-3 rounded-full border border-emerald-300/20 bg-emerald-300/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-emerald-100">
            <span className="h-2 w-2 rounded-full bg-emerald-300 shadow-[0_0_18px_rgba(110,231,183,0.9)]" />
            Global AI Content Operations
          </div>

          <div className="max-w-3xl space-y-6">
            <div className="flex items-center gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-3xl border border-white/15 bg-white/10 shadow-2xl shadow-cyan-500/10 backdrop-blur">
                <Icon name="magic_button" className="text-[34px] text-emerald-200" />
              </div>
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.34em] text-white/45">ContentFlow</p>
                <p className="text-sm text-emerald-100/70">International command center</p>
              </div>
            </div>

            <h1 className="font-display text-5xl font-black leading-[0.95] tracking-[-0.06em] text-white sm:text-6xl xl:text-7xl">
              Turn every market into a reviewed content pipeline.
            </h1>
            <p className="max-w-2xl text-base leading-8 text-slate-300 sm:text-lg">
              Plan, generate, adapt, and stage platform-native content for international teams. Every AI response is designed for English-first output, source awareness, and human approval before publishing.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {PLATFORM_SIGNALS.map((item) => (
              <span key={item} className="rounded-full border border-white/10 bg-white/[0.06] px-4 py-2 text-sm font-semibold text-slate-200 shadow-card">
                {item}
              </span>
            ))}
          </div>

          <div className="grid max-w-3xl gap-4 sm:grid-cols-3">
            {OPS_CARDS.map((card, index) => (
              <motion.div
                key={card.label}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 + index * 0.08, duration: 0.45 }}
                className="rounded-3xl border border-white/10 bg-white/[0.07] p-5 shadow-card backdrop-blur-xl"
              >
                <p className="text-xs font-bold uppercase tracking-[0.22em] text-emerald-100/55">{card.label}</p>
                <p className="mt-3 text-3xl font-black tracking-[-0.04em] text-white">{card.value}</p>
                <p className="mt-1 text-sm leading-6 text-slate-300">{card.detail}</p>
              </motion.div>
            ))}
          </div>

          <div className="flex flex-wrap gap-3 text-sm text-slate-300">
            {TRUST_MARKERS.map((item) => (
              <span key={item} className="inline-flex items-center gap-2 rounded-2xl bg-black/20 px-3 py-2">
                <Icon name="verified" className="text-base text-emerald-300" />
                {item}
              </span>
            ))}
          </div>
        </section>

        <section className="order-1 lg:order-2">
          <div className="relative mx-auto w-full max-w-[30rem]">
            <div className="absolute -inset-5 rounded-[2.5rem] bg-gradient-to-br from-emerald-300/20 via-cyan-300/10 to-amber-200/10 blur-2xl" />
            <div className="relative overflow-hidden rounded-[2rem] border border-white/12 bg-[#f8faf6] p-3 text-slate-950 shadow-[0_30px_100px_rgba(0,0,0,0.45)]">
              <div className="rounded-[1.6rem] border border-slate-900/5 bg-white p-6 shadow-xl sm:p-8">
                <div className="mb-7 flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.28em] text-emerald-700">Secure workspace</p>
                    <h2 className="mt-2 text-3xl font-black tracking-[-0.05em] text-slate-950">
                      {activeTab === 'login' ? 'Welcome back' : 'Build your workspace'}
                    </h2>
                    <p className="mt-2 text-sm leading-6 text-slate-500">
                      {activeTab === 'login'
                        ? 'Continue coordinating campaigns, drafts, and approvals.'
                        : 'Create an English-first command center for your team.'}
                    </p>
                  </div>
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-950 text-emerald-200">
                    <Icon name="hub" className="text-2xl" />
                  </div>
                </div>

                <div className="mb-7 grid grid-cols-2 rounded-2xl bg-slate-100 p-1">
                  <button
                    type="button"
                    onClick={() => setActiveTab('login')}
                    className={cn(
                      'rounded-xl px-4 py-3 text-sm font-black transition-all',
                      activeTab === 'login' ? 'bg-slate-950 text-white shadow-lg' : 'text-slate-500 hover:text-slate-900'
                    )}
                  >
                    Sign In
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('register')}
                    className={cn(
                      'rounded-xl px-4 py-3 text-sm font-black transition-all',
                      activeTab === 'register' ? 'bg-slate-950 text-white shadow-lg' : 'text-slate-500 hover:text-slate-900'
                    )}
                  >
                    Create Account
                  </button>
                </div>

                <AnimatePresence mode="wait">
                  <motion.form
                    key={activeTab}
                    initial={{ opacity: 0, x: activeTab === 'login' ? -14 : 14 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: activeTab === 'login' ? 14 : -14 }}
                    transition={{ duration: 0.22 }}
                    className="space-y-4"
                    onSubmit={activeTab === 'login' ? handleLogin : handleRegister}
                  >
                    {activeTab === 'register' && (
                      <div className="grid gap-4 sm:grid-cols-2">
                        <label className="group block">
                          <span className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-slate-400">Full name</span>
                          <span className="relative block">
                            <Icon name="person" className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-emerald-700" />
                            <input
                              type="text"
                              required
                              value={name}
                              onChange={(e) => setName(e.target.value)}
                              placeholder="Alex Morgan"
                              className="h-13 w-full rounded-2xl border border-slate-200 bg-slate-50 py-4 pl-11 pr-4 text-sm font-semibold text-slate-950 outline-none transition-all placeholder:text-slate-300 focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-500/10"
                            />
                          </span>
                        </label>
                        <label className="group block">
                          <span className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-slate-400">Workspace</span>
                          <span className="relative block">
                            <Icon name="dns" className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-emerald-700" />
                            <input
                              type="text"
                              required
                              value={tenantName}
                              onChange={(e) => setTenantName(e.target.value)}
                              placeholder="Northstar Media"
                              className="h-13 w-full rounded-2xl border border-slate-200 bg-slate-50 py-4 pl-11 pr-4 text-sm font-semibold text-slate-950 outline-none transition-all placeholder:text-slate-300 focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-500/10"
                            />
                          </span>
                        </label>
                      </div>
                    )}

                    <label className="group block">
                      <span className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-slate-400">Email address</span>
                      <span className="relative block">
                        <Icon name="mail" className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-emerald-700" />
                        <input
                          type="email"
                          required
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="team@company.com"
                          className="h-13 w-full rounded-2xl border border-slate-200 bg-slate-50 py-4 pl-11 pr-4 text-sm font-semibold text-slate-950 outline-none transition-all placeholder:text-slate-300 focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-500/10"
                        />
                      </span>
                    </label>

                    <label className="group block">
                      <span className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-slate-400">Password</span>
                      <span className="relative block">
                        <Icon name="lock" className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-emerald-700" />
                        <input
                          type="password"
                          required
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="Enter password"
                          className="h-13 w-full rounded-2xl border border-slate-200 bg-slate-50 py-4 pl-11 pr-4 text-sm font-semibold text-slate-950 outline-none transition-all placeholder:text-slate-300 focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-500/10"
                        />
                      </span>
                    </label>

                    {activeTab === 'login' && (
                      <div className="flex items-center justify-between gap-4">
                        <p className="text-xs leading-5 text-slate-500">Protected by workspace policies and approval logs.</p>
                        <button
                          type="button"
                          onClick={() => router.push('/reset-password')}
                          className="text-xs font-black text-emerald-700 transition-colors hover:text-emerald-900"
                        >
                          Forgot password?
                        </button>
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={loading}
                      className="group mt-2 flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 text-sm font-black text-white shadow-[0_18px_45px_rgba(15,23,42,0.28)] transition-all hover:-translate-y-0.5 hover:bg-emerald-900 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {loading ? 'Processing...' : activeTab === 'login' ? 'Enter Command Center' : 'Create Workspace'}
                      <Icon name="arrow_forward" className="text-lg transition-transform group-hover:translate-x-1" />
                    </button>
                  </motion.form>
                </AnimatePresence>

                <div className="mt-7 rounded-2xl border border-amber-200 bg-amber-50 p-4">
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-amber-700">Operator note</p>
                  <p className="mt-2 text-sm leading-6 text-amber-950">
                    Publishing is review-first by default. ContentFlow does not promise virality; it helps teams make faster, better-controlled decisions.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 px-3 py-4 text-xs font-semibold text-slate-500">
                <span>© {new Date().getFullYear()} ContentFlow</span>
                <span className="flex items-center gap-3">
                  <Link href="/terms" className="transition hover:text-slate-950">Terms</Link>
                  <Link href="/privacy" className="transition hover:text-slate-950">Privacy</Link>
                </span>
              </div>
            </div>
          </div>
        </section>
      </motion.div>
    </main>
  );
}
