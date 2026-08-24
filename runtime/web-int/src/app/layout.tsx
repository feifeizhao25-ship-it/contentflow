import type { Metadata } from 'next';
import Link from 'next/link';
import MobileNav from '@/components/layout/MobileNav';
import './globals.css';

export const metadata: Metadata = {
  title: 'ContentFlow Global',
  description: 'Review-first content operations for international teams.',
};

const links: ReadonlyArray<readonly [label: string, href: string]> = [
  ['Workspace', '/'],
  ['Create', '/create'],
  ['Content Packs', '/content-packs'],
  ['Data Network', '/data-network'],
];

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <header className="topbar">
          <Link href="/" className="brand">ContentFlow <span>Global</span></Link>
          <nav aria-label="Primary navigation">
            {links.map(([label, href]) => <Link key={href} href={href}>{label}</Link>)}
          </nav>
          <MobileNav links={links} />
          <Link href="/login" className="button secondary">Account</Link>
        </header>
        {children}
        <footer>ContentFlow Global · Human-reviewed AI operations · Privacy by design</footer>
      </body>
    </html>
  );
}
