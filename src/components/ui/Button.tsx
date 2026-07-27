// Primitive UI — Button. Design System P5.
// Bouton/lien cohérent (variantes primaire/secondaire), accessible, mobile-first.

import type { ReactNode } from 'react';
import Link from 'next/link';

type Variante = 'primaire' | 'secondaire';

const BASE =
  'inline-flex items-center justify-center gap-2 rounded-lg px-5 py-2.5 text-sm font-bold transition disabled:opacity-60';
const VARIANTES: Record<Variante, string> = {
  primaire: 'bg-navy text-white shadow hover:bg-navy-mid',
  secondaire: 'border border-slate-300 bg-white text-slate-800 hover:border-navy',
};

export function Button({
  children,
  variante = 'primaire',
  type = 'button',
  onClick,
  disabled,
  className = '',
}: {
  children: ReactNode;
  variante?: Variante;
  type?: 'button' | 'submit';
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button type={type} onClick={onClick} disabled={disabled} className={`${BASE} ${VARIANTES[variante]} ${className}`}>
      {children}
    </button>
  );
}

export function ButtonLink({
  children,
  href,
  variante = 'primaire',
  className = '',
}: {
  children: ReactNode;
  href: string;
  variante?: Variante;
  className?: string;
}) {
  return (
    <Link href={href} className={`${BASE} ${VARIANTES[variante]} ${className}`}>
      {children}
    </Link>
  );
}
