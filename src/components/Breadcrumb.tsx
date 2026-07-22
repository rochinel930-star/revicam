import Link from 'next/link';

export interface Miette {
  href?: string;
  label: string;
}

/** Fil d'Ariane des pages profondes. Le dernier élément est la page courante. */
export default function Breadcrumb({ miettes }: { miettes: Miette[] }) {
  return (
    <nav aria-label="Fil d'Ariane" className="mb-4 overflow-x-auto whitespace-nowrap text-xs text-slate-500">
      <ol className="flex items-center gap-1">
        <li>
          <Link href="/" className="hover:text-navy">Accueil</Link>
        </li>
        {miettes.map((m, i) => (
          <li key={i} className="flex items-center gap-1">
            <span aria-hidden>›</span>
            {m.href ? (
              <Link href={m.href} className="hover:text-navy">{m.label}</Link>
            ) : (
              <span aria-current="page" className="font-medium text-slate-700">{m.label}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
