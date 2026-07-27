'use client';

// Frontière d'erreur de segment — durcissement Release Candidate.
// Évite l'écran d'erreur brut de Next en production ; propose de réessayer.

import { useEffect } from 'react';

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // Trace minimale (sans donnée personnelle).
    console.error('segment-error', error?.digest ?? error?.message);
  }, [error]);

  return (
    <div className="mx-auto max-w-md pt-10 text-center">
      <p className="text-5xl">😕</p>
      <h1 className="mt-3 text-2xl font-bold text-navy">Une erreur est survenue</h1>
      <p className="mt-2 text-sm text-slate-600">
        Réessaie dans un instant. Si le problème persiste, reviens plus tard.
      </p>
      <button
        type="button"
        onClick={reset}
        className="mt-5 inline-block rounded-lg bg-navy px-5 py-2.5 text-sm font-bold text-white shadow hover:bg-navy-mid"
      >
        Réessayer
      </button>
    </div>
  );
}
