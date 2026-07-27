// Page 404 personnalisée — durcissement Release Candidate.

import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="mx-auto max-w-md pt-10 text-center">
      <p className="text-5xl">🧭</p>
      <h1 className="mt-3 text-2xl font-bold text-navy">Page introuvable</h1>
      <p className="mt-2 text-sm text-slate-600">
        Cette page n’existe pas ou a été déplacée.
      </p>
      <Link
        href="/"
        className="mt-5 inline-block rounded-lg bg-navy px-5 py-2.5 text-sm font-bold text-white shadow hover:bg-navy-mid"
      >
        Retour à l’accueil
      </Link>
    </div>
  );
}
