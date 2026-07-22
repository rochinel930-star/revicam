'use client';

import Link from 'next/link';
import { useState } from 'react';
import { SITE_NAME } from '@/lib/config';

const LIENS = [
  { href: '/epreuves', label: '📄 Épreuves' },
  { href: '/cours', label: '📘 Cours & Fiches' },
  { href: '/composition', label: '✍️ Salle de Composition' },
  { href: '/mon-espace', label: '👤 Mon espace' },
];

export default function Header() {
  const [ouvert, setOuvert] = useState(false);
  return (
    <header className="fixed inset-x-0 top-0 z-40 bg-navy text-white shadow">
      <div className="mx-auto flex h-12 max-w-5xl items-center justify-between px-3">
        <Link href="/" className="text-lg font-bold tracking-tight" onClick={() => setOuvert(false)}>
          {SITE_NAME}
          <span className="ml-1 align-middle text-[0.6rem] font-semibold text-gold">CAMEROUN</span>
        </Link>
        <nav className="hidden gap-5 text-sm md:flex">
          {LIENS.map((l) => (
            <Link key={l.href} href={l.href} className="hover:text-gold">
              {l.label}
            </Link>
          ))}
        </nav>
        <button
          type="button"
          aria-label={ouvert ? 'Fermer le menu' : 'Ouvrir le menu'}
          aria-expanded={ouvert}
          className="p-2 md:hidden"
          onClick={() => setOuvert(!ouvert)}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            {ouvert ? (
              <path d="M6 6l12 12M18 6L6 18" />
            ) : (
              <path d="M4 7h16M4 12h16M4 17h16" />
            )}
          </svg>
        </button>
      </div>
      {ouvert && (
        <nav className="border-t border-navy-mid bg-navy-mid md:hidden">
          {LIENS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="block px-4 py-3 text-sm hover:bg-navy"
              onClick={() => setOuvert(false)}
            >
              {l.label}
            </Link>
          ))}
        </nav>
      )}
    </header>
  );
}
