'use client';

// Bouton « COMMENCER LA COMPOSITION » : crée la tentative côté serveur puis
// entre en salle. Reprend une tentative en cours si une existe (coupure).

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getAnonId, getAttemptEnCours, setAttemptEnCours } from '@/lib/local';

export default function BoutonCommencer({ compositionId }: { compositionId: string }) {
  const router = useRouter();
  const [chargement, setChargement] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [reprise, setReprise] = useState(false);

  useEffect(() => {
    setReprise(Boolean(getAttemptEnCours(compositionId)));
  }, [compositionId]);

  async function commencer() {
    setChargement(true);
    setErreur(null);
    try {
      if (getAttemptEnCours(compositionId)) {
        router.push(`/composition/${compositionId}/session`);
        return;
      }
      const res = await fetch('/api/attempts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ composition_id: compositionId, anon_id: getAnonId() }),
      });
      if (!res.ok) throw new Error('création impossible');
      const data = await res.json();
      setAttemptEnCours(compositionId, data.attempt_id);
      try {
        window.localStorage.setItem(`revicam.start.${data.attempt_id}`, data.started_at);
      } catch { /* ignorer */ }
      router.push(`/composition/${compositionId}/session`);
    } catch {
      setErreur('Connexion impossible. Vérifie ta connexion puis réessaie.');
      setChargement(false);
    }
  }

  return (
    <div className="text-center">
      <button
        type="button"
        onClick={commencer}
        disabled={chargement}
        className="w-full rounded-lg bg-navy px-6 py-3 text-base font-bold text-white shadow transition hover:bg-navy-mid disabled:opacity-60 sm:w-auto"
      >
        {chargement ? 'Préparation…' : reprise ? 'REPRENDRE MA COMPOSITION' : 'COMMENCER LA COMPOSITION'}
      </button>
      {erreur && <p className="mt-2 text-sm text-red-600">{erreur}</p>}
    </div>
  );
}
