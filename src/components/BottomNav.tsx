'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

// Les 3 piliers, toujours à un pouce de distance sur mobile.
const ONGLETS = [
  { href: '/epreuves', label: 'Épreuves', icone: '📄' },
  { href: '/cours', label: 'Cours', icone: '📘' },
  { href: '/composition', label: 'Composer', icone: '✍️' },
];

export default function BottomNav() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Navigation principale"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white md:hidden"
    >
      <div className="grid grid-cols-3">
        {ONGLETS.map((o) => {
          const actif = pathname.startsWith(o.href);
          return (
            <Link
              key={o.href}
              href={o.href}
              aria-current={actif ? 'page' : undefined}
              className={`flex flex-col items-center gap-0.5 py-2 text-[0.7rem] font-medium ${
                actif ? 'text-navy' : 'text-slate-500'
              }`}
            >
              <span aria-hidden className="text-lg leading-none">{o.icone}</span>
              {o.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
